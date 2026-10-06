#!/usr/bin/env node
/** SUE-1330 Instagram numeric-visual policy tests. 0 API/LLM calls. Every rule has a mutation that must fail with its code. */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkNumericCard, computeAxis, loadNumericProfile } from './lib/numeric-visual-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIX = resolve(ROOT, 'scripts/fixtures/numeric-visual');
const P = loadNumericProfile();
let bad = 0;
const ok = (n, v, d = '') => { console.log(`${v ? 'PASS' : 'FAIL'} ${n}${!v && d ? ` — ${d}` : ''}`); if (!v) bad++; };
const load = (id) => JSON.parse(readFileSync(resolve(FIX, `${id}.json`), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

const REQUIRED = ['single-smooth', 'single-sparse-gapped', 'single-short-history', 'single-zoom', 'single-flat-zero-hundred', 'single-manifold-play-money', 'dual-exact', 'dual-related', 'worked-example-illustrative-mockup'];
const present = readdirSync(FIX).map((f) => f.replace(/\.json$/, ''));
for (const id of REQUIRED) ok(`fixture present: ${id}`, present.includes(id));
for (const id of present) { const r = checkNumericCard(load(id)); ok(`valid fixture passes: ${id}`, r.length === 0, JSON.stringify(r)); }

// fixture semantics the cases claim to cover
const short = load('single-short-history').series[0];
ok('short history labels actual days, not requested 7', short.requested_window_days === 7 && short.displayed_period.label_days === 3);
const gapped = load('single-sparse-gapped');
ok('sparse fixture really contains a >24h gap', gapped.series[0].observations.some((o, i, a) => i && Date.parse(o.t) - Date.parse(a[i - 1].t) > 24 * 3600e3));
ok('zoom fixture is zoomed and labeled', load('single-zoom').axis.zoomed === true);
ok('default axis is the full 0–100%', JSON.stringify(computeAxis([{ p: 40 }, { p: 60 }], { zoom: false, ...P.axis })) === '{"min":0,"max":100,"zoomed":false}');
const za = computeAxis([{ p: 1 }, { p: 3 }], { zoom: true, ...P.axis });
ok('zoom near 0% clamps inside 0..100 with min span', za.min === 0 && za.max >= 20);
const zb = computeAxis([{ p: 99 }, { p: 100 }], { zoom: true, ...P.axis });
ok('zoom near 100% clamps inside 0..100', zb.max === 100 && zb.min >= 0 && zb.max - zb.min >= 20);

// mutations: [name, base fixture, mutate, expected code]
const M = [
  ['image AI draws chart', 'single-smooth', (s) => { s.rendering.image_ai_role = 'chart'; }, 'LANE_IMAGE_AI_DRAWS_DATA'],
  ['AI-rendered chart geometry', 'single-smooth', (s) => { s.rendering.chart_geometry = 'ai_image'; }, 'LANE_CHART_NOT_DETERMINISTIC'],
  ['art direction carries observations', 'single-smooth', (s) => { s.art_direction.observations = []; }, 'LANE_ART_OWNS_DATA'],
  ['decoration over plot', 'single-smooth', (s) => { s.art_direction.decorative_assets = [{ overlaps_plot: true }]; }, 'LANE_DECORATION_OVER_DATA'],
  ['title invents a number', 'single-smooth', (s) => { s.art_direction.title = '확률 60.0% 돌파'; }, 'TITLE_NUMBER_UNGROUNDED'],
  ['wrong canvas', 'single-smooth', (s) => { s.canvas.height = 1080; }, 'CANVAS_SIZE'],
  ['3x scale', 'single-smooth', (s) => { s.canvas.scale = 3; }, 'CANVAS_SCALE'],
  ['dark background', 'single-smooth', (s) => { s.palette.background = '#000000'; }, 'PALETTE_BASE'],
  ['polymarket not cobalt', 'single-smooth', (s) => { s.series[0].color = P.palette.provider_colors.kalshi; }, 'PROVIDER_COLOR'],
  ['manifold uses kalshi coral', 'single-manifold-play-money', (s) => { s.series[0].color = P.palette.provider_colors.kalshi; }, 'PROVIDER_COLOR_MISUSE'],
  ['single with two heroes', 'single-smooth', (s) => { s.layout.hero_numbers = 2; }, 'LAYOUT_SINGLE_HERO'],
  ['dual unequal cards', 'dual-exact', (s) => { s.layout.number_cards[0].size = 'large'; }, 'LAYOUT_DUAL_CARDS'],
  ['current quote appended to history', 'single-smooth', (s) => { const q = { p: 61, as_of: '2026-10-06T09:00:00Z', retrieved_at: '2026-10-06T09:05:00Z' }; s.series[0].current_quote = q; s.series[0].observations.push({ t: q.retrieved_at, p: 61, source: 'current_quote' }); }, 'QUOTE_APPENDED_TO_HISTORY'],
  ['endpoint shows quote not history', 'single-smooth', (s) => { s.series[0].current_quote = { p: 61, as_of: '2026-10-06T09:00:00Z', retrieved_at: '2026-10-06T09:05:00Z' }; s.series[0].endpoint_label = { source: 'current_quote', t: s.series[0].endpoint_label.t, value: 61, text: '61.0%' }; }, 'ENDPOINT_VALUE'],
  ['imprecise endpoint text', 'single-short-history', (s) => { s.series[0].endpoint_label.text = '17%'; }, 'ENDPOINT_TEXT'],
  ['endpoint off last time', 'single-smooth', (s) => { s.series[0].endpoint_label.t = s.series[0].observations[5].t; }, 'ENDPOINT_TIME'],
  ['footer as_of = retrieved_at', 'single-smooth', (s) => { s.series[0].current_quote = { p: 58, as_of: s.series[0].observations.at(-1).t, retrieved_at: '2026-10-06T12:00:00Z' }; s.footer.as_of = '2026-10-06T12:00:00Z'; }, 'FOOTER_AS_OF'],
  ['fake 7-day label on 3-day history', 'single-short-history', (s) => { s.series[0].displayed_period.label_days = 7; }, 'PERIOD_FAKE_DAYS'],
  ['fake 7-day delta window', 'single-short-history', (s) => { s.series[0].delta.window_days = 7; }, 'DELTA_WINDOW_FAKE'],
  ['period not observed range', 'single-short-history', (s) => { s.series[0].displayed_period.start = '2026-09-29T00:00:00Z'; }, 'PERIOD_NOT_OBSERVED'],
  ['delta from resampled curve', 'single-smooth', (s) => { s.series[0].delta.value_pp = 16.7; }, 'DELTA_VALUE'],
  ['delta baseline not raw', 'single-smooth', (s) => { s.series[0].delta.baseline_t = '2026-09-29T12:00:00Z'; }, 'DELTA_BASELINE_NOT_RAW'],
  ['delta shown in %', 'single-smooth', (s) => { s.series[0].delta.display = '+16.5%'; }, 'DELTA_UNIT'],
  ['manifold as cash', 'single-manifold-play-money', (s) => { s.series[0].currency_context = 'cash'; }, 'CURRENCY_CONTEXT'],
  ['manifold profit wording', 'single-manifold-play-money', (s) => { s.series[0].label = 'Manifold 수익률 30%'; }, 'PLAY_MONEY_AS_CASH'],
  ['gap bridged', 'single-sparse-gapped', (s) => { s.gaps.render = 'bridge'; }, 'GAP_NOT_SEGMENTED'],
  ['unlabeled moving average', 'single-smooth', (s) => { s.interpolation.method = 'moving_average'; }, 'INTERPOLATION'],
  ['points dropped', 'single-smooth', (s) => { s.interpolation.preserves_all_points = false; }, 'INTERPOLATION_POINTS'],
  ['forward-filled point', 'single-sparse-gapped', (s) => { s.series[0].observations.splice(2, 0, { t: '2026-09-30T12:00:00Z', p: 31, forward_filled: true }); }, 'NO_FORWARD_FILL'],
  ['probability >100', 'single-flat-zero-hundred', (s) => { s.series[0].observations[1].p = 101; }, 'OBS_RANGE'],
  ['hand-picked axis', 'single-smooth', (s) => { s.axis.min = 40; s.axis.max = 60; s.axis.zoomed = true; s.axis.label = 'zoomed 40–60%'; }, 'AXIS_NOT_DETERMINISTIC'],
  ['zoom unlabeled', 'single-zoom', (s) => { s.axis.label = '%'; }, 'AXIS_ZOOM_UNLABELED'],
  ['per-series axis in dual', 'dual-exact', (s) => { s.series[1].axis = { min: 30, max: 60 }; }, 'AXIS_PER_SERIES'],
  ['watermark over plot', 'single-smooth', (s) => { s.watermark.layer = 'over_plot'; }, 'WATERMARK'],
  ['watermark too strong', 'single-smooth', (s) => { s.watermark.opacity = 0.2; }, 'WATERMARK'],
  ['footer missing coverage', 'single-smooth', (s) => { delete s.footer.coverage; }, 'FOOTER'],
  ['exact without same deadline', 'dual-exact', (s) => { s.comparison.criteria.same_deadline = false; }, 'COMPARISON_NOT_EXACT'],
  ['related merged label', 'dual-related', (s) => { s.comparison.merged_label = true; }, 'COMPARISON_RELATED_MERGED'],
  ['comparison forward-fill', 'dual-exact', (s) => { s.comparison.forward_fill = true; }, 'NO_FORWARD_FILL'],
  ['spread miscomputed', 'dual-exact', (s) => { s.comparison.spread.value_pp = 5; }, 'SPREAD_VALUE'],
  ['spread in %', 'dual-exact', (s) => { s.comparison.spread.display = '4.5%'; }, 'SPREAD_UNIT'],
  ['spread as profit', 'dual-exact', (s) => { s.comparison.spread.caption = '확정 차익 4.5%p'; }, 'SPREAD_AS_PROFIT'],
  ['spread on related', 'dual-related', (s) => { s.comparison.spread = { value_pp: 4.5, display: '+4.5%p' }; }, 'SPREAD_ON_RELATED'],
  ['visual review counts as numeric', 'single-smooth', (s) => { s.qa.numeric_validation = s.qa.visual_review; }, 'QA_NOT_SEPARATE'],
  ['no phone-size review', 'single-smooth', (s) => { s.qa.visual_review.phone_size = false; }, 'QA_VISUAL_SIZES'],
  ['missing watermark/long-title cases', 'single-smooth', (s) => { s.qa.visual_review.cases = ['sparse']; }, 'QA_VISUAL_CASES'],
  ['pixel review passes numeric', 'single-smooth', (s) => { s.qa.visual_review.counts_as_numeric = true; }, 'QA_VISUAL_AS_NUMERIC'],
  ['publish without owner', 'single-smooth', (s) => { s.publication.requested = true; }, 'PUBLISH_OWNER'],
  ['publish without numeric QA', 'single-smooth', (s) => { s.publication.requested = true; s.qa.owner_approval = { status: 'approved', scope: 'production' }; s.qa.numeric_validation.status = 'pending'; }, 'PUBLISH_QA'],
  ['mockup unlabeled', 'worked-example-illustrative-mockup', (s) => { delete s.visible_label; }, 'ILLUSTRATIVE_UNLABELED'],
  ['mockup counted as production approval', 'worked-example-illustrative-mockup', (s) => { s.qa.owner_approval.scope = 'production'; }, 'ILLUSTRATIVE_AS_APPROVAL'],
  ['mockup published', 'worked-example-illustrative-mockup', (s) => { s.publication.requested = true; }, 'PUBLISH_ILLUSTRATIVE'],
  ['dual window misaligned', 'dual-exact', (s) => { const r = s.series[1]; r.observations = r.observations.slice(-4); r.displayed_period = { start: r.observations[0].t, end: r.observations.at(-1).t, label_days: 3 }; delete r.delta; delete s.comparison.spread; }, 'COMPARISON_WINDOW_MISALIGNED'],
  ['dual provider as_of missing', 'dual-exact', (s) => { delete s.series[0].as_of; }, 'COMPARISON_PROVIDER_META_MISSING'],
  ['dual provider as_of wrong', 'dual-related', (s) => { s.series[1].as_of = s.series[1].observations[3].t; }, 'COMPARISON_AS_OF'],
  ['dual provider coverage missing', 'dual-related', (s) => { s.series[1].coverage = ''; }, 'COMPARISON_PROVIDER_META_MISSING'],
  ['dual lines same colour', 'dual-related', (s) => { s.series[1].provider = 'other'; s.series[1].color = '#3D5A80'; s.series[0].provider = 'other2'; s.series[0].color = '#3D5A80'; }, 'COMPARISON_COLORS_NOT_DISTINCT'],
  ['title bare number', 'single-smooth', (s) => { s.art_direction.title = '확률 60 돌파'; }, 'TITLE_NUMBER_UNGROUNDED'],
  ['title 7일 on 3-day history', 'single-short-history', (s) => { s.art_direction.title = '7일 새 급등'; }, 'TITLE_PERIOD_UNOBSERVED'],
  ['title 1주 on 3-day history', 'single-short-history', (s) => { s.art_direction.title = '1주 변화'; }, 'TITLE_PERIOD_UNOBSERVED'],
  ['title 7-day on 3-day history', 'single-short-history', (s) => { s.art_direction.title = '7-day move'; }, 'TITLE_PERIOD_UNOBSERVED'],
  ['fictional data without illustrative flag', 'worked-example-illustrative-mockup', (s) => { s.illustrative = false; delete s.visible_label; s.qa.owner_approval = { status: 'pending' }; }, 'MOCKUP_NOT_ILLUSTRATIVE'],
];
for (const [name, base, mut, code] of M) {
  const s = clone(load(base)); mut(s);
  const codes = checkNumericCard(s).map((e) => e.code);
  ok(`rejects ${name} → ${code}`, codes.includes(code), `got ${JSON.stringify(codes)}`);
}
// positive control: production publication passes when every gate is met
const pub = clone(load('single-smooth')); pub.publication.requested = true; pub.qa.owner_approval = { status: 'approved', scope: 'production' };
ok('publication allowed only with numeric+visual QA and owner production approval', checkNumericCard(pub).length === 0);
const lab = clone(load('single-smooth')); lab.interpolation = { method: 'moving_average', requested: true, label: '3-point moving average (requested)', preserves_all_points: true };
ok('title bare number matching a displayed value is allowed', (() => { const t = clone(load('single-smooth')); t.art_direction.title = '확률 58 근접'; return checkNumericCard(t).length === 0; })());
ok('labeled, requested smoothing is allowed', checkNumericCard(lab).length === 0);

const yr = clone(load('single-smooth')); yr.deadline = '2026-10-31T00:00:00Z'; yr.art_direction.title = '2026년 10월 31일 마감 금리 인하 확률 58.0%';
ok('title year and declared deadline date are not number claims', checkNumericCard(yr).length === 0, JSON.stringify(checkNumericCard(yr)));
const yr2 = clone(yr); yr2.art_direction.title = '2026년 금리 인하 확률 60';
ok('rejects bare probability next to a year → TITLE_NUMBER_UNGROUNDED', checkNumericCard(yr2).some((e) => e.code === 'TITLE_NUMBER_UNGROUNDED'));
const yr3 = clone(yr); yr3.art_direction.title = '11월 15일 마감 금리 인하 확률 58.0%';
ok('rejects undeclared date in title → TITLE_DATE_UNGROUNDED', checkNumericCard(yr3).some((e) => e.code === 'TITLE_DATE_UNGROUNDED'));

console.log(bad ? `numeric-visual: FAIL (${bad})` : 'numeric-visual: OK');
process.exit(bad ? 1 : 0);
