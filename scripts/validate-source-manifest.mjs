#!/usr/bin/env node
/**
 * validate-source-manifest — AES-P0.2 (SUE-435)
 *
 * Fail-closed validation of a source manifest against
 * schemas/source.schema.json and the invariants in
 * schemas/SOURCE-CONTRACT.md.
 *
 * Usage: node scripts/validate-source-manifest.mjs [manifest.json ...]
 * Default target: schemas/examples/source-manifest.example.json
 */

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchema, validateManifestFile } from './lib/source-contract-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const DEFAULT = resolve(REPO_ROOT, 'schemas/examples/source-manifest.example.json');

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : [DEFAULT]).map((p) => resolve(p));
const schema = loadSchema();

let failed = 0;
for (const target of targets) {
  const issues = validateManifestFile(target, schema);
  const label = relative(REPO_ROOT, target) || target;
  if (issues.length === 0) {
    console.log(`source-manifest: PASS — ${label}`);
  } else {
    failed += 1;
    console.error(`source-manifest: FAIL — ${label} (${issues.length} issue(s))`);
    for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  }
}

if (failed) {
  console.error('\nSee schemas/SOURCE-CONTRACT.md.');
  process.exit(1);
}
process.exit(0);
