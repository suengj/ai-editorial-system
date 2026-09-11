import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { validate } from './json-schema-lite.mjs';
import { listFeedbackFiles, validateFeedbackFile } from './registry-core.mjs';
import { VISUAL_FAILURE_ACTIONS, canonicalPayloadSha256, expectedVisualFailureAction, validateVisualJob } from './visual-job-core.mjs';
import {
  VISUAL_REVIEW_INVARIANT_CODES,
  validateMobileLegibility,
  validateObservedTextAgainstJob,
} from './visual-review-invariants.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const schema = (name) => JSON.parse(readFileSync(resolve(ROOT, 'schemas', name), 'utf8'));

export const REVIEW_CODES = Object.freeze({
  ...VISUAL_REVIEW_INVARIANT_CODES,
  FEEDBACK_INVALID: 'visual-review-feedback-record-invalid',
  SCHEMA: 'visual-review-schema',
  DIMENSIONS: 'visual-review-dimensions',
  ROUTE: 'visual-review-route',
  PRIMARY_TAG: 'visual-review-primary-tag',
  ASSET_PATH: 'visual-review-asset-path',
  ASSET_HASH: 'visual-review-asset-hash',
  MOBILE_ASSET_PATH: 'visual-review-mobile-asset-path',
  MOBILE_ASSET_HASH: 'visual-review-mobile-asset-hash',
  ASSET_PAIR: 'visual-review-asset-pair',
  FEEDBACK: 'visual-review-feedback-route-invalid',
  FEEDBACK_UNRESOLVED: 'visual-review-feedback-unresolved',
  FEEDBACK_SUBJECT: 'visual-review-feedback-subject',
  FEEDBACK_BASIS: 'visual-review-feedback-basis',
  FEEDBACK_OWNER: 'visual-review-feedback-owner',
  FEEDBACK_MODALITY: 'visual-review-feedback-modality',
  FIXTURE_PATH: 'visual-fixture-path',
  FIXTURE_HASH: 'visual-fixture-hash',
  POSITIVE: 'visual-positive-slot-invalid',
  POST_RENDER_DIGEST: 'visual-review-post-render-digest',
  POST_RENDER_CHECKS: 'visual-review-post-render-checks',
  POST_RENDER_ROUTE: 'visual-review-post-render-route',
  POST_RENDER_SCOPE: 'visual-review-post-render-scope',
  POST_RENDER_GEOMETRY: 'visual-review-post-render-geometry',
  VERIFIED_FACT_BINDING: 'visual-review-verified-fact-binding',
  VERIFIED_FACT_REVIEW_REQUIRED: 'visual-review-verified-fact-review-required',
  VERIFIED_FACT_JOB: 'visual-review-verified-fact-job',
  VERIFIED_FACT_SURFACE: 'visual-review-verified-fact-surface',
});

export const VISUAL_REVIEW_TAG_CLASSES = Object.freeze({
  dashboardization: 'dashboardization',
  ui_mimicry: 'dashboardization',
  flat_svg_aesthetic: 'dashboardization',
  generic_icon_grid: 'dashboardization',
  box_overload: 'dashboardization',
  over_minimalization: 'wrong_concept',
  weak_visual_thesis: 'wrong_concept',
  style_dilution: 'wrong_concept',
  dense_text: 'facts_or_text_wrong',
  reference_drift: 'reference_drift',
  factual_overlay_intrusion: 'facts_or_text_wrong',
  wrong_number: 'facts_or_text_wrong',
  missing_qualifier: 'facts_or_text_wrong',
  hallucinated_label: 'facts_or_text_wrong',
  unreadable_publication_display_size: 'local_defect',
});

const REQUIRED_DIMENSIONS = [
  'thesis_clarity', 'reading_path', 'narrative_composition',
  'editorial_authorship', 'spatial_richness', 'information_hierarchy',
  'article_fit', 'reference_adherence', 'brand_compatibility',
  'factual_text_integrity', 'mobile_crop_resilience',
];

export function expectedVisualReviewRoute(tag) {
  const failure_class = VISUAL_REVIEW_TAG_CLASSES[tag];
  return failure_class ? { failure_class, next_action: expectedVisualFailureAction(failure_class) } : null;
}

function containedFile(ref) {
  try {
    const path = resolve(ROOT, ref);
    if (!path.startsWith(`${ROOT}${sep}`)) return null;
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    if (!realpathSync(path).startsWith(`${ROOT}${sep}`)) return null;
    return path;
  } catch {
    return null;
  }
}

function digestOf(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function loadBoundReviewJob(record, out) {
  const binding = record.verified_fact_binding;
  if (!binding) return null;
  const path = containedFile(binding.job_ref);
  if (!path) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_JOB, message: 'verified_fact_binding.job_ref must resolve to a repository-contained job artifact' });
    return null;
  }
  if (digestOf(path) !== binding.job_sha256) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_JOB, message: 'verified_fact_binding.job_sha256 does not match the bound job artifact bytes' });
    return null;
  }
  let job;
  try {
    job = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_JOB, message: 'verified_fact_binding.job_ref is not a parseable JSON visual job artifact' });
    return null;
  }
  const jobIssues = validateVisualJob(job);
  if (jobIssues.length) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_JOB, message: `bound visual job is not validator-clean: ${jobIssues[0].message ?? jobIssues[0].code}` });
    return null;
  }
  return job;
}

function validatePostRenderChecks(record, out) {
  const post = record.post_render_checks;
  if (!post) return;
  if (post.asset_sha256 !== record.asset_sha256 || post.mobile_asset_sha256 !== record.mobile_asset_sha256) {
    out.push({ code: REVIEW_CODES.POST_RENDER_DIGEST, message: 'post_render_checks must bind to the review record full and mobile asset digests' });
  }
  const expected = new Set(['textual', 'factual', 'readability', 'mobile']);
  const expectedScope = { textual: 'full', factual: 'full', readability: 'full', mobile: 'mobile' };
  const expectedSurface = { textual: 'desktop_actual_display', factual: 'desktop_actual_display', readability: 'desktop_actual_display', mobile: 'mobile_actual_display' };
  const seen = new Set();
  for (const check of post.checks) {
    if (seen.has(check.check)) out.push({ code: REVIEW_CODES.POST_RENDER_CHECKS, message: `post-render check ${check.check} appears more than once` });
    seen.add(check.check);
    if (check.asset_scope !== expectedScope[check.check]) out.push({ code: REVIEW_CODES.POST_RENDER_SCOPE, message: `${check.check} check must inspect the ${expectedScope[check.check]} asset, not ${check.asset_scope}` });
    if (check.display_surface !== expectedSurface[check.check]) out.push({ code: REVIEW_CODES.POST_RENDER_SCOPE, message: `${check.check} check must record its ${expectedSurface[check.check]} inspection surface` });
    if (check.observed !== true) out.push({ code: REVIEW_CODES.POST_RENDER_GEOMETRY, message: `${check.check} check must record observed actual-display evidence` });
    const expectedDigest = check.asset_scope === 'mobile' ? record.mobile_asset_sha256 : record.asset_sha256;
    if (check.asset_sha256 !== expectedDigest) out.push({ code: REVIEW_CODES.POST_RENDER_DIGEST, message: `${check.check} check is not bound to the digest for its ${check.asset_scope} asset` });
  }
  for (const name of expected) if (!seen.has(name)) out.push({ code: REVIEW_CODES.POST_RENDER_CHECKS, message: `post-render checks must cover ${name}` });
  const geometry = post.actual_display_geometry;
  let geometryValid = true;
  if (geometry.desktop.asset_sha256 !== record.asset_sha256) {
    geometryValid = false;
    out.push({ code: REVIEW_CODES.POST_RENDER_GEOMETRY, message: 'desktop actual-display geometry must bind to the reviewed full asset digest' });
  }
  if (geometry.desktop.observed !== true) {
    geometryValid = false;
    out.push({ code: REVIEW_CODES.POST_RENDER_GEOMETRY, message: 'desktop actual-display geometry must be observed' });
  }
  if (geometry.desktop.article_body_width_css_px !== 672) {
    geometryValid = false;
    out.push({ code: REVIEW_CODES.POST_RENDER_GEOMETRY, message: 'desktop operative article-body width must be observed at exactly 672 CSS px' });
  }
  if (geometry.mobile.asset_sha256 !== record.mobile_asset_sha256 || geometry.mobile.derivative_of_asset_sha256 !== record.asset_sha256) {
    geometryValid = false;
    out.push({ code: REVIEW_CODES.POST_RENDER_GEOMETRY, message: 'mobile actual-display geometry must bind to the mobile asset and explicitly derive from the reviewed full asset' });
  }
  if (geometry.mobile.observed !== true || geometry.mobile.anchor_observed !== true) {
    geometryValid = false;
    out.push({ code: REVIEW_CODES.POST_RENDER_GEOMETRY, message: 'mobile actual-display geometry must observe the declared crop anchor' });
  }
  if (geometry.mobile.viewport_width_css_px >= geometry.desktop.article_body_width_css_px || geometry.mobile.article_body_width_css_px > geometry.mobile.viewport_width_css_px) {
    geometryValid = false;
    out.push({ code: REVIEW_CODES.POST_RENDER_GEOMETRY, message: 'mobile geometry must be narrower than desktop and fit its mobile viewport' });
  }
  const actionFor = (verdict) => verdict === 'pass' ? 'KEEP' : verdict === 'fail' ? 'CHANGE' : 'DO_NOT_CHANGE';
  for (const name of expected) {
    const check = post.checks.find((x) => x.check === name);
    const route = post.repair_routing[name];
    if (check && route !== actionFor(check.verdict)) out.push({ code: REVIEW_CODES.POST_RENDER_ROUTE, message: `${name} repair routing must be ${actionFor(check.verdict)} for a ${check.verdict} check` });
  }
  const hasFailure = post.checks.some((x) => x.verdict === 'fail');
  const hasAbstain = post.checks.some((x) => x.verdict === 'abstain');
  const allObservedPass = post.checks.length === expected.size && post.checks.every((x) => x.verdict === 'pass' && x.observed === true);
  if (record.verdict === 'PASS_TO_HUMAN_REVIEW' && (!allObservedPass || !geometryValid)) {
    out.push({ code: REVIEW_CODES.POST_RENDER_ROUTE, message: 'PASS_TO_HUMAN_REVIEW requires observed pass results for every full/mobile actual-display check and valid geometry; abstain is fail-closed' });
  }
  if (!hasFailure && !hasAbstain && allObservedPass && geometryValid && record.verdict !== 'PASS_TO_HUMAN_REVIEW') {
    out.push({ code: REVIEW_CODES.POST_RENDER_ROUTE, message: 'a clean post-render check set may only pass as PASS_TO_HUMAN_REVIEW' });
  }
  if (hasFailure && record.verdict === 'PASS_TO_HUMAN_REVIEW') {
    out.push({ code: REVIEW_CODES.POST_RENDER_ROUTE, message: 'a failed post-render check cannot be presented as PASS_TO_HUMAN_REVIEW' });
  }
}

function validateBoundDisplayAuthority(record, job, out) {
  const spec = job?.render_spec;
  const surfaces = spec?.publication_display_surfaces;
  const anchors = spec?.crop_anchors;
  const geometry = record.post_render_checks?.actual_display_geometry;
  if (!spec || !surfaces || !surfaces.desktop || !surfaces.mobile || !Array.isArray(anchors) || !Array.isArray(surfaces.mobile.crop_anchors) || !geometry) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_SURFACE, message: 'verified-fact review requires authoritative RenderSpec crop_anchors, publication-display surfaces, and observed geometry' });
    return;
  }
  const desktop = surfaces.desktop;
  const mobile = surfaces.mobile;
  const observedDesktop = geometry.desktop;
  const observedMobile = geometry.mobile;
  const desktopMatches = observedDesktop.surface_id === desktop.surface_id &&
    observedDesktop.asset_scope === desktop.asset_scope &&
    observedDesktop.article_body_width_css_px === desktop.article_body_width_css_px &&
    observedDesktop.viewport_width_css_px === desktop.viewport_width_css_px;
  const mobileMatches = observedMobile.surface_id === mobile.surface_id &&
    observedMobile.asset_scope === mobile.asset_scope &&
    observedMobile.viewport_width_css_px === mobile.viewport_width_css_px &&
    observedMobile.article_body_width_css_px === mobile.article_body_width_css_px &&
    observedMobile.derivative_of_surface_id === mobile.derivative_of_surface_id &&
    observedMobile.crop_anchor && anchors.includes(observedMobile.crop_anchor) &&
    mobile.crop_anchors.includes(observedMobile.crop_anchor);
  if (!desktopMatches || !mobileMatches) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_SURFACE, message: 'observed desktop/mobile geometry and crop anchor must match the bound RenderSpec publication-display surfaces and declared semantic anchors' });
  }
}

function validateVerifiedFactReview(record, job, out) {
  const jobVerified = Boolean(job?.visual_brief?.text_ownership?.verified_generative_fact);
  const binding = record.verified_fact_binding;
  const markedVerified = record.review_scope === 'verified_generative_fact';
  if (record.review_scope === 'legacy' && (binding || jobVerified)) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_BINDING, message: 'review_scope legacy cannot carry verified_generative_fact ownership' });
  }
  // The binding is the durable discriminator. A record carrying one is a
  // verified-fact review even when the natural validator has no job object to
  // resolve; legacy records omit it and remain compatible.
  if (!binding && !jobVerified && !markedVerified) return;
  if (!binding || !markedVerified) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_BINDING, message: 'verified-fact reviews require review_scope verified_generative_fact and a durable payload/job/asset binding' });
  }
  if (markedVerified && !job) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_JOB, message: 'verified-fact reviews require a resolvable, validator-clean bound visual job artifact' });
  } else if (markedVerified && !jobVerified) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_BINDING, message: 'the bound visual job must itself declare verified_generative_fact ownership; a legacy job cannot be relabeled by a review' });
  }

  if (binding && binding.asset_sha256 !== record.asset_sha256) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_BINDING, message: 'verified_fact_binding.asset_sha256 must equal the reviewed full-asset digest' });
  }

  if (jobVerified) {
    const owner = job.visual_brief.text_ownership.verified_generative_fact;
    const payload = owner.canonical_payload ?? {};
    if (!binding || binding.job_id !== job.job_id || binding.payload_ref !== payload.payload_ref ||
        binding.job_ref === undefined || binding.job_sha256 === undefined ||
        binding.render_spec_id !== job.render_spec?.render_spec_id ||
        binding.render_spec_sha256 !== canonicalPayloadSha256(job.render_spec) ||
        binding.payload_sha256 !== payload.payload_sha256 || binding.asset_sha256 !== record.asset_sha256 ||
        binding.required_check !== 'factual') {
      out.push({ code: REVIEW_CODES.VERIFIED_FACT_BINDING, message: 'review must bind exactly to the verified-fact job id/artifact digest, RenderSpec identity/digest, canonical payload reference/digest, reviewed asset digest, and factual check' });
    }
  }

  if (jobVerified) out.push(...validateObservedTextAgainstJob(record, job));

  const factual = record.post_render_checks?.checks?.find((check) =>
    check.check === 'factual' && check.asset_scope === 'full' && check.asset_sha256 === record.asset_sha256);
  if (!factual) {
    out.push({ code: REVIEW_CODES.VERIFIED_FACT_REVIEW_REQUIRED, message: 'verified_generative_fact reviews require a full-asset factual post-render check bound to the reviewed digest' });
  }
  if (job) validateBoundDisplayAuthority(record, job, out);
}

export function validateVisualReview(record, { feedbackDir, job } = {}) {
  const out = validate(record, schema('visual-review.schema.json'))
    .map((e) => ({ code: REVIEW_CODES.SCHEMA, message: e.message }));
  if (out.length) return out;

  if (new Set(record.dimensions.map((x) => x.dimension)).size !== REQUIRED_DIMENSIONS.length ||
      REQUIRED_DIMENSIONS.some((x) => !record.dimensions.some((d) => d.dimension === x))) {
    out.push({ code: REVIEW_CODES.DIMENSIONS, message: 'eleven dimensions exactly once' });
  }

  const fullPath = containedFile(record.asset_ref);
  if (!fullPath) out.push({ code: REVIEW_CODES.ASSET_PATH, message: 'asset_ref must resolve to a repository-contained regular file' });
  else if (digestOf(fullPath) !== record.asset_sha256) out.push({ code: REVIEW_CODES.ASSET_HASH, message: 'asset_sha256 does not match asset_ref bytes' });

  const mobilePath = containedFile(record.mobile_asset_ref);
  if (!mobilePath) out.push({ code: REVIEW_CODES.MOBILE_ASSET_PATH, message: 'mobile_asset_ref must resolve to a repository-contained regular file' });
  else if (digestOf(mobilePath) !== record.mobile_asset_sha256) out.push({ code: REVIEW_CODES.MOBILE_ASSET_HASH, message: 'mobile_asset_sha256 does not match mobile_asset_ref bytes' });
  if (record.mobile_asset_ref === record.asset_ref) out.push({ code: REVIEW_CODES.ASSET_PAIR, message: 'asset_ref and mobile_asset_ref must identify distinct files' });
  if (record.mobile_asset_sha256 === record.asset_sha256) out.push({ code: REVIEW_CODES.ASSET_PAIR, message: 'asset_sha256 and mobile_asset_sha256 must identify distinct byte content' });

  const route = expectedVisualReviewRoute(record.primary_tag);
  if (record.verdict !== 'PASS_TO_HUMAN_REVIEW' && record.primary_tag !== null && !record.defect_tags.includes(record.primary_tag)) {
    out.push({ code: REVIEW_CODES.PRIMARY_TAG, message: 'primary_tag must be one of defect_tags for a non-PASS review' });
  }
  if (record.verdict === 'PASS_TO_HUMAN_REVIEW'
    ? (record.primary_tag !== null || record.next_action !== 'human_judgement')
    : (!route || route.failure_class !== record.failure_class || route.next_action !== record.next_action)) {
    out.push({ code: REVIEW_CODES.ROUTE, message: 'verdict/tag route mismatch' });
  }

  validatePostRenderChecks(record, out);
  out.push(...validateMobileLegibility(record));
  const boundJob = record.verified_fact_binding ? loadBoundReviewJob(record, out) : job;
  validateVerifiedFactReview(record, boundJob, out);

  const fbPath = listFeedbackFiles(feedbackDir).find((path) => {
    try { return JSON.parse(readFileSync(path, 'utf8')).feedback_id === record.feedback_ref; } catch { return false; }
  });
  const fb = fbPath ? JSON.parse(readFileSync(fbPath, 'utf8')) : null;
  if (!fb) out.push({ code: REVIEW_CODES.FEEDBACK_UNRESOLVED, message: 'feedback_ref is unresolved' });
  else {
    // The referenced record must be a valid feedback record, not merely JSON
    // that happens to carry the right four fields.
    const fbIssues = validateFeedbackFile(fbPath);
    if (fbIssues.length) out.push({ code: REVIEW_CODES.FEEDBACK_INVALID, message: `referenced feedback record is invalid: ${fbIssues[0].message ?? fbIssues[0].code}` });
    if (fb.subject?.ref !== record.asset_ref) out.push({ code: REVIEW_CODES.FEEDBACK_SUBJECT, message: 'feedback subject differs' });
    if (fb.basis !== 'model_inference') out.push({ code: REVIEW_CODES.FEEDBACK_BASIS, message: 'feedback basis differs' });
    if (fb.owner_verdict !== 'unknown') out.push({ code: REVIEW_CODES.FEEDBACK_OWNER, message: 'feedback owner verdict differs' });
    if (!fb.routing?.abstained && fb.routing?.modality_layer !== record.primary_tag) out.push({ code: REVIEW_CODES.FEEDBACK_MODALITY, message: 'feedback modality differs' });
  }
  return out;
}

export function materializeVisualSemanticNegativeReview(fixture, sourceReview) {
  const review = JSON.parse(JSON.stringify(sourceReview));
  if (fixture.review_mutation === 'missing_qualifier_pass') {
    const observed = review.post_render_checks.checks.find((entry) => entry.check === 'factual').observed_text_items;
    observed[0].observed_text = observed[0].declared_text;
    observed[1].observed_text = null;
  } else if (fixture.review_mutation === 'hallucinated_label_pass') {
    const observed = review.post_render_checks.checks.find((entry) => entry.check === 'factual').observed_text_items;
    observed[0].observed_text = observed[0].declared_text;
    observed.push({ source_ref: 'observed:unattributed:entry-level', declared_text: null, observed_text: 'ENTRY LEVEL' });
  } else if (fixture.review_mutation === 'unreadable_display_size_pass') {
    const observed = review.post_render_checks.checks.find((entry) => entry.check === 'factual').observed_text_items;
    observed[0].observed_text = observed[0].declared_text;
    review.post_render_checks.checks.find((entry) => entry.check === 'mobile').mobile_legibility.detail_access_path = 'none';
  }
  return review;
}

export function validateVisualFixture(fixture) {
  const out = validate(fixture, schema('visual-negative-fixture.schema.json'))
    .map((e) => ({ code: REVIEW_CODES.SCHEMA, message: e.message }));
  if (out.length) return out;
  if (fixture.status === 'positive_pending_owner_input') {
    if (fixture.asset_ref !== null || fixture.asset_sha256 !== null || fixture.owner_judgement !== null || !String(fixture.blocking_reason).includes('SUE-643')) {
      out.push({ code: REVIEW_CODES.POSITIVE, message: 'positive slots are inert pending SUE-643' });
    }
    return out;
  }

  // An owner-positive slot is only meaningful with a real asset, an owner
  // acceptance, and a review record to compare against. Anything less is a
  // pending slot, not a positive reference.
  if (fixture.status === 'owner_positive' && (fixture.owner_judgement !== 'accepted' || !fixture.asset_ref || !fixture.asset_sha256 || !fixture.review_record)) {
    out.push({ code: REVIEW_CODES.POSITIVE, message: 'owner_positive requires an accepted owner judgement, an asset, a digest, and a review record' });
  }
  if (fixture.status === 'negative' && fixture.owner_judgement === 'accepted') {
    out.push({ code: REVIEW_CODES.POSITIVE, message: 'a negative fixture cannot carry an accepted owner judgement' });
  }
  try {
    const path = containedFile(fixture.asset_ref);
    if (!path) throw new Error();
    if (digestOf(path) !== fixture.asset_sha256) out.push({ code: REVIEW_CODES.FIXTURE_HASH, message: 'asset hash mismatch' });
  } catch {
    out.push({ code: REVIEW_CODES.FIXTURE_PATH, message: 'asset must be repository-contained regular file' });
  }
  if (fixture.expected_review_issue !== undefined) {
    if (fixture.status !== 'negative' || !fixture.review_record) {
      out.push({ code: REVIEW_CODES.POSITIVE, message: 'semantic negative fixtures require negative status and a review_record' });
    } else {
      const reviewPath = containedFile(fixture.review_record);
      let review;
      try { review = reviewPath ? JSON.parse(readFileSync(reviewPath, 'utf8')) : null; } catch { review = null; }
      if (!review) {
        out.push({ code: REVIEW_CODES.FIXTURE_PATH, message: 'semantic negative fixture review_record must resolve to repository-contained JSON' });
      } else {
        const reviewIssues = validateVisualReview(materializeVisualSemanticNegativeReview(fixture, review));
        if (!reviewIssues.some((entry) => entry.code === fixture.expected_review_issue)) {
          out.push({ code: REVIEW_CODES.POSITIVE, message: `semantic negative fixture did not produce expected review issue ${fixture.expected_review_issue}` });
        }
        if (review.asset_ref !== fixture.asset_ref || review.asset_sha256 !== fixture.asset_sha256) {
          out.push({ code: REVIEW_CODES.POSITIVE, message: 'semantic negative fixture and review_record must identify the same asset bytes' });
        }
      }
    }
  }
  return out;
}

export { VISUAL_FAILURE_ACTIONS };
