/**
 * Deterministic chart renderer — AES-P4.2 (SUE-453).
 *
 * Takes a chart spec and emits SVG. The spec is the artifact; the SVG is a
 * build product. Same spec plus same renderer version produces byte-identical
 * output, which is what makes an evidence visual regenerable rather than
 * merely re-rollable.
 *
 * It cannot invent data: every point comes from the spec, every series names
 * the claim it depicts, and the axis labels, units, and period are taken from
 * the spec rather than inferred.
 */

export const RENDERER_VERSION = '1.0.0';

const W = 720;
const H = 360;
const PAD = { top: 48, right: 24, bottom: 56, left: 64 };
const PLOT = { w: W - PAD.left - PAD.right, h: H - PAD.top - PAD.bottom };

/** Fixed precision so output does not depend on floating-point formatting. */
const n = (v) => Number(v).toFixed(2);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function validateChartSpec(spec) {
  const errors = [];
  const need = (cond, msg) => { if (!cond) errors.push(msg); };

  need(spec?.type === 'line', 'only type "line" is supported in this PoC');
  need(typeof spec?.title === 'string' && spec.title.length > 0, 'title is required');
  need(typeof spec?.period === 'string' && spec.period.length > 0, 'period is required — a chart without a time period is unreadable');
  need(typeof spec?.source_note === 'string' && spec.source_note.length > 0, 'source_note is required');
  need(spec?.x?.label, 'x.label is required');
  need(spec?.y?.label, 'y.label is required');
  need(typeof spec?.y?.unit === 'string', 'y.unit is required — an unlabelled axis invites misreading');
  need(Array.isArray(spec?.series) && spec.series.length > 0, 'at least one series is required');

  for (const [i, s] of (spec?.series ?? []).entries()) {
    need(s?.name, `series[${i}].name is required`);
    need(s?.claim, `series[${i}].claim is required — a plotted series must name the claim it depicts`);
    need(Array.isArray(s?.points) && s.points.length >= 2, `series[${i}] needs at least two points`);
    for (const [j, p] of (s?.points ?? []).entries()) {
      need(Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number'),
        `series[${i}].points[${j}] must be a numeric [x, y] pair`);
    }
  }
  return errors;
}

export function renderChart(spec) {
  const errors = validateChartSpec(spec);
  if (errors.length > 0) {
    throw new Error(`invalid chart spec: ${errors.join('; ')}`);
  }

  const xs = spec.series.flatMap((s) => s.points.map((p) => p[0]));
  const ys = spec.series.flatMap((s) => s.points.map((p) => p[1]));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = spec.y.min ?? Math.min(...ys);
  const yMax = spec.y.max ?? Math.max(...ys);

  const sx = (x) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * PLOT.w;
  const sy = (y) => PAD.top + PLOT.h - ((y - yMin) / (yMax - yMin || 1)) * PLOT.h;

  // Deliberately no colour values: series are distinguished by dash pattern
  // and an inline label, so the chart is readable without colour.
  const DASH = ['none', '6 4', '2 3', '10 4'];

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = PAD.top + PLOT.h - t * PLOT.h;
    const value = yMin + t * (yMax - yMin);
    return `  <line class="grid" x1="${n(PAD.left)}" y1="${n(y)}" x2="${n(PAD.left + PLOT.w)}" y2="${n(y)}"/>\n` +
           `  <text class="tick" x="${n(PAD.left - 8)}" y="${n(y + 4)}" text-anchor="end">${esc(value.toFixed(0))}${esc(spec.y.unit)}</text>`;
  }).join('\n');

  const seriesEls = spec.series.map((s, i) => {
    const d = s.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${n(sx(p[0]))},${n(sy(p[1]))}`).join(' ');
    const last = s.points[s.points.length - 1];
    return `  <path class="series" stroke-dasharray="${DASH[i % DASH.length]}" d="${d}"/>\n` +
           `  <text class="label" x="${n(sx(last[0]) + 6)}" y="${n(sy(last[1]) + 4)}">${esc(s.name)}</text>`;
  }).join('\n');

  const xTicks = [xMin, xMax].map((x) =>
    `  <text class="tick" x="${n(sx(x))}" y="${n(PAD.top + PLOT.h + 20)}" text-anchor="middle">${esc(String(x))}</text>`,
  ).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
  <title id="title">${esc(spec.title)}</title>
  <desc id="desc">${esc(spec.description ?? spec.title)} Period: ${esc(spec.period)}. Source: ${esc(spec.source_note)}</desc>
  <style>
    .grid { stroke: currentColor; stroke-opacity: 0.15; stroke-width: 1; }
    .axis { stroke: currentColor; stroke-opacity: 0.5; stroke-width: 1; }
    .series { fill: none; stroke: currentColor; stroke-width: 2; }
    text { font-family: Pretendard, system-ui, sans-serif; fill: currentColor; }
    .tick { font-size: 11px; fill-opacity: 0.7; }
    .label { font-size: 12px; }
    .heading { font-size: 15px; font-weight: 600; }
    .note { font-size: 11px; fill-opacity: 0.7; }
  </style>
  <text class="heading" x="${n(PAD.left)}" y="24">${esc(spec.title)}</text>
  <text class="note" x="${n(PAD.left)}" y="40">${esc(spec.period)} · ${esc(spec.y.label)}${spec.y.unit ? ` (${esc(spec.y.unit)})` : ''}</text>
${gridLines}
  <line class="axis" x1="${n(PAD.left)}" y1="${n(PAD.top + PLOT.h)}" x2="${n(PAD.left + PLOT.w)}" y2="${n(PAD.top + PLOT.h)}"/>
${xTicks}
${seriesEls}
  <text class="note" x="${n(PAD.left)}" y="${n(H - 12)}">${esc(spec.x.label)} · ${esc(spec.source_note)}</text>
</svg>
`;
}

/** Mermaid source for a structural visual. The source is the artifact. */
export function renderDiagram(spec) {
  if (spec?.type !== 'flow') throw new Error('only type "flow" is supported in this PoC');
  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) throw new Error('nodes are required');
  if (!Array.isArray(spec.edges)) throw new Error('edges are required');

  const ids = new Set(spec.nodes.map((n_) => n_.id));
  for (const e of spec.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) {
      throw new Error(`edge ${e.from}->${e.to} references an undeclared node`);
    }
  }

  const lines = [`%% ${spec.title}`, `%% source: ${spec.source_note}`, 'flowchart LR'];
  for (const node of spec.nodes) lines.push(`  ${node.id}["${node.label}"]`);
  for (const e of spec.edges) {
    lines.push(e.label ? `  ${e.from} -->|"${e.label}"| ${e.to}` : `  ${e.from} --> ${e.to}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * A chart depicts someone else's facts. Every series must name a claim the
 * article has actually verified — the strongest available guard against a
 * visual inventing numbers, categories, or a chronology.
 */
export function validateChartAgainstArticle(spec, article) {
  const errors = [];
  const verified = new Set(
    (article?.verification?.claims ?? [])
      .filter((c) => c.status === 'verified')
      .map((c) => c.claim_id),
  );
  for (const s of spec?.series ?? []) {
    if (!verified.has(s.claim)) {
      errors.push(`series "${s.name}" depicts claim "${s.claim}", which is not verified on the article`);
    }
  }
  return errors;
}

/**
 * Responsive composition binding (SUE-1336). The legacy renderChart output is
 * untouched. This bounded line/bar panel reads the SAME source spec shape;
 * it does not fetch markets, smooth observations, or own source authority.
 */
export const PANEL_RENDERER_VERSION = '1.0.0';
export function renderChartPanel(spec, { width = 900, height = 520, theme = {}, measure = null } = {}) {
  const fail = (m) => { throw new Error(`CHART_INVALID: ${m}`); };
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(spec) || !['line', 'bar'].includes(spec.type)) fail('supported types: line, bar');
  for (const k of ['title', 'period', 'source_note']) if (typeof spec[k] !== 'string' || !spec[k].trim()) fail(`${k} is required`);
  if (!spec.x?.label || !spec.y?.label || typeof spec.y.unit !== 'string') fail('axis labels and explicit unit are required');
  if (![width, height].every(Number.isFinite) || width < 400 || height < 260) fail('panel must be at least 400x260');
  if (!Array.isArray(spec.series) || !spec.series.length || spec.series.length > 4) fail('one to four series');
  if (spec.type === 'bar' && spec.series.length !== 1) fail('bar v1 supports one series; use a separate comparison panel');
  for (const s of spec.series) {
    if (!s.name || !s.claim || !Array.isArray(s.points) || !s.points.length) fail('series name, claim and observations required');
    let previous = -Infinity;
    for (const p of s.points) {
      if (!Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || (p[1] !== null && !Number.isFinite(p[1]))) fail('observations must be finite [x,y] pairs; null y denotes a gap');
      if (p[0] <= previous) fail('timestamps/x must be strictly increasing; resolve duplicates upstream without changing raw data');
      previous = p[0];
    }
    if (!s.points.some((p) => p[1] !== null)) fail('series has no observed values');
    if (spec.type === 'bar' && (s.points.length > 12 || s.points.some((p) => p[1] === null))) fail('bar v1 requires 1–12 observed categories');
  }
  const points = spec.series.flatMap((s) => s.points);
  const values = points.filter((p) => p[1] !== null).map((p) => p[1]);
  const xmin = Math.min(...points.map((p) => p[0])), xmax = Math.max(...points.map((p) => p[0]));
  const observedMin = Math.min(...values), observedMax = Math.max(...values);
  let ymin = spec.y.min ?? (spec.type === 'bar' ? Math.min(0, observedMin) : observedMin);
  let ymax = spec.y.max ?? (spec.type === 'bar' ? Math.max(0, observedMax) : observedMax);
  if (![ymin, ymax].every(Number.isFinite) || ymin > observedMin || ymax < observedMax || ymin > ymax) fail('axis excludes observations or has invalid bounds');
  if (ymin === ymax) {
    if (spec.y.min !== undefined || spec.y.max !== undefined) fail('explicit axis requires min < max');
    const pad = Math.max(1, Math.abs(ymin) * 0.05); ymin -= pad; ymax += pad;
  }
  if (spec.type === 'bar' && !(ymin <= 0 && ymax >= 0)) fail('bar axis must include zero');
  const decimals = spec.y.decimals ?? 2;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) fail('y.decimals must be 0–6');
  const fg = theme.foreground ?? '#222222', accent = theme.accent ?? fg;
  const font = theme.font_family ?? 'Noto Sans CJK KR, Pretendard, sans-serif';
  for (const color of [fg, accent]) if (!/^#[0-9a-f]{6}$/i.test(color)) fail('theme colors must be #RRGGBB');
  const fs = Math.max(16, Math.min(28, width / 36));
  const fmt = (v) => `${v.toFixed(decimals)}${spec.y.unit}`;
  const tw = (t) => measure ? measure(t, fs, 400) : [...String(t)].length * fs;
  const left = Math.max(78, Math.ceil(Math.max(tw(fmt(ymin)), tw(fmt(ymax))) + 18));
  const right = spec.type === 'line' ? Math.max(100, Math.ceil(Math.max(...spec.series.map((s) => tw(fmt(s.points.filter((p) => p[1] !== null).at(-1)[1])))) + 22)) : 26;
  const top = spec.type === 'bar' ? 100 : 78, bottom = spec.type === 'bar' ? 126 : 120, pw = width - left - right, ph = height - top - bottom;
  if (pw < width * 0.35 || ph < 80) fail('labels leave insufficient plot space; increase panel size or use another layout');
  const sx = (x) => left + (xmax === xmin ? pw / 2 : ((x - xmin) / (xmax - xmin)) * pw);
  const sy = (y) => top + ph - ((y - ymin) / (ymax - ymin)) * ph;
  const els = [];
  function text(t, x, y, { anchor = 'start', weight = 400, limit = width - x - 8 } = {}) {
    if (tw(t) > limit) fail(`text does not fit: ${t}; move full context to a caption, do not truncate`);
    els.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="${esc(font)}" font-size="${n(fs)}" font-weight="${weight}" fill="${fg}">${esc(t)}</text>`);
  }
  text(spec.title, left, 30, { weight: 600 });
  text(`${spec.period} · ${spec.y.label}`, left, 59);
  for (let i = 0; i <= 4; i++) {
    const v = ymin + (ymax - ymin) * i / 4, y = sy(v);
    els.push(`<line x1="${n(left)}" y1="${n(y)}" x2="${n(left + pw)}" y2="${n(y)}" stroke="${fg}" stroke-opacity="0.14"/>`);
    text(fmt(v), left - 10, y + fs * 0.32, { anchor: 'end', limit: left - 12 });
  }
  const tick = (x) => spec.x.tick_labels?.[String(x)] ?? String(x);
  const endpointYs = [];
  const displayed = [];
  for (const [i, s] of spec.series.entries()) {
    const actual = s.points.filter((p) => p[1] !== null);
    if (spec.type === 'line') {
      let open = false, d = '';
      for (const p of s.points) {
        if (p[1] === null) { open = false; continue; }
        d += `${open ? 'L' : 'M'}${n(sx(p[0]))},${n(sy(p[1]))} `; open = true;
        els.push(`<circle cx="${n(sx(p[0]))}" cy="${n(sy(p[1]))}" r="2.5" fill="${accent}"/>`);
      }
      els.push(`<path d="${d.trim()}" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="${['none', '7 4', '2 4', '10 3'][i]}"/>`);
      const last = actual.at(-1); let ly = sy(last[1]);
      while (endpointYs.some((y) => Math.abs(y - ly) < fs * 1.2)) ly += fs * 1.25;
      if (ly > top + ph + fs * 0.5) fail('endpoint labels collide; split series or increase height');
      endpointYs.push(ly);
      text(fmt(last[1]), left + pw + 10, ly + fs * 0.32, { limit: right - 12 });
      displayed.push({ series: s.name, endpoint: last, endpoint_label: fmt(last[1]), claim: s.claim });
    } else {
      const cell = pw / actual.length;
      for (const [j, p] of actual.entries()) {
        const x = left + cell * (j + 0.5), y = sy(p[1]), zero = sy(0);
        els.push(`<rect x="${n(x - cell * 0.28)}" y="${n(Math.min(y, zero))}" width="${n(cell * 0.56)}" height="${n(Math.abs(y - zero))}" fill="${accent}"/>`);
        text(fmt(p[1]), x, p[1] >= 0 ? y - 9 : y + fs + 4, { anchor: 'middle', limit: cell - 6 });
        text(tick(p[0]), x, top + ph + fs * 2.6 + 8, { anchor: 'middle', limit: cell - 6 });
        displayed.push({ category: tick(p[0]), value: p[1], label: fmt(p[1]), claim: s.claim });
      }
    }
  }
  if (spec.type === 'line') {
    text(tick(xmin), left, top + ph + fs + 8, { limit: pw / 2 });
    if (xmin !== xmax) text(tick(xmax), left + pw, top + ph + fs + 8, { anchor: 'end', limit: pw / 2 });
  }
  text(`${spec.x.label} · ${spec.source_note}`, left, height - 12);
  if (spec.series.length > 1) {
    let lx = left;
    for (const [i, s] of spec.series.entries()) {
      const need = tw(s.name) + 65;
      if (lx + need > width - 8) fail('legend does not fit; shorten names or split series');
      els.push(`<line x1="${n(lx)}" y1="${n(height - 50)}" x2="${n(lx + 32)}" y2="${n(height - 50)}" stroke="${accent}" stroke-width="3" stroke-dasharray="${['none', '7 4', '2 4', '10 3'][i]}"/>`);
      text(s.name, lx + 40, height - 44, { limit: need - 40 }); lx += need;
    }
  }
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(spec.title)}</title>${els.join('')}</svg>`,
    renderer: { tool: 'aes-chart-panel', version: PANEL_RENDERER_VERSION },
    axis: { xmin, xmax, ymin, ymax, unit: spec.y.unit, decimals },
    geometry: { width, height, plot: { x: left, y: top, width: pw, height: ph } },
    displayed, raw_observation_count: points.length,
    gap_policy: 'null observations break paths; no interpolation, forward-fill or synthetic baseline',
  };
}
