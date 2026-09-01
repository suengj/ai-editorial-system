#!/usr/bin/env node
/**
 * validate-article-contract — AES-P0.3 (SUE-436)
 *
 * Fail-closed validation of an { article, artifacts } bundle against
 * schemas/article.schema.json and schemas/artifact.schema.json plus the
 * invariants in schemas/ARTICLE-ARTIFACT-CONTRACT.md.
 *
 * Usage: node scripts/validate-article-contract.mjs [bundle.json ...]
 */

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchemas, validateBundleFile } from './lib/article-contract-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const DEFAULT = resolve(REPO_ROOT, 'schemas/examples/article-artifact.example.json');

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : [DEFAULT]).map((p) => resolve(p));
const schemas = loadSchemas();

let failed = 0;
for (const target of targets) {
  const issues = validateBundleFile(target, schemas);
  const label = relative(REPO_ROOT, target) || target;
  if (issues.length === 0) {
    console.log(`article-contract: PASS — ${label}`);
  } else {
    failed += 1;
    console.error(`article-contract: FAIL — ${label} (${issues.length} issue(s))`);
    for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  }
}

if (failed) {
  console.error('\nSee schemas/ARTICLE-ARTIFACT-CONTRACT.md.');
  process.exit(1);
}
process.exit(0);
