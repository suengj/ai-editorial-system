#!/usr/bin/env node
/**
 * validate-plate — measure a rendered plate against the composition plan that
 * claimed it (AES-V2.16b / SUE-628).
 *
 * Usage:
 *   node scripts/validate-plate.mjs <plan.json> <asset.svg> [availableWidthPx]
 *
 * scripts/validate-composition-plan.mjs checks a plan against the contract.
 * That check can only ever see what the plan's author wrote. This one is the
 * other half: it reads the asset and reports where the declaration and the
 * picture disagree.
 */

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { DEFAULT_AVAILABLE_PX, verifyPlateAgainstPlan } from './lib/plate-verify-core.mjs';

const [, , planPath, assetPath, widthArg] = process.argv;

if (!planPath || !assetPath) {
  console.error('usage: node scripts/validate-plate.mjs <plan.json> <asset.svg> [availableWidthPx]');
  process.exit(2);
}

const availablePx = widthArg ? Number(widthArg) : DEFAULT_AVAILABLE_PX;
if (!Number.isFinite(availablePx) || availablePx <= 0) {
  console.error(`plate: FAIL — availableWidthPx "${widthArg}" is not a positive number`);
  process.exit(2);
}

let plan;
try {
  plan = JSON.parse(readFileSync(resolve(planPath), 'utf8'));
} catch (e) {
  console.error(`plate: FAIL — could not read plan ${planPath}: ${e.message}`);
  process.exit(1);
}

let svg;
try {
  svg = readFileSync(resolve(assetPath), 'utf8');
} catch (e) {
  console.error(`plate: FAIL — could not read asset ${assetPath}: ${e.message}`);
  process.exit(1);
}

const label = `${relative(process.cwd(), planPath)} vs ${relative(process.cwd(), assetPath)}`;
const issues = verifyPlateAgainstPlan(plan, svg, { availablePx });

if (issues.length === 0) {
  console.log(`plate: PASS — ${label} (measured at ${availablePx}px)`);
  process.exit(0);
}

console.error(`plate: FAIL — ${label} (${issues.length} issue(s), measured at ${availablePx}px)`);
for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
console.error('\nSee schemas/INFOGRAPHIC-COMPOSITION-CONTRACT.md, "What a plan can and cannot be trusted to say".');
process.exit(1);
