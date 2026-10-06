/**
 * Optional, default-OFF watermark overlay — AES-VISUAL (SUE-1303).
 *
 * This is a post-process on an already-flattened PNG, not a service, engine, or
 * DRM. It extends the existing RenderSpec/brand-profile visual contract
 * (`schemas/render-spec.schema.json#/$defs/watermark`) and honours the existing
 * rule that recurring brand/domain text is a deterministic overlay and is never
 * redrawn by an image model (editorial/IMAGE-TEXT-RENDERING-PROFILES.md §6).
 *
 * Guarantees:
 *   - OFF (the default) returns the master bytes unchanged. Nothing is encoded.
 *   - ON always starts from the clean master and yields a SEPARATE derivative
 *     plus lineage (master sha256, config, renderer). The master is never
 *     overwritten, and a derivative is refused as input, so a rerun cannot
 *     stack a second overlay.
 *   - 0 API/LLM calls. Glyph coverage comes from the system SVG rasteriser
 *     (rsvg-convert, with an explicit Korean/Latin font stack); compositing is
 *     plain integer-rounded alpha blending in this file.
 *   - A watermark that would touch a declared exclusion zone or leave the safe
 *     margins fails closed: no derivative is produced.
 *
 * It is a low-opacity overlay on a flattened PNG. It deters casual reuse; it
 * does not prevent copying and is not a security control.
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { deflateSync, inflateSync } from 'node:zlib';

export const WATERMARK_TOOL = 'aes-watermark-composite';
export const WATERMARK_TOOL_VERSION = '1.0.0';
export const WATERMARK_CHUNK_KEY = 'aes-watermark';

/** Korean-first stack with Latin fallbacks. Order matters; see docs. */
export const FONT_STACK = "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const DEFAULT_WATERMARK = Object.freeze({
  enabled: false,
  text: 'suengj.com',
  color: '#9CA3AF',
  opacity: 0.08,
  placement: 'lower-center',
  scale: 0.03,
  safe_margins: Object.freeze({ bottom: 0.05, left: 0.05, right: 0.05 }),
  exclusion_zones: Object.freeze([]),
});

export const PLACEMENTS = Object.freeze(['lower-center', 'lower-left', 'lower-right']);

export class WatermarkError extends Error {
  constructor(code, message) { super(message); this.name = 'WatermarkError'; this.code = code; }
}

export const sha256 = (buf) => `sha256:${createHash('sha256').update(buf).digest('hex')}`;

/**
 * Resolve config layers lowest to highest precedence, e.g.
 * [brandProfile.watermark_default, renderSpec.watermark, channelOverride].
 * Nested safe_margins merge per key; exclusion_zones accumulate across layers.
 */
export function resolveWatermark(...layers) {
  const out = { ...DEFAULT_WATERMARK, safe_margins: { ...DEFAULT_WATERMARK.safe_margins }, exclusion_zones: [] };
  for (const layer of layers) {
    if (!layer) continue;
    for (const [k, v] of Object.entries(layer)) {
      if (k === 'safe_margins') out.safe_margins = { ...out.safe_margins, ...v };
      else if (k === 'exclusion_zones') out.exclusion_zones.push(...v.map((z) => ({ ...z })));
      else out[k] = v;
    }
  }
  const errs = validateWatermark(out);
  if (errs.length) throw new WatermarkError('invalid-config', errs.join('; '));
  return out;
}

export function validateWatermark(w) {
  const e = [];
  if (typeof w.enabled !== 'boolean') e.push('enabled must be boolean');
  if (typeof w.text !== 'string' || w.text.length < 1 || w.text.length > 40 || /[\r\n<>&"]/.test(w.text)) e.push('text must be 1-40 chars without newline or markup characters');
  if (!/^#[0-9A-Fa-f]{6}$/.test(w.color)) e.push('color must be #RRGGBB');
  if (!(typeof w.opacity === 'number' && w.opacity >= 0.02 && w.opacity <= 0.3)) e.push('opacity must be within 0.02..0.30 (low-opacity overlay)');
  if (!PLACEMENTS.includes(w.placement)) e.push(`placement must be one of ${PLACEMENTS.join(', ')} (diagonal is not allowed: it crosses content)`);
  if (!(typeof w.scale === 'number' && w.scale >= 0.01 && w.scale <= 0.06)) e.push('scale (font size as a fraction of image width) must be within 0.01..0.06');
  for (const k of ['bottom', 'left', 'right']) {
    const m = w.safe_margins?.[k];
    if (!(typeof m === 'number' && m >= 0 && m <= 0.4)) e.push(`safe_margins.${k} must be within 0..0.4`);
  }
  for (const [i, z] of (w.exclusion_zones ?? []).entries()) {
    const ok = ['x', 'y', 'width', 'height'].every((k) => typeof z[k] === 'number' && z[k] >= 0 && z[k] <= 1) && z.width > 0 && z.height > 0 && z.x + z.width <= 1.0000001 && z.y + z.height <= 1.0000001;
    if (!ok) e.push(`exclusion_zones[${i}] needs fractional x,y,width,height inside the image`);
  }
  return e;
}

// ---------------------------------------------------------------- PNG codec

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new WatermarkError('not-png', 'input is not a PNG');
  let off = 8; let ihdr = null; const idat = []; const text = {}; const keep = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'tEXt') { const i = data.indexOf(0); text[data.toString('latin1', 0, i)] = data.toString('utf8', i + 1); }
    else if (['sRGB', 'gAMA', 'iCCP', 'pHYs', 'cHRM'].includes(type)) keep.push(buf.subarray(off, off + 12 + len));
    off += 12 + len;
  }
  const width = ihdr.readUInt32BE(0); const height = ihdr.readUInt32BE(4);
  const depth = ihdr[8]; const ctype = ihdr[9]; const interlace = ihdr[12];
  if (depth !== 8 || (ctype !== 2 && ctype !== 6) || interlace !== 0) throw new WatermarkError('unsupported-png', 'only non-interlaced 8-bit RGB/RGBA PNG is supported');
  const bpp = ctype === 6 ? 4 : 3; const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat)); const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]; const src = y * (stride + 1) + 1; const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0; const b = y ? px[dst - stride + x] : 0; const c = x >= bpp && y ? px[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + x] = v & 255;
    }
  }
  return { width, height, channels: bpp, pixels: px, text, keep };
}

export function encodePng({ width, height, channels, pixels, keep = [], text = {} }) {
  const stride = width * channels; const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = channels === 4 ? 6 : 2;
  const texts = Object.entries(text).map(([k, v]) => chunk('tEXt', Buffer.concat([Buffer.from(k, 'latin1'), Buffer.from([0]), Buffer.from(v, 'utf8')])));
  return Buffer.concat([SIG, chunk('IHDR', ihdr), ...keep, ...texts, chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ----------------------------------------------------------- glyph coverage

export function rasterizerVersion() {
  const r = spawnSync('rsvg-convert', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Text -> SVG, exposed so tests can assert the exact string and size. */
export function watermarkSvg(cfg, width, height) {
  const size = Math.round(cfg.scale * width);
  const baseline = Math.round(height - cfg.safe_margins.bottom * height);
  const [anchor, x] = cfg.placement === 'lower-center' ? ['middle', Math.round(width / 2)]
    : cfg.placement === 'lower-left' ? ['start', Math.round(cfg.safe_margins.left * width)]
      : ['end', Math.round(width - cfg.safe_margins.right * width)];
  return {
    size, baseline, anchor, x,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="${x}" y="${baseline}" text-anchor="${anchor}" font-family="${FONT_STACK}" font-size="${size}" font-weight="500" letter-spacing="${(size * 0.04).toFixed(2)}" fill="#000000">${cfg.text}</text></svg>`,
  };
}

/** Coverage mask (0..255) at full canvas size, plus its exact bounding box. */
export function glyphMask(cfg, width, height, rasterizer = null) {
  const { svg, size } = watermarkSvg(cfg, width, height);
  const r = rasterizer ? { status: 0, stdout: rasterizer.render(svg) }
    : spawnSync('rsvg-convert', ['-f', 'png'], { input: svg, maxBuffer: 256 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new WatermarkError('rasterizer-unavailable', `rsvg-convert is required for glyph compositing: ${r.error?.message ?? r.stderr}`);
  const img = decodePng(r.stdout);
  const mask = Buffer.alloc(width * height); let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const a = img.channels === 4 ? img.pixels[(y * width + x) * 4 + 3] : 0;
    if (a) { mask[y * width + x] = a; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new WatermarkError('empty-glyphs', 'text rendered no pixels');
  return { mask, bbox: { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }, fontSize: size };
}

// ---------------------------------------------------------------- composite

/**
 * @returns {{applied:false, bytes:Buffer, status:'off'} | {applied:true, bytes:Buffer, status:'marked', lineage:object}}
 */
export function applyWatermark(masterBytes, config, { masterRef = null, rasterizer = null } = {}) {
  if (rasterizer && (typeof rasterizer.render !== 'function' || !rasterizer.version)) throw new WatermarkError('invalid-rasterizer', 'adapter needs render(svg) and a runtime version');
  const cfg = typeof config.enabled === 'boolean' && config.safe_margins && config.color ? config : resolveWatermark(config);
  const errs = validateWatermark(cfg);
  if (errs.length) throw new WatermarkError('invalid-config', errs.join('; '));
  if (!cfg.enabled) return { applied: false, status: 'off', bytes: masterBytes };

  const img = decodePng(masterBytes);
  if (img.text[WATERMARK_CHUNK_KEY]) throw new WatermarkError('input-is-derivative', 'input already carries a watermark lineage chunk; supply the clean master, never a derivative');
  const { width, height, channels, pixels } = img;
  const { mask, bbox, fontSize } = glyphMask(cfg, width, height, rasterizer);

  const m = cfg.safe_margins;
  const inSafe = bbox.x >= Math.floor(m.left * width) && bbox.x + bbox.width <= Math.ceil(width - m.right * width) && bbox.y + bbox.height <= Math.ceil(height - m.bottom * height * 0.5);
  if (!inSafe) throw new WatermarkError('outside-safe-margins', `watermark box ${JSON.stringify(bbox)} leaves the safe margins`);
  for (const z of cfg.exclusion_zones) {
    const zx = z.x * width, zy = z.y * height, zw = z.width * width, zh = z.height * height;
    if (bbox.x < zx + zw && bbox.x + bbox.width > zx && bbox.y < zy + zh && bbox.y + bbox.height > zy) {
      throw new WatermarkError('exclusion-zone', `watermark box ${JSON.stringify(bbox)} overlaps exclusion zone ${z.zone_id ?? JSON.stringify(z)}; no derivative produced`);
    }
  }

  const rgb = [1, 3, 5].map((i) => parseInt(cfg.color.slice(i, i + 2), 16));
  const out = Buffer.from(pixels);
  for (let y = bbox.y; y < bbox.y + bbox.height; y++) for (let x = bbox.x; x < bbox.x + bbox.width; x++) {
    const cov = mask[y * width + x]; if (!cov) continue;
    const a = (cov / 255) * cfg.opacity; const o = (y * width + x) * channels;
    for (let c = 0; c < 3; c++) out[o + c] = Math.round(out[o + c] + (rgb[c] - out[o + c]) * a);
  }

  const masterSha = sha256(masterBytes);
  const meta = { master_sha256: masterSha, text: cfg.text, color: cfg.color.toUpperCase(), opacity: cfg.opacity };
  const bytes = encodePng({ width, height, channels, pixels: out, keep: img.keep, text: { ...img.text, [WATERMARK_CHUNK_KEY]: JSON.stringify(meta) } });
  return {
    applied: true, status: 'marked', bytes,
    lineage: {
      schema_version: '1.0.0', kind: 'watermark_derivative',
      master_ref: masterRef, master_sha256: masterSha, derivative_sha256: sha256(bytes),
      watermark: { text: cfg.text, color: cfg.color.toUpperCase(), opacity: cfg.opacity, placement: cfg.placement, scale: cfg.scale, font_size_px: fontSize, safe_margins: cfg.safe_margins, exclusion_zones: cfg.exclusion_zones, bbox_px: bbox },
      geometry: { width, height },
      renderer: { tool: WATERMARK_TOOL, tool_version: WATERMARK_TOOL_VERSION, glyph_rasterizer: rasterizer?.version ?? rasterizerVersion(), font_stack: FONT_STACK },
      api_calls: 0,
      limits: 'low-opacity overlay on a flattened PNG; deters reuse, does not prevent copying',
    },
  };
}
