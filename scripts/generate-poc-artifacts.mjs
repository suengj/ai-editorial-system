#!/usr/bin/env node
/**
 * generate-poc-artifacts — AES-P4.1 / P4.2 (SUE-452, SUE-453)
 *
 * Compiles the PoC artifacts from their specs and the worked article.
 * Deterministic: rerunning without changing an input reproduces byte-identical
 * output, which is what `--check` asserts.
 *
 * Usage:
 *   node scripts/generate-poc-artifacts.mjs           write artifacts
 *   node scripts/generate-poc-artifacts.mjs --check   fail if any would change
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderChart, renderDiagram } from './lib/chart-renderer.mjs';
import { generateBrief } from './lib/brief-generator.mjs';
import { generateDeck } from './lib/deck-generator.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POC = resolve(ROOT, 'evals/poc');
const check = process.argv.includes('--check');

const bundle = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/article-artifact.example.json'), 'utf8'));
const plan = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/artifact-plan.example.json'), 'utf8'));
const spec = (name) => JSON.parse(readFileSync(resolve(POC, 'specs', name), 'utf8'));

const outputs = [
  ['cost-stack.svg', renderChart(spec('cost-stack.chart.json'))],
  ['cost-flow.mmd', renderDiagram(spec('cost-flow.diagram.json'))],
  ['brief.md', generateBrief(bundle.article, plan.decisions.find((d) => d.kind === 'brief'))],
  ['deck.md', generateDeck(bundle.article, plan.decisions.find((d) => d.kind === 'slides'))],
];

let changed = 0;
for (const [name, content] of outputs) {
  const path = resolve(POC, name);
  const label = relative(ROOT, path);
  let existing = null;
  try { existing = readFileSync(path, 'utf8'); } catch { /* not yet generated */ }

  if (existing === content) {
    console.log(`poc: unchanged — ${label}`);
    continue;
  }
  changed += 1;
  if (check) {
    console.error(`poc: CHANGED — ${label}${existing === null ? ' (missing)' : ''}`);
  } else {
    writeFileSync(path, content);
    console.log(`poc: written — ${label}`);
  }
}

if (check && changed > 0) {
  console.error('\nRegeneration is not reproducible, or a spec changed without the artifact being rebuilt.');
  process.exit(1);
}
process.exit(0);
