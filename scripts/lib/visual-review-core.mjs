import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { validate } from './json-schema-lite.mjs';
import { listFeedbackFiles, validateFeedbackFile } from './registry-core.mjs';
import { VISUAL_FAILURE_ACTIONS, expectedVisualFailureAction } from './visual-job-core.mjs';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const schema = (name) => JSON.parse(readFileSync(resolve(ROOT, 'schemas', name), 'utf8'));

export const REVIEW_CODES = Object.freeze({
  FEEDBACK_INVALID: 'visual-review-feedback-record-invalid',
  SCHEMA: 'visual-review-schema',
  DIMENSIONS: 'visual-review-dimensions',
  ROUTE: 'visual-review-route',
  PRIMARY_TAG: 'visual-review-primary-tag',
  ASSET_PATH: 'visual-review-asset-path',
  ASSET_HASH: 'visual-review-asset-hash',
  MOBILE_ASSET_PATH: 'visual-review-mobile-asset-path',
  MOBILE_ASSET_HASH: 'visual-review-mobile-asset-hash',
  FEEDBACK: 'visual-review-feedback-route-invalid',
  FEEDBACK_UNRESOLVED: 'visual-review-feedback-unresolved',
  FEEDBACK_SUBJECT: 'visual-review-feedback-subject',
  FEEDBACK_BASIS: 'visual-review-feedback-basis',
  FEEDBACK_OWNER: 'visual-review-feedback-owner',
  FEEDBACK_MODALITY: 'visual-review-feedback-modality',
  FIXTURE_PATH: 'visual-fixture-path',
  FIXTURE_HASH: 'visual-fixture-hash',
  POSITIVE: 'visual-positive-slot-invalid',
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

export function validateVisualReview(record, { feedbackDir } = {}) {
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

  const route = expectedVisualReviewRoute(record.primary_tag);
  if (record.verdict !== 'PASS_TO_HUMAN_REVIEW' && record.primary_tag !== null && !record.defect_tags.includes(record.primary_tag)) {
    out.push({ code: REVIEW_CODES.PRIMARY_TAG, message: 'primary_tag must be one of defect_tags for a non-PASS review' });
  }
  if (record.verdict === 'PASS_TO_HUMAN_REVIEW'
    ? (record.primary_tag !== null || record.next_action !== 'human_judgement')
    : (!route || route.failure_class !== record.failure_class || route.next_action !== record.next_action)) {
    out.push({ code: REVIEW_CODES.ROUTE, message: 'verdict/tag route mismatch' });
  }

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
  return out;
}

export { VISUAL_FAILURE_ACTIONS };
