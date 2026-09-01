#!/usr/bin/env node
/**
 * validate-artifact-plan — AES-P2.6 (SUE-448)
 *
 * Usage: node scripts/validate-artifact-plan.mjs [plan.json] [bundle.json]
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePlanFile } from './lib/plan-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const planPath = resolve(process.argv[2] ?? resolve(REPO_ROOT, 'schemas/examples/artifact-plan.example.json'));
const bundlePath = resolve(process.argv[3] ?? resolve(REPO_ROOT, 'schemas/examples/article-artifact.example.json'));

const article = JSON.parse(readFileSync(bundlePath, 'utf8')).article;
const issues = validatePlanFile(planPath, article);
const label = relative(REPO_ROOT, planPath);

if (issues.length === 0) {
  console.log(`plan: PASS — ${label}`);
  process.exit(0);
}
console.error(`plan: FAIL — ${label} (${issues.length} issue(s))`);
for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
console.error('\nSee skills/plan-artifacts/SKILL.md.');
process.exit(1);
