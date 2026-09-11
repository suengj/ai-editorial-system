#!/usr/bin/env node
/** Validate the SUE-790 journey envelope and its allow/deny fixture pair. */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES,
  validateJourneyEnvelopeFile,
  validateJourneyReferences,
} from './lib/journey-envelope-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ALLOW = resolve(ROOT, 'schemas/examples/journey-envelope.example.json');
const DENY = resolve(ROOT, 'scripts/fixtures/journey-envelope/deny-primary-dossier.json');
const RECORDS = resolve(ROOT, 'scripts/fixtures/journey-envelope/cross-repo-records.json');
const args = process.argv.slice(2);

let failures = 0;
const report = (label, pass, detail = '') => {
  const line = `journey-envelope: ${pass ? 'PASS' : 'FAIL'} — ${label}${detail ? ` — ${detail}` : ''}`;
  (pass ? console.log : console.error)(line);
  if (!pass) failures += 1;
};

if (args.length > 0) {
  for (const input of args) {
    const target = resolve(input);
    const issues = validateJourneyEnvelopeFile(target);
    report(relative(ROOT, target) || target, issues.length === 0,
      issues.map((entry) => `[${entry.code}] ${entry.where}`).join(', '));
  }
} else {
  const allowIssues = validateJourneyEnvelopeFile(ALLOW);
  report('allow fixture is validator-clean', allowIssues.length === 0,
    allowIssues.map((entry) => `[${entry.code}] ${entry.where}`).join(', '));

  const referenceIssues = validateJourneyReferences(
    JSON.parse(readFileSync(ALLOW, 'utf8')),
    JSON.parse(readFileSync(RECORDS, 'utf8')),
  );
  report('allow fixture agrees with independently persisted record metadata',
    referenceIssues.length === 0,
    referenceIssues.map((entry) => `[${entry.code}] ${entry.where}`).join(', '));

  const denyIssues = validateJourneyEnvelopeFile(DENY);
  const denyCodes = denyIssues.map((entry) => entry.code);
  report(`deny fixture is refused with ${CODES.DERIVED_EVIDENCE}`,
    denyCodes.includes(CODES.DERIVED_EVIDENCE),
    `got [${[...new Set(denyCodes)].join(', ')}]`);
}

process.exit(failures === 0 ? 0 : 1);
