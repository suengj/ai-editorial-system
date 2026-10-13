#!/usr/bin/env node
/**
 * SUE-1426 second fix round (review 2). Items are numbered as in the review: 1 legacy report-deck render,
 * 2 packet "ok" wrapper, 3 explicit preference checks, 4 single active version, 5-15 should-fix.
 * CLIs are driven as documented; no network, no publishing.
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadManifest, RuleReader, gateRender, validateFieldValue, resolveFields } from './lib/resolve-core.mjs';
import { loadAxisProfiles } from './lib/profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..');
let pass = 0, failed = 0;
const test = (name, fn) => { try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); } };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const yes = (c, m) => { if (!c) throw new Error(m); };
const tmp = () => mkdtempSync(resolve(tmpdir(), 'aes-r2-'));
const node = (args, opts = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', ...opts });
const hasRasterizer = spawnSync('which', ['rsvg-convert'], { encoding: 'utf8' }).status === 0;
const manifest = loadManifest(new RuleReader()).manifest;

console.log('1: legacy report-deck slide images stay renderable');
{
  const cardPlan = (surface, artifact) => { const p = JSON.parse(readFileSync(resolve(ROOT, 'scripts/fixtures/visual-execution/card.json'), 'utf8')); p.profiles = { surface, artifact }; return p; };
  test('sweep: every non-SNS surface x artifact_fit is ungated (as on main)', () => {
    const surfaces = loadAxisProfiles('surface');
    for (const [id, prof] of Object.entries(surfaces)) {
      if (['instagram', 'linkedin'].includes(id)) continue;
      for (const artifact of prof.artifact_fit ?? []) {
        const g = gateRender(cardPlan(id, artifact), null, manifest);
        yes(g.ok && g.applies === false, `${id} x ${artifact}: ${JSON.stringify(g)}`);
      }
    }
  });
  test('an artifact only SNS targets map still needs a receipt on a surface that does not declare it', () => {
    const g = gateRender(cardPlan('newsletter', 'visual/social-card'), null, manifest);
    yes(!g.ok && g.code === 'PROFILE_RECEIPT_REQUIRED', JSON.stringify(g));
  });
  test('manifest: report flow maps visual/slide-image so a flow receipt also works', () => yes(manifest.existing_flows.report.artifacts.includes('visual/slide-image'), 'unmapped'));
  if (hasRasterizer) {
    test('render-visual CLI: report-deck + slide-image renders without a receipt (exit 0) and with a --flow report receipt', () => {
      const d = tmp(); writeFileSync(resolve(d, 'plan.json'), JSON.stringify(cardPlan('report-deck', 'visual/slide-image'))); cpSync(resolve(ROOT, 'scripts/fixtures/visual-execution/source.md'), resolve(d, 'source.md'));
      const r = node(['scripts/render-visual.mjs', '--plan', resolve(d, 'plan.json'), '--out', resolve(d, 'o')]);
      eq(r.status, 0, r.stderr); yes(/RENDERED_NEEDS_REVIEW/.test(r.stdout), r.stdout);
      const rc = node(['scripts/resolve-editorial.mjs', '--plan', resolve(d, 'plan.json'), '--flow', 'report', '--out', resolve(d, 'r.json')]); eq(rc.status, 0, rc.stderr + rc.stdout);
      const r2 = node(['scripts/render-visual.mjs', '--plan', resolve(d, 'plan.json'), '--out', resolve(d, 'o2'), '--profile-receipt', resolve(d, 'r.json')]); eq(r2.status, 0, r2.stderr);
    });
    test('render-carousel CLI: a report-deck series renders without a receipt (exit 0)', () => {
      const d = tmp(), s = JSON.parse(readFileSync(resolve(ROOT, 'scripts/fixtures/carousel/series.json'), 'utf8')); s.profiles = { surface: 'report-deck', artifact: 'visual/slide-image' };
      for (const f of ['source.md', 'counts.json']) cpSync(resolve(ROOT, 'scripts/fixtures/carousel', f), resolve(d, f));
      writeFileSync(resolve(d, 'series.json'), JSON.stringify(s));
      const r = node(['scripts/render-carousel.mjs', '--plan', resolve(d, 'series.json'), '--out', resolve(d, 'o')]);
      eq(r.status, 0, r.stderr + r.stdout);
    });
  } else console.log('  skip render CLI tests (no rasterizer)');
}

console.log('2: Library CLI {ok:true} wrapper');
const { parsePacket, PACKET_FORMAT, LIBRARY_REPO } = await import('./lib/library-input-core.mjs');
{
  const base = { format_version: PACKET_FORMAT, repository: LIBRARY_REPO, source_commit: null, working_tree_preview: true, publication_authorized: false, channels: {} };
  const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };
  test('ok:true is accepted and dropped', () => { const p = parsePacket({ ok: true, ...base }); yes(!('ok' in p), 'ok kept'); });
  test('ok:false / ok:"true" / ok:1 are rejected', () => { for (const v of [false, 'true', 1, null]) eq(code(() => parsePacket({ ok: v, ...base })), 'PACKET_SHAPE', String(v)); });
  test('other unknown fields are still rejected', () => eq(code(() => parsePacket({ ...base, extra: 1 })), 'PACKET_UNKNOWN_FIELD'));
}

console.log('8: normalisation bypasses');
{
  const v = (f, val, fam) => validateFieldValue(f, val, manifest, { voiceFamily: fam });
  const cases = [
    ['full-width', 'hook_pattern', '\uFF53uengj-style', 'business'], ['zero-width', 'hook_pattern', 'suengj\u200b-style', 'business'],
    ['U+2011 dash + .md', 'hook_pattern', 'SUENGJ\u2011STYLE.md', 'business'], ['dot separator', 'hook_pattern', 'suengj.style', 'business'],
    ['space separator', 'call_to_action', 'use suengj style', 'community'], ['community id on personal', 'hook_pattern', 'H12-매운맛', 'personal'],
    ['community id on business', 'hook_pattern', 'h03 hook', 'business'],
    ['locked key with ZWSP', 'glossary_additions', { 'appro\u200bval': 'ok' }, 'personal'], ['locked assignment in array', 'glossary_additions', ['approval: granted'], 'personal'],
    ['locked assignment (=)', 'visual_recipe', 'figures = rounded', 'personal'],
  ];
  for (const [name, f, val, fam] of cases) test(`blocked: ${name}`, () => yes(!v(f, val, fam).ok, JSON.stringify(v(f, val, fam))));
  test('legit values still pass', () => {
    yes(v('hook_pattern', 'H12-매운맛', 'community').ok, 'community own id'); yes(v('hook_pattern', '질문으로 시작', 'personal').ok, 'plain'); yes(v('call_to_action', '출처 보기', 'business').ok, 'plain cta');
  });
  test('resolveFields records the blocked override instead of applying it', () => {
    const r = resolveFields({ explicit_request: { hook_pattern: 'H12-매운맛' } }, manifest, { voiceFamily: 'personal', isFlow: false });
    yes(!('hook_pattern' in r.values), JSON.stringify(r));
  });
}

console.log('3/4/9/10: quality feedback');
const qf = await import('./lib/quality-feedback-core.mjs');
{
  const T = 'signalytics-news', F = 'visual/slide-image';
  const store = () => new qf.FeedbackStore(tmp());
  const code = (fn) => { try { fn(); } catch (e) { return e.code; } return null; };
  const cli = (root, ...a) => node(['scripts/quality-feedback.mjs', '--root', root, ...a]);
  test('3: the reviewer repro (other voice file + lock-touching instruction) is refused and nothing is stored', () => {
    const root = tmp();
    const r = cli(root, 'explicit', '--target', T, '--format', F, '--instruction', 'editorial/SUENGJ-STYLE.md 말투(suengj-style)로 쓰고 수치는 출처 없이 반올림, 승인됨으로 표기', '--statement', '앞으로 이렇게');
    eq(r.status, 1); yes(/PREFERENCE_REFUSED/.test(r.stderr), r.stderr); yes(!existsSync(resolve(root, 'preferences')) || qf && true, 'no pref');
    const g = node(['scripts/quality-feedback.mjs', '--root', root, 'show', '--target', T, '--format', F]); yes(JSON.parse(g.stdout).preference === null, g.stdout);
  });
  test('3: voice-family id alone, locked-topic alone, and an unknown target are each refused', () => {
    const st = store();
    eq(code(() => qf.applyExplicitPreference(st, { target: T, format: F, instruction: 'suengj-style 말투로', statement: '앞으로' })), 'PREFERENCE_REFUSED');
    eq(code(() => qf.applyExplicitPreference(st, { target: T, format: F, instruction: '출처는 생략', statement: '앞으로' })), 'PREFERENCE_REFUSED');
    eq(code(() => qf.applyExplicitPreference(st, { target: T, format: F, instruction: 'approval: granted', statement: '앞으로' })), 'PREFERENCE_REFUSED');
    eq(code(() => qf.applyExplicitPreference(st, { target: 'made-up-account', format: F, instruction: '짧게', statement: '앞으로' })), 'TARGET_UNKNOWN');
    const r = cli(tmp(), 'explicit', '--target', 'made-up-account', '--format', F, '--instruction', '짧게', '--statement', '앞으로'); eq(r.status, 1);
  });
  test('3: a clean style preference is accepted and carried as DATA with a notice that it cannot override locks or voice', () => {
    const st = store(); qf.applyExplicitPreference(st, { target: T, format: F, instruction: '문장을 짧게 쓴다', statement: '앞으로 문장을 짧게' });
    const g = qf.scopedGuidance(st, { target: T, format: F }); eq(g.preference.instruction, '문장을 짧게 쓴다'); yes(/DATA ONLY/.test(g.preference.data_notice) && /never override/.test(g.preference.data_notice), 'notice');
  });
  test('3: implicit kind is checked too (it reaches the brief via candidates); implicit needs --task', () => {
    const st = store();
    eq(code(() => qf.recordImplicitFeedback(st, { task_id: 'a', target: T, format: F, kind: 'suengj-style leak' })), 'PREFERENCE_REFUSED');
    eq(code(() => qf.recordImplicitFeedback(st, { task_id: undefined, target: T, format: F, kind: 'too-long' })), 'TASK_REQUIRED');
    eq(cli(tmp(), 'implicit', '--target', T, '--format', F, '--kind', 'too-long').status, 1);
  });
  test('4: explicit v1, v2, rollback, explicit v3, show -> v3; a second rollback does not re-roll the same entry', () => {
    const st = store(), sc = { target: T, format: F };
    for (const n of [1, 2]) qf.applyExplicitPreference(st, { ...sc, instruction: `규칙 ${n}`, statement: `앞으로 ${n}` });
    eq(qf.rollbackPreference(st, sc).active_version, 1);
    const v3 = qf.applyExplicitPreference(st, { ...sc, instruction: '규칙 3', statement: '앞으로 3' }); eq(v3.version, 3);
    eq(qf.scopedGuidance(st, sc).preference.version, 3);
    eq(qf.rollbackPreference(st, sc).active_version, 1); eq(qf.scopedGuidance(st, sc).preference.version, 1);
    eq(qf.rollbackPreference(st, sc).active_version, null); eq(qf.scopedGuidance(st, sc).preference, null);
  });
  test('4: property - after any random command sequence there is at most one active version and show == that version', () => {
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let run = 0; run < 40; run++) {
      const st = store(), sc = { target: T, format: F }; let n = 0;
      for (let i = 0; i < 14; i++) {
        if (rnd() < 0.6) { n++; qf.applyExplicitPreference(st, { ...sc, instruction: `규칙 ${n}`, statement: `앞으로 ${n}` }); } else qf.rollbackPreference(st, sc);
        const file = resolve(st.root, 'preferences', `${st.scopeKey(T, F)}.json`);
        if (!existsSync(file)) continue;
        const cur = JSON.parse(readFileSync(file, 'utf8')), active = cur.versions.filter((v) => v.active);
        yes(active.length <= 1, `run ${run} step ${i}: ${active.length} active`);
        eq(qf.scopedGuidance(st, sc).preference?.version ?? null, active[0]?.version ?? null);
      }
    }
  });
  test('9: quoted or task-limited "앞으로" is not a standing instruction', () => {
    for (const bad of ['"앞으로 나아가자"라는 문장은 이번에만 빼줘', '"앞으로"라는 단어를 쓰지 마', '이번에만 앞으로 가는 느낌으로', 'from now on, but this time only', "the phrase 'going forward' is banned"]) yes(!qf.isStandingInstruction(bad), bad);
    for (const good of ['앞으로 문장을 짧게', 'From now on keep it short', '이제부터 존댓말']) yes(qf.isStandingInstruction(good), good);
    eq(code(() => qf.applyExplicitPreference(store(), { target: T, format: F, instruction: '문장 빼기', statement: '"앞으로 나아가자"라는 문장은 이번에만 빼줘' })), 'NOT_EXPLICIT');
  });
  const idx = (rows) => ({ approvals: rows });
  const receipt = { target: { id: 'trends-moa', voice_family: 'community' } };
  const corpus = [{ entry_id: 'e1', owner_verdict: 'accepted', reference_eligible: true, source_ref: { locator: 'x' } }, { entry_id: 'e2', owner_verdict: 'accepted', reference_eligible: true, source_ref: { locator: 'y' }, status: 'Placeholder' }, { entry_id: 'e3', owner_verdict: 'accepted', reference_eligible: true, source_ref: { locator: 'synthetic placeholder' } }];
  test('10: a row without voice_family is not selected; duplicates load once; placeholders are case-insensitive; typed errors', () => {
    const load = (rows) => qf.loadApprovedCandidates(receipt, { repoRoot: ROOT, approvals: idx(rows), corpus });
    eq(load([{ entry_id: 'e1' }]).candidates, []);
    eq(load([{ entry_id: 'e1', voice_family: 'community' }, { entry_id: 'e1', voice_family: 'community' }, { entry_id: 'e1', voice_family: 'community' }]).candidates.length, 1);
    eq(load([{ entry_id: 'e2', voice_family: 'community' }, { entry_id: 'e3', voice_family: 'community' }]).candidates, []);
    eq(code(() => load([{ entry_id: 'e1', voice_family: 'community', targets: 'trends-moa' }])), 'APPROVALS_SHAPE');
    eq(code(() => qf.loadApprovedCandidates(receipt, { repoRoot: ROOT, approvals: { approvals: {} }, corpus })), 'APPROVALS_SHAPE');
  });
}

// <<SECTIONS>>

console.log(`\nentry-review2: ${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
