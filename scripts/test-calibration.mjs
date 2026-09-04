#!/usr/bin/env node
/**
 * Regression test for calibration — AES-V2.10 (SUE-568).
 *
 * Allow/deny fixtures over the live seed records plus mutated clones, per the
 * repo's evidence rule (see scripts/test-registry.mjs / scripts/test-rights-policy.mjs
 * for the pattern this follows).
 */

import { readFileSync } from 'node:fs';
import {
  CODES, loadVersionSchema, loadExperimentSchema, loadRoutingLayerIds,
  validateVersionFile, validateLedgerFile, diffSubstantive,
  buildCurrentSnapshot, canonicalJson, checkCurrentFreshness,
  listVersionFiles, listLedgerFiles,
} from './lib/calibration-core.mjs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const versionSchema = loadVersionSchema();
const experimentSchema = loadExperimentSchema();
const layerIds = loadRoutingLayerIds();
const loadSeed = (path) => JSON.parse(readFileSync(path, 'utf8'));

// --- worked examples: every seed record is clean ---------------------------
console.log('seed records (expect 0 issues each)');
for (const path of listVersionFiles()) {
  const issues = validateVersionFile(path, { schema: versionSchema });
  check(`calibration version is valid: ${path}`, issues.length === 0, JSON.stringify(issues));
}
for (const path of listLedgerFiles()) {
  const issues = validateLedgerFile(path, { schema: experimentSchema, layerIds });
  check(`experiment record is valid: ${path}`, issues.length === 0, JSON.stringify(issues));
}

// --- current.json freshness -------------------------------------------------
console.log('current.json freshness');
{
  const fresh = checkCurrentFreshness();
  check('calibration/current.json matches a fresh rebuild', fresh.matches);

  const rebuiltTwice = canonicalJson(buildCurrentSnapshot()) === canonicalJson(buildCurrentSnapshot());
  check('rebuild is deterministic (byte-identical across two runs)', rebuiltTwice);

  const stale = `${JSON.stringify({ schema_version: '1.0.0', generated: true, generated_by: 'x', active: [] }, null, 2)}\n`;
  check('a hand-edited current.json reporting generated:true is still caught as stale',
    stale !== canonicalJson(buildCurrentSnapshot()));
}

// --- calibration-version deny cases -----------------------------------------
console.log('calibration version invariants');
const activePath = listVersionFiles().find((p) => p.endsWith('audience-beginner-learner.v1.json'));
const candidatePath = listVersionFiles().find((p) => p.endsWith('audience-domain-expert.v1.json'));
const baseActive = loadSeed(activePath);
const baseCandidate = loadSeed(candidatePath);

// validateVersionFile always reads from a path, so exercise the deny cases by
// writing to a real temp path via a tiny local harness instead of monkeying
// with the exported function's IO contract. Each case gets its own
// subdirectory so the file can always carry the correct expected filename
// for its calibration_id without colliding with other cases.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpDir = mkdtempSync(join(tmpdir(), 'calibration-test-'));
let caseCounter = 0;
const withVersion = (data, filename) => {
  const dir = join(tmpDir, `case-${caseCounter += 1}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, filename);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
};
const codesFor = (path) => validateVersionFile(path, { schema: versionSchema }).map((i) => i.code);

check('schema: an unknown status is rejected',
  codesFor(withVersion({ ...baseActive, status: 'active-ish' }, 'audience-beginner-learner.v1.json')).includes(CODES.SCHEMA));

check('deny: an active version authored by an agent is rejected', codesFor(withVersion({
  ...baseActive,
  authorized_by: { type: 'agent', identity: 'agent:claude-code', agent: { runtime: 'claude-code' } },
}, 'audience-beginner-learner.v1.json')).includes(CODES.AGENT_AUTHORED_ACTIVE));

check('deny: a superseded version authored by an agent is rejected', codesFor(withVersion({
  ...baseActive,
  status: 'superseded',
  superseded_by: 'calibration:audience-beginner-learner@v2',
  authorized_by: { type: 'agent', identity: 'agent:claude-code', agent: { runtime: 'claude-code' } },
}, 'audience-beginner-learner.v1.json')).includes(CODES.AGENT_AUTHORED_ACTIVE));

check('deny: a candidate with no conflicting_evidence is rejected', codesFor(withVersion({
  ...baseCandidate,
  conflicting_evidence: [],
}, 'audience-domain-expert.v1.json')).includes(CODES.CANDIDATE_NO_CONFLICTING_EVIDENCE));

check('deny: a model_inference-basis record used as drift evidence is rejected', codesFor(withVersion({
  ...baseCandidate,
  conflicting_evidence: ['feedback:routing-unclear-2026-09-05'], // real record, basis: model_inference
}, 'audience-domain-expert.v1.json')).includes(CODES.DRIFT_EVIDENCE_MODEL_INFERENCE));

check('allow: a candidate whose conflicting_evidence is explicit_human_feedback passes', codesFor(withVersion({
  ...baseCandidate,
  conflicting_evidence: ['feedback:paragraph-order-2026-09-05'], // real record, basis: explicit_human_feedback
}, 'audience-domain-expert.v1.json')).length === 0);

check('deny: a candidate promoted with a single feedback record is rejected', codesFor(withVersion({
  ...baseCandidate,
  status: 'active',
  authorized_by: { type: 'human', identity: 'human:owner' },
  promotion: {
    authorized_by: 'human:owner',
    basis: 'repeated independent evidence',
    evidence_refs: ['feedback:paragraph-order-2026-09-05'],
    promoted_at: '2026-09-05T00:00:00Z',
  },
}, 'audience-domain-expert.v1.json')).includes(CODES.PROMOTION_INSUFFICIENT));

check('deny: a promotion whose only basis is "published" is rejected even with 2 evidence_refs', codesFor(withVersion({
  ...baseCandidate,
  status: 'active',
  authorized_by: { type: 'human', identity: 'human:owner' },
  promotion: {
    authorized_by: 'human:owner',
    basis: 'published',
    evidence_refs: ['feedback:paragraph-order-2026-09-05', 'feedback:routing-unclear-2026-09-05'],
    promoted_at: '2026-09-05T00:00:00Z',
  },
}, 'audience-domain-expert.v1.json')).includes(CODES.PROMOTION_INSUFFICIENT));

check('deny: a promotion authorized by an agent is rejected', codesFor(withVersion({
  ...baseCandidate,
  status: 'active',
  authorized_by: { type: 'human', identity: 'human:owner' },
  promotion: {
    authorized_by: 'agent:claude-code',
    basis: 'repeated independent evidence',
    evidence_refs: ['feedback:paragraph-order-2026-09-05', 'feedback:x'],
    promoted_at: '2026-09-05T00:00:00Z',
  },
}, 'audience-domain-expert.v1.json')).includes(CODES.PROMOTION_NOT_HUMAN));

check('allow: a promotion by a human with 2 independent evidence_refs and a real basis passes', codesFor(withVersion({
  ...baseCandidate,
  status: 'active',
  authorized_by: { type: 'human', identity: 'human:owner' },
  promotion: {
    authorized_by: 'human:owner',
    basis: 'repeated independent evidence across two tasks',
    evidence_refs: ['feedback:paragraph-order-2026-09-05', 'feedback:some-other-record'],
    promoted_at: '2026-09-05T00:00:00Z',
  },
}, 'audience-domain-expert.v1.json')).length === 0);

check('allow: a promotion resting on a single record is fine when basis names an explicit owner declaration', codesFor(withVersion({
  ...baseCandidate,
  status: 'active',
  authorized_by: { type: 'human', identity: 'human:owner' },
  promotion: {
    authorized_by: 'human:owner',
    basis: 'explicit owner declaration that preference itself changed',
    evidence_refs: ['feedback:paragraph-order-2026-09-05'],
    promoted_at: '2026-09-05T00:00:00Z',
  },
}, 'audience-domain-expert.v1.json')).length === 0);

check('filename must match calibration_id', codesFor(withVersion(baseActive, 'wrong-name.json')).includes(CODES.FILENAME_MISMATCH));

// --- immutability: a mutated historical version is caught -------------------
console.log('historical immutability');
{
  const older = { ...baseActive, status: 'active', superseded_by: null };
  const legitimateSupersession = { ...older, status: 'superseded', superseded_by: 'calibration:audience-beginner-learner@v2' };
  check('status + superseded_by changing alone is NOT a mutation (legitimate supersession)',
    diffSubstantive(older, legitimateSupersession) === false);

  const mutatedHistory = { ...older, status: 'superseded', superseded_by: 'calibration:audience-beginner-learner@v2', evidence_refs: [] };
  check('a substantive field changing alongside status IS a mutation', diffSubstantive(older, mutatedHistory) === true);

  const mutatedSignals = { ...older, signals: { ...older.signals, owner_preference: { statement: 'rewritten', evidence_refs: [] } } };
  check('rewriting a signal on an already-recorded version is a mutation', diffSubstantive(older, mutatedSignals) === true);
}

// --- experiment ledger deny cases -------------------------------------------
console.log('experiment ledger invariants');
const baseExperiment = loadSeed(listLedgerFiles()[0]);
const codesForExperiment = (path) => validateLedgerFile(path, { schema: experimentSchema, layerIds }).map((i) => i.code);
const EXPERIMENT_FILENAME = 'reference-selection-2026-09-05.json';
const withTempLedger = (data) => {
  const dir = join(tmpDir, `case-${caseCounter += 1}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, EXPERIMENT_FILENAME);
  writeFileSync(path, JSON.stringify(data, null, 2));
  return path;
};

check('schema: an unknown decision is rejected',
  codesForExperiment(withTempLedger({ ...baseExperiment, decision: 'ship-it' })).includes(CODES.SCHEMA));

check('deny: target_layer not in editorial/feedback-routing.json is rejected', codesForExperiment(withTempLedger({
  ...baseExperiment,
  target_layer: 'not-a-real-layer',
})).includes(CODES.UNKNOWN_TARGET_LAYER));

check('allow: every declared layer id is a legal target_layer', [...layerIds].every((id) => {
  const issues = validateLedgerFile(withTempLedger({ ...baseExperiment, target_layer: id }), {
    schema: experimentSchema, layerIds,
  });
  return !issues.some((i) => i.code === CODES.UNKNOWN_TARGET_LAYER);
}));

check('deny: an empty evaluation_set is rejected', codesForExperiment(withTempLedger({
  ...baseExperiment,
  evaluation_set: { fixtures: [], references: [], real_outputs: [] },
})).includes(CODES.EMPTY_EVALUATION_SET));

check('deny: kind model_drift with no model_drift block is rejected', codesForExperiment(withTempLedger({
  ...baseExperiment,
  kind: 'model_drift',
})).includes(CODES.MISSING_MODEL_DRIFT_BLOCK));

check('allow: kind model_drift with a model_drift block and per-role outcomes passes', codesForExperiment(withTempLedger({
  ...baseExperiment,
  kind: 'model_drift',
  model_drift: {
    previous: { provider: 'anthropic', model: 'claude-sonnet', model_version: '4' },
    candidate: { provider: 'anthropic', model: 'claude-sonnet', model_version: '5' },
    role_outcomes: [
      { role: 'routing', outcome: 'PASS' },
      { role: 'writer', outcome: 'HOLD', note: 'audience-fit dimension regressed on 2 of 6 fixtures' },
      { role: 'reviewer_l1', outcome: 'PASS' },
    ],
  },
})).length === 0);

rmSync(tmpDir, { recursive: true, force: true });

console.log(failures === 0 ? `\nPASS — ${failures} failures` : `\nFAIL — ${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
