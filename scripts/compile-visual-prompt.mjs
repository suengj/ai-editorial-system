#!/usr/bin/env node
/**
 * compile-visual-prompt — AES-V2.7 (SUE-565)
 *
 * Usage:
 *   node scripts/compile-visual-prompt.mjs --validate
 *   node scripts/compile-visual-prompt.mjs --compile <job.json>
 *
 * --validate checks every schemas/examples/visual-job-*.example.json against
 * schemas/visual-job.schema.json plus the cross-field gates the schema cannot
 * express (density/profile match, renderer route vs evidence, context
 * isolation, attempts budget, clean skip short-circuit).
 *
 * --compile deterministically assembles compiled_prompt/compiled_from for one
 * job file from its declared inputs only. No model call, no network call.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileVisualPrompt, loadArtifactProfiles, loadSchema,
  validateVisualJobFile,
} from './lib/visual-job-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXAMPLES_DIR = resolve(ROOT, 'schemas/examples');

function runValidate() {
  const schema = loadSchema();
  const profiles = loadArtifactProfiles();

  const files = readdirSync(EXAMPLES_DIR)
    .filter((f) => f.startsWith('visual-job-') && f.endsWith('.example.json'))
    .sort();

  if (files.length === 0) {
    console.error('visual-job: FAIL — no schemas/examples/visual-job-*.example.json fixtures found');
    process.exit(1);
  }

  let failures = 0;
  for (const f of files) {
    const path = resolve(EXAMPLES_DIR, f);
    // No fixed brand passed: each job's own brand_profile/brand_profile_version
    // is resolved from the brand axis, fail-closed, per job (B6).
    const issues = validateVisualJobFile(path, { schema, profiles });
    const label = relative(ROOT, path);
    if (issues.length === 0) {
      console.log(`visual-job: PASS — ${label}`);
    } else {
      failures += 1;
      console.error(`visual-job: FAIL — ${label} (${issues.length} issue(s))`);
      for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
    }
  }

  if (failures > 0) {
    console.error('\nSee schemas/VISUAL-JOB-CONTRACT.md.');
    process.exit(1);
  }
  process.exit(0);
}

function runCompile(jobPath) {
  const profiles = loadArtifactProfiles();
  const job = JSON.parse(readFileSync(jobPath, 'utf8'));

  // brand is resolved from job.brand_profile/brand_profile_version, fail-closed.
  const { compiled_prompt, compiled_from } = compileVisualPrompt(job, { profiles });

  const next = { ...job };
  if (compiled_prompt === undefined) {
    delete next.compiled_prompt;
    delete next.compiled_from;
  } else {
    next.compiled_prompt = compiled_prompt;
    next.compiled_from = compiled_from;
  }

  writeFileSync(jobPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`compiled: ${relative(ROOT, jobPath)}`);
  if (compiled_prompt === undefined) {
    console.log('  information_gain.verdict is "skip" — no prompt compiled (correct, non-failing outcome).');
  } else {
    console.log(`  compiled_from: ${compiled_from.join(', ')}`);
  }
}

const [, , flag, arg] = process.argv;

if (flag === '--validate') {
  runValidate();
} else if (flag === '--compile') {
  if (!arg) {
    console.error('usage: node scripts/compile-visual-prompt.mjs --compile <job.json>');
    process.exit(1);
  }
  runCompile(resolve(arg));
} else {
  console.error('usage: node scripts/compile-visual-prompt.mjs --validate | --compile <job.json>');
  process.exit(1);
}
