#!/usr/bin/env node
/**
 * Regression test for the HITL protocol — AES-P5.1 (SUE-457).
 *
 * The property under test: no sequence of AI actions can produce an approval,
 * and no approval can attach to a version nobody read.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, STAGES, isFinalized, loadSchema, validateReviewRecord } from './lib/hitl-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = loadSchema();
const base = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/review-record.example.json'), 'utf8'));
const article = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/article-artifact.example.json'), 'utf8')).article;
const clone = () => JSON.parse(JSON.stringify(base));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const codes = (r) => validateReviewRecord(r, article, schema).map((i) => i.code);
const mutate = (fn) => { const r = clone(); fn(r); return codes(r); };

// --- positive -------------------------------------------------------------
console.log('worked record');
{
  check('the example record is valid', codes(base).length === 0, JSON.stringify(validateReviewRecord(base, article)));
  check('it is recognised as finalized', isFinalized(base) === true);
  check('it walks all five stages', STAGES.every((s) => base.reviews.some((r) => r.stage === s)));
  check('every review names a human reviewer', base.reviews.every((r) => r.reviewer && r.reviewer.length > 1));
  check('every review records the version it read', base.reviews.every((r) => Number.isInteger(r.against_version)));
}

// --- final is not published ----------------------------------------------
console.log('Final is not Published');
{
  check('target_status is a constant, not a default', schema.$defs.finalization.properties.target_status.const === 'draft');
  check('finalizing straight to published is rejected',
    mutate((r) => { r.finalization.target_status = 'published'; }).includes(CODES.SCHEMA));
  check('a published article with no recorded approver is rejected',
    validateReviewRecord(base, { ...article, state: 'published', publication: { target_status: 'published' } }, schema)
      .some((i) => i.code === CODES.FINAL_IS_PUBLICATION));
  check('the protocol document states the distinction',
    /Final ≠ Published/.test(readFileSync(resolve(ROOT, 'editorial/HITL-PROTOCOL.md'), 'utf8')));
}

// --- polish cannot approve ------------------------------------------------
console.log('polish cannot approve');
{
  check('finalization without an accepted final review is rejected',
    mutate((r) => { r.reviews = r.reviews.filter((x) => x.stage !== 'final'); })
      .includes(CODES.FINAL_WITHOUT_REVIEW));
  check('an accepted polish pass does not substitute for it',
    mutate((r) => {
      r.reviews = r.reviews.filter((x) => x.stage !== 'final');
    }).includes(CODES.FINAL_WITHOUT_REVIEW));
  check('finalization without an accepted frame review is rejected',
    mutate((r) => { r.reviews = r.reviews.filter((x) => x.stage !== 'frame'); })
      .includes(CODES.FINAL_WITHOUT_REVIEW));
  check('finalization without an accepted verification review is rejected',
    mutate((r) => { r.reviews = r.reviews.filter((x) => x.stage !== 'verification'); })
      .includes(CODES.FINAL_WITHOUT_REVIEW));
  check('a rejected verification does not count as accepted',
    mutate((r) => { r.reviews.find((x) => x.stage === 'verification').decision = 'revise'; })
      .includes(CODES.FINAL_WITHOUT_REVIEW));
}

// --- approval attaches to the version that was read ----------------------
console.log('approval applies to the version that was read');
{
  check('finalizing a version the final review did not read is rejected',
    mutate((r) => { r.finalization.article_version = 4; }).includes(CODES.STALE_APPROVAL));
  check('finalization hashes must match the article',
    mutate((r) => { r.finalization.claims_hash = 'f'.repeat(64); }).includes(CODES.STALE_APPROVAL));
}

// --- material edits force re-verification --------------------------------
console.log('material edits force re-verification');
{
  check('the worked record already demonstrates the loop',
    base.reviews.some((r) => r.stage === 'draft' && (r.feedback ?? []).some((f) => f.material)) &&
    base.reviews.some((r) => r.stage === 'verification'));

  check('material feedback with no later verification is rejected',
    mutate((r) => {
      r.reviews.find((x) => x.stage === 'polish').feedback = [
        { text: '이 숫자는 30%가 아니라 40%다.', changes: 'verification', material: true },
      ];
    }).includes(CODES.MISSING_REVERIFICATION));

  check('non-material feedback does not force it',
    !mutate((r) => {
      r.reviews.find((x) => x.stage === 'polish').feedback = [
        { text: '문단 순서를 바꿀 것.', changes: 'final_article', material: false },
      ];
    }).includes(CODES.MISSING_REVERIFICATION));
}

// --- routing --------------------------------------------------------------
console.log('feedback is routed to what it actually changes');
{
  check('verification-changing feedback must be material',
    mutate((r) => {
      r.reviews.find((x) => x.stage === 'draft').feedback[0].material = false;
    }).includes(CODES.MISROUTED_FEEDBACK));

  check('a material change raised during polish belongs to verification',
    mutate((r) => {
      r.reviews.find((x) => x.stage === 'polish').feedback = [
        { text: '숫자를 고쳐 두었다.', changes: 'final_article', material: true },
      ];
    }).includes(CODES.MISROUTED_FEEDBACK));

  check('the routing vocabulary covers every upstream artifact',
    schema.$defs.feedback.properties.changes.enum.length === 6);
}

// --- traceability ---------------------------------------------------------
console.log('the final article is traceable');
{
  for (const [field, label] of [['frame_version', 'the frame'], ['verification_at', 'the verification'], ['source_ids', 'the sources']]) {
    check(`a receipt not tracing to ${label} is rejected`,
      mutate((r) => { delete r.finalization[field]; }).includes(CODES.UNTRACEABLE_FINAL));
  }
  check('an empty source set is rejected',
    mutate((r) => { r.finalization.source_ids = []; }).includes(CODES.UNTRACEABLE_FINAL));
}

// --- stage order ----------------------------------------------------------
console.log('stages move forward');
{
  check('a stage appearing after a later one is rejected',
    mutate((r) => { r.reviews.push({ stage: 'draft', at: '2026-09-01T00:00:00Z', reviewer: 'Suengjae Hong', decision: 'accept', against_version: 3 }); })
      .includes(CODES.STAGE_ORDER));
}

// --- fail-closed ----------------------------------------------------------
console.log('fail-closed behaviour');
{
  check('an empty record is not a silent pass', codes({}).length > 0);
  check('a null record is not a silent pass', codes(null).length > 0);
  check('a record with reviews but no finalization is not finalized',
    isFinalized({ schema_version: '1.0.0', article_id: 'art:x', reviews: base.reviews }) === false);
}

console.log(failures === 0 ? '\nHITL regression: PASS' : `\nHITL regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
