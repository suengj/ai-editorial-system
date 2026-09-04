#!/usr/bin/env node
/**
 * validate-routing — AES-V2.5 (SUE-563)
 *
 * Validates editorial/feedback-routing.json for internal consistency, then
 * validates the worked feedback-record examples against both
 * schemas/feedback-record.schema.json and the routing table.
 *
 * Usage: node scripts/validate-routing.mjs [examples.json]
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadFeedbackSchema, loadRoutingTable, validateFeedbackRecordAgainstSchema,
  validateFeedbackRecordRouting, validateRoutingTable,
} from './lib/routing-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const examplesPath = resolve(process.argv[2] ?? resolve(REPO_ROOT, 'schemas/examples/feedback-record-routing.example.json'));
const feedbackRecordsDir = resolve(REPO_ROOT, 'feedback/records');

const table = loadRoutingTable();
const schema = loadFeedbackSchema();

let failed = 0;

const tableIssues = validateRoutingTable(table);
if (tableIssues.length === 0) {
  console.log('routing table: PASS — editorial/feedback-routing.json');
} else {
  failed += 1;
  console.error(`routing table: FAIL (${tableIssues.length} issue(s))`);
  for (const i of tableIssues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
}

function checkRecords(records, label) {
  console.log(`\n${label} (${records.length} record(s))`);
  for (const record of records) {
    const issues = [
      ...validateFeedbackRecordAgainstSchema(record, schema),
      ...validateFeedbackRecordRouting(record, table),
    ];
    if (issues.length === 0) {
      console.log(`  PASS  ${record.feedback_id}`);
    } else {
      failed += 1;
      console.error(`  FAIL  ${record.feedback_id} (${issues.length} issue(s))`);
      for (const i of issues) console.error(`    [${i.code}] ${i.message}`);
    }
  }
}

const { records: exampleRecords } = JSON.parse(readFileSync(examplesPath, 'utf8'));
checkRecords(exampleRecords, `worked examples: ${relative(REPO_ROOT, examplesPath)}`);

// Records actually persisted under feedback/records/ must be checked too —
// not only the worked examples. A record that has never been run through
// this validator is a record whose routing has never actually been checked
// (AES-V2 B3).
const persistedRecords = readdirSync(feedbackRecordsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(resolve(feedbackRecordsDir, f), 'utf8')));
checkRecords(persistedRecords, `persisted records: ${relative(REPO_ROOT, feedbackRecordsDir)}/`);

if (failed === 0) {
  console.log('\nrouting: PASS');
} else {
  console.error(`\nrouting: FAIL (${failed} problem area(s))`);
  console.error('See editorial/FEEDBACK-ROUTING.md.');
}
process.exit(failed === 0 ? 0 : 1);
