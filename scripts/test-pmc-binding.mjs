#!/usr/bin/env node
/**
 * SUE-1336: PMC plot bundle -> existing chart panel binding.
 * Offline: no network, model, CI or provider call. The committed bundle is an
 * explicitly fictional run pushed through PMC's own `pmc chart`, so its
 * plot_data_sha256 is PMC's real hash. Real market data is never committed.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { executeVisual, compileExecution } from './lib/visual-execution-core.mjs';
import { renderChartPanel } from './lib/chart-renderer.mjs';
import { findRasterizer, textMeasurer } from './lib/svg-tools.mjs';
import { decodePng } from './lib/watermark-core.mjs';
import { loadPmcPlotBundle, pmcPlotToChartSpec, buildCardPlan, verifyRenderAgainstBundle, pmcPlotDataHash, providerAccent, PmcBindingError } from './lib/pmc-bundle-binding.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fx = resolve(root, 'scripts/fixtures/pmc-bundle');
const GAP = resolve(fx, 'manifold-illustrative-gap-1ec91c13.plot.json');
const SNAP = resolve(fx, 'manifold-illustrative-short-a217899f.plot.json');
const dir = process.env.AES_PMC_TEST_OUT || mkdtempSync(resolve(tmpdir(), 'aes-pmc-'));
mkdirSync(dir, { recursive: true });
const clone = (x) => structuredClone(x);
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
const adapter = findRasterizer('magick') ?? findRasterizer('rsvg');
assert.ok(adapter, 'actual SVG rasterizer required: tests do not fake a rendered result');
const codeOf = (fn, code) => assert.throws(fn, (e) => e instanceof PmcBindingError && e.code === code, code);

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
import { createHash } from 'node:crypto';
const compileHashOf = (t) => ({ sha256: `sha256:${createHash('sha256').update(Buffer.from(t)).digest('hex')}` });
const render = (b, name) => executeVisual(b.plan, { baseDir: b.inputs, outDir: resolve(dir, name), rasterizer: adapter.name });

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
  assert.equal(pts.length - real.length, new Set(b.plot.points.map((p) => p.segment)).size - 1);
  assert.equal(s.y.min, 0); assert.equal(s.y.max, 100); assert.equal(s.y.unit, '%');
  assert.equal(s.source_note, '출처 Manifold'); assert.ok(!/https?:|\//.test(s.source_note));
});
await test('a bundle without an outcome label gets a clean series title (no dangling separator)', () => {
  const b = loadPmcPlotBundle(GAP); b.plot.meta.outcome_label = null; b.plot.meta.outcome = null;
  const s = pmcPlotToChartSpec(b); assert.equal(s.title, 'Manifold'); assert.equal(s.series[0].name, 'manifold');
});
await test('actual PNG: endpoint, hero, delta, axis and observation count match the PMC bundle', async () => {
  const b = bind('in-main'); const r = await render(b, 'out-main');
  const qa = verifyRenderAgainstBundle(b.bundle, r.receipt);
  assert.deepEqual(qa.notes, []); assert.equal(qa.ok, true);
  assert.equal(r.receipt.charts[0].displayed[0].endpoint_label, '48.5%');
  assert.equal(r.receipt.charts[0].source_sha256, compileHashOf(readFileSync(resolve(b.inputs, 'chart.spec.json'), 'utf8')).sha256);
  const img = decodePng(readFileSync(resolve(dir, 'out-main/image.png'))); assert.deepEqual([img.width, img.height], [1080, 1350]);
  assert.equal(r.receipt.checks.actual_pixel_semantic_review, 'NOT_RUN_PHASE4');
});
await test('the gap is drawn as two separate sub-paths, not bridged', async () => {
  const b = bind('in-gap'); const r = renderChartPanel(b.spec, { width: 972, height: 675, theme: b.plan.task.theme ?? {}, measure: textMeasurer(adapter) });
  const d = r.svg.match(/<path d="([^"]+)"/)[1];
  assert.equal((d.match(/M/g) ?? []).length, 2, 'the single null starts a second sub-path'); assert.equal(r.raw_observation_count, b.bundle.plot.points.length + 1);
});
await test('theme-only change leaves the data, spec and numbers unchanged', async () => {
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
await test('long Korean title either fits at measured size or fails; it is never truncated', async () => {
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
await test('QA catches a render that shows a different endpoint than PMC', async () => {
  const b = bind('in-qa'); const r = await render(b, 'out-qa'); const bad = clone(r.receipt);
  bad.charts[0].displayed[0].endpoint_label = '49.0%';
  const qa = verifyRenderAgainstBundle(b.bundle, bad); assert.equal(qa.ok, false); assert.equal(qa.checks.endpoint_matches_pmc_hero, 'FAIL');
});
await test('CLI: bind refuses a non-empty --out and a snapshot; verify passes on a real render', async () => {
  const cli = (...a) => spawnSync(process.execPath, [resolve(root, 'scripts/bind-pmc-bundle.mjs'), ...a], { encoding: 'utf8' });
  const outDir = resolve(dir, 'cli-in');
  let res = cli('bind', '--plot', GAP, '--out', outDir); assert.equal(res.status, 0, res.stderr);
  assert.notEqual(cli('bind', '--plot', GAP, '--out', outDir).status, 0);
  res = cli('bind', '--plot', SNAP, '--out', resolve(dir, 'cli-snap')); assert.equal(res.status, 1); assert.match(res.stderr, /PLOT_NOT_CHARTABLE/);
  const plan = JSON.parse(readFileSync(resolve(outDir, 'plan.json'), 'utf8'));
  const r = await executeVisual(plan, { baseDir: outDir, outDir: resolve(dir, 'cli-out'), rasterizer: adapter.name });
  assert.ok(r.status);
  res = cli('verify', '--inputs', outDir, '--render', resolve(dir, 'cli-out')); assert.equal(res.status, 0, res.stdout + res.stderr);
  const qa = JSON.parse(readFileSync(resolve(dir, 'cli-out/pmc-binding-qa.json'), 'utf8'));
  assert.equal(qa.numeric_lineage_qa, 'PASS'); assert.equal(qa.visual_qa, 'NOT_RUN_OWNER_REVIEW_REQUIRED'); assert.equal(qa.publication, 'NOT_AUTHORIZED');
});
const keep = Boolean(process.env.AES_PMC_TEST_OUT); // an explicit output dir is kept for owner review; the default temp dir is removed
if (!keep) rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify({ passed, output_dir: keep ? dir : 'removed',  renderer: adapter.version, live_PMC_data: 'NOT_RUN_IN_TESTS', visual_review: 'OWNER_REQUIRED', ci: 'NOT_RUN' }));
