#!/usr/bin/env node
/**
 * validate-intent — AES-V2.1 (SUE-559)
 *
 * Fail-closed validation of an Editorial Intent record against
 * schemas/editorial-intent.schema.json and the cross-field invariants in
 * schemas/EDITORIAL-INTENT-CONTRACT.md.
 *
 * Usage: node scripts/validate-intent.mjs [intent.json ...]
 * Default target: every schemas/examples/intent-*.example.json
 */

import { readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchema, validateIntentFile } from './lib/intent-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const EXAMPLES_DIR = resolve(REPO_ROOT, 'schemas/examples');
const rel = (p) => relative(REPO_ROOT, p) || p;

function defaultTargets() {
  return readdirSync(EXAMPLES_DIR)
    .filter((f) => f.startsWith('intent-') && f.endsWith('.example.json'))
    .map((f) => resolve(EXAMPLES_DIR, f));
}

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : defaultTargets()).map((p) => resolve(p));
if (targets.length === 0) {
  console.error('intent: FAIL — no schemas/examples/intent-*.example.json found');
  process.exit(1);
}

const schema = loadSchema();

let failed = 0;
let noted = 0;
for (const target of targets) {
  const { issues, notes } = validateIntentFile(target, schema);
  const label = rel(target);
  for (const n of notes) console.log(`intent: NOTE — [${label}] [${n.code}] ${n.where} — ${n.message}`);
  noted += notes.length;
  if (issues.length === 0) {
    console.log(`intent: PASS — ${label}`);
  } else {
    failed += 1;
    console.error(`intent: FAIL — ${label} (${issues.length} issue(s))`);
    for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  }
}

if (failed) {
  console.error('\nSee schemas/EDITORIAL-INTENT-CONTRACT.md.');
  process.exit(1);
}
console.log(`\nintent: ${targets.length} record(s) PASS${noted ? `, ${noted} note(s)` : ''}`);
process.exit(0);
