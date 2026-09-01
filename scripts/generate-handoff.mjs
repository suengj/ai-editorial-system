#!/usr/bin/env node
/**
 * generate-handoff — AES-P6.1 (SUE-459)
 *
 * Produces the handoff receipt for the worked article and checks it.
 * `--check` fails if the committed receipt would change.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReceipt, validateReceipt } from './lib/handoff-core.mjs';
import { classifyArtifact } from './lib/lineage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'evals/poc/handoff-receipt.json');
const BODY = resolve(ROOT, 'evals/fixtures/golden/G-01-synthesis.md');
const check = process.argv.includes('--check');

const bundle = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/article-artifact.example.json'), 'utf8'));
// The plan handed over must anchor into the body being handed over, so this
// uses the plan written against G-01 rather than the standalone schema example.
const plan = JSON.parse(readFileSync(resolve(ROOT, 'evals/poc/specs/g01.presentation.json'), 'utf8'));
const body = readFileSync(BODY, 'utf8');

const article = { ...bundle.article, version: { ...bundle.article.version, date: '2026-08-31' } };

// Only artifacts that are actually current may be handed over.
const artifacts = bundle.artifacts
  .map((a) => ({ ...a, staleness: classifyArtifact(a, article) }))
  .filter((a) => a.staleness.presentable);

const receipt = buildReceipt(article, body, {
  artifacts,
  presentationPlan: plan,
  evidence: {
    review_record: 'schemas/examples/review-record.example.json',
    source_manifest: 'schemas/examples/source-manifest.example.json',
  },
  producedAt: '2026-09-01T12:00:00Z',
});

const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
let existing = null;
try { existing = readFileSync(OUT, 'utf8'); } catch { /* not yet generated */ }

const issues = validateReceipt(receipt, body);
if (issues.length > 0) {
  console.error(`handoff: FAIL — ${issues.length} issue(s)`);
  for (const i of issues) console.error(`  [${i.code}] ${i.where} — ${i.message}`);
  process.exit(1);
}

const label = relative(ROOT, OUT);
if (existing === serialized) {
  console.log(`handoff: PASS — ${label} unchanged, receipt valid`);
  process.exit(0);
}
if (check) {
  console.error(`handoff: CHANGED — ${label}${existing === null ? ' (missing)' : ''}`);
  process.exit(1);
}
writeFileSync(OUT, serialized);
console.log(`handoff: PASS — ${label} written, receipt valid`);
