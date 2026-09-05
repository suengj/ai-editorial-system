#!/usr/bin/env node
/**
 * Regression test for the comparative L1 reviewer and the real-output corpus
 * — AES-V2.6 (SUE-564).
 *
 * The property under test: no L1 record can lack evidence, no style win can
 * override an integrity failure, and no corpus entry can carry a canonical
 * article or artifact body.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES as L1, LANGUAGE_DIMENSIONS, OUTCOME_ROUTES, REQUIRED_DIMENSIONS, loadSchema as loadL1Schema, validateL1Record,
} from './lib/l1-core.mjs';
import {
  CODES as CORPUS, loadSchema as loadCorpusSchema, validateEntry,
} from './lib/corpus-core.mjs';
import { loadRoutingTable } from './lib/routing-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const l1Schema = loadL1Schema();
const corpusSchema = loadCorpusSchema();
const routingTable = loadRoutingTable();

const { records } = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/l1-review.example.json'), 'utf8'));
const byId = Object.fromEntries(records.map((r) => [r.review_id, r]));
const clone = (r) => JSON.parse(JSON.stringify(r));

const { records: lqRecords } = JSON.parse(
  readFileSync(resolve(ROOT, 'schemas/examples/l1-review-language-quality.example.json'), 'utf8'),
);
const lqById = Object.fromEntries(lqRecords.map((r) => [r.review_id, r]));

const corpusEntries = JSON.parse(readFileSync(resolve(ROOT, 'evals/real-output-corpus/entries/corpus-placeholder-research-accepted.json'), 'utf8'));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const l1Codes = (r) => validateL1Record(r, { schema: l1Schema, routingTable }).map((i) => i.code);
const corpusCodes = (e) => validateEntry(e, corpusSchema).map((i) => i.code);

// --- worked examples ---------------------------------------------------------
console.log('worked L1 examples (expect 0 issues)');
for (const r of records) {
  check(r.review_id, l1Codes(r).length === 0, JSON.stringify(l1Codes(r)));
}

console.log('\nworked 1.1.0 language_quality example (expect 0 issues)');
for (const r of lqRecords) {
  check(r.review_id, l1Codes(r).length === 0, JSON.stringify(l1Codes(r)));
}

console.log('\nworked corpus entry (expect 0 issues)');
check('corpus:placeholder-research-accepted', corpusCodes(corpusEntries).length === 0, JSON.stringify(corpusCodes(corpusEntries)));

// --- deny: a review with no evidence span -----------------------------------
console.log('\nevidence spans are mandatory');
{
  const noEvidence = clone(byId['l1:example-pass']);
  noEvidence.dimensions[0].evidence_span = '';
  check('a dimension finding with an empty evidence span is rejected',
    l1Codes(noEvidence).includes(L1.MISSING_EVIDENCE));

  const missingField = clone(byId['l1:example-pass']);
  delete missingField.dimensions[1].evidence_span;
  check('a dimension finding missing evidence_span entirely is rejected (schema)',
    l1Codes(missingField).includes(L1.SCHEMA));

  const integrityNoEvidence = clone(byId['l1:example-pass']);
  integrityNoEvidence.integrity = { status: 'concern' };
  check('an integrity concern with no evidence span is rejected',
    l1Codes(integrityNoEvidence).includes(L1.MISSING_EVIDENCE));
}

// --- deny: a style win overriding an integrity failure -----------------------
console.log('\nintegrity failures dominate stylistic wins');
{
  const styleWinsOverIntegrity = clone(byId['l1:example-pass']);
  styleWinsOverIntegrity.integrity = { status: 'fail', evidence_span: 'The cited revenue figure is from a different fiscal year than the one claimed.' };
  styleWinsOverIntegrity.outcome = 'PASS';
  styleWinsOverIntegrity.routes_to = null;
  check('outcome PASS with integrity.status fail is rejected',
    l1Codes(styleWinsOverIntegrity).includes(L1.INTEGRITY_OVERRIDDEN));

  const wrongRouteOnFailure = clone(byId['l1:example-pass']);
  wrongRouteOnFailure.integrity = { status: 'fail', evidence_span: 'Same phantom citation.' };
  wrongRouteOnFailure.outcome = 'PROSE_REWORK';
  wrongRouteOnFailure.routes_to = 'writing';
  check('an integrity failure must route to FACT_REWORK/verification, not a style outcome',
    l1Codes(wrongRouteOnFailure).includes(L1.INTEGRITY_OVERRIDDEN));

  const correctlyRouted = clone(byId['l1:example-pass']);
  correctlyRouted.integrity = { status: 'fail', evidence_span: 'Same phantom citation.' };
  correctlyRouted.outcome = 'FACT_REWORK';
  correctlyRouted.routes_to = 'verification';
  check('an integrity failure correctly routed to FACT_REWORK/verification is accepted',
    !l1Codes(correctlyRouted).includes(L1.INTEGRITY_OVERRIDDEN));
}

// --- tie and abstain are first-class -----------------------------------------
console.log('\ntie and abstain are first-class outcomes');
{
  check('the abstain example is clean', l1Codes(byId['l1:example-abstain']).length === 0);
  check('a tie verdict still requires evidence',
    byId['l1:example-pass'].dimensions.some((d) => d.verdict === 'tie' && d.evidence_span.length > 0));
}

// --- required dimensions ------------------------------------------------------
console.log('\nall five required dimensions must be present');
{
  const missingDim = clone(byId['l1:example-pass']);
  missingDim.dimensions = missingDim.dimensions.filter((d) => d.id !== 'audience-fit');
  check('a record missing a required dimension is rejected',
    l1Codes(missingDim).includes(L1.MISSING_DIMENSION));

  check('all five required dimensions are named', REQUIRED_DIMENSIONS.length === 5);
}

// --- compare like with like ---------------------------------------------------
console.log('\ncompare like with like');
{
  const undeclaredCrossType = clone(byId['l1:example-pass']);
  undeclaredCrossType.comparison.same_content_type = false;
  check('cross-type comparison with no declared cross_cutting_dimension is rejected',
    l1Codes(undeclaredCrossType).includes(L1.CROSS_TYPE_VIOLATION));

  const crossTypeDecidingWrongDimension = clone(byId['l1:example-pass']);
  crossTypeDecidingWrongDimension.comparison.same_content_type = false;
  crossTypeDecidingWrongDimension.comparison.cross_cutting_dimension = 'language-native-prose';
  check('a decided (non-tie/abstain) verdict on a non-cross-cutting dimension in a cross-type comparison is rejected',
    l1Codes(crossTypeDecidingWrongDimension).includes(L1.CROSS_TYPE_VIOLATION));
}

// --- anti-collapse -------------------------------------------------------------
// AES-V2 B5: the guard used to fire only when every reference was
// generated_output AND all carried an identical, *present* lineage_ref —
// which the schema does not require. The reviewer verified three bypasses:
// (1) no lineage_ref on any ref, (2) different lineage_ref values, and
// (3, the one case actually caught before) identical lineage_ref. All three
// must now trigger, because the trigger is "every selected reference is
// generated_output," full stop — identical lineage is a stronger signal
// surfaced separately, never the condition for firing at all.
console.log('\nanti-collapse: a generated_output monoculture must be declared, with or without lineage_ref');
{
  const collapsedSameLineage = clone(byId['l1:example-pass']);
  collapsedSameLineage.comparison.references = [
    { ref: 'corpus:placeholder-generated-output-lineage', provenance_class: 'generated_output', lineage_ref: 'lineage:x' },
    { ref: 'corpus:placeholder-generated-output-lineage-2', provenance_class: 'generated_output', lineage_ref: 'lineage:x' },
  ];
  check('(1) identical lineage_ref on every generated_output ref is rejected when undeclared',
    l1Codes(collapsedSameLineage).includes(L1.ANTI_COLLAPSE_UNDECLARED));

  collapsedSameLineage.comparison.anti_collapse = { triggered: true, note: 'Both references share lineage:x; no independent GOOD reference was available for this content type yet.' };
  check('declaring the anti-collapse condition clears the finding',
    !l1Codes(collapsedSameLineage).includes(L1.ANTI_COLLAPSE_UNDECLARED));

  const collapsedNoLineage = clone(byId['l1:example-pass']);
  collapsedNoLineage.comparison.references = [
    { ref: 'corpus:placeholder-generated-output-lineage', provenance_class: 'generated_output' },
    { ref: 'corpus:placeholder-generated-output-lineage-2', provenance_class: 'generated_output' },
  ];
  check('(2) two generated_output refs with NO lineage_ref at all still trigger anti-collapse (previously bypassed it silently)',
    l1Codes(collapsedNoLineage).includes(L1.ANTI_COLLAPSE_UNDECLARED));
  check('a generated_output reference with no lineage_ref is separately flagged',
    l1Codes(collapsedNoLineage).includes(L1.MISSING_LINEAGE_REF));

  const collapsedDifferentLineage = clone(byId['l1:example-pass']);
  collapsedDifferentLineage.comparison.references = [
    { ref: 'corpus:placeholder-generated-output-lineage', provenance_class: 'generated_output', lineage_ref: 'lineage:x' },
    { ref: 'corpus:placeholder-generated-output-lineage-2', provenance_class: 'generated_output', lineage_ref: 'lineage:y' },
  ];
  check('(3) two generated_output refs with DIFFERENT lineages still trigger anti-collapse (previously bypassed it silently)',
    l1Codes(collapsedDifferentLineage).includes(L1.ANTI_COLLAPSE_UNDECLARED));
  check('different-lineage generated_output refs are not individually flagged for missing lineage_ref',
    !l1Codes(collapsedDifferentLineage).includes(L1.MISSING_LINEAGE_REF));

  const mixedProvenance = clone(byId['l1:example-pass']);
  mixedProvenance.comparison.references = [
    { ref: 'corpus:placeholder-generated-output-lineage', provenance_class: 'generated_output', lineage_ref: 'lineage:x' },
    { ref: 'corpus:placeholder-research-accepted', provenance_class: 'owner_created' },
  ];
  check('a mixed provenance set (not every ref generated_output) does not trigger anti-collapse',
    !l1Codes(mixedProvenance).includes(L1.ANTI_COLLAPSE_UNDECLARED));
}

// --- routing must resolve against AES-V2.5 -------------------------------------
console.log('\nrouting outputs use the Part A layer ids');
{
  check('OUTCOME_ROUTES only names layers that exist in editorial/feedback-routing.json',
    Object.values(OUTCOME_ROUTES).flat().every((r) => r === null || routingTable
      && Object.values(routingTable.layers).flat().some((l) => l.id === r)));

  const badRoute = clone(byId['l1:example-pass']);
  badRoute.routes_to = 'not-a-real-layer';
  check('a routes_to value not in the routing table is rejected',
    l1Codes(badRoute).includes(L1.UNKNOWN_ROUTE));

  const mismatchedRoute = clone(byId['l1:example-pass']);
  mismatchedRoute.outcome = 'ARGUMENT_REWORK';
  mismatchedRoute.routes_to = 'verification';
  check('a routes_to value inconsistent with its outcome is rejected',
    l1Codes(mismatchedRoute).includes(L1.ROUTE_MISMATCH));
}

// --- L1 is never human authority -----------------------------------------------
console.log('\nL1 is not human authority');
{
  const claimsAuthority = clone(byId['l1:example-pass']);
  claimsAuthority.final_authority = 'agent';
  check('final_authority anything but "human" is rejected',
    l1Codes(claimsAuthority).includes(L1.HUMAN_AUTHORITY) || l1Codes(claimsAuthority).includes(L1.SCHEMA));

  const skillText = readFileSync(resolve(ROOT, 'skills/review-l1/SKILL.md'), 'utf8');
  check('the Skill states human/L2 remains final in authority.may_not',
    /may_not:[\s\S]*human/i.test(skillText) || /final authority/i.test(skillText));
}

// --- language_quality: version gating (SUE-607 / AES-V2.17) -------------------
console.log('\nlanguage_quality is required at 1.1.0 and forbidden at 1.0.0');
{
  check('all seven language dimensions are named', LANGUAGE_DIMENSIONS.length === 7);

  const missingAtNewVersion = clone(lqById['l1:example-language-quality-pass']);
  delete missingAtNewVersion.language_quality;
  check('a 1.1.0 record with language_quality missing is rejected',
    l1Codes(missingAtNewVersion).includes(L1.LANGUAGE_QUALITY_REQUIRED));

  const presentAtOldVersion = clone(byId['l1:example-pass']);
  presentAtOldVersion.language_quality = clone(lqById['l1:example-language-quality-pass']).language_quality;
  check('a 1.0.0 record carrying language_quality is rejected',
    l1Codes(presentAtOldVersion).includes(L1.LANGUAGE_QUALITY_NOT_ALLOWED));

  check('an existing 1.0.0 record with no language_quality still validates unchanged (regression guard)',
    l1Codes(byId['l1:example-pass']).length === 0);
}

// --- language_quality: all seven dimensions present exactly once --------------
console.log('\nlanguage_quality must carry all seven dimensions, each exactly once');
{
  const missingDim = clone(lqById['l1:example-language-quality-pass']);
  missingDim.language_quality.dimensions = missingDim.language_quality.dimensions.filter((d) => d.id !== 'owner_voice_fit');
  check('a language_quality block missing a dimension is rejected',
    l1Codes(missingDim).includes(L1.LANGUAGE_DIMENSION_MISSING));

  const duplicatedDim = clone(lqById['l1:example-language-quality-pass']);
  duplicatedDim.language_quality.dimensions.push(clone(duplicatedDim.language_quality.dimensions.find((d) => d.id === 'native_fluency')));
  check('a language_quality block duplicating a dimension is rejected',
    l1Codes(duplicatedDim).includes(L1.LANGUAGE_DIMENSION_DUPLICATED));
}

// --- language_quality: semantic_integrity dominates ----------------------------
console.log('\nlanguage_quality.semantic_integrity FAIL dominates a pass-shaped outcome');
{
  const integrityFailPassOutcome = clone(lqById['l1:example-language-quality-pass']);
  const si = integrityFailPassOutcome.language_quality.dimensions.find((d) => d.id === 'semantic_integrity');
  si.verdict = 'FAIL';
  si.evidence_span = 'The translated claim drops the source filing\'s currency, changing the reported magnitude.';
  si.routes_to = 'verification';
  check('semantic_integrity FAIL with outcome PASS is rejected',
    l1Codes(integrityFailPassOutcome).includes(L1.LANGUAGE_INTEGRITY_OVERRIDDEN));
}

// --- language_quality: routing (the smallest-layer-routing violation) ---------
console.log('\nlanguage_quality routing: each dimension has exactly one legal layer');
{
  const misrouted = clone(lqById['l1:example-language-quality-pass']);
  const nf = misrouted.language_quality.dimensions.find((d) => d.id === 'native_fluency');
  nf.verdict = 'FAIL';
  nf.evidence_span = 'Paragraph 4 opens with a calqued discourse connective the reference does not use.';
  nf.routes_to = 'writing';
  check('native_fluency FAIL routed to "writing" (the wrong layer) is rejected with the mis-routing code',
    l1Codes(misrouted).includes(L1.LANGUAGE_DIMENSION_MISROUTE));

  const correctlyRoutedLq = clone(lqById['l1:example-language-quality-pass']);
  const nfOk = correctlyRoutedLq.language_quality.dimensions.find((d) => d.id === 'native_fluency');
  nfOk.verdict = 'FAIL';
  nfOk.evidence_span = 'Paragraph 4 opens with a calqued discourse connective the reference does not use.';
  nfOk.routes_to = 'native_fluency';
  check('native_fluency FAIL routed to "native_fluency" is accepted',
    l1Codes(correctlyRoutedLq).length === 0, JSON.stringify(l1Codes(correctlyRoutedLq)));

  const failWithNoRoute = clone(lqById['l1:example-language-quality-pass']);
  const nfNoRoute = failWithNoRoute.language_quality.dimensions.find((d) => d.id === 'native_fluency');
  nfNoRoute.verdict = 'FAIL';
  nfNoRoute.evidence_span = 'Paragraph 4 opens with a calqued discourse connective the reference does not use.';
  check('a FAIL with no routes_to at all is rejected',
    l1Codes(failWithNoRoute).includes(L1.LANGUAGE_DIMENSION_ROUTE_REQUIRED));

  const passWithRoute = clone(lqById['l1:example-language-quality-pass']);
  const genreFit = passWithRoute.language_quality.dimensions.find((d) => d.id === 'genre_fit');
  genreFit.routes_to = 'register';
  check('a PASS dimension carrying a non-null routes_to is rejected',
    l1Codes(passWithRoute).includes(L1.LANGUAGE_DIMENSION_ROUTE_NOT_ALLOWED));
}

// --- corpus: no article body, ever ----------------------------------------------
console.log('\na corpus entry may never carry an article body');
{
  const withUnknownField = { ...clone(corpusEntries), body: 'x'.repeat(1000) };
  check('an entry with an unexpected body-shaped field fails schema validation (additionalProperties: false)',
    corpusCodes(withUnknownField).includes(CORPUS.SCHEMA));

  const withLongNote = clone(corpusEntries);
  withLongNote.notes = 'This is a placeholder note. '.repeat(40);
  check('a long string smuggled into an existing field is flagged as a suspected article body',
    corpusCodes(withLongNote).includes(CORPUS.ARTICLE_BODY_SUSPECTED));

  const eligibleNoRationale = clone(corpusEntries);
  delete eligibleNoRationale.reference_eligible_rationale;
  check('reference_eligible: true with no rationale is rejected',
    corpusCodes(eligibleNoRationale).includes(CORPUS.MISSING_ELIGIBILITY_RATIONALE));

  for (const file of ['corpus-placeholder-news-needs-rework.json', 'corpus-placeholder-view-unknown.json',
    'corpus-placeholder-generated-output-lineage.json', 'corpus-placeholder-academic-rejected.json']) {
    const entry = JSON.parse(readFileSync(resolve(ROOT, 'evals/real-output-corpus/entries', file), 'utf8'));
    check(`${file} validates cleanly`, corpusCodes(entry).length === 0, JSON.stringify(corpusCodes(entry)));
  }
}

// --- AES-V2 B4 (path B): a generated_output entry may not declare its own
// eligibility as a positive reference through an agent's recorded_by. This
// is the exact bypass the reviewer verified: skills/review-l1/SKILL.md
// treats reference_eligible: true as a legitimate GOOD reference, and the
// schema previously let recorded_by be {type: "agent"} with no further gate.
console.log('\na generated_output entry cannot self-declare reference_eligible via an agent recorded_by');
{
  const genOutputSeed = JSON.parse(readFileSync(
    resolve(ROOT, 'evals/real-output-corpus/entries/corpus-placeholder-generated-output-lineage.json'), 'utf8',
  ));

  const agentDeclaredEligible = clone(genOutputSeed);
  agentDeclaredEligible.reference_eligible = true;
  agentDeclaredEligible.reference_eligible_rationale = 'This generation is strong and should be reused.';
  agentDeclaredEligible.recorded_by = { type: 'agent', agent: { runtime: 'claude-agent-sdk', model: 'claude-sonnet-5' } };
  check('an agent-recorded generated_output entry declaring reference_eligible:true is rejected',
    corpusCodes(agentDeclaredEligible).includes(CORPUS.GENERATED_OUTPUT_ELIGIBLE_NOT_HUMAN));

  const humanDeclaredEligible = clone(genOutputSeed);
  humanDeclaredEligible.reference_eligible = true;
  humanDeclaredEligible.reference_eligible_rationale = 'Owner explicitly reviewed and cited this piece as the register bar.';
  humanDeclaredEligible.recorded_by = { type: 'human' };
  check('the identical entry recorded_by a human is accepted',
    !corpusCodes(humanDeclaredEligible).includes(CORPUS.GENERATED_OUTPUT_ELIGIBLE_NOT_HUMAN));

  const agentDeclaredButNotEligible = clone(genOutputSeed);
  agentDeclaredButNotEligible.recorded_by = { type: 'agent', agent: { runtime: 'claude-agent-sdk', model: 'claude-sonnet-5' } };
  check('an agent may still record a generated_output entry as long as reference_eligible stays false',
    !corpusCodes(agentDeclaredButNotEligible).includes(CORPUS.GENERATED_OUTPUT_ELIGIBLE_NOT_HUMAN));

  const agentEligibleExternal = clone(corpusEntries); // provenance_class owner_created/external — not the gated path
  agentEligibleExternal.recorded_by = { type: 'agent', agent: { runtime: 'claude-agent-sdk', model: 'claude-sonnet-5' } };
  check('an agent-recorded eligible entry that is NOT generated_output is unaffected by this guard',
    !corpusCodes(agentEligibleExternal).includes(CORPUS.GENERATED_OUTPUT_ELIGIBLE_NOT_HUMAN));
}

console.log(failures === 0 ? '\nl1/corpus tests: PASS' : `\nl1/corpus tests: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
