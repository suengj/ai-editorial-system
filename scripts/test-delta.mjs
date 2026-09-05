#!/usr/bin/env node
/**
 * Regression test for the delta-plan / polish-decision engine — AES-V2.18
 * (SUE-610).
 *
 * Golden/negative fixture pairs, one per guard in scripts/lib/delta-core.mjs,
 * modelled on scripts/test-language.mjs and scripts/test-l1.mjs. Every guard
 * (G1-G6, P1-P6, A1-A3, seven-axis completeness, the no-aggregate rule, the
 * advisory edit-surface band, and the ceiling-consistency check) has a
 * negative fixture proving it fires and the golden fixture proves it does
 * NOT fire on a valid record.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, ADVISORY_EDIT_SURFACE_BAND, loadDeltaSchema, loadPolishSchema,
  checkAxisCompleteness, checkAxisGuards, checkCeiling, checkNoAggregateFields,
  checkAcceptRule, checkEditModeGuards, checkActionGuards, checkEditSurfaceBand,
  checkPackModeCrossCheck, checkRevertReason, checkDeltaPlanBinding,
  validateDeltaPlan, validatePolishDecision,
} from './lib/delta-core.mjs';
import { loadRoutingLayerIds } from './lib/language-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../evals/fixtures/delta');
const DELTA_GOLDEN_PATH = resolve(FIXTURES, 'delta-plan-golden.json');
const POLISH_GOLDEN_PATH = resolve(FIXTURES, 'polish-decision-golden.json');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const hasCode = (issues, code) => issues.some((i) => i.code === code);
const clone = (obj) => JSON.parse(JSON.stringify(obj));

const deltaSchema = loadDeltaSchema();
const polishSchema = loadPolishSchema();
const routingLayerIds = loadRoutingLayerIds();

const deltaGolden = JSON.parse(readFileSync(DELTA_GOLDEN_PATH, 'utf8'));
const polishGolden = JSON.parse(readFileSync(POLISH_GOLDEN_PATH, 'utf8'));

const deltaCodes = (r) => validateDeltaPlan(r, { schema: deltaSchema, routingLayerIds }).map((i) => i.code);
const polishCodes = (r) => validatePolishDecision(r, { schema: polishSchema, routingLayerIds }).map((i) => i.code);

// --- golden fixtures ---------------------------------------------------------
console.log('golden fixture: delta plan (expect 0 issues)');
check('delta-plan-golden.json validates with zero issues', deltaCodes(deltaGolden).length === 0, JSON.stringify(deltaCodes(deltaGolden)));

console.log('golden fixture: polish decision (expect 0 issues)');
check('polish-decision-golden.json validates with zero issues', polishCodes(polishGolden).length === 0, JSON.stringify(polishCodes(polishGolden)));

// --- axis completeness --------------------------------------------------------
console.log('\naxis completeness (exactly seven, no duplicates)');
{
  const bad = clone(deltaGolden);
  bad.axis_deltas = bad.axis_deltas.filter((d) => d.axis !== 'terminology');
  const issues = checkAxisCompleteness(bad, 'fixture');
  check('a missing axis is rejected', hasCode(issues, CODES.AXIS_MISSING), JSON.stringify(issues));
}
{
  const bad = clone(deltaGolden);
  bad.axis_deltas.push(clone(bad.axis_deltas.find((d) => d.axis === 'genre')));
  const issues = checkAxisCompleteness(bad, 'fixture');
  check('a duplicated axis is rejected', hasCode(issues, CODES.AXIS_DUPLICATED), JSON.stringify(issues));
}
{
  const issues = checkAxisCompleteness(deltaGolden, 'fixture');
  check('exactly seven distinct axes passes', issues.length === 0, JSON.stringify(issues));
}

// --- G1 ------------------------------------------------------------------------
console.log('\nG1: upstream axis MATERIAL/LARGE may not be P1_LOCAL_POLISH');
{
  const bad = clone(deltaGolden);
  const audience = bad.axis_deltas.find((d) => d.axis === 'audience');
  audience.intervention = 'P1_LOCAL_POLISH'; // delta LARGE, upstream axis
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('a LARGE-delta audience axis assigned P1_LOCAL_POLISH is rejected', hasCode(issues, CODES.G1_UPSTREAM_AXIS_LOCAL_POLISH), JSON.stringify(issues));
}
{
  const issues = checkAxisGuards(deltaGolden, 'fixture', { routingLayerIds });
  check('the golden fixture (audience correctly at P3) passes G1', !hasCode(issues, CODES.G1_UPSTREAM_AXIS_LOCAL_POLISH), JSON.stringify(issues));
}

// --- G2 --------------------------------------------------------------------------
console.log('\nG2: language_quality LARGE may not be P1 alone');
{
  const bad = clone(deltaGolden);
  const lq = bad.axis_deltas.find((d) => d.axis === 'language_quality');
  lq.delta = 'LARGE';
  lq.intervention = 'P1_LOCAL_POLISH';
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('a LARGE language_quality delta assigned P1_LOCAL_POLISH is rejected', hasCode(issues, CODES.G2_LANGUAGE_QUALITY_LARGE_LOCAL_POLISH), JSON.stringify(issues));
}
{
  const issues = checkAxisGuards(deltaGolden, 'fixture', { routingLayerIds });
  check('the golden fixture (language_quality LOW/P0) passes G2', !hasCode(issues, CODES.G2_LANGUAGE_QUALITY_LARGE_LOCAL_POLISH), JSON.stringify(issues));
}

// --- G3 --------------------------------------------------------------------------
console.log('\nG3: a LOW delta may never justify P3 (or P2)');
{
  const bad = clone(deltaGolden);
  const register = bad.axis_deltas.find((d) => d.axis === 'register');
  register.intervention = 'P3_RECOMPOSE'; // delta LOW
  register.owning_layer = 'register';
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('a LOW-delta axis assigned P3_RECOMPOSE is rejected', hasCode(issues, CODES.G3_LOW_DELTA_OVERREACH), JSON.stringify(issues));
}
{
  const issues = checkAxisGuards(deltaGolden, 'fixture', { routingLayerIds });
  check('the golden fixture (register LOW/P1) passes G3', !hasCode(issues, CODES.G3_LOW_DELTA_OVERREACH), JSON.stringify(issues));
}

// --- G4 --------------------------------------------------------------------------
console.log('\nG4 (AMENDMENT 1 item A): UNKNOWN MUST be P0_PRESERVE — no other intervention is legal, and it must record what_would_resolve_it');
{
  const bad = clone(deltaGolden);
  const structure = bad.axis_deltas.find((d) => d.axis === 'information_structure');
  structure.intervention = 'P2_CONTROLLED_ADAPT';
  structure.owning_layer = 'frame';
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('an UNKNOWN-delta axis assigned P2_CONTROLLED_ADAPT is rejected', hasCode(issues, CODES.G4_UNKNOWN_DELTA_OVERREACH), JSON.stringify(issues));
}
{
  // The exact regression the amendment closes: the OLD G4 only blocked P2/P3
  // on an UNKNOWN axis, leaving P1_LOCAL_POLISH open — a record with all
  // seven axes UNKNOWN and the whole draft routed to Language Polish
  // validated clean. This must now fire.
  const bad = clone(deltaGolden);
  const structure = bad.axis_deltas.find((d) => d.axis === 'information_structure');
  structure.intervention = 'P1_LOCAL_POLISH';
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('an UNKNOWN-delta axis assigned P1_LOCAL_POLISH is rejected (the amendment\'s closed gap)', hasCode(issues, CODES.G4_UNKNOWN_DELTA_OVERREACH), JSON.stringify(issues));
}
{
  const bad = clone(deltaGolden);
  const structure = bad.axis_deltas.find((d) => d.axis === 'information_structure');
  delete structure.what_would_resolve_it;
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('an UNKNOWN-delta axis with no what_would_resolve_it is rejected', hasCode(issues, CODES.G4_UNKNOWN_MISSING_RESOLUTION), JSON.stringify(issues));
}
{
  const issues = checkAxisGuards(deltaGolden, 'fixture', { routingLayerIds });
  check('the golden fixture (information_structure UNKNOWN/P0_PRESERVE with what_would_resolve_it) passes G4',
    !hasCode(issues, CODES.G4_UNKNOWN_DELTA_OVERREACH) && !hasCode(issues, CODES.G4_UNKNOWN_MISSING_RESOLUTION), JSON.stringify(issues));
}

// --- G5 --------------------------------------------------------------------------
console.log('\nG5: every P2/P3 axis names a non-null, non-polish-owned, resolvable owning_layer');
{
  const bad = clone(deltaGolden);
  bad.axis_deltas.find((d) => d.axis === 'audience').owning_layer = null;
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('a P3 axis with owning_layer null is rejected', hasCode(issues, CODES.G5_MISSING_OWNING_LAYER), JSON.stringify(issues));
}
{
  const bad = clone(deltaGolden);
  bad.axis_deltas.find((d) => d.axis === 'audience').owning_layer = 'normative';
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('a P3 axis with a polish-owned owning_layer is rejected', hasCode(issues, CODES.G5_OWNING_LAYER_IS_POLISH_OWNED), JSON.stringify(issues));
}
{
  const bad = clone(deltaGolden);
  bad.axis_deltas.find((d) => d.axis === 'audience').owning_layer = 'not-a-real-layer';
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('a P3 axis with an unresolvable owning_layer is rejected', hasCode(issues, CODES.G5_OWNING_LAYER_UNKNOWN), JSON.stringify(issues));
}
{
  const issues = checkAxisGuards(deltaGolden, 'fixture', { routingLayerIds });
  check('the golden fixture\'s P2/P3 axes all pass G5', !hasCode(issues, CODES.G5_MISSING_OWNING_LAYER) && !hasCode(issues, CODES.G5_OWNING_LAYER_IS_POLISH_OWNED) && !hasCode(issues, CODES.G5_OWNING_LAYER_UNKNOWN), JSON.stringify(issues));
}

// --- G6 --------------------------------------------------------------------------
console.log('\nG6: source_observation and target_requirement must be about the actual text, not each other restated');
{
  const bad = clone(deltaGolden);
  const genre = bad.axis_deltas.find((d) => d.axis === 'genre');
  genre.target_requirement = genre.source_observation;
  const issues = checkAxisGuards(bad, 'fixture', { routingLayerIds });
  check('identical source_observation/target_requirement is rejected', hasCode(issues, CODES.G6_RESTATEMENT), JSON.stringify(issues));
}
{
  const issues = checkAxisGuards(deltaGolden, 'fixture', { routingLayerIds });
  check('the golden fixture\'s distinct observation/requirement pairs pass G6', !hasCode(issues, CODES.G6_RESTATEMENT), JSON.stringify(issues));
}

// --- ceiling consistency -------------------------------------------------------
console.log('\nplan_intervention is the ceiling (maximum), never chosen independently');
{
  const bad = clone(deltaGolden);
  bad.plan_intervention.value = 'P1_LOCAL_POLISH'; // actual max is P3 (audience)
  const issues = checkCeiling(bad, 'fixture');
  check('a plan_intervention lower than the actual maximum axis intervention is rejected', hasCode(issues, CODES.CEILING_MISMATCH), JSON.stringify(issues));
}
{
  const issues = checkCeiling(deltaGolden, 'fixture');
  check('the golden fixture\'s plan_intervention (P3, matching the audience axis) passes', issues.length === 0, JSON.stringify(issues));
}

// --- no-aggregate ----------------------------------------------------------------
console.log('\nno-aggregate: forbidden field names anywhere except edit_surface.original_total/changed_total');
{
  const bad = clone(deltaGolden);
  bad.axis_deltas[0].confidence_score = 0.9;
  const issues = checkNoAggregateFields(bad, 'fixture');
  check('a "confidence_score" field anywhere in a delta record is rejected', hasCode(issues, CODES.NO_AGGREGATE_FIELD), JSON.stringify(issues));
}
{
  const issues = checkNoAggregateFields(deltaGolden, 'fixture');
  check('the golden delta plan carries no forbidden field names', issues.length === 0, JSON.stringify(issues));
}
{
  const bad = clone(polishGolden);
  bad.notes = 'placeholder';
  bad.overall_rating = 'high';
  const issues = checkNoAggregateFields(bad, 'fixture');
  check('a "overall_rating" field on a polish decision is rejected', hasCode(issues, CODES.NO_AGGREGATE_FIELD), JSON.stringify(issues));
}
{
  const issues = checkNoAggregateFields(polishGolden, 'fixture');
  check('edit_surface.original_total/changed_total are exempt from the no-aggregate guard', issues.length === 0, JSON.stringify(issues));
}

// --- P1 ----------------------------------------------------------------------------
console.log('\nP1: KEEP requires zero accepted edits');
{
  const bad = clone(polishGolden);
  bad.action = 'KEEP'; // edits still carry two accepted edits
  const issues = checkActionGuards(bad, 'fixture', { routingLayerIds });
  check('KEEP with an accepted edit is rejected', hasCode(issues, CODES.P1_KEEP_HAS_ACCEPTED_EDIT), JSON.stringify(issues));
}
{
  const issues = checkActionGuards(polishGolden, 'fixture', { routingLayerIds });
  check('LOCAL_POLISH is not itself a P1 violation', !hasCode(issues, CODES.P1_KEEP_HAS_ACCEPTED_EDIT), JSON.stringify(issues));
}

// --- P2 ----------------------------------------------------------------------------
console.log('\nP2: LOCAL_POLISH requires at least one accepted edit');
{
  const bad = clone(polishGolden);
  for (const e of bad.edits) e.verdict = 'revert';
  bad.edits.forEach((e) => { e.revert_reason = 'fixture: forced revert for the P2 negative case'; });
  const issues = checkActionGuards(bad, 'fixture', { routingLayerIds });
  check('LOCAL_POLISH with zero accepted edits is rejected', hasCode(issues, CODES.P2_LOCAL_POLISH_NO_ACCEPTED_EDIT), JSON.stringify(issues));
}
{
  const issues = checkActionGuards(polishGolden, 'fixture', { routingLayerIds });
  check('the golden fixture (LOCAL_POLISH, two accepted edits) passes P2', !hasCode(issues, CODES.P2_LOCAL_POLISH_NO_ACCEPTED_EDIT), JSON.stringify(issues));
}

// --- P3 ----------------------------------------------------------------------------
console.log('\nP3: UPSTREAM_REPLAN_REQUIRED requires a non-null route and zero accepted edits');
{
  const bad = clone(polishGolden);
  bad.action = 'UPSTREAM_REPLAN_REQUIRED';
  bad.upstream_route = null;
  for (const e of bad.edits) e.verdict = 'revert';
  bad.edits.forEach((e) => { e.revert_reason = 'fixture'; });
  const issues = checkActionGuards(bad, 'fixture', { routingLayerIds });
  check('UPSTREAM_REPLAN_REQUIRED with upstream_route null is rejected', hasCode(issues, CODES.P3_UPSTREAM_MISSING_ROUTE), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden);
  bad.action = 'UPSTREAM_REPLAN_REQUIRED';
  bad.upstream_route = { layer: 'audience', reason: 'fixture' };
  // edits left as-is: two accepted edits remain
  const issues = checkActionGuards(bad, 'fixture', { routingLayerIds });
  check('UPSTREAM_REPLAN_REQUIRED with an accepted edit is rejected', hasCode(issues, CODES.P3_UPSTREAM_HAS_ACCEPTED_EDIT), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden);
  bad.action = 'UPSTREAM_REPLAN_REQUIRED';
  bad.upstream_route = { layer: 'not-a-real-layer', reason: 'fixture' };
  for (const e of bad.edits) e.verdict = 'revert';
  bad.edits.forEach((e) => { e.revert_reason = 'fixture'; });
  const issues = checkActionGuards(bad, 'fixture', { routingLayerIds });
  check('an upstream_route.layer not in the routing table is rejected', hasCode(issues, CODES.UPSTREAM_ROUTE_UNKNOWN_LAYER), JSON.stringify(issues));
}
{
  const ok = clone(polishGolden);
  ok.action = 'UPSTREAM_REPLAN_REQUIRED';
  ok.upstream_route = { layer: 'audience', reason: 'fixture' };
  for (const e of ok.edits) e.verdict = 'revert';
  ok.edits.forEach((e) => { e.revert_reason = 'fixture'; });
  const issues = checkActionGuards(ok, 'fixture', { routingLayerIds });
  check('a correctly-formed UPSTREAM_REPLAN_REQUIRED record passes P3', issues.length === 0, JSON.stringify(issues));
}

// --- P4 ----------------------------------------------------------------------------
console.log('\nP4: soft_detector requires the full eleven-criterion pairwise block');
{
  const bad = clone(polishGolden);
  const soft = bad.edits.find((e) => e.application_mode === 'soft_detector');
  delete soft.pairwise.rhythm;
  const issues = checkEditModeGuards(soft, 'fixture');
  check('a soft_detector edit missing one pairwise criterion is rejected', hasCode(issues, CODES.P4_SOFT_DETECTOR_MISSING_PAIRWISE), JSON.stringify(issues));
}
{
  const soft = polishGolden.edits.find((e) => e.application_mode === 'soft_detector');
  const issues = checkEditModeGuards(soft, 'fixture');
  check('the golden fixture\'s soft_detector edit (full pairwise) passes P4', !hasCode(issues, CODES.P4_SOFT_DETECTOR_MISSING_PAIRWISE), JSON.stringify(issues));
}

// --- P5 ----------------------------------------------------------------------------
console.log('\nP5: upstream_guidance/local_observation/deprecated_as_instruction may never accept');
{
  const bad = clone(polishGolden);
  const soft = bad.edits.find((e) => e.application_mode === 'soft_detector');
  soft.application_mode = 'upstream_guidance';
  // verdict stays "accept"
  const issues = checkEditModeGuards(soft, 'fixture');
  check('an upstream_guidance edit with verdict accept is rejected', hasCode(issues, CODES.P5_MODE_MAY_NOT_ACCEPT), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden);
  const soft = bad.edits.find((e) => e.application_mode === 'soft_detector');
  soft.application_mode = 'local_observation';
  const issues = checkEditModeGuards(soft, 'fixture');
  check('a local_observation edit with verdict accept is rejected', hasCode(issues, CODES.P5_MODE_MAY_NOT_ACCEPT), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden);
  const soft = bad.edits.find((e) => e.application_mode === 'soft_detector');
  soft.application_mode = 'deprecated_as_instruction';
  const issues = checkEditModeGuards(soft, 'fixture');
  check('a deprecated_as_instruction edit with verdict accept is rejected', hasCode(issues, CODES.P5_MODE_MAY_NOT_ACCEPT), JSON.stringify(issues));
}
{
  for (const e of polishGolden.edits) {
    const issues = checkEditModeGuards(e, 'fixture');
    check(`the golden fixture's edit "${e.edit_id}" passes P5`, !hasCode(issues, CODES.P5_MODE_MAY_NOT_ACCEPT), JSON.stringify(issues));
  }
}

// --- P6 ----------------------------------------------------------------------------
console.log('\nP6: hard_local_correction may omit full pairwise but must record semantic_integrity; worse is rejected outright');
{
  const bad = clone(polishGolden);
  const hard = bad.edits.find((e) => e.application_mode === 'hard_local_correction');
  delete hard.pairwise.semantic_integrity;
  const issues = checkEditModeGuards(hard, 'fixture');
  check('a hard_local_correction edit with no semantic_integrity recorded is rejected', hasCode(issues, CODES.P6_HARD_LOCAL_MISSING_SEMANTIC_INTEGRITY), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden);
  const hard = bad.edits.find((e) => e.application_mode === 'hard_local_correction');
  hard.pairwise.semantic_integrity = 'worse';
  const issues = checkEditModeGuards(hard, 'fixture');
  check('a hard_local_correction edit with semantic_integrity "worse" is rejected outright', hasCode(issues, CODES.P6_HARD_LOCAL_WORSE_SEMANTIC_INTEGRITY), JSON.stringify(issues));
}
{
  const hard = polishGolden.edits.find((e) => e.application_mode === 'hard_local_correction');
  const issues = checkEditModeGuards(hard, 'fixture');
  check('the golden fixture\'s hard_local_correction edit (semantic_integrity "same") passes P6', issues.length === 0, JSON.stringify(issues));
}

// --- A1/A2/A3 accept rule ------------------------------------------------------------
console.log('\naccept rule A1-A3 (an accept that fails any clause is an ERROR, not a warning)');
{
  const bad = clone(polishGolden.edits.find((e) => e.application_mode === 'soft_detector'));
  bad.pairwise.continuous_readability = 'same';
  bad.pairwise.native_naturalness = 'same';
  const issues = checkAcceptRule(bad, 'fixture');
  check('accept with neither continuous_readability nor native_naturalness "better" fails A1', hasCode(issues, CODES.A1_FAIL), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden.edits.find((e) => e.application_mode === 'soft_detector'));
  bad.pairwise.semantic_integrity = 'worse';
  const issues = checkAcceptRule(bad, 'fixture');
  check('accept with semantic_integrity "worse" fails A2', hasCode(issues, CODES.A2_FAIL), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden.edits.find((e) => e.application_mode === 'soft_detector'));
  bad.pairwise.repetition = 'worse';
  const issues = checkAcceptRule(bad, 'fixture');
  check('accept with repetition "worse" fails A3', hasCode(issues, CODES.A3_FAIL), JSON.stringify(issues));
}
{
  const ok = polishGolden.edits.find((e) => e.application_mode === 'soft_detector');
  const issues = checkAcceptRule(ok, 'fixture');
  check('the golden fixture\'s accepted soft_detector edit satisfies A1-A3', issues.length === 0, JSON.stringify(issues));
}
{
  // A hard_local_correction edit (partial pairwise, no continuous_readability/
  // native_naturalness at all) may still legitimately accept — P6's carve-out.
  const ok = polishGolden.edits.find((e) => e.application_mode === 'hard_local_correction');
  const issues = checkAcceptRule(ok, 'fixture');
  check('a hard_local_correction accept with only semantic_integrity recorded satisfies the accept rule (documented A1 exemption)', issues.length === 0, JSON.stringify(issues));
}

// --- advisory edit-surface band --------------------------------------------------------
console.log(`\nadvisory edit-surface band (ADVISORY_EDIT_SURFACE_BAND = ${ADVISORY_EDIT_SURFACE_BAND}) triggers an explanation requirement, never a rejection of the draft`);
{
  const bad = clone(polishGolden);
  bad.edit_surface.changed_total = 200; // 200/500 = 40%, past the 20% band
  delete bad.edit_surface.large_edit_justification;
  const issues = checkEditSurfaceBand(bad, 'fixture');
  check('exceeding the band with no large_edit_justification is rejected', hasCode(issues, CODES.ADVISORY_BAND_JUSTIFICATION_MISSING), JSON.stringify(issues));
  check('the failure message states the band triggers an explanation, never a rejection of the draft',
    issues.some((i) => /never fails the draft/.test(i.message) && /not a gate/.test(i.message)), JSON.stringify(issues));
}
{
  const ok = clone(polishGolden);
  ok.edit_surface.changed_total = 200;
  ok.edit_surface.large_edit_justification = 'Fixture: the source draft required a broad correction because every paragraph carried the same defect; UPSTREAM_REPLAN_REQUIRED was considered and rejected because the defect was purely local-language, not structural.';
  const issues = checkEditSurfaceBand(ok, 'fixture');
  check('exceeding the band WITH a large_edit_justification passes', issues.length === 0, JSON.stringify(issues));
}
{
  const issues = checkEditSurfaceBand(polishGolden, 'fixture');
  check('the golden fixture (12%, within the band) needs no justification and passes', issues.length === 0, JSON.stringify(issues));
}

// --- B: pack/record mode cross-check (AMENDMENT 1 item B) --------------------------------
console.log('\nB: edit.application_mode must match what pack_ref\'s pack actually declares for rule_ref');
{
  // The reviewer's actual attack, as a regression fixture: an edit citing a
  // REAL upstream_guidance audience rule from the ko-KR pack
  // (aud-vocab-tier-basic) while asserting hard_local_correction on the
  // record. L3 (pack side) and P5 (record side) each individually held and
  // never met, because nothing checked the two against each other. This must
  // now error, and it must never validate clean again.
  const attack = clone(polishGolden);
  const hard = attack.edits.find((e) => e.application_mode === 'hard_local_correction');
  hard.rule_ref = 'aud-vocab-tier-basic';
  hard.authority_class = 'AUDIENCE_CONSTRAINT';
  // application_mode stays "hard_local_correction" — the self-assertion the exploit relied on.
  const issues = checkPackModeCrossCheck(attack, 'fixture');
  check('citing an upstream_guidance audience rule while asserting hard_local_correction is rejected (the CRITICAL finding)', hasCode(issues, CODES.B_MODE_MISMATCH), JSON.stringify(issues));
  const fullIssues = validatePolishDecision(attack, { schema: polishSchema, routingLayerIds });
  check('the exploit no longer validates clean end-to-end', fullIssues.length > 0 && hasCode(fullIssues, CODES.B_MODE_MISMATCH), JSON.stringify(fullIssues));
}
{
  const bad = clone(polishGolden);
  bad.pack_ref = null;
  const issues = checkPackModeCrossCheck(bad, 'fixture');
  check('a null pack_ref with a non-null rule_ref is rejected, not skipped', hasCode(issues, CODES.B_PACK_REF_MISSING), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden);
  bad.pack_ref = 'editorial/profiles/language/does-not-exist.json';
  const issues = checkPackModeCrossCheck(bad, 'fixture');
  check('an unresolvable pack_ref is rejected, not skipped', hasCode(issues, CODES.B_PACK_UNRESOLVABLE), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden);
  const hard = bad.edits.find((e) => e.application_mode === 'hard_local_correction');
  hard.rule_ref = 'no-such-rule-in-ko-kr';
  const issues = checkPackModeCrossCheck(bad, 'fixture');
  check('a rule_ref that does not resolve in the named pack is rejected', hasCode(issues, CODES.B_RULE_REF_UNRESOLVED), JSON.stringify(issues));
}
{
  const issues = checkPackModeCrossCheck(polishGolden, 'fixture');
  check('the golden fixture\'s edits (real ko-KR rules, matching modes) pass B', issues.length === 0, JSON.stringify(issues));
}

// --- C: revert_reason enforcement (AMENDMENT 1 item C) -----------------------------------
console.log('\nC: verdict "revert" requires a non-empty revert_reason');
{
  const bad = clone(polishGolden.edits.find((e) => e.application_mode === 'soft_detector'));
  bad.verdict = 'revert';
  delete bad.revert_reason;
  const issues = checkRevertReason(bad, 'fixture');
  check('a revert with no revert_reason at all is rejected', hasCode(issues, CODES.C_REVERT_REASON_MISSING), JSON.stringify(issues));
}
{
  const bad = clone(polishGolden.edits.find((e) => e.application_mode === 'soft_detector'));
  bad.verdict = 'revert';
  bad.revert_reason = '   ';
  const issues = checkRevertReason(bad, 'fixture');
  check('a revert with a whitespace-only revert_reason is rejected', hasCode(issues, CODES.C_REVERT_REASON_MISSING), JSON.stringify(issues));
}
{
  const ok = clone(polishGolden.edits.find((e) => e.application_mode === 'soft_detector'));
  ok.verdict = 'revert';
  ok.revert_reason = 'Fixture: A1 failed, neither continuous_readability nor native_naturalness was better.';
  const issues = checkRevertReason(ok, 'fixture');
  check('a revert with a non-empty revert_reason passes', issues.length === 0, JSON.stringify(issues));
}
{
  for (const e of polishGolden.edits) {
    const issues = checkRevertReason(e, 'fixture');
    check(`the golden fixture's edit "${e.edit_id}" (verdict accept, no revert_reason needed) passes C`, issues.length === 0, JSON.stringify(issues));
  }
}

// --- D: delta_plan_ref binding (AMENDMENT 1 item D) --------------------------------------
console.log('\nD: a delta_plan_ref that resolves to a P0_PRESERVE ceiling requires polish action KEEP');
{
  const stubResolve = (ref) => (ref === 'delta:fixture-p0-stub'
    ? { delta_plan_id: 'delta:fixture-p0-stub', plan_intervention: { value: 'P0_PRESERVE' } }
    : null);
  const bad = clone(polishGolden);
  bad.delta_plan_ref = 'delta:fixture-p0-stub';
  // action stays "LOCAL_POLISH"
  const issues = checkDeltaPlanBinding(bad, 'fixture', { resolveDeltaPlan: stubResolve });
  check('LOCAL_POLISH against a resolved P0_PRESERVE ceiling is rejected', hasCode(issues, CODES.D_CEILING_KEEP_REQUIRED), JSON.stringify(issues));

  const ok = clone(bad);
  ok.action = 'KEEP';
  for (const e of ok.edits) { e.verdict = 'revert'; e.revert_reason = 'Fixture: ceiling is P0_PRESERVE, no edit may accept.'; }
  const okIssues = checkDeltaPlanBinding(ok, 'fixture', { resolveDeltaPlan: stubResolve });
  check('KEEP against a resolved P0_PRESERVE ceiling passes', okIssues.length === 0, JSON.stringify(okIssues));
}
{
  const stubResolve = (ref) => (ref === 'delta:fixture-p3-stub'
    ? { delta_plan_id: 'delta:fixture-p3-stub', plan_intervention: { value: 'P3_RECOMPOSE' } }
    : null);
  const ok = clone(polishGolden);
  ok.delta_plan_ref = 'delta:fixture-p3-stub';
  const issues = checkDeltaPlanBinding(ok, 'fixture', { resolveDeltaPlan: stubResolve });
  check('a non-P0_PRESERVE ceiling never constrains the action', issues.length === 0, JSON.stringify(issues));
}
{
  const unresolvable = clone(polishGolden);
  unresolvable.delta_plan_ref = 'delta:nothing-on-disk-names-this';
  const issues = checkDeltaPlanBinding(unresolvable, 'fixture', { resolveDeltaPlan: () => null });
  check('a delta_plan_ref that resolves to nothing on disk is not an error (referential integrity is not this guard\'s concern)', issues.length === 0, JSON.stringify(issues));
}
{
  // End-to-end with the REAL default resolver against actual dogfood evidence
  // on disk: c1-bonds-news has ceiling P0_PRESERVE and polish action KEEP.
  const okRecord = { decision_id: 'polish:d-check-ok', pack_ref: null, delta_plan_ref: 'delta:c1-bonds-news', action: 'KEEP', edits: [] };
  const issues = checkDeltaPlanBinding(okRecord, 'fixture');
  check('the real default resolver finds delta:c1-bonds-news (P0_PRESERVE) and KEEP satisfies it', issues.length === 0, JSON.stringify(issues));

  const badRecord = { decision_id: 'polish:d-check-bad', pack_ref: null, delta_plan_ref: 'delta:c1-bonds-news', action: 'LOCAL_POLISH', edits: [] };
  const badIssues = checkDeltaPlanBinding(badRecord, 'fixture');
  check('the real default resolver rejects LOCAL_POLISH against delta:c1-bonds-news\'s P0_PRESERVE ceiling', hasCode(badIssues, CODES.D_CEILING_KEEP_REQUIRED), JSON.stringify(badIssues));
}

// --- end-to-end wiring -----------------------------------------------------------------
console.log('\nend-to-end validateDeltaPlan / validatePolishDecision wiring');
{
  const issues = validateDeltaPlan(deltaGolden, { schema: deltaSchema, routingLayerIds });
  check('validateDeltaPlan on the golden fixture returns zero issues', issues.length === 0, JSON.stringify(issues));
}
{
  const issues = validatePolishDecision(polishGolden, { schema: polishSchema, routingLayerIds });
  check('validatePolishDecision on the golden fixture returns zero issues', issues.length === 0, JSON.stringify(issues));
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failing assertion(s)`);
process.exit(failures === 0 ? 0 : 1);
