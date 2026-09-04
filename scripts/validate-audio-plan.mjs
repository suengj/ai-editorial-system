#!/usr/bin/env node
/**
 * validate-audio-plan — AES-V2.8 (SUE-566)
 *
 * Usage:
 *   node scripts/validate-audio-plan.mjs [plan.json ...]
 *
 * With no arguments, validates every schemas/examples/audio-plan-*.example.json
 * fixture (one monologue, one dialogue, one timed-narration).
 */

import { readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAudioPlanFile } from './lib/audio-plan-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => relative(REPO_ROOT, p);

const EXAMPLES_DIR = resolve(REPO_ROOT, 'schemas/examples');

const targets = process.argv.slice(2).length > 0
  ? process.argv.slice(2).map((p) => resolve(p))
  : readdirSync(EXAMPLES_DIR)
      .filter((f) => f.startsWith('audio-plan-') && f.endsWith('.example.json'))
      .map((f) => resolve(EXAMPLES_DIR, f));

if (targets.length === 0) {
  console.error('audio-plan: FAIL — no audio-plan example fixtures found in schemas/examples/');
  process.exit(1);
}

let failures = 0;
for (const path of targets) {
  const label = rel(path);
  const issues = validateAudioPlanFile(path);
  if (issues.length === 0) {
    console.log(`audio-plan: PASS — ${label}`);
  } else {
    failures += 1;
    console.error(`audio-plan: FAIL — ${label} (${issues.length} issue(s))`);
    for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  }
}

if (failures > 0) {
  console.error('\nSee schemas/AUDIO-PLAN-CONTRACT.md.');
  process.exit(1);
}
process.exit(0);
