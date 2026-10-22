/**
 * PMC bundle -> existing deterministic chart panel binding (SUE-1336).
 *
 * prediction-market-crawler (PMC, SUE-1331) owns provider data, history, gap
 * detection and its own PNG. This module only READS a finished PMC bundle
 * (`<slug>.plot.json`, schema `pmc.plotdata/1`) and maps it, without changing a
 * value, onto the source-spec shape that `renderChartPanel` already consumes.
 * It never fetches, smooths, interpolates, forward-fills or re-estimates, and it
 * does not copy PMC's interpolation policy: the panel draws the raw observations.
 *
 * Probability specialisation (0-100 %, %p, observed period) lives HERE and in
 * the PMC bundle. The general line/bar panel in chart-renderer.mjs stays free of it.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { loadNumericProfile, fmtPct } from './numeric-visual-core.mjs';

export const PMC_BINDING_VERSION = '1.0.0';
export const PMC_PLOT_SCHEMA = 'pmc.plotdata/1';

export class PmcBindingError extends Error {
  constructor(code, message) { super(`${code}: ${message}`); this.name = 'PmcBindingError'; this.code = code; }
}
const fail = (code, message) => { throw new PmcBindingError(code, message); };
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * PMC hashes `json.dumps(plot_without_hash, sort_keys=True, ensure_ascii=False,
 * separators=(",", ":"))`. Re-serialising parsed JSON in JS would print `34.0` as
 * `34`, so numbers are copied verbatim from the file (PMC writes them with the
 * same Python repr). Only the top-level `plot_data_sha256` key is dropped.
 */
function canonicalValue(text, start) {
  let i = start;
  const ws = () => { while (' \t\r\n'.includes(text[i]) && i < text.length) i++; };
  const cmp = (a, b) => { const x = Array.from(a), y = Array.from(b); for (let k = 0; k < Math.min(x.length, y.length); k++) { const d = x[k].codePointAt(0) - y[k].codePointAt(0); if (d) return d; } return x.length - y.length; };
  const string = () => {
    const from = i; i++;
    while (text[i] !== '"') { if (i >= text.length) fail('PLOT_INVALID', 'unterminated string'); i += text[i] === '\\' ? 2 : 1; }
    i++;
    return JSON.parse(text.slice(from, i));
  };
  const value = (top = false) => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++; ws();
      const entries = [];
      if (text[i] === '}') i++;
      else for (;;) {
        ws(); const key = string(); ws();
        if (text[i++] !== ':') fail('PLOT_INVALID', 'expected ":"');
        entries.push([key, value()]); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i++] === '}') break;
        fail('PLOT_INVALID', 'expected "," or "}"');
      }
      const kept = entries.filter(([k]) => !(top && k === 'plot_data_sha256')).sort((a, b) => cmp(a[0], b[0]));
      return `{${kept.map(([k, v]) => `${JSON.stringify(k)}:${v}`).join(',')}}`;
    }
    if (c === '[') {
      i++; ws();
      const items = [];
      if (text[i] === ']') i++;
      else for (;;) {
        items.push(value()); ws();
        if (text[i] === ',') { i++; continue; }
        if (text[i++] === ']') break;
        fail('PLOT_INVALID', 'expected "," or "]"');
      }
      return `[${items.join(',')}]`;
    }
    if (c === '"') return JSON.stringify(string());
    const m = /^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i, i + 64));
    if (!m) fail('PLOT_INVALID', `unexpected token at ${i}`);
    i += m[0].length;
    return m[0];
  };
  const out = value(true);
  return out;
}
export const pmcPlotDataHash = (plotText) => sha(Buffer.from(canonicalValue(plotText, 0), 'utf8'));

/**
 * Read and verify one PMC plot bundle. Throws a coded PmcBindingError when the
 * dataset cannot be trusted; never repairs it.
 */
export function loadPmcPlotBundle(plotPath) {
  const path = resolve(plotPath);
  if (!existsSync(path)) fail('PLOT_MISSING', `no such file: ${plotPath}`);
  const bytes = readFileSync(path), text = bytes.toString('utf8');
  let plot;
  try { plot = JSON.parse(text); } catch { fail('PLOT_INVALID', 'not JSON'); }
  if (plot?.schema !== PMC_PLOT_SCHEMA) fail('PLOT_SCHEMA', `only ${PMC_PLOT_SCHEMA} is bound (got ${plot?.schema}); multi-outcome cards stay PMC-rendered`);
  if (plot.status !== 'ok') fail('PLOT_NOT_CHARTABLE', `PMC status is "${plot.status}"; a snapshot or insufficient history is not drawn as a trend`);
  if (!Array.isArray(plot.points) || plot.points.length < 2) fail('PLOT_NOT_CHARTABLE', 'fewer than 2 valid observations');
  const claimed = plot.plot_data_sha256;
  const actual = pmcPlotDataHash(text);
  if (claimed !== actual) fail('PLOT_HASH_MISMATCH', `plot_data_sha256 ${claimed} does not match the dataset (${actual}); the bundle was edited or is not PMC output`);

  // Optional siblings: PMC's own meta + PNG. They are lineage, not inputs to the drawing.
  const dir = dirname(path), slug = basename(path).slice(0, -'.plot.json'.length);
  const siblings = readdirSync(dir).filter((f) => f.startsWith(`${slug}.`));
  let meta = null, metaFile = null;
  for (const f of siblings.filter((x) => x.endsWith('.meta.json')).sort()) {
    const m = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
    if (m.plot_data_sha256 === claimed) { meta = m; metaFile = f; break; }
  }
  let pmcPng = null;
  if (meta?.chart_sha256) {
    for (const f of siblings.filter((x) => x.endsWith('.png')).sort()) {
      if (sha(readFileSync(resolve(dir, f))) === meta.chart_sha256) { pmcPng = { file: f, sha256: meta.chart_sha256 }; break; }
    }
  }
  return {
    path, plot, plot_text: text, bytes, file_sha256: `sha256:${sha(bytes)}`, plot_data_sha256: claimed,
    meta, meta_file: metaFile, pmc_png: pmcPng,
    checks: {
      schema: 'PASS', status: 'PASS', plot_data_sha256: 'PASS',
      meta_sibling: meta ? 'PASS' : 'ABSENT', pmc_png_hash: pmcPng ? 'PASS' : (meta?.chart_sha256 ? 'NOT_FOUND' : 'ABSENT'),
    },
  };
}

const utcDay = (iso) => iso.slice(0, 10);
const koreanDay = (iso) => {
  const [, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${month}월 ${day}일`;
};
const PROVIDER_LABEL = { polymarket: 'Polymarket', kalshi: 'Kalshi', manifold: 'Manifold' };
const clean = (v) => Number(v.toPrecision(12)); // 0.42*100 -> 42, removes float noise only

/** Provider colour rule from the approved numeric profile; other providers get a neutral. */
export function providerAccent(provider, profile = loadNumericProfile()) {
  return profile.palette.provider_colors[provider] ?? '#2A7F7A';
}

/** PMC's y-axis. A bundle without y_axis is drawn and checked on the same 0..100 default. */
const plotAxis = (plot) => plot.y_axis ?? { min: 0, max: 100 };

/** Any change of PMC segment id is one break (A,B,A has two). The spec inserts a null per break; verify counts with the same rule. */
const segmentChanged = (prev, cur) => cur.segment !== prev.segment;
const segmentBreakCount = (points) => points.slice(1).filter((p, i) => segmentChanged(points[i], p)).length;

/**
 * Map a verified plot to a chart-renderer source spec. Values are copied
 * (x = observation epoch ms, y = percent); a segment break becomes one `null`
 * point at the midpoint of the break so the panel breaks the path instead of
 * bridging it. No point is created, removed or moved.
 */
export function pmcPlotToChartSpec(bundle) {
  const { plot } = bundle;
  const provider = plot.meta?.provider;
  if (!provider) fail('PLOT_INVALID', 'meta.provider is required for the source footer');
  const pts = [];
  let prev = null;
  for (const p of plot.points) {
    const x = Date.parse(p.observed_at);
    if (!Number.isFinite(x)) fail('PLOT_INVALID', `bad observed_at: ${p.observed_at}`);
    if (!Number.isFinite(p.value) || p.value < 0 || p.value > 1) fail('PLOT_INVALID', `probability outside 0..1: ${p.value}`);
    if (prev && segmentChanged(prev, p)) pts.push([Math.round((prev.x + x) / 2), null]);
    if (prev && x <= prev.x) fail('PLOT_INVALID', 'observations must be strictly increasing');
    pts.push([x, clean(p.value * 100)]);
    prev = { x, segment: p.segment };
  }
  const first = plot.points[0].observed_at, last = plot.points.at(-1).observed_at;
  const axis = plotAxis(plot);
  const label = plot.meta.outcome_label ?? plot.meta.outcome ?? '';
  const firstDay = koreanDay(first), lastDay = koreanDay(last);
  const period = new Date(first).getUTCMonth() === new Date(last).getUTCMonth()
    ? `${firstDay} → ${lastDay.replace(/^\d+월 /, '')}` : `${firstDay} → ${lastDay}`;
  return {
    type: 'line',
    title: period,
    period: '이번 주',
    source_note: `출처 ${PROVIDER_LABEL[provider] ?? provider}`,
    x: { label: '날짜', show_label: false, tick_labels: { [String(pts[0][0])]: firstDay, [String(pts.at(-1)[0])]: lastDay } },
    y: { label: '확률', unit: '%', decimals: plot.hero?.decimals ?? 1, min: axis.min, max: axis.max },
    series: [{ name: label || provider, claim: `pmc:${provider}:${plot.meta.market_id}:${bundle.plot_data_sha256.slice(0, 12)}`, points: pts }],
  };
}

const TITLE_ORIGINS = ['source_rewrite', 'request_summary', 'source_verbatim'];

/**
 * Provenance of the display title. A typed title is the user's text, so it is
 * request_summary unless the caller states otherwise. Without one the headline is
 * PMC's own meta.title (source_verbatim); an origin that claims a different source
 * is refused rather than recorded.
 */
export function resolveTitleOrigin({ title, titleOrigin } = {}) {
  if (titleOrigin !== undefined && !TITLE_ORIGINS.includes(titleOrigin)) fail('TITLE_ORIGIN', String(titleOrigin));
  if (title == null) {
    if (titleOrigin !== undefined && titleOrigin !== 'source_verbatim') fail('TITLE_ORIGIN', `${titleOrigin} needs a title; without one the headline is PMC's meta.title`);
    return 'source_verbatim';
  }
  return titleOrigin ?? 'request_summary';
}

const signedKey = (sign, num) => `${sign === '-' || sign === '−' ? '-' : '+'}${num}`;

/**
 * Percent numbers in an AI-lane title must be values the deterministic lane displays.
 * A signed title number must match the displayed sign: "-17.3%" is not "+17.3%p".
 * An unsigned one is a magnitude and matches either sign.
 */
export function checkTitleNumbers(title, displayed) {
  const signed = new Set(), magnitude = new Set();
  for (const s of displayed) for (const [, sign, num] of s.matchAll(/([+\-−]?)(\d+(?:\.\d+)?)/g)) { signed.add(signedKey(sign, num)); magnitude.add(num); }
  const bad = [];
  for (const [text, sign, num] of title.matchAll(/(?<![\d.%])([+\-−]?)(\d+(?:\.\d+)?)\s*%/g)) {
    if (sign ? !signed.has(signedKey(sign, num)) : !magnitude.has(num)) bad.push(text);
  }
  if (bad.length) fail('TITLE_NUMBER_UNGROUNDED', `title shows ${bad.join(', ')} which the card does not display`);
}

/**
 * Build the sidecar plan for the existing `render-visual` executor: AI-lane
 * title, deterministic hero/delta text from the bundle, and the chart panel.
 * File names are relative to the inputs directory that `writeBinding` creates.
 */
export function buildCardPlan(bundle, { title, titleOrigin, specRef, specSha256, plotRef, theme = {} } = {}) {
  const { plot } = bundle, profile = loadNumericProfile();
  const origin = resolveTitleOrigin({ title, titleOrigin });
  const text = title ?? plot.meta.title;
  if (typeof text !== 'string' || !text.trim()) fail('TITLE_MISSING', 'a display title is required');
  if (origin === 'source_verbatim' && text !== plot.meta.title) fail('TITLE_ORIGIN', 'source_verbatim is only PMC meta.title; a typed title is request_summary');
  const hero = plot.hero?.text, delta = plot.delta?.text;
  if (!hero) fail('PLOT_INVALID', 'hero.text is required');
  checkTitleNumbers(text, [hero, ...(delta ? [delta] : [])]);
  const layers = [
    { id: 'headline', kind: 'text', text, source_ref: origin === 'source_verbatim' ? plotRef : 'request', font_size: 48, weight: 700, max_lines: 3, slot: { x: 0.07, y: 0.05, width: 0.86, height: 0.17 } },
    { id: 'hero', kind: 'text', text: hero, source_ref: plotRef, font_size: 150, weight: 700, max_lines: 1, slot: { x: 0.07, y: 0.23, width: 0.6, height: 0.15 } },
    ...(delta ? [{ id: 'delta', kind: 'text', text: `관측 기간 변화 ${delta}`, source_ref: plotRef, font_size: 34, weight: 600, max_lines: 1, slot: { x: 0.07, y: 0.39, width: 0.86, height: 0.045 } }] : []),
    { id: 'chart', kind: 'chart', ref: specRef, sha256: specSha256, slot: { x: 0.05, y: 0.45, width: 0.9, height: 0.5 } },
  ];
  return {
    schema_version: '1.0.0',
    request: `${PROVIDER_LABEL[plot.meta.provider] ?? plot.meta.provider} 시장 확률 추이 카드 (PMC bundle ${bundle.plot_data_sha256.slice(0, 12)})`,
    source: { ref: plotRef, sha256: bundle.file_sha256, scope: 'source_bound' },
    profiles: { surface: 'instagram', artifact: 'visual/evidence-visual' },
    task: {
      canvas: { width: profile.canvas.width, height: profile.canvas.height },
      theme: { background: profile.palette.background, foreground: profile.palette.text, accent: theme.accent ?? providerAccent(plot.meta.provider, profile) },
      watermark: { enabled: false },
    },
    layers,
  };
}

/**
 * Compare what the final render claims to have drawn with what the PMC bundle
 * says. This is numeric/lineage QA only; it is not visual QA and not approval.
 */
export function verifyRenderAgainstBundle(bundle, execution) {
  const { plot } = bundle, checks = {}, notes = [];
  const chart = execution.charts?.[0];
  const pass = (name, ok, detail) => { checks[name] = ok ? 'PASS' : 'FAIL'; if (!ok) notes.push(`${name}: ${detail}`); };
  pass('chart_present', Boolean(chart), 'no chart evidence in receipt');
  if (!chart) return { checks, notes, ok: false };
  const last = plot.points.at(-1), first = plot.points[0];
  const endpoint = chart.displayed[0];
  pass('endpoint_matches_pmc_hero', endpoint.endpoint_label === plot.hero.text, `${endpoint.endpoint_label} vs ${plot.hero.text}`);
  pass('endpoint_is_last_observation', endpoint.endpoint[0] === Date.parse(last.observed_at) && endpoint.endpoint[1] === clean(last.value * 100), `${JSON.stringify(endpoint.endpoint)}`);
  pass('hero_text_layer', execution.text.some((t) => t.id === 'hero' && t.text === plot.hero.text) || endpoint.endpoint_label === plot.hero.text,
    'neither a matching hero text layer nor the chart endpoint label matches PMC hero.text');
  if (plot.delta?.text) {
    const pp = plot.delta.value_pp;
    const readerDelta = Number.isFinite(pp) ? `${Math.abs(pp).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%p ${pp < 0 ? '내렸다' : pp > 0 ? '올랐다' : '변화 없다'}` : null;
    pass('delta_text_layer', execution.text.some((t) => t.id === 'delta' && t.text.endsWith(plot.delta.text)) ||
      (readerDelta && execution.text.some((t) => t.text.includes(readerDelta))),
    'neither the raw PMC delta layer nor its Korean reader-copy equivalent appears in visible text');
  }
  pass('unit_percent', chart.axis.unit === '%', `unit ${chart.axis.unit}`);
  const axis = plotAxis(plot);
  pass('axis_matches_pmc', chart.axis.ymin === axis.min && chart.axis.ymax === axis.max, `${chart.axis.ymin}..${chart.axis.ymax} vs ${axis.min}..${axis.max}`);
  const expectedObservations = plot.points.length + segmentBreakCount(plot.points);
  pass('observation_count', chart.raw_observation_count === expectedObservations, `${chart.raw_observation_count} vs ${expectedObservations}`);
  pass('observed_period', chart.axis.xmin === Date.parse(first.observed_at) && chart.axis.xmax === Date.parse(last.observed_at), 'x-range differs from the observed period');
  return { checks, notes, ok: Object.values(checks).every((v) => v === 'PASS'), displayed_hero: fmtPct(last.value * 100, plot.hero.decimals ?? 1) };
}
