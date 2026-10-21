#!/usr/bin/env node
/** SUE-1614. Synthetic typography tests: font bundle, balanced wrap, scale, emphasis, contrast/scrim, chrome tokens, render. */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as T from './lib/typography-core.mjs';
import { resolveChrome, verifyChromeText } from './lib/chrome-tokens.mjs';
import { executeVisual } from './lib/visual-execution-core.mjs';
import { encodePng } from './lib/watermark-core.mjs';
import { findRasterizer, isolatedEnv } from './lib/svg-tools.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, skipped = 0;
const ok = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const code = (c) => (e) => e.code === c;
const mono = (t, z) => [...t].length * z * 0.6; // synthetic measurer

// --- font bundle
await ok('bundle ships OFL licence, 4 weights, files exist', () => {
  const m = T.fontManifest(); assert.deepEqual(m.weights, [400, 600, 800, 900]);
  for (const f of Object.values(m.files)) assert(existsSync(resolve(T.FONT_DIR, f)));
  assert(/SIL OPEN FONT LICENSE/i.test(readFileSync(resolve(T.FONT_DIR, 'LICENSE-OFL.txt'), 'utf8')));
});
await ok('RFN: font binaries carry no Pretendard name (credits/trademark notices excepted)', () => {
  const m = T.fontManifest();
  for (const f of Object.values(m.files)) {
    const buf = readFileSync(resolve(T.FONT_DIR, f));
    for (const [label, needle, dec] of [['ascii', Buffer.from('pretendard'), 'latin1'], ['utf16', Buffer.from('pretendard', 'utf16le').swap16(), 'utf16le']]) {
      const hay = Buffer.from(buf.toString('latin1').toLowerCase(), 'latin1'), hayU = label === 'utf16' ? hay : hay;
      let i = -1;
      while ((i = hayU.indexOf(needle, i + 1)) >= 0) {
        const ctx = label === 'ascii' ? buf.subarray(i, i + 220).toString('latin1') : buf.subarray(i, i + 440).swap16 ? Buffer.from(buf.subarray(i, i + 440)).swap16().toString('utf16le') : '';
        assert(/Kil Hyung-jin|Rasmus|orioncactus|trademark/i.test(ctx), `${f}: Pretendard name outside a credit near byte ${i}`);
      }
    }
    assert(!buf.subarray(0, 4096).toString('latin1').toLowerCase().includes('pretendard-'), `${f}: CFF font name`);
    assert(buf.includes(Buffer.from(f.replace('.otf', ''))), `${f}: AESSansKR CFF/PostScript name missing`);
  }
});
await ok('unsupported weight -> FONT_FALLBACK', () => assert.throws(() => T.assertFontCoverage('가나', 700), code('FONT_FALLBACK')));
await ok('glyph outside subset -> FONT_FALLBACK', () => assert.throws(() => T.assertFontCoverage('뷁', 800), code('FONT_FALLBACK')));
await ok('covered Korean/ASCII passes', () => T.assertFontCoverage('돈이 되는 자리 100% “OK”', 900));
await ok('bundled font only when first in stack', () => { assert(T.requestsBundledFont("'AES Sans KR', sans-serif")); assert(!T.requestsBundledFont("'Noto Sans KR', 'AES Sans KR'")); });
// --- balanced wrap
await ok('no orphan last line, balanced', () => {
  const t = '이번 분기 사업 아이디어 중 가장 돈이 되는 자리를 찾아라 지금';
  const lines = T.balancedWrap(t, { width: 300, size: 20, maxLines: 4 }, mono);
  assert(!T.hasOrphan(lines)); assert.equal(lines.join(' '), t);
  const w = lines.map((l) => mono(l, 20)); assert(Math.max(...w) - Math.min(...w) < 140, JSON.stringify(lines));
});
await ok('greedy would orphan; balanced does not (one-char tail)', () => {
  const t = '가나다라마 바사아자차 카타파하 거';
  const lines = T.balancedWrap(t, { width: 6 * 20 * 0.6 * 2 - 1, size: 20, maxLines: 5 }, mono);
  assert(!T.hasOrphan(lines), JSON.stringify(lines));
});
await ok('breaks only at spaces; number+unit stay together', () => {
  const lines = T.balancedWrap('매출 1,200 억 돌파 가능성이 크다', { width: 190, size: 20, maxLines: 4 }, mono);
  assert(lines.every((l) => !l.endsWith('1,200')), JSON.stringify(lines));
});
await ok('overflow is an error, text never truncated', () => assert.throws(() => T.balancedWrap('가'.repeat(5) + ' ' + '나'.repeat(40), { width: 100, size: 20, maxLines: 1 }, mono), code('TEXT_OVERFLOW')));
await ok('over-wide eojeol falls back to grapheme split', () => assert(T.balancedWrap('가'.repeat(30), { width: 120, size: 20, maxLines: 6 }, mono).length > 1));
await ok('emphasis measured at its heavier weight', () => {
  const t = '돈이 되는 자리를 찾아라', em = T.locateEmphasis(t, [{ match: '돈이 되는 자리', weight: 900 }]);
  const m = (s, z, w) => [...s].length * z * (w >= 800 ? 0.8 : 0.5);
  const lines = T.balancedWrap(t, { width: 7 * 20 * 0.8 + 5, size: 20, weight: 400, maxLines: 4, emphasis: em }, m);
  assert(lines.length >= 2 && lines.join(' ') === t);
});
await ok('emphasis not in text -> EMPHASIS_NOT_FOUND', () => assert.throws(() => T.locateEmphasis('abc', [{ match: 'zzz' }]), code('EMPHASIS_NOT_FOUND')));
await ok('punctuation normalisation', () => assert.equal(T.normalizeKoreanText('"안녕"...좋다,정말'), '“안녕”…좋다, 정말'));
await ok('type scale roles + override + unknown role', () => {
  assert(T.TYPE_SCALE.display.font_size > T.TYPE_SCALE.headline.font_size && T.TYPE_SCALE.headline.font_size > T.TYPE_SCALE.dek.font_size && T.TYPE_SCALE.dek.font_size > T.TYPE_SCALE.body.font_size);
  assert(T.TYPE_SCALE.display.line_height < T.TYPE_SCALE.body.line_height && T.TYPE_SCALE.display.letter_spacing < 0);
  assert.equal(T.resolveScale('body', { font_size: 40 }).font_size, 40); assert.throws(() => T.resolveScale('nope'), code('TYPE_SCALE_ROLE'));
});
await ok('WCAG maths', () => { assert.equal(T.contrastRatio([0, 0, 0], [255, 255, 255]).toFixed(1), '21.0'); assert(T.contrastRatio([255, 255, 255], [255, 255, 255]) === 1); });
await ok('autoScrimOpacity: 0 on dark, >0 on bright, null when impossible', () => {
  const W = [255, 255, 255], K = [11, 24, 36];
  assert.equal(T.autoScrimOpacity([20, 20, 20], W, K, 4.5), 0);
  const a = T.autoScrimOpacity([240, 240, 240], W, K, 4.5); assert(a > 0.3 && a < 0.92);
  assert.equal(T.autoScrimOpacity([240, 240, 240], W, [250, 250, 250], 4.5), null);
});
// --- chrome tokens
const catalog = { accounts: { acctA: { chrome: { brand_label: 'ALPHA LAB', handle: '@alpha_syn', kicker: { default: 'IDEA', instagram: 'IDEA 노트' } } }, acctB: { chrome: { brand_label: 'BETA WORKS', handle: '@beta_syn' } } } };
await ok('chrome priority request > series > profile > default', () => {
  const r = resolveChrome({ target: 'acctA', channel: 'instagram', request: { kicker: 'REQ' }, series: { handle: '@series' }, catalog, defaults: { cta_policy: 'none' } });
  assert.deepEqual([r.values.kicker, r.values.handle, r.values.brand_label, r.values.cta_policy], ['REQ', '@series', 'ALPHA LAB', 'none']);
  assert.deepEqual([r.sources.kicker, r.sources.handle, r.sources.brand_label, r.sources.cta_policy], ['request', 'series', 'target_profile', 'default']);
  assert.equal(resolveChrome({ target: 'acctA', channel: 'instagram', catalog }).values.kicker, 'IDEA 노트');
});
await ok('unresolved required label -> UNRESOLVED_LABEL (no hard-coded brand)', () => {
  assert.throws(() => resolveChrome({ target: 'acctA', catalog: { accounts: { acctA: { chrome: {} } } } }), code('UNRESOLVED_LABEL'));
  assert.throws(() => resolveChrome({ target: 'ghost', catalog }), code('UNKNOWN_TARGET'));
});
await ok('account isolation: other account literal rejected', () => {
  assert.throws(() => resolveChrome({ target: 'acctA', series: { brand_label: 'BETA WORKS' }, catalog }), code('ACCOUNT_LEAK'));
  assert.throws(() => resolveChrome({ target: 'acctB', request: { footer_source_format: 'via @alpha_syn' }, catalog, required: [] }), code('ACCOUNT_LEAK'));
});
await ok('ACCOUNT_LEAK is token-bounded: no false positive on longer words', () => {
  assert.equal(resolveChrome({ target: 'acctA', series: { disclaimer_set: 'BETA WORKSHOP notes' }, catalog, required: [] }).values.disclaimer_set, 'BETA WORKSHOP notes');
  assert.throws(() => resolveChrome({ target: 'acctA', series: { disclaimer_set: 'by BETA WORKS.' }, catalog, required: [] }), code('ACCOUNT_LEAK'));
});
await ok('font digest covers bytes; env isolates FONTCONFIG_*', () => {
  assert(/^sha256:[0-9a-f]{64}$/.test(T.bundledFontDigest()));
  process.env.FONTCONFIG_SYSROOT = '/evil'; const e = isolatedEnv(T.bundledFontEnv()); delete process.env.FONTCONFIG_SYSROOT;
  assert(!('FONTCONFIG_SYSROOT' in e) && e.FONTCONFIG_FILE && e.FONTCONFIG_PATH);
  assert.throws(() => isolatedEnv({ FONTCONFIG_FILE: 'x' }));
});
await ok('verifyChromeText compares printed vs resolved', () => {
  const r = resolveChrome({ target: 'acctA', catalog }); assert(verifyChromeText(r, { brand_label: 'ALPHA LAB' }));
  assert.throws(() => verifyChromeText(r, { brand_label: 'OTHER' }), code('UNRESOLVED_LABEL'));
});

// --- render (needs rsvg + fc)
const adapter = findRasterizer('auto');
if (!adapter) { skipped++; console.log('SKIP render tests: no rasterizer'); } else {
  const dir = mkdtempSync(resolve(tmpdir(), 'typo-'));
  const W = 1080, H = 1350, px = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 3, v = 200 + Math.round(40 * (1 - y / H)); px[o] = v; px[o + 1] = v - 10; px[o + 2] = v - 30; }
  const png = encodePng({ width: W, height: H, channels: 3, pixels: px });
  writeFileSync(resolve(dir, 'photo.png'), png); writeFileSync(resolve(dir, 'src.md'), 'synthetic source\n');
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  const mk = (layers) => ({ schema_version: '1.0.0', request: '합성 타이포 테스트', source: { ref: 'src.md', scope: 'illustrative' }, profiles: { surface: 'instagram', artifact: 'visual/slide-image' }, task: { canvas: { width: W, aspect_ratio: '4:5' }, watermark: { enabled: false }, theme: { font_family: "'AES Sans KR', sans-serif" } }, layers });
  const photo = { id: 'photo', kind: 'image', ref: 'photo.png', fit: 'cover', rights_note: 'synthetic', focal_box: { x: 0, y: 0, width: 1, height: 1 }, focal_min_area_ratio: 0.9, slot: { x: 0, y: 0, width: 1, height: 1 } };
  const head = (extra = {}) => ({ id: 'headline', kind: 'text', text: '이번 분기 가장 돈이 되는 자리를 찾아라', source_ref: 'request', slot: { x: 0.06, y: 0.6, width: 0.88, height: 0.25 }, font_size: 96, weight: 800, line_height: 1.14, max_lines: 3, color: '#FFFFFF', ...extra });
  const out = (n) => resolve(dir, n);
  await ok('render: bundled font, balanced, emphasis, auto scrim -> contrast PASS', async () => {
    const r = await executeVisual(mk([photo, { id: 'scrim', kind: 'solid', color: '#0B1824', slot: { x: 0, y: 0.5, width: 1, height: 0.5 }, auto_scrim: { for: ['headline'], target_contrast: 4.5 } },
      head({ balance: true, letter_spacing: -0.025, optical_margin: true, min_contrast: 4.5, emphasis: [{ match: '돈이 되는 자리', weight: 900, color: '#FFD479' }] })]), { baseDir: dir, outDir: out('ok') });
    assert.equal(r.receipt.checks.contrast, 'PASS'); assert(r.receipt.checks.auto_scrim[0].opacity > 0.3);
    assert.equal(r.receipt.text[0].orphan, false); assert.equal(r.receipt.text[0].lines.join(' '), r.receipt.text[0].text);
  });
  await ok('render: no scrim on bright photo -> CONTRAST_FAIL', async () => {
    await assert.rejects(executeVisual(mk([photo, head({ min_contrast: 4.5 })]), { baseDir: dir, outDir: out('bad') }), code('CONTRAST_FAIL'));
  });
  await ok('render: weight 700 on bundled font -> FONT_FALLBACK', async () => {
    await assert.rejects(executeVisual(mk([photo, head({ balance: true, weight: 700 })]), { baseDir: dir, outDir: out('fb') }), code('FONT_FALLBACK'));
  });
  await ok('render: glyph outside subset -> FONT_FALLBACK', async () => {
    await assert.rejects(executeVisual(mk([photo, head({ balance: true, text: '뷁 테스트' })]), { baseDir: dir, outDir: out('fb2') }), code('FONT_FALLBACK'));
  });
  await ok('render: legacy text layers are byte-identical to the old path', async () => {
    const p = mk([photo, { ...head(), weight: 700 }]); p.task.theme = {};
    const a = await executeVisual(p, { baseDir: dir, outDir: out('legacyA') }), b = await executeVisual(structuredClone(p), { baseDir: dir, outDir: out('legacyB') });
    assert.equal(a.receipt.outputs.image.sha256, b.receipt.outputs.image.sha256); assert.equal(a.receipt.checks.contrast, 'NOT_APPLICABLE');
  });
  await ok('render: deterministic with bundled fonts', async () => {
    const p = mk([photo, head({ balance: true, weight: 900 })]);
    const a = await executeVisual(p, { baseDir: dir, outDir: out('d1') }), b = await executeVisual(structuredClone(p), { baseDir: dir, outDir: out('d2') });
    assert.equal(a.receipt.outputs.image.sha256, b.receipt.outputs.image.sha256);
  });
}
console.log(`typography: ${passed} passed, ${skipped} skipped`);
