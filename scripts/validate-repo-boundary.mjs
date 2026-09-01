#!/usr/bin/env node
/**
 * validate-repo-boundary — AES-P0.1 (SUE-434)
 *
 * Fail-closed enforcement of the public repository charter. Exits non-zero on
 * any violation of "Never committed" in
 * docs/architecture/REPOSITORY-CONTRACT.md.
 *
 * Usage: node scripts/validate-repo-boundary.mjs [root]
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { scan } from './lib/boundary-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

// Deny fixtures deliberately contain forbidden material; they are the
// validator's own test data and are excluded from the repository scan.
const EXCLUDE = ['scripts/fixtures'];

const root = resolve(process.argv[2] ?? REPO_ROOT);
const { files, violations } = scan(root, { exclude: root === REPO_ROOT ? EXCLUDE : [] });

if (violations.length === 0) {
  console.log(`boundary: PASS — ${files.length} files scanned, 0 violations (root: ${root})`);
  process.exit(0);
}

console.error(`boundary: FAIL — ${violations.length} violation(s) in ${files.length} files scanned`);
for (const v of violations) {
  console.error(`  [${v.rule}] ${v.file} — ${v.detail}`);
}
console.error('\nSee docs/architecture/REPOSITORY-CONTRACT.md ("Never committed").');
process.exit(1);
