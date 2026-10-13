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
import { stageStamp, verifyStages, gateRender, hashOf, loadManifest, RuleReader, READ, VERIFY, currentRevision, gitBlobId, gitState, resolveEditorial } from './lib/resolve-core.mjs';

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

console.log('B3b: the render gate proves what it claims');
{
  const { manifest } = loadManifest(new RuleReader({ root: ROOT }));
  const live = () => new RuleReader({ root: ROOT });
  const plan = { profiles: { surface: 'instagram', artifact: 'visual/slide-image' } };
  const mk = (target = 'signalytics-news', taskKind = 'visual', artifacts = ['visual/slide-image']) => resolveEditorial({ ...igIntent, axes: { ...igIntent.axes, artifacts: artifacts.map((value) => ({ value })) } }, { targetId: target, taskKind, reader: live() });
  const rehash = (r) => { r.profile.resolved_hash = hashOf(r.profile.body); return r; };
  const gate = (r, ctx = {}) => gateRender(plan, r, manifest, { reader: live(), ...ctx });
  test('a genuine, current, visual receipt passes and the output states revision + integrity wording', () => {
    const g = gate(mk()); yes(g.ok, JSON.stringify(g)); eq(g.revision_check, 'current'); yes(/not cryptographically authenticated/.test(g.integrity), 'wording');
  });
  test('hashed body carries status, target id, intent id, revision, task kind, manifest sha', () => {
    const b = mk().profile.body;
    for (const k of ['status', 'target_id', 'intent_id', 'revision', 'task_kind', 'manifest_sha256']) yes(b[k] !== undefined && b[k] !== null, `${k} missing`);
  });
  test('a receipt for another target cannot be relabelled (body id must equal target:<id>)', () => {
    const r = mk('trends-moa', 'visual', ['visual/social-card']); r.target.id = 'signalytics-news';
    eq(gate(r).code, 'PROFILE_TARGET_MISMATCH');
  });
  test('forged-and-rehashed: id swapped inside the body is still refused through target_id', () => {
    const r = mk('trends-moa', 'visual', ['visual/social-card']); r.target.id = 'signalytics-news'; r.profile.body.id = 'target:signalytics-news'; rehash(r);
    eq(gate(r).code, 'PROFILE_TARGET_MISMATCH');
  });
  test('a text-only receipt cannot authorise a render', () => {
    eq(gate(mk('signalytics-news', 'text')).code, 'PROFILE_TASK_KIND');
  });
  test('a receipt whose body dropped the visual rule files is refused', () => {
    const r = mk(); r.profile.body.rule_files = r.profile.body.rule_files.filter((f) => !/STRUCTURED-VISUAL/.test(f.path)); rehash(r);
    eq(gate(r).code, 'VISUAL_RULES_NOT_LOADED');
  });
  test('a rule file changed after the receipt was resolved is refused', () => {
    const r = mk(); const f = r.profile.body.rule_files.find((x) => /visual-recipes/.test(x.path)); f.sha256 = 'sha256:' + '0'.repeat(64); rehash(r);
    eq(gate(r).code, 'VISUAL_RULES_CHANGED');
  });
  test('a receipt for a different manifest is refused', () => {
    const r = mk(); r.profile.body.manifest_sha256 = 'sha256:' + '1'.repeat(64); rehash(r);
    eq(gate(r).code, 'MANIFEST_CHANGED');
  });
  test('a stale revision is refused unless explicitly pinned; the pin is recorded', () => {
    const r = mk(); r.profile.body.revision = 'abc1234'; rehash(r);
    eq(gate(r).code, 'PROFILE_REVISION_STALE');
    eq(gate(r, { pinnedRevision: 'zzz' }).code, 'PROFILE_REVISION_STALE');
    const g = gate(r, { pinnedRevision: 'abc1234' }); yes(g.ok, JSON.stringify(g)); eq(g.revision_check, 'pinned'); eq(g.revision, 'abc1234');
  });
  test('a status that is not READY inside the hashed body is refused', () => {
    const r = mk(); r.profile.body.status = 'BLOCKED_LEAK'; rehash(r); eq(gate(r).code, 'PROFILE_RECEIPT_NOT_READY');
  });
  test('render-visual CLI: stale receipt exits 1 PROFILE_REVISION_STALE; --pinned-revision renders and prints revision_check', () => {
    const scratch = tmp(); const rp = resolve(scratch, 'r.json');
    const res = run(['scripts/resolve-editorial.mjs', '--plan', 'scripts/fixtures/visual-execution/card.json', '--target', 'personal-instagram', '--out', rp]); eq(res.status, 0, res.stderr);
    const r = JSON.parse(readFileSync(rp, 'utf8')); r.profile.body.revision = 'abc1234'; rehash(r); writeFileSync(rp, JSON.stringify(r));
    const stale = run(['scripts/render-visual.mjs', '--plan', 'scripts/fixtures/visual-execution/card.json', '--profile-receipt', rp, '--compile-only', '--out', resolve(scratch, 'o1')]);
    yes(stale.status === 1 && /PROFILE_REVISION_STALE/.test(stale.stderr), `${stale.status} ${stale.stderr}`);
    const pinned = run(['scripts/render-visual.mjs', '--plan', 'scripts/fixtures/visual-execution/card.json', '--profile-receipt', rp, '--pinned-revision', 'abc1234', '--compile-only', '--out', resolve(scratch, 'o2')]);
    yes(pinned.status === 0 && /"revision_check":"pinned"/.test(pinned.stdout), `${pinned.status} ${pinned.stdout}${pinned.stderr}`);
  });
  test('resolve-editorial --intent runs the intent validator (schema-invalid intent exits 1 INTENT_INVALID)', () => {
    const f = resolve(tmp(), 'i.json'); writeFileSync(f, JSON.stringify(igIntent));
    const r = run(['scripts/resolve-editorial.mjs', '--intent', f, '--target', 'trends-moa']);
    yes(r.status === 1 && /INTENT_INVALID/.test(r.stderr), `${r.status} ${r.stderr}`);
  });
}

console.log('S1: stage verification');
const mk0 = () => resolveEditorial(igIntent, { targetId: 'signalytics-news', taskKind: 'visual', reader: new RuleReader({ root: ROOT }) });
test('verifyStages: a non-READY receipt is NOT_READY even with a profile and matching stamps', () => {
  const r = mk0(); const stamps = { generate: stageStamp(r, 'generate'), polish: stageStamp(r, 'polish'), review: stageStamp(r, 'review') };
  eq(verifyStages(r, stamps), []);
  const bl = structuredClone(r); bl.status = 'BLOCKED_LEAK';
  eq(verifyStages(bl, stamps).map((i) => i.code), ['NOT_READY']);
});
test('review-l1 and review-visual skills carry the stage-check step', () => {
  for (const f of ['skills/review-l1/SKILL.md', 'skills/review-visual/SKILL.md']) yes(/resolve-editorial\.mjs --receipt/.test(readFileSync(resolve(ROOT, f), 'utf8')), f);
});

console.log('S3: resolver robustness');
{
  const rd = () => new RuleReader({ root: ROOT, revision: 'test' });
  const res = (over, o = {}) => resolveEditorial(igIntent, { targetId: 'signalytics-news', taskKind: 'visual', reader: rd(), ...o, overrides: over });
  test('prototype-chain field/layer/target/flow names do not crash the resolver', () => {
    for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const r = res(JSON.parse(`{"account_series":{"${k}":"x"},"${k}":{"tone_intensity":"low"}}`));
      yes(r.conflicts.some((c) => c.code === 'UNKNOWN_FIELD' || c.code === 'UNKNOWN_LAYER'), `${k}: ${JSON.stringify(r.conflicts.map((c) => c.code))}`);
      yes(String(resolveEditorial(igIntent, { targetId: k, reader: rd() }).status).startsWith('BLOCKED'), `target ${k}`);
      yes(String(resolveEditorial({ ...igIntent, axes: { ...igIntent.axes, surface: { value: 'suengj-com' } } }, { flowId: k, reader: rd() }).status).startsWith('BLOCKED'), `flow ${k}`);
    }
  });
  test('caller-supplied __sources cannot choose the recorded origin', () => {
    const r = res({ account_series: { tone_intensity: 'low' }, __sources: { account_series: 'owner-approved by Suengjae' } });
    eq(r.field_origins.tone_intensity.source, 'account_series');
    yes(r.conflicts.some((c) => c.code === 'IGNORED_RESERVED_KEY'), 'recorded');
  });
  test('array / scalar layers give INVALID_LAYER records', () => {
    for (const bad of [['x'], 'str', 3]) {
      const r = res({ account_series: bad }); yes(r.conflicts.some((c) => c.code === 'INVALID_LAYER' && c.layer === 'account_series'), JSON.stringify(r.conflicts));
    }
    yes(res(['x']).conflicts.some((c) => c.code === 'INVALID_LAYER'), 'array overrides');
  });
  test('ids are validated before any path is built (case variants, traversal, wrong task kind)', () => {
    const withAxis = (patch) => resolveEditorial({ ...igIntent, axes: { ...igIntent.axes, ...patch } }, { reader: rd() });
    for (const surface of ['Instagram', '../surface/instagram', 'instagram ', 'instagram/../linkedin', 'a.b']) eq(withAxis({ surface: { value: surface } }).status, 'BLOCKED_INVALID_ID', surface);
    eq(withAxis({ artifacts: [{ value: 'visual/../../x' }] }).status, 'BLOCKED_INVALID_ID');
    eq(withAxis({ audience: { value: '../../etc/passwd' } }).status, 'BLOCKED_INVALID_ID');
    eq(resolveEditorial(igIntent, { targetId: 'Signalytics-News', reader: rd() }).status, 'BLOCKED_INVALID_ID');
    eq(resolveEditorial(igIntent, { targetId: 'signalytics-news', taskKind: 'constructor', reader: rd() }).status, 'BLOCKED_INVALID_ID');
    const none = withAxis({ surface: { value: 'Instagram' } }); yes(!none.profile && none.loads.length === 0, 'nothing read');
  });
  test('gate: a non-SNS surface label cannot bypass an SNS receipt or an SNS-only artifact; case variants refused', () => {
    const { manifest } = loadManifest(rd());
    const rec = resolveEditorial(igIntent, { targetId: 'signalytics-news', taskKind: 'visual', reader: rd() });
    const g = (surface, artifact, r) => gateRender({ profiles: { surface, artifact } }, r, manifest, { reader: rd(), pinnedRevision: rec.profile.body.revision });
    eq(g('suengj-com', 'visual/slide-image', null).code, 'PROFILE_RECEIPT_REQUIRED');
    eq(g('suengj-com', 'visual/slide-image', rec).code, 'PROFILE_TARGET_MISMATCH');
    eq(g('Instagram', 'visual/slide-image', rec).code, 'INVALID_ID');
    eq(g('suengj-com', 'visual/evidence-visual', null).applies, false);
  });
  test('render-visual CLI: an Instagram-only artifact labelled suengj-com is refused without a receipt', () => {
    const scratch = tmp(); const plan = JSON.parse(readFileSync(resolve(ROOT, 'scripts/fixtures/visual-execution/card.json'), 'utf8')); plan.profiles.surface = 'suengj-com';
    writeFileSync(resolve(scratch, 'p.json'), JSON.stringify(plan));
    const r = run(['scripts/render-visual.mjs', '--plan', resolve(scratch, 'p.json'), '--compile-only', '--out', resolve(scratch, 'o')]);
    yes(r.status === 1 && /PROFILE_RECEIPT_REQUIRED/.test(r.stderr), `${r.status} ${r.stderr}`);
  });
  test('the dead surface_brand_default layer: code and manifest comment agree', () => {
    const rc = readFileSync(resolve(ROOT, 'scripts/lib/resolve-core.mjs'), 'utf8');
    if (/surface_brand_default: \{\}/.test(rc)) yes(/surface_brand_default is intentionally empty/.test(rc), 'layer declared empty with no comment');
  });
}

console.log('S6: manifest cleanups');
test('signalytics-news has no invented tone_intensity default; the field is simply unset', () => {
  eq(man.sns_targets['signalytics-news'].copy_defaults, { style_overlay: 'none' });
  const r = withOv('signalytics-news', {}); eq(r.status, 'READY'); yes(!('tone_intensity' in r.profile.body.fields), 'no tone default');
});
test('trends-moa carousel (visual/slide-image) stays unmapped and is refused as ARTIFACT_NOT_MAPPED (owner question)', () => {
  const rec = resolveEditorial(igIntent, { targetId: 'trends-moa', taskKind: 'visual', reader: new RuleReader({ root: ROOT }) });
  const g = gateRender({ profiles: { surface: 'instagram', artifact: 'visual/slide-image' } }, rec, man, { reader: new RuleReader({ root: ROOT }) });
  eq(g.code, 'ARTIFACT_NOT_MAPPED');
});

console.log(`\nresolve-hardening: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
