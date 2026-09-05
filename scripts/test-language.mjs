#!/usr/bin/env node
/**
 * Regression test for the language pack validator — AES-V2.17 (SUE-607).
 *
 * Allow/deny fixture pairs, one per check in scripts/lib/language-core.mjs,
 * modelled on scripts/test-registry.mjs. The repo's Evidence rule
 * (docs/architecture/REPOSITORY-CONTRACT.md) is that absence of a failure is
 * a PASS only when the check demonstrably ran — every check below has a
 * deny fixture that actually fires it, not just an allow fixture that
 * happens not to fire it.
 *
 * A handful of checks (unknown layer id, normative headline failure, unbacked
 * mechanical claim, shared-promotion sufficiency, genre/audience
 * orthogonality, scope-id resolution, holdout leakage, pointless alias) are
 * exercised by calling the individual check function directly rather than
 * through the full schema-validating validatePack(). Schema
 * (schemas/language-pack.schema.json) already closes several of these enums
 * to the same values the pack-level rule is meant to police (e.g. `layer` is
 * a closed enum matching editorial/feedback-routing.json's current ids), so
 * a hand-built deny object that violates only the pack-level rule — without
 * also tripping a schema failure that would mask which check actually fired
 * — needs a direct call.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, loadSchema, loadRoutingLayerIds, getLanguageAxis,
  checkSchema, checkFilenameAndId, checkDocRef, checkLayers,
  checkNormativeAuthority, checkUnbackedMechanicalClaim, checkSharedPromotion,
  checkGenreAudienceOrthogonality, checkScopeIdsResolve, checkHoldoutLeakage,
  checkPointlessAliases, checkApplicationMode, validatePack, validatePackFile, validateAll,
} from './lib/language-core.mjs';
import { loadAxisProfiles } from './lib/profile-core.mjs';
import { listEvaluationFiles } from './lib/registry-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '../evals/fixtures/language');
const PACKS_DIR = resolve(FIXTURES, 'packs');
const EVAL_FIXTURES_DIR = resolve(FIXTURES, 'evaluations');
const BASE_PACK_PATH = resolve(PACKS_DIR, 'zz-ZZ.json');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const hasCode = (issues, code) => issues.some((i) => i.code === code);
const clone = (obj) => JSON.parse(JSON.stringify(obj));

const schema = loadSchema();
const axis = getLanguageAxis();
const routingLayerIds = loadRoutingLayerIds();
const contentIds = new Set(Object.keys(loadAxisProfiles('content')));
const audienceIds = new Set(Object.keys(loadAxisProfiles('audience')));
const fixtureEvalFiles = listEvaluationFiles(EVAL_FIXTURES_DIR);

const basePack = JSON.parse(readFileSync(BASE_PACK_PATH, 'utf8'));

const opts = {
  schema, axis, routingLayerIds, contentIds, audienceIds,
  evaluationsDir: EVAL_FIXTURES_DIR,
  evaluationFiles: fixtureEvalFiles,
};

// --- allow fixture: the base pack is clean end to end -----------------------
console.log('allow fixture (expect 0 issues, 0 notes save for none expected)');
{
  const { issues, notes } = validatePack(clone(basePack), BASE_PACK_PATH, opts);
  check('base fixture pack validates with zero issues', issues.length === 0, JSON.stringify(issues));
  check('base fixture pack has zero notes', notes.length === 0, JSON.stringify(notes));
}
{
  const { issues } = validatePackFile(BASE_PACK_PATH, opts);
  check('validatePackFile agrees with validatePack on the same fixture', issues.length === 0, JSON.stringify(issues));
}

// --- 1. schema ---------------------------------------------------------------
console.log('check 1: schema');
{
  const bad = clone(basePack);
  bad.rules[0].authority_class = 'NOT_A_REAL_CLASS';
  const issues = checkSchema(bad, schema, 'zz-ZZ');
  check('an unknown authority_class is rejected by schema', hasCode(issues, CODES.SCHEMA), JSON.stringify(issues));
}

// --- 2. filename / id --------------------------------------------------------
console.log('check 2: filename/id');
{
  const issues = checkFilenameAndId(basePack, resolve(PACKS_DIR, 'wrong-name.json'), axis);
  check('pack_id not matching filename stem is rejected', hasCode(issues, CODES.FILENAME_MISMATCH), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.pack_id = 'zzz';
  const issues = checkFilenameAndId(bad, resolve(PACKS_DIR, 'zzz.json'), axis);
  check('pack_id not matching the axis id_pattern is rejected', hasCode(issues, CODES.ID_PATTERN), JSON.stringify(issues));
}
{
  const issues = checkFilenameAndId(basePack, BASE_PACK_PATH, axis);
  check('matching pack_id/filename/id_pattern passes', issues.length === 0, JSON.stringify(issues));
}

// --- 3. doc_ref resolves ------------------------------------------------------
console.log('check 3: doc_ref resolves');
{
  const bad = clone(basePack);
  bad.doc_ref = 'docs/architecture/DOES-NOT-EXIST-ANYWHERE.md';
  const issues = checkDocRef(bad, 'zz-ZZ');
  check('a dangling doc_ref is rejected', hasCode(issues, CODES.DOC_REF_MISSING), JSON.stringify(issues));
}
{
  const issues = checkDocRef(basePack, 'zz-ZZ');
  check('an existing doc_ref passes', issues.length === 0, JSON.stringify(issues));
}

// --- 4. layer ids exist --------------------------------------------------------
console.log('check 4: layer ids resolve against feedback-routing.json');
{
  // Narrow the routing table to exclude "normative" so the base pack's
  // normative rule trips the check without needing a schema-invalid layer
  // value (schema's `layer` enum already matches the real routing table).
  const narrowed = new Set([...routingLayerIds].filter((id) => id !== 'normative'));
  const issues = checkLayers(basePack, 'zz-ZZ', narrowed);
  check('a rule layer absent from the routing table is rejected', hasCode(issues, CODES.UNKNOWN_LAYER), JSON.stringify(issues));
}
{
  const issues = checkLayers(basePack, 'zz-ZZ', routingLayerIds);
  check('every rule layer resolving against the full routing table passes', issues.length === 0, JSON.stringify(issues));
}

// --- 5. normative rules need a standards-body authority -----------------------
console.log('check 5: normative rules need a NORMATIVE_STANDARD authority');
{
  const bad = clone(basePack);
  bad.rules[0].authority_ref = null;
  const issues = checkNormativeAuthority(bad, 'zz-ZZ');
  check('a NORMATIVE rule with no authority_ref is rejected', hasCode(issues, CODES.NORMATIVE_NO_AUTHORITY), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[0].authority_ref = 'does-not-exist';
  const issues = checkNormativeAuthority(bad, 'zz-ZZ');
  check('a NORMATIVE rule whose authority_ref does not resolve is rejected', hasCode(issues, CODES.NORMATIVE_AUTHORITY_UNRESOLVED), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[0].authority_ref = 'corpus-ref'; // EMPIRICAL_REFERENCE, not NORMATIVE_STANDARD — the headline failure
  const issues = checkNormativeAuthority(bad, 'zz-ZZ');
  check('a NORMATIVE rule backed by an EMPIRICAL_REFERENCE authority is rejected',
    hasCode(issues, CODES.NORMATIVE_BACKED_BY_WEAKER_SOURCE), JSON.stringify(issues));
}
{
  const issues = checkNormativeAuthority(basePack, 'zz-ZZ');
  check('a NORMATIVE rule backed by a NORMATIVE_STANDARD authority passes', issues.length === 0, JSON.stringify(issues));
}

// --- 6. empirical rules may not claim mechanical checkability unbacked --------
console.log('check 6: unbacked mechanical empirical claim');
{
  const bad = clone(basePack);
  bad.rules[1].checkability = 'mechanical'; // native-quality-rule, no authority_ref
  const issues = checkUnbackedMechanicalClaim(bad, 'zz-ZZ');
  check('an empirical rule claiming mechanical checkability with no authority_ref is rejected',
    hasCode(issues, CODES.UNBACKED_MECHANICAL_CLAIM), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[1].checkability = 'mechanical';
  bad.rules[1].authority_ref = 'corpus-ref'; // backed — no longer an unbacked claim
  const issues = checkUnbackedMechanicalClaim(bad, 'zz-ZZ');
  check('an empirical rule claiming mechanical checkability WITH an authority_ref passes', issues.length === 0, JSON.stringify(issues));
}

// --- 7. shared promotion needs multi-evidence + holdout -----------------------
console.log('check 7: shared promotion sufficiency');
{
  const bad = clone(basePack);
  bad.rules[2].evidence_refs = ['eval:only-one'];
  bad.rules[2].holdout_refs = [];
  bad.rules[2].holdout_result = 'not_yet_tested';
  const { issues, notes } = checkSharedPromotion(bad, 'zz-ZZ');
  check('an active pack: insufficient shared-promotion evidence is a FAILURE', hasCode(issues, CODES.SHARED_PROMOTION_INSUFFICIENT), JSON.stringify(issues));
  check('an active pack: insufficient shared-promotion evidence is not merely a note', notes.length === 0, JSON.stringify(notes));
}
{
  const bad = clone(basePack);
  bad.status = 'draft';
  bad.rules[2].evidence_refs = ['eval:only-one'];
  bad.rules[2].holdout_refs = [];
  bad.rules[2].holdout_result = 'not_yet_tested';
  const { issues, notes } = checkSharedPromotion(bad, 'zz-ZZ');
  check('a draft pack: the same insufficiency is downgraded to a NOTE', hasCode(notes, CODES.SHARED_PROMOTION_INSUFFICIENT), JSON.stringify(notes));
  check('a draft pack: the same insufficiency is not a failure', issues.length === 0, JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[2].holdout_result = 'regressed';
  const { issues } = checkSharedPromotion(bad, 'zz-ZZ');
  check('regressed holdout_result on a shared empirical rule fails even with 2 evidence_refs', hasCode(issues, CODES.SHARED_PROMOTION_INSUFFICIENT), JSON.stringify(issues));
}
{
  const { issues, notes } = checkSharedPromotion(basePack, 'zz-ZZ');
  check('sufficient shared-promotion evidence passes', issues.length === 0 && notes.length === 0, JSON.stringify({ issues, notes }));
}
{
  // SUE-607 reviewer finding I2: the gate must cover every empirical rule
  // that reaches past the one source it was observed in, not only
  // generality "shared". A genre_local rule asserts a whole genre on one
  // institution's evidence — the same promotion failure one level down.
  const bad = clone(basePack);
  bad.rules[3].generality = 'genre_local'; // GENRE_CONVENTION, 0 evidence_refs
  const { issues } = checkSharedPromotion(bad, 'zz-ZZ');
  check('an unproven genre_local empirical rule fails with the empirical-promotion code',
    hasCode(issues, CODES.EMPIRICAL_PROMOTION_INSUFFICIENT), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[4].generality = 'audience_local'; // AUDIENCE_CONSTRAINT, 0 evidence_refs
  bad.status = 'draft';
  const { issues, notes } = checkSharedPromotion(bad, 'zz-ZZ');
  check('the same rule in a draft pack is a NOTE, not a failure',
    hasCode(notes, CODES.EMPIRICAL_PROMOTION_INSUFFICIENT) && issues.length === 0, JSON.stringify({ issues, notes }));
}
{
  // source_local is the honest default for a one-source trait: it makes no
  // promotion claim, so there is nothing for evidence to license.
  const ok = clone(basePack);
  ok.rules[3].generality = 'source_local';
  ok.rules[3].evidence_refs = [];
  const { issues, notes } = checkSharedPromotion(ok, 'zz-ZZ');
  check('a source_local empirical rule with no evidence_refs is exempt',
    issues.length === 0 && notes.length === 0, JSON.stringify({ issues, notes }));
}

{
  // Derivation and validation may not be mixed: a holdout record listed as
  // evidence destroys the holdout; a discovery record listed as corroboration
  // "confirms" the rule with the material that produced it.
  const bad = clone(basePack);
  bad.rules[2].holdout_refs = ['eval:discovery-record'];
  const { issues } = checkHoldoutLeakage(bad, 'zz-ZZ', { evaluationsDir: EVAL_FIXTURES_DIR, evaluationFiles: fixtureEvalFiles });
  check('a discovery record listed under holdout_refs is rejected',
    hasCode(issues, CODES.HOLDOUT_REF_NOT_HOLDOUT), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[2].evidence_refs = ['eval:discovery-record', 'eval:discovery-record-two'];
  bad.rules[2].holdout_refs = [];
  const { issues } = checkSharedPromotion(bad, 'zz-ZZ');
  check('two derivation refs with no independent holdout corroboration still fail promotion',
    hasCode(issues, CODES.SHARED_PROMOTION_INSUFFICIENT), JSON.stringify(issues));
}

// --- 8. genre ⊥ audience -------------------------------------------------------
console.log('check 8: genre and audience are orthogonal');
{
  const bad = clone(basePack);
  bad.rules[3].scope = { ...bad.rules[3].scope, audiences: ['general-reader'] }; // genre-rule
  const issues = checkGenreAudienceOrthogonality(bad, 'zz-ZZ');
  check('a GENRE_CONVENTION rule carrying scope.audiences is rejected', hasCode(issues, CODES.GENRE_CARRIES_AUDIENCE), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[4].scope = { ...bad.rules[4].scope, content_types: ['news'] }; // audience-rule
  const issues = checkGenreAudienceOrthogonality(bad, 'zz-ZZ');
  check('an AUDIENCE_CONSTRAINT rule carrying scope.content_types is rejected', hasCode(issues, CODES.AUDIENCE_CARRIES_GENRE), JSON.stringify(issues));
}
{
  const issues = checkGenreAudienceOrthogonality(basePack, 'zz-ZZ');
  check('a genre rule scoped only by content_types and an audience rule scoped only by audiences pass', issues.length === 0, JSON.stringify(issues));
}

// --- 9. scope ids resolve -------------------------------------------------------
console.log('check 9: scope ids resolve against the content/audience axes');
{
  const bad = clone(basePack);
  bad.rules[3].scope.content_types = ['not-a-real-content-type'];
  const issues = checkScopeIdsResolve(bad, 'zz-ZZ', { contentIds, audienceIds });
  check('an unknown scope.content_types id is rejected', hasCode(issues, CODES.UNKNOWN_CONTENT_TYPE), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[4].scope.audiences = ['not-a-real-audience'];
  const issues = checkScopeIdsResolve(bad, 'zz-ZZ', { contentIds, audienceIds });
  check('an unknown scope.audiences id is rejected', hasCode(issues, CODES.UNKNOWN_AUDIENCE), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.terminology[0].audience_aliases[0].audience = 'not-a-real-audience';
  const issues = checkScopeIdsResolve(bad, 'zz-ZZ', { contentIds, audienceIds });
  check('an unknown terminology audience_aliases audience id is rejected', hasCode(issues, CODES.UNKNOWN_ALIAS_AUDIENCE), JSON.stringify(issues));
}
{
  const issues = checkScopeIdsResolve(basePack, 'zz-ZZ', { contentIds, audienceIds });
  check('every scope id resolving against the real axes passes', issues.length === 0, JSON.stringify(issues));
}

// --- 10. holdout leakage ----------------------------------------------------------
console.log('check 10: holdout leakage / dangling evidence refs / unassigned corpus_role');
{
  const bad = clone(basePack);
  bad.rules[2].evidence_refs = ['eval:holdout-record'];
  const { issues } = checkHoldoutLeakage(bad, 'zz-ZZ', { evaluationsDir: EVAL_FIXTURES_DIR, evaluationFiles: fixtureEvalFiles });
  check('an evidence_ref resolving to a corpus_role:"holdout" record is rejected', hasCode(issues, CODES.HOLDOUT_LEAKAGE), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[2].evidence_refs = ['eval:does-not-exist-anywhere'];
  const { issues } = checkHoldoutLeakage(bad, 'zz-ZZ', { evaluationsDir: EVAL_FIXTURES_DIR, evaluationFiles: fixtureEvalFiles });
  check('an evidence_ref that resolves to nothing is reported as dangling, not silently passed', hasCode(issues, CODES.DANGLING_EVIDENCE_REF), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[2].evidence_refs = ['eval:unassigned-record'];
  const { issues, notes } = checkHoldoutLeakage(bad, 'zz-ZZ', { evaluationsDir: EVAL_FIXTURES_DIR, evaluationFiles: fixtureEvalFiles });
  check('an evidence_ref with no corpus_role at all is a NOTE, not a leak', hasCode(notes, CODES.UNASSIGNED_CORPUS_ROLE), JSON.stringify(notes));
  check('an unassigned corpus_role is not reported as a failure', issues.length === 0, JSON.stringify(issues));
}
{
  const { issues, notes } = checkHoldoutLeakage(basePack, 'zz-ZZ', { evaluationsDir: EVAL_FIXTURES_DIR, evaluationFiles: fixtureEvalFiles });
  check('evidence_refs resolving to discovery-role records pass clean', issues.length === 0 && notes.length === 0, JSON.stringify({ issues, notes }));
}

// --- 11. pointless audience aliases --------------------------------------------
console.log('check 11: pointless audience alias (surface_form == canonical/rendering)');
{
  const bad = clone(basePack);
  bad.terminology[0].audience_aliases[0].surface_form = bad.terminology[0].canonical;
  const notes = checkPointlessAliases(bad, 'zz-ZZ');
  check('an alias identical to canonical is reported as a NOTE', hasCode(notes, CODES.POINTLESS_ALIAS), JSON.stringify(notes));
}
{
  const bad = clone(basePack);
  bad.terminology[0].audience_aliases[0].surface_form = bad.terminology[0].rendering;
  const notes = checkPointlessAliases(bad, 'zz-ZZ');
  check('an alias identical to rendering is reported as a NOTE', hasCode(notes, CODES.POINTLESS_ALIAS), JSON.stringify(notes));
}
{
  const notes = checkPointlessAliases(basePack, 'zz-ZZ');
  check('an alias distinct from canonical and rendering carries no note', notes.length === 0, JSON.stringify(notes));
}

// --- 12. application_mode guards L1-L5 (AES-V2.18 / SUE-610) ------------------
console.log('check 12: application_mode guards L1-L5');
{
  const issues = checkApplicationMode(basePack, 'zz-ZZ');
  check('the base fixture pack\'s application_mode values all pass L1-L5', issues.length === 0, JSON.stringify(issues));
}
// L1: hard_local_correction requires INTEGRITY/NORMATIVE/DOMAIN_TERMINOLOGY + mechanical, and a NORMATIVE rule needs authority_ref.
{
  const bad = clone(basePack);
  bad.rules[1].application_mode = 'hard_local_correction'; // native-quality-rule: NATIVE_QUALITY
  const issues = checkApplicationMode(bad, 'zz-ZZ');
  check('hard_local_correction on a NATIVE_QUALITY rule is rejected (wrong authority class)', hasCode(issues, CODES.L1_HARD_LOCAL_AUTHORITY), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[0].checkability = 'review_guidance'; // spacing-rule stays application_mode hard_local_correction
  const issues = checkApplicationMode(bad, 'zz-ZZ');
  check('hard_local_correction with checkability other than mechanical is rejected', hasCode(issues, CODES.L1_HARD_LOCAL_MECHANICAL), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[0].authority_ref = null; // spacing-rule: NORMATIVE + hard_local_correction
  const issues = checkApplicationMode(bad, 'zz-ZZ');
  check('a NORMATIVE hard_local_correction rule with no authority_ref is rejected', hasCode(issues, CODES.L1_NORMATIVE_HARD_LOCAL_NO_AUTHORITY_REF), JSON.stringify(issues));
}
// L2: empirical/preference authority classes may never be hard_local_correction.
{
  const bad = clone(basePack);
  bad.rules[3].application_mode = 'hard_local_correction'; // genre-rule: GENRE_CONVENTION
  const issues = checkApplicationMode(bad, 'zz-ZZ');
  check('hard_local_correction on a GENRE_CONVENTION rule is rejected', hasCode(issues, CODES.L2_EMPIRICAL_MAY_NOT_HARD_LOCAL), JSON.stringify(issues));
}
// L3: a rule whose layer is "audience" must be upstream_guidance or local_observation.
{
  const bad = clone(basePack);
  bad.rules[4].application_mode = 'soft_detector'; // audience-rule: layer audience
  const issues = checkApplicationMode(bad, 'zz-ZZ');
  check('a layer:"audience" rule with application_mode soft_detector is rejected — the child-case fix', hasCode(issues, CODES.L3_AUDIENCE_LAYER_MODE), JSON.stringify(issues));
}
{
  const bad = clone(basePack);
  bad.rules[4].application_mode = 'local_observation';
  const issues = checkApplicationMode(bad, 'zz-ZZ');
  check('a layer:"audience" rule may legally be local_observation', !hasCode(issues, CODES.L3_AUDIENCE_LAYER_MODE), JSON.stringify(issues));
}
// L4: deprecated_as_instruction requires non-empty notes.
{
  const bad = clone(basePack);
  bad.rules[2].application_mode = 'deprecated_as_instruction'; // shared-native-rule: no notes field
  const issues = checkApplicationMode(bad, 'zz-ZZ');
  check('deprecated_as_instruction with no notes is rejected', hasCode(issues, CODES.L4_DEPRECATED_NEEDS_NOTES), JSON.stringify(issues));
}
{
  const ok = clone(basePack);
  ok.rules[2].application_mode = 'deprecated_as_instruction';
  ok.rules[2].notes = 'Withdrawn: superseded by a corroborated shared rule; retained as a research record only.';
  const issues = checkApplicationMode(ok, 'zz-ZZ');
  check('deprecated_as_instruction WITH non-empty notes passes L4', !hasCode(issues, CODES.L4_DEPRECATED_NEEDS_NOTES), JSON.stringify(issues));
}
// L5: generality "source_local" may not be hard_local_correction.
{
  const bad = clone(basePack);
  bad.rules[1].application_mode = 'hard_local_correction'; // native-quality-rule: generality source_local
  const issues = checkApplicationMode(bad, 'zz-ZZ');
  check('hard_local_correction on a source_local rule is rejected', hasCode(issues, CODES.L5_SOURCE_LOCAL_MAY_NOT_HARD_LOCAL), JSON.stringify(issues));
}

// --- validateAll wiring smoke test ---------------------------------------------
console.log('validateAll (real axis directory — may legitimately be empty or in-progress)');
{
  const result = validateAll();
  check('validateAll returns the expected shape', Array.isArray(result.files) && Array.isArray(result.issues) && Array.isArray(result.notes) && typeof result.ruleCount === 'number', JSON.stringify(Object.keys(result)));
  console.log(`  (info) real language axis: ${result.files.length} pack(s), ${result.issues.length} issue(s), ${result.notes.length} note(s), ${result.ruleCount} rule(s)`);
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — ${failures} failing assertion(s)`);
process.exit(failures === 0 ? 0 : 1);
