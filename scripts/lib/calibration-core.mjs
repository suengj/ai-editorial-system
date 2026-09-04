/**
 * Calibration core — AES-V2.10 (SUE-568).
 *
 * Versioned calibration snapshots (calibration/versions/), the derived
 * current-snapshot index (calibration/current.json), and the experiment
 * ledger (calibration/ledger/). See calibration/CALIBRATION-PROTOCOL.md for
 * the write protocol this enforces and
 * docs/architecture/V2-EDITORIAL-LEARNING-CORE.md §6, §7, §9, §10 for the
 * authority this implements.
 *
 * A calibration version is a snapshot with lineage, never the mean of all
 * feedback ever recorded. Historical records are immutable evidence:
 * superseding writes a NEW file and sets superseded_by on the old one; it
 * never edits the old version's substantive fields. `diffSubstantive` below
 * is what makes that an enforced property rather than a claim.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { checkPromotionSufficiency } from './promotion-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');

export const PATHS = Object.freeze({
  versionSchema: resolve(ROOT, 'schemas/calibration-version.schema.json'),
  experimentSchema: resolve(ROOT, 'schemas/experiment-record.schema.json'),
  versionsDir: resolve(ROOT, 'calibration/versions'),
  ledgerDir: resolve(ROOT, 'calibration/ledger'),
  currentPath: resolve(ROOT, 'calibration/current.json'),
  feedbackDir: resolve(ROOT, 'feedback/records'),
  routingTable: resolve(ROOT, 'editorial/feedback-routing.json'),
});

/**
 * Pinned write-authority set (AES-V2 B2). Classes 5 (profile / core routing
 * change — evidence-backed review) and 6 (Constitution / core invariants /
 * SSOT — human authorization + independent Reviewer) had a git-HEAD
 * immutability guard for NOTHING: class 4 (calibration versions, above) has
 * one, classes 5/6 had none, so the top of the ladder could rewrite itself
 * unnoticed while every gate exits 0.
 *
 * This is declared as DATA, not folded into the checker function below —
 * pinning a new class-5/6 file is a data change here, never a code change
 * to checkPinnedAuthority.
 *
 *   kind "file": the whole file at `path` is pinned.
 *   kind "json-paths": only the named top-level keys of the JSON at `path`
 *     are pinned (other keys in the same file may belong to a different,
 *     unpinned authority class and change freely).
 *   kind "dir": every file directly under `path` is pinned, including one
 *     that does not exist yet at HEAD (a brand-new profile file is a class-5
 *     change exactly as much as editing an existing one).
 */
export const PINNED_AUTHORITY = Object.freeze([
  { path: 'editorial/constitution.md', kind: 'file' },
  { path: 'docs/architecture/SSOT-BOUNDARIES.md', kind: 'file' },
  { path: 'editorial/feedback-routing.json', kind: 'json-paths', jsonPaths: ['layers', 'authority_matrix'] },
  { path: 'editorial/profiles/brand', kind: 'dir' },
]);

export const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const loadVersionSchema = (p = PATHS.versionSchema) => loadJson(p);
export const loadExperimentSchema = (p = PATHS.experimentSchema) => loadJson(p);

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  FILENAME_MISMATCH: 'id-filename-mismatch',
  AGENT_AUTHORED_ACTIVE: 'agent-authored-active',
  CANDIDATE_NO_CONFLICTING_EVIDENCE: 'candidate-no-conflicting-evidence',
  DRIFT_EVIDENCE_MODEL_INFERENCE: 'drift-evidence-model-inference',
  PROMOTION_INSUFFICIENT: 'promotion-insufficient',
  PROMOTION_NOT_HUMAN: 'promotion-not-human',
  MULTIPLE_ACTIVE_FOR_SCOPE: 'multiple-active-for-scope',
  MUTATED_HISTORICAL_VERSION: 'mutated-historical-version',
  PINNED_AUTHORITY_CHANGED: 'pinned-authority-changed-without-ledger-citation',
  DUPLICATE_ID: 'duplicate-id',
  STALE_CURRENT: 'stale-current',
  UNKNOWN_TARGET_LAYER: 'unknown-target-layer',
  EMPTY_EVALUATION_SET: 'empty-evaluation-set',
  MISSING_MODEL_DRIFT_BLOCK: 'missing-model-drift-block',
});

const issue = (code, where, message) => ({ code, where, message });

/** "calibration:audience-beginner-learner@v1" -> { scopeSlug: "audience-beginner-learner", version: 1 } */
export function parseCalibrationId(id) {
  const m = /^calibration:([a-z0-9]+(?:-[a-z0-9]+)*)@v([0-9]+)$/.exec(id ?? '');
  if (!m) return null;
  return { scopeSlug: m[1], version: Number(m[2]) };
}

function slugAfterColon(id) {
  const i = typeof id === 'string' ? id.indexOf(':') : -1;
  return i === -1 ? id : id.slice(i + 1);
}

function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => resolve(dir, e.name))
    .sort();
}

function parseJsonFile(path) {
  try {
    return { data: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (err) {
    return { error: err.message };
  }
}

// --- feedback cross-check (read-only; feedback/** is owned elsewhere) ------

/**
 * Resolve a feedback-record evidence ref to its basis, if the record exists
 * on disk. Returns null when unresolvable — an unresolved cross-package
 * reference is not itself an error here (feedback/** is append-only material
 * owned by a different package), but a RESOLVED model_inference record used
 * as drift evidence is a hard deny.
 */
export function resolveFeedbackBasis(refId, feedbackDir = PATHS.feedbackDir) {
  if (typeof refId !== 'string' || !refId.startsWith('feedback:')) return null;
  const path = resolve(feedbackDir, `${slugAfterColon(refId)}.json`);
  if (!existsSync(path)) return null;
  const { data } = parseJsonFile(path);
  return data?.basis ?? null;
}

// --- layer cross-check ------------------------------------------------------

export function loadRoutingLayerIds(path = PATHS.routingTable) {
  const table = loadJson(path);
  const ids = new Set();
  for (const group of Object.values(table.layers ?? {})) {
    for (const layer of group) ids.add(layer.id);
  }
  return ids;
}

// --- calibration versions ---------------------------------------------------

export function listVersionFiles(dir = PATHS.versionsDir) {
  return listJsonFiles(dir);
}

export function validateVersionFile(path, {
  schema = loadVersionSchema(),
  feedbackDir = PATHS.feedbackDir,
} = {}) {
  const where = `calibration/versions/${basename(path)}`;
  const { data, error } = parseJsonFile(path);
  if (error) return [issue(CODES.PARSE, where, `unparseable calibration version: ${error}`)];

  const issues = [];
  for (const e of validate(data, schema)) issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  if (issues.some((i) => i.code === CODES.SCHEMA)) return issues; // shape must hold before semantic checks are meaningful

  const parsed = parseCalibrationId(data.calibration_id);
  if (parsed) {
    const expectedFile = `${parsed.scopeSlug}.v${parsed.version}.json`;
    if (basename(path) !== expectedFile) {
      issues.push(issue(CODES.FILENAME_MISMATCH, where,
        `calibration_id "${data.calibration_id}" expects filename "${expectedFile}", found "${basename(path)}"`));
    }
  }

  // An agent may raise a candidate; only a human may author an active or
  // (by extension, since it was once active) a superseded version.
  if ((data.status === 'active' || data.status === 'superseded') && data.authorized_by?.type !== 'human') {
    issues.push(issue(CODES.AGENT_AUTHORED_ACTIVE, where,
      `status "${data.status}" requires authorized_by.type "human" — an agent may never author an active calibration version`));
  }

  // A candidate (DRIFT_CANDIDATE) must carry conflicting evidence and cannot
  // self-promote: no single feedback record, and no model_inference basis.
  if (data.status === 'candidate') {
    const conflicting = Array.isArray(data.conflicting_evidence) ? data.conflicting_evidence : [];
    if (conflicting.length === 0) {
      issues.push(issue(CODES.CANDIDATE_NO_CONFLICTING_EVIDENCE, where,
        'status "candidate" requires non-empty conflicting_evidence — a DRIFT_CANDIDATE must point at the evidence it joins'));
    }
    for (const ref of conflicting) {
      const basis = resolveFeedbackBasis(ref, feedbackDir);
      if (basis === 'model_inference') {
        issues.push(issue(CODES.DRIFT_EVIDENCE_MODEL_INFERENCE, where,
          `conflicting_evidence "${ref}" resolves to a model_inference-basis record — drift evidence must be explicit_human_feedback`));
      }
    }
  }

  // Promotion (candidate -> active) must be human-authorized and may not
  // rest on a single record unless it names an explicit owner declaration.
  if (data.promotion) {
    const { authorized_by: authorizedBy, basis, evidence_refs: evidenceRefs } = data.promotion;
    const result = checkPromotionSufficiency({ authorizedBy, basis, evidenceRefs });
    if (!result.isHuman) {
      issues.push(issue(CODES.PROMOTION_NOT_HUMAN, where,
        'promotion.authorized_by must be a human identity — an agent may never activate the candidate it raised'));
    }
    if (result.insufficientEvidence) {
      issues.push(issue(CODES.PROMOTION_INSUFFICIENT, where,
        'a candidate cannot be promoted by a single feedback record, or by "published"/"L1 pass" alone — either repeated independent evidence (2+ evidence_refs) or an explicit owner declaration is required'));
    }
  }

  return issues;
}

/**
 * Compare two versions of the same calibration record, ignoring the two
 * fields a legitimate supersession is allowed to change (status,
 * superseded_by). Any other difference is a mutation of immutable historical
 * evidence. Pure function so it is testable without real git history.
 */
export function diffSubstantive(oldRecord, newRecord) {
  const strip = ({ status, superseded_by, ...rest }) => rest;
  return JSON.stringify(strip(oldRecord)) !== JSON.stringify(strip(newRecord));
}

/**
 * Real-repo immutability check: compares the working-tree copy of a version
 * file against the copy committed at HEAD, when one exists. Skips files with
 * no HEAD copy (new, not-yet-committed versions) — those cannot have been
 * mutated yet.
 */
export function checkHistoricalImmutability(path, root = ROOT) {
  const rel = path.startsWith(root) ? path.slice(root.length + 1) : path;
  let headText;
  try {
    headText = execFileSync('git', ['show', `HEAD:${rel}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return []; // no committed copy yet — nothing to mutate
  }
  const { data: current, error: currentErr } = parseJsonFile(path);
  if (currentErr) return [];
  let head;
  try {
    head = JSON.parse(headText);
  } catch {
    return [];
  }
  if (diffSubstantive(head, current)) {
    return [issue(CODES.MUTATED_HISTORICAL_VERSION, `calibration/versions/${basename(path)}`,
      'substantive fields changed relative to the committed HEAD copy — only status/superseded_by may change once a version is superseded')];
  }
  return [];
}

// --- pinned authority (AES-V2 B2) -------------------------------------------

function readHeadText(rel, root) {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null; // not in HEAD — new file, nothing committed to compare against yet
  }
}

function listDirFilesAtHead(relDir, root) {
  try {
    const out = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', '--', relDir], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function listDirFilesWorkingTree(relDir, root) {
  const abs = resolve(root, relDir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => `${relDir}/${e.name}`);
}

/**
 * Whether any experiment-ledger record cites `relPath` — the escape hatch
 * for a legitimate class-5/6 change is a ledger record naming the file, not
 * editing this checker. A plain substring search over each record's raw
 * text: ledger fields (hypothesis, smallest_change, notes, ...) are free
 * text, so this is the same "cite it in words" contract the rest of the
 * ledger already relies on, not a new structured field.
 */
function ledgerCitesPath(relPath, ledgerDir) {
  for (const file of listLedgerFiles(ledgerDir)) {
    const text = readDiskText(file);
    if (text && text.includes(relPath)) return true;
  }
  return false;
}

function jsonPathsChanged(headText, currentText, jsonPaths) {
  try {
    const headJson = JSON.parse(headText);
    const curJson = JSON.parse(currentText);
    const pick = (obj) => Object.fromEntries(jsonPaths.map((k) => [k, obj?.[k] ?? null]));
    return JSON.stringify(sortKeys(pick(headJson))) !== JSON.stringify(sortKeys(pick(curJson)));
  } catch {
    return headText !== currentText; // unparseable — fall back to a raw diff rather than silently passing
  }
}

function checkOnePinnedFile(rel, kind, jsonPaths, root, ledgerDir) {
  const headText = readHeadText(rel, root);
  if (headText === null) return []; // new file, not yet committed — nothing to have mutated
  const currentText = readDiskText(resolve(root, rel));
  const changed = currentText === null
    ? true // deleted relative to HEAD
    : kind === 'json-paths'
      ? jsonPathsChanged(headText, currentText, jsonPaths)
      : headText !== currentText;
  if (!changed) return [];
  if (ledgerCitesPath(rel, ledgerDir)) return [];
  return [issue(CODES.PINNED_AUTHORITY_CHANGED, rel,
    `pinned write-authority file changed relative to the committed HEAD copy with no experiment-ledger record citing "${rel}" — class 5/6 change requires a citing ledger record (calibration/ledger/), not a silent edit`)];
}

/**
 * Real-repo check over the declared PINNED_AUTHORITY set: every file diffs
 * its working-tree copy against HEAD (as checkHistoricalImmutability does
 * for calibration versions) and FAILS when changed with no experiment-ledger
 * record citing it. A brand-new file (no HEAD copy) is handled gracefully —
 * nothing to have mutated yet — which is what keeps an ordinary uncommitted
 * working tree from failing on unrelated in-progress work: this only ever
 * fires on a file inside the pinned set that HEAD already has a copy of.
 */
export function checkPinnedAuthority(root = ROOT, { pinned = PINNED_AUTHORITY, ledgerDir = PATHS.ledgerDir } = {}) {
  const issues = [];
  for (const entry of pinned) {
    if (entry.kind === 'dir') {
      const files = new Set([
        ...listDirFilesAtHead(entry.path, root),
        ...listDirFilesWorkingTree(entry.path, root),
      ]);
      for (const rel of files) {
        issues.push(...checkOnePinnedFile(rel, 'file', undefined, root, ledgerDir));
      }
    } else {
      issues.push(...checkOnePinnedFile(entry.path, entry.kind, entry.jsonPaths, root, ledgerDir));
    }
  }
  return issues;
}

// --- experiment ledger -------------------------------------------------------

export function listLedgerFiles(dir = PATHS.ledgerDir) {
  return listJsonFiles(dir);
}

export function validateLedgerFile(path, {
  schema = loadExperimentSchema(),
  layerIds = loadRoutingLayerIds(),
} = {}) {
  const where = `calibration/ledger/${basename(path)}`;
  const { data, error } = parseJsonFile(path);
  if (error) return [issue(CODES.PARSE, where, `unparseable experiment record: ${error}`)];

  const issues = [];
  for (const e of validate(data, schema)) issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  if (issues.some((i) => i.code === CODES.SCHEMA)) return issues;

  if (typeof data.experiment_id === 'string') {
    const expectedFile = `${slugAfterColon(data.experiment_id)}.json`;
    if (basename(path) !== expectedFile) {
      issues.push(issue(CODES.FILENAME_MISMATCH, where,
        `experiment_id "${data.experiment_id}" expects filename "${expectedFile}", found "${basename(path)}"`));
    }
  }

  if (!layerIds.has(data.target_layer)) {
    issues.push(issue(CODES.UNKNOWN_TARGET_LAYER, where,
      `target_layer "${data.target_layer}" is not a declared layer id in editorial/feedback-routing.json`));
  }

  const set = data.evaluation_set ?? {};
  const nonEmpty = ['fixtures', 'references', 'real_outputs'].some((k) => Array.isArray(set[k]) && set[k].length > 0);
  if (!nonEmpty) {
    issues.push(issue(CODES.EMPTY_EVALUATION_SET, where,
      'evaluation_set must have at least one non-empty array — an experiment that reran nothing cannot support keep/revert/insufficient_evidence'));
  }

  if (data.kind === 'model_drift' && !data.model_drift) {
    issues.push(issue(CODES.MISSING_MODEL_DRIFT_BLOCK, where, 'kind "model_drift" requires the model_drift block'));
  }

  return issues;
}

// --- current.json (derived) -------------------------------------------------

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

export const GENERATED_BY = 'scripts/calibration.mjs --rebuild';

/**
 * Build the derived current-snapshot index: the active version for each
 * scope, never the history. Deterministic and rebuildable byte-for-byte.
 */
export function buildCurrentSnapshot(versionsDir = PATHS.versionsDir) {
  const active = [];
  for (const path of listVersionFiles(versionsDir)) {
    const { data } = parseJsonFile(path);
    if (data?.status === 'active') {
      active.push({
        calibration_id: data.calibration_id,
        scope: data.scope,
        effective_from: data.effective_from,
        path: `calibration/versions/${basename(path)}`,
      });
    }
  }
  active.sort((a, b) => a.calibration_id.localeCompare(b.calibration_id));
  return { schema_version: '1.0.0', generated: true, generated_by: GENERATED_BY, active };
}

function readDiskText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

export function checkCurrentFreshness(versionsDir = PATHS.versionsDir, currentPath = PATHS.currentPath) {
  const fresh = canonicalJson(buildCurrentSnapshot(versionsDir));
  const onDisk = readDiskText(currentPath);
  return { fresh, onDisk, matches: onDisk === fresh };
}

export function rebuildCurrent() {
  return canonicalJson(buildCurrentSnapshot());
}

// --- top-level validation ----------------------------------------------------

export function validateAll({ checkGitImmutability = true } = {}) {
  const issues = [];
  let versionSchema;
  let experimentSchema;
  let layerIds;
  try {
    versionSchema = loadVersionSchema();
    experimentSchema = loadExperimentSchema();
    layerIds = loadRoutingLayerIds();
  } catch (err) {
    return [issue(CODES.PARSE, 'calibration', err.message)];
  }

  const scopeOwners = new Map(); // scopeKey -> [calibration_id]
  const seenVersionIds = new Set();

  for (const path of listVersionFiles()) {
    issues.push(...validateVersionFile(path, { schema: versionSchema }));
    if (checkGitImmutability) issues.push(...checkHistoricalImmutability(path));

    const { data } = parseJsonFile(path);
    if (!data) continue;
    if (data.calibration_id) {
      if (seenVersionIds.has(data.calibration_id)) {
        issues.push(issue(CODES.DUPLICATE_ID, path, `duplicate calibration_id "${data.calibration_id}"`));
      }
      seenVersionIds.add(data.calibration_id);
    }
    if (data.status === 'active' && data.scope) {
      const key = JSON.stringify(sortKeys(data.scope));
      const holders = scopeOwners.get(key) ?? [];
      holders.push(data.calibration_id);
      scopeOwners.set(key, holders);
    }
  }

  for (const [, holders] of scopeOwners) {
    if (holders.length > 1) {
      issues.push(issue(CODES.MULTIPLE_ACTIVE_FOR_SCOPE, 'calibration/versions',
        `more than one active version shares the same scope: ${holders.join(', ')}`));
    }
  }

  const seenExperimentIds = new Set();
  for (const path of listLedgerFiles()) {
    issues.push(...validateLedgerFile(path, { schema: experimentSchema, layerIds }));
    const { data } = parseJsonFile(path);
    if (data?.experiment_id) {
      if (seenExperimentIds.has(data.experiment_id)) {
        issues.push(issue(CODES.DUPLICATE_ID, path, `duplicate experiment_id "${data.experiment_id}"`));
      }
      seenExperimentIds.add(data.experiment_id);
    }
  }

  const fresh = checkCurrentFreshness();
  if (!fresh.matches) {
    issues.push(issue(CODES.STALE_CURRENT, 'calibration/current.json',
      'stale relative to calibration/versions/ — run `node scripts/calibration.mjs --rebuild`'));
  }

  if (checkGitImmutability) issues.push(...checkPinnedAuthority());

  return issues;
}
