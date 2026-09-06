#!/usr/bin/env node
/**
 * plate-verify regression — AES-V2.16b / SUE-628.
 *
 * The point of this suite is one demonstration: a composition plan can be
 * written to describe a plate honestly or dishonestly, and until an asset
 * exists nothing can tell the difference. Independent review showed the
 * rejected SUE-570 plate passing the plan validator cleanly after six
 * author-written fields were changed and nothing about the picture was.
 *
 * These tests run that same laundered plan against the actual rejected SVG.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, DEFAULT_AVAILABLE_PX, TYPE_FLOOR_PX,
  effectiveTypePx, measureSvg, verifyPlateAgainstPlan,
} from './lib/plate-verify-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FIXTURES = resolve(ROOT, 'evals/negative-baselines/assets');

let failures = 0;
const check = (name, ok) => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.log(`  FAIL  ${name}`); }
};

const asset = (n) => readFileSync(resolve(FIXTURES, `${n}.svg`), 'utf8');
const codesOf = (plan, svg) => verifyPlateAgainstPlan(plan, svg).map((i) => i.code);

// A plan that describes the rejected plate the way a careful author would WANT
// it described: inside every ceiling, declaring a real mobile strategy. Every
// number here is a lie about the asset, and the plan validator cannot know.
const launderedPlan = {
  plan_id: 'plate:sue570-laundered',
  composition: {
    label_strategy: { max_labels: 8, stable_only: true },
    enclosure_budget: { parallel_category_boundaries: 4, enclosures_planned: 4, justification: 'four parallel modules' },
    mobile_strategy: { strategy: 'reflow', viewport_px: 390, min_type_px: 14 },
  },
};

console.log('measurement reproduces the hand-computed forensics');
{
  const m = measureSvg(asset('tools-report-infographic'));
  check('the rejected infographic measures 22 <text> elements', m.textCount === 22);
  check('the rejected infographic measures 12 container rects, background excluded', m.enclosureCount === 12);
  check('its intrinsic width is 720px', m.intrinsicWidth === 720);
  check('it carries width/height alongside viewBox, so it can only scale', m.hasFixedSize === true);

  const chart = measureSvg(asset('news-jp-us-10y-divergence'));
  check('the accepted chart measures zero enclosures — grouping is alignment, not boxes', chart.enclosureCount === 0);
  check('its data-point circles are not counted as enclosures', chart.enclosureCount === 0);
  check('it omits width/height, so it is fluid rather than pinned', chart.hasFixedSize === false);
}

console.log('\nthe laundered plan survives the plan validator but not the asset');
{
  const found = codesOf(launderedPlan, asset('tools-report-infographic'));
  check('a plan claiming 8 labels is caught drawing 22', found.includes(CODES.LABEL_COUNT));
  check('a plan claiming 4 enclosures is caught drawing 12', found.includes(CODES.ENCLOSURE_COUNT));
  check('a plan claiming 14px effective type is caught rendering below the floor', found.includes(CODES.TYPE_FLOOR));
  check('the overstatement itself is named, not just the floor breach', found.includes(CODES.TYPE_OVERSTATED));
  check('a plan claiming "reflow" is caught on an asset pinned to one size', found.includes(CODES.SCALE_ONLY));
  check('every self-reported quantity the asset can contradict is contradicted', found.length >= 5);
}

console.log('\nthe verifier does not fire on an asset that keeps its promises');
{
  // Same claims, measured against an asset that actually meets them: a small
  // fluid canvas whose type survives the target viewport.
  const honest = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 200">
    <style>.a { font-size: 15px; }</style>
    <text class="a" x="10" y="20">A</text><text class="a" x="10" y="40">B</text>
  </svg>`;
  const found = codesOf(launderedPlan, honest);
  check('an asset inside every declared ceiling produces no issues', found.length === 0);
}

console.log('\nthe mobile floor is measured, not asserted');
{
  // Every non-concept asset in the SUE-570 set, including the two the owner
  // called conditionally acceptable. The defect is systemic.
  const set = [
    'tools-report-infographic', 'tools-news-diagram',
    'report-repricing-vs-crisis-matrix', 'news-jp-us-10y-divergence',
    'child-rate-vs-worry-bars',
  ];
  const effective = set.map((n) => {
    const m = measureSvg(asset(n));
    return {
      n,
      lo: effectiveTypePx(m.smallestTypePx, m.intrinsicWidth),
      hi: effectiveTypePx(m.largestTypePx, m.intrinsicWidth),
    };
  });
  check('no asset in the set reaches the 14px floor even at its LARGEST type',
    effective.every((e) => e.hi < TYPE_FLOOR_PX));
  check('the accepted chart lane fails the floor exactly as the rejected lane does',
    effective.find((e) => e.n === 'news-jp-us-10y-divergence').hi < TYPE_FLOOR_PX);

  const lo = Math.min(...effective.map((e) => e.lo));
  const hi = Math.max(...effective.map((e) => e.hi));
  const r = (v) => Math.round(v * 10) / 10;
  check(`the published range is 5.2-10.1px, not the 5.2-8.7px first reported (measured ${r(lo)}-${r(hi)})`,
    r(lo) === 5.2 && r(hi) === 10.1);
  console.log(`        measured at ${DEFAULT_AVAILABLE_PX}px: ${r(lo)}px to ${r(hi)}px across ${set.length} assets`);
}

console.log(failures === 0 ? '\nplate-verify: ALL PASS' : `\nplate-verify: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
