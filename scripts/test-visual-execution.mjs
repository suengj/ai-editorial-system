#!/usr/bin/env node
/** Local Phase 0–3 integration tests. No network, CI, native generator or approval. */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileExecution, executeVisual } from './lib/visual-execution-core.mjs';
import { renderChart, renderChartPanel } from './lib/chart-renderer.mjs';
import { decodePng, encodePng, sha256, resolveWatermark, applyWatermark } from './lib/watermark-core.mjs';
import { findRasterizer, rasterize } from './lib/svg-tools.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.env.AES_VISUAL_TEST_OUT || mkdtempSync(resolve(tmpdir(), 'aes-visual-'));
mkdirSync(dir, { recursive: true });
const fixture = (name) => JSON.parse(readFileSync(resolve(root, 'scripts/fixtures/visual-execution', name), 'utf8'));
const clone = (x) => structuredClone(x);
const base = fixture('card.json');
writeFileSync(resolve(dir, 'source.md'), readFileSync(resolve(root, 'scripts/fixtures/visual-execution/source.md')));
for (const name of ['line.json', 'bar.json']) writeFileSync(resolve(dir, name), JSON.stringify(fixture(name)));
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
const compile = (p, opts = {}) => compileExecution(p, { baseDir: dir, ...opts });
const run = (p, name) => executeVisual(p, { baseDir: dir, outDir: resolve(dir, name), rasterizer: adapter.name });
const reject = (p, code) => assert.rejects(() => compile(p), (e) => e.code === code);
const adapter = findRasterizer('magick') ?? findRasterizer('rsvg');
assert.ok(adapter, 'actual SVG rasterizer required: tests do not fake a rendered result');
const wm = { render: (svg) => rasterize(svg, adapter), version: adapter.version };
const source = encodePng({ width: 320, height: 200, channels: 4,
  pixels: Buffer.from(Array.from({ length: 320 * 200 }, (_, i) => [i % 256, Math.floor(i / 320) % 256, 100, 255]).flat()) });
writeFileSync(resolve(dir, 'source.png'), source);
const squareSource = encodePng({ width: 200, height: 200, channels: 4,
  pixels: Buffer.from(Array.from({ length: 200 * 200 }, (_, i) => [i % 256, Math.floor(i / 200) % 256, 100, 255]).flat()) });
writeFileSync(resolve(dir, 'square.png'), squareSource);
const cutout = decodePng(source); for (let i = 3; i < cutout.pixels.length; i += 4) if (i < cutout.pixels.length / 5) cutout.pixels[i] = 0;
writeFileSync(resolve(dir, 'cutout.png'), encodePng(cutout));
const photo = clone(base);
photo.layers = [{ id: 'photo', kind: 'image', ref: 'source.png', rights_note: 'synthetic test pixels authored for this test; not a real photograph', slot: { x: 0.5, y: 0.3, width: 320 / 1080, height: 200 / 1080 } }];
await test('explicit 1:1 overrides Instagram portrait recipe', async () => { const p = await compile(base); assert.equal(p.canvas.height, 1080); assert.equal(p.watermark.enabled, false); });
await test('portrait default remains 1080x1350', async () => { const p = clone(base); delete p.task.canvas; assert.equal((await compile(p)).canvas.height, 1350); });
await test('explicit task beats preset independently', async () => { const p = await compile(base, { preset: { theme: { accent: '#000000' }, watermark: { enabled: true } } }); assert.equal(p.theme.accent, '#2E5BFF'); assert.equal(p.watermark.enabled, false); });
await test('preset affects execution hash, not original request hash', async () => { const p = clone(base); delete p.task.theme.accent; const a = await compile(p); const b = await compile(p, { preset: { theme: { accent: '#000000' } } }); assert.equal(a.request_hash, b.request_hash); assert.notEqual(a.execution_hash, b.execution_hash); });
await test('unknown field rejected', async () => { const p = clone(base); p.task.fake = true; await reject(p, 'UNKNOWN_FIELD'); });
await test('irrelevant layer field rejected, not silently ignored', async () => { const p = clone(base); p.layers[0].fit = 'cover'; await reject(p, 'UNKNOWN_FIELD'); });
await test('source hash mismatch rejected', async () => { const p = clone(base); p.source.sha256 = `sha256:${'0'.repeat(64)}`; await reject(p, 'SOURCE_CHANGED'); });
await test('missing file rejected', async () => { const p = clone(photo); p.layers[0].ref = 'missing.png'; await reject(p, 'SOURCE_REQUIRED'); });
await test('unknown profile rejected', async () => { const p = clone(base); p.profiles.artifact = 'visual/nonexistent'; await reject(p, 'UNKNOWN_PROFILE'); });
await test('unknown text provenance rejected', async () => { const p = clone(base); p.layers[0].source_ref = 'imaginary-source'; await reject(p, 'TEXT_SOURCE'); });
await test('text/evidence collision rejected', async () => { const p = clone(base); p.layers[1].slot = clone(p.layers[0].slot); await reject(p, 'LAYER_OVERLAP'); });
await test('non-finite slot rejected', async () => { const p = clone(base); p.layers[0].slot.x = NaN; await reject(p, 'INVALID_SLOT'); });
await test('no_text rejects declared text', async () => { const p = clone(base); p.task.text_policy = 'no_text'; await reject(p, 'TEXT_POLICY'); });
await test('no_text can composite a source-bound image', async () => { const p = clone(photo); p.source.scope = 'source_bound'; p.task.text_policy = 'no_text'; assert.equal((await compile(p)).text_policy, 'no_text'); });
await test('illustrative scene alone does not force a text label under no_text', async () => { const p = clone(photo); p.task.text_policy = 'no_text'; assert.equal((await compile(p)).text_policy, 'no_text'); });
await test('illustrative source alone does not add a label; mockup_risk does', async () => { const plain = await run(photo, 'plain-illustration'); assert.deepEqual(plain.receipt.mockup_labels, []); const p = clone(photo); p.source.scope = 'source_bound'; p.layers[0].mockup_risk = true; const marked = await run(p, 'mockup-risk'); assert.equal(marked.receipt.mockup_labels[0].text, 'ILLUSTRATIVE / 가상 예시'); });
await test('generated layer without bytes returns render-required', async () => { const p = clone(base); p.layers = [{ id: 'scene', kind: 'generated', instruction: 'Nonfactual metaphor, no text', slot: { x: 0.1, y: 0.1, width: 0.8, height: 0.7 } }]; const r = await run(p, 'pending'); assert.equal(r.status, 'RENDER_REQUIRED'); assert.equal(existsSync(resolve(dir, 'pending/image.png')), false); });
await test('source-only has no dummy article or approval', async () => { const p = await compile(base); assert.equal(p.legacy, null); assert.equal(p.qa.publication, 'NOT_AUTHORIZED'); assert.equal(p.source.ref, 'source.md'); });
await test('protected cover crop rejected', async () => { const p = clone(photo); p.layers[0].fit = 'cover'; p.layers[0].slot.width = 0.1; p.layers[0].protect = [{ x: 0, y: 0, width: 1, height: 1 }]; await reject(p, 'PROTECTED_CROP'); });
await test('focal box is preserved through cover, split fallback, then R7 fallback', async () => {
  const baseFocal = clone(photo); baseFocal.layers[0].fit = 'cover'; baseFocal.layers[0].slot = { x: 0.1, y: 0.2, width: 0.6, height: 0.6 }; baseFocal.layers[0].focal_box = { x: 0, y: 0.4, width: 0.1, height: 0.1 }; baseFocal.layers[0].focal_min_area_ratio = 1;
  const text = { id: 'caption', kind: 'text', text: 'A caption', source_ref: 'source.md', slot: { x: 0.2, y: 0.62, width: 0.5, height: 0.12 }, font_size: 32 };
  const covered = clone(baseFocal); covered.layers[0].slot = { x: 0.1, y: 0.2, width: 0.6, height: 0.6 }; covered.layers.push(text); const split = clone(covered); split.layers[0].focal_fallback = { split_slot: { x: 0.1, y: 0.2, width: 0.6, height: 0.375 }, r7_instruction: 'R7: draw a nonverbal illustration of the key subject.' }; const splitPlan = await compile(split); assert.equal(splitPlan.layers[0].focal_evidence.fallback, 'split'); assert.equal(splitPlan.layers[0].focal_evidence.visible_area_ratio, 1); assert.deepEqual(splitPlan.layers[0].slot, split.layers[0].focal_fallback.split_slot);
  const splitMarked = clone(split); splitMarked.task.watermark = { enabled: true, text: 'TEST' }; const splitRender = await run(splitMarked, 'focal-split-watermark'); assert.deepEqual(splitRender.receipt.watermark.watermark.exclusion_zones.find((zone) => zone.zone_id === 'photo'), { zone_id: 'photo', ...split.layers[0].focal_fallback.split_slot });
  const missing = clone(covered); delete missing.layers[0].focal_box; delete missing.layers[0].focal_min_area_ratio; await reject(missing, 'FOCAL_CROP');
  const zeroPixelFocal = clone(covered); zeroPixelFocal.layers[0].focal_box = { x: 0, y: 0, width: 0.00001, height: 0.00001 }; await reject(zeroPixelFocal, 'FOCAL_CROP');
  for (const invalidRatio of [NaN, Infinity]) { const invalid = clone(covered); invalid.layers[0].focal_min_area_ratio = invalidRatio; await reject(invalid, 'FOCAL_CROP'); }
  const r7 = clone(covered); r7.layers[0].focal_fallback = { split_slot: { x: 0.1, y: 0.2, width: 0.6, height: 0.6 }, r7_instruction: 'R7: draw a nonverbal illustration of the key subject.' }; const r7Plan = await compile(r7); assert.equal(r7Plan.layers[0].focal_evidence.fallback, 'r7-illustration'); assert.equal(r7Plan.layers[0].focal_evidence.status, 'R7_RENDER_REQUIRED'); assert.equal(r7Plan.layers[0].focal_evidence.visible_area_ratio, undefined); assert.equal(r7Plan.layers[0].status, 'RENDER_REQUIRED');
  const noText = clone(baseFocal); noText.layers[0].focal_fallback = { split_slot: { x: 0.1, y: 0.2, width: 0.6, height: 0.375 }, r7_instruction: 'R7: draw a nonverbal illustration of the key subject.' }; assert.equal((await compile(noText)).layers[0].focal_evidence.fallback, 'r7-illustration');
  const safe = clone(baseFocal); safe.layers[0].slot = { x: 0.1, y: 0.2, width: 0.6, height: 0.375 }; const safePlan = await compile(safe); assert.equal(safePlan.layers[0].focal_evidence.fallback, 'cover');
});
await test('R7 pending illustration skips discarded photo protected-crop validation', async () => {
  const p = clone(photo); p.layers[0].ref = 'square.png'; p.layers[0].fit = 'cover';
  p.layers[0].slot = { x: 0.1, y: 0.2, width: 0.6, height: 0.375 };
  p.layers[0].focal_box = { x: 0, y: 0, width: 1, height: 1 }; p.layers[0].focal_min_area_ratio = 1;
  p.layers[0].focal_fallback = { split_slot: { x: 0.1, y: 0.2, width: 0.6, height: 0.375 }, r7_instruction: 'R7: draw a nonverbal illustration of the key subject.' };
  p.layers.push({ id: 'caption', kind: 'text', text: 'A caption', source_ref: 'source.md', slot: { x: 0.2, y: 0.62, width: 0.5, height: 0.12 }, font_size: 32 });
  const withoutProtect = await compile(p);
  assert.equal(withoutProtect.status, 'RENDER_REQUIRED');
  assert.equal(withoutProtect.layers[0].focal_evidence.fallback, 'r7-illustration');
  const withProtect = clone(p); withProtect.layers[0].protect = [{ x: 0, y: 0, width: 1, height: 1 }];
  const protectedPlan = await compile(withProtect);
  assert.equal(protectedPlan.status, 'RENDER_REQUIRED');
  assert.equal(protectedPlan.layers[0].kind, 'generated');
  assert.equal(protectedPlan.layers[0].focal_evidence.fallback, 'r7-illustration');
});
await test('cutout requires actual alpha', async () => { const p = clone(photo); p.layers[0].mode = 'cutout_composite'; await reject(p, 'CUTOUT_REQUIRED'); p.layers[0].ref = 'cutout.png'; assert.equal((await compile(p)).layers[0].mode, 'cutout_composite'); });
await test('inpainting is not falsely claimed', async () => { const p = clone(photo); p.layers[0].mode = 'generative_edit'; await reject(p, 'EDIT_REQUIRED'); });
await test('actual Korean card PNG and measured wrap', async () => { const p = await run(base, 'card'); assert.equal(p.status, 'RENDERED_NEEDS_REVIEW'); const img = decodePng(readFileSync(resolve(dir, 'card/image.png'))); assert.equal(img.width, 1080); assert.equal(img.height, 1080); assert.equal(p.receipt.text[0].lines.length, 2); assert.equal(p.receipt.publication_authorized, false); });
await test('watermark OFF is byte-identical clean master', async () => { assert.deepEqual(readFileSync(resolve(dir, 'card/master.png')), readFileSync(resolve(dir, 'card/image.png'))); });
await test('text overflow fails without truncating or leaving PNG', async () => { const p = clone(base); p.layers[0].text = '정보를 삭제해서는 안 됩니다. '.repeat(12); await assert.rejects(() => run(p, 'overflow'), /TEXT_OVERFLOW/); assert.equal(existsSync(resolve(dir, 'overflow/image.png')), false); });
await test('exact image slot preserves unscaled source pixels', async () => { const p = await run(photo, 'photo'); const img = decodePng(readFileSync(resolve(dir, 'photo/image.png'))); const raw = decodePng(source); const b = p.layers[0].pixel_slot; /* rsvg-convert writes opaque 3-channel PNG, ImageMagick PNG32 writes 4: compare RGB at each file's own stride */ for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) assert.deepEqual(img.pixels.subarray(((b.y + y) * img.width + b.x + x) * img.channels, ((b.y + y) * img.width + b.x + x) * img.channels + 3), raw.pixels.subarray((y * 320 + x) * raw.channels, (y * 320 + x) * raw.channels + 3)); assert.equal(sha256(readFileSync(resolve(dir, 'source.png'))), sha256(source)); });
await test('image receipt warns when source pixels must be upsampled for the slot', async () => { const p = clone(photo); p.layers[0].slot = { x: 0.1, y: 0.2, width: 0.64, height: 0.64 }; const r = await run(p, 'photo-upscale'); assert.equal(r.receipt.images[0].resolution.status, 'UPSCALE_WARNING'); assert.equal(r.receipt.images[0].resolution.upsampled, true); assert.ok(r.receipt.images[0].resolution.required_scale > 1); });
await test('watermark ON produces distinct derivative', async () => { const p = clone(base); p.task.watermark = { enabled: true, text: 'TEST' }; const r = await run(p, 'marked'); assert.notEqual(r.receipt.outputs.master.sha256, r.receipt.outputs.image.sha256); assert.equal(r.receipt.watermark.watermark.text, 'TEST'); });
await test('rerun from master does not stack watermark', async () => { const p = clone(base); p.task.watermark = { enabled: true, text: 'TEST' }; await run(p, 'marked-repeat'); assert.deepEqual(readFileSync(resolve(dir, 'marked/image.png')), readFileSync(resolve(dir, 'marked-repeat/image.png'))); });
await test('previous output directory is never silently reused', async () => { await assert.rejects(() => run(base, 'card'), (e) => e.code === 'OUTPUT_EXISTS'); });
await test('marked source cannot acquire a second watermark', async () => { const p = clone(photo); p.layers[0].ref = 'marked/image.png'; await reject(p, 'INPUT_IS_DERIVATIVE'); });
await test('background watermark is tracked and protected from stacking', async () => { const p = clone(photo); p.task.watermark = { enabled: true, text: 'TEST' }; p.task.watermark_layer = 'background'; const r = await run(p, 'behind'); assert.equal(r.receipt.watermark.composed_layer, 'background'); const q = clone(photo); q.layers[0].ref = 'behind/image.png'; await reject(q, 'INPUT_IS_DERIVATIVE'); });
await test('watermark exclusion is enforced by existing engine', async () => { const config = resolveWatermark({ enabled: true, exclusion_zones: [{ zone_id: 'all', x: 0, y: 0, width: 1, height: 1 }] }); assert.throws(() => applyWatermark(readFileSync(resolve(dir, 'card/master.png')), config, { rasterizer: wm }), (e) => e.code === 'exclusion-zone'); });
const dataPlan = clone(base); dataPlan.profiles.artifact = 'visual/evidence-visual'; dataPlan.task.canvas = { width: 1080, height: 1350 };
dataPlan.layers = [{ ...clone(base.layers[0]), text: '데이터는 그대로, 표현은 분리', font_size: 52, slot: { x: 0.08, y: 0.08, width: 0.84, height: 0.14 } }, { id: 'chart', kind: 'chart', ref: 'line.json', slot: { x: 0.05, y: 0.38, width: 0.9, height: 0.48 } }];
await test('actual source-bound line panel, no probability clamping', async () => { const r = await run(dataPlan, 'line'); assert.equal(r.receipt.charts[0].displayed[0].endpoint[1], 240); assert.equal(r.receipt.charts[0].axis.unit, '건'); assert.equal(r.receipt.charts[0].source_sha256, sha256(readFileSync(resolve(dir, 'line.json')))); });
await test('actual bar panel with zero baseline', async () => { const p = clone(dataPlan); p.layers[1].ref = 'bar.json'; const r = await run(p, 'bar'); assert.equal(r.receipt.charts[0].axis.ymin, 0); assert.deepEqual(r.receipt.charts[0].displayed.map((v) => v.value), [125,180,240]); });
await test('mixed image+chart+text+watermark executes', async () => { const p = clone(dataPlan); p.layers.splice(1, 0, { ...clone(photo.layers[0]), slot: { x: 0.65, y: 0.23, width: 0.28, height: 0.13 } }); p.task.watermark = { enabled: true, text: 'TEST' }; const r = await run(p, 'mixed'); assert.equal(r.receipt.images.length, 1); assert.equal(r.receipt.charts.length, 1); assert.ok(r.receipt.watermark); });
await test('line gaps break paths, no invented interpolation', async () => { const p = fixture('line.json'); p.series[0].points[1][1] = null; const r = renderChartPanel(p); assert.equal((r.svg.match(/d="M/g) ?? []).length, 1); assert.ok(r.svg.includes(' M')); assert.equal(r.raw_observation_count, 4); });
await test('chart source-only caption hides pipeline axis wording', async () => { const p = fixture('line.json'); p.x.show_label = false; p.source_note = '출처 Kalshi'; const r = renderChartPanel(p); assert.match(r.svg, />출처 Kalshi</); assert.doesNotMatch(r.svg, /관측일| · 출처/); });
await test('nonfinite data is rejected', async () => { const p = fixture('line.json'); p.series[0].points[0][1] = NaN; assert.throws(() => renderChartPanel(p), /finite/); });
await test('duplicate time is rejected, not silently chosen', async () => { const p = fixture('line.json'); p.series[0].points[1][0] = 1; assert.throws(() => renderChartPanel(p), /strictly increasing/); });
await test('clipping explicit axis rejected', async () => { const p = fixture('line.json'); p.y.max = 100; assert.throws(() => renderChartPanel(p), /excludes/); });
await test('old line renderer still exports deterministic output', async () => { const p = fixture('line.json'); assert.equal(sha256(renderChart(p)), 'sha256:053617f360c6f7d269db1e8324252aba439b79b4b7c9a22081c501b578ceb3a3'); });
await test('report surface composes at explicit 16:9 without importing brand', async () => { const p = clone(base); p.profiles = { surface: 'report-deck', artifact: 'visual/slide-image' }; p.task.canvas = { width: 1920, aspect_ratio: '16:9' }; const r = await compile(p); assert.equal(r.canvas.height, 1080); assert.equal(r.theme.foreground, base.task.theme.foreground); });
await test('site evidence uses the same binding without changing facts', async () => { const p = clone(dataPlan); p.profiles.surface = 'suengj-com'; const r = await compile(p); assert.equal(r.layers[1].sha256, sha256(readFileSync(resolve(dir, 'line.json')))); });
await test('incompatible report/card combination rejected', async () => { const p = clone(base); p.profiles.surface = 'report-deck'; await reject(p, 'PROFILE_MISMATCH'); });
await test('explicit conflicting geometry rejected', async () => { const p = clone(base); p.task.canvas = { width: 1080, height: 1000, aspect_ratio: '1:1' }; await reject(p, 'INVALID_GEOMETRY'); });
await test('supplied cutout actually renders', async () => { const p = clone(photo); p.layers[0].ref = 'cutout.png'; p.layers[0].mode = 'cutout_composite'; const r = await run(p, 'cutout'); assert.equal(r.receipt.images[0].mode, 'cutout_composite'); });
await test('negative comparison retains zero and labels', async () => { const p = fixture('bar.json'); p.series[0].points[0][1] = -125; const r = renderChartPanel(p); assert.equal(r.axis.ymin, -125); assert.equal(r.displayed[0].value, -125); });
await test('premium number visuals render bound values, grid, gradient area and branches', async () => {
  const theme = { background: '#F7F5F0', foreground: '#14213D', accent: '#FF6B5B' };
  const specs = [
    { type:'number_visual', layout:'comparison-bars', title:'가격 비교', source_note:'brief', items:[{label:'10월',value:15,value_label:'15%'},{label:'12월',value:81,value_label:'81%'}] },
    { type:'number_visual', layout:'dot-grid', title:'가격', source_note:'brief', total:100,filled:81,value_label:'81% · 81¢',caption:'100칸 중 81칸' },
    { type:'number_visual', layout:'trend-area', title:'일주일 흐름', source_note:'brief', start:90,start_label:'90%',start_date:'10.14',end:81,end_label:'81%',end_date:'10.21' },
    { type:'number_visual', layout:'dual-metric', title:'물가와 고용', source_note:'brief', items:[{label:'CPI',value:0.6,max:1,value_label:'0.6%'},{label:'고용',value:29000,max:50000,value_label:'29,000명'}] },
    { type:'number_visual', layout:'rate-gap-ratio', title:'금리와 흐름', source_note:'brief', rates:[{label:'미국',value:4},{label:'한국',value:3}],ratio:{outflow:129.4,inflow:50.4,outflow_label:'해외 129.4',inflow_label:'유입 50.4',caption:'USD bn'} },
    { type:'number_visual', layout:'scenario-split', title:'회의 시나리오', source_note:'brief', date:'10.28',scenarios:[{label:'동결'},{label:'인상'}] },
  ];
  const results = specs.map((spec) => renderChartPanel(spec,{width:950,height:648,theme}));
  assert.equal(results[0].displayed.map(x=>x.value).join(','),'15,81');
  const fullScaleBars=renderChartPanel({...specs[0],items:[{label:'A',value:100,value_label:'100%'},{label:'B',value:0,value_label:'0%'}]},{width:950,height:648,theme});
  assert.match(fullScaleBars.svg,/text-anchor="end"/);
  assert.equal(results[1].displayed[0].filled,81);
  assert.match(results[2].svg,/linearGradient/);
  assert.match(results[2].svg,/ C /);
  assert.deepEqual(results[2].displayed[0],{start:90,start_label:'90%',start_date:'10.14',end:81,end_label:'81%',end_date:'10.21',point_count:2,delta_label:null});
  assert.deepEqual(results[3].displayed.map(x=>x.value_label),['0.6%','29,000명']);
  assert.equal(results[4].displayed.at(-1).gap,'1.00%p');
  assert.equal(results[4].displayed.at(-1).ratio,'2.5:1');
  assert.deepEqual(results[5].displayed.map(x=>x.scenario),['동결','인상']);
  const explicitScale={hero_size:150,label_size:34,body_size:36,chip_size:34,hero_weight:800,label_weight:500,body_weight:500,chip_weight:700};
  const fixedDual=renderChartPanel({...specs[3],typography:explicitScale},{width:936,height:793,theme});
  assert.equal([...fixedDual.svg.matchAll(/font-size="([0-9.]+)"/g)].map((m)=>Number(m[1])).filter((n)=>n===150).length,2);
  assert.equal([...fixedDual.svg.matchAll(/font-size="([0-9.]+)"/g)].map((m)=>Number(m[1])).filter((n)=>n===34).length,2);
  assert.match(fixedDual.svg,/font-size="34\.00" font-weight="500"[^>]*>CPI/);
  assert.match(fixedDual.svg,/font-size="150\.00" font-weight="800"[^>]*>0\.6%/);
  assert.match(fixedDual.svg,/font-size="150\.00" font-weight="800"[^>]*>29,000명/);
  assert.match(results[3].svg,/font-size="147\.78"/);
  const fixedRates=renderChartPanel({...specs[4],typography:explicitScale},{width:936,height:793,theme});
  assert.match(fixedRates.svg,/font-size="34\.00" font-weight="700"[^>]*>금리차 1\.00%p/);
  assert.match(fixedRates.svg,/font-size="34\.00" font-weight="500"[^>]*>미국/);
  assert.match(fixedRates.svg,/font-size="34\.00" font-weight="500"[^>]*>4\.00%/);
});
await test('explicit height is not lost to an inherited preset ratio', async () => { const p = clone(base); p.task.canvas = { height: 900 }; const r = await compile(p, { preset: { canvas: { width: 1080, aspect_ratio: '1:1' } } }); assert.equal(r.canvas.height, 900); });
await test('height plus ratio derives width', async () => { const p = clone(base); p.task.canvas = { height: 900, aspect_ratio: '1:1' }; const r = await compile(p); assert.equal(r.canvas.width, 900); });
console.log(JSON.stringify({ passed, output_dir: dir, renderer: adapter.version, native_generation: 'NOT_RUN_PHASE4', real_photo_UAT: 'NOT_RUN_PHASE4', live_PMC: 'NOT_RUN', ci: 'NOT_RUN' }));
