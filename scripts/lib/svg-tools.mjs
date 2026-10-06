/** Small local SVG adapter; no downloads, image-model calls, or publication. */
import { spawnSync } from 'node:child_process';
import { decodePng, encodePng, FONT_STACK } from './watermark-core.mjs';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const svgDocument = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;

export function findRasterizer(preferred = 'auto') {
  if (!['auto', 'rsvg', 'magick'].includes(preferred)) throw new Error('unknown rasterizer');
  const candidates = preferred === 'auto' ? ['rsvg', 'magick'] : [preferred];
  for (const name of candidates) {
    const command = name === 'rsvg' ? 'rsvg-convert' : 'magick';
    const v = spawnSync(command, [name === 'rsvg' ? '--version' : '-version'], { encoding: 'utf8', timeout: 5000 });
    if (v.status !== 0) continue;
    if (name === 'magick') {
      const f = spawnSync(command, ['-list', 'format'], { encoding: 'utf8', timeout: 5000 });
      if (!/^\s*RSVG\*?\s/m.test(f.stdout ?? '')) continue;
    }
    return { name, command, version: v.stdout.trim().split('\n')[0],
      args: name === 'rsvg' ? ['-f', 'png'] : ['-background', 'none', 'RSVG:-', '-depth', '8', 'PNG32:-'] };
  }
  return null;
}

export function rasterize(svg, adapter) {
  if (!adapter) throw new Error('RASTERIZER_REQUIRED: rsvg-convert or ImageMagick with RSVG support');
  const result = spawnSync(adapter.command, adapter.args, { input: svg, maxBuffer: 256 * 1024 * 1024, timeout: 30000 });
  if (result.error || result.status !== 0) throw new Error(`RASTERIZER_FAILED: ${result.error?.message ?? result.stderr.toString()}`);
  // Normalize our generated build product, not the source asset. ImageMagick
  // adds wall-clock date chunks; those must not break deterministic replay.
  const img = decodePng(result.stdout);
  for (const key of Object.keys(img.text)) if (key.startsWith('date:')) delete img.text[key];
  return encodePng(img);
}

export function pixelBounds(png) {
  const img = decodePng(png); let x0 = img.width, x1 = -1, y0 = img.height, y1 = -1;
  if (img.channels !== 4) throw new Error('measurement rasterizer must preserve alpha');
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.pixels[(y * img.width + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  return x1 < 0 ? { x: 0, y: 0, width: 0, height: 0 } : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** Actual glyph measurements, not an English character-count proxy for Korean. */
export function textMeasurer(adapter, family = FONT_STACK) {
  const cache = new Map();
  return (text, size, weight = 400) => {
    const key = JSON.stringify([text, size, weight]);
    if (cache.has(key)) return cache.get(key);
    if (!text.trim()) return 0;
    const w = Math.ceil(Math.max(128, [...text].length * size * 2 + 2 * size));
    if (w > 32768) throw new Error('TEXT_OVERFLOW: split the text before rendering');
    const svg = svgDocument(w, Math.ceil(size * 4), `<text x="${size}" y="${size * 2}" font-family="${esc(family)}" font-size="${size}" font-weight="${weight}">${esc(text)}</text>`);
    const b = pixelBounds(rasterize(svg, adapter));
    const width = b.width + Math.max(0, b.x - size);
    cache.set(key, width); return width;
  };
}

export function wrapText(text, { width, size, weight = 400, maxLines, lineHeight = 1.25, height }, measure) {
  if (typeof text !== 'string' || text.length > 2000) throw new Error('TEXT_OVERFLOW: expected text up to 2000 characters');
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    // Space-separated words stay together; overlong tokens break by grapheme.
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size, weight) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      if (measure(word, size, weight) <= width) { line = word; continue; }
      for (const { segment } of new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(word)) {
        if (measure(line + segment, size, weight) > width) {
          if (!line) throw new Error('TEXT_OVERFLOW: a glyph cannot fit');
          lines.push(line); line = segment;
        } else line += segment;
      }
    }
    lines.push(line);
  }
  if (lines.length > maxLines || lines.length * size * lineHeight > height) {
    throw new Error(`TEXT_OVERFLOW: ${lines.length} lines do not fit; re-layout, explicitly move support to caption, or split frames. Text was not truncated.`);
  }
  return lines;
}
