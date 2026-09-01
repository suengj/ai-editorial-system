#!/usr/bin/env node
/**
 * validate-rights — AES-P0.4 (SUE-437)
 *
 * Validates the reference/benchmark catalog against
 * schemas/reference-catalog.schema.json and the invariants in
 * editorial/RIGHTS-AND-PROVENANCE.md.
 *
 * Usage: node scripts/validate-rights.mjs [catalog.json ...]
 * Default targets: references/catalog.json and the worked example.
 */

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchema, validateCatalogFile } from './lib/rights-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const DEFAULTS = [
  resolve(REPO_ROOT, 'references/catalog.json'),
  resolve(REPO_ROOT, 'schemas/examples/reference-catalog.example.json'),
];

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS).map((p) => resolve(p));
const schema = loadSchema();

let failed = 0;
for (const target of targets) {
  const issues = validateCatalogFile(target, schema);
  const label = relative(REPO_ROOT, target) || target;
  if (issues.length === 0) {
    console.log(`rights: PASS — ${label}`);
  } else {
    failed += 1;
    console.error(`rights: FAIL — ${label} (${issues.length} issue(s))`);
    for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  }
}

if (failed) {
  console.error('\nSee editorial/RIGHTS-AND-PROVENANCE.md.');
  process.exit(1);
}
process.exit(0);
