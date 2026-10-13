#!/usr/bin/env node
/**
 * Focused tests: R4 quality feedback wiring + R5 existing-flow common entry (SUE-1426).
 * Fixtures are SYNTHETIC (labelled): no real owner approval, example, habit frequency or experience is represented.
 * CI: NOT_RUN_BY_OWNER_REQUEST.
 */
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RuleReader, loadManifest, resolveEditorial, gateRender, stageStamp, verifyStages, hashOf, STATUS, REPO_ROOT } from './lib/resolve-core.mjs';
import { FeedbackStore, loadApprovedCandidates, exampleStep, recordOutcome, recordImplicitFeedback, applyExplicitPreference, rollbackPreference, scopedGuidance, NO_APPROVED_REFERENCE } from './lib/quality-feedback-core.mjs';
import { runLibraryIntake } from './library-intake.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const test = (n, f) => { try { f(); pass++; console.log(`  ok   ${n}`); } catch (e) { fail++; console.log(`  FAIL ${n}\n       ${e.message}`); } };
const yes = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const throwsCode = (fn, code) => { try { fn(); } catch (e) { if (e.code === code) return; throw new Error(`expected ${code} got ${e.code}`); } throw new Error(`expected ${code}`); };
const fullIntent = (surface, artifacts = ['text/article']) => {
  const ex = JSON.parse(readFileSync(resolve(REPO_ROOT, 'schemas/examples/intent-reference-dimensions.example.json'), 'utf8'));
  ex.intent_id = 'intent:2026-10-13-r4r5-test';
  ex.axes.surface = { value: surface, state: 'confirmed', profile_ref: `editorial/profiles/surface/${surface}.json`, basis: 'SYNTHETIC test intent' };
  ex.axes.artifacts = artifacts.map((value) => ({ value, state: 'confirmed', basis: 'SYNTHETIC test intent', ...(value.startsWith('visual/') ? { profile_ref: `editorial/profiles/artifact/${value.replace('/', '-')}.json` } : {}) }));
  ex.axes.content_type = { ...ex.axes.content_type, state: 'confirmed', basis: 'SYNTHETIC test intent' };
  ex.inputs = { sources: [], references: [] }; ex.overrides = [];
  return ex;
};
const rd = () => new RuleReader({ revision: 'test-rev' });
const { manifest } = loadManifest(rd());
const GCTX = { reader: rd() };
const intent = (surface, artifacts = ['text/article']) => ({ intent_id: 'intent:test', request: { language: 'ko' }, axes: { transformation: { value: 'synthesize' }, content_type: { value: 'research' }, audience: { value: 'domain-practitioner' }, surface: { value: surface }, artifacts: artifacts.map((value) => ({ value })) } });
const tmp = () => mkdtempSync(resolve(tmpdir(), 'qf-'));
const rcpt = (surface, target, art) => resolveEditorial(intent(surface, art), { targetId: target, reader: rd() });

// SYNTHETIC corpus + approvals (labelled; not owner material)
const corpus = [
  { entry_id: 'corpus:synthetic-a', source_ref: { locator: 'fixture-locator-a' }, owner_verdict: 'accepted', reference_eligible: true },
  { entry_id: 'corpus:synthetic-b', source_ref: { locator: 'fixture-locator-b' }, owner_verdict: 'accepted', reference_eligible: true },
  { entry_id: 'corpus:synthetic-c', source_ref: { locator: 'fixture-locator-c' }, owner_verdict: 'needs_rework', reference_eligible: false },
  { entry_id: 'corpus:synthetic-d', source_ref: { locator: 'fixture-locator-d' }, owner_verdict: 'unknown', reference_eligible: false },
  { entry_id: 'corpus:placeholder-e', source_ref: { locator: 'SYNTHETIC PLACEHOLDER x' }, owner_verdict: 'accepted', reference_eligible: true },
];
const approvals = { approvals: [
  { entry_id: 'corpus:synthetic-a', voice_family: 'personal' }, { entry_id: 'corpus:synthetic-b', voice_family: 'business' },
  { entry_id: 'corpus:synthetic-c', voice_family: 'personal' }, { entry_id: 'corpus:placeholder-e', voice_family: 'personal' }, { entry_id: 'corpus:missing', voice_family: 'personal' } ] };

console.log('R4 approved examples');
test('selection only from approved, non-placeholder, correct voice family', () => {
  const r = rcpt('instagram', 'personal-instagram', ['visual/social-card']);
  const { candidates, rejected } = loadApprovedCandidates(r, { repoRoot: REPO_ROOT, approvals, corpus });
  eq(candidates.map((c) => c.entry_id), ['corpus:synthetic-a']);
  eq(rejected.map((x) => x.reason).sort(), ['corpus entry not found', 'owner_verdict=needs_rework', 'synthetic placeholder', 'other voice family'].sort());
  const s = exampleStep(r, manifest, { reason: 'ambiguity', repoRoot: REPO_ROOT, approvals, corpus });
  eq(s.loaded, [{ entry_id: 'corpus:synthetic-a', locator: 'fixture-locator-a' }]); eq(s.status, 'FEWER_THAN_MIN_APPROVED');
  yes(!JSON.stringify(s).includes('dimensions'), 'no corpus body copied');
});
test('default request loads no examples; unknown reason loads none', () => {
  const r = rcpt('instagram', 'personal-instagram', ['visual/social-card']);
  eq(exampleStep(r, manifest, { repoRoot: REPO_ROOT, approvals, corpus }).status, 'STYLE_DESCRIPTION_ONLY');
  eq(exampleStep(r, manifest, { reason: 'curiosity', repoRoot: REPO_ROOT, approvals, corpus }).status, 'NOT_LOADED');
});
test('absent approvals for a target => NO_APPROVED_REFERENCE (real repo index has none)', () => {
  for (const [surface, t] of [['instagram', 'trends-moa'], ['instagram', 'signalytics-news'], ['linkedin', 'personal-linkedin'], ['instagram', 'personal-instagram']]) {
    const r = rcpt(surface, t, ['text/article']);
    const s = exampleStep(r, manifest, { reason: 'failure', repoRoot: REPO_ROOT });
    eq(s.status, NO_APPROVED_REFERENCE, t); eq(s.loaded, []);
  }
});
test('real repo corpus (all synthetic placeholders) can never yield an approved example', () => {
  const idx = JSON.parse(readFileSync(resolve(REPO_ROOT, 'editorial/approved-examples.json'), 'utf8'));
  eq(idx.approvals, []);
});

console.log('R4 feedback scoping');
test('implicit feedback is task-local; recurrence in distinct tasks makes a scoped CANDIDATE, never applied', () => {
  const st = new FeedbackStore(tmp());
  const a = recordImplicitFeedback(st, { task_id: 't1', target: 'trends-moa', format: 'visual/social-card', kind: 'too-formal' });
  eq(a.candidate, null); eq(a.record.applies_to, 'this_task_only');
  eq(scopedGuidance(st, { target: 'trends-moa', format: 'visual/social-card' }).preference, null);
  recordImplicitFeedback(st, { task_id: 't1', target: 'trends-moa', format: 'visual/social-card', kind: 'too-formal' }); // same task again
  eq(scopedGuidance(st, { target: 'trends-moa', format: 'visual/social-card' }).candidates, []);
  const b = recordImplicitFeedback(st, { task_id: 't2', target: 'trends-moa', format: 'visual/social-card', kind: 'too-formal' });
  eq(b.candidate.status, 'CANDIDATE'); eq(b.candidate.applied, false);
  const g = scopedGuidance(st, { target: 'trends-moa', format: 'visual/social-card' });
  eq(g.preference, null, 'candidate must not become a preference'); eq(g.candidates.length, 1);
});
test('explicit "앞으로" creates versioned preference for that scope only; rollback restores', () => {
  const st = new FeedbackStore(tmp());
  throwsCode(() => applyExplicitPreference(st, { target: 'personal-linkedin', format: 'text/article', instruction: 'x', statement: '이건 별로네' }), 'NOT_EXPLICIT');
  const v1 = applyExplicitPreference(st, { target: 'personal-linkedin', format: 'text/article', instruction: '문단을 짧게', statement: '앞으로 문단을 짧게 써줘' });
  const v2 = applyExplicitPreference(st, { target: 'personal-linkedin', format: 'text/article', instruction: '문단 3문장 이내', statement: '앞으로 3문장 이내로' });
  eq([v1.version, v2.version], [1, 2]);
  eq(scopedGuidance(st, { target: 'personal-linkedin', format: 'text/article' }).preference.version, 2);
  eq(rollbackPreference(st, { target: 'personal-linkedin', format: 'text/article' }).active_version, 1);
  eq(scopedGuidance(st, { target: 'personal-linkedin', format: 'text/article' }).preference.instruction, '문단을 짧게');
  eq(scopedGuidance(st, { target: 'personal-linkedin', format: 'visual/social-card' }).preference, null, 'other format unaffected');
});
test('no cross-account effect, and brief shows only the requesting scope', () => {
  const root = tmp(); const st = new FeedbackStore(root);
  applyExplicitPreference(st, { target: 'personal-instagram', format: 'visual/social-card', instruction: 'A-only', statement: '앞으로 A만' });
  recordImplicitFeedback(st, { task_id: 'x1', target: 'personal-instagram', format: 'visual/social-card', kind: 'k' });
  recordImplicitFeedback(st, { task_id: 'x2', target: 'personal-instagram', format: 'visual/social-card', kind: 'k' });
  for (const t of ['trends-moa', 'signalytics-news']) { const g = scopedGuidance(st, { target: t, format: 'visual/social-card' }); eq([g.preference, g.candidates], [null, []], t); }
  throwsCode(() => scopedGuidance(st, { target: 'trends-moa' }), 'SCOPE_REQUIRED');
  const mk = (target) => runLibraryIntake({ intent: fullIntent('instagram', ['visual/social-card']), target, feedbackRoot: root, format: 'visual/social-card', taskKind: 'visual', reader: rd() });
  eq(mk('personal-instagram').brief.quality.guidance.preference.instruction, 'A-only');
  eq(mk('trends-moa').brief.quality.guidance.preference, null);
});
test('shared voice profile hash unchanged by any feedback (profile not an input to the store)', () => {
  const root = tmp(); const st = new FeedbackStore(root);
  const before = runLibraryIntake({ intent: fullIntent('instagram', ['visual/social-card']), target: 'trends-moa', taskKind: 'visual', reader: rd() }).receipt.profile.resolved_hash;
  applyExplicitPreference(st, { target: 'trends-moa', format: 'visual/social-card', instruction: 'i', statement: '앞으로 i' });
  recordImplicitFeedback(st, { task_id: 'a', target: 'trends-moa', format: 'visual/social-card', kind: 'k' });
  recordImplicitFeedback(st, { task_id: 'b', target: 'trends-moa', format: 'visual/social-card', kind: 'k' });
  const out = runLibraryIntake({ intent: fullIntent('instagram', ['visual/social-card']), target: 'trends-moa', feedbackRoot: root, format: 'visual/social-card', taskKind: 'visual', reader: rd() });
  eq(out.receipt.profile.resolved_hash, before); eq(out.brief.profile.resolved_hash, before);
  eq(out.brief.quality.guidance.shared_profile_modified, false);
});
test('light outcome record: only adoption / repeated errors / revision count; unobserved = UNKNOWN; no analytics', () => {
  const st = new FeedbackStore(tmp());
  const { record } = recordOutcome(st, { task_id: 'o1', target: 'trends-moa', format: 'text/article' });
  eq([record.first_result_adopted, record.revision_count, record.repeated_errors], ['UNKNOWN', 'UNKNOWN', []]);
  const r2 = recordOutcome(st, { task_id: 'o2', target: 'trends-moa', format: 'text/article', first_result_adopted: false, repeated_errors: ['a', 'a', 'b'], revision_count: 2 }).record;
  eq(Object.keys(r2).sort(), ['first_result_adopted', 'format', 'profile_hash', 'repeated_errors', 'revision_count', 'schema', 'scope', 'target', 'task_id']);
  eq(r2.repeated_errors, ['a', 'b']);
  throwsCode(() => recordOutcome(st, { task_id: 'o3', target: 't', format: 'f', revision_count: -1 }), 'BAD_FIELD');
  throwsCode(() => recordOutcome(st, { task_id: 'o3', target: 't', format: 'f', first_result_adopted: 'maybe' }), 'BAD_FIELD');
  yes(!/views|ctr|engagement|score/i.test(JSON.stringify(r2)), 'no KPI fields');
});
test('normal path: library-intake brief carries example status + guidance (real CLI)', () => {
  const dir = tmp(); const ip = resolve(dir, 'i.json');
  require_write(ip, fullIntent('instagram', ['visual/social-card']));
  const r = spawnSync('node', [resolve(HERE, 'library-intake.mjs'), '--intent', ip, '--target', 'trends-moa', '--task-kind', 'visual', '--feedback-root', resolve(dir, 'fb'), '--format', 'visual/social-card', '--example-reason', 'quality_comparison', '--out-dir', resolve(dir, 'o')], { encoding: 'utf8' });
  eq(r.status, 0, r.stderr);
  const b = JSON.parse(readFileSync(resolve(dir, 'o/brief.json'), 'utf8'));
  eq(b.quality.examples.status, NO_APPROVED_REFERENCE); eq(b.quality.analytics_collected, false);
});
test('CLI quality-feedback records under a given root and rejects non-explicit "explicit"', () => {
  const root = tmp(); const run = (...a) => spawnSync('node', [resolve(HERE, 'quality-feedback.mjs'), '--root', root, ...a], { encoding: 'utf8' });
  eq(run('outcome', '--task', 'c1', '--target', 'trends-moa', '--format', 'f', '--adopted', 'yes', '--revisions', '1').status, 0);
  eq(run('explicit', '--target', 'trends-moa', '--format', 'f', '--instruction', 'i', '--statement', '그냥 수정').status, 1);
  yes(readdirSync(resolve(root, 'outcomes')).length === 1, 'outcome written');
});

console.log('R5 existing flows through the common entry');
const SNS_DOCS = Object.values(manifest.voice_docs).flat();
const flows = { blog: ['suengj-com', ['text/article']], news: ['newsletter', ['text/brief']], report: ['report-deck', ['text/brief']] };
for (const [flow, [surface, arts]] of Object.entries(flows)) {
  test(`${flow}: READY via common entry, flow profile, no SNS voice doc loaded, no suengj-style`, () => {
    const r = resolveEditorial(intent(surface, arts), { flowId: flow, reader: rd() });
    eq(r.status, STATUS.READY); eq(r.profile.id, `flow:${flow}`); eq(r.profile.body.voice_family, null);
    for (const l of r.loads) yes(!SNS_DOCS.includes(l.path), `leaked ${l.path}`);
    yes(r.profile.body.fields.style_overlay === undefined, 'no style overlay');
    yes(!JSON.stringify(r.profile.body.rule_files).includes('SUENGJ-STYLE'), 'no personal style');
  });
}
test('flow guards: surface mismatch, unknown flow, flow+target are blocked; a leaked overlay is BLOCKED_LEAK', () => {
  eq(resolveEditorial(intent('instagram'), { flowId: 'blog', reader: rd() }).conflicts[0].code, 'FLOW_SURFACE_MISMATCH');
  eq(resolveEditorial(intent('suengj-com'), { flowId: 'podcast', reader: rd() }).conflicts[0].code, 'UNKNOWN_FLOW');
  eq(resolveEditorial(intent('suengj-com'), { flowId: 'blog', targetId: 'trends-moa', reader: rd() }).conflicts[0].code, 'FLOW_AND_TARGET');
  const r = resolveEditorial(intent('suengj-com'), { flowId: 'blog', overrides: { account_series: { style_overlay: 'suengj-style' } }, reader: rd() });
  eq(r.status, STATUS.BLOCKED_LEAK);
});
test('SNS voices do not leak into flows and flow rules do not enter SNS targets (all targets)', () => {
  for (const [id, t] of Object.entries(manifest.sns_targets)) {
    const r = resolveEditorial(intent(t.surface, ['text/article']), { targetId: id, reader: rd() });
    const others = Object.entries(manifest.voice_docs).filter(([f]) => f !== t.voice_family).flatMap(([, d]) => d);
    for (const l of r.loads) yes(!others.includes(l.path), `${id} loaded ${l.path}`);
  }
});
test('legacy compatibility: no-flow resolve on non-SNS surfaces is unchanged (READY, no target, no flow marker)', () => {
  for (const s of ['suengj-com', 'newsletter', 'report-deck', 'academic-paper']) {
    const r = resolveEditorial(intent(s), { reader: rd() });
    eq(r.status, STATUS.READY, s); eq(r.target, null); yes(!('flow' in r), 'no flow marker'); eq(r.profile.id, `surface:${s}`);
  }
});
test('render gate: legacy non-SNS render stays ungated; a flow receipt is verified when supplied', () => {
  const plan = (surface) => ({ profiles: { surface, artifact: 'visual/evidence-visual' } });
  eq(gateRender(plan('suengj-com'), null, manifest, GCTX).applies, false);
  const r = resolveEditorial(intent('suengj-com', ['visual/evidence-visual']), { flowId: 'blog', taskKind: 'visual', reader: rd() });
  eq(gateRender(plan('suengj-com'), r, manifest, GCTX).ok, true);
  eq(gateRender(plan('report-deck'), r, manifest, GCTX).code, 'PROFILE_TARGET_MISMATCH');
  const t = JSON.parse(JSON.stringify(r)); t.profile.body.fields.x = 1;
  eq(gateRender(plan('suengj-com'), t, manifest, GCTX).code, 'PROFILE_RECEIPT_HASH_MISMATCH');
});
test('flow stage stamps are verifiable like SNS ones', () => {
  const r = resolveEditorial(intent('report-deck', ['text/brief']), { flowId: 'report', reader: rd() });
  eq(verifyStages(r, { generate: stageStamp(r, 'generate'), polish: stageStamp(r, 'polish'), review: stageStamp(r, 'review') }), []);
});
test('library-intake accepts --flow on the real path', () => {
  const out = runLibraryIntake({ intent: fullIntent('suengj-com'), flow: 'blog', noLibrary: true, reader: rd() });
  eq(out.receipt.flow.id, 'blog'); eq(out.brief.status, 'READY');
});
test('Signalytics package contract unchanged (5 PNG + caption + benchmark brief; sixth conditional; no Drive writes)', () => {
  const c = manifest.sns_targets['signalytics-news'].output_contract;
  eq([c.png.min, c.png.max, c.drive_result_writes, c.publication, c.required_files], [5, 6, false, false, ['caption.md', 'benchmark-brief.md']]);
});

function require_write(p, o) { spawnSync('node', ['-e', `require('fs').writeFileSync(process.argv[1], process.argv[2])`, p, JSON.stringify(o)]); }
console.log(`\nquality-feedback: ${pass} passed, ${fail} failed (CI: NOT_RUN_BY_OWNER_REQUEST)`);
process.exitCode = fail ? 1 : 0;
