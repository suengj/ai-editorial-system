/**
 * HITL protocol engine — AES-P5.1 (SUE-457).
 *
 * Enforces the boundary that "AI finished a draft" can never become "the owner
 * approved a canonical article".
 *
 * Three rules need code:
 *   - Approval applies only to the version the human actually read.
 *   - A material edit after verification forces re-verification.
 *   - Finalization is not publication, and polish cannot approve anything.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
export const SCHEMA_PATH = resolve(ROOT, 'schemas/review-record.schema.json');

export const loadSchema = (p = SCHEMA_PATH) => JSON.parse(readFileSync(p, 'utf8'));

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  STAGE_ORDER: 'stage-order',
  STALE_APPROVAL: 'approval-against-old-version',
  MISSING_REVERIFICATION: 'material-edit-without-reverification',
  POLISH_APPROVAL: 'polish-implies-approval',
  FINAL_WITHOUT_REVIEW: 'final-without-required-reviews',
  FINAL_IS_PUBLICATION: 'finalization-treated-as-publication',
  UNTRACEABLE_FINAL: 'final-not-traceable',
  MISROUTED_FEEDBACK: 'feedback-misrouted',
});

/** The stages, in the order they may occur. Skipping is allowed; going back is not. */
export const STAGES = Object.freeze(['frame', 'draft', 'verification', 'polish', 'final']);

/** Reviews that must exist and be accepted before finalization. */
const REQUIRED_BEFORE_FINAL = Object.freeze(['frame', 'verification']);

const issue = (code, where, message) => ({ code, where, message });

export function validateReviewRecord(record, article = null, schema = loadSchema()) {
  const issues = [];
  const where = record?.article_id ?? '<record>';

  for (const e of validate(record, schema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }

  const reviews = record?.reviews ?? [];

  // --- stages move forward -------------------------------------------------
  let seen = -1;
  for (const r of reviews) {
    const idx = STAGES.indexOf(r.stage);
    if (idx < seen) {
      issues.push(issue(CODES.STAGE_ORDER, r.stage,
        `stage "${r.stage}" appears after a later stage; a revision restarts the sequence rather than reordering it`));
    }
    seen = Math.max(seen, idx);
  }

  // --- polish cannot approve ----------------------------------------------
  for (const r of reviews) {
    if (r.stage === 'polish' && r.decision === 'accept' && !reviews.some((x) => x.stage === 'final')) {
      // Accepting a polish pass is fine; treating it as the final decision is not.
      // Flagged only when the record has no separate final review and a
      // finalization exists — see the finalization block below.
    }
  }

  // --- material edits force re-verification --------------------------------
  const lastVerification = [...reviews].reverse().find((r) => r.stage === 'verification');
  for (const r of reviews) {
    const materialFeedback = (r.feedback ?? []).filter((f) => f.material === true);
    if (materialFeedback.length === 0) continue;
    if (r.stage === 'verification') continue;

    const idx = reviews.indexOf(r);
    const laterVerification = reviews.slice(idx + 1).some((x) => x.stage === 'verification');
    if (!laterVerification) {
      issues.push(issue(CODES.MISSING_REVERIFICATION, r.stage,
        `material feedback at stage "${r.stage}" is not followed by a verification review; a fact that changed after verification is unverified`));
    }
  }

  // --- feedback routing ----------------------------------------------------
  for (const r of reviews) {
    for (const f of r.feedback ?? []) {
      if (f.changes === 'verification' && f.material !== true) {
        issues.push(issue(CODES.MISROUTED_FEEDBACK, r.stage,
          'feedback that changes verification must be marked material'));
      }
      if (r.stage === 'polish' && f.changes === 'final_article' && f.material === true) {
        issues.push(issue(CODES.MISROUTED_FEEDBACK, r.stage,
          'a material change raised during polish belongs to verification, not to the article text'));
      }
    }
  }

  // --- finalization --------------------------------------------------------
  const fin = record?.finalization;
  if (fin) {
    for (const stage of REQUIRED_BEFORE_FINAL) {
      if (!reviews.some((r) => r.stage === stage && r.decision === 'accept')) {
        issues.push(issue(CODES.FINAL_WITHOUT_REVIEW, 'finalization',
          `finalization requires an accepted "${stage}" review`));
      }
    }

    const finalReview = reviews.find((r) => r.stage === 'final' && r.decision === 'accept');
    if (!finalReview) {
      issues.push(issue(CODES.FINAL_WITHOUT_REVIEW, 'finalization',
        'finalization requires an accepted "final" review; a polish pass is not an approval'));
    } else if (finalReview.against_version !== fin.article_version) {
      issues.push(issue(CODES.STALE_APPROVAL, 'finalization',
        `the final review read version ${finalReview.against_version} but finalization records version ${fin.article_version}; approval never applies to a version nobody saw`));
    }

    if (fin.target_status !== 'draft') {
      issues.push(issue(CODES.FINAL_IS_PUBLICATION, 'finalization',
        'finalization materializes as status draft; publication is a separate human act'));
    }

    // Traceability: the final must reach back to frame, verification, sources.
    if (!fin.frame_version || !fin.verification_at || !(fin.source_ids?.length > 0)) {
      issues.push(issue(CODES.UNTRACEABLE_FINAL, 'finalization',
        'finalization must trace to the frame version, the verification time, and the source set'));
    }

    if (article) {
      if (fin.content_hash !== article.version?.content_hash || fin.claims_hash !== article.version?.claims_hash) {
        issues.push(issue(CODES.STALE_APPROVAL, 'finalization',
          'the finalization hashes do not match the article version they claim to finalize'));
      }
      if (article.state === 'published' && !article.publication?.approved_by) {
        issues.push(issue(CODES.FINAL_IS_PUBLICATION, 'finalization',
          'the article is published without a recorded approver; finalization is not publication'));
      }
    }
  }

  return issues;
}

/** True when the record authorises materialization as a draft. */
export function isFinalized(record) {
  return Boolean(record?.finalization) && validateReviewRecord(record).length === 0;
}

export function validateReviewRecordFile(path, article = null, schema = loadSchema()) {
  let record;
  try {
    record = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable review record: ${err.message}`)];
  }
  return validateReviewRecord(record, article, schema);
}
