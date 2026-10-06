/**
 * numeric-visual-core — SUE-1330 Instagram numeric-visual policy checker.
 *
 * Validates a "numeric card spec": the deterministic description of one
 * Instagram probability trend card (single market or dual comparison).
 * Dependency-free, 0 API/LLM calls. Fail-closed: every rule is checked
 * against the raw observations, not against what the spec claims.
 *
 * Values are probabilities in percent (0..100). Timestamps are ISO-8601.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const PROFILE_PATH = resolve(ROOT, 'editorial/numeric-visual/instagram-numeric-visual.v1.json');
export const loadNumericProfile = () => JSON.parse(readFileSync(PROFILE_PATH, 'utf8'));

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const ts = (s) => Date.parse(s);
export const round = (v, d) => { const f = 10 ** d; return Math.round((v + Number.EPSILON) * f) / f; };
export const fmtPct = (v, d) => `${round(v, d).toFixed(d)}%`;
export const fmtPp = (v, d) => { const r = round(v, d); return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r).toFixed(d)}%p`; };
const CASH_WORDS = /(\$|USD|달러|수익|수익률|profit|return|payout|cash)/i;
const PROFIT_WORDS = /(profit|수익|이익|arbitrage|차익|guaranteed|확정)/i;
const ART_KEYS_FORBIDDEN = ['observations', 'values', 'series', 'axis', 'labels', 'numbers', 'chart', 'chart_image', 'endpoint_labels', 'footer'];

/** Deterministic axis: full 0..100 unless zoom requested; zoom = padded, rounded to 5, min span, clamped. */
export function computeAxis(allPoints, { zoom, padding_pp, min_span_pp }) {
  if (!zoom) return { min: 0, max: 100, zoomed: false };
  const ps = allPoints.map((o) => o.p);
  let lo = Math.floor((Math.min(...ps) - padding_pp) / 5) * 5;
  let hi = Math.ceil((Math.max(...ps) + padding_pp) / 5) * 5;
  if (hi - lo < min_span_pp) { const mid = (lo + hi) / 2; lo = Math.floor((mid - min_span_pp / 2) / 5) * 5; hi = lo + min_span_pp; }
  if (lo < 0) { hi = Math.min(100, hi - lo); lo = 0; }
  if (hi > 100) { lo = Math.max(0, lo - (hi - 100)); hi = 100; }
  return { min: lo, max: hi, zoomed: lo > 0 || hi < 100 };
}

/** Actual observed span in whole days (floor), never the requested window. */
export const observedDays = (obs) => Math.floor((ts(obs[obs.length - 1].t) - ts(obs[0].t)) / DAY);

/**
 * @returns {{code:string, where:string, message:string}[]} empty when the spec complies.
 */
export function checkNumericCard(spec, profile = loadNumericProfile()) {
  const out = [];
  const err = (code, where, message) => out.push({ code, where, message });
  const d = profile.units.decimals;
  if (!spec || typeof spec !== 'object') return [{ code: 'SPEC', where: '$', message: 'spec must be an object' }];
  if (spec.profile !== profile.profile) err('PROFILE', 'profile', `must be ${profile.profile}`);

  // ---- lane separation
  const art = spec.art_direction ?? {};
  for (const k of Object.keys(art)) {
    if (ART_KEYS_FORBIDDEN.includes(k)) err('LANE_ART_OWNS_DATA', `art_direction.${k}`, 'AI art direction may not carry factual/chart data');
    else if (!profile.lanes.ai_art_direction.owns.includes(k)) err('LANE_ART_UNKNOWN', `art_direction.${k}`, 'unknown art-direction field');
  }
  if (spec.rendering?.chart_geometry !== 'deterministic') err('LANE_CHART_NOT_DETERMINISTIC', 'rendering.chart_geometry', 'chart geometry must be rendered by deterministic code');
  if (spec.rendering?.final_composition !== 'deterministic') err('LANE_COMPOSITION_NOT_DETERMINISTIC', 'rendering.final_composition', 'final composition must be deterministic');
  if (!['none', 'decorative_only'].includes(spec.rendering?.image_ai_role)) err('LANE_IMAGE_AI_DRAWS_DATA', 'rendering.image_ai_role', 'image AI may only be none or decorative_only');
  for (const [i, a] of (art.decorative_assets ?? []).entries()) {
    if (a.overlaps_plot || a.contains_data) err('LANE_DECORATION_OVER_DATA', `art_direction.decorative_assets[${i}]`, 'decorative assets must not overlap the plot or contain data');
  }
  // Numbers in the AI title must be numbers the deterministic lane displays.
  const displayed = new Set();

  // ---- canvas / palette
  const c = spec.canvas ?? {};
  if (c.width !== profile.canvas.width || c.height !== profile.canvas.height) err('CANVAS_SIZE', 'canvas', 'must be 1080×1350 (logical)');
  if (!profile.canvas.allowed_scales.includes(c.scale)) err('CANVAS_SCALE', 'canvas.scale', 'scale must be 1 or 2');
  if (spec.palette?.background !== profile.palette.background || spec.palette?.text !== profile.palette.text) err('PALETTE_BASE', 'palette', 'off-white background and navy text are required');

  // ---- layout
  const series = Array.isArray(spec.series) ? spec.series : [];
  const mode = spec.mode;
  if (mode === 'single') {
    if (series.length !== 1) err('LAYOUT_SERIES_COUNT', 'series', 'single mode needs exactly 1 series');
    if ((spec.layout?.hero_numbers ?? 0) !== 1 || spec.layout?.number_cards) err('LAYOUT_SINGLE_HERO', 'layout', 'single mode uses exactly one hero number and no number cards');
  } else if (mode === 'dual') {
    if (series.length !== 2) err('LAYOUT_SERIES_COUNT', 'series', 'dual mode needs exactly 2 series');
    const cards = spec.layout?.number_cards ?? [];
    if (cards.length !== 2 || cards[0]?.size !== cards[1]?.size || spec.layout?.hero_numbers) err('LAYOUT_DUAL_CARDS', 'layout', 'dual mode uses two equal number cards and no single hero');
  } else err('LAYOUT_MODE', 'mode', 'mode must be single or dual');

  // ---- per series facts
  const allPts = [];
  const endpoints = [];
  for (const [i, s] of series.entries()) {
    const w = `series[${i}]`;
    const prov = String(s.provider ?? '').toLowerCase();
    const pc = profile.palette.provider_colors;
    if (pc[prov] && s.color !== pc[prov]) err('PROVIDER_COLOR', `${w}.color`, `${prov} must use ${pc[prov]}`);
    if (!pc[prov] && Object.values(pc).includes(s.color)) err('PROVIDER_COLOR_MISUSE', `${w}.color`, `${prov} may not use a Polymarket/Kalshi identity colour`);
    if (s.axis) err('AXIS_PER_SERIES', `${w}.axis`, 'series may not carry their own axis; one shared deterministic axis');
    const need = profile.currency_context[prov];
    if (need && s.currency_context !== need) err('CURRENCY_CONTEXT', `${w}.currency_context`, `${prov} must be ${need}`);
    if (s.currency_context === 'play_money') {
      const text = [s.endpoint_label?.text, s.label, spec.footer?.source, ...(spec.layout?.number_cards ?? []).map((x) => x.caption)].filter(Boolean).join(' ');
      if (CASH_WORDS.test(text)) err('PLAY_MONEY_AS_CASH', w, 'play-money (e.g. Manifold/MANA) must not be presented as cash, returns or payouts');
    }
    const obs = Array.isArray(s.observations) ? s.observations : [];
    if (obs.length < 2) { err('OBS_MIN', `${w}.observations`, 'need ≥ 2 raw observations'); continue; }
    for (let j = 0; j < obs.length; j++) {
      if (!(obs[j].p >= 0 && obs[j].p <= 100)) err('OBS_RANGE', `${w}.observations[${j}]`, 'probability outside 0..100');
      if (j && !(ts(obs[j].t) > ts(obs[j - 1].t))) err('OBS_ORDER', `${w}.observations[${j}]`, 'timestamps must strictly increase');
      if (obs[j].forward_filled || obs[j].synthetic) err('NO_FORWARD_FILL', `${w}.observations[${j}]`, 'forward-filled or synthetic observations are not allowed');
    }
    allPts.push(...obs);
    const last = obs[obs.length - 1];
    // history last point vs current quote
    const q = s.current_quote;
    if (q) {
      if (!q.as_of || !q.retrieved_at) err('QUOTE_TIMES', `${w}.current_quote`, 'quote needs both as_of and retrieved_at');
      if (obs.some((o) => o.source === 'current_quote' || o.t === q.retrieved_at)) err('QUOTE_APPENDED_TO_HISTORY', `${w}.observations`, 'current quote must not be appended to history');
    }
    const ep = s.endpoint_label ?? {};
    if (ep.source !== 'history_last') err('ENDPOINT_SOURCE', `${w}.endpoint_label.source`, 'endpoint label must come from the history last observation');
    if (ep.value !== last.p) err('ENDPOINT_VALUE', `${w}.endpoint_label.value`, `endpoint must equal raw last observation ${last.p}`);
    if (ep.text !== fmtPct(last.p, d)) err('ENDPOINT_TEXT', `${w}.endpoint_label.text`, `endpoint text must be ${fmtPct(last.p, d)}`);
    if (ep.t !== last.t) err('ENDPOINT_TIME', `${w}.endpoint_label.t`, 'endpoint label must sit at the last observation time');
    displayed.add(fmtPct(last.p, d));
    if (s.hero) {
      const hv = s.hero.source === 'current_quote' ? q?.p : last.p;
      if (hv === undefined || s.hero.text !== fmtPct(hv, d)) err('HERO_VALUE', `${w}.hero`, 'hero number must match its declared raw source exactly');
      else displayed.add(s.hero.text);
    }
    // period
    const days = observedDays(obs);
    const per = s.displayed_period ?? {};
    if (per.start !== obs[0].t || per.end !== last.t) err('PERIOD_NOT_OBSERVED', `${w}.displayed_period`, 'period must be the actual first..last observation');
    if (per.label_days !== days) err('PERIOD_FAKE_DAYS', `${w}.displayed_period.label_days`, `actual observed span is ${days} day(s), not ${per.label_days}`);
    // delta from raw data
    if (s.delta) {
      const base = obs.find((o) => o.t === s.delta.baseline_t);
      if (!base) err('DELTA_BASELINE_NOT_RAW', `${w}.delta.baseline_t`, 'delta baseline must be a raw observation');
      else {
        const want = round(last.p - base.p, d);
        if (s.delta.value_pp !== want) err('DELTA_VALUE', `${w}.delta.value_pp`, `delta from raw data is ${want}`);
        if (s.delta.display !== fmtPp(last.p - base.p, d)) err('DELTA_UNIT', `${w}.delta.display`, `delta display must be ${fmtPp(last.p - base.p, d)} (%p)`);
        const spanDays = Math.floor((ts(last.t) - ts(base.t)) / DAY);
        if (s.delta.window_days !== undefined && s.delta.window_days !== spanDays) err('DELTA_WINDOW_FAKE', `${w}.delta.window_days`, `baseline is ${spanDays} day(s) back, not ${s.delta.window_days}`);
        displayed.add(s.delta.display);
      }
    }
    // gaps and interpolation
    const maxGap = (spec.gaps?.max_gap_hours ?? profile.gaps.default_max_gap_hours) * HOUR;
    const hasGap = obs.some((o, j) => j && ts(o.t) - ts(obs[j - 1].t) > maxGap);
    if (hasGap && spec.gaps?.render !== 'segment') err('GAP_NOT_SEGMENTED', 'gaps.render', 'gaps larger than max_gap_hours must be segmented, not bridged');
    const interp = spec.interpolation?.method;
    if (!profile.interpolation.allowed.includes(interp)) {
      if (!(profile.interpolation.forbidden_unless_labeled.includes(interp) && spec.interpolation?.requested && spec.interpolation?.label)) err('INTERPOLATION', 'interpolation.method', 'use shape-preserving/linear/step; smoothing only when requested and labeled');
    }
    if (spec.interpolation?.preserves_all_points !== true) err('INTERPOLATION_POINTS', 'interpolation.preserves_all_points', 'every raw point and endpoint must be preserved');
    endpoints.push(last);
  }

  // ---- axis (one shared, deterministic)
  if (allPts.length) {
    const a = spec.axis ?? {};
    const want = computeAxis(allPts, { zoom: !!a.zoom_requested, ...profile.axis });
    if (a.min !== want.min || a.max !== want.max || a.zoomed !== want.zoomed) err('AXIS_NOT_DETERMINISTIC', 'axis', `expected ${JSON.stringify(want)}`);
    if (!(a.min >= 0 && a.max <= 100 && a.min < a.max)) err('AXIS_BOUNDS', 'axis', 'axis must lie inside 0..100%');
    if (a.zoomed) {
      const lbl = String(a.label ?? '');
      if (!lbl.includes(`${a.min}`) || !lbl.includes(`${a.max}`) || !/(zoom|확대)/i.test(lbl)) err('AXIS_ZOOM_UNLABELED', 'axis.label', 'zoomed axis label must say zoomed and show its actual range');
    }
  }

  // ---- AI title may only quote displayed numbers
  const nums = String(art.title ?? '').match(/[+−-]?\d+(?:\.\d+)?%p?/g) ?? [];
  for (const n of nums) if (!displayed.has(n.replace('-', '−'))) err('TITLE_NUMBER_UNGROUNDED', 'art_direction.title', `title number ${n} is not a deterministically displayed value`);

  // ---- watermark / footer
  const wm = spec.watermark ?? {};
  if (wm.text !== profile.watermark.text || wm.layer !== profile.watermark.layer || !(wm.opacity >= profile.watermark.opacity_min && wm.opacity <= profile.watermark.opacity_max)) err('WATERMARK', 'watermark', 'suengj.com behind the plot at ~7% (0.05..0.09)');
  for (const k of profile.footer_required) if (!spec.footer?.[k]) err('FOOTER', `footer.${k}`, 'footer needs period, coverage, source and as_of');
  if (endpoints.length && spec.footer?.as_of) {
    const latest = endpoints.map((e) => e.t).sort().at(-1);
    const quoteAsOf = series.map((s) => s.current_quote?.as_of).filter(Boolean);
    const retrieved = series.map((s) => s.current_quote?.retrieved_at).filter(Boolean);
    if (spec.footer.as_of !== latest && !quoteAsOf.includes(spec.footer.as_of)) err('FOOTER_AS_OF', 'footer.as_of', retrieved.includes(spec.footer.as_of) ? 'retrieved_at is not as_of' : 'as_of must be an actual observation/quote time');
  }

  // ---- comparison
  if (mode === 'dual') {
    const cmp = spec.comparison ?? {};
    const crit = cmp.criteria ?? {};
    const allTrue = profile.comparison.exact_requires.every((k) => crit[k] === true);
    if (cmp.match === 'exact' && !allTrue) err('COMPARISON_NOT_EXACT', 'comparison.match', 'exact needs same event, outcome direction, deadline, resolution rules and currency context');
    if (!['exact', 'related'].includes(cmp.match)) err('COMPARISON_MATCH', 'comparison.match', 'match must be exact or related');
    if (cmp.match === 'related' && (cmp.merged_label || !series.every((s) => s.label))) err('COMPARISON_RELATED_MERGED', 'comparison', 'related markets need separate labels, never merged');
    if (series.some((s) => s.currency_context) && new Set(series.map((s) => s.currency_context)).size > 1 && crit.same_currency_context) err('COMPARISON_CURRENCY', 'comparison.criteria.same_currency_context', 'series currency contexts differ');
    if (cmp.forward_fill !== false) err('NO_FORWARD_FILL', 'comparison.forward_fill', 'forward_fill must be false');
    if (cmp.spread && endpoints.length === 2) {
      const want = round(endpoints[0].p - endpoints[1].p, d);
      if (cmp.spread.value_pp !== want) err('SPREAD_VALUE', 'comparison.spread.value_pp', `spread from raw endpoints is ${want}`);
      if (!String(cmp.spread.display ?? '').endsWith('%p')) err('SPREAD_UNIT', 'comparison.spread.display', 'spread is shown in %p');
      if (PROFIT_WORDS.test(`${cmp.spread.display} ${cmp.spread.caption ?? ''}`)) err('SPREAD_AS_PROFIT', 'comparison.spread', 'a spread is not profit');
      if (cmp.match !== 'exact') err('SPREAD_ON_RELATED', 'comparison.spread', 'spread only for verified exact comparisons');
    }
  }

  // ---- QA and approval
  const qa = spec.qa ?? {};
  if (!qa.numeric_validation || !qa.visual_review || qa.numeric_validation === qa.visual_review) err('QA_NOT_SEPARATE', 'qa', 'numeric validation and visual review are separate records');
  const vr = qa.visual_review ?? {};
  if (vr.status === 'passed') {
    if (!vr.full_size || !vr.phone_size) err('QA_VISUAL_SIZES', 'qa.visual_review', 'visual review covers full size and phone size');
    const cases = new Set(vr.cases ?? []);
    const missing = profile.required_visual_review_cases.filter((x) => !cases.has(x));
    if (missing.length) err('QA_VISUAL_CASES', 'qa.visual_review.cases', `missing ${missing.join(', ')}`);
    if (vr.counts_as_numeric) err('QA_VISUAL_AS_NUMERIC', 'qa.visual_review', 'pixel review cannot pass numeric QA');
  }
  const illus = spec.illustrative === true;
  if (illus && !/(illustrative|가상|예시)/i.test(String(spec.visible_label ?? ''))) err('ILLUSTRATIVE_UNLABELED', 'visible_label', 'fictional mockup must be visibly labeled illustrative');
  if (illus && (qa.owner_approval?.scope === 'production' || qa.owner_approval?.scope === 'factual' || qa.numeric_validation?.status === 'passed')) err('ILLUSTRATIVE_AS_APPROVAL', 'qa', 'an illustrative mockup can only approve visual direction');
  if (spec.publication?.requested) {
    if (illus) err('PUBLISH_ILLUSTRATIVE', 'publication', 'an illustrative mockup is never published as fact');
    if (qa.numeric_validation?.status !== 'passed' || vr.status !== 'passed') err('PUBLISH_QA', 'publication', 'numeric and visual QA must both pass');
    if (qa.owner_approval?.status !== 'approved' || qa.owner_approval?.scope !== 'production') err('PUBLISH_OWNER', 'publication', 'explicit owner production approval required');
  }
  return out;
}
