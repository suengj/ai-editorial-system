#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'; import { createHash } from 'node:crypto'; import { spawnSync } from 'node:child_process'; import { relative, resolve } from 'node:path'; import { tmpdir } from 'node:os';
import { canonicalPayloadSha256, compileVisualPrompt, validateVisualJob } from './lib/visual-job-core.mjs';
import { REVIEW_CODES, VISUAL_FAILURE_ACTIONS, expectedVisualReviewRoute, materializeVisualSemanticNegativeReview, validateVisualFixture, validateVisualReview } from './lib/visual-review-core.mjs';
import { validateObservedTextAgainstJob } from './lib/visual-review-invariants.mjs';
const root=resolve(new URL('..',import.meta.url).pathname), read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8')); let bad=0; const ok=(n,v,detail='')=>{console.log(`${v?'PASS':'FAIL'} ${n}${!v&&detail?' — '+detail:''}`);if(!v)bad++};
const dims=['thesis_clarity','reading_path','narrative_composition','editorial_authorship','spatial_richness','information_hierarchy','article_fit','reference_adherence','brand_compatibility','factual_text_integrity','mobile_crop_resilience'].map(d=>({dimension:d,verdict:'pass',evidence:'observed pixel region'}));
const mobileAssetRef='evals/prototypes/sue629/plate-b-comparison.svg'; const mobileAssetSha256=`sha256:${createHash('sha256').update(readFileSync(resolve(root,mobileAssetRef))).digest('hex')}`;
const good={schema_version:'1.0.0',review_id:'visual-review:mobile',asset_ref:'evals/prototypes/sue629/plate-a-mechanism.svg',asset_sha256:'sha256:b2d2e0144f2e73703b3b34799d61253b68b0a30331400aacdce1355c45803894',mobile_asset_ref:mobileAssetRef,mobile_asset_sha256:mobileAssetSha256,review_mode:'mobile_downscaled',dimensions:dims,verdict:'REROUTE',defect_tags:['dashboardization'],primary_tag:'dashboardization',failure_class:'dashboardization',next_action:'reroute_composition_renderer',feedback_ref:'feedback:visual-review-sue629-a',final_authority:'human'};
ok('mobile review record validates',validateVisualReview(good).length===0); for(const x of ['HUMAN_APPROVED_LOCKED','APPROVED_MASTER','approved']){const j={...good,verdict:x};ok(`approval-shaped verdict rejected ${x}`,validateVisualReview(j).some(i=>i.code===REVIEW_CODES.SCHEMA));}
{
  const feedbackScope = mkdtempSync(resolve(tmpdir(), 'visual-review-v217-feedback-'));
  const feedback = JSON.parse(readFileSync(resolve(root, 'feedback/records/visual-review-sue629-a.json'), 'utf8'));
  feedback.feedback_id = 'feedback:v217-post-render';
  feedback.routing.abstained = true;
  writeFileSync(resolve(feedbackScope, 'v217-post-render.json'), JSON.stringify(feedback));
  const postRender = {
    asset_sha256: good.asset_sha256,
    mobile_asset_sha256: good.mobile_asset_sha256,
    actual_display_geometry: {
      desktop: { surface_id: 'surface:body-desktop', asset_scope: 'full', asset_sha256: good.asset_sha256, observed: true, article_body_width_css_px: 672, viewport_width_css_px: 1280 },
      mobile: { surface_id: 'surface:body-mobile', asset_scope: 'mobile', asset_sha256: good.mobile_asset_sha256, observed: true, viewport_width_css_px: 390, article_body_width_css_px: 390, derivative_of_surface_id: 'surface:body-desktop', derivative_of_asset_sha256: good.asset_sha256, crop_anchor: 'anchor:primary-gate-path', anchor_observed: true },
    },
    checks: [
      { check: 'textual', asset_scope: 'full', asset_sha256: good.asset_sha256, verdict: 'pass', observed: true, display_surface: 'desktop_actual_display', evidence: 'title remains outside the rendered pixels' },
      { check: 'factual', asset_scope: 'full', asset_sha256: good.asset_sha256, verdict: 'pass', observed: true, display_surface: 'desktop_actual_display', observed_text_items: [{ source_ref: 'article-claim:art:tokenized-stocks-instant-payments-liquidity-rights:liquidity-window', declared_text: 'exact causal labels', observed_text: 'exact causal labels' }], evidence: 'deterministic labels match the overlay source' },
      { check: 'readability', asset_scope: 'full', asset_sha256: good.asset_sha256, verdict: 'pass', observed: true, display_surface: 'desktop_actual_display', evidence: 'text is legible at target size' },
      { check: 'mobile', asset_scope: 'mobile', asset_sha256: good.mobile_asset_sha256, verdict: 'pass', observed: true, display_surface: 'mobile_actual_display', mobile_legibility: { detail_role: 'secondary_detail', load_bearing: true, legible_at_display_size: false, detail_access_path: 'expand', first_read: { topic: true, dominant_relation: true, major_module_boundaries: true, main_conclusion: true } }, evidence: 'primary reading path survives mobile crop; verified secondary detail is available by expand' },
    ],
    repair_routing: { textual: 'KEEP', factual: 'KEEP', readability: 'KEEP', mobile: 'KEEP' },
  };
  const clean = { ...good, verdict: 'PASS_TO_HUMAN_REVIEW', defect_tags: [], primary_tag: null, failure_class: null, next_action: 'human_judgement', feedback_ref: feedback.feedback_id, post_render_checks: postRender };
  // The existing review validator still owns feedback resolution; this scope
  // only changes its subject/id so the post-render assertion is isolated.
  const reviewOptions = { feedbackDir: feedbackScope };
  ok('digest-bound post-render checks use the existing visual review record', validateVisualReview(clean, reviewOptions).length === 0, JSON.stringify(validateVisualReview(clean, reviewOptions)));
  ok('post-render digest mutation is rejected', validateVisualReview({ ...clean, post_render_checks: { ...postRender, asset_sha256: 'sha256:' + 'a'.repeat(64) } }, reviewOptions).some(i => i.code === REVIEW_CODES.POST_RENDER_DIGEST));
  const bad = JSON.parse(JSON.stringify(postRender));
  bad.checks[1].verdict = 'fail'; bad.repair_routing.factual = 'KEEP';
  const failed = { ...good, verdict: 'REROUTE', defect_tags: ['dense_text'], primary_tag: 'dense_text', failure_class: 'facts_or_text_wrong', next_action: 'factual_overlay_repair', feedback_ref: feedback.feedback_id, post_render_checks: bad };
  ok('failed factual/text check requires CHANGE routing', validateVisualReview(failed, reviewOptions).some(i => i.code === REVIEW_CODES.POST_RENDER_ROUTE));
  bad.repair_routing.factual = 'CHANGE';
  ok('failed factual/text check routes through the existing repair action', validateVisualReview(failed, reviewOptions).length === 0);
  const allAbstain = JSON.parse(JSON.stringify(postRender));
  for (const check of allAbstain.checks) { check.verdict = 'abstain'; }
  allAbstain.repair_routing = { textual: 'DO_NOT_CHANGE', factual: 'DO_NOT_CHANGE', readability: 'DO_NOT_CHANGE', mobile: 'DO_NOT_CHANGE' };
  ok('all-abstain post-render evidence cannot pass to human review', validateVisualReview({ ...clean, post_render_checks: allAbstain }, reviewOptions).some(i => i.code === REVIEW_CODES.POST_RENDER_ROUTE));
  const mobileOnFull = JSON.parse(JSON.stringify(postRender));
  mobileOnFull.checks[3].asset_scope = 'full';
  mobileOnFull.checks[3].asset_sha256 = good.asset_sha256;
  mobileOnFull.checks[3].display_surface = 'desktop_actual_display';
  ok('mobile check bound to full asset is rejected', validateVisualReview({ ...clean, post_render_checks: mobileOnFull }, reviewOptions).some(i => i.code === REVIEW_CODES.POST_RENDER_SCOPE));
  const wrongDesktopGeometry = JSON.parse(JSON.stringify(postRender));
  wrongDesktopGeometry.actual_display_geometry.desktop.article_body_width_css_px = 671;
  ok('wrong 672 CSS px desktop geometry is rejected', validateVisualReview({ ...clean, post_render_checks: wrongDesktopGeometry }, reviewOptions).some(i => i.code === REVIEW_CODES.SCHEMA));
  const missingDesktopGeometry = JSON.parse(JSON.stringify(postRender));
  delete missingDesktopGeometry.actual_display_geometry.desktop.article_body_width_css_px;
  ok('missing 672 CSS px desktop geometry is rejected', validateVisualReview({ ...clean, post_render_checks: missingDesktopGeometry }, reviewOptions).some(i => i.code === REVIEW_CODES.SCHEMA));
  const mobileAnchorLost = JSON.parse(JSON.stringify(postRender));
  mobileAnchorLost.actual_display_geometry.mobile.anchor_observed = false;
  ok('mobile crop losing the declared anchor is rejected', validateVisualReview({ ...clean, post_render_checks: mobileAnchorLost }, reviewOptions).some(i => i.code === REVIEW_CODES.POST_RENDER_GEOMETRY));
  ok('verified secondary mobile detail may use progressive disclosure when first-read structure survives',
    !validateVisualReview(clean, reviewOptions).some(i => i.code === REVIEW_CODES.UNREADABLE_DISPLAY_SIZE));
  const missingMobileEvidence = JSON.parse(JSON.stringify(postRender));
  delete missingMobileEvidence.checks.find((check) => check.check === 'mobile').mobile_legibility;
  ok(`missing mobile evidence fails ${REVIEW_CODES.MOBILE_LEGIBILITY_REQUIRED}`,
    validateVisualReview({ ...clean, post_render_checks: missingMobileEvidence }, reviewOptions).some(i => i.code === REVIEW_CODES.MOBILE_LEGIBILITY_REQUIRED));
  const unreadableLoadBearing = JSON.parse(JSON.stringify(postRender));
  unreadableLoadBearing.checks.find((check) => check.check === 'mobile').mobile_legibility.detail_access_path = 'none';
  ok('unreadable load-bearing mobile detail without full-size/open/expand path fails',
    validateVisualReview({ ...clean, post_render_checks: unreadableLoadBearing }, reviewOptions).some(i => i.code === REVIEW_CODES.UNREADABLE_DISPLAY_SIZE));
  const lostConclusion = JSON.parse(JSON.stringify(postRender));
  lostConclusion.checks.find((check) => check.check === 'mobile').mobile_legibility.first_read.main_conclusion = false;
  ok('mobile PASS requires topic, dominant relation, major boundaries, and main conclusion at first read',
    validateVisualReview({ ...clean, post_render_checks: lostConclusion }, reviewOptions).some(i => i.code === REVIEW_CODES.UNREADABLE_DISPLAY_SIZE));
  const firstReadHidden = JSON.parse(JSON.stringify(postRender));
  const firstReadEvidence = firstReadHidden.checks.find((check) => check.check === 'mobile').mobile_legibility;
  firstReadEvidence.detail_role = 'first_read_structure';
  firstReadEvidence.detail_access_path = 'expand';
  ok(`first-read structure cannot be deferred behind expand: ${REVIEW_CODES.UNREADABLE_DISPLAY_SIZE}`,
    validateVisualReview({ ...clean, post_render_checks: firstReadHidden }, reviewOptions).some(i => i.code === REVIEW_CODES.UNREADABLE_DISPLAY_SIZE));
  const verifiedJob = read('schemas/examples/visual-job-body-infographic-v2.example.json');
  const verifiedFact = { exact_text: 'exact causal labels', source_ref: 'article-claim:art:tokenized-stocks-instant-payments-liquidity-rights:liquidity-window' };
  const claimSet = { article_id: verifiedJob.article_ref.article_id, claims_hash: verifiedJob.article_ref.claims_hash, claim_ids: ['liquidity-window'] };
  const verifiedPayload = { payload_ref: 'payload:liquidity-labels', items: [verifiedFact] };
  verifiedJob.visual_brief.text_ownership = {
    article_title: 'deterministic_external_text',
    generative_structural_text: { items: ['closed gate'] },
    verified_generative_fact: {
      canonical_payload: { ...verifiedPayload, payload_sha256: canonicalPayloadSha256({ ...verifiedPayload, claim_set: claimSet }) },
      source_lineage: [verifiedFact.source_ref],
      claim_set: claimSet,
      post_render_verification: { required: true, review_dimension: 'factual', asset_digest_bound: true },
    },
    deterministic_external_text: { items: [], includes: ['citations', 'dense_text', 'sensitive_text'] },
  };
  verifiedJob.render_spec.text_handling.text_ownership = JSON.parse(JSON.stringify(verifiedJob.visual_brief.text_ownership));
  const authoritativeJobRef = 'schemas/examples/visual-job-body-infographic-v2.example.json';
  const authoritativeJobSha256 = `sha256:${createHash('sha256').update(readFileSync(resolve(root, authoritativeJobRef))).digest('hex')}`;
  const authoritativeRenderSpecSha256 = canonicalPayloadSha256(verifiedJob.render_spec);
  const bound = { ...clean, review_scope: 'verified_generative_fact',
    verified_fact_binding: { job_id: verifiedJob.job_id, job_ref: authoritativeJobRef, job_sha256: authoritativeJobSha256, render_spec_id: verifiedJob.render_spec.render_spec_id, render_spec_sha256: authoritativeRenderSpecSha256, payload_ref: verifiedPayload.payload_ref, payload_sha256: canonicalPayloadSha256({ ...verifiedPayload, claim_set: claimSet }), asset_sha256: clean.asset_sha256, required_check: 'factual' } };
  ok('verified-fact review has a durable default-validator owner-consumer binding', validateVisualReview(bound, reviewOptions).length === 0, JSON.stringify(validateVisualReview(bound, reviewOptions)));
  ok('verified-fact review binding cross-checks the supplied owner when available', validateVisualReview(bound, { ...reviewOptions, job: verifiedJob }).length === 0, JSON.stringify(validateVisualReview(bound, { ...reviewOptions, job: verifiedJob })));
  const repeatedSourceScope = mkdtempSync(resolve(root, '.visual-review-r2-repeated-source-'));
  try {
    const repeatedSourceJob = JSON.parse(JSON.stringify(verifiedJob));
    const repeatedItems = [
      { exact_text: '41.4%', source_ref: verifiedFact.source_ref },
      { exact_text: '18.1%', source_ref: verifiedFact.source_ref },
    ];
    const repeatedPayload = { payload_ref: 'payload:two-values-one-source', items: repeatedItems };
    const repeatedPayloadSha256 = canonicalPayloadSha256({ ...repeatedPayload, claim_set: claimSet });
    for (const owner of [repeatedSourceJob.visual_brief.text_ownership, repeatedSourceJob.render_spec.text_handling.text_ownership]) {
      owner.verified_generative_fact.canonical_payload = { ...repeatedPayload, payload_sha256: repeatedPayloadSha256 };
      owner.verified_generative_fact.source_lineage = [verifiedFact.source_ref];
    }
    repeatedSourceJob.visual_brief.factual_invariants = repeatedItems.map((item) => item.exact_text);
    repeatedSourceJob.render_spec.spatial_layers.deterministic_factual = repeatedItems.map((item) => item.exact_text);
    repeatedSourceJob.render_spec.text_handling.deterministic_overlay = repeatedItems.map((item) => item.exact_text);
    repeatedSourceJob.visual_production.factual_overlay.payload.items = repeatedItems.map((item, index) => ({
      item_id: `overlay-item:repeated-source-${index + 1}`,
      kind: 'number',
      exact_text: item.exact_text,
      source_ref: item.source_ref,
      accessible_text: item.exact_text,
    }));
    repeatedSourceJob.visual_production.factual_overlay.declared_factual_invariants = repeatedItems.map((item) => item.exact_text);
    repeatedSourceJob.visual_production.factual_overlay.payload_sha256 = canonicalPayloadSha256(repeatedSourceJob.visual_production.factual_overlay.payload);
    Object.assign(repeatedSourceJob, compileVisualPrompt(repeatedSourceJob));
    const repeatedJobPath = resolve(repeatedSourceScope, 'authoritative-job.json');
    writeFileSync(repeatedJobPath, JSON.stringify(repeatedSourceJob));
    ok('round-2 two-items-one-source authoritative job is validator-clean', validateVisualJob(repeatedSourceJob).length === 0,
      JSON.stringify(validateVisualJob(repeatedSourceJob)));
    const repeatedBinding = {
      ...bound.verified_fact_binding,
      job_ref: relative(root, repeatedJobPath),
      job_sha256: `sha256:${createHash('sha256').update(readFileSync(repeatedJobPath)).digest('hex')}`,
      render_spec_sha256: canonicalPayloadSha256(repeatedSourceJob.render_spec),
      payload_ref: repeatedPayload.payload_ref,
      payload_sha256: repeatedPayloadSha256,
    };
    const repeatedPass = JSON.parse(JSON.stringify({ ...bound, verified_fact_binding: repeatedBinding }));
    repeatedPass.post_render_checks.checks.find((check) => check.check === 'factual').observed_text_items = repeatedItems.map((item) => ({
      source_ref: item.source_ref,
      declared_text: item.exact_text,
      observed_text: item.exact_text,
    }));
    ok('R3 payload-accounting baseline reaches PASS_TO_HUMAN_REVIEW only with exact raw source/text occurrences',
      validateVisualReview(repeatedPass, reviewOptions).length === 0,
      JSON.stringify(validateVisualReview(repeatedPass, reviewOptions)));

    const identicalJob = JSON.parse(JSON.stringify(repeatedSourceJob));
    const identical = { exact_text: '41.4%', source_ref: verifiedFact.source_ref };
    identicalJob.visual_brief.text_ownership.verified_generative_fact.canonical_payload.items = [identical, identical];
    const identicalReview = JSON.parse(JSON.stringify(repeatedPass));
    identicalReview.post_render_checks.checks.find((check) => check.check === 'factual').observed_text_items = [
      { source_ref: identical.source_ref, declared_text: identical.exact_text, observed_text: identical.exact_text },
    ];
    ok(`R3 two identical texts under one source preserve occurrence count via ${REVIEW_CODES.OBSERVED_TEXT_REQUIRED}`,
      validateObservedTextAgainstJob(identicalReview, identicalJob).some((entry) => entry.code === REVIEW_CODES.OBSERVED_TEXT_REQUIRED));

    const omittedItem = JSON.parse(JSON.stringify(repeatedPass));
    omittedItem.post_render_checks.checks.find((check) => check.check === 'factual').observed_text_items = [
      { source_ref: verifiedFact.source_ref, declared_text: '18.1%', observed_text: '18.1%' },
    ];
    ok('round-2 reviewer bypass: PASS cannot omit one of two declared items sharing a source',
      validateVisualReview(omittedItem, reviewOptions).some((entry) => entry.code === REVIEW_CODES.OBSERVED_TEXT_REQUIRED),
      JSON.stringify(validateVisualReview(omittedItem, reviewOptions)));
    const duplicatedItem = JSON.parse(JSON.stringify(omittedItem));
    duplicatedItem.post_render_checks.checks.find((check) => check.check === 'factual').observed_text_items = [
      { source_ref: verifiedFact.source_ref, declared_text: '41.4%', observed_text: '41.4%' },
      { source_ref: verifiedFact.source_ref, declared_text: '18.1%', observed_text: '18.1%' },
      { source_ref: verifiedFact.source_ref, declared_text: '18.1%', observed_text: '18.1%' },
    ];
    ok('round-2 duplicated observed payload item is rejected per item rather than per source',
      validateVisualReview(duplicatedItem, reviewOptions).some((entry) => entry.code === REVIEW_CODES.OBSERVED_TEXT_BINDING),
      JSON.stringify(validateVisualReview(duplicatedItem, reviewOptions)));

    const qualifierDifference = JSON.parse(JSON.stringify(repeatedPass));
    qualifierDifference.post_render_checks.checks.find((check) => check.check === 'factual').observed_text_items[0].declared_text = '41.4% after qualification';
    ok(`R3 qualifier-only declared-text substitution cannot reach PASS_TO_HUMAN_REVIEW: ${REVIEW_CODES.OBSERVED_TEXT_BINDING}`,
      validateVisualReview(qualifierDifference, reviewOptions).some((entry) => entry.code === REVIEW_CODES.OBSERVED_TEXT_BINDING),
      JSON.stringify(validateVisualReview(qualifierDifference, reviewOptions)));

    const unicodeDifference = JSON.parse(JSON.stringify(repeatedPass));
    unicodeDifference.post_render_checks.checks.find((check) => check.check === 'factual').observed_text_items[0].declared_text = '41.4%\u00a0';
    ok(`R3 whitespace/Unicode declared-text substitution cannot reach PASS_TO_HUMAN_REVIEW: ${REVIEW_CODES.OBSERVED_TEXT_BINDING}`,
      validateVisualReview(unicodeDifference, reviewOptions).some((entry) => entry.code === REVIEW_CODES.OBSERVED_TEXT_BINDING),
      JSON.stringify(validateVisualReview(unicodeDifference, reviewOptions)));

    const balancedSubstitution = JSON.parse(JSON.stringify(repeatedPass));
    balancedSubstitution.post_render_checks.checks.find((check) => check.check === 'factual').observed_text_items = [
      { source_ref: verifiedFact.source_ref, declared_text: '41.4%', observed_text: '41.4%' },
      { source_ref: verifiedFact.source_ref, declared_text: '41.4%', observed_text: '41.4%' },
    ];
    const balancedIssues = validateVisualReview(balancedSubstitution, reviewOptions);
    ok(`R3 drop-one/duplicate-another at unchanged total count fails ${REVIEW_CODES.OBSERVED_TEXT_REQUIRED} and ${REVIEW_CODES.OBSERVED_TEXT_BINDING}`,
      balancedIssues.some((entry) => entry.code === REVIEW_CODES.OBSERVED_TEXT_REQUIRED) &&
        balancedIssues.some((entry) => entry.code === REVIEW_CODES.OBSERVED_TEXT_BINDING),
      JSON.stringify(balancedIssues));

    const sourceMoved = JSON.parse(JSON.stringify(repeatedPass));
    sourceMoved.post_render_checks.checks.find((check) => check.check === 'factual').observed_text_items[0].source_ref = 'article-source:moved';
    const sourceMovedIssues = validateVisualReview(sourceMoved, reviewOptions);
    ok(`R3 source-ref movement cannot reach PASS_TO_HUMAN_REVIEW: ${REVIEW_CODES.OBSERVED_TEXT_REQUIRED} and ${REVIEW_CODES.HALLUCINATED_LABEL}`,
      sourceMovedIssues.some((entry) => entry.code === REVIEW_CODES.OBSERVED_TEXT_REQUIRED) &&
        sourceMovedIssues.some((entry) => entry.code === REVIEW_CODES.HALLUCINATED_LABEL),
      JSON.stringify(sourceMovedIssues));
  } finally {
    rmSync(repeatedSourceScope, { recursive: true, force: true });
  }
  const reviewerObservedOnlyInProse = JSON.parse(JSON.stringify(bound));
  const reviewerFactual = reviewerObservedOnlyInProse.post_render_checks.checks.find((check) => check.check === 'factual');
  delete reviewerFactual.observed_text_items;
  reviewerFactual.evidence = 'WRONG NUMBER observed: 41.5%; declared payload requires 41.4%';
  ok('reviewer exact mutation: free-text wrong-number evidence cannot pass without structured observed text',
    validateVisualReview(reviewerObservedOnlyInProse, reviewOptions).some(i => i.code === REVIEW_CODES.OBSERVED_TEXT_REQUIRED));
  const missingVerifiedCheck = { ...bound }; delete missingVerifiedCheck.post_render_checks;
  ok('verified-fact review cannot omit the factual digest check', validateVisualReview(missingVerifiedCheck, reviewOptions).some(i => i.code === REVIEW_CODES.VERIFIED_FACT_REVIEW_REQUIRED));
  const opaqueBinding = { ...bound, verified_fact_binding: { ...bound.verified_fact_binding, payload_sha256: 'sha256:' + 'a'.repeat(64) } };
  ok('verified-fact review rejects a payload binding from another owner', validateVisualReview(opaqueBinding, { ...reviewOptions, job: verifiedJob }).some(i => i.code === REVIEW_CODES.VERIFIED_FACT_BINDING));
  const reviewRecordScope = mkdtempSync(resolve(tmpdir(), 'visual-review-v217-records-'));
  const naturalBound = { ...bound, feedback_ref: 'feedback:v217-post-render' };
  writeFileSync(resolve(reviewRecordScope, 'verified-fact.json'), JSON.stringify(naturalBound));
  const naturalPass = spawnSync('npm', ['run', 'validate:visual-review'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, VISUAL_REVIEW_RECORDS: reviewRecordScope, VISUAL_FEEDBACK_DIR: feedbackScope },
  });
  ok('natural npm validate:visual-review consumer accepts a durably bound verified-fact review', naturalPass.status === 0, `status=${naturalPass.status} error=${naturalPass.error?.message ?? ''} ${naturalPass.stdout}\n${naturalPass.stderr}`.trim());
  const staleJobDigest = { ...naturalBound, verified_fact_binding: { ...naturalBound.verified_fact_binding, job_sha256: `sha256:${'a'.repeat(64)}` } };
  writeFileSync(resolve(reviewRecordScope, 'verified-fact.json'), JSON.stringify(staleJobDigest));
  const staleJobDigestFail = spawnSync('npm', ['run', 'validate:visual-review'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, VISUAL_REVIEW_RECORDS: reviewRecordScope, VISUAL_FEEDBACK_DIR: feedbackScope },
  });
  ok('natural consumer rejects a stale authoritative job digest', staleJobDigestFail.status === 1 && `${staleJobDigestFail.stdout}\n${staleJobDigestFail.stderr}`.includes(REVIEW_CODES.VERIFIED_FACT_JOB));
  const arbitraryAnchor = { ...naturalBound, post_render_checks: JSON.parse(JSON.stringify(postRender)) };
  arbitraryAnchor.post_render_checks.actual_display_geometry.mobile.crop_anchor = 'anchor:arbitrary-unbound';
  writeFileSync(resolve(reviewRecordScope, 'verified-fact.json'), JSON.stringify(arbitraryAnchor));
  const arbitraryAnchorFail = spawnSync('npm', ['run', 'validate:visual-review'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, VISUAL_REVIEW_RECORDS: reviewRecordScope, VISUAL_FEEDBACK_DIR: feedbackScope },
  });
  ok('natural consumer rejects an arbitrary mobile crop anchor', arbitraryAnchorFail.status === 1 && `${arbitraryAnchorFail.stdout}\n${arbitraryAnchorFail.stderr}`.includes(REVIEW_CODES.VERIFIED_FACT_SURFACE));
  const alteredSurfaceJob = JSON.parse(readFileSync(resolve(root, authoritativeJobRef), 'utf8'));
  alteredSurfaceJob.render_spec.publication_display_surfaces.mobile.viewport_width_css_px = 414;
  const alteredJobPath = resolve(root, '.visual-review-v217-authority-job.json');
  writeFileSync(alteredJobPath, JSON.stringify(alteredSurfaceJob));
  const alteredJobRef = '.visual-review-v217-authority-job.json';
  const alteredJobSha256 = `sha256:${createHash('sha256').update(readFileSync(alteredJobPath)).digest('hex')}`;
  const alteredSurface = { ...naturalBound, verified_fact_binding: { ...naturalBound.verified_fact_binding, job_ref: alteredJobRef, job_sha256: alteredJobSha256, render_spec_sha256: canonicalPayloadSha256(alteredSurfaceJob.render_spec) } };
  writeFileSync(resolve(reviewRecordScope, 'verified-fact.json'), JSON.stringify(alteredSurface));
  const alteredSurfaceFail = spawnSync('npm', ['run', 'validate:visual-review'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, VISUAL_REVIEW_RECORDS: reviewRecordScope, VISUAL_FEEDBACK_DIR: feedbackScope },
  });
  ok('natural consumer rejects review geometry against altered authoritative mobile surface', alteredSurfaceFail.status === 1 && `${alteredSurfaceFail.stdout}\n${alteredSurfaceFail.stderr}`.includes(REVIEW_CODES.VERIFIED_FACT_SURFACE));
  rmSync(alteredJobPath, { force: true });
  writeFileSync(resolve(reviewRecordScope, 'verified-fact.json'), JSON.stringify({ ...naturalBound, post_render_checks: undefined }));
  const naturalFail = spawnSync('npm', ['run', 'validate:visual-review'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, VISUAL_REVIEW_RECORDS: reviewRecordScope, VISUAL_FEEDBACK_DIR: feedbackScope },
  });
  ok('natural validate-visual-review consumer rejects missing verified factual checks', naturalFail.status === 1 && `${naturalFail.stdout}\n${naturalFail.stderr}`.includes(REVIEW_CODES.VERIFIED_FACT_REVIEW_REQUIRED));
  const disguised = { ...bound }; delete disguised.verified_fact_binding;
  ok('verified-fact review cannot disguise itself as legacy by dropping its binding', validateVisualReview(disguised, reviewOptions).some(i => i.code === REVIEW_CODES.VERIFIED_FACT_BINDING));
  rmSync(reviewRecordScope, { recursive: true, force: true });
  ok('legacy review without a verified-fact job remains valid', validateVisualReview(clean, reviewOptions).length === 0);
  rmSync(feedbackScope, { recursive: true, force: true });
}
{
  const wrongFullDigest={...good,asset_sha256:'sha256:'+'a'.repeat(64)};
  ok('reviewed full asset digest must match its actual pixels',validateVisualReview(wrongFullDigest).some(i=>i.code===REVIEW_CODES.ASSET_HASH));
  const wrongMobileDigest={...good,mobile_asset_sha256:'sha256:'+'a'.repeat(64)};
  ok('reviewed mobile asset digest must match its actual pixels',validateVisualReview(wrongMobileDigest).some(i=>i.code===REVIEW_CODES.MOBILE_ASSET_HASH));
  const sameRef={...good,mobile_asset_ref:good.asset_ref,mobile_asset_sha256:mobileAssetSha256};
  ok('full and mobile review refs must be distinct',validateVisualReview(sameRef).some(i=>i.code===REVIEW_CODES.ASSET_PAIR));
  const sameDigest={...good,mobile_asset_sha256:good.asset_sha256};
  ok('full and mobile review digests must be distinct',validateVisualReview(sameDigest).some(i=>i.code===REVIEW_CODES.ASSET_PAIR));
  const noMobile={...good,review_mode:'full'}; delete noMobile.mobile_asset_ref; delete noMobile.mobile_asset_sha256;
  ok('full review without a named mobile derivative is rejected',validateVisualReview(noMobile).some(i=>i.code===REVIEW_CODES.SCHEMA));
  const tagless={...good,defect_tags:[]};
  ok('a non-PASS primary tag must be present in defect_tags',validateVisualReview(tagless).some(i=>i.code===REVIEW_CODES.PRIMARY_TAG));
}
const fx=read('evals/visual-review/fixtures/negative/sue629-a.json'); ok('real negative fixture hash validates',validateVisualFixture(fx).length===0); ok('hash mismatch rejected',validateVisualFixture({...fx,asset_sha256:'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'}).some(i=>i.code===REVIEW_CODES.FIXTURE_HASH)); const slot=read('evals/visual-review/fixtures/positive-slots.json').slots[0];ok('empty positive slot inert',validateVisualFixture(slot).length===0);ok('positive slot cannot point at repository asset',validateVisualFixture({...slot,asset_ref:fx.asset_ref,asset_sha256:fx.asset_sha256}).some(i=>i.code===REVIEW_CODES.POSITIVE));
ok('missing fixture rejected',validateVisualFixture({...fx,asset_ref:'evals/missing.svg'}).some(i=>i.code===REVIEW_CODES.FIXTURE_PATH));ok('outside fixture rejected',validateVisualFixture({...fx,asset_ref:'/tmp/no.svg'}).some(i=>i.code===REVIEW_CODES.FIXTURE_PATH));ok('a negative fixture cannot claim an accepted owner judgement',validateVisualFixture({...fx,owner_judgement:'accepted'}).some(i=>i.code===REVIEW_CODES.POSITIVE));
for (const [name, code] of [
  ['wrong-number', REVIEW_CODES.WRONG_NUMBER],
  ['missing-qualifier', REVIEW_CODES.MISSING_QUALIFIER],
  ['hallucinated-label', REVIEW_CODES.HALLUCINATED_LABEL],
  ['unreadable-display-size', REVIEW_CODES.UNREADABLE_DISPLAY_SIZE],
]) {
  const fixture = read(`evals/visual-review/fixtures/negative/sue670-${name}.json`);
  const sourceReview = read(fixture.review_record);
  const negativeReview = materializeVisualSemanticNegativeReview(fixture, sourceReview);
  const issues = validateVisualReview(negativeReview);
  ok(`SUE-670 named negative fixture ${name} fails for ${code}`,
    issues.some((entry) => entry.code === code), JSON.stringify(issues));
  ok(`SUE-647 taxonomy registers ${name} as an expected semantic rejection`,
    validateVisualFixture(fixture).length === 0, JSON.stringify(validateVisualFixture(fixture)));
}
for(const tag of ['dashboardization','ui_mimicry','flat_svg_aesthetic','generic_icon_grid','box_overload','over_minimalization','weak_visual_thesis','style_dilution','dense_text','reference_drift','factual_overlay_intrusion']){const r=expectedVisualReviewRoute(tag),j={...good,verdict:'REROUTE',defect_tags:[tag],primary_tag:tag,failure_class:r?.failure_class,next_action:r?.next_action};ok(`tag schema and parity ${tag}`,r&&VISUAL_FAILURE_ACTIONS[r.failure_class]===r.next_action&&!validateVisualReview(j).some(x=>!String(x.code).startsWith('visual-review-feedback-')));}
const plates=['sue629-a.json','sue629-b.json','sue629-c.json'].map(x=>read(`evals/visual-review/fixtures/negative/${x}`));ok('rejected SUE-629 records carry dashboard UI and flat-SVG warnings routed to reroute', ['dashboardization','ui_mimicry','flat_svg_aesthetic'].every(t=>plates.some(p=>p.failure_tags.includes(t))&&expectedVisualReviewRoute(t).next_action==='reroute_composition_renderer'));
const harness=spawnSync('node',['scripts/compare-visual-review-fixtures.mjs'],{cwd:root,encoding:'utf8'});ok('empty positive slots make comparison UNRUNNABLE non-success',harness.status===2&&harness.stdout.includes('UNRUNNABLE'));

// --- comparison harness ---------------------------------------------------
// Every case runs in a mkdtemp scope the test creates and removes. The valid
// case needs repository-CONTAINED assets, so its scope is made inside the repo
// root and removed again; nothing is ever committed.
const runHarness = (slotsPath, feedbackDir) => spawnSync(
  'node', ['scripts/compare-visual-review-fixtures.mjs'],
  { cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      VISUAL_POSITIVE_SLOTS: slotsPath,
      ...(feedbackDir ? { VISUAL_FEEDBACK_DIR: feedbackDir } : {}),
    } },
);

{
  // The reviewer's forgery: two real rejected repository SVGs with their real
  // digests, a negative status, and a review reference that is just a string.
  const scope = mkdtempSync(resolve(tmpdir(), 'visual-review-forged-'));
  try {
    const a = read('evals/visual-review/fixtures/negative/sue629-a.json');
    const b = read('evals/visual-review/fixtures/negative/sue629-b.json');
    const forged = [a, b].map((f, i) => ({
      fixture_id: `forged-${i}`, asset_ref: f.asset_ref, asset_sha256: f.asset_sha256,
      status: 'negative', owner_judgement: 'rejected', failure_tags: [],
      usage_limit: 'forged', review_record: 'not-a-review',
    }));
    const p = resolve(scope, 'slots.json');
    writeFileSync(p, JSON.stringify({ slots: forged }));
    const run = runHarness(p);
    ok('forged negative-status slots are UNRUNNABLE',
      run.status === 2 && run.stdout.includes('not owner_positive'));
  } finally { rmSync(scope, { recursive: true, force: true }); }
}

{
  // Same assets, but now claiming owner_positive — an asset already registered
  // as a negative fixture must never become a positive reference.
  const scope = mkdtempSync(resolve(tmpdir(), 'visual-review-promoted-'));
  try {
    const a = read('evals/visual-review/fixtures/negative/sue629-a.json');
    const p = resolve(scope, 'slots.json');
    writeFileSync(p, JSON.stringify({ slots: [{
      fixture_id: 'promoted', asset_ref: a.asset_ref, asset_sha256: a.asset_sha256,
      status: 'owner_positive', owner_judgement: 'accepted', failure_tags: [],
      usage_limit: 'promoted', review_record: 'evals/visual-review/fixtures/negative/sue629-a.json',
    }] }));
    const run = runHarness(p);
    ok('a registered negative asset cannot be promoted to a positive reference',
      run.status === 2 && run.stdout.includes('registered as a negative fixture'));
  } finally { rmSync(scope, { recursive: true, force: true }); }
}

{
  // The genuinely valid pair the earlier test never built. Each temp review
  // gets its own temp feedback record, injected via VISUAL_FEEDBACK_DIR, so the
  // mandatory feedback-routing contract is genuinely satisfied and nothing is
  // written into the committed registry.
  const scope = mkdtempSync(resolve(root, '.visual-review-valid-'));
  const rel = (p) => p.slice(root.length + 1);
  try {
    const feedbackDir = resolve(scope, 'feedback-records');
    mkdirSync(feedbackDir);
    const slots = [0, 1].map((i) => {
      const assetPath = resolve(scope, `positive-${i}.svg`);
      writeFileSync(assetPath, `<svg xmlns="http://www.w3.org/2000/svg"><title>positive ${i}</title></svg>`);
      const digest = `sha256:${createHash('sha256').update(readFileSync(assetPath)).digest('hex')}`;
      const feedbackId = `feedback:temp-positive-${i}`;
      writeFileSync(resolve(feedbackDir, `temp-positive-${i}.json`), JSON.stringify({
        schema_version: '1.0.0', feedback_id: feedbackId, created_at: '2026-09-07T00:00:00Z',
        subject: { kind: 'artifact', ref: rel(assetPath) },
        evaluator: { type: 'agent', agent: { runtime: 'vision-agent' } },
        basis: 'model_inference', signal: 'publication_fit', verdict: 'mixed',
        owner_verdict: 'unknown',
        statement: `Temporary fixture finding for positive slot ${i}.`,
        routing: { layer: 'surface', confidence: 'low', abstained: true, rationale: 'Temporary fixture.' },
        scope: 'task_local', calibration_ref: null, evidence_links: [],
      }));
      const reviewPath = resolve(scope, `review-${i}.json`);
      writeFileSync(reviewPath, JSON.stringify({
        ...good, review_id: `visual-review:positive-${i}`,
        asset_ref: rel(assetPath), asset_sha256: digest,
        verdict: 'PASS_TO_HUMAN_REVIEW', defect_tags: [], primary_tag: null,
        failure_class: null, next_action: 'human_judgement', feedback_ref: feedbackId,
      }));
      return {
        fixture_id: `positive-${i}`, asset_ref: rel(assetPath), asset_sha256: digest,
        status: 'owner_positive', owner_judgement: 'accepted', failure_tags: [],
        usage_limit: 'temp fixture', review_record: rel(reviewPath),
      };
    });
    const p = resolve(scope, 'slots.json');
    writeFileSync(p, JSON.stringify({ slots }));
    ok('a genuinely valid owner-positive pair reports COMPARABLE',
      (() => { const r = runHarness(p, feedbackDir); return r.status === 0 && r.stdout.includes('COMPARABLE'); })());

    // A review that is schema-shaped but fails the feedback contract must not count.
    const badFeedback = JSON.parse(JSON.stringify(slots));
    const strayReview = resolve(scope, 'review-stray.json');
    writeFileSync(strayReview, JSON.stringify({
      ...good, review_id: 'visual-review:stray',
      asset_ref: slots[0].asset_ref, asset_sha256: slots[0].asset_sha256,
      verdict: 'PASS_TO_HUMAN_REVIEW', defect_tags: [], primary_tag: null,
      failure_class: null, next_action: 'human_judgement',
      feedback_ref: 'feedback:not-in-this-corpus',
    }));
    badFeedback[0].review_record = rel(strayReview);
    writeFileSync(p, JSON.stringify({ slots: badFeedback }));
    ok('a review failing the feedback contract is UNRUNNABLE',
      (() => { const r = runHarness(p, feedbackDir); return r.status === 2 && r.stdout.includes('feedback'); })());

    // ...and one broken condition at a time still blocks it.
    const broken = JSON.parse(JSON.stringify(slots));
    broken[0].asset_sha256 = 'sha256:' + 'a'.repeat(64);
    writeFileSync(p, JSON.stringify({ slots: broken }));
    ok('a wrong digest on an otherwise valid slot is UNRUNNABLE',
      runHarness(p, feedbackDir).status === 2);

    const noReview = JSON.parse(JSON.stringify(slots));
    noReview[1].review_record = rel(resolve(scope, 'absent-review.json'));
    writeFileSync(p, JSON.stringify({ slots: noReview }));
    ok('an unresolvable review record is UNRUNNABLE', runHarness(p, feedbackDir).status === 2);

    const wrongSubject = JSON.parse(JSON.stringify(slots));
    wrongSubject[0].review_record = wrongSubject[1].review_record;
    writeFileSync(p, JSON.stringify({ slots: wrongSubject }));
    ok('a review record about a different asset is UNRUNNABLE',
      runHarness(p, feedbackDir).status === 2);
  } finally { rmSync(scope, { recursive: true, force: true }); }
}

// --- feedback routing: one named negative per condition --------------------
// The three record-shaped conditions use an injected temp corpus. Nothing in
// the committed registry is written, so a crash or a concurrent run cannot
// leave the checkout dirty.
{
  const missing = JSON.parse(JSON.stringify(good));
  delete missing.feedback_ref;
  ok('feedback route rejects: missing feedback_ref',
    validateVisualReview(missing).some((i) => i.code === REVIEW_CODES.SCHEMA));

  const unresolvable = { ...good, feedback_ref: 'feedback:does-not-exist' };
  ok('feedback route rejects: unresolvable feedback_ref',
    validateVisualReview(unresolvable).some((i) => i.code === REVIEW_CODES.FEEDBACK_UNRESOLVED));

  const scope = mkdtempSync(resolve(tmpdir(), 'visual-review-feedback-'));
  try {
    const base = JSON.parse(readFileSync(
      resolve(root, 'feedback/records/visual-review-sue629-a.json'), 'utf8'));
    const withRecord = (mutate) => {
      const record = JSON.parse(JSON.stringify(base));
      mutate(record);
      // The registry requires the filename to match the feedback_id.
      writeFileSync(resolve(scope, `${record.feedback_id.split(':').pop()}.json`), JSON.stringify(record));
      return validateVisualReview(good, { feedbackDir: scope });
    };
    ok('feedback route accepts a consistent record',
      withRecord(() => {}).length === 0);
    ok('feedback route rejects: feedback about a different subject',
      withRecord((r) => { r.subject.ref = 'evals/prototypes/sue629/plate-b-comparison.svg'; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_SUBJECT));
    ok('feedback route rejects: feedback basis is not model_inference',
      withRecord((r) => { r.basis = 'owner_statement'; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_BASIS));
    ok('feedback route rejects: feedback carries an owner verdict',
      withRecord((r) => { r.owner_verdict = 'accepted'; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_OWNER));
    ok('feedback route rejects: feedback modality disagrees with the primary tag',
      withRecord((r) => { r.routing.modality_layer = 'reference_drift'; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_MODALITY));
    ok('feedback route rejects: a record the feedback contract itself rejects',
      withRecord((r) => { delete r.statement; delete r.scope; })
        .some((i) => i.code === REVIEW_CODES.FEEDBACK_INVALID));
  } finally { rmSync(scope, { recursive: true, force: true }); }
}

process.exitCode = bad ? 1 : 0;
