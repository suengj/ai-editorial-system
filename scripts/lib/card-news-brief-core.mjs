import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkTrendCardEligibility } from './numeric-visual-core.mjs';
import { loadPmcPlotBundle, pmcPlotToChartSpec } from './pmc-bundle-binding.mjs';

const substantive = (value) => String(value ?? '').replace(/\s+/gu, '').length;
const issue = (code, message, card_id = undefined) => ({ code, message, ...(card_id ? { card_id } : {}) });
const englishMagnitude = /\b(?:billion|million|trillion)\b/iu;
const labelNumber = (value) => {
  const match = String(value ?? '').replace(/,/g, '').match(/[-+−]?\d+(?:\.\d+)?/u);
  return match ? Number(match[0].replace('−', '-')) : null;
};

function magnitudeStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) magnitudeStrings(item, out);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) magnitudeStrings(item, out);
  return out;
}

function isTrendChart(spec) {
  if (spec?.type === 'number_visual' && spec.layout === 'trend-area') return true;
  if (!['line', 'area'].includes(spec?.type)) return false;
  const temporal = (point) => Array.isArray(point)
    ? (typeof point[0] === 'string' && Number.isFinite(Date.parse(point[0])) || Number.isFinite(point[0]) && point[0] > 1e9)
    : point && (typeof point.observed_at === 'string' || typeof point.t === 'string' || Number.isFinite(point.timestamp));
  if ((spec.series ?? []).some((series) => (series.points ?? []).some(temporal)) || (spec.points ?? []).some(temporal)) return true;
  return (spec.series ?? []).some((series) => /market_pmc|official[_ -]statistics/i.test(series.claim ?? series.source_type ?? ''));
}

/** Content gate shared by the resolver and carousel renderer. Sidecar facts never enter the card artwork. */
export function validateCardNewsBrief(series, brief) {
  const issues = [];
  if (!series || !Array.isArray(series.frames)) return { ok: false, issues: [issue('CARD_NEWS_SERIES', 'a card-news series with frames is required')] };
  if (!brief || brief.schema_version !== '1.0.0') return { ok: false, issues: [issue('CARD_NEWS_BRIEF_REQUIRED', 'brief.json with schema_version 1.0.0 is required')] };
  if (typeof brief.reader_question !== 'string' || brief.reader_question.trim().length < 12) issues.push(issue('CARD_NEWS_READER_QUESTION', 'reader_question must state what the reader wants to know'));
  if (typeof brief.angle !== 'string' || brief.angle.trim().length < 20) issues.push(issue('CARD_NEWS_ANGLE', 'angle must be a one-sentence thesis'));
  if (typeof brief.so_what !== 'string' || brief.so_what.trim().length < 20) issues.push(issue('CARD_NEWS_SO_WHAT', 'so_what must explain the implication for the target reader'));
  const facts = Array.isArray(brief.facts) ? brief.facts : [];
  if (facts.length < 6 || facts.length > 10) issues.push(issue('CARD_NEWS_FACT_COUNT', 'brief requires 6–10 dated, sourced facts'));
  const factIds = new Set();
  for (const fact of facts) {
    if (!fact?.id || factIds.has(fact.id)) issues.push(issue('CARD_NEWS_FACT_ID', 'fact ids must be present and unique'));
    factIds.add(fact?.id);
    if (![fact?.value, fact?.date, fact?.source_name, fact?.source_url].every((x) => typeof x === 'string' && x.trim())) issues.push(issue('CARD_NEWS_FACT_SOURCE', `fact ${fact?.id ?? '(missing id)'} needs value, date, source_url, and source_name`));
    try { if (new URL(fact.source_url).protocol !== 'https:') throw new Error(); } catch { issues.push(issue('CARD_NEWS_FACT_URL', `fact ${fact?.id ?? '(missing id)'} needs an https source_url`)); }
  }
  const mapped = brief.per_card && typeof brief.per_card === 'object' ? brief.per_card : {};
  if (series.profiles?.artifact === 'visual/prediction-market-carousel') {
    for (const frame of series.frames) {
      const visible = [frame.headline, ...(frame.blocks ?? []).filter((block) => block.kind === 'text').map((block) => block.text)];
      for (const block of frame.blocks ?? []) {
        if (block.kind !== 'chart') continue;
        try { visible.push(...magnitudeStrings(JSON.parse(readFileSync(resolve(brief._series_dir ?? process.cwd(), block.ref), 'utf8')))); }
        catch { /* The chart validator reports missing or invalid chart bytes separately. */ }
      }
      if (visible.some((value) => englishMagnitude.test(String(value ?? '')))) issues.push(issue('CARD_NEWS_KO_MAGNITUDE', 'Korean visible text must not use English magnitude words (billion, million, trillion)', frame.id));
    }
  }
  if (series.profiles?.artifact === 'visual/prediction-market-carousel') {
    const trendFrames = series.frames.filter((frame) => (frame.blocks ?? []).some((block) => {
      if (block.kind !== 'chart') return false;
      try { return isTrendChart(JSON.parse(readFileSync(resolve(brief._series_dir ?? process.cwd(), block.ref), 'utf8'))); }
      catch { return false; }
    }));
    if (trendFrames.length) {
      const trendIssueAdd = (problem, cardId) => issues.push(issue(problem.code, problem.message, cardId));
      for (const frame of trendFrames) {
        const eligibility = brief.trend_eligibility;
        if (eligibility?.source_type === 'market_pmc') {
          for (const problem of checkTrendCardEligibility(eligibility)) trendIssueAdd(problem, frame.id);
          try {
            const bundle = loadPmcPlotBundle(resolve(brief._series_dir ?? process.cwd(), series.source?.ref ?? ''));
            const pmc = bundle.plot.points.map((point) => ({ t: point.observed_at, p: Number((point.value * 100).toPrecision(12)) }));
            const supplied = eligibility?.observations ?? [];
            if (JSON.stringify(supplied) !== JSON.stringify(pmc)) trendIssueAdd({ code: 'TREND_PMC_BINDING', message: 'trend history must exactly match ordered observations in the selected verified PMC bundle' }, frame.id);
          } catch {
            trendIssueAdd({ code: 'TREND_PMC_BINDING', message: 'a verified selected PMC bundle is required for market trend eligibility' }, frame.id);
          }
        } else if (eligibility?.source_type === 'official_statistics') {
          try {
            loadPmcPlotBundle(resolve(brief._series_dir ?? process.cwd(), series.source?.ref ?? ''));
            trendIssueAdd({ code: 'TREND_SOURCE_TYPE_MISMATCH', message: 'a verified PMC bundle must use market_pmc eligibility' }, frame.id);
          } catch { /* a non-PMC source may use official-statistics eligibility */ }
          if (!String(eligibility.source_name ?? '').trim() || !String(eligibility.source_url ?? '').startsWith('https://')) trendIssueAdd({ code: 'TREND_SOURCE_REQUIRED', message: 'official statistics trend needs a named HTTPS source' }, frame.id);
          if (!String(eligibility.observation_period ?? '').trim()) trendIssueAdd({ code: 'TREND_PERIOD_REQUIRED', message: 'official statistics trend needs an observation period' }, frame.id);
          if (eligibility.comparable !== true) trendIssueAdd({ code: 'TREND_COMPARABILITY_REQUIRED', message: 'official statistics trend needs an explicit comparability check' }, frame.id);
          const observations = eligibility.observations ?? [];
          if (observations.length < 2) trendIssueAdd({ code: 'TREND_HISTORY_REQUIRED', message: 'trend cards require at least two history points' }, frame.id);
          if (observations.length >= 2) {
            const valid = observations.every((point, index) => Number.isFinite(Date.parse(point?.t)) && Number.isFinite(point?.p) && point.p >= 0 && point.p <= 100 && (index === 0 || Date.parse(point.t) > Date.parse(observations[index - 1]?.t)));
            if (!valid) trendIssueAdd({ code: 'TREND_HISTORY_INVALID', message: 'history must contain finite ordered observations' }, frame.id);
            const actual = observations.at(-1).p > observations[0].p ? 'up' : observations.at(-1).p < observations[0].p ? 'down' : 'flat';
            if (eligibility.direction !== actual || actual === 'flat') trendIssueAdd({ code: 'TREND_DIRECTION', message: 'trend direction must match the first and last observations' }, frame.id);
          }
        } else {
          trendIssueAdd({ code: 'TREND_SOURCE_TYPE_REQUIRED', message: 'trend eligibility must identify a market_pmc or official_statistics source' }, frame.id);
        }
      }
    }
  }
  const usedFacts = new Set();
  for (const frame of series.frames) {
    const card = mapped[frame.id];
    const evidenceIds = Array.isArray(card?.evidence_fact_ids) ? card.evidence_fact_ids : [];
    const validIds = evidenceIds.filter((id) => factIds.has(id));
    if (!card || !card.claim || !card.evidence || !card.takeaway || !validIds.length) {
      issues.push(issue('CARD_NEWS_CARD_EVIDENCE', 'each card needs a claim, evidence line linked to a brief fact, and takeaway', frame.id));
    }
    for (const id of validIds) usedFacts.add(id);
    const nativeCopy = frame.art_direction?.render_method === 'native_card' ? (frame.art_direction.native_prompt_strings ?? []).slice(1).join('\n') : '';
    const body = [...(frame.blocks ?? []).filter((b) => b?.kind === 'text' && b.id !== 'headline' && b.region !== 'headline' && b.region !== 'hero-value').map((b) => b.text ?? ''), nativeCopy].filter(Boolean).join('\n');
    const chars = substantive(body);
    const lines = body.split(/\n+/u).map((x) => x.trim()).filter((x) => substantive(x) >= 8);
    if (chars < 45 || lines.length < 2) issues.push(issue('CARD_NEWS_BODY_TOO_THIN', `body needs at least two substantive lines and about 45 Korean characters (got ${chars} chars, ${lines.length} lines)`, frame.id));
    if (chars > 120) issues.push(issue('CARD_NEWS_BODY_TOO_LONG', `body exceeds the 120-character readability cap (got ${chars})`, frame.id));
    const hero = (frame.blocks ?? []).find((block) => block?.kind === 'text' && (block.region === 'hero-value' || block.text_role === 'hero'));
    if (hero?.text && body.includes(hero.text)) issues.push(issue('CARD_NEWS_HERO_REPEAT', 'supporting copy must not repeat the hero number', frame.id));
    const scenarioCard = /scenario|시나리오/i.test([frame.id, frame.headline, ...(frame.blocks ?? []).map((block) => block?.ref ?? block?.id ?? '')].join(' '));
    if (scenarioCard && !/(환율|대출\s*금리)/u.test(body)) issues.push(issue('CARD_NEWS_SCENARIO_IMPACT', 'scenario cards must state an impact on the reader, such as 환율 or 대출금리', frame.id));
    if (/^\s*(?:\d+(?:\.\d+)?\s*[%％]?|[₩$]\s*[\d,.]+)\s*$/mu.test(body) || (/^[^\n]{1,28}$/u.test(body.trim()) && /[!！?？]/u.test(body))) issues.push(issue('CARD_NEWS_NUMBER_SLOGAN', 'a bare number or slogan cannot stand in for card substance', frame.id));
    if (card?.evidence) {
      const evidenceNumbers = String(card.evidence).match(/\d+(?:[.,]\d+)?/gu) ?? [];
      const visibleCopy = [frame.headline, ...(frame.blocks ?? []).filter((b) => b?.kind === 'text').map((b) => b.text ?? ''), ...(frame.art_direction?.render_method === 'native_card' ? frame.art_direction.native_prompt_strings ?? [] : [])].join('\n');
      const visibleNumbers = visibleCopy.match(/\d+(?:[.,]\d+)?/gu) ?? [];
      if (!evidenceNumbers.some((n) => visibleNumbers.includes(n))) issues.push(issue('CARD_NEWS_EVIDENCE_NOT_VISIBLE', 'at least one concrete number or date from the evidence must appear in visible card copy', frame.id));
      const boundFactIds = new Set([...(card.evidence_fact_ids ?? []), ...(card.visual_fact_ids ?? [])]);
      const canonicalNumbers = facts.filter((fact) => boundFactIds.has(fact.id)).flatMap((fact) => String(fact.value ?? '').match(/\d+(?:[.,]\d+)?\s*[%％]?/gu) ?? []);
      const heroNumbers = String(hero?.text ?? '').match(/\d+(?:[.,]\d+)?\s*[%％]?/gu) ?? [];
      if (heroNumbers.some((n) => !canonicalNumbers.some((value) => value.replace(/\s/gu, '') === n.replace(/\s/gu, '')))) issues.push(issue('CARD_NEWS_HERO_NOT_CANONICAL', 'hero values must exactly match a canonical brief fact value', frame.id));
      if (series.profiles?.artifact === 'visual/prediction-market-carousel') {
        if (!Array.isArray(card.visual_fact_ids) || !card.visual_fact_ids.length || card.visual_fact_ids.some((id) => !factIds.has(id))) issues.push(issue('CARD_NEWS_VISUAL_FACT_BINDING', 'prediction-market cards must bind every data visual to canonical visual_fact_ids', frame.id));
        const canonicalDigits = new Set(facts.filter((fact) => boundFactIds.has(fact.id)).flatMap((fact) => `${fact.value ?? ''} ${fact.date ?? ''}`.match(/\d+(?:[.,]\d+)?/gu) ?? []).map((n) => n.replace(/,/g, '')));
        const visibleDigits = visibleCopy.match(/\d+(?:[.,]\d+)?/gu) ?? [];
        if (visibleDigits.some((n) => !canonicalDigits.has(n.replace(/,/g, '')))) issues.push(issue('CARD_NEWS_VISIBLE_NUMBER_NOT_CANONICAL', 'every visible number must match a fact bound to this card', frame.id));
      }
    }
  }
  if (usedFacts.size < 6) issues.push(issue('CARD_NEWS_FACTS_USED', `at least six distinct brief facts must be used across the series (got ${usedFacts.size})`));
  for (const id of Object.keys(mapped)) if (!series.frames.some((frame) => frame.id === id)) issues.push(issue('CARD_NEWS_ORPHAN_CARD', `brief has an unknown card id: ${id}`, id));
  return { ok: issues.length === 0, issues, fact_count: facts.length, distinct_facts_used: usedFacts.size };
}

export function validateCardNewsContentQa(contentQa, series=null) {
  const issues = [];
  if (!contentQa || contentQa.schema_version !== '1.0.0') return { ok: false, issues: [issue('CARD_NEWS_CONTENT_QA_REQUIRED', 'content-qa.json with schema_version 1.0.0 is required')] };
  if (typeof contentQa.would_a_smart_reader_learn_something_new !== 'string' || contentQa.would_a_smart_reader_learn_something_new.trim().length < 20) issues.push(issue('CARD_NEWS_CONTENT_QA_LEARNING', 'content-qa must answer what a smart reader learns'));
  if (typeof contentQa.one_surprising_fact !== 'string' || contentQa.one_surprising_fact.trim().length < 10) issues.push(issue('CARD_NEWS_CONTENT_QA_SURPRISE', 'content-qa must state one surprising fact'));
  if (contentQa.sources_are_sidecar_only !== true || contentQa.disclaimers_or_meta_on_cards !== false) issues.push(issue('CARD_NEWS_CONTENT_QA_POLICY', 'content-qa must confirm sidecar-only sources and no disclaimers/meta on cards'));
  if (series && (!Array.isArray(contentQa.reviewed_cards) || JSON.stringify([...contentQa.reviewed_cards].sort()) !== JSON.stringify(series.frames.map((frame) => frame.id).sort()))) issues.push(issue('CARD_NEWS_CONTENT_QA_COVERAGE', 'content-qa reviewed_cards must cover every card exactly once'));
  return { ok: issues.length === 0, issues };
}

/** Confirm that numeric chart data and number-bearing labels belong to each card's cited facts. */
export function validateCardNewsChartFacts(series, brief, baseDir = process.cwd()) {
  const issues = [];
  let sourcePmcBundle = null;
  try { if (series.source?.ref) sourcePmcBundle = loadPmcPlotBundle(resolve(baseDir, series.source.ref)); } catch { /* A non-PMC source is validated by its declared receipt and facts. */ }
  if (series.profiles?.artifact !== 'visual/prediction-market-carousel' && brief.trend_eligibility?.source_type !== 'market_pmc' && !sourcePmcBundle) return { ok: true, issues };
  const facts = new Map((brief.facts ?? []).map((fact) => [fact.id, fact]));
  const nums = (value) => String(value ?? '').match(/[-+−]?\d+(?:[.,]\d+)?/gu)?.map((n) => Number(n.replace(/,/g, '').replace('−', '-'))) ?? [];
  const add = (frame, message) => issues.push(issue('CARD_NEWS_CHART_NOT_CANONICAL', message, frame.id));
  for (const frame of series.frames) for (const block of frame.blocks ?? []) {
    if (block.kind !== 'chart') continue;
    const card = brief.per_card?.[frame.id] ?? {};
    const ids = [...(card.visual_fact_ids ?? [])];
    const allowed = new Set(ids.flatMap((id) => {
      const fact = facts.get(id);
      return fact ? nums(`${fact.value ?? ''} ${fact.date ?? ''}`) : [];
    }));
    let spec;
    try { spec = JSON.parse(readFileSync(resolve(baseDir, block.ref), 'utf8')); }
    catch { add(frame, `data visual bytes are missing or invalid: ${block.ref}`); continue; }
    const eligibility = brief.trend_eligibility ?? {};
    const requiresTrendBinding = isTrendChart(spec);
    if (requiresTrendBinding) {
      if (eligibility.source_type === 'market_pmc' || sourcePmcBundle) {
        try {
          const bundle = sourcePmcBundle ?? loadPmcPlotBundle(resolve(baseDir, series.source.ref));
          if (spec.type === 'number_visual' && spec.layout === 'trend-area') {
            const expected = bundle.plot.points.filter((point) => point.value !== null).map((point) => ({ observed_at: point.observed_at, value: Number((point.value * 100).toPrecision(12)) }));
            const dateLabel = (iso) => { const d = new Date(iso); return `${String(d.getUTCMonth()+1).padStart(2,'0')}.${String(d.getUTCDate()).padStart(2,'0')}`; };
            const signedDelta = Number(bundle.plot.delta.value_pp);
            const expectedDelta = `${signedDelta > 0 ? '+' : signedDelta < 0 ? '−' : ''}${Number(Math.abs(signedDelta).toPrecision(12))}%p`;
            const expectedStartLabel = `${expected[0]?.value}%`;
            const expectedEndLabel = `${expected.at(-1)?.value}%`;
            const renderMode = spec.render_mode ?? (series.profiles?.artifact === 'visual/prediction-market-carousel' ? 'flow' : 'raw');
            if (!['raw','flow'].includes(renderMode) || (renderMode === 'flow' && ((spec.intermediate_labels?.length ?? 0) > 0 || spec.points?.some((point) => point.label !== undefined)))
              || JSON.stringify(spec.points) !== JSON.stringify(expected) || spec.start !== expected[0]?.value || spec.end !== expected.at(-1)?.value
              || spec.start_label !== expectedStartLabel || spec.end_label !== expectedEndLabel
              || spec.start_date !== dateLabel(bundle.plot.delta.baseline_at) || spec.end_date !== dateLabel(bundle.plot.delta.last_at)
              || spec.delta_label !== expectedDelta) add(frame, 'trend-area points, endpoints, dates, and signed delta must match the selected verified PMC bundle');
          } else {
            const expected = pmcPlotToChartSpec(bundle);
            const displayedText = (chart) => ({
              title: chart.title, period: chart.period, source_note: chart.source_note,
              x: { label: chart.x?.label, show_label: chart.x?.show_label, tick_labels: chart.x?.tick_labels },
              y: { label: chart.y?.label, unit: chart.y?.unit, decimals: chart.y?.decimals, min: chart.y?.min, max: chart.y?.max },
              series: chart.series?.map((item) => ({ name: item.name, claim: item.claim })),
            });
            const actualSeries = spec.series?.map((item) => ({ name: item.name, claim: item.claim, points: item.points }));
            const expectedSeries = expected.series.map((item) => ({ name: item.name, claim: item.claim, points: item.points }));
            if (spec.type !== 'line' || JSON.stringify(actualSeries) !== JSON.stringify(expectedSeries)
              || JSON.stringify(displayedText(spec)) !== JSON.stringify(displayedText(expected))) add(frame, 'trend chart points and displayed labels must match the selected verified PMC bundle');
          }
        } catch { add(frame, 'trend chart cannot be bound to the selected verified PMC bundle'); }
      } else if (eligibility.source_type === 'official_statistics') {
        const observations = eligibility.observations ?? [];
        const expectedPoints = observations.map((point) => [Date.parse(point.t), point.p]);
        const actualPoints = spec.series?.length === 1 ? spec.series[0].points : null;
        const receiptValid = typeof eligibility.source_name === 'string' && eligibility.source_name.trim()
          && typeof eligibility.source_url === 'string' && eligibility.source_url.startsWith('https://')
          && typeof eligibility.observation_period === 'string' && eligibility.observation_period.trim()
          && eligibility.comparable === true && expectedPoints.length >= 2 && expectedPoints.every(([t, p]) => Number.isFinite(t) && Number.isFinite(p));
        if (!receiptValid || spec.type !== 'line' || spec.period !== eligibility.observation_period
          || !String(spec.source_note ?? '').includes(eligibility.source_name)
          || JSON.stringify(actualPoints) !== JSON.stringify(expectedPoints)) {
          add(frame, 'official trend chart must match the brief source/period receipt and ordered observations');
        }
      } else add(frame, 'trend chart requires a declared market_pmc or official_statistics source type');
      continue;
    }
    if (spec.type !== 'number_visual') continue;
    let values = [], labels = [];
    if (spec.layout === 'comparison-bars') {
      values = (spec.items ?? []).map((item) => item.value);
      labels = (spec.items ?? []).flatMap((item) => [item.label, item.value_label]);
    } else if (spec.layout === 'dot-grid') {
      values = [spec.filled]; labels = [spec.value_label, spec.caption?.replace(/\b100\b/gu, '')];
    } else if (spec.layout === 'trend-area') {
      values = [spec.start, spec.end, ...(spec.points ?? []).map((point) => point.value)];
      labels = [spec.start_label, spec.end_label, spec.start_date, spec.end_date, spec.delta_label];
      if (brief.trend_eligibility?.source_type === 'market_pmc') {
        try {
          const bundle = loadPmcPlotBundle(resolve(baseDir, series.source.ref));
          allowed = new Set([...allowed, ...bundle.plot.points.filter((point) => point.value !== null).map((point) => Number((point.value * 100).toPrecision(12)))]);
        } catch { /* The PMC binding branch above emits the diagnostic. */ }
      }
    } else if (spec.layout === 'dual-metric') {
      values = (spec.items ?? []).map((item) => item.value);
      labels = (spec.items ?? []).flatMap((item) => [item.label, item.value_label]);
    } else if (spec.layout === 'rate-gap-ratio') {
      values = [...(spec.rates ?? []).map((rate) => rate.value), spec.ratio?.outflow, spec.ratio?.inflow];
      labels = [...(spec.rates ?? []).map((rate) => rate.label), spec.ratio?.outflow_label, spec.ratio?.inflow_label];
      labels.push(spec.ratio?.outflow_amount_label, spec.ratio?.inflow_amount_label);
    } else if (spec.layout === 'scenario-split') {
      labels = [spec.date, ...(spec.scenarios ?? []).flatMap((scenario) => [scenario.label, ...(scenario.detail_lines ?? [])])];
    }
    if (values.some((value) => !Number.isFinite(value) || !allowed.has(value))) add(frame, 'chart data values must match numbers in the card visual_fact_ids');
    if (labels.flatMap(nums).some((value) => !allowed.has(value))) add(frame, 'number-bearing chart labels must match the card visual_fact_ids');
    const labeledValues = [ ...(spec.items ?? []).map((item) => ({ ...item, display_value: item.value_label })), ...(spec.rates ?? []) ].filter((item) => typeof item?.label === 'string' && Number.isFinite(item.value));
    if (spec.layout === 'rate-gap-ratio' && Number.isFinite(spec.ratio?.outflow) && Number.isFinite(spec.ratio?.inflow)) {
      labeledValues.push(
        { label: spec.ratio.outflow_label, value: spec.ratio.outflow, display_value: spec.ratio.outflow_amount_label ?? String(spec.ratio.outflow), direction: 'outflow' },
        { label: spec.ratio.inflow_label, value: spec.ratio.inflow, display_value: spec.ratio.inflow_amount_label ?? String(spec.ratio.inflow), direction: 'inflow' },
      );
    }
    if (labeledValues.length) {
      const bindings = Array.isArray(card.visual_value_bindings) ? card.visual_value_bindings : [];
      const usedBindings = new Set();
      for (const item of labeledValues) {
        const index = bindings.findIndex((binding) => binding?.label === item.label && binding?.value === item.value
          && (item.display_value === undefined || binding?.display_value === item.display_value));
        const binding = index >= 0 ? bindings[index] : null;
        const fact = binding && facts.get(binding.fact_id);
        const expectedDirection = item.direction ?? null;
        const directionMatch = !expectedDirection || (fact?.direction === expectedDirection && fact?.amount === item.value && binding?.direction === expectedDirection);
        if (!binding || usedBindings.has(index) || !ids.includes(binding.fact_id) || !fact || !nums(fact.value).includes(item.value) || !directionMatch) {
          add(frame, `labeled value ${item.label}=${item.value} must bind to its own visual fact`);
        } else usedBindings.add(index);
      }
      if (usedBindings.size !== labeledValues.length || bindings.length !== labeledValues.length) add(frame, 'visual_value_bindings must cover every labeled chart value exactly once');
    }
  }
  return { ok: issues.length === 0, issues };
}

export function loadAndValidateCardNewsBrief(series, seriesPath) {
  const profileRequiresBrief = series.profiles?.artifact === 'visual/prediction-market-carousel';
  const requiresBrief = profileRequiresBrief || series.requires_brief === true;
  if (!requiresBrief && series.content_kind !== 'card-news') return { ok: true, applies: false, issues: [] };
  if (requiresBrief && series.requires_brief !== true) {
    return { ok: false, applies: true, issues: [issue('CARD_NEWS_PROFILE_CONTRACT', 'selected profile requires requires_brief: true and content_kind: card-news')] };
  }
  const briefPath = resolve(seriesPath ? resolve(seriesPath, '..') : process.cwd(), series.brief_file ?? 'brief.json');
  let brief, contentQa;
  try { brief = JSON.parse(readFileSync(briefPath, 'utf8')); }
  catch { return { ok: false, applies: true, brief_path: briefPath, issues: [issue('CARD_NEWS_BRIEF_REQUIRED', `required brief sidecar is missing or invalid: ${briefPath}`)] }; }
  const qaPath = resolve(seriesPath ? resolve(seriesPath, '..') : process.cwd(), 'content-qa.json');
  try { contentQa = JSON.parse(readFileSync(qaPath, 'utf8')); }
  catch { return { ok: false, applies: true, brief_path: briefPath, content_qa_path: qaPath, issues: [issue('CARD_NEWS_CONTENT_QA_REQUIRED', `required content-qa sidecar is missing or invalid: ${qaPath}`)] }; }
  brief._series_dir = resolve(seriesPath ? resolve(seriesPath, '..') : process.cwd());
  const briefResult = validateCardNewsBrief(series, brief);
  const chartResult = validateCardNewsChartFacts(series, brief, brief._series_dir);
  const qaResult = validateCardNewsContentQa(contentQa, series);
  return { ok: briefResult.ok && chartResult.ok && qaResult.ok, issues: [...briefResult.issues, ...chartResult.issues, ...qaResult.issues], applies: true, brief_path: briefPath, content_qa_path: qaPath, brief, content_qa: contentQa, fact_count: briefResult.fact_count, distinct_facts_used: briefResult.distinct_facts_used };
}
