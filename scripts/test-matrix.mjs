#!/usr/bin/env node
/**
 * Regression test for the cross-source matrix — AES-P5.2 (SUE-458).
 */

import { readFileSync } from 'node:fs';
import { cases, runCase } from './run-matrix.mjs';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const results = new Map(cases.map((c) => [c.case, { c, r: runCase(c) }]));

console.log('every source class enters the same system');
{
  check('three source classes are covered',
    new Set(cases.map((c) => c.source_class)).size === 3);
  check('at least two content-type profiles are exercised',
    new Set(cases.map((c) => c.article.content_type)).size >= 2);
  check('every case validates at every stage',
    [...results.values()].every(({ r }) => r.ok),
    JSON.stringify([...results.values()].flatMap(({ r }) => r.issues)));
  check('no case needs custom handling — the same four validators run on all',
    [...results.values()].every(({ r }) => ['source', 'article', 'profile', 'hitl'].every((s) => s in r.stages)));
}

console.log('NO_ARTICLE is a valid outcome');
{
  const { c, r } = results.get('B');
  check('case B returns NO_ARTICLE', r.outcome === 'NO_ARTICLE');
  check('and it counts as passing', r.ok);
  check('with a recorded reason', (c.article.no_article_reason ?? '').length > 40);
  check('accepted by a human at frame review',
    c.review.reviews.some((x) => x.stage === 'frame' && x.decision === 'accept'));
  check('and no finalization was produced', !c.review.finalization);
}

console.log('provenance survives to finalization');
{
  for (const id of ['A', 'C']) {
    const { c } = results.get(id);
    const manifestIds = new Set(c.sources.sources.map((s) => s.source_id));
    check(`case ${id}: every source in the article resolves in the manifest`,
      c.article.source_set.every((s) => manifestIds.has(s.source_id)));
    check(`case ${id}: the finalization names its sources`,
      (c.review.finalization.source_ids ?? []).length > 0 &&
      c.review.finalization.source_ids.every((s) => manifestIds.has(s)));
    check(`case ${id}: finalization traces to the frame and the verification`,
      Number.isInteger(c.review.finalization.frame_version) && Boolean(c.review.finalization.verification_at));
    check(`case ${id}: finalization targets draft, never published`,
      c.review.finalization.target_status === 'draft');
  }
}

console.log('human feedback produces controlled revision');
{
  const { c } = results.get('C');
  const draft = c.review.reviews.find((x) => x.stage === 'draft');
  check('the draft review requested a revision rather than a restart', draft.decision === 'revise');
  check('the feedback was routed to verification, not to the prose',
    draft.feedback.some((f) => f.changes === 'verification' && f.material === true));
  check('a verification review followed it',
    c.review.reviews.findIndex((x) => x.stage === 'verification') >
    c.review.reviews.indexOf(draft));
  check('the article advanced one version, not back to zero',
    c.review.finalization.article_version === 2);
}

console.log('the Project profile rule fires');
{
  const { c } = results.get('C');
  check('the GitHub source carries a pinned ref',
    c.article.source_set.every((s) => !s.source_id.startsWith('src:github:') || s.pinned_ref));
  check('README prose was challenged rather than cited as fact',
    c.review.reviews.some((x) => (x.feedback ?? []).some((f) => /README/i.test(f.text) && f.material)));
}

console.log('limits are recorded');
{
  const readme = new URL('../evals/matrix/README.md', import.meta.url);
  const text = readFileSync(readme, 'utf8');
  check('the matrix states it is structural, not a live run',
    /structurally faithful cases, not live runs/i.test(text));
  check('it lists what it does not prove',
    /does \*\*not\*\* prove/.test(text));
}

console.log(failures === 0 ? '\nmatrix regression: PASS' : `\nmatrix regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
