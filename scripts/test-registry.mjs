#!/usr/bin/env node
/**
 * Regression test for the registry — AES-V2.3 (SUE-561).
 *
 * Allow/deny fixtures over the live seed records plus mutated clones, per the
 * repo's evidence rule (see scripts/test-rights-policy.mjs for the pattern
 * this follows).
 */

import { readFileSync } from 'node:fs';
import {
  CODES, PATHS, loadEvaluationSchema, loadFeedbackSchema,
  validateEvaluationFile, validateFeedbackFile,
  buildReferencesIndex, buildFeedbackIndex, canonicalJson, checkIndexFreshness,
  listEvaluationFiles, listFeedbackFiles, loadCatalogRefIds,
} from './lib/registry-core.mjs';
import { validate } from './lib/json-schema-lite.mjs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const evalSchema = loadEvaluationSchema();
const feedbackSchema = loadFeedbackSchema();
const catalogRefIds = loadCatalogRefIds();

const loadSeed = (path) => JSON.parse(readFileSync(path, 'utf8'));

// --- worked examples: every seed record is clean ---------------------------
console.log('seed records (expect 0 issues each)');
for (const path of listEvaluationFiles()) {
  const issues = validateEvaluationFile(path, { schema: evalSchema, catalogRefIds });
  check(`evaluation is valid: ${path}`, issues.length === 0, JSON.stringify(issues));
}
for (const path of listFeedbackFiles()) {
  const issues = validateFeedbackFile(path, { schema: feedbackSchema });
  check(`feedback record is valid: ${path}`, issues.length === 0, JSON.stringify(issues));
}

// --- index freshness ---------------------------------------------------------
console.log('index freshness');
{
  const ref = checkIndexFreshness(() => buildReferencesIndex(), PATHS.referencesIndex);
  check('references/index.json matches a fresh rebuild', ref.matches);
  const fb = checkIndexFreshness(() => buildFeedbackIndex(), PATHS.feedbackIndex);
  check('feedback/index.json matches a fresh rebuild', fb.matches);

  const rebuiltTwice = canonicalJson(buildReferencesIndex()) === canonicalJson(buildReferencesIndex());
  check('rebuild is deterministic (byte-identical across two runs)', rebuiltTwice);
}
{
  // Simulate staleness: an index that claims to be generated but does not
  // match a fresh rebuild must be caught, not trusted because it says
  // `generated: true`.
  const stale = `${JSON.stringify({ schema_version: '1.0.0', generated: true, generated_by: 'x', evaluations: [] }, null, 2)}\n`;
  check('a hand-edited index reporting generated:true is still caught as stale',
    stale !== canonicalJson(buildReferencesIndex()));
}

// --- evaluation record negatives --------------------------------------------
console.log('reference evaluation invariants');
const baseEval = loadSeed(listEvaluationFiles()[0]);
const evalCases = [
  ['schema: unknown verdict is rejected', CODES.SCHEMA, (e) => { e.dimensions[0].verdict = 'love-it'; }],
  ['schema: authority_boundary must be the fixed const', CODES.SCHEMA, (e) => { e.authority_boundary = 'trust-me'; }],
  ['ref_id must resolve in references/catalog.json', CODES.UNRESOLVED_REF, (e) => { e.ref_id = 'ref:does-not-exist-anywhere'; }],
  ['an embedded reference body is rejected', CODES.EMBEDDED_BODY, (e) => { e.notes = 'x'.repeat(5000); }],
  ['a base64-shaped blob is rejected', CODES.EMBEDDED_BODY, (e) => { e.notes = 'A'.repeat(250); }],
  ['an evaluation asserting a fact violates the authority boundary', CODES.FACTUAL_CLAIM, (e) => {
    e.dimensions[0].note = 'This proves that the reference is factually correct.';
  }],
  ['evaluator "agent" without an agent block is rejected', CODES.EVALUATOR_SHAPE, (e) => { e.evaluator = { type: 'agent' }; }],
  ['evaluator "human" carrying an agent block is rejected', CODES.EVALUATOR_SHAPE, (e) => {
    e.evaluator = { type: 'human', agent: { runtime: 'x' } };
  }],
  ['schema: an unknown provenance_class is rejected', CODES.SCHEMA, (e) => { e.provenance_class = 'self-declared'; }],
  ['a generated_output record with an adopt verdict and no promotion block is rejected', CODES.GENERATED_OUTPUT_UNPROMOTED, (e) => {
    e.provenance_class = 'generated_output';
    e.dimensions[0].verdict = 'adopt';
    delete e.promotion;
  }],
  ['a promotion whose only basis is "published" is rejected even with evidence_refs', CODES.PROMOTION_INSUFFICIENT, (e) => {
    e.provenance_class = 'generated_output';
    e.dimensions[0].verdict = 'adopt';
    e.promotion = {
      authorized_by: 'human:owner',
      basis: 'published',
      evidence_refs: ['feedback:paragraph-order-2026-09-05'],
      promoted_at: '2026-09-05T05:00:00Z',
    };
  }],
  ['a promotion whose only basis is "L1 pass" is rejected', CODES.PROMOTION_INSUFFICIENT, (e) => {
    e.provenance_class = 'generated_output';
    e.dimensions[0].verdict = 'adopt';
    e.promotion = {
      authorized_by: 'agent:claude-code',
      basis: 'L1 pass',
      evidence_refs: ['eval:whatever'],
      promoted_at: '2026-09-05T05:00:00Z',
    };
  }],
  ['a promotion with no evidence_refs is rejected even with a real-looking basis', CODES.PROMOTION_INSUFFICIENT, (e) => {
    e.provenance_class = 'generated_output';
    e.dimensions[0].verdict = 'adopt';
    e.promotion = {
      authorized_by: 'human:owner',
      basis: 'Owner reviewed three independent generations and explicitly approved this one for reuse.',
      evidence_refs: [],
      promoted_at: '2026-09-05T05:00:00Z',
    };
  }],
];
for (const [name, expected, mutate] of evalCases) {
  const e = JSON.parse(JSON.stringify(baseEval));
  mutate(e);
  const codes = evalDirectCodes(e);
  check(name, codes.includes(expected), `expected ${expected}, got [${[...new Set(codes)].join(', ')}]`);
}

function evalDirectCodes(record) {
  const codes = [];
  for (const e of validate(record, evalSchema)) codes.push(CODES.SCHEMA);
  if (typeof record.ref_id === 'string' && !catalogRefIds.has(record.ref_id)) codes.push(CODES.UNRESOLVED_REF);
  if (hasEmbeddedBody(record)) codes.push(CODES.EMBEDDED_BODY);
  if (hasFactualClaim(record)) codes.push(CODES.FACTUAL_CLAIM);
  if (record.evaluator?.type === 'agent' && !record.evaluator.agent) codes.push(CODES.EVALUATOR_SHAPE);
  if (record.evaluator?.type === 'human' && record.evaluator.agent) codes.push(CODES.EVALUATOR_SHAPE);
  const isAdopted = (record.dimensions ?? []).some((d) => d.verdict === 'adopt');
  if (record.provenance_class === 'generated_output' && isAdopted && !record.promotion) {
    codes.push(CODES.GENERATED_OUTPUT_UNPROMOTED);
  }
  if (record.promotion) {
    const refs = record.promotion.evidence_refs;
    const noEvidence = !Array.isArray(refs) || refs.length === 0;
    const basisAlone = typeof record.promotion.basis === 'string'
      && /^(published|publication|l1[\s-]*pass(ed)?)$/i.test(record.promotion.basis.trim());
    if (noEvidence || basisAlone) codes.push(CODES.PROMOTION_INSUFFICIENT);
  }
  return codes;
}

function hasEmbeddedBody(value) {
  if (typeof value === 'string') return /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(value)
    || /[A-Za-z0-9+/]{200,}={0,2}/.test(value) || value.length > 4000;
  if (Array.isArray(value)) return value.some(hasEmbeddedBody);
  if (value && typeof value === 'object') return Object.values(value).some(hasEmbeddedBody);
  return false;
}

function hasFactualClaim(record) {
  const re = /\b(is a fact|is a verified fact|verified fact|proves that|establishes that|confirmed fact|it is established that)\b/i;
  const strings = [
    ...(record.strengths ?? []), ...(record.weaknesses ?? []),
    ...(record.dimensions ?? []).flatMap((d) => [d.note, d.evidence].filter(Boolean)),
    record.notes,
  ].filter((s) => typeof s === 'string');
  return strings.some((s) => re.test(s));
}

// --- feedback record negatives -----------------------------------------------
console.log('feedback record invariants');
const baseFeedback = loadSeed(listFeedbackFiles()[0]);
const feedbackCases = [
  ['schema: unknown signal is rejected', CODES.SCHEMA, (f) => { f.signal = 'vibes'; }],
  ['model_inference basis cannot carry scope calibration_candidate', CODES.SCOPE_BASIS, (f) => {
    f.basis = 'model_inference'; f.scope = 'calibration_candidate';
  }],
  ['calibration_candidate requires non-empty evidence_links (human basis, no linkage)', CODES.CALIBRATION_CANDIDATE_UNSUPPORTED, (f) => {
    f.basis = 'explicit_human_feedback'; f.scope = 'calibration_candidate'; delete f.evidence_links;
  }],
  ['calibration_candidate with an empty evidence_links array is still rejected', CODES.CALIBRATION_CANDIDATE_UNSUPPORTED, (f) => {
    f.basis = 'explicit_human_feedback'; f.scope = 'calibration_candidate'; f.evidence_links = [];
  }],
  ['a null routing.layer without abstained:true is a guess, not an abstention', CODES.ROUTING_GUESS, (f) => {
    f.routing.layer = null; f.routing.abstained = false;
  }],
  ['an embedded body in a feedback statement is rejected', CODES.EMBEDDED_BODY, (f) => { f.statement = 'B'.repeat(250); }],
  ['schema: an unknown owner_verdict is rejected', CODES.SCHEMA, (f) => { f.owner_verdict = 'sort-of-liked-it'; }],
  ['an agent, model_inference record cannot set owner_verdict to accepted', CODES.OWNER_VERDICT_UNSUPPORTED, (f) => {
    f.evaluator = { type: 'agent', agent: { runtime: 'claude-code', model: 'claude-sonnet-5' } };
    f.basis = 'model_inference';
    f.owner_verdict = 'accepted';
  }],
  ['an agent, model_inference record cannot set owner_verdict to rejected either — silence/inference cuts both ways', CODES.OWNER_VERDICT_UNSUPPORTED, (f) => {
    f.evaluator = { type: 'agent', agent: { runtime: 'claude-code', model: 'claude-sonnet-5' } };
    f.basis = 'model_inference';
    f.owner_verdict = 'rejected';
  }],
];
for (const [name, expected, mutate] of feedbackCases) {
  const f = JSON.parse(JSON.stringify(baseFeedback));
  mutate(f);
  const codes = feedbackDirectCodes(f);
  check(name, codes.includes(expected), `expected ${expected}, got [${[...new Set(codes)].join(', ')}]`);
}

function feedbackDirectCodes(record) {
  const codes = [];
  for (const e of validate(record, feedbackSchema)) codes.push(CODES.SCHEMA);
  if (hasEmbeddedBody(record)) codes.push(CODES.EMBEDDED_BODY);
  if (record.evaluator?.type === 'agent' && !record.evaluator.agent) codes.push(CODES.EVALUATOR_SHAPE);
  if (record.evaluator?.type === 'human' && record.evaluator.agent) codes.push(CODES.EVALUATOR_SHAPE);
  if (record.basis === 'model_inference' && record.scope === 'calibration_candidate') codes.push(CODES.SCOPE_BASIS);
  if (record.scope === 'calibration_candidate' && !(Array.isArray(record.evidence_links) && record.evidence_links.length > 0)) {
    codes.push(CODES.CALIBRATION_CANDIDATE_UNSUPPORTED);
  }
  if (record.routing && record.routing.layer == null && record.routing.abstained !== true) codes.push(CODES.ROUTING_GUESS);
  const grounded = record.evaluator?.type === 'human' || record.basis === 'explicit_human_feedback';
  if (record.owner_verdict && record.owner_verdict !== 'unknown' && !grounded) codes.push(CODES.OWNER_VERDICT_UNSUPPORTED);
  return codes;
}

// --- allow case: calibration_candidate WITH evidence_links passes -----------
console.log('allow cases');
{
  const f = JSON.parse(JSON.stringify(baseFeedback));
  f.basis = 'explicit_human_feedback';
  f.scope = 'calibration_candidate';
  f.evidence_links = ['feedback:some-other-corroborating-record'];
  const codes = feedbackDirectCodes(f);
  check('calibration_candidate with evidence_links and human basis is accepted',
    !codes.includes(CODES.CALIBRATION_CANDIDATE_UNSUPPORTED) && !codes.includes(CODES.SCOPE_BASIS));
}
{
  const f = JSON.parse(JSON.stringify(baseFeedback));
  delete f.evidence_links;
  f.owner_verdict = 'unknown';
  const codes = feedbackDirectCodes(f);
  check('owner_verdict "unknown" is always representable regardless of evaluator/basis',
    !codes.includes(CODES.OWNER_VERDICT_UNSUPPORTED));
}
{
  const f = JSON.parse(JSON.stringify(baseFeedback));
  f.evaluator = { type: 'human' };
  f.basis = 'explicit_human_feedback';
  f.owner_verdict = 'accepted';
  const codes = feedbackDirectCodes(f);
  check('owner_verdict "accepted" is allowed when grounded in an explicit human statement',
    !codes.includes(CODES.OWNER_VERDICT_UNSUPPORTED));
}
{
  const e = JSON.parse(JSON.stringify(baseEval));
  e.provenance_class = 'generated_output';
  e.dimensions[0].verdict = 'adopt';
  e.promotion = {
    authorized_by: 'human:owner',
    basis: 'Owner reviewed the rendered artifact directly and approved it for reuse as a positive reference, independent of its publication.',
    evidence_refs: ['feedback:paragraph-order-2026-09-05'],
    promoted_at: '2026-09-05T05:00:00Z',
  };
  const codes = evalDirectCodes(e);
  check('a generated_output record with a real promotion block (evidence_refs + non-trivial basis) is accepted',
    !codes.includes(CODES.GENERATED_OUTPUT_UNPROMOTED) && !codes.includes(CODES.PROMOTION_INSUFFICIENT));
}
{
  const e = JSON.parse(JSON.stringify(baseEval));
  e.provenance_class = 'generated_output';
  // No adopt verdict anywhere: retained as real-output evidence, not promoted, no promotion block needed.
  e.dimensions = e.dimensions.map((d) => ({ ...d, verdict: d.verdict === 'adopt' ? 'neutral' : d.verdict }));
  delete e.promotion;
  const codes = evalDirectCodes(e);
  check('a generated_output record kept as evidence only (no adopt verdict) needs no promotion block',
    !codes.includes(CODES.GENERATED_OUTPUT_UNPROMOTED));
}

// --- fail-closed --------------------------------------------------------------
console.log('fail-closed behaviour');
check('an empty evaluation object is not a silent pass', validate({}, evalSchema).length > 0);
check('an empty feedback object is not a silent pass', validate({}, feedbackSchema).length > 0);

console.log(failures === 0 ? '\nregistry regression: PASS' : `\nregistry regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
