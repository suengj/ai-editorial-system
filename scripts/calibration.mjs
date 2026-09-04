#!/usr/bin/env node
/**
 * calibration — AES-V2.10 (SUE-568)
 *
 * Versioned calibration snapshots, drift candidates, and the experiment
 * ledger. See calibration/README.md and calibration/CALIBRATION-PROTOCOL.md
 * for the write protocol and scripts/lib/calibration-core.mjs for the
 * implementation.
 *
 * Usage:
 *   node scripts/calibration.mjs --validate   validate every record + current.json freshness
 *   node scripts/calibration.mjs --rebuild    regenerate calibration/current.json
 *   node scripts/calibration.mjs --check      fail if the on-disk current.json differs from a fresh rebuild
 */

import { writeFileSync } from 'node:fs';
import { PATHS, checkCurrentFreshness, rebuildCurrent, validateAll } from './lib/calibration-core.mjs';

const mode = process.argv[2];

function reportIssues(issues) {
  if (issues.length === 0) {
    console.log('calibration: PASS — 0 issues');
    return 0;
  }
  console.error(`calibration: FAIL — ${issues.length} issue(s)`);
  for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  return 1;
}

if (mode === '--validate') {
  process.exit(reportIssues(validateAll()));
}

if (mode === '--rebuild') {
  writeFileSync(PATHS.currentPath, rebuildCurrent());
  console.log(`calibration: rebuilt ${PATHS.currentPath}`);
  process.exit(0);
}

if (mode === '--check') {
  const { matches } = checkCurrentFreshness();
  if (matches) {
    console.log('calibration: PASS — calibration/current.json is fresh');
    process.exit(0);
  }
  console.error('calibration: FAIL — calibration/current.json is stale relative to calibration/versions/');
  process.exit(1);
}

console.error('usage: node scripts/calibration.mjs --validate | --rebuild | --check');
process.exit(2);
