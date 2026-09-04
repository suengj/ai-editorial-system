#!/usr/bin/env node
/**
 * validate-corpus — AES-V2.6 (SUE-564)
 *
 * Validates every entry under evals/real-output-corpus/entries/ against
 * schemas/corpus-entry.schema.json plus the house rules a schema alone
 * cannot express (no article body, reference_eligible needs a rationale).
 *
 * Usage: node scripts/validate-corpus.mjs [entries-dir]
 */

import { relative, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTRIES_DIR, listEntryFiles, loadSchema, validateEntryFile } from './lib/corpus-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2] ?? ENTRIES_DIR);
const schema = loadSchema();
const files = listEntryFiles(dir);

if (files.length === 0) {
  console.error(`corpus: FAIL — no entry found under ${relative(REPO_ROOT, dir) || dir}`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const label = relative(REPO_ROOT, file);
  const issues = validateEntryFile(file, schema);
  if (issues.length === 0) {
    console.log(`corpus: PASS — ${label}`);
    continue;
  }
  failed += 1;
  console.error(`corpus: FAIL — ${label} (${issues.length} issue(s))`);
  for (const i of issues) console.error(`  [${i.code}] ${i.message}`);
}

if (failed) {
  console.error('\nSee evals/real-output-corpus/README.md.');
  process.exit(1);
}
console.log(`\ncorpus: PASS — ${files.length} entries scanned`);
process.exit(0);
