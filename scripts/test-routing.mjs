#!/usr/bin/env node
/**
 * Regression test for failure routing — AES-V2.5 (SUE-563).
 *
 * The property under test: every negative-verdict feedback record either
 * names a layer or explicitly abstains, the three named misroutes are caught
 * mechanically, and no record can propose a mutation above the class its
 * scope can carry — one complaint can never become a Constitution or
 * brand-profile change.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANONICAL_LAYERS, CODES, loadFeedbackSchema, loadRoutingTable,
  validateFeedbackRecordAgainstSchema, validateFeedbackRecordRouting, validateRoutingTable,
} from './lib/routing-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const table = loadRoutingTable();
const schema = loadFeedbackSchema();
const { records } = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/feedback-record-routing.example.json'), 'utf8'));
const byId = Object.fromEntries(records.map((r) => [r.feedback_id, r]));

const feedbackRecordsDir = resolve(ROOT, 'feedback/records');
const persistedRecords = readdirSync(feedbackRecordsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(resolve(feedbackRecordsDir, f), 'utf8')));
const clone = (r) => JSON.parse(JSON.stringify(r));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const codesFor = (r) => [
  ...validateFeedbackRecordAgainstSchema(r, schema),
  ...validateFeedbackRecordRouting(r, table),
].map((i) => i.code);

// --- the routing table itself ----------------------------------------------
console.log('routing table consistency');
{
  check('the shipped table is internally consistent', validateRoutingTable(table).length === 0,
    JSON.stringify(validateRoutingTable(table)));

  for (const [group, ids] of Object.entries(CANONICAL_LAYERS)) {
    check(`layer ids for "${group}" match V2-EDITORIAL-LEARNING-CORE.md §5 exactly`,
      JSON.stringify(table.layers[group].map((l) => l.id)) === JSON.stringify(ids));
  }

  check('every layer resolves its escalates_to',
    Object.values(table.layers).flat().every((l) => {
      const known = new Set(Object.values(table.layers).flat().map((x) => x.id));
      return l.escalates_to === null || known.has(l.escalates_to) || ['human_activation', 'human_review'].includes(l.escalates_to);
    }));

  check('the authority matrix declares all seven classes',
    table.authority_matrix.classes.length === 7
    && [0, 1, 2, 3, 4, 5, 6].every((c) => table.authority_matrix.classes.some((x) => x.class === c)));

  // deny: break an escalation target and confirm the validator catches it
  const broken = clone(table);
  broken.layers.shared[0].escalates_to = 'not-a-real-layer';
  check('a broken escalation target is caught',
    validateRoutingTable(broken).some((i) => i.code === CODES.UNKNOWN_ESCALATION));

  const missingClass = clone(table);
  missingClass.authority_matrix.classes = missingClass.authority_matrix.classes.filter((c) => c.class !== 6);
  check('a missing authority class is caught',
    validateRoutingTable(missingClass).some((i) => i.code === CODES.MATRIX_INCOMPLETE));
}

// --- worked examples all pass -----------------------------------------------
console.log('\nworked examples (expect 0 issues each)');
for (const r of records) {
  check(r.feedback_id, codesFor(r).length === 0, JSON.stringify(codesFor(r)));
}

// --- deny: abstention discipline --------------------------------------------
console.log('\nabstention is a valid outcome; silence is not');
{
  const negativeNoLayerNoAbstain = clone(byId['feedback:example-abstain-unclear']);
  negativeNoLayerNoAbstain.routing.abstained = false;
  check('a negative verdict naming no layer, no modality_layer, and not abstaining is rejected',
    codesFor(negativeNoLayerNoAbstain).includes(CODES.ABSTENTION_REQUIRED));

  const abstainButNamed = clone(byId['feedback:example-frame-worth']);
  abstainButNamed.routing.abstained = true;
  check('abstaining while still naming a layer is a contradiction',
    codesFor(abstainButNamed).includes(CODES.ABSTAIN_CONTRADICTION));

  const abstainButNamedModalityOnly = clone(byId['feedback:example-renderer-glitch']);
  abstainButNamedModalityOnly.routing.abstained = true;
  check('abstaining while still naming a modality_layer is also a contradiction',
    codesFor(abstainButNamedModalityOnly).includes(CODES.ABSTAIN_CONTRADICTION));

  check('the genuine abstention example is clean',
    codesFor(byId['feedback:example-abstain-unclear']).length === 0);
}

// --- allow: layer: null is modality-only routing, not abstention -----------
console.log('\nthree states, never collapsed: shared layer / modality-only / abstain');
{
  const rendererOnly = byId['feedback:example-renderer-glitch'];
  check('a renderer-only defect legitimately carries layer: null',
    rendererOnly.routing.layer === null && rendererOnly.routing.modality_layer === 'renderer');
  check('layer: null with abstained: false and a modality_layer is NOT abstention',
    rendererOnly.routing.abstained === false);
  check('modality-only routing produces 0 issues — it is a legal, decided state',
    codesFor(rendererOnly).length === 0, JSON.stringify(codesFor(rendererOnly)));

  const unknownModalityLayer = clone(rendererOnly);
  unknownModalityLayer.routing.modality_layer = 'not-a-real-modality-layer';
  check('a modality_layer that is not a declared layer id is caught',
    codesFor(unknownModalityLayer).includes(CODES.UNKNOWN_MODALITY_LAYER));
}

// --- deny: the three named misroutes ----------------------------------------
console.log('\nthe three misroutes docs/architecture/V2-EDITORIAL-LEARNING-CORE.md §5 names');
{
  const frameToPolish = clone(byId['feedback:example-frame-worth']);
  frameToPolish.routing.layer = null;
  frameToPolish.routing.modality_layer = 'polish';
  check('a frame failure routed to polish is caught',
    codesFor(frameToPolish).includes(CODES.MISROUTE));

  const rendererToBrand = clone(byId['feedback:example-renderer-glitch']);
  rendererToBrand.routing.modality_layer = 'brand_profile';
  rendererToBrand.statement = 'This one render has garbled text; let\'s make the brand profile match what we see here.';
  check('a renderer defect promoted to a brand-profile change is caught',
    codesFor(rendererToBrand).includes(CODES.MISROUTE));

  const referenceToWriting = clone(byId['feedback:example-reference-repeated']);
  referenceToWriting.routing.layer = null;
  referenceToWriting.routing.modality_layer = 'writing';
  referenceToWriting.routing.abstained = false;
  check('a reference-selection failure promoted to a content rule is caught',
    codesFor(referenceToWriting).includes(CODES.MISROUTE));

  // Regression guard for the exact error corrected: a genuinely polish-shaped
  // defect (protected span, translationese, over-applied signature move) is
  // NOT itself evidence that the thesis or argument path is wrong. Labelling
  // it with the shared layer "frame" re-creates misroute 1 from the other
  // direction, and must be caught just as the forward direction is.
  const polishMislabeledFrame = clone(byId['feedback:example-frame-worth']);
  polishMislabeledFrame.statement = 'A protected span changed across the polish pass — the cited figure was altered — and a repeated signature construction survived polish unnoticed.';
  polishMislabeledFrame.routing.layer = 'frame';
  polishMislabeledFrame.routing.rationale = 'Polish pass regression.';
  check('a polish defect routed as layer: frame is caught (regression guard)',
    codesFor(polishMislabeledFrame).includes(CODES.MISROUTE));
}

// --- the authority ceiling lives at the mutation, not the complaint --------
// AES-V2 B3: the English keyword-regex "escalation ceiling" that used to
// live in routing-core.mjs is deleted. It filtered vocabulary, not
// authority: it missed the Korean equivalent of the exact phrasing it
// caught in English, and it flagged a committed exemplary abstention for
// merely naming a layer it could not distinguish between. The real ceiling
// is structural (a feedback record's `scope` enum tops out at
// calibration_candidate) and enforced at the actual mutation point
// (scripts/lib/calibration-core.mjs / scripts/lib/registry-core.mjs
// promotion gates), not by pattern-matching a record's free text.
console.log('\nthe authority ceiling is structural, not a text filter (AES-V2 B3)');
{
  check('CODES no longer exposes an escalation-above-ceiling code',
    !('ESCALATION_ABOVE_CEILING' in CODES));

  // False negative the reviewer found: the system's own class-discriminating
  // words ("이번 글만" vs "앞으로") are not English-keyword-detectable, and a
  // record proposing a durable house-style change in Korean must produce
  // exactly the same routing issues as its English equivalent — none, from
  // this module. (The record cannot itself perform the mutation regardless;
  // that boundary is schema-structural and enforced downstream.)
  const koreanHouseStyleRequest = clone(byId['feedback:example-renderer-glitch']);
  koreanHouseStyleRequest.statement = '앞으로 모든 썸네일에서 이 색과 스타일을 이렇게 바꿔주세요. 하우스 스타일 자체를 이걸로 해주세요.';
  koreanHouseStyleRequest.routing = { layer: null, modality_layer: 'renderer', abstained: false, confidence: 'high', rationale: 'renderer defect, this run only' };
  const englishHouseStyleRequest = clone(koreanHouseStyleRequest);
  englishHouseStyleRequest.statement = 'From now on, change this color and style for every thumbnail. Make the house style itself this.';
  check('a Korean durable house-style request produces the same routing-core findings as no request at all',
    JSON.stringify(codesFor(koreanHouseStyleRequest)) === JSON.stringify(codesFor(rendererOnlyBaseline())));
  check('its English equivalent produces the identical result — no language-specific asymmetry',
    JSON.stringify(codesFor(koreanHouseStyleRequest)) === JSON.stringify(codesFor(englishHouseStyleRequest)));

  function rendererOnlyBaseline() {
    const b = clone(byId['feedback:example-renderer-glitch']);
    b.routing = { layer: null, modality_layer: 'renderer', abstained: false, confidence: 'high', rationale: 'renderer defect, this run only' };
    return b;
  }

  // False positive the reviewer found, now fixed: the committed exemplary
  // abstention record names "brand-profile" only to say it cannot
  // distinguish it from a renderer defect — that must never be flagged as
  // an escalation attempt.
  const abstainNamingBrandProfile = persistedRecords.find((r) => r.feedback_id === 'feedback:routing-unclear-2026-09-05');
  check('an abstention naming "brand-profile" as one of two things it cannot distinguish is not flagged',
    codesFor(abstainNamingBrandProfile).length === 0, JSON.stringify(codesFor(abstainNamingBrandProfile)));
}

// --- the committed feedback/records/ corpus is actually checked ------------
console.log('\nfeedback/records/ is validated, not only the worked examples (AES-V2 B3)');
{
  check(`at least one persisted record exists to check (${persistedRecords.length} found)`,
    persistedRecords.length > 0);
  for (const r of persistedRecords) {
    check(`persisted record routes cleanly: ${r.feedback_id}`, codesFor(r).length === 0, JSON.stringify(codesFor(r)));
  }
  const routingUnclear = persistedRecords.find((r) => r.feedback_id === 'feedback:routing-unclear-2026-09-05');
  check('feedback:routing-unclear-2026-09-05 (the committed exemplary abstention) is found on disk',
    Boolean(routingUnclear));
  check('feedback:routing-unclear-2026-09-05 passes routing with 0 issues',
    routingUnclear && codesFor(routingUnclear).length === 0, JSON.stringify(routingUnclear && codesFor(routingUnclear)));
}

console.log(failures === 0 ? '\nrouting tests: PASS' : `\nrouting tests: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
