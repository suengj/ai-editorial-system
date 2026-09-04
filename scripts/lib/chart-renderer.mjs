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
