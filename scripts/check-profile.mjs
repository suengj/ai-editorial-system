#!/usr/bin/env node
/**
 * check-profile — AES-P1.4 (SUE-441) / AES-P1.5 (SUE-442)
 *
 * Checks an { article, artifacts } bundle against the profile for its
 * content type: evidence burden, required fields, length limits, freshness,
 * repo-evidence rules, and artifact fit.
 *
 * Usage: node scripts/check-profile.mjs <bundle.json> [body.md]
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProfiles, validateAgainstProfile } from './lib/profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const DEFAULT = resolve(REPO_ROOT, 'schemas/examples/article-artifact.example.json');

const [bundlePath = DEFAULT, bodyPath] = process.argv.slice(2);
const bundle = JSON.parse(readFileSync(resolve(bundlePath), 'utf8'));
const body = bodyPath ? readFileSync(resolve(bodyPath), 'utf8') : null;

const issues = validateAgainstProfile(bundle.article, {
  body,
  artifacts: bundle.artifacts ?? [],
  profiles: loadProfiles(),
});

const label = relative(REPO_ROOT, resolve(bundlePath));
if (issues.length === 0) {
  console.log(`profile: PASS — ${label} conforms to the ${bundle.article?.content_type} profile`);
  process.exit(0);
}

console.error(`profile: FAIL — ${label} (${issues.length} issue(s))`);
for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
console.error('\nSee editorial/profiles/README.md.');
process.exit(1);
