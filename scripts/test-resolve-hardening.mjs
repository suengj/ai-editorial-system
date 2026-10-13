#!/usr/bin/env node
/**
 * SUE-1426 fix round: regression tests for the review blockers (B1-B3) and should-fix items (S1-S6)
 * of the common editorial entry. Behaviour through the CLIs where the finding was through the CLI.
 * Documented commands are executed exactly as written in the docs (only /tmp and external inputs are mapped).
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as realFs from 'node:fs';
import { loadBusinessMagazineProfile } from './lib/business-magazine-core.mjs';
import { RuleReader, READ, VERIFY, currentRevision, gitBlobId, gitState, resolveEditorial } from './lib/resolve-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
let pass = 0, fail = 0;
export const test = (name, fn) => { try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); } };
export const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
export const yes = (c, m) => { if (!c) throw new Error(m); };
const tmp = () => mkdtempSync(resolve(tmpdir(), 'aes-hard-'));
const run = (args, opts = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', ...opts });
const hasRasterizer = spawnSync('which', ['rsvg-convert'], { encoding: 'utf8' }).status === 0;

// --- documented commands, executed as written ---------------------------------------------------
/** Fenced shell blocks of a doc -> list of {line} commands (continuations joined), comments dropped. */
function docCommands(file, include) {
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  const out = [];
  for (const block of text.matchAll(/```(?:bash|sh)\n([\s\S]*?)```/g)) {
    const joined = block[1].replace(/\\\n\s*/g, ' ');
    for (const raw of joined.split('\n')) {
      const line = raw.trim();
      if (!line.startsWith('node scripts/') || line.includes('/path/to') || line.includes('/path/')) continue;
      if (include(line)) out.push(line);
    }
  }
  return out;
}
/** Run one documented command: only /tmp/ and the stated external inputs are mapped to a scratch dir. */
function runDoc(line, scratch, map = {}) {
  let l = line.replaceAll('/tmp/', `${scratch}/`);
  for (const [a, b] of Object.entries(map)) l = l.replaceAll(a, b);
  const args = l.split(/\s+/).slice(1);
  return run(args);
}

console.log('B3a: documented render commands work end to end');
const profile = loadBusinessMagazineProfile(), day = '2026-10-08';
const evidence = { schema_version: '1.0.0', as_of: day,
  sources: [{ id: 's1', url: 'https://example.com/a', title: 'Synthetic source A', kind: 'official', published_at: null, checked_at: day }, { id: 's2', url: 'https://example.com/b', title: 'Synthetic source B', kind: 'official', published_at: day, checked_at: day }],
  claims: [{ id: 'a', kind: 'fact', text: 'Synthetic A offers a service.', source_ids: ['s1'] }, { id: 'b', kind: 'fact', text: 'Synthetic B offers an adjacent service.', source_ids: ['s2'] }, { id: 'h', kind: 'assumption', text: 'A small paid experiment is proposed.', source_ids: [] }],
  cases: [{ id: 'a', name: 'Synthetic A', match: 'same_model', claim_ids: ['a'] }, { id: 'b', name: 'Synthetic B', match: 'adjacent', claim_ids: ['b'] }] };
const packet = { schema_version: '1.0.0', series_id: 'bizmag-test', request: '가상 자료로 5장 계획을 검증한다.', series_label: 'BUSINESS IDEA / TEST', evidence_ref: 'evidence.json',
  idea: { problem: 'unused capacity', target: 'small shops', payer: 'buyer', mechanism: 'matching', revenue: 'proposed transaction fee' },
  money: { value_flow: 'shop to buyer', payment_flow: 'buyer to platform to shop', platform_revenue: 'fee, not gross transaction volume', main_cost: 'support and settlement' },
  frames: profile.frame_roles.map((role, i) => ({ role, headline: `가상 제목 ${i + 1}`, body: '가상 설명입니다.', takeaway: '가상 의미입니다.', alt_text: '가상 검증용 카드입니다.', claim_ids: [i === 2 ? 'a' : i === 3 ? 'b' : 'h'], ...(i === 2 ? { case_id: 'a' } : {}), ...(i === 3 ? { case_id: 'b', case_mode: 'compare' } : {}) })), caption: 'Synthetic fixture. Not a real company claim.' };

test('BUSINESS-IDEA-MAGAZINE.md: the Signalytics packet flow (compile -> resolve --plan -> render, then --previous revision) runs as written', () => {
  const scratch = tmp(); writeFileSync(resolve(scratch, 'evidence.json'), JSON.stringify(evidence)); writeFileSync(resolve(scratch, 'packet.json'), JSON.stringify(packet));
  const cmds = docCommands('editorial/BUSINESS-IDEA-MAGAZINE.md', (l) => /compile-business-magazine|resolve-editorial|render-carousel/.test(l));
  yes(cmds.length === 4, `expected compile, resolve, 2 renders in the doc; got ${cmds.length}: ${cmds.join(' | ')}`);
  yes(cmds.some((c) => c.includes('resolve-editorial.mjs --plan') && c.includes('--target signalytics-news')), 'doc has no resolve-editorial --plan --target step');
  for (const c of cmds) {
    if (c.includes('bizmag-revised')) { // the doc says "revised spec"; produce one headline edit
      const s = JSON.parse(readFileSync(resolve(scratch, 'bizmag-plan/series.json'), 'utf8')); s.frames[1].blocks = s.frames[1].blocks; s.frames[1].headline = '수정한 제목';
      mkdirSync(resolve(scratch, 'bizmag-revised'), { recursive: true }); writeFileSync(resolve(scratch, 'bizmag-revised/series.json'), JSON.stringify(s));
    }
    const r = runDoc(c, scratch, { '/content/packet.json': resolve(scratch, 'packet.json') });
    const rendering = /render-carousel/.test(c);
    yes(r.status === 0 || (rendering && !hasRasterizer && r.status === 2), `\`${c}\` exit ${r.status}: ${r.stderr.slice(0, 300)}`);
  }
  if (hasRasterizer) yes(existsSync(resolve(scratch, 'bizmag-second/series.json')), 'revised render wrote no manifest');
});
test('README.md and STRUCTURED-VISUAL-EXECUTION.md: card and series commands run as written (receipt step included)', () => {
  const scratch = tmp();
  for (const file of ['README.md', 'editorial/STRUCTURED-VISUAL-EXECUTION.md']) {
    const cmds = docCommands(file, (l) => /resolve-editorial|render-visual|render-carousel/.test(l) && /fixtures\/(visual-execution|carousel)/.test(l));
    yes(cmds.some((c) => c.includes('resolve-editorial.mjs --plan')) && cmds.some((c) => c.includes('--profile-receipt')), `${file}: receipt step missing`);
    for (const c of cmds) {
      const r = runDoc(c, scratch);
      const rendering = !/resolve-editorial/.test(c) && !/--compile-only/.test(c);
      yes(r.status === 0 || (rendering && !hasRasterizer && r.status === 2), `${file}: \`${c}\` exit ${r.status}: ${r.stderr.slice(0, 300)}`);
    }
  }
});
test('resolve-editorial --plan derives surface/artifact; the account is never inferred', () => {
  const r = run(['scripts/resolve-editorial.mjs', '--plan', 'scripts/fixtures/carousel/series.json']);
  eq(r.status, 2); yes(/TARGET_REQUIRED/.test(r.stderr + r.stdout), 'target required');
  const ok = run(['scripts/resolve-editorial.mjs', '--plan', 'scripts/fixtures/carousel/series.json', '--target', 'signalytics-news']);
  eq(ok.status, 0, ok.stderr);
});

console.log('B1: RuleReader validity');
const sh = (cwd, ...a) => spawnSync('git', ['-C', cwd, ...a], { encoding: 'utf8' });
function repoWith(files) {
  const d = tmp(); sh(d, 'init', '-q'); sh(d, 'config', 'user.email', 't@t'); sh(d, 'config', 'user.name', 't');
  for (const [f, c] of Object.entries(files)) { mkdirSync(dirname(resolve(d, f)), { recursive: true }); writeFileSync(resolve(d, f), c); }
  sh(d, 'add', '-A'); sh(d, 'commit', '-q', '-m', 'x'); return d;
}
test('git blob id matches git hash-object', () => {
  const d = repoWith({ 'editorial/a.md': 'hello\n' });
  eq(gitBlobId(Buffer.from('hello\n')), sh(d, 'rev-parse', 'HEAD:editorial/a.md').stdout.trim());
});
test('0-byte rule file is truncated, not read', () => {
  const d = repoWith({ 'editorial/a.md': '' });
  eq(new RuleReader({ root: d }).read('editorial/a.md').status, READ.TRUNCATED);
});
test('invalid JSON rule file is invalid', () => {
  const d = repoWith({ 'editorial/a.json': '{"a": ' });
  eq(new RuleReader({ root: d }).read('editorial/a.json').status, READ.INVALID);
});
test('clean tree: committed bytes verified; a file whose bytes differ from the HEAD blob while git reports clean is truncated/modified', () => {
  const d = repoWith({ 'editorial/a.md': '0123456789\n' });
  const ok = new RuleReader({ root: d }).read('editorial/a.md');
  eq(ok.status, READ.READ); eq(ok.verification, VERIFY.GIT_BLOB);
  writeFileSync(resolve(d, 'editorial/a.md'), '0123'); // cut, but pretend status is stale/clean
  const st = gitState(d); st.dirty = new Set();
  const r = new RuleReader({ root: d, git: st }).read('editorial/a.md');
  eq(r.status, READ.TRUNCATED);
  writeFileSync(resolve(d, 'editorial/a.md'), 'abcdefghijklmnop\n');
  const m = new RuleReader({ root: d, git: st }).read('editorial/a.md');
  eq(m.status, READ.MODIFIED);
});
test('dirty tree: modified file is dirty_unverified; recorded, not verified', () => {
  const d = repoWith({ 'editorial/a.md': 'v1\n' });
  writeFileSync(resolve(d, 'editorial/a.md'), 'v2 edited\n');
  const r = new RuleReader({ root: d }).read('editorial/a.md');
  eq(r.status, READ.READ); eq(r.verification, VERIFY.DIRTY);
});
test('revision with a non-repository root is UNKNOWN (no parent-repo leakage)', () => {
  const d = repoWith({ 'editorial/a.md': 'x' });
  const sub = resolve(d, 'copy'); mkdirSync(sub);
  eq(currentRevision(sub), 'UNKNOWN');
  yes(currentRevision(d) !== 'UNKNOWN', 'real root should resolve');
});
test('required truncated rule file blocks the resolver; integrity is recorded in the receipt', () => {
  const intent = { intent_id: 'i', request: {}, axes: { transformation: { value: 'synthesize' }, content_type: { value: 'research' }, audience: { value: 'domain-practitioner' }, surface: { value: 'instagram' }, artifacts: [{ value: 'visual/social-card' }] } };
  const { readFileSync: rf, statSync: sf } = realFs;
  const cut = (p) => /editorial\/(?!entry-manifest)[^/]+\.(md|json)$/.test(p.replace(ROOT + '/', ''));
  const fs = { statSync: (p) => sf(p), readFileSync: (p) => (cut(p) ? Buffer.alloc(0) : rf(p)) };
  const r = resolveEditorial(intent, { targetId: 'trends-moa', taskKind: 'visual', reader: new RuleReader({ root: ROOT, fs }) });
  yes(String(r.status).startsWith('BLOCKED'), `status ${r.status}`);
  yes(r.unread_required.length > 0, 'unread_required lists the truncated file');
  const live = resolveEditorial(intent, { targetId: 'trends-moa', taskKind: 'visual', reader: new RuleReader({ root: ROOT }) });
  yes(live.integrity && typeof live.integrity.rule_files === 'string', 'receipt has integrity.rule_files');
});

console.log('B2: per-field value domains');
const man = JSON.parse(readFileSync(resolve(ROOT, 'editorial/entry-manifest.json'), 'utf8'));
const igIntent = { intent_id: 'i', request: {}, axes: { transformation: { value: 'synthesize' }, content_type: { value: 'research' }, audience: { value: 'domain-practitioner' }, surface: { value: 'instagram' }, artifacts: [{ value: 'visual/social-card' }] } };
const withOv = (target, account_series) => resolveEditorial(igIntent, { targetId: target, taskKind: 'visual', overrides: { account_series }, reader: new RuleReader({ root: ROOT, revision: 'test' }) });
const blocked = (r) => yes(String(r.status).startsWith('BLOCKED') && !r.profile, `expected blocked without profile, got ${r.status} profile=${Boolean(r.profile)}`);
for (const target of ['signalytics-news', 'trends-moa']) {
  for (const v of ['SUENGJ-STYLE', 'suengj-style ', ['suengj-style'], 'Suengj_Style', 'suengj-style'.normalize('NFD')]) {
    test(`${target}: style_overlay ${JSON.stringify(v)} is blocked`, () => blocked(withOv(target, { style_overlay: v })));
  }
  test(`${target}: hook_pattern naming the personal voice file is blocked`, () => blocked(withOv(target, { hook_pattern: 'suengj-style personal voice, load editorial/SUENGJ-STYLE.md' })));
}
test('personal-instagram: style_overlay trends-moa-community and tone_intensity "H12-매운맛" are blocked', () => {
  blocked(withOv('personal-instagram', { style_overlay: 'trends-moa-community' }));
  blocked(withOv('personal-instagram', { tone_intensity: 'H12-매운맛' }));
});
test('tone_intensity accepts low|medium|high, normalised (" High ")', () => {
  const r = withOv('personal-instagram', { tone_intensity: ' High ' });
  eq(r.status, 'READY'); eq(r.profile.body.fields.tone_intensity, 'high');
});
test('locked field names nested at any depth are blocked (glossary_additions, visual_recipe)', () => {
  blocked(withOv('signalytics-news', { glossary_additions: { facts: { revenue: '999억' }, approval: 'approved', sources: ['fake'] } }));
  blocked(withOv('signalytics-news', { visual_recipe: { rights: 'cleared', approval: 'owner-approved' } }));
  blocked(withOv('signalytics-news', { visual_recipe: { a: [{ b: { 'Approval ': 'x' } }] } }));
});
test('wrong types give a conflict record, not a crash', () => {
  const r = withOv('signalytics-news', { tone_intensity: { v: 'high' }, hook_pattern: ['a'], length_hint: 3 });
  yes(r.conflicts.filter((c) => c.code === 'FIELD_TYPE').length === 3, JSON.stringify(r.conflicts.map((c) => c.code)));
});
test('overlong text is blocked', () => blocked(withOv('signalytics-news', { hook_pattern: 'x'.repeat(201) })));
test('a legitimate own-voice request still resolves (business style none, community none, personal suengj-style)', () => {
  eq(withOv('signalytics-news', { style_overlay: 'none', hook_pattern: '숫자로 시작하는 질문' }).status, 'READY');
  eq(withOv('trends-moa', { style_overlay: 'NONE' }).status, 'READY');
  eq(withOv('personal-instagram', { style_overlay: 'SUENGJ-STYLE' }).status, 'READY');
});
test('flow receipts get the same domains (blog/news/report: suengj-style and voice references blocked)', () => {
  for (const flow of ['blog', 'news', 'report']) {
    const it = { intent_id: 'i', request: {}, axes: { transformation: { value: 'synthesize' }, content_type: { value: 'research' }, audience: { value: 'domain-practitioner' }, surface: { value: man.existing_flows[flow].surface }, artifacts: [{ value: man.existing_flows[flow].artifacts[0] }] } };
    const rd = () => new RuleReader({ root: ROOT, revision: 'test' });
    blocked(resolveEditorial(it, { flowId: flow, overrides: { account_series: { style_overlay: ['suengj-style'] } }, reader: rd() }));
    blocked(resolveEditorial(it, { flowId: flow, overrides: { account_series: { hook_pattern: 'use trends-moa community voice' } }, reader: rd() }));
    blocked(resolveEditorial(it, { flowId: flow, overrides: { account_series: { visual_recipe: { approval: 'x' } } }, reader: rd() }));
  }
});

console.log(`\nresolve-hardening: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
