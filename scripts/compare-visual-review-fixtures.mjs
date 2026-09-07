#!/usr/bin/env node
/**
 * Visual-quality comparison report — SUE-647.
 *
 * Reports whether the owner-positive references can be compared against the
 * registered negative fixtures on aesthetic/narrative dimensions.
 *
 * This is a REPORT, not a gate. It is deliberately not wired into `npm test`
 * or `npm run validate`, because the positive side is legitimately empty until
 * the owner supplies the two AI-labor assets (SUE-643). It exits 2 —
 * UNRUNNABLE — rather than 0, so no caller can read a missing comparison as a
 * passing one.
 *
 * A positive slot counts as filled only when every one of these holds:
 *   - it validates as a fixture record;
 *   - its status is `owner_positive` (never `negative`, never
 *     `positive_pending_owner_input`);
 *   - its asset is a repository-contained regular file whose recomputed
 *     SHA-256 matches the declared digest;
 *   - its asset is not already registered as a negative fixture;
 *   - its `review_record` resolves to a fully valid visual-review record whose
 *     subject asset and digest match the slot.
 *
 * The review record is validated in full — including the mandatory feedback
 * routing contract — not merely against its JSON Schema. A schema-shaped review
 * that fails feedback resolution does not count as a positive reference.
 */

import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { validateVisualFixture, validateVisualReview } from './lib/visual-review-core.mjs';

const ROOT = process.cwd();
const SLOTS = process.env.VISUAL_POSITIVE_SLOTS
  ?? 'evals/visual-review/fixtures/positive-slots.json';
const NEGATIVE_DIR = 'evals/visual-review/fixtures/negative';
// Overridable so a test can supply its own corpus without writing into the
// checkout. Production always uses the committed registry.
const FEEDBACK_DIR = process.env.VISUAL_FEEDBACK_DIR
  ? resolve(process.env.VISUAL_FEEDBACK_DIR)
  : undefined;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Resolve a repository-relative path, refusing anything that escapes it. */
function containedFile(ref) {
  const path = resolve(ROOT, ref);
  if (!path.startsWith(ROOT + sep)) return null;
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) return null;
  if (!realpathSync(path).startsWith(ROOT + sep)) return null;
  return path;
}

const digestOf = (path) =>
  `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;

function registeredNegativeAssets() {
  try {
    return new Set(readdirSync(resolve(ROOT, NEGATIVE_DIR))
      .filter((n) => n.endsWith('.json'))
      .map((n) => readJson(resolve(ROOT, NEGATIVE_DIR, n)).asset_ref));
  } catch {
    return new Set();
  }
}

/** @returns {string|null} the reason this slot is not usable, or null if it is. */
function slotProblem(slot, negatives) {
  const issues = validateVisualFixture(slot);
  if (issues.length > 0) return `slot does not validate (${issues[0].code})`;
  if (slot.status !== 'owner_positive') {
    return `slot status is "${slot.status}", not owner_positive`;
  }
  if (!slot.asset_ref || !slot.asset_sha256) return 'slot has no asset or digest';

  let path;
  try {
    path = containedFile(slot.asset_ref);
  } catch {
    path = null;
  }
  if (path === null) return 'asset is not a repository-contained regular file';
  if (digestOf(path) !== slot.asset_sha256) return 'asset digest does not match';
  if (negatives.has(slot.asset_ref)) {
    return 'asset is registered as a negative fixture and cannot be a positive reference';
  }

  if (!slot.review_record) return 'slot names no visual review record';
  let reviewPath;
  try {
    reviewPath = containedFile(slot.review_record);
  } catch {
    reviewPath = null;
  }
  if (reviewPath === null) return 'review_record is not a repository-contained regular file';

  let review;
  try {
    review = readJson(reviewPath);
  } catch {
    return 'review_record is not readable JSON';
  }
  const reviewIssues = validateVisualReview(review, { feedbackDir: FEEDBACK_DIR });
  if (reviewIssues.length > 0) return `review_record does not validate (${reviewIssues[0].code})`;
  if (review.asset_ref !== slot.asset_ref || review.asset_sha256 !== slot.asset_sha256) {
    return 'review_record is about a different asset';
  }
  return null;
}

const slots = readJson(resolve(ROOT, SLOTS)).slots ?? [];
const negatives = registeredNegativeAssets();
const problems = slots.map((slot) => {
  const problem = slotProblem(slot, negatives);
  return problem === null ? null : `${slot.fixture_id ?? '(unnamed slot)'}: ${problem}`;
}).filter(Boolean);

if (slots.length === 0) problems.push('no owner-positive slots are declared');
if (negatives.size === 0) problems.push('no negative fixtures are registered');

if (problems.length > 0) {
  console.log(
    'UNRUNNABLE: SUE-647 cannot check that the owner-positive AI-labor references '
    + 'avoid dashboardization/ui_mimicry/flat_svg_aesthetic, because the positive '
    + 'side is not usable. Owner assets pending SUE-643.',
  );
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(2);
}

console.log(`COMPARABLE: ${slots.length} owner-positive reference(s) against ${negatives.size} negative fixture(s)`);
