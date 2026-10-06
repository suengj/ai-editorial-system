#!/usr/bin/env node
/** SUE-1303 watermark profile tests. 0 API/LLM calls. Set WATERMARK_SAMPLE_DIR to also write sample PNGs. */
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, mkdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRenderSpec } from './lib/visual-job-core.mjs';
import {
  applyWatermark, resolveWatermark, watermarkSvg, glyphMask, decodePng, encodePng, rasterizerVersion,
  sha256, FONT_STACK, WATERMARK_CHUNK_KEY, WatermarkError,
} from './lib/watermark-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = resolve(ROOT, 'scripts/fixtures/watermark');
let bad = 0;
const ok = (n, v, d = '') => { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && d ? ` — ${d}` : ''}`); if (!v) bad++; };
const throwsCode = (fn, code) => { try { fn(); return false; } catch (e) { return e instanceof WatermarkError && e.code === code; } };
const tmp = mkdtempSync(join(tmpdir(), 'aes-wm-'));
const sampleDir = process.env.WATERMARK_SAMPLE_DIR;
if (sampleDir) mkdirSync(sampleDir, { recursive: true });

// ---- schema / profile / config layering (no rasteriser needed)
const spec = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/render-spec-body-infographic-hybrid-v2.example.json'), 'utf8'));
const sample = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/watermark-suengj-com-sample.example.json'), 'utf8')).watermark;
ok('RenderSpec example (no watermark) still validates', validateRenderSpec(spec).length === 0);
ok('sample profile is OFF with the approved first sample', sample.enabled === false && sample.text === 'suengj.com' && sample.color === '#9CA3AF' && sample.opacity === 0.08 && sample.placement === 'lower-center');
ok('resolved default (no layers) is OFF', resolveWatermark().enabled === false);
const withWm = (w) => ({ ...JSON.parse(JSON.stringify(spec)), watermark: w });
const brandWm = sample;
ok('RenderSpec accepts the sample watermark block', validateRenderSpec(withWm(brandWm)).length === 0);
ok('RenderSpec accepts a partial channel override', validateRenderSpec(withWm({ enabled: true, text: '수엥제이', opacity: 0.1 })).length === 0);
ok('RenderSpec rejects opacity 0.9', validateRenderSpec(withWm({ opacity: 0.9 })).length > 0);
ok('RenderSpec rejects diagonal placement', validateRenderSpec(withWm({ placement: 'diagonal' })).length > 0);
ok('RenderSpec rejects unknown watermark field', validateRenderSpec(withWm({ engine: 'x' })).length > 0);
const layered = resolveWatermark(brandWm, { enabled: true }, { text: 'channel.example', safe_margins: { bottom: 0.12 } });
ok('account/channel override wins; unspecified fields inherit', layered.enabled && layered.text === 'channel.example' && layered.opacity === 0.08 && layered.safe_margins.bottom === 0.12 && layered.safe_margins.left === 0.05);
ok('invalid resolved config is refused', throwsCode(() => resolveWatermark({ opacity: 0.9 }), 'invalid-config') && throwsCode(() => resolveWatermark({ placement: 'diagonal' }), 'invalid-config'));
const core = readFileSync(resolve(ROOT, 'scripts/lib/watermark-core.mjs'), 'utf8') + readFileSync(resolve(ROOT, 'scripts/watermark.mjs'), 'utf8');
ok('0 API/LLM calls: no network or provider imports', !/fetch\(|node:https?|node:net|openai|anthropic|gemini/i.test(core.replace(/^\s*\*.*$/gm, '')));

if (!rasterizerVersion()) {
  console.log('SKIP pixel tests: rsvg-convert not found (required for glyph compositing)');
  rmSync(tmp, { recursive: true, force: true });
  process.exit(bad ? 1 : 0);
}

// ---- solid master for exact opacity/size checks
const W = 1080, H = 1350;
const solid = (r, g, b) => { const px = Buffer.alloc(W * H * 3); for (let i = 0; i < W * H; i++) { px[i * 3] = r; px[i * 3 + 1] = g; px[i * 3 + 2] = b; } return encodePng({ width: W, height: H, channels: 3, pixels: px }); };
const master = solid(255, 255, 255);
const masterHash = sha256(master);

// OFF is a no-op
const off = applyWatermark(master, resolveWatermark());
ok('OFF: not applied, bytes are identical (same buffer content)', off.applied === false && Buffer.compare(off.bytes, master) === 0 && sha256(off.bytes) === masterHash);
const offEnabledFalse = applyWatermark(master, resolveWatermark({ enabled: false, text: 'ignored', opacity: 0.3 }));
ok('OFF with a fully specified config is still byte-identical', Buffer.compare(offEnabledFalse.bytes, master) === 0);
const cli = (...a) => spawnSync('node', [resolve(ROOT, 'scripts/watermark.mjs'), ...a], { encoding: 'utf8' });
writeFileSync(join(tmp, 'master.png'), master);
const cliOff = cli('--master', join(tmp, 'master.png'), '--out', join(tmp, 'never.png'));
ok('OFF CLI writes no derivative', cliOff.status === 0 && /off/.test(cliOff.stdout) && !existsSync(join(tmp, 'never.png')));

// ON: exact text, opacity, size
const cfg = resolveWatermark({ enabled: true });
const sv = watermarkSvg(cfg, W, H);
ok('ON: SVG carries the exact text and Korean+Latin font stack', sv.svg.includes('>suengj.com</text>') && sv.svg.includes('fill="#000000"') && sv.svg.includes("'Apple SD Gothic Neo'") && sv.svg.includes('Helvetica'));
const on = applyWatermark(master, cfg, { masterRef: 'master.png' });
const L = on.lineage;
ok('ON: lineage records master hash, separate derivative hash, 0 API calls', on.applied && L.master_sha256 === masterHash && L.derivative_sha256 === sha256(on.bytes) && L.derivative_sha256 !== masterHash && L.api_calls === 0 && L.master_ref === 'master.png');
ok('ON: lineage records exact text, color, opacity, size', L.watermark.text === 'suengj.com' && L.watermark.color === '#9CA3AF' && L.watermark.opacity === 0.08 && L.watermark.font_size_px === Math.round(0.03 * W));
const d = decodePng(on.bytes); const m0 = decodePng(master);
ok('ON: geometry unchanged', d.width === W && d.height === H && d.channels === 3);
let changed = 0, maxDelta = 0, outside = 0; const b = L.watermark.bbox_px;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 3; let diff = 0;
  for (let c = 0; c < 3; c++) diff = Math.max(diff, Math.abs(d.pixels[o + c] - m0.pixels[o + c]));
  if (diff) { changed++; maxDelta = Math.max(maxDelta, diff); if (x < b.x || x >= b.x + b.width || y < b.y || y >= b.y + b.height) outside++; }
}
// white bg, #9CA3AF: the red channel (0x9C=156) moves furthest: 255 -> 255 - 0.08*(255-156) = 247.08 -> delta 8 at full coverage
const expectedMax = Math.round(0.08 * (255 - 0x9c));
ok('ON: max pixel delta equals opacity x (bg - color) at full coverage', maxDelta === expectedMax, `maxDelta=${maxDelta} expected=${expectedMax}`);
ok('ON: only pixels inside the reported glyph box changed', changed > 200 && outside === 0, `changed=${changed} outside=${outside}`);
const gm = glyphMask(cfg, W, H);
ok('ON: size — glyph box height tracks scale and box is horizontally centred', Math.abs(gm.bbox.x + gm.bbox.width / 2 - W / 2) <= 2 && gm.bbox.height >= 0.5 * gm.fontSize && gm.bbox.height <= 1.2 * gm.fontSize && gm.bbox.width < 0.25 * W, JSON.stringify(gm.bbox));
const big = applyWatermark(master, resolveWatermark({ enabled: true, scale: 0.05 }));
ok('ON: scale changes size monotonically', big.lineage.watermark.bbox_px.width > b.width && big.lineage.watermark.font_size_px === Math.round(0.05 * W));
const hi = applyWatermark(master, resolveWatermark({ enabled: true, opacity: 0.2 }));
const hid = decodePng(hi.bytes); let hmax = 0; for (let i = 0; i < hid.pixels.length; i++) hmax = Math.max(hmax, Math.abs(hid.pixels[i] - m0.pixels[i]));
ok('ON: opacity is honoured exactly at 0.20', hmax === Math.round(0.2 * (255 - 0x9c)), `hmax=${hmax}`);

// rerun: never stacks, never touches the master
const again = applyWatermark(master, cfg, { masterRef: 'master.png' });
ok('rerun from the master is byte-identical (deterministic, no stacking)', Buffer.compare(again.bytes, on.bytes) === 0);
ok('derivative input is refused (cannot stack a second overlay)', throwsCode(() => applyWatermark(on.bytes, cfg), 'input-is-derivative'));
ok('derivative carries master-hash lineage chunk', JSON.parse(decodePng(on.bytes).text[WATERMARK_CHUNK_KEY]).master_sha256 === masterHash);
ok('master bytes untouched in memory', sha256(master) === masterHash);
const out = join(tmp, 'master.marked.png');
const c1 = cli('--master', join(tmp, 'master.png'), '--enable', '--out', out);
const h1 = sha256(readFileSync(out));
const c2 = cli('--master', join(tmp, 'master.png'), '--enable', '--out', out);
ok('CLI ON twice: same derivative hash, master on disk unchanged', c1.status === 0 && c2.status === 0 && sha256(readFileSync(out)) === h1 && sha256(readFileSync(join(tmp, 'master.png'))) === masterHash, c1.stderr + c2.stderr);
ok('CLI writes lineage sidecar', JSON.parse(readFileSync(`${out}.lineage.json`, 'utf8')).master_sha256 === masterHash);
ok('CLI refuses to overwrite the master', cli('--master', join(tmp, 'master.png'), '--enable', '--out', join(tmp, 'master.png')).status !== 0 && sha256(readFileSync(join(tmp, 'master.png'))) === masterHash);
ok('CLI refuses a derivative as --master', cli('--master', out, '--enable', '--out', join(tmp, 'x.png')).status !== 0);

// Korean / Latin fallback
const ko = glyphMask(resolveWatermark({ enabled: true, text: '한' }), W, H).mask;
const ko2 = glyphMask(resolveWatermark({ enabled: true, text: '글' }), W, H).mask;
ok('Korean fallback: distinct Hangul glyphs rasterise distinctly (not identical tofu boxes)', Buffer.compare(ko, ko2) !== 0);
const mixed = glyphMask(resolveWatermark({ enabled: true, text: '수엥제이 suengj.com' }), W, H);
const latinOnly = glyphMask(resolveWatermark({ enabled: true, text: 'suengj.com' }), W, H);
ok('Korean + Latin mixed string renders, wider than Latin alone, within the safe width', mixed.bbox.width > latinOnly.bbox.width && mixed.bbox.width < 0.9 * W);
ok('font stack lists Korean faces before Latin faces', FONT_STACK.indexOf('Apple SD Gothic Neo') < FONT_STACK.indexOf('Helvetica') && FONT_STACK.indexOf('Noto Sans CJK KR') < FONT_STACK.indexOf('Inter'));

// 4:5 and 9:16 crop/readability samples with declared exclusion zones
const renderFixture = (name) => { const r = spawnSync('rsvg-convert', ['-f', 'png', join(FIX, `${name}.svg`)]); if (r.status) throw new Error(r.stderr.toString()); return r.stdout; };
const cases = [
  { name: 'master-4x5', w: 1080, h: 1350, over: { safe_margins: { bottom: 0.05 }, exclusion_zones: [
    { zone_id: 'chart-and-numbers', x: 0.1, y: 0.2, width: 0.82, height: 0.6 }, { zone_id: 'source-small-text', x: 0.05, y: 0.87, width: 0.9, height: 0.05 }] } },
  { name: 'master-9x16', w: 1080, h: 1920, over: { safe_margins: { bottom: 0.12 }, exclusion_zones: [
    { zone_id: 'chart-and-numbers', x: 0.1, y: 0.28, width: 0.82, height: 0.42 }, { zone_id: 'source-small-text', x: 0.05, y: 0.885, width: 0.9, height: 0.03 }] } },
];
for (const c of cases) {
  const png = renderFixture(c.name); const img = decodePng(png);
  ok(`${c.name}: fixture geometry ${c.w}x${c.h}`, img.width === c.w && img.height === c.h);
  const res = applyWatermark(png, resolveWatermark({ enabled: true }, c.over));
  const bb = res.lineage.watermark.bbox_px; const dd = decodePng(res.bytes);
  let touched = 0;
  for (const z of c.over.exclusion_zones) {
    for (let y = Math.floor(z.y * c.h); y < Math.ceil((z.y + z.height) * c.h); y++) for (let x = Math.floor(z.x * c.w); x < Math.ceil((z.x + z.width) * c.w); x++) {
      const o = (y * c.w + x) * 3; if (dd.pixels[o] !== img.pixels[o] || dd.pixels[o + 1] !== img.pixels[o + 1] || dd.pixels[o + 2] !== img.pixels[o + 2]) touched++;
    }
  }
  ok(`${c.name}: no pixel inside the exclusion zones (numbers, chart, small text) changed`, touched === 0, `touched=${touched}`);
  ok(`${c.name}: lower-center and inside the bottom safe margin`, Math.abs(bb.x + bb.width / 2 - c.w / 2) <= 2 && bb.y + bb.height <= c.h - c.over.safe_margins.bottom * c.h * 0.5, JSON.stringify(bb));
  // crop robustness: a centred 1:1 / feed crop would cut it; a bottom-anchored crop keeps it. Documented, asserted on geometry only.
  const squareBottom = Math.round((c.h - c.w) + 0); // top of a bottom-anchored 1:1 crop
  ok(`${c.name}: a bottom-anchored 1:1 crop keeps the whole watermark`, bb.y >= squareBottom);
  const collide = { exclusion_zones: [{ zone_id: 'forced-over-wm', x: 0.3, y: (bb.y - 4) / c.h, width: 0.4, height: (bb.height + 8) / c.h }] };
  ok(`${c.name}: a declared zone over the watermark fails closed (no derivative)`, throwsCode(() => applyWatermark(png, resolveWatermark({ enabled: true }, c.over, collide)), 'exclusion-zone'));
  ok(`${c.name}: side margins narrower than the box fail closed`, throwsCode(() => applyWatermark(png, resolveWatermark({ enabled: true, scale: 0.06, safe_margins: { left: 0.4, right: 0.4 } })), 'outside-safe-margins'));
  if (sampleDir) {
    writeFileSync(join(sampleDir, `${c.name}.clean.png`), png);
    writeFileSync(join(sampleDir, `${c.name}.marked-0.08.png`), res.bytes);
    writeFileSync(join(sampleDir, `${c.name}.marked-0.08.png.lineage.json`), `${JSON.stringify(res.lineage, null, 2)}\n`);
    const loud = applyWatermark(png, resolveWatermark({ enabled: true, opacity: 0.3 }, c.over));
    writeFileSync(join(sampleDir, `${c.name}.marked-0.30-visibility-aid.png`), loud.bytes);
  }
}

rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `\nwatermark: FAIL (${bad})` : '\nwatermark: PASS');
process.exit(bad ? 1 : 0);
