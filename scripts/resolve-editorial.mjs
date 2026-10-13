#!/usr/bin/env node
/**
 * Common editorial entry (SUE-1426 R1/R2). Intake step that follows
 * skills/intake-request: builds the selective load plan, resolves per-field
 * precedence, maps the SNS target to its copy/visual profile, and writes ONE
 * resolved-profile receipt that generate, polish, review and render consume.
 *
 *   node scripts/resolve-editorial.mjs --intent intent.json --target signalytics-news [--overrides o.json] [--task-kind text|visual|both] [--out receipt.json]
 *   node scripts/resolve-editorial.mjs --list-targets
 *   node scripts/resolve-editorial.mjs --receipt receipt.json --stages stamps.json     (stage consistency check)
 * Exit 0 READY, 2 BLOCKED/inconsistent, 1 usage error. No network, LLM or publication.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { RuleReader, loadManifest, resolveEditorial, verifyStages, STATUS } from './lib/resolve-core.mjs';

try {
  const { values: v } = parseArgs({ options: { intent: { type: 'string' }, target: { type: 'string' }, overrides: { type: 'string' }, 'task-kind': { type: 'string' }, out: { type: 'string' }, 'list-targets': { type: 'boolean', default: false }, receipt: { type: 'string' }, stages: { type: 'string' } }, strict: true });
  const reader = new RuleReader();
  const json = (p) => JSON.parse(readFileSync(resolve(p), 'utf8'));
  if (v['list-targets']) {
    const { manifest } = loadManifest(reader);
    console.log(JSON.stringify(Object.entries(manifest.sns_targets).map(([id, t]) => ({ target: id, account: t.account, surface: t.surface, voice_family: t.voice_family, copy_files: t.copy_files, visual_artifacts: t.visual?.artifacts ?? null, status: t.status })), null, 2));
  } else if (v.receipt) {
    if (!v.stages) throw new Error('usage: --receipt receipt.json --stages stamps.json');
    const issues = verifyStages(json(v.receipt), json(v.stages));
    console.log(JSON.stringify({ consistent: issues.length === 0, issues }, null, 2));
    if (issues.length) process.exitCode = 2;
  } else {
    if (!v.intent) throw new Error('usage: node scripts/resolve-editorial.mjs --intent intent.json --target <id> [--overrides o.json] [--task-kind text|visual|both] [--out receipt.json] | --list-targets');
    const receipt = resolveEditorial(json(v.intent), { targetId: v.target ?? null, overrides: v.overrides ? json(v.overrides) : {}, taskKind: v['task-kind'] ?? null, reader });
    const body = `${JSON.stringify(receipt, null, 2)}\n`;
    if (v.out) writeFileSync(resolve(v.out), body); else process.stdout.write(body);
    console.error(`resolve: ${receipt.status}${receipt.profile ? ` profile=${receipt.profile.id} hash=${receipt.profile.resolved_hash.slice(0, 19)}` : ''}${receipt.conflicts.length ? ` conflicts=${receipt.conflicts.map((c) => c.code).join(',')}` : ''}`);
    if (receipt.status !== STATUS.READY) process.exitCode = 2;
  }
} catch (e) { console.error(`[${e.code ?? 'ERROR'}] ${e.message}`); process.exitCode = 1; }
