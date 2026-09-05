#!/usr/bin/env node
/**
 * validate-delta — AES-V2.18 (SUE-610)
 *
 * Validates the worked delta-plan and polish-decision examples under
 * schemas/examples/ against schemas/delta-plan.schema.json /
 * schemas/polish-decision.schema.json plus the mechanical guards in
 * scripts/lib/delta-core.mjs (G1-G6, P1-P6, A1-A3, the no-aggregate rule,
 * and the advisory edit-surface band).
 *
 * No persisted delta-plan/polish-decision registry directory exists yet
 * (these are per-task records produced by the gate described in
 * docs/architecture/SOURCE-TARGET-DELTA-PLANNING.md and
 * docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md §11-§14) — when one is
 * introduced, this script is where it gets wired in, following the same
 * pattern as scripts/validate-language.mjs.
 *
 * Usage: node scripts/validate-delta.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROOT, loadDeltaSchema, loadPolishSchema, validateDeltaPlan, validatePolishDecision,
} from './lib/delta-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(REPO_ROOT, p) || p;

const deltaSchema = loadDeltaSchema();
const polishSchema = loadPolishSchema();

const deltaExamplesPath = resolve(ROOT, 'schemas/examples/delta-plan.example.json');
const polishExamplesPath = resolve(ROOT, 'schemas/examples/polish-decision.example.json');

const { records: deltaRecords } = JSON.parse(readFileSync(deltaExamplesPath, 'utf8'));
const { records: polishRecords } = JSON.parse(readFileSync(polishExamplesPath, 'utf8'));

const issues = [];
for (const record of deltaRecords) {
  for (const i of validateDeltaPlan(record, { schema: deltaSchema })) {
    issues.push({ ...i, file: deltaExamplesPath });
  }
}
for (const record of polishRecords) {
  for (const i of validatePolishDecision(record, { schema: polishSchema })) {
    issues.push({ ...i, file: polishExamplesPath });
  }
}

if (issues.length === 0) {
  console.log(`delta: PASS — ${deltaRecords.length} delta-plan example(s), ${polishRecords.length} polish-decision example(s)`);
  process.exit(0);
}

console.error(`delta: FAIL — ${issues.length} issue(s)`);
for (const i of issues) {
  console.error(`  [${i.code}] ${rel(i.file)} ${i.where}: ${i.message}`);
}
console.error('\nSee docs/architecture/SOURCE-TARGET-DELTA-PLANNING.md, docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md §11-§14, schemas/delta-plan.schema.json, and schemas/polish-decision.schema.json.');
process.exit(1);
