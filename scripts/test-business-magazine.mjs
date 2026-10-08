/** On-demand local regression; synthetic facts are not real-company evidence. */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { compileBusinessMagazine, loadBusinessMagazineProfile } from './lib/business-magazine-core.mjs';
import { planCarousel } from './lib/carousel-core.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profile = loadBusinessMagazineProfile(), day = '2026-10-08';
const evidence = { schema_version: '1.0.0', as_of: day,
  sources: [{ id: 's1', url: 'https://example.com/a', title: 'Synthetic source A', kind: 'official', published_at: null, checked_at: day }, { id: 's2', url: 'https://example.com/b', title: 'Synthetic source B', kind: 'official', published_at: day, checked_at: day }],
  claims: [{ id: 'a', kind: 'fact', text: 'Synthetic A offers a service.', source_ids: ['s1'] }, { id: 'b', kind: 'fact', text: 'Synthetic B offers an adjacent service.', source_ids: ['s2'] }, { id: 'h', kind: 'assumption', text: 'A small paid experiment is proposed.', source_ids: [] }],
  cases: [{ id: 'a', name: 'Synthetic A', match: 'same_model', claim_ids: ['a'] }, { id: 'b', name: 'Synthetic B', match: 'adjacent', claim_ids: ['b'] }] };
const packet = { schema_version: '1.0.0', series_id: 'bizmag-test', request: '가상 자료로 5장 계획을 검증한다.', series_label: 'BUSINESS IDEA / TEST', evidence_ref: 'evidence.json',
  idea: { problem: 'unused capacity', target: 'small shops', payer: 'buyer', mechanism: 'matching', revenue: 'proposed transaction fee' },
  money: { value_flow: 'shop to buyer', payment_flow: 'buyer to platform to shop', platform_revenue: 'fee, not gross transaction volume', main_cost: 'support and settlement' },
  frames: profile.frame_roles.map((role, i) => ({ role, headline: `가상 제목 ${i + 1}`, body: '가상 설명입니다.', takeaway: '가상 의미입니다.', alt_text: '가상 검증용 카드입니다.', claim_ids: [i === 2 ? 'a' : i === 3 ? 'b' : 'h'], ...(i === 2 ? { case_id: 'a' } : {}), ...(i === 3 ? { case_id: 'b', case_mode: 'compare' } : {}) })), caption: 'Synthetic fixture. Not a real company claim.' };
const opts = { sourceRef: '/stable/evidence.json', asOf: day };
let count = 0;
function test(name, fn) { fn(); count++; console.log(`PASS ${name}`); }
function negative(name, edit, code) { test(name, () => { const p = structuredClone(packet), e = structuredClone(evidence); edit(p, e); assert.throws(() => compileBusinessMagazine(p, e, opts), error => error.code === code); }); }
const before = JSON.stringify([packet, evidence, profile]);
const output = compileBusinessMagazine(packet, evidence, opts);
test('existing carousel compiler accepts five ordered frames', () => assert.equal(planCarousel(output.series).frames.length, 5));
test('inputs and shared profile are not mutated', () => assert.equal(JSON.stringify([packet, evidence, profile]), before));
test('no account or publication authority inferred', () => { assert.equal(output.series.profiles.brand, undefined); assert.equal(output.sidecar.publication_authorized, false); assert.equal(output.series.task.watermark.enabled, false); });
test('semantic and visual review are not claimed', () => { assert.equal(output.sidecar.semantic_review, 'NOT_REVIEWED'); assert.equal(output.sidecar.visual_review, 'NOT_REVIEWED'); assert.match(output.sidecar.source_truth, /^DECLARED/); });
test('all source URLs reach caption', () => evidence.sources.forEach(s => assert.ok(output.caption.includes(s.url))));
test('opportunity and CTA visible', () => { assert.match(output.series.frames[4].source_note, /가정/); assert.ok(output.series.frames[4].blocks[0].text.includes(profile.cta)); });
test('adjacent case visibly distinguished', () => assert.match(output.series.frames[3].source_note, /인접 사례/));
test('money details reach generation brief', () => assert.ok(output.generation_brief.includes(packet.money.platform_revenue)));
test('headline-only revision leaves other four plans identical', () => { const p = structuredClone(packet); p.frames[1].headline = '수정한 제목'; const revised = compileBusinessMagazine(p, evidence, opts); const a = planCarousel(output.series), b = planCarousel(revised.series); [0, 2, 3, 4].forEach(i => assert.deepEqual(a.frames[i], b.frames[i])); assert.notDeepEqual(a.frames[1], b.frames[1]); });
test('one-case deep dive is truthful fallback', () => { const p = structuredClone(packet), e = structuredClone(evidence); e.cases.pop(); p.frames[3].case_id = 'a'; p.frames[3].claim_ids = ['a']; p.frames[3].case_mode = 'deep-dive'; assert.equal(compileBusinessMagazine(p, e, opts).series.frames[3].function, 'qualify'); });
test('prepared visual refs resolve against packet, not output', () => { const p = structuredClone(packet); p.frames[0].visual = { kind: 'image', ref: 'art.png', rights_note: 'synthetic authored asset' }; const r = compileBusinessMagazine(p, evidence, { ...opts, baseDir: '/input' }); assert.equal(r.series.frames[0].blocks[0].ref, '/input/art.png'); });
test('missing generated bytes stays an instruction, never an output', () => { const p = structuredClone(packet); p.frames[0].visual = { kind: 'generated', instruction: 'Unbranded conceptual still life.' }; const r = compileBusinessMagazine(p, evidence, opts); assert.equal(r.series.frames[0].blocks[0].ref, undefined); assert.equal(r.sidecar.visual_review, 'NOT_REVIEWED'); });
negative('wrong frame count', p => p.frames.pop(), 'BIZ_FIVE_FRAMES');
negative('wrong order', p => p.frames.reverse(), 'BIZ_ORDER');
negative('unknown top-level field', p => p.publish = true, 'BIZ_UNKNOWN_FIELD');
negative('missing payer', p => delete p.idea.payer, 'BIZ_IDEA');
negative('missing cost explanation', p => delete p.money.main_cost, 'BIZ_MONEY');
negative('no real-case evidence', (p, e) => e.cases = [], 'BIZ_NO_CASE');
negative('fact without source', (p, e) => e.claims[0].source_ids = [], 'BIZ_REFERENCE');
negative('unknown source link', (p, e) => e.claims[0].source_ids = ['missing'], 'BIZ_REFERENCE');
negative('duplicate source ID', (p, e) => e.sources.push(e.sources[0]), 'BIZ_ID');
negative('duplicate claim ID', (p, e) => e.claims.push(e.claims[0]), 'BIZ_ID');
negative('invalid source URL', (p, e) => e.sources[0].url = 'javascript:alert(1)', 'BIZ_SOURCE');
negative('source URL credentials', (p, e) => e.sources[0].url = 'https://user:password@example.com', 'BIZ_SOURCE');
negative('invalid calendar date', (p, e) => e.sources[0].checked_at = '2026-02-30', 'BIZ_DATE');
negative('future evidence date', (p, e) => e.as_of = '2027-01-01', 'BIZ_DATE');
negative('future source check', (p, e) => e.sources[0].checked_at = '2026-10-09', 'BIZ_DATE');
negative('publication later than check', (p, e) => e.sources[0].published_at = '2026-10-09', 'BIZ_DATE');
negative('case supported by assumption only', (p, e) => e.cases[0].claim_ids = ['h'], 'BIZ_CASE');
negative('case card cites wrong company', p => p.frames[2].claim_ids = ['b'], 'BIZ_CASE');
negative('same company disguised as second case', p => { p.frames[3].case_id = 'a'; p.frames[3].claim_ids = ['a']; }, 'BIZ_CASE_MODE');
negative('different company disguised as deep dive', p => p.frames[3].case_mode = 'deep-dive', 'BIZ_CASE_MODE');
negative('opportunity presented only as fact', p => p.frames[4].claim_ids = ['a'], 'BIZ_OPPORTUNITY');
negative('unrecognized frame style override', p => p.frames[0].theme = {}, 'BIZ_UNKNOWN_FIELD');
negative('missing alt text', p => delete p.frames[0].alt_text, 'BIZ_COPY');
negative('unrecognized visual kind', p => p.frames[0].visual = { kind: 'fake-screenshot' }, 'BIZ_VISUAL');
const temp = mkdtempSync(resolve(tmpdir(), 'aes-bizmag-'));
try {
  const epath = resolve(temp, 'evidence.json'), ppath = resolve(temp, 'packet.json'), out = resolve(temp, 'out');
  writeFileSync(epath, JSON.stringify(evidence)); writeFileSync(ppath, JSON.stringify(packet));
  const cli = (...args) => spawnSync(process.execPath, [resolve(root, 'scripts/compile-business-magazine.mjs'), ...args], { encoding: 'utf8' });
  test('real CLI writes handoff with actual evidence hash', () => { const r = cli('--packet', ppath, '--out', out); assert.equal(r.status, 0, r.stderr); const s = JSON.parse(readFileSync(resolve(out, 'series.json'))); assert.equal(s.source.ref, epath); assert.equal(s.source.sha256, `sha256:${createHash('sha256').update(readFileSync(epath)).digest('hex')}`); assert.ok(existsSync(resolve(out, 'generation-brief.md'))); assert.equal(JSON.parse(r.stdout).status, 'PLANNED_NOT_RENDERED'); });
  test('CLI refuses existing outputs', () => assert.notEqual(cli('--packet', ppath, '--out', out).status, 0));
  test('CLI rejects unknown options', () => assert.notEqual(cli('--publish', 'yes').status, 0));
  test('CLI failure creates no output', () => { const broken = structuredClone(packet); broken.frames.pop(); writeFileSync(ppath, JSON.stringify(broken)); const badOut = resolve(temp, 'bad'); assert.notEqual(cli('--packet', ppath, '--out', badOut).status, 0); assert.equal(existsSync(badOut), false); });
} finally { rmSync(temp, { recursive: true, force: true }); }
console.log(`\n${count} local business-magazine checks PASS. No raster rendering, network research, semantic review, image generation, CI or publishing was performed by this test.`);
