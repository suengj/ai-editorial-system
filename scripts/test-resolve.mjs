#!/usr/bin/env node
/**
 * Focused tests for the common editorial entry (SUE-1426 R1/R2): load plan,
 * precedence/locks, voice isolation, read-status honesty, stage consistency,
 * and proof that the REAL entry points call the resolver.
 */
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  RuleReader, loadManifest, resolveEditorial, resolveFields, stageStamp, verifyStages, gateRender,
  checkDeliveryPackage, selectExamples, hashOf, STATUS, REPO_ROOT,
} from './lib/resolve-core.mjs';
import { assessPolish } from './lib/polish-invariants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); } };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const yes = (c, m) => { if (!c) throw new Error(m); };
const intent = (surface, artifacts = ['text/article']) => ({ intent_id: 'intent:test', request: { language: 'ko' }, axes: {
  transformation: { value: 'synthesize' }, content_type: { value: 'research' }, audience: { value: 'domain-practitioner' },
  surface: { value: surface }, artifacts: artifacts.map((value) => ({ value })) } });
const reader = () => new RuleReader({ revision: 'test-rev' });
const paths = (r) => r.loads.map((l) => l.path);
const { manifest } = loadManifest(reader());
const GCTX = { reader: reader() };

console.log('load plan');
test('text task for the personal LinkedIn target loads only its own voice doc and no visual or other-voice docs', () => {
  const r = resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: reader() });
  eq(r.status, STATUS.READY);
  yes(paths(r).includes('editorial/SUENGJ-STYLE.md'), 'personal doc');
  for (const p of ['editorial/TRENDS-MOA-COMMUNITY-TONE.md', 'editorial/BUSINESS-IDEA-MAGAZINE.md', 'editorial/STRUCTURED-VISUAL-EXECUTION.md', 'editorial/visual-recipes.v1.json']) yes(!paths(r).includes(p), `must not load ${p}`);
  yes(r.load_plan.skipped.length === 2, 'two other voice families recorded as skipped');
});
test('visual task for trends.moa loads the community doc, visual rules, and not the personal or business docs', () => {
  const r = resolveEditorial(intent('instagram', ['visual/social-card']), { targetId: 'trends-moa', taskKind: 'visual', reader: reader() });
  eq(r.status, STATUS.READY);
  yes(paths(r).includes('editorial/STRUCTURED-VISUAL-EXECUTION.md') && paths(r).includes('editorial/visual-recipes.v1.json'), 'visual docs');
  yes(!paths(r).includes('editorial/SUENGJ-STYLE.md') && !paths(r).includes('editorial/SIGNALYTICS-BENCHMARK-CARDS.md'), 'no other voice');
});
test('trends.moa default intensity is owner-approved HIGH and retains community voice isolation', () => {
  const r = resolveEditorial(intent('instagram', ['visual/social-card']), { targetId: 'trends-moa', taskKind: 'both', reader: reader() });
  eq(r.status, STATUS.READY);
  eq(r.profile.body.fields.tone_intensity, 'high');
  eq(r.field_origins.tone_intensity.layer, 'account_series');
  yes(paths(r).includes('editorial/TRENDS-MOA-COMMUNITY-TONE.md'), 'community style loaded');
  yes(!paths(r).includes('editorial/SUENGJ-STYLE.md'), 'personal style must not leak');
});
test('the same revision reuses the read cache and the plan cache', () => {
  const rd = reader(); const pc = new Map();
  const a = resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: rd, planCache: pc });
  const reads = rd.stats.reads;
  const b = resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: rd, planCache: pc });
  eq(rd.stats.reads, reads, 'no new file reads');
  yes(rd.stats.hits >= a.loads.length, 'cache hits');
  yes(b.load_plan.reused === true && a.load_plan.reused === false, 'plan reused on 2nd call');
  eq(a.profile.resolved_hash, b.profile.resolved_hash);
});
test('a different revision does not reuse the cache', () => {
  const rd = reader(); resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: rd });
  const rd2 = new RuleReader({ revision: 'other-rev' });
  resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: rd2 });
  eq(rd2.stats.hits, 0);
});
test('an edited file under the same revision label is re-read, not served stale', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'rr-')); writeFileSync(resolve(dir, 'a.md'), 'one');
  const rd = new RuleReader({ root: dir, revision: 'dirty' });
  const h1 = rd.read('a.md').sha256; writeFileSync(resolve(dir, 'a.md'), 'changed-longer'); 
  yes(rd.read('a.md').sha256 !== h1, 'stale served');
});

console.log('read-status honesty');
const fsWith = (fn) => ({ readFileSync: (p) => fn(p, 'read') ?? readFileSync(p), statSync: (p) => fn(p, 'stat') ?? statSync(p) });
const enoent = () => Object.assign(new Error('x'), { code: 'ENOENT' });
test('a missing required rule file is BLOCKED_MISSING_RULE and never reported as read', () => {
  const rd = new RuleReader({ revision: 't', fs: fsWith((p, k) => { if (p.endsWith('voice.md') && /editorial\/voice\.md$/.test(p)) throw enoent(); }) });
  const r = resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: rd });
  eq(r.status, STATUS.BLOCKED_MISSING_RULE);
  eq(r.loads.find((l) => l.path === 'editorial/voice.md').status, 'missing');
  yes(r.profile === null || !r.profile.body.rule_files.some((f) => f.path === 'editorial/voice.md'), 'missing file listed as loaded');
});
test('a truncated read is recorded as truncated and blocks', () => {
  const rd = new RuleReader({ revision: 't', fs: { statSync, readFileSync: (p) => { const b = readFileSync(p); return /SUENGJ-STYLE\.md$/.test(p) ? b.subarray(0, 10) : b; } } });
  const r = resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: rd });
  eq(r.loads.find((l) => l.path === 'editorial/SUENGJ-STYLE.md').status, 'truncated');
  eq(r.status, STATUS.BLOCKED_MISSING_RULE);
});
test('an inaccessible file is recorded as inaccessible and blocks', () => {
  const rd = new RuleReader({ revision: 't', fs: fsWith((p, k) => { if (/SUENGJ-STYLE\.md$/.test(p)) throw Object.assign(new Error('x'), { code: 'EACCES' }); }) });
  const r = resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: rd });
  eq(r.loads.find((l) => l.path === 'editorial/SUENGJ-STYLE.md').status, 'inaccessible');
  eq(r.status, STATUS.BLOCKED_MISSING_RULE);
});

console.log('precedence, locks, origins');
test('field origins record which layer supplied each value', () => {
  const r = resolveEditorial(intent('instagram', ['visual/social-card']), { targetId: 'personal-instagram', taskKind: 'both', reader: reader(), overrides: { task_row: { tone_intensity: 'low' } } });
  eq(r.field_origins.tone_intensity.layer, 'task_row');
  eq(r.profile.body.fields.tone_intensity, 'low');
  eq(r.field_origins.style_overlay.layer, 'account_series');
});
test('facts/figures/sources/rights/approval locks cannot be changed by any overlay', () => {
  for (const f of ['facts', 'figures', 'sources', 'rights', 'approval', 'publication_authority', 'account_identity']) {
    const r = resolveFields({ explicit_request: { [f]: 'x' } }, manifest);
    eq(r.conflicts[0].code, 'LOCKED_FIELD', f); yes(!(f in r.values), `${f} leaked into values`);
  }
});
test('unknown fields and fields set from a layer that may not set them are ignored and recorded', () => {
  const r = resolveFields({ task_row: { style_overlay: 'suengj-style', made_up: 1 } }, manifest);
  eq(r.conflicts.map((c) => c.code).sort(), ['LAYER_NOT_ALLOWED', 'UNKNOWN_FIELD']);
  eq(r.values, {});
});
test('a higher-precedence layer wins and the shadowed value is recorded', () => {
  const r = resolveFields({ explicit_request: { tone_intensity: 'high' }, account_series: { tone_intensity: 'low' } }, manifest);
  eq(r.values.tone_intensity, 'high'); eq(r.conflicts[0].code, 'SHADOWED');
});

console.log('voice isolation (personal / business / community)');
test('forcing the personal overlay onto the community target is blocked as a leak', () => {
  const r = resolveEditorial(intent('instagram', ['visual/social-card']), { targetId: 'trends-moa', reader: reader(), overrides: { explicit_request: { style_overlay: 'suengj-style' } } });
  eq(r.status, STATUS.BLOCKED_LEAK);
});
test('forcing the personal overlay onto signalytics is blocked as a leak', () => {
  const r = resolveEditorial(intent('instagram', ['visual/slide-image']), { targetId: 'signalytics-news', reader: reader(), overrides: { explicit_request: { style_overlay: 'suengj-style' } } });
  eq(r.status, STATUS.BLOCKED_LEAK);
});
test('the three instagram accounts load pairwise-disjoint voice docs (no cross-account leakage)', () => {
  const voice = (id, art) => resolveEditorial(intent('instagram', [art]), { targetId: id, reader: reader() }).loads.map((l) => l.path).filter((p) => Object.values(manifest.voice_docs).flat().includes(p));
  const a = voice('personal-instagram', 'visual/social-card'), b = voice('signalytics-news', 'visual/slide-image'), c = voice('trends-moa', 'visual/social-card');
  for (const [x, y] of [[a, b], [a, c], [b, c]]) yes(x.filter((p) => y.includes(p)).length === 0, 'overlap');
  yes(a.length && b.length && c.length, 'each target loads its own voice doc');
});
test('an account is never guessed: instagram with no target is BLOCKED_TARGET_REQUIRED listing candidates', () => {
  const r = resolveEditorial(intent('instagram'), { reader: reader() });
  eq(r.status, STATUS.BLOCKED_TARGET_REQUIRED); eq(r.conflicts[0].candidates, ['personal-instagram', 'signalytics-news', 'trends-moa']);
});
test('unknown target and surface mismatch are blocked', () => {
  eq(resolveEditorial(intent('instagram'), { targetId: 'nope', reader: reader() }).status, STATUS.BLOCKED_UNKNOWN_TARGET);
  eq(resolveEditorial(intent('linkedin'), { targetId: 'trends-moa', reader: reader() }).status, STATUS.BLOCKED_UNKNOWN_TARGET);
});
test('every manifest voice doc and mapped file exists on disk', () => {
  const all = new Set([...Object.values(manifest.voice_docs).flat(), ...Object.values(manifest.sns_targets).flatMap((t) => [...t.copy_files, ...(t.visual ? [...t.visual.files, ...t.visual.values] : [])])]);
  for (const p of all) yes(statSync(resolve(REPO_ROOT, p)).isFile(), `${p} missing`);
});
test('approved examples: none approved => NO_APPROVED_REFERENCE; unapproved or other-voice never loaded; max 3', () => {
  const r = resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: reader() });
  eq(selectExamples(r, manifest, { reason: 'ambiguity', candidates: [] }).status, 'NO_APPROVED_REFERENCE');
  eq(selectExamples(r, manifest, { reason: 'ambiguity', candidates: [{ approval_status: 'draft', voice_family: 'personal' }, { approval_status: 'approved', voice_family: 'community' }] }).status, 'NO_APPROVED_REFERENCE');
  eq(selectExamples(r, manifest, { reason: 'default', candidates: [] }).status, 'NOT_LOADED');
  const many = Array.from({ length: 5 }, (_, i) => ({ id: i, approval_status: 'approved', voice_family: 'personal' }));
  eq(selectExamples(r, manifest, { reason: 'failure', candidates: many }).loaded.length, 3);
});

console.log('generate / polish / review share one resolved profile');
const ready = () => resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: reader() });
test('matching stamps pass', () => { const r = ready(); eq(verifyStages(r, { generate: stageStamp(r, 'generate'), polish: stageStamp(r, 'polish'), review: stageStamp(r, 'review') }), []); });
test('a stage that used a different profile hash is flagged', () => {
  const r = ready(), other = resolveEditorial(intent('linkedin'), { targetId: 'personal-linkedin', reader: reader(), overrides: { task_row: { tone_intensity: 'low' } } });
  const codes = verifyStages(r, { generate: stageStamp(r, 'generate'), polish: stageStamp(other, 'polish'), review: stageStamp(r, 'review') }).map((i) => i.code);
  yes(codes.includes('STAGE_HASH_MISMATCH'), codes.join());
});
test('a missing stage and a tampered receipt are flagged', () => {
  const r = ready(); const s = { generate: stageStamp(r, 'generate'), polish: stageStamp(r, 'polish') };
  yes(verifyStages(r, s).some((i) => i.code === 'STAGE_MISSING'), 'missing');
  const t = structuredClone(r); t.profile.body.fields.tone_intensity = 'high';
  yes(verifyStages(t, { ...s, review: stageStamp(r, 'review') }).some((i) => i.code === 'RECEIPT_HASH_MISMATCH'), 'tamper');
});
test('polish keeps numbers: 3x->5x and a dropped figure are rejected by the shared invariant check', () => {
  const before = '도입 후 처리 시간이 3배 빨라졌고 비용은 12% 줄었다. (2026-03-04)';
  yes(assessPolish(before, '도입 후 처리 시간이 5배 빨라졌고 비용은 12% 줄었다. (2026-03-04)').ok === false, '3->5 passed');
  yes(assessPolish(before, '도입 후 처리 시간이 3배 빨라졌고 비용이 줄었다. (2026-03-04)').ok === false, 'drop passed');
  yes(assessPolish(before, '도입한 뒤 처리 시간은 3배 빨라졌고, 비용도 12% 줄었다. (2026-03-04)').ok === true, 'harmless rewording rejected');
});

console.log('signalytics delivery package');
test('5 PNG + caption + brief passes; 6th allowed; 4 PNG / missing brief / drive write fail', () => {
  const f = (n) => Array.from({ length: n }, (_, i) => `c${i}.png`);
  yes(checkDeliveryPackage('signalytics-news', [...f(5), 'caption.md', 'benchmark-brief.md'], manifest).ok, '5');
  yes(checkDeliveryPackage('signalytics-news', [...f(6), 'caption.md', 'benchmark-brief.md'], manifest).ok, '6');
  yes(!checkDeliveryPackage('signalytics-news', [...f(4), 'caption.md', 'benchmark-brief.md'], manifest).ok, '4');
  yes(!checkDeliveryPackage('signalytics-news', [...f(5), 'caption.md'], manifest).ok, 'brief');
  yes(!checkDeliveryPackage('signalytics-news', [...f(5), 'caption.md', 'benchmark-brief.md', 'drive:results.csv'], manifest).ok, 'drive');
});

console.log('render gate');
const planFor = (surface, artifact) => ({ profiles: { surface, artifact } });
test('SNS plan without a receipt, with a mismatched artifact, or with a tampered receipt is refused; a matching one passes', () => {
  const rec = resolveEditorial(intent('instagram', ['visual/slide-image']), { targetId: 'signalytics-news', taskKind: 'visual', reader: reader() });
  eq(gateRender(planFor('instagram', 'visual/slide-image'), null, manifest, GCTX).code, 'PROFILE_RECEIPT_REQUIRED');
  eq(gateRender(planFor('instagram', 'visual/social-card'), rec, manifest, GCTX).code, 'ARTIFACT_NOT_MAPPED');
  const t = structuredClone(rec); t.profile.body.fields.canvas = { width: 1 };
  eq(gateRender(planFor('instagram', 'visual/slide-image'), t, manifest, GCTX).code, 'PROFILE_RECEIPT_HASH_MISMATCH');
  eq(gateRender(planFor('linkedin', 'visual/slide-image'), rec, manifest, GCTX).code, 'PROFILE_TARGET_MISMATCH');
  yes(gateRender(planFor('instagram', 'visual/slide-image'), rec, manifest, GCTX).ok, 'matching refused');
  yes(gateRender(planFor('suengj-com', 'visual/evidence-visual'), null, manifest, GCTX).applies === false, 'non-SNS surface should pass through');
});

console.log('real entry points call the resolver');
const src = (f) => readFileSync(resolve(HERE, f), 'utf8');
test('validate-intent, render-visual, render-carousel import and invoke the resolver (fails if the call is removed)', () => {
  yes(/resolveEditorial\(/.test(src('validate-intent.mjs')) && /resolve-core\.mjs/.test(src('validate-intent.mjs')), 'validate-intent');
  for (const f of ['render-visual.mjs', 'render-carousel.mjs']) yes(/gateRender\(/.test(src(f)) && /resolve-core\.mjs/.test(src(f)), f);
});
const run = (args) => spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8' });
test('behavioural: render-visual refuses an Instagram plan without a profile receipt (exit non-zero, PROFILE_RECEIPT_REQUIRED)', () => {
  const out = mkdtempSync(resolve(tmpdir(), 'rv-'));
  const r = run(['scripts/render-visual.mjs', '--plan', 'scripts/fixtures/visual-execution/card.json', '--out', resolve(out, 'x'), '--compile-only']);
  yes(r.status !== 0 && /PROFILE_RECEIPT_REQUIRED/.test(r.stderr), `${r.status} ${r.stderr}`);
});
test('behavioural: validate-intent reports the load plans it resolved', () => {
  const r = run(['scripts/validate-intent.mjs']);
  yes(r.status === 0 && /load plan\(s\) resolved/.test(r.stdout), r.stdout.slice(-300));
});
test('behavioural: resolve-editorial CLI exits 2 on BLOCKED_TARGET_REQUIRED and 0 on READY', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 're-')); const f = resolve(HERE, '../schemas/examples/intent-sns-instagram.example.json');
  yes(run(['scripts/resolve-editorial.mjs', '--intent', f]).status === 2, 'blocked exit');
  yes(run(['scripts/resolve-editorial.mjs', '--intent', f, '--target', 'trends-moa', '--out', resolve(dir, 'r.json')]).status === 0, 'ready exit');
});

console.log(`\nresolve: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
