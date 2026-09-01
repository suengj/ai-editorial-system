#!/usr/bin/env node
/**
 * validate-presentation — AES-P1.6 (SUE-464)
 *
 * Usage: node scripts/validate-presentation.mjs [plan.json] [--type <content-type>]
 */

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePresentationPlanFile } from './lib/presentation-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const typeIdx = args.indexOf('--type');
const contentType = typeIdx >= 0 ? args[typeIdx + 1] : 'news';
const target = resolve(args.find((a, i) => !a.startsWith('--') && i !== typeIdx + 1)
  ?? resolve(REPO_ROOT, 'schemas/examples/presentation-plan.example.json'));

const issues = validatePresentationPlanFile(target, { contentType, paragraphCount: 9 });
const label = relative(REPO_ROOT, target);

if (issues.length === 0) {
  console.log(`presentation: PASS — ${label} (${contentType})`);
  process.exit(0);
}
console.error(`presentation: FAIL — ${label} (${issues.length} issue(s))`);
for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
console.error('\nSee editorial/presentation.md.');
process.exit(1);
