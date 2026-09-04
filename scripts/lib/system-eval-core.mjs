/**
 * System evaluation core — AES-V2.14 (SUE-573).
 *
 * Evaluates the Editorial Learning Core *itself* (complexity, cost, entropy,
 * governance risk, adaptability) — never an article or artifact's quality,
 * which stays the owner's call alone. See evals/system/README.md for the
 * evaluation contract and docs/architecture/V2-EDITORIAL-LEARNING-CORE.md §11
 * for the spine this implements.
 *
 * Same shape as scripts/lib/registry-core.mjs on purpose: many small,
 * append-only, human/agent-authored records (here: one snapshot per periodic
 * review) plus one derived, rebuildable index (`current.json`). `current.json`
 * carries `kind: "current"` and is rebuilt byte-identically from the newest
 * snapshot by `--rebuild`; `--check` fails when the file on disk differs from
 * a fresh rebuild — the same enforced-reconstructability property, not a new
 * one invented for this surface.
 *
 * Hard rule enforced here, not just documented: no snapshot may carry an
 * aggregate/overall score. Quantitative metrics may support a dimension's
 * judgement; they never replace it (docs/architecture §11 "Judgement, not a
 * score"). additionalProperties:false on every object in
 * schemas/system-snapshot.schema.json already rejects any field the schema
 * does not name; `scanForAggregateScore` below is a second, purpose-built
 * check kept independent of the schema so a future schema edit cannot loosen
 * this rule silently.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');

export const PATHS = Object.freeze({
  schema: resolve(ROOT, 'schemas/system-snapshot.schema.json'),
  systemDir: resolve(ROOT, 'evals/system'),
  snapshotsDir: resolve(ROOT, 'evals/system/snapshots'),
  currentPath: resolve(ROOT, 'evals/system/current.json'),
  reviewsDir: resolve(ROOT, 'evals/system/reviews'),
});

export const FIXED_DIMENSION_IDS = Object.freeze([
  'quality_lift', 'operator_friction', 'context_efficiency', 'reference_health',
  'calibration_health', 'routing_effectiveness', 'portability', 'governance_safety',
  'cost_per_accepted', 'maintainability',
]);

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  AGGREGATE_SCORE: 'aggregate-score-present',
  DIMENSION_SET_INVALID: 'dimension-set-invalid',
  HEALTHY_NO_EVIDENCE: 'non-insufficient-state-without-evidence',
  EVIDENCE_UNRESOLVED: 'evidence-ref-unresolved',
  SILENCE_MISUSE: 'silence-treated-as-acceptance',
  OWNER_VERDICT_MISCOUNT: 'owner-verdict-unknown-counted-as-accepted',
  KIND_DERIVATION_MISMATCH: 'kind-derivation-mismatch',
  FILENAME_MISMATCH: 'id-filename-mismatch',
  DUPLICATE_ID: 'duplicate-snapshot-id',
  STALE_CURRENT: 'stale-current',
  NO_SNAPSHOTS: 'no-snapshots-found',
});

const issue = (code, where, message) => ({ code, where, message });

export const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const loadSchema = (p = PATHS.schema) => loadJson(p);

function parseJsonFile(path) {
  try {
    return { data: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (err) {
    return { error: err.message };
  }
}

function slugAfterColon(id) {
  const i = typeof id === 'string' ? id.indexOf(':') : -1;
  return i === -1 ? id : id.slice(i + 1);
}

export function listSnapshotFiles(dir = PATHS.snapshotsDir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => resolve(dir, e.name))
    .sort();
}

// --- evidence ref resolution -------------------------------------------

/**
 * Parse one `evidence_sources`/`evidence_refs` entry:
 *   "<repo-relative-path>[#<field-or-key>][ — <human note>]"
 * The note (after " — ") is free text and never checked. The path and the
 * optional pointer are.
 */
export function parseEvidenceRef(ref) {
  const dashIdx = ref.indexOf(' — ');
  const head = dashIdx === -1 ? ref : ref.slice(0, dashIdx);
  const note = dashIdx === -1 ? '' : ref.slice(dashIdx + 3).trim();
  const hashIdx = head.indexOf('#');
  const path = (hashIdx === -1 ? head : head.slice(0, hashIdx)).trim();
  const pointer = hashIdx === -1 ? null : head.slice(hashIdx + 1).trim();
  return { path, pointer, note };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve one evidence ref against the real repository tree. This is a
 * lightweight, honest check, not full JSON-Pointer resolution: the path must
 * exist on disk; when a pointer is given, its last dotted/bracketed segment
 * must appear as a literal key/identifier token somewhere in that file's raw
 * text. That is enough to catch a nonexistent path or a typo'd field name
 * without pretending to be a schema-aware JSON Pointer engine — mechanical
 * where mechanical is honest, in the same spirit as
 * scripts/lib/json-schema-lite.mjs and scripts/lib/routing-core.mjs.
 */
export function resolveEvidenceRef(ref, { root = ROOT } = {}) {
  const { path, pointer } = parseEvidenceRef(ref);
  if (!path) return { ok: false, reason: 'empty path' };
  const abs = resolve(root, path);
  if (!existsSync(abs)) return { ok: false, reason: `path does not exist: ${path}` };
  if (!pointer) return { ok: true, path, pointer: null, json: null };

  const stat = statSync(abs);
  if (stat.isDirectory()) {
    return { ok: false, reason: `pointer "${pointer}" given but "${path}" is a directory` };
  }
  const text = readFileSync(abs, 'utf8');
  const lastSeg = pointer.split(/[.[\]]/).filter(Boolean).pop() ?? pointer;
  const tokenRe = new RegExp(`["'\`]?${escapeRegExp(lastSeg)}["'\`]?`);
  if (!tokenRe.test(text)) {
    return { ok: false, reason: `field/pointer "${pointer}" not found in ${path}` };
  }
  let json = null;
  if (path.endsWith('.json')) {
    try { json = JSON.parse(text); } catch { json = null; }
  }
  return { ok: true, path, pointer, json };
}

// --- aggregate-score guard -----------------------------------------------

const FORBIDDEN_EXACT_KEYS = new Set([
  'score', 'overall_score', 'health_score', 'total_score', 'aggregate_score',
  'system_score', 'overall_health', 'health_percentage', 'composite_score',
  'weighted_score', 'grade',
]);
const SCORE_SHAPED_KEY_RE = /(^|_)(score|rating|percentage|grade)($|_)/i;

/** Returns the first offending `{ path, key }`, or null. */
export function scanForAggregateScore(value, path = '$') {
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const hit = scanForAggregateScore(v, `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const keyIsForbidden = FORBIDDEN_EXACT_KEYS.has(k.toLowerCase());
      const numberLooksScoreShaped = typeof v === 'number' && SCORE_SHAPED_KEY_RE.test(k);
      if (keyIsForbidden || numberLooksScoreShaped) return { path: `${path}.${k}`, key: k };
      const hit = scanForAggregateScore(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}

// --- silence-is-not-acceptance guard ---------------------------------------

/**
 * Text-level guard: a dimension's prose may never argue that publication, an
 * L1 pass, or the absence of complaint amounts to acceptance. Mechanical
 * keyword gate, same style as scripts/lib/registry-core.mjs's
 * FACTUAL_CLAIM_RE — never claimed to be a complete classifier.
 */
// The (?!\bnot\b|\bnever\b) guard keeps this from tripping over sentences
// that state the rule itself ("silence is not acceptance", "never inferred
// from silence") — only an actual is-treated-as-acceptance claim matches.
const SILENCE_AS_ACCEPTANCE_RE =
  /(publi(?:shed|cation)|no (?:owner )?complaints?|absence of (?:feedback|complaint)|silence|l1 pass)(?:(?!\bnot\b|\bnever\b)[^.]){0,60}(accept|approv)/i;
const ACCEPTANCE_THEN_SILENCE_RE =
  /(accept|approv)(?:(?!\bnot\b|\bnever\b)[^.]){0,60}(publi(?:shed|cation)|no (?:owner )?complaints?|absence of (?:feedback|complaint)|silence|l1 pass)/i;

function collectStrings(value, path, out) {
  if (typeof value === 'string') {
    out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectStrings(v, `${path}[${i}]`, out));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectStrings(v, `${path}.${k}`, out);
  }
}

export function findSilenceMisuse(data) {
  const strings = [];
  collectStrings(data, '$', strings);
  const hits = [];
  for (const { path, text } of strings) {
    if (SILENCE_AS_ACCEPTANCE_RE.test(text) || ACCEPTANCE_THEN_SILENCE_RE.test(text)) {
      hits.push({ path, text });
    }
  }
  return hits;
}

/**
 * Data-level guard, not just prose: if a dimension's evidence_refs resolve to
 * a record whose own `owner_verdict` field is literally "unknown", that
 * dimension's interpretation may not claim acceptance grounded in that
 * record without acknowledging the verdict is unknown.
 */
function checkOwnerVerdictMiscount(dimension, root) {
  const issues = [];
  const refs = Array.isArray(dimension.evidence_refs) ? dimension.evidence_refs : [];
  for (const ref of refs) {
    const resolved = resolveEvidenceRef(ref, { root });
    if (!resolved.ok || !resolved.json) continue;
    const verdict = resolved.json.owner_verdict;
    if (verdict !== 'unknown') continue;
    const text = `${dimension.interpretation ?? ''} ${dimension.recommended_action ?? ''}`;
    const claimsAccepted = /\baccept(ed)?\b/i.test(text);
    const acknowledgesUnknown = /\bunknown\b|not (?:yet )?(?:been )?(?:expressed|observed)|no owner verdict/i.test(text);
    if (claimsAccepted && !acknowledgesUnknown) {
      issues.push(issue(
        CODES.OWNER_VERDICT_MISCOUNT,
        `dimension ${dimension.id ?? '?'}`,
        `evidence_ref "${ref}" resolves to a record with owner_verdict "unknown", but the dimension's interpretation/recommended_action claims acceptance without acknowledging that`,
      ));
    }
  }
  return issues;
}

// --- top-level validation ---------------------------------------------------

export function validateSnapshotObject(data, { schema = loadSchema(), root = ROOT, checkEvidence = true } = {}) {
  const issues = [];
  for (const e of validate(data, schema)) issues.push(issue(CODES.SCHEMA, '$', `${e.path}: ${e.message}`));

  const agg = scanForAggregateScore(data);
  if (agg) {
    issues.push(issue(CODES.AGGREGATE_SCORE, agg.path,
      `aggregate/score-shaped field "${agg.key}" is not permitted — quantitative metrics support a judgement, they never replace it`));
  }

  if (Array.isArray(data.dimensions)) {
    const ids = data.dimensions.map((d) => d?.id).filter((id) => typeof id === 'string');
    const idSet = new Set(ids);
    const missing = FIXED_DIMENSION_IDS.filter((id) => !idSet.has(id));
    const unknown = ids.filter((id) => !FIXED_DIMENSION_IDS.includes(id));
    const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (ids.length !== FIXED_DIMENSION_IDS.length || missing.length || unknown.length || duplicated.length) {
      issues.push(issue(CODES.DIMENSION_SET_INVALID, 'dimensions',
        `must carry exactly the ${FIXED_DIMENSION_IDS.length} SUE-573 dimension ids, each once`
        + (missing.length ? ` — missing: ${missing.join(', ')}` : '')
        + (unknown.length ? ` — unknown: ${unknown.join(', ')}` : '')
        + (duplicated.length ? ` — duplicated: ${duplicated.join(', ')}` : '')));
    }

    for (const d of data.dimensions) {
      if (!d || typeof d !== 'object') continue;
      const where = `dimension ${d.id ?? '?'}`;
      const evidenceRefs = Array.isArray(d.evidence_refs) ? d.evidence_refs : [];
      if (d.state && d.state !== 'INSUFFICIENT_EVIDENCE' && evidenceRefs.length === 0) {
        issues.push(issue(CODES.HEALTHY_NO_EVIDENCE, where,
          `state "${d.state}" requires at least one evidence_refs entry`));
      }
      if (checkEvidence) {
        const allRefs = [...(Array.isArray(d.evidence_sources) ? d.evidence_sources : []), ...evidenceRefs];
        for (const ref of allRefs) {
          const resolved = resolveEvidenceRef(ref, { root });
          if (!resolved.ok) {
            issues.push(issue(CODES.EVIDENCE_UNRESOLVED, where, `"${ref}" — ${resolved.reason}`));
          }
        }
        issues.push(...checkOwnerVerdictMiscount(d, root));
      }
    }
  }

  if (data.kind === 'current' && data.derived_from_snapshot == null) {
    issues.push(issue(CODES.KIND_DERIVATION_MISMATCH, 'derived_from_snapshot', 'kind "current" requires a non-null derived_from_snapshot'));
  }
  if (data.kind === 'snapshot' && data.derived_from_snapshot != null) {
    issues.push(issue(CODES.KIND_DERIVATION_MISMATCH, 'derived_from_snapshot', 'kind "snapshot" requires derived_from_snapshot to be null — a snapshot is authored directly, never derived'));
  }
  if (data.kind === 'current' && data.snapshot_id !== 'system-eval:current') {
    issues.push(issue(CODES.KIND_DERIVATION_MISMATCH, 'snapshot_id', 'kind "current" requires the sentinel snapshot_id "system-eval:current"'));
  }
  if (data.kind === 'snapshot' && data.snapshot_id === 'system-eval:current') {
    issues.push(issue(CODES.KIND_DERIVATION_MISMATCH, 'snapshot_id', 'snapshot_id "system-eval:current" is reserved for current.json'));
  }

  for (const hit of findSilenceMisuse(data)) {
    issues.push(issue(CODES.SILENCE_MISUSE, hit.path,
      `reads as inferring acceptance from publication/silence/absence of complaint: "${hit.text}"`));
  }

  return issues;
}

export function validateSnapshotFile(path, opts = {}) {
  const where = `evals/system/.../${basename(path)}`;
  const { data, error } = parseJsonFile(path);
  if (error) return [issue(CODES.PARSE, where, `unparseable snapshot: ${error}`)];

  const issues = validateSnapshotObject(data, opts).map((i) => ({ ...i, where: i.where === '$' ? where : `${where} :: ${i.where}` }));

  if (data.kind === 'snapshot' && typeof data.snapshot_id === 'string') {
    const expectedFile = `${slugAfterColon(data.snapshot_id)}.json`;
    if (basename(path) !== expectedFile) {
      issues.push(issue(CODES.FILENAME_MISMATCH, where,
        `snapshot_id "${data.snapshot_id}" expects filename "${expectedFile}", found "${basename(path)}"`));
    }
  }
  if (data.kind === 'current' && basename(path) !== 'current.json') {
    issues.push(issue(CODES.FILENAME_MISMATCH, where, 'kind "current" must live at evals/system/current.json'));
  }

  return issues;
}

// --- current.json rebuild (derived, deterministic) --------------------------

/** Deterministic JSON: keys sorted recursively, 2-space indent, trailing newline. Array order is preserved. */
export function canonicalJson(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  }
  return value;
}

/**
 * current.json is always identical to the newest snapshot's judgement, with
 * kind/snapshot_id/derived_from_snapshot swapped to the "current" shape.
 * "Newest" is the lexicographically-last snapshot filename under
 * evals/system/snapshots/ — filenames are date-prefixed
 * (<YYYY-MM-DD>-<slug>.json) by convention so lexicographic order is
 * chronological order.
 */
export function rebuildCurrent(snapshotsDir = PATHS.snapshotsDir) {
  const files = listSnapshotFiles(snapshotsDir);
  if (files.length === 0) {
    throw new Error(`no snapshots found under ${snapshotsDir} — cannot rebuild current.json`);
  }
  const newestPath = files[files.length - 1];
  const snap = loadJson(newestPath);
  return {
    ...snap,
    kind: 'current',
    snapshot_id: 'system-eval:current',
    derived_from_snapshot: snap.snapshot_id,
  };
}

function readDiskText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Returns { fresh, onDisk, matches } for current.json against a fresh rebuild. */
export function checkCurrentFreshness(snapshotsDir = PATHS.snapshotsDir, currentPath = PATHS.currentPath) {
  const fresh = canonicalJson(rebuildCurrent(snapshotsDir));
  const onDisk = readDiskText(currentPath);
  return { fresh, onDisk, matches: onDisk === fresh };
}

// --- top-level operations ---------------------------------------------------

export function validateAll() {
  const issues = [];
  let schema;
  try {
    schema = loadSchema();
  } catch (err) {
    return [issue(CODES.PARSE, PATHS.schema, err.message)];
  }

  const files = listSnapshotFiles();
  if (files.length === 0) {
    issues.push(issue(CODES.NO_SNAPSHOTS, PATHS.snapshotsDir, 'no snapshot files found'));
  }

  const seenIds = new Set();
  for (const path of files) {
    issues.push(...validateSnapshotFile(path, { schema }));
    const { data } = parseJsonFile(path);
    if (data?.snapshot_id) {
      if (seenIds.has(data.snapshot_id)) {
        issues.push(issue(CODES.DUPLICATE_ID, path, `duplicate snapshot_id "${data.snapshot_id}"`));
      }
      seenIds.add(data.snapshot_id);
    }
  }

  if (existsSync(PATHS.currentPath)) {
    issues.push(...validateSnapshotFile(PATHS.currentPath, { schema }));
  } else {
    issues.push(issue(CODES.PARSE, PATHS.currentPath, 'evals/system/current.json is missing'));
  }

  if (files.length > 0 && existsSync(PATHS.currentPath)) {
    try {
      const fresh = checkCurrentFreshness();
      if (!fresh.matches) {
        issues.push(issue(CODES.STALE_CURRENT, 'evals/system/current.json',
          'stale relative to evals/system/snapshots/ — run `node scripts/system-scorecard.mjs --rebuild`'));
      }
    } catch (err) {
      issues.push(issue(CODES.STALE_CURRENT, 'evals/system/current.json', err.message));
    }
  }

  return issues;
}
