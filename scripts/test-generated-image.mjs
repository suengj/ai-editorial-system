#!/usr/bin/env node
/**
 * SUE-1426 R2: image-generation honesty. Real local rsvg rendering, no API calls.
 * A generated layer is only success with real evidence + a non-placeholder asset that is visible in the final PNG.
 * Also: repair budget (1 base + 1 local fix) and byte-identical preservation of untouched frames.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, copyFileSync, existsSync } from 'node:fs';
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
const placeholder = png(() => [200, 120, 40]);
const fourColours = png((x, y) => [[200, 120, 40], [20, 60, 200], [240, 240, 20], [30, 160, 90]][(x >> 3) % 2 + 2 * ((y >> 3) % 2)]);                     // basic-shape / flat fill
const invisible = png((x, y) => [(x * 7) % 256, (y * 5) % 256, (x ^ y) % 256], 0); // rich colours but fully transparent
writeFileSync(resolve(input, 'rich.png'), rich); writeFileSync(resolve(input, 'flat.png'), placeholder); writeFileSync(resolve(input, 'four.png'), fourColours); writeFileSync(resolve(input, 'clear.png'), invisible);
const respBytes = Buffer.from('{"id":"inv-1","provider":"claude-native-image"}\n'); writeFileSync(resolve(input, 'response.json'), respBytes);
const ev = (file, bytes, mode = 'native') => ({ provider: 'claude-native-image', model: 'test-model', invocation_id: 'inv-1', mode, asset_sha256: sha256(bytes), response_ref: 'response.json', response_sha256: sha256(respBytes) });
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
  assert(rc.generation[0].not_verified_reasons.some((x) => /near-flat|placeholder/.test(x)));
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

// SUE-1426 S5: generation evidence is SELF_ATTESTED; response file, flat-art attestation, image-layer laundering, rejected/ output.
await ok('S5: success is labelled SELF_ATTESTED; only asset_in_final_png is machine-verified', async () => {
  const r = await run(series({ ref: 'rich.png', generation: ev('rich.png', rich) }), 's5-ok');
  const rc = JSON.parse(readFileSync(resolve(root, 's5-ok/opening/receipt.json'), 'utf8'));
  assert.equal(rc.generation[0].evidence_level, 'SELF_ATTESTED'); assert.deepEqual(rc.generation[0].machine_verified, ['asset_in_final_png']);
  assert.equal(rc.generation[0].response_sha256, sha256(respBytes)); assert.equal(r.frames[0].status, GENERATED_OK);
});
await ok('S5: missing, wrong-sha or absent provider response file is GENERATION_NOT_VERIFIED', async () => {
  const noResp = { ...ev('rich.png', rich) }; delete noResp.response_ref; delete noResp.response_sha256;
  assert.equal((await run(series({ ref: 'rich.png', generation: noResp }), 's5-noresp')).frames[0].status, GENERATION_NOT_VERIFIED);
  assert.equal((await run(series({ ref: 'rich.png', generation: { ...ev('rich.png', rich), response_sha256: 'sha256:00' } }), 's5-badresp')).frames[0].status, GENERATION_NOT_VERIFIED);
  assert.equal((await run(series({ ref: 'rich.png', generation: { ...ev('rich.png', rich), response_ref: 'nope.json' } }), 's5-gone')).frames[0].status, GENERATION_NOT_VERIFIED);
});
await ok('S5/review2: near-flat (3-6 colour) art passes only with an owner|agent attestation; agent must name request_ref', async () => {
  const g = ev('four.png', fourColours);
  assert.equal((await run(series({ ref: 'four.png', generation: g }), 's5-flat0')).frames[0].status, GENERATION_NOT_VERIFIED);
  assert.equal((await run(series({ ref: 'four.png', generation: { ...g, flat_art_attestation: { by: 'robot', reason: 'intentionally flat poster' } } }), 's5-flat1')).frames[0].status, GENERATION_NOT_VERIFIED);
  assert.equal((await run(series({ ref: 'four.png', generation: { ...g, flat_art_attestation: { by: 'agent', reason: 'intentionally flat poster' } } }), 's5-flat1b')).frames[0].status, GENERATION_NOT_VERIFIED, 'agent without request_ref');
  const a = await run(series({ ref: 'four.png', generation: { ...g, flat_art_attestation: { by: 'agent', reason: 'intentionally flat poster', request_ref: 'brief.json#slide-1' } } }), 's5-flat1c');
  assert.notEqual(a.frames[0].status, GENERATION_NOT_VERIFIED);
  const r = await run(series({ ref: 'four.png', generation: { ...g, flat_art_attestation: { by: 'owner', reason: 'intentionally flat poster' } } }), 's5-flat2');
  const rc = JSON.parse(readFileSync(resolve(root, 's5-flat2/opening/receipt.json'), 'utf8'));
  assert.equal(rc.generation[0].flat_art_attestation.by, 'owner'); assert.notEqual(r.frames[0].status, GENERATION_NOT_VERIFIED);
});
await ok('review2 #14: a single-colour asset is never a generated-image success, even with an attestation', async () => {
  const g = ev('flat.png', placeholder);
  for (const att of [{ by: 'owner', reason: 'intentionally flat poster' }, { by: 'agent', reason: 'intentionally flat poster', request_ref: 'brief.json#1' }])
    assert.equal((await run(series({ ref: 'flat.png', generation: { ...g, flat_art_attestation: att } }), `s14-${att.by}`)).frames[0].status, GENERATION_NOT_VERIFIED, att.by);
});
await ok('S5: a kind:"image" layer that says it is generated gets the same checks', async () => {
  const mk = (extra) => { const s = series({ ref: 'rich.png' }); const b = s.frames[0].blocks[0]; b.kind = 'image'; delete b.instruction; delete b.generation; Object.assign(b, extra); return s; };
  assert.equal((await run(mk({ provenance: { origin: 'generated' } }), 's5-img1')).frames[0].status, GENERATION_NOT_VERIFIED);
  assert.equal((await run(mk({ rights_note: 'AI generated with a provider' }), 's5-img2')).frames[0].status, GENERATION_NOT_VERIFIED);
  assert.equal((await run(mk({ provenance: { origin: 'generated' }, generation: ev('rich.png', rich) }), 's5-img3')).frames[0].status, GENERATED_OK);
});
await ok('S5: failed outputs live under rejected/; no success-looking PNG at the top level', async () => {
  await run(series({ ref: 'flat.png', generation: ev('flat.png', placeholder) }), 's5-rej');
  const d = resolve(root, 's5-rej/opening');
  assert(!existsSync(resolve(d, 'image.png')) && !existsSync(resolve(d, 'master.png')));
  assert(existsSync(resolve(d, 'rejected/image.png')) && existsSync(resolve(d, 'receipt.json')));
  const rc = JSON.parse(readFileSync(resolve(d, 'receipt.json'), 'utf8')); assert.match(rc.outputs.image.ref, /^rejected\//);
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
