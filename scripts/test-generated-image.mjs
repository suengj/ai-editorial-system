#!/usr/bin/env node
/**
 * SUE-1426 R2: image-generation honesty. Real local rsvg rendering, no API calls.
 * A generated layer is only success with real evidence + a non-placeholder asset that is visible in the final PNG.
 * Also: repair budget (1 base + 1 local fix) and byte-identical preservation of untouched frames.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { executeCarousel } from './lib/carousel-core.mjs';
import { executeVisual, GENERATED_OK, GENERATION_NOT_VERIFIED, GENERATED_NOT_USED, RENDER_OK } from './lib/visual-execution-core.mjs';
import { encodePng, sha256 } from './lib/watermark-core.mjs';
import { findRasterizer } from './lib/svg-tools.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), FIX = resolve(HERE, 'fixtures/carousel');
const base = JSON.parse(readFileSync(resolve(FIX, 'series.json'), 'utf8'));
let passed = 0, failed = 0;
const ok = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); } };
if (!findRasterizer()) { console.log('NOT_RUN: no local SVG rasterizer'); process.exit(0); }

const root = mkdtempSync(resolve(tmpdir(), 'aes-genimg-')), input = resolve(root, 'input'); mkdirSync(input);
for (const f of ['source.md', 'counts.json']) copyFileSync(resolve(FIX, f), resolve(input, f));
const png = (fn, alpha = 255) => { const w = 240, h = 240, p = Buffer.alloc(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4, [r, g, b] = fn(x, y); p[o] = r; p[o + 1] = g; p[o + 2] = b; p[o + 3] = alpha; } return encodePng({ width: w, height: h, channels: 4, pixels: p }); };
const rich = png((x, y) => [(x * 7 + y * 3) % 256, (x * 2 + y * 11) % 256, (x ^ y) % 256]);
const placeholder = png(() => [200, 120, 40]);                     // basic-shape / flat fill
const invisible = png((x, y) => [(x * 7) % 256, (y * 5) % 256, (x ^ y) % 256], 0); // rich colours but fully transparent
writeFileSync(resolve(input, 'rich.png'), rich); writeFileSync(resolve(input, 'flat.png'), placeholder); writeFileSync(resolve(input, 'clear.png'), invisible);
const ev = (file, bytes, mode = 'native') => ({ provider: 'claude-native-image', model: 'test-model', invocation_id: 'inv-1', mode, asset_sha256: sha256(bytes) });
const series = (block) => { const s = structuredClone(base); s.frames[0].layout = 'visual'; s.frames[0].blocks = [{ id: 'art', region: 'content', kind: 'generated', instruction: 'One quiet paper sculpture.', rights_note: 'Test asset authored for this test.', fit: 'cover', ...block }]; return s; };
const run = (s, dir, previousDir = null) => executeCarousel(s, { baseDir: input, outDir: resolve(root, dir), previousDir });

await ok('prompt/JSON only (no asset bytes) is RENDER_REQUIRED, not success', async () => {
  const r = await run(series({ ref: undefined }), 'json-only');
  assert.equal(r.status, 'INCOMPLETE'); assert.equal(r.frames[0].status, 'RENDER_REQUIRED');
});
await ok('flat basic-shape placeholder with "real" evidence is GENERATION_NOT_VERIFIED', async () => {
  const r = await run(series({ ref: 'flat.png', generation: ev('flat.png', placeholder) }), 'flat');
  assert.equal(r.frames[0].status, GENERATION_NOT_VERIFIED); assert.equal(r.status, 'INCOMPLETE');
  const rc = JSON.parse(readFileSync(resolve(root, 'flat/opening/receipt.json'), 'utf8'));
  assert(rc.generation[0].not_verified_reasons.some((x) => /placeholder/.test(x)));
});
await ok('mock mode is never generation success even with a rich asset', async () => {
  const r = await run(series({ ref: 'rich.png', generation: ev('rich.png', rich, 'mock') }), 'mock');
  assert.equal(r.frames[0].status, GENERATION_NOT_VERIFIED);
});
await ok('missing evidence and a sha mismatch are not success', async () => {
  assert.equal((await run(series({ ref: 'rich.png' }), 'noev')).frames[0].status, GENERATION_NOT_VERIFIED);
  assert.equal((await run(series({ ref: 'rich.png', generation: { ...ev('rich.png', rich), asset_sha256: 'sha256:00' } }), 'badsha')).frames[0].status, GENERATION_NOT_VERIFIED);
});
await ok('an asset that does not change the final pixels is GENERATED_ASSET_NOT_USED', async () => {
  const r = await run(series({ ref: 'clear.png', generation: ev('clear.png', invisible) }), 'clear');
  assert.equal(r.frames[0].status, GENERATED_NOT_USED);
});
let good;
await ok('real-evidence rich asset is GENERATED_COMPOSED_NEEDS_REVIEW and the asset is measurably in the final PNG', async () => {
  good = await run(series({ ref: 'rich.png', generation: ev('rich.png', rich) }), 'good');
  assert.equal(good.status, GENERATED_OK); assert.equal(good.frames[0].status, GENERATED_OK);
  const rc = JSON.parse(readFileSync(resolve(root, 'good/opening/receipt.json'), 'utf8'));
  assert.equal(rc.generation[0].asset_in_final_png, true); assert(rc.generation[0].consumed_ratio > 0.5);
  assert.equal(rc.publication_authorized, false); assert.equal(rc.api_calls, 0);
});
await ok('deterministic chart/diagram frames keep RENDERED_NEEDS_REVIEW', async () => {
  const r = await run(structuredClone(base), 'plain'); assert.equal(r.status, RENDER_OK);
});

// Repair budget + preservation. Base = 'good'. Fix 1 edits only the closing frame text.
const fix = series({ ref: 'rich.png', generation: ev('rich.png', rich) }); fix.frames[2].headline = '바뀐 부분만\n다시 처리합니다';
const hashes = (r) => r.frames.map((f) => f.outputs['image.png'].sha256);
let fixed;
await ok('local fix 1: only the edited frame is re-rendered; untouched frames and the original dir are byte-identical', async () => {
  const before = ['opening', 'evidence', 'closing'].map((id) => sha256(readFileSync(resolve(root, 'good', id, 'image.png'))));
  fixed = await run(fix, 'fix1', resolve(root, 'good'));
  assert.equal(fixed.repair_round, 1); assert.deepEqual(fixed.repaired_frames, ['closing']);
  assert.deepEqual(fixed.frames.map((f) => f.reused), [true, true, false]);
  const after = hashes(fixed);
  assert.equal(after[0], before[0]); assert.equal(after[1], before[1]); assert.notEqual(after[2], before[2]);
  assert.equal(sha256(readFileSync(resolve(root, 'good/closing/image.png'))), before[2], 'previous version was modified');
  assert.equal(fixed.frames[0].status, GENERATED_OK);
});
await ok('a re-run with no change does not spend the repair budget', async () => {
  const same = await run(fix, 'fix1-same', resolve(root, 'fix1')); assert.equal(same.repair_round, 1);
});
await ok('a second local fix is refused (REPAIR_LIMIT) before any file is written', async () => {
  const again = structuredClone(fix); again.frames[1].headline = '숫자는\n원자료대로';
  await assert.rejects(run(again, 'fix2', resolve(root, 'fix1')), (e) => e.code === 'REPAIR_LIMIT');
  assert.throws(() => readFileSync(resolve(root, 'fix2/series.json')));
});
await ok('single-image executor: repairOf allows one repair and refuses the second', async () => {
  const plan = JSON.parse(readFileSync(resolve(HERE, 'fixtures/visual-execution/card.json'), 'utf8'));
  for (const f of ['source.md']) copyFileSync(resolve(HERE, 'fixtures/visual-execution', f), resolve(input, 'v-' + f));
  plan.source.ref = 'v-source.md'; plan.layers.forEach((l) => { if (l.source_ref) l.source_ref = 'v-source.md'; });
  const a = await executeVisual(plan, { baseDir: input, outDir: resolve(root, 'v0') });
  assert.equal(a.receipt.repair_round, 0);
  const b = await executeVisual(plan, { baseDir: input, outDir: resolve(root, 'v1'), repairOf: resolve(root, 'v0') });
  assert.equal(b.receipt.repair_round, 1);
  await assert.rejects(executeVisual(plan, { baseDir: input, outDir: resolve(root, 'v2'), repairOf: resolve(root, 'v1') }), (e) => e.code === 'REPAIR_LIMIT');
});
console.log(`ARTIFACT_DIR ${root}\ngenerated-image: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
