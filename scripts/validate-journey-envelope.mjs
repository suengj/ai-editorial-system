#!/usr/bin/env node
/** Validate the SUE-790 journey envelope and its allow/deny fixture pair. */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES,
  createRecordBundleResolver,
  parseJourneyJson,
  validateJourneyEnvelopeFile,
  validateJourneyReferences,
} from './lib/journey-envelope-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ALLOW = resolve(ROOT, 'schemas/examples/journey-envelope.example.json');
const DENY = resolve(ROOT, 'scripts/fixtures/journey-envelope/deny-primary-dossier.json');
const RECORDS = resolve(ROOT, 'scripts/fixtures/journey-envelope/cross-repo-records.json');
const args = process.argv.slice(2);

let recordsPath = null;
const inputs = [];
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === '--records') {
    recordsPath = args[index + 1] ? resolve(args[index + 1]) : null;
    index += 1;
  } else {
    inputs.push(args[index]);
  }
}

let failures = 0;
const report = (label, pass, detail = '') => {
  const line = `journey-envelope: ${pass ? 'PASS' : 'FAIL'} — ${label}${detail ? ` — ${detail}` : ''}`;
  (pass ? console.log : console.error)(line);
  if (!pass) failures += 1;
};

if (inputs.length > 0) {
  let recordBundle;
  let referenceOptions = {};
  if (recordsPath) {
    try {
      recordBundle = parseJourneyJson(readFileSync(recordsPath), recordsPath);
      referenceOptions = { resolveExternalRecord: createRecordBundleResolver(recordBundle) };
    } catch (error) {
      report(`records ${recordsPath}`, false, `[${error.code ?? CODES.HANDOFF_INVALID}] ${error.message}`);
    }
  }
  for (const input of inputs) {
    const target = resolve(input);
    let issues;
    try {
      const envelope = parseJourneyJson(readFileSync(target), target);
      issues = recordBundle
        ? validateJourneyReferences(envelope, recordBundle, referenceOptions)
        : validateJourneyEnvelopeFile(target, referenceOptions);
    } catch (error) {
      issues = [{
        code: error.code ?? CODES.HANDOFF_INVALID,
        where: target,
        message: error.message,
      }];
    }
    report(relative(ROOT, target) || target, issues.length === 0,
      issues.map((entry) => `[${entry.code}] ${entry.where}`).join(', '));
  }
} else {
  const recordBundle = parseJourneyJson(readFileSync(RECORDS), RECORDS);
  const referenceOptions = {
    resolveExternalRecord: createRecordBundleResolver(recordBundle),
  };
  const allowIssues = validateJourneyEnvelopeFile(ALLOW, referenceOptions);
  report('allow fixture is validator-clean', allowIssues.length === 0,
    allowIssues.map((entry) => `[${entry.code}] ${entry.where}`).join(', '));

  const referenceIssues = validateJourneyReferences(
    parseJourneyJson(readFileSync(ALLOW), ALLOW),
    recordBundle,
    referenceOptions,
  );
  report('allow fixture agrees with independently persisted record metadata',
    referenceIssues.length === 0,
    referenceIssues.map((entry) => `[${entry.code}] ${entry.where}`).join(', '));

  const denyIssues = validateJourneyEnvelopeFile(DENY, referenceOptions);
  const denyCodes = denyIssues.map((entry) => entry.code);
  report(`deny fixture is refused with ${CODES.DERIVED_EVIDENCE}`,
    denyCodes.includes(CODES.DERIVED_EVIDENCE),
    `got [${[...new Set(denyCodes)].join(', ')}]`);
}

process.exit(failures === 0 ? 0 : 1);
