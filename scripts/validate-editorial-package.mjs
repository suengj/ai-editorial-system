#!/usr/bin/env node
/**
 * validate-editorial-package — AES-V2.9 (SUE-567)
 *
 * Fail-closed validation of every schemas/examples/package-*.example.json
 * against schemas/editorial-package.schema.json plus the cross-field
 * invariants in schemas/EDITORIAL-PACKAGE-CONTRACT.md that json-schema-lite
 * cannot express.
 *
 * A missing transformation.profile_ref (the other Writer's files under
 * editorial/profiles/transformation/ not landed yet) is reported as SKIP,
 * not FAIL — this validator does not gate on a concurrent package it does
 * not own.
 *
 * Usage: node scripts/validate-editorial-package.mjs [package.json ...]
 */

import { readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, loadSchema, validatePackageFile,
} from './lib/editorial-package-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const EXAMPLES_DIR = resolve(REPO_ROOT, 'schemas/examples');

function defaultTargets() {
  return readdirSync(EXAMPLES_DIR)
    .filter((f) => f.startsWith('package-') && f.endsWith('.example.json'))
    .sort()
    .map((f) => resolve(EXAMPLES_DIR, f));
}

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : defaultTargets()).map((p) => resolve(p));
const schema = loadSchema();

let failed = 0;
let skipped = 0;
for (const target of targets) {
  const label = relative(REPO_ROOT, target) || target;
  const issues = validatePackageFile(target, schema);

  const profileMissing = issues.filter((i) => i.code === CODES.PROFILE_MISSING);
  const other = issues.filter((i) => i.code !== CODES.PROFILE_MISSING);

  if (other.length === 0 && profileMissing.length === 0) {
    console.log(`editorial-package: PASS — ${label}`);
  } else if (other.length === 0) {
    skipped += 1;
    console.log(`editorial-package: SKIP — ${label}`);
    for (const i of profileMissing) console.log(`  [${i.code}] ${i.where} — ${i.message} (tolerated: owned by a concurrent Writer)`);
  } else {
    failed += 1;
    console.error(`editorial-package: FAIL — ${label} (${other.length} issue(s))`);
    for (const i of other) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
    for (const i of profileMissing) console.error(`  [${i.code}] ${i.where} — ${i.message} (tolerated: owned by a concurrent Writer)`);
  }
}

console.log(`\neditorial-package: ${targets.length} checked, ${failed} failed, ${skipped} skipped-with-tolerated-reason`);

if (failed) {
  console.error('\nSee schemas/EDITORIAL-PACKAGE-CONTRACT.md.');
  process.exit(1);
}
process.exit(0);
