#!/usr/bin/env node
/**
 * validate-hitl — AES-P5.1 (SUE-457)
 *
 * Usage: node scripts/validate-hitl.mjs [record.json] [bundle.json]
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReviewRecordFile } from './lib/hitl-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recordPath = resolve(process.argv[2] ?? resolve(REPO_ROOT, 'schemas/examples/review-record.example.json'));
const bundlePath = resolve(process.argv[3] ?? resolve(REPO_ROOT, 'schemas/examples/article-artifact.example.json'));

const article = JSON.parse(readFileSync(bundlePath, 'utf8')).article;
const issues = validateReviewRecordFile(recordPath, article);
const label = relative(REPO_ROOT, recordPath);

if (issues.length === 0) {
  console.log(`hitl: PASS — ${label}`);
  process.exit(0);
}
console.error(`hitl: FAIL — ${label} (${issues.length} issue(s))`);
for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
console.error('\nSee editorial/HITL-PROTOCOL.md.');
process.exit(1);
