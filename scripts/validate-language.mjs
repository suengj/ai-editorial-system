#!/usr/bin/env node
/**
 * validate-language — AES-V2.17 (SUE-607)
 *
 * Validates every language pack under the `language` axis (loaded through
 * the axis registry, editorial/profiles/axes.json — never a hardcoded path)
 * against schemas/language-pack.schema.json plus the authority-class,
 * genre/audience orthogonality, promotion-evidence, and holdout-leakage
 * rules in docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md.
 *
 * Usage: node scripts/validate-language.mjs
 */

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, validateAll } from './lib/language-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(REPO_ROOT, p) || p;

const { files, issues, notes, ruleCount } = validateAll();

if (files.length === 0) {
  console.log('language: PASS — 0 pack(s) found under editorial/profiles/language/ (nothing to validate yet)');
  process.exit(0);
}

for (const n of notes) {
  console.log(`language: NOTE — [${n.code}] ${rel(n.file ?? ROOT)} ${n.where}: ${n.message}`);
}

if (issues.length === 0) {
  console.log(`language: PASS — ${files.length} pack(s), ${ruleCount} rule(s)${notes.length ? `, ${notes.length} note(s)` : ''}`);
  process.exit(0);
}

console.error(`language: FAIL — ${issues.length} issue(s) across ${files.length} pack(s)`);
for (const i of issues) {
  console.error(`  [${i.code}] ${rel(i.file ?? ROOT)} ${i.where}: ${i.message}`);
}
console.error('\nSee docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md and schemas/language-pack.schema.json.');
process.exit(1);
