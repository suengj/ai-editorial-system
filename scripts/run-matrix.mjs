#!/usr/bin/env node
/**
 * run-matrix — AES-P5.2 (SUE-458)
 *
 * Runs one representative case per source class through the whole control
 * plane: source manifest → frame/no-article → verification → profile →
 * HITL record → finalization.
 *
 * The point is not that three articles exist. It is that three *different*
 * source classes enter the same system with no one-off handling, and that a
 * legitimate NO_ARTICLE is carried through as a success.
 *
 * Usage: node scripts/run-matrix.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './lib/source-contract-core.mjs';
import { validateArticle } from './lib/article-contract-core.mjs';
import { validateAgainstProfile } from './lib/profile-core.mjs';
import { validateReviewRecord } from './lib/hitl-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MATRIX = resolve(ROOT, 'evals/matrix');

/** Case A reuses the worked example, which is the YouTube-corpus path. */
const bundle = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/article-artifact.example.json'), 'utf8'));
const caseA = {
  case: 'A',
  name: 'YouTube corpus, several summaries into one thesis',
  source_class: 'youtube_summary',
  expected_outcome: 'ARTICLE',
  sources: JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/source-manifest.example.json'), 'utf8')),
  article: bundle.article,
  review: JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/review-record.example.json'), 'utf8')),
};

const cases = [
  caseA,
  JSON.parse(readFileSync(resolve(MATRIX, 'case-b-no-article.json'), 'utf8')),
  JSON.parse(readFileSync(resolve(MATRIX, 'case-c-project.json'), 'utf8')),
];

export function runCase(c) {
  const stages = {};
  stages.source = validateManifest(c.sources);
  stages.article = validateArticle(c.article);
  stages.profile = c.article.state === 'no_article' ? [] : validateAgainstProfile(c.article);
  stages.hitl = validateReviewRecord(c.review, c.article);

  const outcome = c.article.state === 'no_article' ? 'NO_ARTICLE'
    : c.review.finalization ? 'FINALIZED' : 'ARTICLE';

  const issues = Object.entries(stages).flatMap(([stage, list]) =>
    list.map((i) => ({ stage, ...i })));

  return { stages, outcome, issues, ok: issues.length === 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`cross-source acceptance matrix — ${cases.length} source classes\n`);
  let failed = 0;

  for (const c of cases) {
    const r = runCase(c);
    const expectedOk = r.outcome === 'NO_ARTICLE'
      ? c.expected_outcome === 'NO_ARTICLE'
      : c.expected_outcome === 'ARTICLE';

    const status = r.ok && expectedOk ? 'OK  ' : 'FAIL';
    if (!(r.ok && expectedOk)) failed += 1;

    console.log(`${status}  ${c.case}. ${c.name}`);
    console.log(`        class: ${c.source_class}   type: ${c.article.content_type}   outcome: ${r.outcome}`);
    for (const i of r.issues) console.log(`        [${i.stage}/${i.code}] ${i.message}`);
  }

  const types = new Set(cases.map((c) => c.article.content_type));
  console.log(`\ncontent-type profiles exercised: ${[...types].sort().join(', ')}`);
  console.log(`source classes: ${[...new Set(cases.map((c) => c.source_class))].join(', ')}`);
  console.log(failed === 0 ? '\nmatrix: PASS' : `\nmatrix: FAIL (${failed})`);
  process.exit(failed === 0 ? 0 : 1);
}

export { cases };
