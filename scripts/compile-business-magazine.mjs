#!/usr/bin/env node
/** Writes a NEW handoff directory. Does not render, upload or publish. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { compileBusinessMagazine } from './lib/business-magazine-core.mjs';
try {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--packet', '--out'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || options[args[i]]) throw new Error('Usage: node scripts/compile-business-magazine.mjs --packet /path/packet.json --out /new/output');
    options[args[i]] = args[i + 1];
  }
  if (!options['--packet'] || !options['--out']) throw new Error('--packet and --out are required');
  const input = resolve(options['--packet']), baseDir = dirname(input);
  const packet = JSON.parse(readFileSync(input, 'utf8'));
  if (typeof packet.evidence_ref !== 'string' || !packet.evidence_ref.trim()) throw new Error('packet.evidence_ref is required');
  const sourceRef = resolve(baseDir, packet.evidence_ref), raw = readFileSync(sourceRef);
  const evidence = JSON.parse(raw.toString('utf8'));
  const compiled = compileBusinessMagazine(packet, evidence, { sourceRef, sourceSha: `sha256:${createHash('sha256').update(raw).digest('hex')}`, baseDir });
  const out = resolve(options['--out']);
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(out); // EEXIST intentionally refuses stale output/accidental overwrite.
  writeFileSync(resolve(out, 'series.json'), JSON.stringify(compiled.series, null, 2) + '\n');
  writeFileSync(resolve(out, 'editorial-sidecar.json'), JSON.stringify(compiled.sidecar, null, 2) + '\n');
  writeFileSync(resolve(out, 'caption.md'), compiled.caption);
  writeFileSync(resolve(out, 'generation-brief.md'), compiled.generation_brief + '\n');
  console.log(JSON.stringify({ status: 'PLANNED_NOT_RENDERED', frames: 5, out, publication_authorized: false }));
} catch (error) {
  console.error(`${error.code ?? 'BIZ_COMPILE_FAILED'}: ${error.message}`);
  process.exitCode = 1;
}
