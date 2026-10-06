#!/usr/bin/env node
/** See editorial/STRUCTURED-VISUAL-EXECUTION.md. No CI, network or model calls. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { compileExecution, executeVisual, prepareOutput } from './lib/visual-execution-core.mjs';
const args = process.argv.slice(2);
const allowed = new Set(['--plan', '--out', '--preset', '--rasterizer', '--compile-only']);
const opts = {};
try {
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!allowed.has(key) || Object.hasOwn(opts, key)) throw new Error(`unknown/duplicate option: ${key}`);
    if (key === '--compile-only') opts[key] = true;
    else { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`missing value: ${key}`); opts[key] = args[++i]; }
  }
  if (!opts['--plan'] || !opts['--out']) throw new Error('usage: node scripts/render-visual.mjs --plan <llm-resolved.json> --out <separate-directory> [--preset <json>] [--rasterizer auto|rsvg|magick] [--compile-only]');
  const path = resolve(opts['--plan']), outDir = resolve(opts['--out']);
  const plan = JSON.parse(readFileSync(path, 'utf8'));
  const preset = opts['--preset'] ? JSON.parse(readFileSync(resolve(opts['--preset']), 'utf8')) : {};
  let result;
  if (opts['--compile-only']) {
    prepareOutput(outDir);
    result = await compileExecution(plan, { baseDir: dirname(path), preset });
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, 'execution.json'), `${JSON.stringify(result, null, 2)}\n`);
  } else result = await executeVisual(plan, { baseDir: dirname(path), outDir, preset, rasterizer: opts['--rasterizer'] ?? 'auto' });
  console.log(JSON.stringify({ status: result.status, out: outDir, request_hash: result.request_hash, api_calls: 0, phase4: 'NOT_RUN' }));
  if (!opts['--compile-only'] && result.status !== 'RENDERED_NEEDS_REVIEW') process.exitCode = 2;
} catch (err) {
  console.error(JSON.stringify({ status: 'FAILED', code: err.code ?? 'EXECUTION_FAILED', message: err.message }));
  process.exitCode = 1;
}
