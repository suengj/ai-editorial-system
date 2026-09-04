#!/usr/bin/env node
/**
 * registry — AES-V2.3 (SUE-561)
 *
 * Agent-managed Reference and Feedback Registry. See
 * references/REFERENCE-EVALUATION-PROTOCOL.md for the write protocol and
 * scripts/lib/registry-core.mjs for the implementation.
 *
 * Usage:
 *   node scripts/registry.mjs --validate   validate every record + index freshness
 *   node scripts/registry.mjs --rebuild    regenerate references/index.json and feedback/index.json
 *   node scripts/registry.mjs --check      fail if the on-disk index differs from a fresh rebuild
 */

import { writeFileSync } from 'node:fs';
import {
  PATHS, checkIndexFreshness, buildReferencesIndex, buildFeedbackIndex,
  rebuildIndexes, validateAll,
} from './lib/registry-core.mjs';

const mode = process.argv[2];

function reportIssues(issues) {
  if (issues.length === 0) {
    console.log('registry: PASS — 0 issues');
    return 0;
  }
  console.error(`registry: FAIL — ${issues.length} issue(s)`);
  for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  return 1;
}

if (mode === '--validate') {
  process.exit(reportIssues(validateAll()));
}

if (mode === '--rebuild') {
  const { references, feedback } = rebuildIndexes();
  writeFileSync(PATHS.referencesIndex, references);
  writeFileSync(PATHS.feedbackIndex, feedback);
  console.log(`registry: rebuilt ${PATHS.referencesIndex}`);
  console.log(`registry: rebuilt ${PATHS.feedbackIndex}`);
  process.exit(0);
}

if (mode === '--check') {
  const ref = checkIndexFreshness(() => buildReferencesIndex(), PATHS.referencesIndex);
  const fb = checkIndexFreshness(() => buildFeedbackIndex(), PATHS.feedbackIndex);
  let failed = 0;
  if (ref.matches) console.log('registry: PASS — references/index.json is fresh');
  else { failed += 1; console.error('registry: FAIL — references/index.json is stale relative to references/evaluations/'); }
  if (fb.matches) console.log('registry: PASS — feedback/index.json is fresh');
  else { failed += 1; console.error('registry: FAIL — feedback/index.json is stale relative to feedback/records/'); }
  process.exit(failed ? 1 : 0);
}

console.error('usage: node scripts/registry.mjs --validate | --rebuild | --check');
process.exit(2);
