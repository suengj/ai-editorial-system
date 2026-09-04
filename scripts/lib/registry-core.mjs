/**
 * Registry core — AES-V2.3 (SUE-561).
 *
 * Agent-managed Reference and Feedback Registry: many small append-only JSON
 * records plus a derived, rebuildable index. Never a monolithic JSON, never a
 * database.
 *
 * Two record kinds:
 *   - references/evaluations/<ref-id-slug>/<evaluation-id-slug>.json
 *     craft evidence about a reference (schemas/reference-evaluation.schema.json)
 *   - feedback/records/<feedback-id-slug>.json
 *     human/agent feedback on a generated output (schemas/feedback-record.schema.json)
 *
 * `references/index.json` and `feedback/index.json` are DERIVED. They carry
 * `generated: true` and are rebuilt byte-identically by `--rebuild`; `--check`
 * fails when the file on disk differs from a fresh rebuild. That is what makes
 * "reconstructable from durable records" an enforced property, not a claim.
 *
 * See references/REFERENCE-EVALUATION-PROTOCOL.md for the write protocol this
 * enforces.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');

export const PATHS = Object.freeze({
  evaluationSchema: resolve(ROOT, 'schemas/reference-evaluation.schema.json'),
  feedbackSchema: resolve(ROOT, 'schemas/feedback-record.schema.json'),
  catalog: resolve(ROOT, 'references/catalog.json'),
  evaluationsDir: resolve(ROOT, 'references/evaluations'),
  referencesIndex: resolve(ROOT, 'references/index.json'),
  feedbackDir: resolve(ROOT, 'feedback/records'),
  feedbackIndex: resolve(ROOT, 'feedback/index.json'),
});

export const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const loadEvaluationSchema = (p = PATHS.evaluationSchema) => loadJson(p);
export const loadFeedbackSchema = (p = PATHS.feedbackSchema) => loadJson(p);

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  FILENAME_MISMATCH: 'id-filename-mismatch',
  DIR_MISMATCH: 'id-directory-mismatch',
  UNRESOLVED_REF: 'unresolved-ref-id',
  EMBEDDED_BODY: 'embedded-body',
  FACTUAL_CLAIM: 'authority-boundary-violation',
  EVALUATOR_SHAPE: 'evaluator-shape',
  SCOPE_BASIS: 'scope-basis-violation',
  CALIBRATION_CANDIDATE_UNSUPPORTED: 'calibration-candidate-unsupported',
  ROUTING_GUESS: 'routing-guess-without-abstention',
  DUPLICATE_ID: 'duplicate-id',
  STALE_INDEX: 'stale-index',
  GENERATED_OUTPUT_UNPROMOTED: 'generated-output-unpromoted',
  PROMOTION_INSUFFICIENT: 'promotion-insufficient',
  OWNER_VERDICT_UNSUPPORTED: 'owner-verdict-unsupported',
});

/** Basis text that, alone, is not promotion evidence — publication and an L1 pass are not promotion. */
const INSUFFICIENT_PROMOTION_BASIS_RE = /^(published|publication|l1[\s-]*pass(ed)?)$/i;

const issue = (code, where, message) => ({ code, where, message });

/** id like "eval:vega-lite-2026-09-05-01" -> "vega-lite-2026-09-05-01" */
function slugAfterColon(id) {
  const i = typeof id === 'string' ? id.indexOf(':') : -1;
  return i === -1 ? id : id.slice(i + 1);
}

/** Recursively list `.json` files under `dir` (empty array if it doesn't exist). */
function listJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(abs);
    }
  };
  walk(dir);
  return out.sort();
}

function parseJsonFile(path) {
  try {
    return { data: JSON.parse(readFileSync(path, 'utf8')) };
  } catch (err) {
    return { error: err.message };
  }
}

/** A string value that looks like an embedded body: a data URI or a long base64-ish run. */
const DATA_URI_RE = /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i;
const LONG_BASE64_RE = /[A-Za-z0-9+/]{200,}={0,2}/;
const MAX_STRING_LEN = 4000;

function findEmbeddedBody(value, path = '$') {
  if (typeof value === 'string') {
    if (DATA_URI_RE.test(value) || LONG_BASE64_RE.test(value) || value.length > MAX_STRING_LEN) {
      return path;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) {
      const hit = findEmbeddedBody(v, `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const hit = findEmbeddedBody(v, `${path}.${k}`);
      if (hit) return hit;
    }
  }
  return null;
}

/** A reference evaluation asserting a fact, not craft evidence — the authority-boundary firewall. */
const FACTUAL_CLAIM_RE = /\b(is a fact|is a verified fact|verified fact|proves that|establishes that|confirmed fact|it is established that)\b/i;

function findFactualClaim(record) {
  const strings = [
    ...(record.strengths ?? []),
    ...(record.weaknesses ?? []),
    ...(record.dimensions ?? []).flatMap((d) => [d.note, d.evidence].filter(Boolean)),
    record.notes,
  ].filter((s) => typeof s === 'string');
  return strings.some((s) => FACTUAL_CLAIM_RE.test(s));
}

function checkEvaluatorShape(evaluator, where, issues) {
  if (!evaluator) return;
  if (evaluator.type === 'agent' && !evaluator.agent) {
    issues.push(issue(CODES.EVALUATOR_SHAPE, where, 'evaluator.type is "agent" but evaluator.agent is absent'));
  }
  if (evaluator.type === 'human' && evaluator.agent) {
    issues.push(issue(CODES.EVALUATOR_SHAPE, where, 'evaluator.type is "human" but evaluator.agent is present'));
  }
}

// --- evaluations -------------------------------------------------------

export function loadCatalogRefIds(catalogPath = PATHS.catalog) {
  const catalog = loadJson(catalogPath);
  return new Set((catalog.entries ?? []).map((e) => e.ref_id).filter(Boolean));
}

export function listEvaluationFiles(dir = PATHS.evaluationsDir) {
  return listJsonFiles(dir);
}

export function validateEvaluationFile(path, { schema = loadEvaluationSchema(), catalogRefIds = loadCatalogRefIds() } = {}) {
  const where = `references/evaluations/.../${basename(path)}`;
  const { data, error } = parseJsonFile(path);
  if (error) return [issue(CODES.PARSE, where, `unparseable evaluation: ${error}`)];

  const issues = [];
  for (const e of validate(data, schema)) issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));

  if (typeof data.evaluation_id === 'string') {
    const expectedFile = `${slugAfterColon(data.evaluation_id)}.json`;
    if (basename(path) !== expectedFile) {
      issues.push(issue(CODES.FILENAME_MISMATCH, where,
        `evaluation_id "${data.evaluation_id}" expects filename "${expectedFile}", found "${basename(path)}"`));
    }
  }
  if (typeof data.ref_id === 'string') {
    const expectedDir = slugAfterColon(data.ref_id);
    const actualDir = basename(dirname(path));
    if (actualDir !== expectedDir) {
      issues.push(issue(CODES.DIR_MISMATCH, where,
        `ref_id "${data.ref_id}" expects directory "${expectedDir}", found "${actualDir}"`));
    }
    if (!catalogRefIds.has(data.ref_id)) {
      issues.push(issue(CODES.UNRESOLVED_REF, where, `ref_id "${data.ref_id}" is not in references/catalog.json`));
    }
  }

  const bodyPath = findEmbeddedBody(data);
  if (bodyPath) {
    issues.push(issue(CODES.EMBEDDED_BODY, where, `looks like an embedded reference body or blob at ${bodyPath}`));
  }
  if (findFactualClaim(data)) {
    issues.push(issue(CODES.FACTUAL_CLAIM, where, 'asserts a fact; a reference evaluation grants craft evidence only, never factual authority'));
  }
  checkEvaluatorShape(data.evaluator, where, issues);
  issues.push(...checkGeneratedOutputPromotion(data, where));

  return issues;
}

/**
 * Anti-self-reinforcement guard (AES-V2.3/V2.4 delta): a generated_output
 * reference may sit in the registry as real-output evidence forever without
 * ever being promoted. It may not carry an `adopt` verdict — i.e. be treated
 * as a reusable positive reference — without an explicit promotion record,
 * and publication or an L1 pass alone is not that record.
 */
function checkGeneratedOutputPromotion(data, where) {
  const issues = [];
  const isAdopted = (data.dimensions ?? []).some((d) => d.verdict === 'adopt');

  if (data.provenance_class === 'generated_output' && isAdopted && !data.promotion) {
    issues.push(issue(CODES.GENERATED_OUTPUT_UNPROMOTED, where,
      'provenance_class "generated_output" carries an adopt verdict but no promotion block — publication or an L1 pass is not promotion; explicit human authorization or stronger evidence is required'));
  }

  if (data.promotion) {
    const { basis, evidence_refs: evidenceRefs } = data.promotion;
    const noEvidence = !Array.isArray(evidenceRefs) || evidenceRefs.length === 0;
    const basisAlone = typeof basis === 'string' && INSUFFICIENT_PROMOTION_BASIS_RE.test(basis.trim());
    if (noEvidence || basisAlone) {
      issues.push(issue(CODES.PROMOTION_INSUFFICIENT, where,
        'promotion.basis of "published" or "L1 pass" alone, or promotion with no evidence_refs, is not sufficient promotion evidence'));
    }
  }

  return issues;
}

// --- feedback ------------------------------------------------------------

export function listFeedbackFiles(dir = PATHS.feedbackDir) {
  return listJsonFiles(dir);
}

export function validateFeedbackFile(path, { schema = loadFeedbackSchema() } = {}) {
  const where = `feedback/records/${basename(path)}`;
  const { data, error } = parseJsonFile(path);
  if (error) return [issue(CODES.PARSE, where, `unparseable feedback record: ${error}`)];

  const issues = [];
  for (const e of validate(data, schema)) issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));

  if (typeof data.feedback_id === 'string') {
    const expectedFile = `${slugAfterColon(data.feedback_id)}.json`;
    if (basename(path) !== expectedFile) {
      issues.push(issue(CODES.FILENAME_MISMATCH, where,
        `feedback_id "${data.feedback_id}" expects filename "${expectedFile}", found "${basename(path)}"`));
    }
  }

  const bodyPath = findEmbeddedBody(data);
  if (bodyPath) {
    issues.push(issue(CODES.EMBEDDED_BODY, where, `looks like an embedded body or blob at ${bodyPath}`));
  }
  checkEvaluatorShape(data.evaluator, where, issues);

  if (data.basis === 'model_inference' && data.scope === 'calibration_candidate') {
    issues.push(issue(CODES.SCOPE_BASIS, where,
      'basis "model_inference" cannot carry scope "calibration_candidate" on its own — agent consensus may never silently replace human preference'));
  }
  if (data.scope === 'calibration_candidate' && !(Array.isArray(data.evidence_links) && data.evidence_links.length > 0)) {
    issues.push(issue(CODES.CALIBRATION_CANDIDATE_UNSUPPORTED, where,
      'scope "calibration_candidate" requires non-empty evidence_links — a single record, human- or agent-authored, never promotes itself'));
  }

  const routing = data.routing;
  if (routing && routing.layer == null && routing.abstained !== true) {
    issues.push(issue(CODES.ROUTING_GUESS, where, 'routing.layer is absent/null but abstained is not true — abstention must be explicit, not implied'));
  }

  issues.push(...checkOwnerVerdict(data, where));

  return issues;
}

/**
 * Owner acceptance guard (AES-V2.14 delta): silence is not acceptance.
 * owner_verdict may state something other than "unknown" only when it is
 * grounded in an actual human statement — evaluator.type "human", or basis
 * "explicit_human_feedback". An agent may record what the owner said; it may
 * never conclude acceptance on the owner's behalf from publication, an L1
 * pass, silence, or time passing.
 */
function checkOwnerVerdict(data, where) {
  const issues = [];
  const grounded = data.evaluator?.type === 'human' || data.basis === 'explicit_human_feedback';
  if (data.owner_verdict && data.owner_verdict !== 'unknown' && !grounded) {
    issues.push(issue(CODES.OWNER_VERDICT_UNSUPPORTED, where,
      `owner_verdict "${data.owner_verdict}" requires evaluator.type "human" or basis "explicit_human_feedback" — an agent may report what the owner said, never conclude acceptance on the owner's behalf`));
  }
  return issues;
}

// --- index (derived) -------------------------------------------------------

/** Deterministic JSON: keys sorted recursively, 2-space indent, trailing newline. */
export function canonicalJson(value) {
  return `${JSON.stringify(sortKeys(value), null, 2)}\n`;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]),
    );
  }
  return value;
}

export const GENERATED_BY = 'scripts/registry.mjs --rebuild';

const PROVENANCE_CLASSES = Object.freeze(['external', 'owner_created', 'generated_output']);

export function buildReferencesIndex(evaluationsDir = PATHS.evaluationsDir) {
  const entries = [];
  const byProvenanceClass = { external: 0, owner_created: 0, generated_output: 0 };
  let promotedGeneratedOutput = 0;

  for (const path of listEvaluationFiles(evaluationsDir)) {
    const { data } = parseJsonFile(path);
    if (!data) continue;
    const provenanceClass = data.provenance_class ?? null;
    if (PROVENANCE_CLASSES.includes(provenanceClass)) byProvenanceClass[provenanceClass] += 1;
    const promoted = provenanceClass === 'generated_output' && Boolean(data.promotion);
    if (promoted) promotedGeneratedOutput += 1;

    entries.push({
      ref_id: data.ref_id ?? null,
      evaluation_id: data.evaluation_id ?? null,
      modality: data.modality ?? null,
      basis: data.basis ?? null,
      evaluator_type: data.evaluator?.type ?? null,
      evaluated_at: data.evaluated_at ?? null,
      provenance_class: provenanceClass,
      promoted,
      path: `references/evaluations/${basename(dirname(path))}/${basename(path)}`,
    });
  }
  entries.sort((a, b) => (a.ref_id + a.evaluation_id).localeCompare(b.ref_id + b.evaluation_id));
  return {
    schema_version: '1.0.0',
    generated: true,
    generated_by: GENERATED_BY,
    counts: {
      by_provenance_class: byProvenanceClass,
      promoted_generated_output: promotedGeneratedOutput,
    },
    evaluations: entries,
  };
}

export function buildFeedbackIndex(feedbackDir = PATHS.feedbackDir) {
  const records = [];
  for (const path of listFeedbackFiles(feedbackDir)) {
    const { data } = parseJsonFile(path);
    if (!data) continue;
    records.push({
      feedback_id: data.feedback_id ?? null,
      subject_kind: data.subject?.kind ?? null,
      subject_ref: data.subject?.ref ?? null,
      signal: data.signal ?? null,
      verdict: data.verdict ?? null,
      scope: data.scope ?? null,
      created_at: data.created_at ?? null,
      path: `feedback/records/${basename(path)}`,
    });
  }
  records.sort((a, b) => a.feedback_id.localeCompare(b.feedback_id));
  return { schema_version: '1.0.0', generated: true, generated_by: GENERATED_BY, records };
}

function readDiskText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Returns { fresh, onDisk, matches } for one index. */
export function checkIndexFreshness(builder, indexPath) {
  const fresh = canonicalJson(builder());
  const onDisk = readDiskText(indexPath);
  return { fresh, onDisk, matches: onDisk === fresh };
}

// --- top-level operations ---------------------------------------------------

export function validateAll() {
  const issues = [];
  let schema;
  try {
    schema = loadEvaluationSchema();
  } catch (err) {
    return [issue(CODES.PARSE, PATHS.evaluationSchema, err.message)];
  }
  let feedbackSchema;
  try {
    feedbackSchema = loadFeedbackSchema();
  } catch (err) {
    return [issue(CODES.PARSE, PATHS.feedbackSchema, err.message)];
  }

  let catalogRefIds;
  try {
    catalogRefIds = loadCatalogRefIds();
  } catch (err) {
    return [issue(CODES.PARSE, PATHS.catalog, err.message)];
  }

  const seenEval = new Set();
  for (const path of listEvaluationFiles()) {
    const fileIssues = validateEvaluationFile(path, { schema, catalogRefIds });
    issues.push(...fileIssues);
    const { data } = parseJsonFile(path);
    if (data?.evaluation_id) {
      if (seenEval.has(data.evaluation_id)) {
        issues.push(issue(CODES.DUPLICATE_ID, path, `duplicate evaluation_id "${data.evaluation_id}"`));
      }
      seenEval.add(data.evaluation_id);
    }
  }

  const seenFeedback = new Set();
  for (const path of listFeedbackFiles()) {
    const fileIssues = validateFeedbackFile(path, { schema: feedbackSchema });
    issues.push(...fileIssues);
    const { data } = parseJsonFile(path);
    if (data?.feedback_id) {
      if (seenFeedback.has(data.feedback_id)) {
        issues.push(issue(CODES.DUPLICATE_ID, path, `duplicate feedback_id "${data.feedback_id}"`));
      }
      seenFeedback.add(data.feedback_id);
    }
  }

  const refFresh = checkIndexFreshness(() => buildReferencesIndex(), PATHS.referencesIndex);
  if (!refFresh.matches) {
    issues.push(issue(CODES.STALE_INDEX, 'references/index.json', 'stale relative to references/evaluations/ — run `node scripts/registry.mjs --rebuild`'));
  }
  const fbFresh = checkIndexFreshness(() => buildFeedbackIndex(), PATHS.feedbackIndex);
  if (!fbFresh.matches) {
    issues.push(issue(CODES.STALE_INDEX, 'feedback/index.json', 'stale relative to feedback/records/ — run `node scripts/registry.mjs --rebuild`'));
  }

  return issues;
}

export function rebuildIndexes() {
  return {
    references: canonicalJson(buildReferencesIndex()),
    feedback: canonicalJson(buildFeedbackIndex()),
  };
}
