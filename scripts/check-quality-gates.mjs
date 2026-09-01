#!/usr/bin/env node
/**
 * check-quality-gates — AES-P1.3 (SUE-440)
 *
 * Runs the mechanical editorial gates over one or more article bodies.
 * Exits non-zero when any finding is reject-severity.
 *
 * Usage: node scripts/check-quality-gates.mjs <body.md> [...]
 *        node scripts/check-quality-gates.mjs --bundle <article-artifact.json>
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks, loadGates, runGates, SEVERITY } from './lib/quality-gates-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: check-quality-gates.mjs <body.md> [...] | --bundle <bundle.json>');
  process.exit(2);
}

const gates = loadGates();
let article = null;
const files = [];

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--bundle') {
    const bundle = JSON.parse(readFileSync(resolve(args[i + 1]), 'utf8'));
    article = bundle.article ?? bundle;
    i += 1;
  } else {
    files.push(resolve(args[i]));
  }
}

let blocked = 0;
for (const file of files) {
  const body = readFileSync(file, 'utf8');
  const findings = runGates(body, article, gates);
  const label = relative(REPO_ROOT, file) || file;

  if (findings.length === 0) {
    console.log(`gates: PASS — ${label}`);
    continue;
  }

  const isBlocked = blocks(findings);
  if (isBlocked) blocked += 1;
  console[isBlocked ? 'error' : 'log'](
    `gates: ${isBlocked ? 'REJECT' : 'REVIEW'} — ${label} (${findings.length} finding(s))`,
  );
  for (const f of findings) {
    const mark = f.severity === SEVERITY.REJECT ? '✗' : f.severity === SEVERITY.FIX ? '!' : '·';
    console[isBlocked ? 'error' : 'log'](`  ${mark} [${f.severity}] ${f.gate} — ${f.detail}`);
    if (f.evidence) console[isBlocked ? 'error' : 'log'](`      ${f.evidence}`);
  }
}

process.exit(blocked > 0 ? 1 : 0);
