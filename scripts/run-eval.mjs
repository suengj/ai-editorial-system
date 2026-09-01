#!/usr/bin/env node
/**
 * run-eval — AES-P3.2 (SUE-450)
 *
 * Runs the rubric's mechanical dimensions over the fixture corpus and prints
 * a scorecard. Cheap by design: no model call, no multi-agent review. It is
 * meant to be rerun after every rule or Skill change.
 *
 * Exits non-zero when a fixture's outcome contradicts its manifest
 * expectation — a golden fixture that hard-fails, or a negative fixture
 * expected to hard-fail that does not.
 *
 * Usage: node scripts/run-eval.mjs [--verbose]
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calibrate, compare, evaluate, loadManifest, loadRubric, UNSCORED } from './lib/eval-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FIXTURES = resolve(ROOT, 'evals/fixtures');
const verbose = process.argv.includes('--verbose');

const rubric = loadRubric();
const manifest = loadManifest();
const article = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/article-artifact.example.json'), 'utf8')).article;

const scorecards = new Map();
let mismatches = 0;

console.log(`editorial eval — ${manifest.fixtures.length} fixtures, ${rubric.dimensions.length} dimensions\n`);

for (const f of manifest.fixtures) {
  const body = readFileSync(resolve(FIXTURES, f.path), 'utf8');
  const baseline = f.paired_with
    ? readFileSync(resolve(FIXTURES, manifest.fixtures.find((x) => x.id === f.paired_with).path), 'utf8')
    : null;

  // Every fixture is evaluated in an article context: a body is judged as
  // part of a piece, and the uncertainty dimension is meaningless without one.
  const card = evaluate(body, {
    article,
    contentType: f.content_type,
    baseline,
    rubric,
  });
  scorecards.set(f.id, card);

  const expected = f.expected?.hard_fail === true;
  const ok = card.hard_fail === expected;
  if (!ok) mismatches += 1;

  const label = card.hard_fail ? 'HARD FAIL' : 'no hard fail';
  console.log(`${ok ? 'OK  ' : 'MISMATCH'}  ${f.id} (${f.kind}, ${f.content_type}) — ${label}, expected ${expected ? 'hard fail' : 'no hard fail'}`);

  if (verbose || !ok) {
    for (const [id, d] of Object.entries(card.dimensions)) {
      if (d.result === UNSCORED && !verbose) continue;
      console.log(`      ${id} ${d.name}: ${d.result}${d.evidence ? ` — ${d.evidence}` : ''}`);
    }
  }
}

// --- the comparison the method exists for --------------------------------
const paired = manifest.fixtures.find((f) => f.paired_with);
if (paired) {
  const before = scorecards.get(paired.paired_with);
  const after = scorecards.get(paired.id);
  const result = compare(before, after);
  console.log(`\ncomparison ${paired.paired_with} → ${paired.id}: ${result.verdict.toUpperCase()}`);
  for (const r of result.integrityRegressions) {
    console.log(`  integrity regression: ${r.id} ${r.name} (was ${r.baseline_was}) — ${r.evidence}`);
  }
  if (result.improvedDespiteRegression) {
    console.log('  note: editorial dimensions improved. The verdict is still a regression.');
  }
  if (result.verdict !== 'regression') {
    mismatches += 1;
    console.error('  MISMATCH — the paired fixture must be reported as a regression');
  }
}

// --- calibration against the known-bad baseline (SUE-417) ----------------
if (manifest.calibration) {
  const { baseline, calibrated } = manifest.calibration;
  const c = calibrate(scorecards.get(baseline), scorecards.get(calibrated));
  console.log(`\ncalibration ${baseline} → ${calibrated}: ${c.materially_better ? 'MATERIALLY BETTER' : 'NOT MATERIALLY BETTER'}`);
  console.log(`  hard fail: ${c.hard_fail.before} → ${c.hard_fail.after}`);
  console.log(`  reject ${c.rejects.before} → ${c.rejects.after}   fix ${c.fixes.before} → ${c.fixes.after}   flag ${c.flags.before} → ${c.flags.after}`);
  if (!c.materially_better) {
    mismatches += 1;
    console.error('  MISMATCH — the calibrated fixture must clear every blocking failure');
  }
}

console.log(mismatches === 0 ? '\neval: PASS' : `\neval: FAIL (${mismatches} mismatch(es))`);
process.exit(mismatches === 0 ? 0 : 1);
