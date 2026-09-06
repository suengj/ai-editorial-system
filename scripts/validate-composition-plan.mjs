#!/usr/bin/env node
/**
 * validate-composition-plan — AES-V2.16b (SUE-628)
 *
 * Usage:
 *   node scripts/validate-composition-plan.mjs
 *   node scripts/validate-composition-plan.mjs <plan.json> [...]
 *
 * With no arguments it checks every
 * schemas/examples/composition-plan-*.example.json against
 * schemas/composition-plan.schema.json plus the cross-field rules the schema
 * cannot express (R1-R15 in scripts/lib/composition-plan-core.mjs): relation
 * geometry, enclosure budget, reading path, mobile type floor, the profile
 * label ceiling, channel separation, time scale, matrix warrant, the
 * evidence/interpretation boundary, renderer route, plate split, and mutable
 * copy in artwork.
 *
 * Zero fixtures is a failure, not a pass: an empty fixture set is how a gate
 * stops gating without anyone noticing.
 */

import { readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadArtifactProfiles, loadSchema, validateCompositionPlanFile,
} from './lib/composition-plan-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXAMPLES_DIR = resolve(ROOT, 'schemas/examples');

const args = process.argv.slice(2);

let paths;
if (args.length > 0) {
  paths = args.map((a) => resolve(a));
} else {
  paths = readdirSync(EXAMPLES_DIR)
    .filter((f) => f.startsWith('composition-plan-') && f.endsWith('.example.json'))
    .sort()
    .map((f) => resolve(EXAMPLES_DIR, f));

  if (paths.length === 0) {
    console.error('composition-plan: FAIL — no schemas/examples/composition-plan-*.example.json fixtures found');
    process.exit(1);
  }
}

const schema = loadSchema();
const profiles = loadArtifactProfiles();

let failures = 0;
for (const path of paths) {
  const issues = validateCompositionPlanFile(path, { schema, profiles });
  const label = relative(ROOT, path);
  if (issues.length === 0) {
    console.log(`composition-plan: PASS — ${label}`);
  } else {
    failures += 1;
    console.error(`composition-plan: FAIL — ${label} (${issues.length} issue(s))`);
    for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  }
}

if (failures > 0) {
  console.error('\nSee schemas/composition-plan.schema.json, benchmarks/EDITORIAL-INFOGRAPHIC-INFORMATION-DESIGN.md (T1-T14) and evals/negative-baselines/SUE-570-INFOGRAPHIC-FORENSICS.md (F1-F7).');
  process.exit(1);
}
process.exit(0);
