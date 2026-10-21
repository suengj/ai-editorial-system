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
const chartCaption = (spec) => spec.x?.show_label === false ? spec.source_note : `${spec.x.label} · ${spec.source_note}`;

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
  <text class="note" x="${n(PAD.left)}" y="${n(H - 12)}">${esc(chartCaption(spec))}</text>
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
 * untouched. Panels consume source-bound specs, do not fetch data, and never
 * own source authority.
 */
export const PANEL_RENDERER_VERSION = '1.2.0';
function renderFlowDiagramPanel(spec, { width = 900, height = 520, theme = {}, measure = null } = {}) {
  const fail = (message) => { throw new Error(`FLOW_INVALID: ${message}`); };
  if (![width, height].every(Number.isFinite) || width < 400 || height < 260) fail('panel must be at least 400x260');
  const expected = ['value', 'payment', 'revenue', 'cost'];
  if (!Array.isArray(spec.nodes) || spec.nodes.length !== 4 || spec.nodes.some((node, i) => node?.id !== expected[i] || typeof node.label !== 'string' || !node.label.trim() || typeof node.text !== 'string' || !node.text.trim())) fail('four ordered, labeled money fields are required');
  if (!Array.isArray(spec.edges) || spec.edges.length !== 1 || spec.edges[0]?.from !== 'value' || spec.edges[0]?.to !== 'payment') fail('only the declared value-to-payment relation is supported');
  const fg = theme.foreground ?? '#222222', accent = theme.accent ?? fg;
  for (const color of [fg, accent]) if (!/^#[0-9a-f]{6}$/i.test(color)) fail('theme colors must be #RRGGBB');
  const font = theme.font_family ?? 'Noto Sans CJK KR, Pretendard, sans-serif';
  const fs = Math.max(18, Math.min(26, width / 36));
  const labelSize = Math.round(fs * 0.86);
  const tw = (text) => measure ? measure(text, fs, 400) : [...String(text)].length * fs;
  const wrap = (text, maxWidth, maxLines) => {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (tw(candidate) <= maxWidth) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      if (tw(word) <= maxWidth) { line = word; continue; }
      for (const { segment } of new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(word)) {
        if (tw(line + segment) > maxWidth) { if (!line) fail('a glyph does not fit'); lines.push(line); line = segment; }
        else line += segment;
      }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) fail(`money text does not fit without truncation: ${text}`);
    return lines;
  };
  const padX = Math.max(26, Math.round(width * 0.035)), gap = Math.max(22, Math.round(width * 0.035));
  const nodeWidth = (width - padX * 2 - gap) / 2;
  const rowHeight = Math.min(Math.round(height * 0.36), 180), top = Math.round(height * 0.12), lower = height - rowHeight - Math.round(height * 0.12);
  const positions = [
    { x: padX, y: top }, { x: padX + nodeWidth + gap, y: top },
    { x: padX, y: lower }, { x: padX + nodeWidth + gap, y: lower },
  ];
  const els = [];
  for (const [i, node] of spec.nodes.entries()) {
    const p = positions[i], textLines = wrap(node.text, nodeWidth - 36, 3);
    if (textLines.length * fs * 1.25 + labelSize * 1.5 > rowHeight - 24) fail(`money text does not fit without truncation: ${node.text}`);
    els.push(`<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(nodeWidth)}" height="${rowHeight}" rx="4" fill="none" stroke="${i < 2 ? accent : fg}" stroke-width="2" stroke-opacity="0.8"/>`);
    els.push(`<text x="${n(p.x + 18)}" y="${n(p.y + labelSize + 16)}" font-family="${esc(font)}" font-size="${labelSize}" font-weight="600" fill="${fg}">${esc(node.label)}</text>`);
    els.push(`<text x="${n(p.x + 18)}" y="${n(p.y + labelSize + 28)}" font-family="${esc(font)}" font-size="${fs}" fill="${fg}">${textLines.map((line, j) => `<tspan x="${n(p.x + 18)}" y="${n(p.y + labelSize + 28 + (j + 1) * fs * 1.25)}">${esc(line)}</tspan>`).join('')}</text>`);
  }
  const from = positions[0], to = positions[1], y = from.y + rowHeight / 2;
  els.push(`<defs><marker id="flow-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${accent}"/></marker></defs>`);
  els.push(`<line x1="${n(from.x + nodeWidth + 3)}" y1="${n(y)}" x2="${n(to.x - 7)}" y2="${n(y)}" stroke="${accent}" stroke-width="3" marker-end="url(#flow-arrow)"/>`);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${els.join('')}</svg>`, displayed: spec.nodes.map(n_ => ({ id: n_.id, label: n_.label, text: n_.text })), edges: structuredClone(spec.edges), renderer_version: PANEL_RENDERER_VERSION };
}

export function renderChartPanel(spec, { width = 900, height = 520, theme = {}, measure = null } = {}) {
  const fail = (m) => { throw new Error(`CHART_INVALID: ${m}`); };
  const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!obj(spec) || !['line', 'bar', 'flow', 'number_visual'].includes(spec.type)) fail('supported types: line, bar, flow, number_visual');
  if (spec.type === 'flow') return renderFlowDiagramPanel(spec, { width, height, theme, measure });
  if (spec.type === 'number_visual') return renderNumberVisualPanel(spec, { width, height, theme, measure });
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
  const axisFmt = (v) => `${v.toFixed(Number.isInteger(v) ? decimals : Math.max(1, decimals))}${spec.y.unit}`;
  const tw = (t) => measure ? measure(t, fs, 400) : [...String(t)].length * fs;
  const yTickLabels = Array.from({ length: 5 }, (_, i) => {
    const value = ymin + (ymax - ymin) * i / 4;
    return axisFmt(value);
  });
  const left = Math.max(78, Math.ceil(Math.max(...yTickLabels.map(tw)) + 18));
  const right = spec.type === 'line' ? Math.max(spec.emphasize_endpoint ? 125 : 100, Math.ceil(Math.max(...spec.series.map((s) => tw(axisFmt(s.points.filter((p) => p[1] !== null).at(-1)[1])))) + (spec.emphasize_endpoint ? 58 : 22))) : 26;
  const top = spec.type === 'bar' ? 100 : 78, bottom = spec.type === 'bar' ? 126 : 120, pw = width - left - right, ph = height - top - bottom;
  if (pw < width * 0.35 || ph < 80) fail('labels leave insufficient plot space; increase panel size or use another layout');
  const sx = (x) => left + (xmax === xmin ? pw / 2 : ((x - xmin) / (xmax - xmin)) * pw);
  const sy = (y) => top + ph - ((y - ymin) / (ymax - ymin)) * ph;
  const els = [];
  function text(t, x, y, { anchor = 'start', weight = 400, size = fs, limit = width - x - 8 } = {}) {
    const measured = measure ? measure(t, size, weight) : [...String(t)].length * size;
    if (measured > limit) fail(`text does not fit: ${t}; move full context to a caption, do not truncate`);
    els.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="${esc(font)}" font-size="${n(size)}" font-weight="${weight}" fill="${fg}">${esc(t)}</text>`);
  }
  text(spec.title, left, 30, { weight: 600 });
  if (spec.show_mini_label !== false) text(`${spec.period} · ${spec.y.label}`, left, 59);
  for (let i = 0; i <= 4; i++) {
    const v = ymin + (ymax - ymin) * i / 4, y = sy(v);
    els.push(`<line x1="${n(left)}" y1="${n(y)}" x2="${n(left + pw)}" y2="${n(y)}" stroke="${fg}" stroke-opacity="0.14"/>`);
    text(axisFmt(v), left - 10, y + fs * 0.32, { anchor: 'end', limit: left - 12 });
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
      els.push(`<path d="${d.trim()}" fill="none" stroke="${accent}" stroke-width="${Number.isFinite(spec.line_width) ? Math.max(2, Math.min(8, spec.line_width)) : 3}" stroke-dasharray="${['none', '7 4', '2 4', '10 3'][i]}"/>`);
      const last = actual.at(-1); let ly = sy(last[1]);
      if (spec.emphasize_endpoint === true) els.push(`<circle cx="${n(sx(last[0]))}" cy="${n(sy(last[1]))}" r="12" fill="${theme.background ?? '#FFFFFF'}" stroke="${accent}" stroke-width="6"/>`);
      while (endpointYs.some((y) => Math.abs(y - ly) < fs * 1.2)) ly += fs * 1.25;
      if (ly > top + ph + fs * 0.5) fail('endpoint labels collide; split series or increase height');
      endpointYs.push(ly);
      text(axisFmt(last[1]), left + pw + 10, ly + fs * 0.32, { weight: spec.emphasize_endpoint ? 800 : 400, size: spec.emphasize_endpoint ? fs + 4 : fs, limit: right - 12 });
      displayed.push({ series: s.name, endpoint: last, endpoint_label: axisFmt(last[1]), claim: s.claim });
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
  text(chartCaption(spec), left, height - 12);
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

/** Purpose-built, deterministic SVG modules for premium editorial number cards. */
export function renderNumberVisualPanel(spec, { width = 900, height = 520, theme = {}, measure = null } = {}) {
  const fail = (message) => { throw new Error(`NUMBER_VISUAL_INVALID: ${message}`); };
  if (!spec || spec.type !== 'number_visual' || !['comparison-bars','dot-grid','trend-area','dual-metric','rate-gap-ratio','scenario-split'].includes(spec.layout)) fail('unsupported layout');
  if (![width, height].every(Number.isFinite) || width < 400 || height < 260) fail('panel must be at least 400x260');
  if (typeof spec.title !== 'string' || !spec.title.trim() || typeof spec.source_note !== 'string' || !spec.source_note.trim()) fail('title and source_note are required');
  const bg = theme.background ?? '#F7F5F0', fg = theme.foreground ?? '#14213D', accent = theme.accent ?? '#FF6B5B';
  for (const color of [bg, fg, accent]) if (!/^#[0-9a-f]{6}$/i.test(color)) fail('theme colors must be #RRGGBB');
  const font = theme.font_family ?? 'Noto Sans CJK KR, Pretendard, sans-serif';
  const scale = width / 900;
  const labelSize = Math.max(30, 30 * scale), valueSize = Math.max(44, 58 * scale), smallSize = Math.max(30, 32 * scale);
  const els = [], displayed = [];
  const text = (value, x, y, size = labelSize, weight = 600, anchor = 'start', color = fg) => {
    if (typeof value !== 'string' || !value.length) fail('visible labels must be non-empty strings');
    const measured = measure ? measure(value, size, weight) : [...value].length * size * 0.62;
    const limit = anchor === 'end' ? x - 12 : anchor === 'middle' ? Math.min(x, width - x) * 2 - 24 : width - x - 12;
    if (measured > limit) fail(`text does not fit: ${value}`);
    els.push(`<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="${esc(font)}" font-size="${n(size)}" font-weight="${weight}" fill="${color}">${esc(value)}</text>`);
  };
  const line = (x1,y1,x2,y2, stroke=fg, opacity=0.15, strokeWidth=2) => els.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`);
  const pad = 36 * scale;
  if (spec.layout === 'comparison-bars') {
    if (!Array.isArray(spec.items) || spec.items.length !== 2 || spec.items.some(x => !Number.isFinite(x.value) || x.value < 0 || x.value > 100 || !x.label || !x.value_label)) fail('comparison-bars needs two 0–100 items');
    const x0=pad, barW=width-pad*2, gap=height*0.25, y0=height*0.3, bh=Math.max(32,36*scale);
    spec.items.forEach((item,i)=>{ const y=y0+i*gap; text(item.label,x0,y-smallSize*0.55,smallSize,700); els.push(`<rect x="${n(x0)}" y="${n(y)}" width="${n(barW)}" height="${n(bh)}" rx="${n(bh/2)}" fill="${fg}" fill-opacity="0.08"/>`); els.push(`<rect x="${n(x0)}" y="${n(y)}" width="${n(barW*item.value/100)}" height="${n(bh)}" rx="${n(bh/2)}" fill="${accent}"/>`); if(item.value>=88) text(item.value_label,x0+barW-12,y+bh*0.83,valueSize,800,'end'); else text(item.value_label,x0+barW*item.value/100+16,y+bh*0.83,valueSize,800); displayed.push({label:item.label,value:item.value,value_label:item.value_label}); });
  } else if (spec.layout === 'dot-grid') {
    const { total, filled, value_label, caption }=spec;
    if (!Number.isInteger(total)||!Number.isInteger(filled)||filled<0||filled>total||!value_label||!caption) fail('dot-grid needs bounded integer counts and labels');
    if (total !== 100) fail('dot-grid requires a 100-point scale');
    const cols=10, r=Math.min(9.5*scale,(width-pad*2)/(cols*2.5)), gap=r*2.3, gridW=(cols-1)*gap;
    const startX=(width-gridW)/2, startY=height*0.13;
    for(let i=0;i<total;i++){ const x=startX+(i%cols)*gap,y=startY+Math.floor(i/cols)*gap; els.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${i<filled?accent:fg}" fill-opacity="${i<filled?0.96:0.10}"/>`); }
    text(value_label,width/2,height*0.77,valueSize,800,'middle'); text(caption,width/2,height*0.91,smallSize,600,'middle'); displayed.push({filled,total,value_label});
  } else if (spec.layout === 'trend-area') {
    const { start, end, start_label, end_label, start_date, end_date }=spec;
    if (![start,end].every(v=>Number.isFinite(v)&&v>=0&&v<=100)||!start_label||!end_label||!start_date||!end_date) fail('trend-area needs two dated 0–100 endpoints');
    const yMin=Math.min(70,start,end), yMax=Math.max(100,start,end);
    const left=pad+16, right=width-pad-12, top=height*0.14, bottom=height*0.78, y=(v)=>bottom-((v-yMin)/(yMax-yMin))*(bottom-top), x0=left,x1=right;
    for(let i=0;i<5;i++) line(left,y(yMin+(yMax-yMin)*i/4),right,y(yMin+(yMax-yMin)*i/4),fg,0.12,1.5);
    const gid='trend-area-gradient'; els.push(`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${accent}" stop-opacity="0.34"/><stop offset="100%" stop-color="${accent}" stop-opacity="0.015"/></linearGradient></defs>`);
    const cx1=x0+(x1-x0)*0.32, cx2=x0+(x1-x0)*0.69, cy1=y(start)+(y(end)-y(start))*0.22, cy2=y(start)+(y(end)-y(start))*0.78;
    const curve=`M ${n(x0)} ${n(y(start))} C ${n(cx1)} ${n(cy1)} ${n(cx2)} ${n(cy2)} ${n(x1)} ${n(y(end))}`;
    els.push(`<path d="${curve} L ${n(x1)} ${n(bottom)} L ${n(x0)} ${n(bottom)} Z" fill="url(#${gid})"/>`);
    els.push(`<path d="${curve}" fill="none" stroke="${accent}" stroke-width="${n(5*scale)}" stroke-linecap="round"/>`);
    els.push(`<circle cx="${n(x0)}" cy="${n(y(start))}" r="${n(8*scale)}" fill="${bg}" stroke="${accent}" stroke-width="${n(4*scale)}"/>`);
    els.push(`<circle cx="${n(x1)}" cy="${n(y(end))}" r="${n(15*scale)}" fill="${accent}" stroke="${bg}" stroke-width="${n(5*scale)}"/>`);
    text(start_label,x0,y(start)-22*scale,smallSize,700,'start'); text(end_label,x1-8,y(end)-22*scale,valueSize,800,'end'); text(start_date,x0,bottom+44*scale,smallSize,500); text(end_date,x1,bottom+44*scale,smallSize,500,'end');
    displayed.push({start,start_label,start_date,end,end_label,end_date});
  } else if (spec.layout === 'dual-metric') {
    if (!Array.isArray(spec.items)||spec.items.length!==2||spec.items.some(x=>!x.label||!x.value_label||!Number.isFinite(x.value)||!Number.isFinite(x.max)||x.value<0||x.max<=0||x.value>x.max)) fail('dual-metric needs two independently scaled metrics');
    const y0=height*0.30, rowH=height*0.40, x=pad, w=width-pad*2, bh=22*scale;
    spec.items.forEach((item,i)=>{const y=y0+i*rowH; text(item.label,x,y,smallSize,700); text(item.value_label,width-pad,y,valueSize,800,'end'); const by=y+28*scale; line(x,by+bh/2,x+w,by+bh/2,fg,0.10,bh); els.push(`<rect x="${n(x)}" y="${n(by)}" width="${n(w*item.value/item.max)}" height="${n(bh)}" rx="${n(bh/2)}" fill="${accent}"/>`); displayed.push({label:item.label,value:item.value,max:item.max,value_label:item.value_label});});
  } else if (spec.layout === 'rate-gap-ratio') {
    const { rates, ratio }=spec;
    if (!Array.isArray(rates)||rates.length!==2||rates.some(x=>!x.label||!Number.isFinite(x.value)||x.value<0||x.value>5)||rates[0].value<=rates[1].value||!Number.isFinite(ratio?.outflow)||!Number.isFinite(ratio?.inflow)||ratio.inflow<=0||Math.abs(ratio.outflow/ratio.inflow-2.5)>0.15||!ratio.outflow_label||!ratio.inflow_label||!ratio.caption) fail('rate-gap-ratio needs descending rates and a source-bound ratio near 2.5:1');
    const x=pad,w=width-pad*2, y0=height*0.11, bh=28*scale;
    rates.forEach((r,i)=>{const y=y0+i*height*0.18;text(r.label,x,y-smallSize*0.48,smallSize,700);els.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(bh)}" rx="${n(bh/2)}" fill="${fg}" fill-opacity="0.08"/>`);els.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w*r.value/5)}" height="${n(bh)}" rx="${n(bh/2)}" fill="${i===0?accent:fg}"/>`);text(`${r.value.toFixed(2)}%`,width-pad,y+bh*0.84,smallSize,700,'end');displayed.push({label:r.label,value:r.value});});
    const gy=height*0.45; line(x,gy,width-pad,gy,fg,0.22,2); text('금리차',x,gy+smallSize*1.05,smallSize,600); text('1.00%p',width-pad,gy+smallSize*1.05,valueSize,800,'end',accent);
    const max=ratio.outflow, captionY=height*0.61, row1Y=height*0.71, row2Y=height*0.85, barH=16*scale;
    text(ratio.caption,x,captionY,smallSize,700);
    for (const [index,item] of [{label:ratio.outflow_label,value:ratio.outflow,color:accent},{label:ratio.inflow_label,value:ratio.inflow,color:fg}].entries()) {
      const labelY=index===0?row1Y:row2Y; text(item.label,x,labelY,smallSize,700); const barY=labelY+10*scale;
      els.push(`<rect x="${n(x)}" y="${n(barY)}" width="${n(w)}" height="${n(barH)}" rx="${n(barH/2)}" fill="${fg}" fill-opacity="0.08"/>`);
      els.push(`<rect x="${n(x)}" y="${n(barY)}" width="${n(w*item.value/max)}" height="${n(barH)}" rx="${n(barH/2)}" fill="${item.color}"/>`);
    }
    displayed.push({gap:`${(rates[0].value-rates[1].value).toFixed(2)}%p`,ratio:'2.5:1',outflow:ratio.outflow,inflow:ratio.inflow});
  } else if (spec.layout === 'scenario-split') {
    const { date, scenarios }=spec;
    if(!date||!Array.isArray(scenarios)||scenarios.length!==2||scenarios.some(s=>!s.label)) fail('scenario-split needs a date and two scenario branches');
    text(date,width/2,height*0.23,valueSize,800,'middle');
    const cx=width/2, cy=height*0.42, y=height*0.70, lx=width*0.25, rx=width*0.75;
    line(cx,cy,cx,y-54*scale,accent,0.55,4*scale); line(cx,y-54*scale,lx,y-12*scale,accent,0.55,4*scale); line(cx,y-54*scale,rx,y-12*scale,accent,0.55,4*scale);
    scenarios.forEach((s,i)=>{const x=i?rx:lx;els.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(17*scale)}" fill="${accent}"/>`);text(s.label,x,y+70*scale,valueSize,800,'middle');displayed.push({scenario:s.label});});
  }
  return { svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(spec.title)}</title>${els.join('')}</svg>`, renderer:{tool:'aes-number-visual-panel',version:PANEL_RENDERER_VERSION}, geometry:{width,height}, displayed, source_note:spec.source_note };
}
