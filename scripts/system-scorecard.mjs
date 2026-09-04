#!/usr/bin/env node
/**
 * system-scorecard — AES-V2.14 (SUE-573)
 *
 * Evaluates the Editorial Learning Core itself — complexity, cost, entropy,
 * governance risk, adaptability — never an article or artifact's quality.
 * See evals/system/README.md for the evaluation contract and
 * scripts/lib/system-eval-core.mjs for the implementation.
 *
 * This is deliberately an on-demand tool, not a per-change gate: it is not
 * wired into `npm run validate` or `npm test`. The full evaluation runs only
 * when the owner asks, at a declared evidence threshold, on a major
 * model/profile/architecture change, or at the V3 readiness gate (SUE-574).
 *
 * Usage:
 *   node scripts/system-scorecard.mjs --validate   validate every snapshot + current.json + freshness
 *   node scripts/system-scorecard.mjs --rebuild     regenerate evals/system/current.json from the newest snapshot
 *   node scripts/system-scorecard.mjs --check       fail if current.json differs from a fresh rebuild (staleness gate)
 */

import { writeFileSync } from 'node:fs';
import { PATHS, canonicalJson, checkCurrentFreshness, rebuildCurrent, validateAll } from './lib/system-eval-core.mjs';

const mode = process.argv[2];

function reportIssues(issues) {
  if (issues.length === 0) {
    console.log('system-scorecard: PASS — 0 issues');
    return 0;
  }
  console.error(`system-scorecard: FAIL — ${issues.length} issue(s)`);
  for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  return 1;
}

if (mode === '--validate') {
  process.exit(reportIssues(validateAll()));
}

if (mode === '--rebuild') {
  try {
    const current = rebuildCurrent();
    writeFileSync(PATHS.currentPath, canonicalJson(current));
    console.log(`system-scorecard: rebuilt ${PATHS.currentPath} from ${current.derived_from_snapshot}`);
    process.exit(0);
  } catch (err) {
    console.error(`system-scorecard: FAIL — ${err.message}`);
    process.exit(1);
  }
}

if (mode === '--check') {
  try {
    const fresh = checkCurrentFreshness();
    if (fresh.matches) {
      console.log('system-scorecard: PASS — evals/system/current.json is fresh');
      process.exit(0);
    }
    console.error('system-scorecard: FAIL — evals/system/current.json is stale relative to evals/system/snapshots/');
    console.error('  run `node scripts/system-scorecard.mjs --rebuild`');
    process.exit(1);
  } catch (err) {
    console.error(`system-scorecard: FAIL — ${err.message}`);
    process.exit(1);
  }
}

console.error('usage: node scripts/system-scorecard.mjs --validate | --rebuild | --check');
process.exit(2);
