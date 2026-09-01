#!/usr/bin/env node
/**
 * validate-skills — AES-P2.1 (SUE-443)
 *
 * Validates every Skill in skills/ against schemas/skill.schema.json and the
 * structural rules in skills/SKILL-FORMAT.md.
 *
 * Usage: node scripts/validate-skills.mjs [skills-dir]
 */

import { relative, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSchema, SKILLS_DIR, validateAllSkills } from './lib/skill-core.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2] ?? SKILLS_DIR);
const results = validateAllSkills(dir, loadSchema());

if (results.length === 0) {
  console.error(`skills: FAIL — no Skill found under ${relative(REPO_ROOT, dir) || dir}`);
  process.exit(1);
}

let failed = 0;
for (const { skill, issues } of results) {
  if (issues.length === 0) {
    console.log(`skills: PASS — ${skill}`);
    continue;
  }
  failed += 1;
  console.error(`skills: FAIL — ${skill} (${issues.length} issue(s))`);
  for (const i of issues) console.error(`  [${i.code}] ${i.message}`);
}

if (failed) {
  console.error('\nSee skills/SKILL-FORMAT.md.');
  process.exit(1);
}
process.exit(0);
