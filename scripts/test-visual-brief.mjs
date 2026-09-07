#!/usr/bin/env node
/** Adversarial regressions for the SUE-642/643/644 VisualBrief contract. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, RegenerationSealedError, compileVisualPrompt, loadArtifactProfiles, resolveBrandProfile, validateRenderSpec, validateVisualBrief, validateVisualJob } from './lib/visual-job-core.mjs';
import { queryVisualReferenceEvaluations } from './lib/registry-core.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (file) => JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples', file), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const codes = (job, referenceContext) => validateVisualJob(job, { referenceContext }).map((i) => i.code);
let failures = 0;
const check = (name, ok, detail = '') => { if (ok) console.log(`  PASS  ${name}`); else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); } };
const setAuthority = (job, ref_id, evaluation_id, authority, rationale = 'craft evidence') => { job.render_spec.reference_authority.selected = [{ ref_id, evaluation_id, authority, not_authority: [], rationale }]; };

console.log('allow cases and provider boundary');
const hybrid = load('visual-job-body-infographic-v2.example.json');
check('hybrid VisualBrief/RenderSpec contract validates', validateVisualJob(hybrid).length === 0);
check('standalone VisualBrief example validates', validateVisualBrief(load('visual-brief-body-infographic-v2.example.json')).length === 0);
check('standalone RenderSpec example validates', validateRenderSpec(load('render-spec-body-infographic-hybrid-v2.example.json')).length === 0);
{
  const deterministic = load('visual-job-evidence-visual.example.json');
  const briefOnly = clone(deterministic);
  briefOnly.visual_brief = clone(load('visual-brief-body-infographic-v2.example.json'));
  check('structurally valid VisualBrief without RenderSpec is rejected by the pair-presence guard',
    codes(briefOnly).includes(CODES.BRIEF_REQUIRED));
  const specOnly = clone(deterministic);
  specOnly.render_spec = clone(load('render-spec-body-infographic-hybrid-v2.example.json'));
  check('structurally valid RenderSpec without VisualBrief is rejected by the pair-presence guard',
    codes(specOnly).includes(CODES.BRIEF_REQUIRED));
  check('legacy deterministic job with both visual fields absent remains valid',
    validateVisualJob(deterministic).length === 0);
}
{
  const v1 = load('visual-job-evidence-visual.example.json');
  const additiveFields = ['visual_brief', 'render_spec', 'compiled_prompt_adapter', 'brand_conflicts', 'requires_owner_gate', 'article_title'];
  check('verbatim pre-existing V1 job with no additive fields remains valid', v1.schema_version === '1.0.0' && additiveFields.every((field) => !(field in v1)) && validateVisualJob(v1).length === 0);
}
{
  const oneJob = clone(hybrid); const twoJob = clone(hybrid); const oneBefore = clone(oneJob); const twoBefore = clone(twoJob); const profiles = loadArtifactProfiles();
  const profileBefore = clone(profiles[hybrid.artifact_profile]); const brandBefore = clone(resolveBrandProfile(hybrid.brand_profile, hybrid.brand_profile_version));
  const one = compileVisualPrompt(oneJob, { profiles, promptAdapter: 'generic-v1' }); const two = compileVisualPrompt(twoJob, { profiles, promptAdapter: 'generic-v2' });
  check('two adapters materially reorder prompt grammar', one.compiled_prompt !== two.compiled_prompt && one.compiled_prompt.indexOf('ARTIFACT:') < one.compiled_prompt.indexOf('EDITORIAL BRIEF:') && two.compiled_prompt.indexOf('EDITORIAL BRIEF:') < two.compiled_prompt.indexOf('ARTIFACT:'));
  check('adapter compilation preserves actual VisualBrief clones', JSON.stringify(oneJob.visual_brief) === JSON.stringify(twoJob.visual_brief));
  check('adapter compilation preserves actual reference authority clones', JSON.stringify(oneJob.render_spec.reference_authority) === JSON.stringify(twoJob.render_spec.reference_authority));
  check('generic-v1 compilation leaves its input clone unchanged', JSON.stringify(oneJob) === JSON.stringify(oneBefore));
  check('generic-v2 compilation leaves its input clone unchanged', JSON.stringify(twoJob) === JSON.stringify(twoBefore));
  check('adapter compilation preserves resolved profile and brand', JSON.stringify(profiles[hybrid.artifact_profile]) === JSON.stringify(profileBefore) && JSON.stringify(resolveBrandProfile(hybrid.brand_profile, hybrid.brand_profile_version)) === JSON.stringify(brandBefore));
  check('compiled V2 prompt remains validator-clean', validateVisualJob({ ...clone(hybrid), ...one }).length === 0);
  const titleOnly = clone(hybrid); titleOnly.article_title = 'A different article title'; check('article_title is lineage only and does not alter compiled bytes', compileVisualPrompt(titleOnly, { profiles }).compiled_prompt === one.compiled_prompt);
}

console.log('\nB1 shared reference admissibility');
{
  const textPin = clone(hybrid); setAuthority(textPin, 'ref:ap-ai-newsroom-standards', 'eval:ap-ai-newsroom-standards-2026-09-05-01', ['argument-structure']); check('reviewer text-evaluation pin now fails modality admissibility', codes(textPin).includes(CODES.REFERENCE_AUTHORITY_INADMISSIBLE));
  const inapplicable = clone(hybrid); setAuthority(inapplicable, 'ref:ft-visual-vocabulary', 'eval:ft-visual-vocabulary-2026-09-06-01', ['hierarchy']); check('visual but inapplicable artifact-profile pin fails', codes(inapplicable).includes(CODES.REFERENCE_AUTHORITY_INADMISSIBLE));
  const unevidenced = clone(hybrid); setAuthority(unevidenced, 'ref:c4-model-containment', 'eval:c4-model-containment-2026-09-06-01', ['composition']); check('trait absent from that evaluation adopt dimensions fails', codes(unevidenced).includes(CODES.REFERENCE_AUTHORITY_TRAIT_UNEVIDENCED));
  const irrelevant = clone(hybrid); setAuthority(irrelevant, 'ref:risk-matrix-comprehension', 'eval:risk-matrix-comprehension-2026-09-06-01', ['label-text-strategy']); check('reviewer risk-matrix label-text pin against hierarchy brief fails relevance', codes(irrelevant).includes(CODES.REFERENCE_AUTHORITY_TRAIT_IRRELEVANT));
  const emptyDimensions = clone(irrelevant); emptyDimensions.visual_brief.reference_requirements.required_dimensions = []; check('reviewer empty required_dimensions authority bypass is rejected', codes(emptyDimensions).includes(CODES.BRIEF_REFERENCE_DIMENSIONS_REQUIRED));
  const fabricatedNotAuthority = clone(hybrid);
  fabricatedNotAuthority.render_spec.reference_authority.selected[0].not_authority = ['fabricated-dimension'];
  check('reference not_authority must resolve to that evaluation\'s do_not_copy dimensions',
    codes(fabricatedNotAuthority).includes(CODES.REFERENCE_AUTHORITY_NOT_AUTHORITY_UNEVIDENCED));
  const emptyAuthority = clone(hybrid);
  emptyAuthority.render_spec.reference_authority.selected[0].authority = [];
  check('selected reference authority must contain at least one trait',
    codes(emptyAuthority).includes(CODES.REFERENCE_AUTHORITY_TRAIT_REQUIRED) || codes(emptyAuthority).includes(CODES.SCHEMA));
}

console.log('\nB2 structural depth and hard materiality ceiling');
{
  const cinematic = clone(hybrid); cinematic.render_spec.visual_devices.push('cinematic 3D lighting and three-dimensional scene'); check('reviewer cinematic 3D string is rejected from brand file', codes(cinematic).includes(CODES.BRAND_MATERIALITY_CEILING_VIOLATION));
  const storyCinematic = clone(hybrid); storyCinematic.visual_brief.visual_story.metaphor_or_relationship = 'cinematic 3D lighting and three-dimensional scene'; check('prompt-bound visual story cinematic fragment is rejected', codes(storyCinematic).includes(CODES.BRAND_MATERIALITY_CEILING_VIOLATION));
  const semanticCinematic = clone(hybrid); semanticCinematic.semantic_spec.must_communicate.push('cinematic 3D lighting and three-dimensional scene'); check('prompt-bound semantic_spec cinematic fragment is rejected', codes(semanticCinematic).includes(CODES.BRAND_MATERIALITY_CEILING_VIOLATION));
  const dropShadow = clone(hybrid); dropShadow.render_spec.visual_devices.push('drop shadow'); check('profile-vocabulary singular drop shadow is rejected', codes(dropShadow).includes(CODES.BRAND_MATERIALITY_CEILING_VIOLATION));
  for (const fragment of ['유리 같은 반짝이는 하이라이트와 영화 같은 조명', 'raytraced material rendering']) { const job = clone(hybrid); job.render_spec.visual_devices.push(fragment); let compiles = true; try { compileVisualPrompt(job); } catch { compiles = false; } check(`documented lexical limitation remains unclassified and compilable: ${fragment}`, !codes(job).includes(CODES.BRAND_MATERIALITY_CEILING_VIOLATION) && compiles); }
  const invalidMateriality = clone(hybrid); invalidMateriality.render_spec.materiality_treatment = 'cinematic_3d'; check('materiality declaration cannot express cinematic 3D', codes(invalidMateriality).includes(CODES.SCHEMA));
  const brand = resolveBrandProfile('suengj-com', '1.0.0');
  const ceilingTerms = brand.line_and_materiality.materiality_ceiling.replace(/^never\s+/i, '').split(/,|\s+or\s+/).map((x) => x.trim()).filter(Boolean);
  for (const prohibited of [...brand.palette.prohibited, ...ceilingTerms]) { const job = clone(hybrid); job.render_spec.visual_devices.push(prohibited); check(`brand prohibition rejected: ${prohibited}`, codes(job).includes(CODES.BRAND_MATERIALITY_CEILING_VIOLATION)); }
  const shallow = clone(hybrid); delete shallow.visual_production; shallow.visual_brief.reference_requirements.required_dimensions.push('shallow_depth'); shallow.render_spec.spatial_treatment = 'shallow_depth'; setAuthority(shallow, 'ref:c4-model-containment', 'eval:c4-model-containment-2026-09-06-01', ['hierarchy', 'shallow_depth']); shallow.brand_conflicts = [{ brand_field: 'line_and_materiality.depth_model', brand_profile_version: '1.0.0', render_spec_requirement: 'shallow_depth', reference_authority: 'shallow_depth', owner_review: 'pending_owner_review' }]; shallow.requires_owner_gate = true;
  const c4 = JSON.parse(readFileSync(resolve(ROOT, 'references/evaluations/c4-model-containment/c4-model-containment-2026-09-06-01.json'), 'utf8')); c4.dimensions.push({ dimension: 'shallow_depth', verdict: 'adopt' }); const context = { catalogRefIds: new Set(['ref:c4-model-containment']), evaluations: new Map([[c4.evaluation_id, c4]]) };
  check('backed shallow_depth override with recorded conflict passes', codes(shallow, context).length === 0); shallow.render_spec.reference_authority.selected[0].authority = ['hierarchy']; check('same shallow_depth override without backing fails', codes(shallow, context).includes(CODES.BRAND_DEPTH_OVERRIDE_UNBACKED));
  const missingOwnerReview = clone(shallow); missingOwnerReview.render_spec.reference_authority.selected[0].authority = ['hierarchy', 'shallow_depth']; delete missingOwnerReview.brand_conflicts[0].owner_review; check('brand conflict missing owner_review is rejected', codes(missingOwnerReview, context).includes(CODES.SCHEMA));
  const claimedOwnerReview = clone(shallow); claimedOwnerReview.render_spec.reference_authority.selected[0].authority = ['hierarchy', 'shallow_depth']; claimedOwnerReview.brand_conflicts[0].owner_review = 'approved'; check('brand conflict cannot express a machine owner verdict', codes(claimedOwnerReview, context).includes(CODES.SCHEMA));
  const conflictGateFalse = clone(shallow); conflictGateFalse.render_spec.reference_authority.selected[0].authority = ['hierarchy', 'shallow_depth']; conflictGateFalse.requires_owner_gate = false; check('recorded conflict with requires_owner_gate false is rejected', codes(conflictGateFalse, context).includes(CODES.REQUIRES_OWNER_GATE_MISMATCH));
  const conflictGateAbsent = clone(shallow); conflictGateAbsent.render_spec.reference_authority.selected[0].authority = ['hierarchy', 'shallow_depth']; delete conflictGateAbsent.requires_owner_gate; check('recorded conflict with requires_owner_gate absent is rejected', codes(conflictGateAbsent, context).includes(CODES.REQUIRES_OWNER_GATE_MISMATCH));
  const noConflictGateTrue = clone(hybrid); noConflictGateTrue.requires_owner_gate = true; check('no conflict with requires_owner_gate true is rejected', codes(noConflictGateTrue).includes(CODES.REQUIRES_OWNER_GATE_MISMATCH));
}

console.log('\nB3 title lineage absence');
{
  const attack = 'THE LOCKED ARTICLE TITLE: Quiet Authority';
  for (const [field, mutate] of [['editorial_purpose', (j) => { j.visual_brief.editorial_purpose = attack; }], ['article_thesis', (j) => { j.visual_brief.article_thesis = attack; }], ['reference rationale', (j) => { j.render_spec.reference_authority.selected[0].rationale = attack; }]]) { const job = clone(hybrid); job.article_title = attack; mutate(job); check(`reviewer title injection via ${field} fails dedicated code`, codes(job).includes(CODES.ARTICLE_TITLE_IN_ARTWORK)); }
  const punctuation = clone(hybrid); punctuation.article_title = attack; punctuation.visual_brief.editorial_purpose = 'THE LOCKED ARTICLE TITLE — Quiet Authority'; check('colon versus em dash title evasion is rejected', codes(punctuation).includes(CODES.ARTICLE_TITLE_IN_ARTWORK));
  const split = clone(hybrid); split.article_title = 'Quiet Authority'; split.visual_brief.editorial_purpose = 'Quiet'; split.visual_brief.article_thesis = 'Authority'; check('title split across compiled prompt fields is rejected', codes(split).includes(CODES.ARTICLE_TITLE_IN_ARTWORK));
  for (const variant of ['Quiet\u00ad Authority', 'Quiet\u200b Authority', 'Quiet\u2060Authority', 'Quiet\u0000Authority']) { const job = clone(hybrid); job.article_title = 'Quiet Authority'; job.visual_brief.editorial_purpose = variant; check(`recognisable invisible-separator title inclusion is rejected: ${variant}`, codes(job).includes(CODES.ARTICLE_TITLE_IN_ARTWORK)); }
  const different = clone(hybrid); different.article_title = 'Quiet Authority'; different.visual_brief.editorial_purpose = 'Quiet and Authority'; check('legitimately different phrase is not a title false positive', !codes(different).includes(CODES.ARTICLE_TITLE_IN_ARTWORK));
  const microScale = clone(hybrid); microScale.visual_brief.editorial_purpose = '5 μm scale bar'; check('5 μm scale bar validates cleanly', codes(microScale).length === 0);
  const alphaSyn = clone(hybrid); alphaSyn.visual_brief.editorial_purpose = 'αSyn aggregation'; check('αSyn aggregation validates cleanly', codes(alphaSyn).length === 0);
  const Korean = clone(hybrid); Korean.visual_brief.editorial_purpose = '한국어 독자를 위한 Context Engineering과 RAG 설명.'; Korean.visual_brief.article_thesis = 'Context Engineering과 RAG를 함께 설명한다.'; check('Korean brief with Context Engineering and RAG validates cleanly', codes(Korean).length === 0);
  const quietAnalysis = clone(hybrid); quietAnalysis.article_title = 'Quiet Authority'; quietAnalysis.visual_brief.editorial_purpose = 'Quiet analysis establishes responsible authority.'; check('Quiet analysis establishes responsible authority is not a title false positive', !codes(quietAnalysis).includes(CODES.ARTICLE_TITLE_IN_ARTWORK));
}

{
  const joinedBrandTerm = clone(hybrid); joinedBrandTerm.render_spec.visual_devices.push('cinematic\u20603D lighting'); check('word joiner brand-ceiling evasion is rejected by dual normalization', codes(joinedBrandTerm).includes(CODES.BRAND_MATERIALITY_CEILING_VIOLATION));
}

console.log('\nM1/M2 resolver ranking and attribution');
{
  const temp = mkdtempSync(resolve(tmpdir(), 'visual-ref-regression-')); const record = (id, dimensions) => ({ evaluation_id: id, ref_id: `ref:${id.slice(5)}`, modality: 'visual', applicable_to: { artifacts: ['visual/body-infographic'] }, dimensions }); const records = [record('eval:a-one', [{ dimension: 'hierarchy', verdict: 'adopt' }]), record('eval:b-two', [{ dimension: 'hierarchy', verdict: 'adopt' }]), record('eval:c-three', [{ dimension: 'hierarchy', verdict: 'adopt' }]), record('eval:z-double', [{ dimension: 'hierarchy', verdict: 'adopt' }, { dimension: 'composition', verdict: 'adopt' }])]; records.forEach((r, i) => writeFileSync(resolve(temp, `${i}.json`), JSON.stringify(r)));
  const ranked = queryVisualReferenceEvaluations({ artifact_profile: 'visual/body-infographic', required_dimensions: ['hierarchy', 'composition'] }, { catalogRefIds: new Set(records.map((r) => r.ref_id)), evaluationsDir: temp }); check('double-match candidate outranks three alphabetically earlier single matches', ranked[0]?.evaluation_id === 'eval:z-double' && /2 required dimension match/.test(ranked[0]?.rationale)); rmSync(temp, { recursive: true, force: true });
  const selected = queryVisualReferenceEvaluations({ ...hybrid.visual_brief.reference_requirements, artifact_profile: hybrid.artifact_profile }); check('per-reference not_authority is not polluted by brief-wide prohibition', selected.every((candidate) => !candidate.not_authority.includes('literal C4 notation')));
}

console.log('\nM4 direct negative guards and isolation');
{
  const lineage = clone(hybrid);
  lineage.visual_brief.article_ref.version_number = 999;
  lineage.visual_brief.article_ref.content_hash = 'c'.repeat(64);
  lineage.visual_brief.article_ref.claims_hash = 'd'.repeat(64);
  check('VisualBrief article version and hashes must match the job article_ref',
    codes(lineage).includes(CODES.BRIEF_SPEC_MISMATCH));
  const mismatch = clone(hybrid); mismatch.render_spec.brief_id = 'visual-brief:wrong'; check('BRIEF_SPEC_MISMATCH has direct negative', codes(mismatch).includes(CODES.BRIEF_SPEC_MISMATCH));
  const noBrief = clone(hybrid); delete noBrief.visual_brief; delete noBrief.render_spec; check('BRIEF_REQUIRED has direct negative', codes(noBrief).includes(CODES.BRIEF_REQUIRED));
  const count = clone(hybrid); count.render_spec.reference_authority.selected = []; check('REFERENCE_AUTHORITY_COUNT has direct negative', codes(count).includes(CODES.REFERENCE_AUTHORITY_COUNT));
  const factualRef = clone(hybrid); factualRef.render_spec.reference_authority.selected[0].rationale = 'This is a verified fact source.'; check('REFERENCE_IS_FACTUAL_SOURCE has direct negative', codes(factualRef).includes(CODES.REFERENCE_IS_FACTUAL_SOURCE));
  const exact = clone(hybrid); exact.render_spec.spatial_layers.deterministic_factual = []; check('EXACT_FACT_ON_GENERATIVE_LAYER has direct negative', codes(exact).includes(CODES.EXACT_FACT_ON_GENERATIVE_LAYER));
  const arbitrary = clone(hybrid); arbitrary.render_spec.reference_authority.selected.push({ ref_id: 'ref:arbitrary-image', evaluation_id: 'eval:arbitrary-image', authority: ['hierarchy'], not_authority: [], rationale: '/tmp/recent-image.png' }); check('actual arbitrary image insertion is rejected as unresolved', codes(arbitrary).includes(CODES.REFERENCE_AUTHORITY_UNRESOLVED));
  const leaky = clone(hybrid); leaky.context_isolation.permitted_inputs.push('ambient_conversation'); check('context isolation enum still rejects ambient context as permitted input', codes(leaky).includes(CODES.SCHEMA));
  const missingUiForbid = clone(hybrid); missingUiForbid.render_spec.forbidden_visual_devices = ['ui_mimicry']; check('UI_MIMICRY_CONTRACT_MISSING has direct negative', codes(missingUiForbid).includes(CODES.UI_MIMICRY_CONTRACT_MISSING));
  const forgedCompilation = clone(hybrid);
  forgedCompilation.compiled_prompt = '';
  forgedCompilation.compiled_from = ['bogus'];
  forgedCompilation.compiled_prompt_adapter = 'unregistered-adapter';
  check('compiled prompt, lineage, and adapter cannot be fabricated on a V2 job',
    codes(forgedCompilation).length > 0);
  const supportedButStale = clone(hybrid);
  const compiled = compileVisualPrompt(clone(hybrid), { promptAdapter: 'generic-v1' });
  supportedButStale.compiled_prompt = `${compiled.compiled_prompt}\nextra`;
  supportedButStale.compiled_from = compiled.compiled_from;
  supportedButStale.compiled_prompt_adapter = 'generic-v1';
  check('a supported adapter still requires exact deterministic compiled output',
    codes(supportedButStale).includes(CODES.COMPILED_OUTPUT_MISMATCH));
}

console.log('\napproval lock additive regression');
{
  const locked = load('visual-job-approved-concept-change.example.json'); locked.revision.regeneration_allowed = false; let refused = false; try { compileVisualPrompt(locked, { profiles: loadArtifactProfiles() }); } catch (err) { refused = err instanceof RegenerationSealedError; } check('locked master cannot reopen through VisualBrief/RenderSpec path', refused);
}
console.log(failures === 0 ? '\nvisual brief regression: PASS' : `\nvisual brief regression: FAIL (${failures})`);
process.exit(failures ? 1 : 0);
