#!/usr/bin/env node
/** Tests for scripts/export-web-catalog.mjs: determinism, --check drift detection, public-safety. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { buildCatalog, render, OUT_PATH } from './export-web-catalog.mjs';
import { REPO_ROOT } from './lib/resolve-core.mjs';

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); } };
const yes = (c, m) => { if (!c) throw new Error(m); };
const out = resolve(REPO_ROOT, OUT_PATH);
const run = (...a) => spawnSync(process.execPath, [resolve(REPO_ROOT, 'scripts/export-web-catalog.mjs'), ...a], { encoding: 'utf8' });

console.log('web catalog export');
const a = render(), b = render(buildCatalog());
test('output is deterministic across builds', () => yes(a === b, 'two builds differ'));
test('keys are sorted at every level and the file ends with a newline', () => {
  const sorted = (x) => Array.isArray(x) ? x.every(sorted) : x && typeof x === 'object' ? (() => { const k = Object.keys(x); return k.join() === [...k].sort().join() && k.every((n) => sorted(x[n])); })() : true;
  yes(sorted(JSON.parse(a)), 'unsorted keys'); yes(a.endsWith('}\n'), 'newline');
});
test('committed file is current (--check passes)', () => { const r = run('--check'); yes(r.status === 0, r.stderr); });
test('--check detects drift', () => {
  const orig = existsSync(out) ? readFileSync(out, 'utf8') : null;
  try {
    writeFileSync(out, orig.replace('"catalog_version": "1.0.0"', '"catalog_version": "9.9.9"'));
    yes(run('--check').status !== 0, 'drifted file passed --check');
  } finally { writeFileSync(out, orig); }
  yes(run('--check').status === 0, 'restored file should pass');
});
test('content digest covers the body and the commit is not embedded', () => {
  const c = JSON.parse(a); yes(/^sha256:[0-9a-f]{64}$/.test(c.content_digest), 'digest format');
  yes(!/\b[0-9a-f]{40}\b/.test(JSON.stringify(c.generated_from)), 'git commit must not be embedded');
  yes(c.generated_from.manifest.manifest_version, 'manifest_version');
});
test('all registered targets and flows, locked fields, schemas and gates are present', () => {
  const c = JSON.parse(a);
  yes(c.targets.map((t) => t.id).join() === 'personal-instagram,personal-linkedin,signalytics-news,trends-moa', 'targets');
  yes(c.flows.map((f) => f.id).join() === 'blog,news,report', 'flows');
  yes(c.locked_fields.includes('facts') && c.precedence[0] === 'explicit_request', 'locks/precedence');
  yes(JSON.stringify(Object.keys(c.schemas)) === JSON.stringify(['editorial-intent', 'feedback-record', 'narration-script', 'render-spec', 'tts-contract', 'video-plan', 'visual-brief']), 'schemas');
  yes(c.schemas['editorial-intent'].schema.properties.schema_version.const === '2.0.0', 'intent 2.0.0');
  yes(c.quality_gates.copy_gates.map((g) => g.id).join() === 'G-01,G-03,G-06', 'gates');
  yes(c.carousel_series.frames.min === 1 && c.carousel_series.frames.max === 20, 'frames 1-20');
  for (const t of c.targets) for (const refs of Object.values(t.rule_refs)) for (const r of refs) yes(/^[0-9a-f]{64}$/.test(r.sha256) && r.path, 'ref shape');
});
test('no rule prose, excerpts, private paths, Drive ids or secrets', () => {
  yes(!/approved-examples|intelligence-library|SUENGJ-STYLE-20261014-PROPOSAL|\/Users\/|evals\/|corpus\/|drive\.google|docs\.google|\.env|api[_-]?key|BEGIN [A-Z ]*PRIVATE KEY|ghp_|sk-[A-Za-z0-9]{10}/i.test(a), 'forbidden marker present');
  const c = JSON.parse(a);
  const gate = JSON.stringify(c.quality_gates);
  yes(!/patterns|rationale/.test(gate), 'gate prose/patterns');
  for (const t of c.targets) for (const refs of Object.values(t.rule_refs)) for (const r of refs) yes(Object.keys(r).sort().join() === 'path,role,sha256', 'ref carries only path/role/sha256');
  const m = JSON.parse(readFileSync(resolve(REPO_ROOT, 'editorial/entry-manifest.json'), 'utf8'));
  yes(!a.includes(m.description), 'manifest description prose');
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
