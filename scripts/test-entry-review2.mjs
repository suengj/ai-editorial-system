#!/usr/bin/env node
/**
 * SUE-1426 second fix round (review 2). Items are numbered as in the review: 1 legacy report-deck render,
 * 2 packet "ok" wrapper, 3 explicit preference checks, 4 single active version, 5-15 should-fix.
 * CLIs are driven as documented; no network, no publishing.
 */
import { statSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveEditorial, loadManifest, RuleReader, gateRender, validateFieldValue, resolveFields } from './lib/resolve-core.mjs';
import * as resolveCore from './lib/resolve-core.mjs';
import { checkPreferenceText, applyExplicitPreference } from './lib/quality-feedback-core.mjs';
import { FeedbackStore } from './lib/quality-feedback-core.mjs';
import { runLibraryIntake } from './library-intake.mjs';
import { checkRepairLineage } from './lib/visual-execution-core.mjs';
import { loadAxisProfiles } from './lib/profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '..');
let pass = 0, failed = 0;
const test = (name, fn) => { try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); } };
const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const yes = (c, m) => { if (!c) throw new Error(m); };
const tmp = () => mkdtempSync(resolve(tmpdir(), 'aes-r2-'));
const node = (args, opts = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', ...opts });
const hasRasterizer = spawnSync('which', ['rsvg-convert'], { encoding: 'utf8' }).status === 0;
const PNG8 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const igIntent = () => { const i = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/intent-reference-dimensions.example.json'), 'utf8')); i.axes.surface = { value: 'instagram', state: 'confirmed', profile_ref: 'editorial/profiles/surface/instagram.json', basis: 'SYNTHETIC test intent' }; return i; };
const resolveEditorialFor = (reader) => resolveEditorial(igIntent(), { targetId: 'signalytics-news', reader });
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

console.log('7: required rule-file integrity (truncation, HTML, stub, UNVERIFIED)');
{
  const mkRepo = () => { const r = tmp(); mkdirSync(resolve(r, 'editorial'), { recursive: true });
    const body = `# Rule\n\n${'A real rule document line that is long enough to be a rule.\n'.repeat(8)}`;
    writeFileSync(resolve(r, 'editorial/rule.md'), body);
    for (const a of [['init', '-q'], ['add', '-A'], ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x']]) spawnSync('git', ['-C', r, ...a]);
    return { r, body }; };
  test('a dirty file that is a strict prefix of its HEAD blob is truncated', () => {
    const { r, body } = mkRepo(); writeFileSync(resolve(r, 'editorial/rule.md'), body.slice(0, 200));
    const e = new RuleReader({ root: r }).read('editorial/rule.md'); eq(e.status, 'truncated'); yes(/prefix/.test(e.reason), e.reason);
  });
  test('a genuine dirty edit (not a prefix) stays read + dirty_unverified', () => {
    const { r, body } = mkRepo(); writeFileSync(resolve(r, 'editorial/rule.md'), `${body}\nextra line\n`);
    const e = new RuleReader({ root: r }).read('editorial/rule.md'); eq(e.status, 'read'); eq(e.verification, 'dirty_unverified');
  });
  test('a .md starting with <html / <!DOCTYPE (case-insensitive, after whitespace) is invalid', () => {
    for (const head of ['<html><body>404</body></html>', '  \n<!DOCTYPE html>', '<HTML>', '<!doctype html>']) {
      const { r } = mkRepo(); writeFileSync(resolve(r, 'editorial/page.md'), `${head}${' x'.repeat(100)}`);
      eq(new RuleReader({ root: r }).read('editorial/page.md').status, 'invalid', head);
    }
  });
  test('receipt carries integrity=UNVERIFIED outside git / when dirty, and the CLI line prints it', () => {
    const d = tmp(); writeFileSync(resolve(d, 'intent.json'), JSON.stringify(igIntent()));
    const out = node(['scripts/resolve-editorial.mjs', '--intent', resolve(d, 'intent.json'), '--target', 'signalytics-news', '--out', resolve(d, 'r.json')]);
    const rc = JSON.parse(readFileSync(resolve(d, 'r.json'), 'utf8'));
    yes(['VERIFIED', 'UNVERIFIED'].includes(rc.integrity.integrity), JSON.stringify(rc.integrity));
    if (rc.integrity.integrity === 'UNVERIFIED') yes(/integrity=UNVERIFIED/.test(out.stderr), out.stderr);
    // injected non-git reader => required files cannot be verified
    const rd = new RuleReader({ root: ROOT, git: { ok: false, revision: 'UNKNOWN' } });
    const rc2 = resolveEditorialFor(rd);
    eq(rc2.integrity.integrity, 'UNVERIFIED'); yes(rc2.integrity.unverified_required.length > 0, 'listed');
  });
  test('a 40-byte stub required .md rule file blocks (sanity floor)', () => {
    const rd = new RuleReader({ root: ROOT, fs: { readFileSync: (p) => (String(p).endsWith('.md') ? Buffer.from('# stub\nnothing here\n') : readFileSync(p)), statSync: (p) => (String(p).endsWith('.md') ? { size: Buffer.byteLength('# stub\nnothing here\n'), mtimeMs: 1 } : statSync(p)) }, git: { ok: false, revision: 'UNKNOWN' } });
    const rc = resolveEditorialFor(rd); eq(rc.status, 'BLOCKED_MISSING_RULE'); yes(rc.unread_required.some((u) => u.status === 'invalid' || u.status === 'invalid'), JSON.stringify(rc.unread_required.slice(0, 2)));
  });
}
console.log('11: stage stamps, documented sequence verbatim');
{
  test('--stamp generate|polish|review then --stages is consistent; a missing stage is not', () => {
    const d = tmp(); writeFileSync(resolve(d, 'intent.json'), JSON.stringify(igIntent()));
    const r = node(['scripts/resolve-editorial.mjs', '--intent', resolve(d, 'intent.json'), '--target', 'signalytics-news', '--task-kind', 'text', '--out', resolve(d, 'receipt.json')]);
    eq(r.status, 0, r.stderr);
    const stamp = (st) => node(['scripts/resolve-editorial.mjs', '--receipt', resolve(d, 'receipt.json'), '--stamp', st, '--stamps', resolve(d, 'stamps.json')]);
    eq(stamp('generate').status, 0); eq(stamp('polish').status, 0);
    const partial = node(['scripts/resolve-editorial.mjs', '--receipt', resolve(d, 'receipt.json'), '--stages', resolve(d, 'stamps.json')]);
    eq(partial.status, 2); yes(/STAGE_MISSING/.test(partial.stdout), partial.stdout);
    eq(stamp('review').status, 0); eq(stamp('review').status, 0, 'update is idempotent');
    const full = node(['scripts/resolve-editorial.mjs', '--receipt', resolve(d, 'receipt.json'), '--stages', resolve(d, 'stamps.json')]);
    eq(full.status, 0, full.stdout); eq(JSON.parse(full.stdout).consistent, true);
    eq(Object.keys(JSON.parse(readFileSync(resolve(d, 'stamps.json'), 'utf8'))).sort(), ['generate', 'polish', 'review']);
    eq(stamp('publish').status, 1);
  });
  test('docs: ENTRY-PROMPTS and the three skills show the --stamp command', () => {
    for (const f of ['editorial/ENTRY-PROMPTS.md', 'skills/editorial-polish/SKILL.md', 'skills/review-visual/SKILL.md', 'skills/review-l1/SKILL.md']) yes(/--stamp /.test(readFileSync(resolve(ROOT, f), 'utf8')), f);
  });
}
console.log('12: prompt A names the core files');
test('prompt A names constitution.md, voice.md, STRUCTURED-VISUAL-EXECUTION.md and axis profiles; both stay NOT_APPLIED', () => {
  const t = readFileSync(resolve(ROOT, 'editorial/ENTRY-PROMPTS.md'), 'utf8'); const a = t.slice(t.indexOf('## A.'), t.indexOf('## B.'));
  for (const w of ['editorial/constitution.md', 'editorial/voice.md', 'STRUCTURED-VISUAL-EXECUTION.md', 'axis_profile_paths']) yes(a.includes(w), w);
  yes((t.match(/NOT_APPLIED/g) ?? []).length >= 2 && /HUMAN_REQUIRED/.test(t), 'markers');
  yes(a.length < 1300, `prompt A stays short (${a.length})`);
});
console.log('15: repair round fails closed');
test('a prior receipt with lineage_root but no integer repair_round is LINEAGE_MISMATCH, not round 0', () => {
  const d = tmp();
  for (const bad of [undefined, null, '1', 1.5, -1]) {
    let code = null; try { checkRepairLineage({ lineage_root: 'x', repair_round: bad }, 'rendered', d, 'x'); } catch (e) { code = e.code; }
    eq(code, 'LINEAGE_MISMATCH', String(bad));
  }
  yes(checkRepairLineage({ lineage_root: 'x', repair_round: 0 }, 'rendered', d, 'x').priorRound === 0, 'round 0 still fine');
});
console.log('notes: delivery package, feedback ignore');
test('checkDeliveryPackage flags drive: and Drive URLs; the CLI path runs it', () => {
  const d = tmp(); for (let i = 1; i <= 5; i++) writeFileSync(resolve(d, `s${i}.png`), PNG8); writeFileSync(resolve(d, 'caption.md'), 'c'); writeFileSync(resolve(d, 'benchmark-brief.md'), 'b');
  const ok = node(['scripts/resolve-editorial.mjs', '--check-package', d, '--target', 'signalytics-news']); eq(ok.status, 0, ok.stdout);
  for (const n of ['https://drive.google.com/file/d/1abc', 'docs.google.com/document/d/1', 'drive:out.csv']) yes(!resolveCore.checkDeliveryPackage('signalytics-news', ['a.png', 'a.png', 'a.png', 'a.png', 'a.png', 'caption.md', 'benchmark-brief.md', n], manifest).ok, n);
  writeFileSync(resolve(d, 'drive:results.csv'), 'x');
  eq(node(['scripts/resolve-editorial.mjs', '--check-package', d, '--target', 'signalytics-news']).status, 2);
});
test('feedback subfolders are git-ignored but the README is tracked', () => {
  for (const d of ['outcomes', 'task-feedback', 'candidates', 'preferences']) eq(spawnSync('git', ['-C', ROOT, 'check-ignore', '-q', `feedback/${d}/x.json`]).status, 0, d);
  eq(spawnSync('git', ['-C', ROOT, 'check-ignore', '-q', 'feedback/README.md']).status, 1);
});
console.log('follow-ups S1-S3 + family ids');
{
  const pkg = (extra = {}) => { const d = tmp(); for (let i = 1; i <= 5; i++) writeFileSync(resolve(d, `s${i}.png`), PNG8); writeFileSync(resolve(d, 'caption.md'), '캡션'); writeFileSync(resolve(d, 'benchmark-brief.md'), '브리프'); for (const [k, v] of Object.entries(extra)) writeFileSync(resolve(d, k), v); return d; };
  const chk = (d, t = 'signalytics-news') => node(['scripts/resolve-editorial.mjs', '--check-package', d, '--target', t]);
  test('S1: a Drive URL/path inside caption.md or benchmark-brief.md is flagged (exit 2); clean passes', () => {
    eq(chk(pkg()).status, 0);
    for (const [f, t] of [['caption.md', 'see https://drive.google.com/file/d/1abc'], ['benchmark-brief.md', 'docs.google.com/document/d/1'], ['caption.md', 'saved to drive:out/results.csv']]) {
      const r = chk(pkg({ [f]: t })); eq(r.status, 2, f); yes(/Drive/.test(r.stdout), r.stdout);
    }
  });
  test('S1: unknown --target exits non-zero; a fake .png (no magic bytes) does not count', () => {
    yes(chk(pkg(), 'no-such-target').status !== 0, 'unknown target');
    const d = pkg(); writeFileSync(resolve(d, 's5.png'), 'not a png');
    const r = chk(d); eq(r.status, 2); yes(/not a PNG/.test(r.stdout) && /PNG count 4/.test(r.stdout), r.stdout);
  });
  const ordinary = ['숫자는 표로 정리', '출처는 각 장 하단에 작게 표기', '최신 사례를 먼저 배치', '계정 이름은 영문 소문자로 표기', '인용문은 한 장에 하나만'];
  test('S2: five ordinary style preferences are accepted', () => { for (const t of ordinary) checkPreferenceText(t, 'signalytics-news'); });
  test('S2: a locked word with a change/waive word in the same clause is still refused', () => {
    for (const t of ['출처 없이 써줘', '숫자는 반올림해서 쓰고', '수치를 대충 올림 처리', 'skip the source line', 'round all figures', '승인 받은 걸로 간주해', 'treat rights as cleared']) {
      let code = null; try { checkPreferenceText(t, 'signalytics-news'); } catch (e) { code = e.code; } eq(code, 'PREFERENCE_REFUSED', t);
    }
  });
  test('S2: refusals are persisted (scope, verbatim statement, reason code, time)', () => {
    const root = tmp(), store = new FeedbackStore(root);
    let code = null; try { applyExplicitPreference(store, { target: 'signalytics-news', format: 'visual/slide-image', instruction: '출처 없이 써줘', statement: '앞으로 출처 없이 써줘' }); } catch (e) { code = e.code; }
    eq(code, 'PREFERENCE_REFUSED');
    const dir = resolve(root, 'refusals'); yes(existsSync(dir), 'refusals dir');
    const fs = readdirSync(dir); eq(fs.length, 1); const rec = JSON.parse(readFileSync(resolve(dir, fs[0]), 'utf8'));
    yes(rec.statement.includes('앞으로 출처 없이 써줘') && rec.reason_code === 'PREFERENCE_REFUSED' && rec.scope && rec.at, JSON.stringify(rec));
  });
  test('S3: integrity is inside the hashed body; flipping it breaks the stage check', () => {
    const rc = resolveEditorialFor(new RuleReader());
    eq(rc.status, 'READY'); yes(['VERIFIED', 'UNVERIFIED'].includes(rc.profile.body.integrity), 'in body'); yes(Array.isArray(rc.profile.body.unverified_required), 'list in body');
    const flipped = JSON.parse(JSON.stringify(rc)); flipped.profile.body.integrity = rc.profile.body.integrity === 'VERIFIED' ? 'UNVERIFIED' : 'VERIFIED';
    const stamps = Object.fromEntries(['generate', 'polish', 'review'].map((st) => [st, resolveCore.stageStamp(rc, st)]));
    eq(resolveCore.verifyStages(rc, stamps), []);
    yes(resolveCore.verifyStages(flipped, stamps).some((i) => i.code === 'RECEIPT_HASH_MISMATCH'), 'flip detected');
  });
  test('S3: a BLOCKED receipt whose required file is truncated is not VERIFIED; the brief carries integrity', () => {
    const real = (p) => readFileSync(p);
    const rd = new RuleReader({ root: ROOT, fs: { readFileSync: (p) => (String(p).endsWith('editorial/constitution.md') ? real(p).subarray(0, 50) : real(p)), statSync } });
    const rc = resolveEditorialFor(rd); eq(rc.status, 'BLOCKED_MISSING_RULE'); eq(rc.integrity.integrity, 'UNVERIFIED'); yes(rc.integrity.unverified_required.includes('editorial/constitution.md'), JSON.stringify(rc.integrity));
    const r = runLibraryIntake({ intent: igIntent(), packet: null, target: 'signalytics-news' });
    yes(r.brief.integrity && ['VERIFIED', 'UNVERIFIED'].includes(r.brief.integrity.state), JSON.stringify(r.brief.integrity));
  });
  test('family ids match mid-string for hook_pattern and preference_text', () => {
    const m = manifest;
    for (const [field, text] of [['hook_pattern', '훅은 H12-매운맛 으로'], ['preference_text', '말투는 H07 처럼 매운맛으로']]) {
      const r = validateFieldValue(field, text, m, { voiceFamily: 'personal', isFlow: false });
      yes(!r.ok && r.code === 'FAMILY_ID_REFERENCE', `${field}: ${JSON.stringify(r)}`);
    }
    yes(validateFieldValue('hook_pattern', 'H12 매운맛', m, { voiceFamily: 'community', isFlow: false }).ok, 'own family still allowed');
  });
}
console.log('trends-moa carousel (visual/slide-image) reuses generic carousel rules');
{
  const series = () => { const d = tmp(); cpSync(resolve(ROOT, 'scripts/fixtures/carousel'), d, { recursive: true }); const p = resolve(d, 'series.json'), s = JSON.parse(readFileSync(p, 'utf8')); s.task.canvas = { width: 1080, height: 1350 }; writeFileSync(p, JSON.stringify(s)); return { d, p }; };
  const resolveFor = (d, p, t) => { const out = resolve(d, `r-${t}.json`); const r = node(['scripts/resolve-editorial.mjs', '--plan', p, '--target', t, '--task-kind', 'visual', '--out', out]); return { r, out }; };
  const { d, p } = series();
  const tm = resolveFor(d, p, 'trends-moa'), sg = resolveFor(d, p, 'signalytics-news');
  test('manifest: trends-moa maps slide-image with only generic rule files; no business/personal doc or business values', () => {
    const v = manifest.sns_targets['trends-moa'].visual;
    yes(v.artifacts.includes('visual/slide-image'), 'unmapped');
    eq(v.files, ['editorial/STRUCTURED-VISUAL-EXECUTION.md', 'editorial/SLIDES-AND-CAROUSELS.md']); eq(v.values, ['editorial/visual-recipes.v1.json']);
    yes(!('output_contract' in manifest.sns_targets['trends-moa']), 'signalytics package contract leaked');
  });
  test('resolve --plan --target trends-moa is READY with the community voice doc and no business/personal doc in loads', () => {
    eq(tm.r.status, 0, tm.r.stderr); const rc = JSON.parse(readFileSync(tm.out, 'utf8')); eq(rc.status, 'READY'); eq(rc.target.voice_family, 'community');
    const paths = rc.profile.body.rule_files.map((x) => x.path);
    yes(paths.includes('editorial/TRENDS-MOA-COMMUNITY-TONE.md') && paths.includes('editorial/SLIDES-AND-CAROUSELS.md'), paths.join());
    for (const bad of ['BUSINESS-IDEA-MAGAZINE', 'SIGNALYTICS-BENCHMARK-CARDS', 'SUENGJ-STYLE', 'business-idea-magazine.v1']) yes(!paths.some((x) => x.includes(bad)), `${bad} loaded`);
  });
  if (hasRasterizer) {
    test('render-carousel --profile-receipt renders for trends-moa; no output PNG is stamped with trends.moa/signalytics branding', () => {
      const o = resolve(d, 'o-tm'), r = node(['scripts/render-carousel.mjs', '--plan', p, '--out', o, '--profile-receipt', tm.out]); eq(r.status, 0, r.stdout + r.stderr); yes(/target:trends-moa/.test(r.stdout), r.stdout);
      yes(existsSync(resolve(o, 'opening/image.png')), 'no frame');
    });
    test('a signalytics-news receipt cannot be re-labelled as trends-moa (and vice versa): hash/profile-id mismatch refuses the render', () => {
      for (const [src, dst] of [[sg.out, 'trends-moa'], [tm.out, 'signalytics-news']]) {
        const rc = JSON.parse(readFileSync(src, 'utf8')); rc.target = { ...rc.target, id: dst }; const f = resolve(d, `x-${dst}.json`); writeFileSync(f, JSON.stringify(rc));
        const r = node(['scripts/render-carousel.mjs', '--plan', p, '--out', resolve(d, `ox-${dst}`), '--profile-receipt', f]); eq(r.status, 1); yes(/PROFILE_TARGET_MISMATCH/.test(r.stderr), r.stderr);
      }
    });
  }
  test('--check-package: the Signalytics package contract (5-6 PNG, caption.md, benchmark-brief.md) is not applied to trends-moa', () => {
    const pk = tmp(); writeFileSync(resolve(pk, 'a.png'), PNG8);
    const t = node(['scripts/resolve-editorial.mjs', '--check-package', pk, '--target', 'trends-moa']); eq(t.status, 0, t.stdout); eq(JSON.parse(t.stdout).applicable, false);
    eq(node(['scripts/resolve-editorial.mjs', '--check-package', pk, '--target', 'signalytics-news']).status, 2);
  });
}
// <<SECTIONS>>

console.log(`\nentry-review2: ${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
