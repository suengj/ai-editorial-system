#!/usr/bin/env node
/**
 * SUE-1336: PMC plot bundle -> existing chart panel binding.
 * Offline: no network, model, CI or provider call. The committed bundle is an
 * explicitly fictional run pushed through PMC's own `pmc chart`, so its
 * plot_data_sha256 is PMC's real hash. Real market data is never committed.
 * Tests that draw a PNG need a local SVG rasterizer; without one they print NOT_RUN
 * and the non-rendering tests still run.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { executeVisual, compileExecution } from './lib/visual-execution-core.mjs';
import { renderChartPanel } from './lib/chart-renderer.mjs';
import { CARD_NEWS_TYPE_TOKENS } from './lib/typography-core.mjs';
import { findRasterizer, textMeasurer } from './lib/svg-tools.mjs';
import { decodePng } from './lib/watermark-core.mjs';
import { loadPmcPlotBundle, pmcPlotToChartSpec, buildCardPlan, verifyRenderAgainstBundle, pmcPlotDataHash, providerAccent, resolveTitleOrigin, checkTitleNumbers, PmcBindingError } from './lib/pmc-bundle-binding.mjs';
import { validateCardNewsChartFacts } from './lib/card-news-brief-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fx = resolve(root, 'scripts/fixtures/pmc-bundle');
const GAP = resolve(fx, 'manifold-illustrative-gap-1ec91c13.plot.json');
const SNAP = resolve(fx, 'manifold-illustrative-short-a217899f.plot.json');
const TYPED = '현재 48.5%로 거래되는 가상 시장';
const keep = Boolean(process.env.AES_PMC_TEST_OUT); // an explicit output dir is kept for owner review; the default temp dir is removed
const dir = keep ? process.env.AES_PMC_TEST_OUT : mkdtempSync(resolve(tmpdir(), 'aes-pmc-'));
const adapter = findRasterizer('magick') ?? findRasterizer('rsvg');
let passed = 0;
const notRun = [];
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
// Render tests need a real rasterizer; a rendered result is never faked. Without one they are NOT_RUN, not failed.
const rtest = adapter ? test : async (name) => { notRun.push(name); console.log(`NOT_RUN ${name}: no local SVG rasterizer`); };
const clone = (x) => structuredClone(x);
const codeOf = (fn, code) => assert.throws(fn, (e) => e instanceof PmcBindingError && e.code === code, code);
const cli = (...a) => spawnSync(process.execPath, [resolve(root, 'scripts/bind-pmc-bundle.mjs'), ...a], { encoding: 'utf8' });
const compileHashOf = (t) => ({ sha256: `sha256:${createHash('sha256').update(Buffer.from(t)).digest('hex')}` });

/** Write a bound inputs directory the same way scripts/bind-pmc-bundle.mjs does, but in-process. */
function bind(name, { plotPath = GAP, title, titleOrigin, accent } = {}) {
  const inputs = resolve(dir, name); mkdirSync(inputs, { recursive: true });
  const bundle = loadPmcPlotBundle(plotPath);
  copyFileSync(bundle.path, resolve(inputs, 'pmc.plot.json'));
  const spec = pmcPlotToChartSpec(bundle), specText = `${JSON.stringify(spec, null, 2)}\n`;
  writeFileSync(resolve(inputs, 'chart.spec.json'), specText);
  const { sha256 } = compileHashOf(specText);
  const plan = buildCardPlan(bundle, { title, titleOrigin, specRef: 'chart.spec.json', specSha256: sha256, plotRef: 'pmc.plot.json', theme: accent ? { accent } : {} });
  return { inputs, bundle, spec, plan };
}
const render = (b, name) => executeVisual(b.plan, { baseDir: b.inputs, outDir: resolve(dir, name), rasterizer: adapter?.name });

/** The receipt fields verifyRenderAgainstBundle reads, shaped as chart-renderer reports them (raw_observation_count counts spec points, nulls included). */
function receiptFor(bundle, spec, axis = {}) {
  const real = spec.series[0].points.filter((p) => p[1] !== null), last = real.at(-1);
  return {
    charts: [{ displayed: [{ endpoint_label: bundle.plot.hero.text, endpoint: last }], axis: { unit: '%', ymin: 0, ymax: 100, xmin: real[0][0], xmax: last[0], ...axis }, raw_observation_count: spec.series[0].points.length }],
    text: [{ id: 'hero', text: bundle.plot.hero.text }, { id: 'delta', text: `관측 기간 변화 ${bundle.plot.delta.text}` }],
  };
}

mkdirSync(dir, { recursive: true });
try {
  await test("PMC's own plot_data_sha256 is reproduced from the file (Python float repr preserved)", () => {
    const text = readFileSync(GAP, 'utf8');
    assert.equal(pmcPlotDataHash(text), JSON.parse(text).plot_data_sha256);
    assert.match(text, /\b34\.0\b|\.0[,\n]/, 'fixture must contain a Python-style float such as 17.0 so the canonicalisation is genuinely exercised');
  });
  await test('verified bundle loads with meta sibling check; absent PMC PNG is reported, not assumed', () => {
    const b = loadPmcPlotBundle(GAP);
    assert.deepEqual(b.checks, { schema: 'PASS', status: 'PASS', plot_data_sha256: 'PASS', meta_sibling: 'PASS', pmc_png_hash: 'NOT_FOUND' });
  });
  await test('edited value is rejected (source data immutable)', () => {
    const t = clone(JSON.parse(readFileSync(GAP, 'utf8'))); t.points[3].value = 0.9;
    const p = resolve(dir, 'edited.plot.json'); writeFileSync(p, JSON.stringify(t, null, 2));
    codeOf(() => loadPmcPlotBundle(p), 'PLOT_HASH_MISMATCH');
  });
  await test('an edit that also rewrites the hash field still cannot pass as a different dataset', () => {
    const t = JSON.parse(readFileSync(GAP, 'utf8')); t.points[3].value = 0.9; t.plot_data_sha256 = pmcPlotDataHash(JSON.stringify(t));
    const p = resolve(dir, 'rehashed.plot.json'); writeFileSync(p, JSON.stringify(t, null, 2));
    const b = loadPmcPlotBundle(p);                       // internally consistent...
    assert.notEqual(b.plot_data_sha256, JSON.parse(readFileSync(GAP, 'utf8')).plot_data_sha256); // ...but a different, visible identity
    assert.equal(b.checks.meta_sibling, 'ABSENT');        // and PMC's own meta no longer vouches for it
  });
  await test('snapshot / single observation is never drawn as a trend', () => codeOf(() => loadPmcPlotBundle(SNAP), 'PLOT_NOT_CHARTABLE'));
  await test('multi-outcome bundles are refused (PMC keeps rendering them)', () => {
    const t = JSON.parse(readFileSync(GAP, 'utf8')); t.schema = 'pmc.plotdata-multi/1';
    const p = resolve(dir, 'multi.plot.json'); writeFileSync(p, JSON.stringify(t)); codeOf(() => loadPmcPlotBundle(p), 'PLOT_SCHEMA');
  });
  await test('spec copies observations: values x100, no added/removed point, one null per PMC segment break', () => {
    const b = loadPmcPlotBundle(GAP), s = pmcPlotToChartSpec(b), pts = s.series[0].points;
    const real = pts.filter((p) => p[1] !== null);
    assert.equal(real.length, b.plot.points.length);
    assert.deepEqual(real.map((p) => p[1]), b.plot.points.map((p) => Number((p.value * 100).toPrecision(12))));
    assert.deepEqual(real.map((p) => p[0]), b.plot.points.map((p) => Date.parse(p.observed_at)));
    let changes = 0; b.plot.points.forEach((p, i) => { if (i && p.segment !== b.plot.points[i - 1].segment) changes++; });
    assert.equal(pts.length - real.length, changes);
    assert.equal(s.y.min, 0); assert.equal(s.y.max, 100); assert.equal(s.y.unit, '%');
    assert.equal(s.source_note, '출처 Manifold'); assert.ok(!/https?:|\//.test(s.source_note));
  });
  await test('PMC trend dates and signed delta are bound to the bundle', () => {
    const bundle=loadPmcPlotBundle(GAP), points=bundle.plot.points.map(p=>({observed_at:p.observed_at,value:Number((p.value*100).toPrecision(12))})), dt=(v)=>`${String(new Date(v).getUTCMonth()+1).padStart(2,'0')}.${String(new Date(v).getUTCDate()).padStart(2,'0')}`, delta=Number(bundle.plot.delta.value_pp), spec={type:'number_visual',layout:'trend-area',start:points[0].value,end:points.at(-1).value,start_label:`${points[0].value}%`,end_label:`${points.at(-1).value}%`,start_date:dt(bundle.plot.delta.baseline_at),end_date:dt(bundle.plot.delta.last_at),delta_label:`${delta>0?'+':delta<0?'−':''}${Number(Math.abs(delta).toPrecision(12))}%p`,points};
    const d=resolve(dir,'trend-labels');mkdirSync(d,{recursive:true});copyFileSync(GAP,resolve(d,'pmc.plot.json'));writeFileSync(resolve(d,'trend.json'),JSON.stringify(spec));
    const s={profiles:{artifact:'visual/prediction-market-carousel'},source:{ref:'pmc.plot.json'},frames:[{id:'trend',function:'show_evidence',blocks:[{kind:'chart',ref:'trend.json'}]}]};
    const b={trend_eligibility:{source_type:'market_pmc'},per_card:{trend:{visual_fact_ids:[]}}};
    assert.equal(validateCardNewsChartFacts(s,b,d).ok,true);
    for(const [key,value] of [['delta_label','+99%p'],['start_date','12.31'],['end_date','01.01']]) { writeFileSync(resolve(d,'trend.json'),JSON.stringify({...spec,[key]:value}));assert.equal(validateCardNewsChartFacts(s,b,d).ok,false,`forged ${key} rejected`); }
  });
  await test('chart-facing period and captions use reader language without process labels', () => {
    const b = loadPmcPlotBundle(GAP); b.plot.meta.outcome_label = null; b.plot.meta.outcome = null;
    const s = pmcPlotToChartSpec(b);
    assert.match(s.title, /^\d+월 \d+일 → /); assert.equal(s.period, '이번 주'); assert.equal(s.series[0].name, 'manifold');
    assert.equal(s.x.label, '날짜'); assert.equal(s.x.show_label, false);
    assert.equal(s.source_note, '출처 Manifold');
    assert(!/UTC|관측|시장 확률|202\d-/.test(`${s.period} ${s.x.label} ${s.source_note}`));
  });
  await test('a typed title without --title-origin is request_summary; PMC meta.title is source_verbatim', () => {
    const b = loadPmcPlotBundle(GAP), opts = { specRef: 'c', specSha256: 'sha256:x', plotRef: 'pmc.plot.json' };
    assert.equal(resolveTitleOrigin({ title: TYPED }), 'request_summary');
    assert.equal(resolveTitleOrigin({}), 'source_verbatim');
    assert.equal(buildCardPlan(b, { ...opts, title: TYPED }).layers[0].source_ref, 'request');
    assert.equal(buildCardPlan(b, opts).layers[0].source_ref, 'pmc.plot.json');
    // an origin that does not describe the headline is refused, not recorded
    codeOf(() => buildCardPlan(b, { ...opts, titleOrigin: 'source_rewrite' }), 'TITLE_ORIGIN');
    codeOf(() => buildCardPlan(b, { ...opts, title: TYPED, titleOrigin: 'source_verbatim' }), 'TITLE_ORIGIN');
    codeOf(() => buildCardPlan(b, { ...opts, title: TYPED, titleOrigin: 'model_invented' }), 'TITLE_ORIGIN');
  });
  await test('a signed title number must match the displayed sign: "-17.3%" is not "+17.3%p"', () => {
    const shown = ['48.5%', '+17.3%p'];
    codeOf(() => checkTitleNumbers('-17.3% 하락', shown), 'TITLE_NUMBER_UNGROUNDED');
    codeOf(() => checkTitleNumbers('−17.3% 하락', shown), 'TITLE_NUMBER_UNGROUNDED'); // U+2212 minus is the same sign
    checkTitleNumbers('+17.3%p 상승', shown); checkTitleNumbers('17.3% 상승', shown); checkTitleNumbers('48.5%로 거래', shown);
    const down = ['48.5%', '-3.2%p'];
    checkTitleNumbers('-3.2% 하락', down);
    codeOf(() => checkTitleNumbers('+3.2% 상승', down), 'TITLE_NUMBER_UNGROUNDED');
    checkTitleNumbers('3.2% 하락', down); // unsigned is a magnitude
  });
  await test('a bundle without y_axis is drawn and checked on the same 0..100 default; a mismatch is a coded FAIL, not a crash', () => {
    const bundle = loadPmcPlotBundle(GAP); bundle.plot = clone(bundle.plot); delete bundle.plot.y_axis;
    const spec = pmcPlotToChartSpec(bundle);
    assert.deepEqual([spec.y.min, spec.y.max], [0, 100]);
    const ok = verifyRenderAgainstBundle(bundle, receiptFor(bundle, spec));
    assert.deepEqual(ok.notes, []); assert.equal(ok.ok, true);
    const bad = verifyRenderAgainstBundle(bundle, receiptFor(bundle, spec, { ymax: 90 }));
    assert.equal(bad.checks.axis_matches_pmc, 'FAIL'); assert.equal(bad.ok, false);
  });
  await test('spec and QA count segment breaks alike: A,B,A is two breaks, not one', () => {
    const bundle = loadPmcPlotBundle(GAP); bundle.plot = clone(bundle.plot);
    bundle.plot.points.forEach((p, i) => { p.segment = i >= 13 && i < 16 ? 1 : 0; });
    const spec = pmcPlotToChartSpec(bundle);
    assert.equal(spec.series[0].points.filter((p) => p[1] === null).length, 2);
    const ok = verifyRenderAgainstBundle(bundle, receiptFor(bundle, spec));
    assert.deepEqual(ok.notes, []); assert.equal(ok.checks.observation_count, 'PASS');
  });
  await rtest('actual PNG: endpoint, hero, delta, axis and observation count match the PMC bundle', async () => {
    const b = bind('in-main'); const r = await render(b, 'out-main');
    const qa = verifyRenderAgainstBundle(b.bundle, r.receipt);
    assert.deepEqual(qa.notes, []); assert.equal(qa.ok, true);
    assert.equal(r.receipt.charts[0].displayed[0].endpoint_label, '48.5%');
    assert.equal(r.receipt.charts[0].source_sha256, compileHashOf(readFileSync(resolve(b.inputs, 'chart.spec.json'), 'utf8')).sha256);
    const img = decodePng(readFileSync(resolve(dir, 'out-main/image.png'))); assert.deepEqual([img.width, img.height], [1080, 1350]);
    assert.equal(r.receipt.checks.actual_pixel_semantic_review, 'NOT_RUN_PHASE4');
  });
  await test('reader-facing Korean delta and chart endpoint preserve PMC parity without a raw delta string', () => {
    const b = bind('reader-copy');
    const receipt = receiptFor(b.bundle, b.spec);
    const pp = b.bundle.plot.delta.value_pp;
    receipt.text = [{ id: 'headline', text: `이번 주, ${Math.abs(pp).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%p ${pp < 0 ? '내렸다' : '올랐다'}` }];
    const qa = verifyRenderAgainstBundle(b.bundle, receipt);
    assert.equal(qa.ok, true); assert.deepEqual(qa.notes, []);
    assert.equal(qa.checks.hero_text_layer, 'PASS'); assert.equal(qa.checks.delta_text_layer, 'PASS');
  });
  await rtest('the gap is drawn as two separate sub-paths, not bridged', async () => {
    const b = bind('in-gap'); const r = renderChartPanel(b.spec, { width: 972, height: 675, theme: b.plan.task.theme ?? {}, measure: textMeasurer(adapter) });
    const d = r.svg.match(/<path d="([^"]+)"/)[1];
    assert.equal((d.match(/M/g) ?? []).length, 2, 'the single null starts a second sub-path'); assert.equal(r.raw_observation_count, b.bundle.plot.points.length + 1);
  });
  await rtest('PMC line-chart SVG text uses shared card-news type tokens', async () => {
    const b = bind('in-gap'); const r = renderChartPanel(b.spec, { width: 936, height: 675, theme: b.plan.task.theme ?? {}, measure: textMeasurer(adapter) });
    const sizes = [...r.svg.matchAll(/font-size="([0-9.]+)"/gu)].map((match) => Number(match[1]));
    assert(sizes.length >= 8);
    const allowed = new Set(Object.values(CARD_NEWS_TYPE_TOKENS).map((token) => token?.font_size).filter(Number.isFinite));
    assert(sizes.every((size) => allowed.has(size)), `all SVG text sizes must be shared tokens; got ${[...new Set(sizes)].join(',')}`);
  });
  await rtest('theme-only change leaves the data, spec and numbers unchanged', async () => {
    const a = bind('in-theme-a'), c = bind('in-theme-b', { accent: '#B5532F' });
    assert.deepEqual(a.spec, c.spec); assert.notEqual(a.plan.task.theme.accent, c.plan.task.theme.accent);
    const ra = await render(a, 'out-theme-a'), rc = await render(c, 'out-theme-b');
    assert.deepEqual(ra.receipt.charts[0].displayed, rc.receipt.charts[0].displayed);
    assert.notEqual(ra.receipt.outputs.image.sha256, rc.receipt.outputs.image.sha256);
  });
  await test('provider colours follow the approved numeric profile; other providers get no cobalt/coral', () => {
    assert.equal(providerAccent('polymarket'), '#2E5BFF'); assert.equal(providerAccent('kalshi'), '#FF6B5B');
    assert.ok(!['#2E5BFF', '#FF6B5B'].includes(providerAccent('manifold')));
  });
  await test('a title number the card does not display is refused', () => {
    const b = loadPmcPlotBundle(GAP);
    assert.throws(() => buildCardPlan(b, { title: '일주일 만에 60%가 됐다', titleOrigin: 'request_summary', specRef: 'c', specSha256: 'sha256:x', plotRef: 'p' }), (e) => e.code === 'TITLE_NUMBER_UNGROUNDED');
    const ok = buildCardPlan(b, { title: '현재 48.5%로 거래되는 가상 시장', titleOrigin: 'request_summary', specRef: 'c', specSha256: 'sha256:x', plotRef: 'p' });
    assert.equal(ok.layers[0].source_ref, 'request');
  });
  await rtest('long Korean title either fits at measured size or fails; it is never truncated', async () => {
    const long = '가상의 정책 결정이 연말까지 발표될 가능성을 두고 시장 참가자들이 어떻게 평가하는지 그리고 최근 관측 기간 동안 그 평가가 어떻게 달라졌는지 길게 설명하는 제목';
    const b = bind('in-long', { title: long, titleOrigin: 'request_summary' });
    try { const r = await render(b, 'out-long'); assert.equal(r.receipt.text.find((t) => t.id === 'headline').text, long); }
    catch (e) { assert.match(String(e.code ?? e.message), /TEXT_OVERFLOW/); }
  });
  await test('no probability rule leaks: general counts/prices >100 and negatives render on the same panel', () => {
    const r = renderChartPanel({ type: 'bar', title: '가상 비교(예시)', period: 'illustrative', source_note: 'illustrative', x: { label: '항목' }, y: { label: '건수', unit: '건', decimals: 0 },
      series: [{ name: '표본', claim: 'illustrative', points: [[1, 125], [2, 180], [3, 240]] }] });
    assert.deepEqual(r.displayed.map((d) => d.value), [125, 180, 240]); assert.equal(r.axis.unit, '건'); assert.ok(r.axis.ymax >= 240);
  });
  await test('compile accepts the generated plan on the Instagram surface with a bytes-bound source', async () => {
    const b = bind('in-compile'); const c = await compileExecution(b.plan, { baseDir: b.inputs });
    assert.equal(c.qa.publication, 'NOT_AUTHORIZED'); assert.equal(c.layers.at(-1).sha256, compileHashOf(readFileSync(resolve(b.inputs, 'chart.spec.json'), 'utf8')).sha256);
  });
  await rtest('QA catches a render that shows a different endpoint than PMC', async () => {
    const b = bind('in-qa'); const r = await render(b, 'out-qa'); const bad = clone(r.receipt);
    bad.charts[0].displayed[0].endpoint_label = '49.0%';
    const qa = verifyRenderAgainstBundle(b.bundle, bad); assert.equal(qa.ok, false); assert.equal(qa.checks.endpoint_matches_pmc_hero, 'FAIL');
  });
  await test('CLI: bind refuses a non-empty --out and a snapshot', () => {
    const outDir = resolve(dir, 'cli-in');
    let res = cli('bind', '--plot', GAP, '--out', outDir); assert.equal(res.status, 0, res.stderr);
    assert.notEqual(cli('bind', '--plot', GAP, '--out', outDir).status, 0);
    res = cli('bind', '--plot', SNAP, '--out', resolve(dir, 'cli-snap')); assert.equal(res.status, 1); assert.match(res.stderr, /PLOT_NOT_CHARTABLE/);
  });
  await test('CLI: --title without --title-origin is recorded as request_summary; --title-origin without --title is refused', () => {
    const out = resolve(dir, 'cli-typed');
    let res = cli('bind', '--plot', GAP, '--out', out, '--title', TYPED); assert.equal(res.status, 0, res.stderr);
    assert.equal(JSON.parse(readFileSync(resolve(out, 'binding.json'), 'utf8')).title_origin, 'request_summary');
    assert.equal(JSON.parse(readFileSync(resolve(out, 'plan.json'), 'utf8')).layers[0].source_ref, 'request');
    res = cli('bind', '--plot', GAP, '--out', resolve(dir, 'cli-origin-only'), '--title-origin', 'request_summary');
    assert.equal(res.status, 1); assert.match(res.stderr, /TITLE_ORIGIN/);
  });
  await rtest('CLI: verify passes on a real render', async () => {
    const outDir = resolve(dir, 'cli-in');
    const plan = JSON.parse(readFileSync(resolve(outDir, 'plan.json'), 'utf8'));
    const r = await executeVisual(plan, { baseDir: outDir, outDir: resolve(dir, 'cli-out'), rasterizer: adapter.name });
    assert.ok(r.status);
    const res = cli('verify', '--inputs', outDir, '--render', resolve(dir, 'cli-out')); assert.equal(res.status, 0, res.stdout + res.stderr);
    const qa = JSON.parse(readFileSync(resolve(dir, 'cli-out/pmc-binding-qa.json'), 'utf8'));
    assert.equal(qa.numeric_lineage_qa, 'PASS'); assert.equal(qa.visual_qa, 'NOT_RUN_OWNER_REVIEW_REQUIRED'); assert.equal(qa.publication, 'NOT_AUTHORIZED');
  });
} finally {
  if (!keep) rmSync(dir, { recursive: true, force: true });
}
console.log(JSON.stringify({ passed, not_run: notRun, output_dir: keep ? dir : 'removed', renderer: adapter?.version ?? 'NOT_RUN', live_PMC_data: 'NOT_RUN_IN_TESTS', visual_review: 'OWNER_REQUIRED', ci: 'NOT_RUN' }));
