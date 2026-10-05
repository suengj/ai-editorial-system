#!/usr/bin/env node
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXAMPLE_PATH, loadSchema, validateHubFile } from './lib/content-hub-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = (process.argv.slice(2).length ? process.argv.slice(2) : [EXAMPLE_PATH]).map((p) => resolve(p));
let failures = 0;
for (const target of targets) {
  const issues = validateHubFile(target, loadSchema());
  const label = relative(ROOT, target) || target;
  if (issues.length === 0) console.log(`content-hub: PASS — ${label}`);
  else {
    failures += 1;
    console.error(`content-hub: FAIL — ${label} (${issues.length} issue(s))`);
    for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  }
}
process.exit(failures ? 1 : 0);
