import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { renderedChartTextFields, validateCardNewsBrief, validateCardNewsChartFacts, validateCardNewsContentQa } from './lib/card-news-brief-core.mjs';
import { renderNumberVisualPanel } from './lib/chart-renderer.mjs';
import { planCarousel } from './lib/carousel-core.mjs';

const frames = Array.from({ length: 6 }, (_, i) => ({
  id: `card-${i + 1}`, headline: `헤드라인 ${i + 1}`,
  blocks: [{ id: 'copy', kind: 'text', region: 'copy', text: `첫째 근거 문장에 2026년 10월 ${i + 14}일 수치를 담습니다.\n둘째 문장에서 독자에게 작동 원리를 구체적으로 설명합니다.` }],
}));
const facts = Array.from({ length: 6 }, (_, i) => ({ id: `fact-${i + 1}`, value: `확인된 사실 ${i + 1}: ${i + 1}%`, date: `2026-10-${14 + i}`, source_url: `https://example.com/${i + 1}`, source_name: '검증 출처' }));
const series = { frames };
const brief = {
  schema_version: '1.0.0', reader_question: '연준 금리 인상 계약의 가격이 의미하는 바는 무엇인가?',
  angle: '뜨거운 물가와 약한 고용이 맞서는 가운데 시장 가격은 인상 가능성을 높게 둔다.',
  facts, so_what: '한국 독자는 미국 금리 변화가 환율과 수입 가격, 국내 차입 비용으로 이어지는 경로를 읽을 수 있다.',
  per_card: Object.fromEntries(frames.map((f, i) => [f.id, { claim: '가격은 이벤트 확률의 시장 표시다.', evidence: `2026-10-${14 + i} 기준으로 0.${i + 1} 수치가 확인된다.`, evidence_fact_ids: [`fact-${i + 1}`], takeaway: '가격과 실제 사건을 구분해서 읽는다.' }])),
};
assert.equal(validateCardNewsBrief(series, brief).ok, true);
const statsSeries = structuredClone(series);
statsSeries.profiles = { artifact: 'visual/prediction-market-carousel' };
statsSeries.source = { ref: 'stats/history.csv', scope: 'source_bound' };
statsSeries.frames[0].blocks.push({ id: 'trend-chart', kind: 'chart', ref: 'stats/history.csv' });
const statsBrief = structuredClone(brief);
for (const card of Object.values(statsBrief.per_card)) card.visual_fact_ids = [...card.evidence_fact_ids];
statsBrief.trend_eligibility = { source_type: 'official_statistics', source_name: 'National Statistics Office', source_url: 'https://stats.example.gov/series', observation_period: '2020–2025 annual observations', comparable: true, observations: [{ t: '2020-01-01T00:00:00Z', p: 20 }, { t: '2025-01-01T00:00:00Z', p: 40 }], direction: 'up' };
assert.equal(validateCardNewsBrief(statsSeries, statsBrief).ok, true, 'official statistics use source, period, and comparability checks without market liquidity/freshness');
const officialChartDir = mkdtempSync(resolve(tmpdir(), 'aes-card-news-official-chart-'));
const officialChartPath = resolve(officialChartDir, 'official-trend-chart.json');
statsSeries.frames[0].function = 'show_evidence';
statsSeries.frames.find((frame) => frame.id === 'card-1').blocks.find((block) => block.kind === 'chart').ref = 'official-trend-chart.json';
const officialChart = { type:'line', period:statsBrief.trend_eligibility.observation_period, source_note:statsBrief.trend_eligibility.source_name, series:[{name:'Official trend',claim:'official-statistics:series',points:statsBrief.trend_eligibility.observations.map((point) => [Date.parse(point.t), point.p])}] };
writeFileSync(officialChartPath, JSON.stringify(officialChart));
const officialChartResult = validateCardNewsChartFacts(statsSeries, statsBrief, officialChartDir);
assert.equal(officialChartResult.ok, true, `official-statistics charts bind to their source/period receipt without loading a PMC bundle (${JSON.stringify(officialChartResult.issues)})`);
statsSeries.frames[0].blocks.find((block) => block.kind === 'chart').id = 'visual';
statsSeries.frames[0].blocks.find((block) => block.kind === 'chart').ref = 'virtual/chart.json';
mkdirSync(resolve(officialChartDir, 'virtual'));
writeFileSync(resolve(officialChartDir, 'virtual/chart.json'), JSON.stringify(officialChart));
statsBrief._series_dir = officialChartDir;
assert.equal(validateCardNewsBrief(statsSeries, { ...statsBrief, _series_dir: officialChartDir }).ok, true, 'time-series trend eligibility is detected from chart geometry regardless of id or filename');
const noTrendHistory = { ...statsBrief, trend_eligibility: { ...statsBrief.trend_eligibility, observations: [] }, _series_dir: officialChartDir };
assert.equal(validateCardNewsBrief(statsSeries, noTrendHistory).ok, false, 'renamed time-series charts still require trend eligibility evidence');
const wrongOfficialPeriod = structuredClone(officialChart); wrongOfficialPeriod.period = '2025 only';
writeFileSync(resolve(officialChartDir, 'virtual/chart.json'), JSON.stringify(wrongOfficialPeriod));
assert.equal(validateCardNewsChartFacts(statsSeries, statsBrief, officialChartDir).ok, false, 'official-statistics chart period must match its receipt');
statsSeries.frames[0].blocks.find((block) => block.kind === 'chart').ref = 'official-trend-chart.json';
writeFileSync(officialChartPath, JSON.stringify(officialChart));
const statsNoComparable = structuredClone(statsBrief); statsNoComparable.trend_eligibility.comparable = false;
assert(validateCardNewsBrief(statsSeries, statsNoComparable).issues.some((x) => x.code === 'TREND_COMPARABILITY_REQUIRED'));
const statsNoSource = structuredClone(statsBrief); statsNoSource.trend_eligibility.source_url = '';
assert(validateCardNewsBrief(statsSeries, statsNoSource).issues.some((x) => x.code === 'TREND_SOURCE_REQUIRED'));
const fail = (mutate, code) => { const s = structuredClone(series), b = structuredClone(brief); mutate(s, b); assert(validateCardNewsBrief(s, b).issues.some((x) => x.code === code), code); };
fail((s, b) => { delete b.per_card['card-1']; }, 'CARD_NEWS_CARD_EVIDENCE');
fail((s, b) => { s.frames[0].blocks[0].text = '둘째 줄'; }, 'CARD_NEWS_BODY_TOO_THIN');
fail((s, b) => { s.frames[0].blocks[0].text = `${'가'.repeat(121)}\n${'나'.repeat(5)}`; }, 'CARD_NEWS_BODY_TOO_LONG');
fail((s, b) => { b.per_card['card-1'].evidence_fact_ids = ['unknown']; }, 'CARD_NEWS_CARD_EVIDENCE');
fail((s, b) => { s.frames[0].blocks.unshift({ id: 'hero', kind: 'text', region: 'hero-value', text: '7%', text_role: 'hero' }); b.per_card['card-1'].evidence = '42%'; b.facts[0].value = 'canonical evidence 42%'; }, 'CARD_NEWS_HERO_NOT_CANONICAL');
fail((s, b) => { b.per_card['card-1'].evidence = 'The sourced value is 2026, but no matching number is printed on this card.'; s.frames[0].blocks[0].text = '첫째 문장은 독자에게 작동 원리를 차분하게 설명합니다.\n둘째 문장은 이해를 돕는 충분한 맥락을 제공합니다.'; }, 'CARD_NEWS_EVIDENCE_NOT_VISIBLE');
fail((s, b) => { for (const id of Object.keys(b.per_card).slice(1)) b.per_card[id].evidence_fact_ids = ['fact-1']; }, 'CARD_NEWS_FACTS_USED');
fail((s, b) => { b.facts = b.facts.slice(0, 5); }, 'CARD_NEWS_FACT_COUNT');
const carousel = JSON.parse(readFileSync('scripts/fixtures/carousel/series.json', 'utf8'));
assert.throws(() => planCarousel({ ...carousel, content_kind: 'card-news' }), (error) => error.code === 'CARD_NEWS_BRIEF_REQUIRED');
assert.throws(() => planCarousel({ ...carousel, profiles: { surface: 'instagram', artifact: 'visual/prediction-market-carousel' } }), (error) => error.code === 'CARD_NEWS_BRIEF_CONTRACT', 'selected card-news profile cannot opt out by omitting content_kind');
carousel.recipe = 'dark-data';
carousel.layouts = { 'local-panel': { content: { x: 0.06, y: 0.35, width: 0.88, height: 0.45 } } };
carousel.frames[0].layout = 'local-panel';
assert.equal(planCarousel(carousel).frames[0].layout, 'local-panel');
const qa = { schema_version: '1.0.0', would_a_smart_reader_learn_something_new: 'Yes, each card adds a sourced distinction and useful context.', one_surprising_fact: 'The volume fields distinguish cumulative trading from the last 24 hours.', reviewed_cards: frames.map((f) => f.id), sources_are_sidecar_only: true, disclaimers_or_meta_on_cards: false };
assert.equal(validateCardNewsContentQa(qa, series).ok, true);
assert(validateCardNewsContentQa({ ...qa, reviewed_cards: ['card-1'] }, series).issues.some((x) => x.code === 'CARD_NEWS_CONTENT_QA_COVERAGE'));
const briefSchema = JSON.parse(readFileSync('schemas/card-news-brief.schema.json', 'utf8'));
const qaSchema = JSON.parse(readFileSync('schemas/card-news-content-qa.schema.json', 'utf8'));
assert.deepEqual(briefSchema.properties.facts.minItems, 6);
assert.deepEqual(briefSchema.properties.facts.maxItems, 10);
assert(briefSchema.properties.per_card.additionalProperties.required.includes('evidence_fact_ids'));
assert(qaSchema.required.includes('one_surprising_fact'));
const chartDir = mkdtempSync(resolve(tmpdir(), 'aes-card-news-chart-'));
const chartPath = resolve(chartDir, 'chart.json');
writeFileSync(chartPath, JSON.stringify({ type:'number_visual', layout:'comparison-bars', items:[{label:'시장',value:7,value_label:'42%'}] }));
const boundChartSeries = { profiles:{artifact:'visual/prediction-market-carousel'}, frames:[{id:'card-1',blocks:[{kind:'chart',ref:'chart.json'}]}] };
const boundChartBrief = { facts:[{id:'fact-1',value:'confirmed value 42%',date:'2026-10-21'}], per_card:{'card-1':{visual_fact_ids:['fact-1']}} };
assert.equal(validateCardNewsChartFacts(boundChartSeries, boundChartBrief, chartDir).ok, false, 'chart data cannot differ from its canonical brief fact');
const labeledPath = resolve(chartDir, 'labeled-chart.json');
const labeledSeries = { profiles:{artifact:'visual/prediction-market-carousel'}, frames:[{id:'card-1',blocks:[{kind:'chart',ref:'labeled-chart.json'}]}] };
const labeledBrief = { facts:[{id:'october',value:'October probability was 81%',date:'2025-10'}, {id:'december',value:'December probability was 15%',date:'2025-12'}], per_card:{'card-1':{visual_fact_ids:['october','december'],visual_value_bindings:[{label:'October',value:81,fact_id:'october',display_value:'81%'},{label:'December',value:15,fact_id:'december',display_value:'15%'}]}} };
const labeledChart = { type:'number_visual',layout:'comparison-bars',items:[{label:'October',value:81,value_label:'81%'},{label:'December',value:15,value_label:'15%'}] };
writeFileSync(labeledPath, JSON.stringify(labeledChart));
assert.equal(validateCardNewsChartFacts(labeledSeries, labeledBrief, chartDir).ok, true, 'each chart label and value binds to its matching fact');
labeledChart.items = [{label:'October',value:15,value_label:'15%'},{label:'December',value:81,value_label:'81%'}];
writeFileSync(labeledPath, JSON.stringify(labeledChart));
assert.equal(validateCardNewsChartFacts(labeledSeries, labeledBrief, chartDir).ok, false, 'swapped October/December labels fail even though both numbers exist in the fact set');
const tupleFacts = [
  {id:'us-rate',value:'United States rate 4%',date:'2026-10-21'},
  {id:'kr-rate',value:'Korea rate 3%',date:'2026-10-21'},
  {id:'outflow',value:'Outflow USD 2.5B ratio term',date:'2026-10-21',direction:'outflow',amount:2.5},
  {id:'inflow',value:'Inflow USD 1B ratio term',date:'2026-10-21',direction:'inflow',amount:1},
];
const tupleBindings = [
  {label:'United States',value:4,fact_id:'us-rate'}, {label:'Korea',value:3,fact_id:'kr-rate'},
  {label:'Outflow 2.5',value:2.5,fact_id:'outflow',display_value:'USD 2.5B',direction:'outflow'}, {label:'Inflow 1',value:1,fact_id:'inflow',display_value:'USD 1B',direction:'inflow'},
];
const ratioChart = { type:'number_visual',layout:'rate-gap-ratio',rates:[{label:'United States',value:4},{label:'Korea',value:3}],ratio:{outflow:2.5,inflow:1,outflow_label:'Outflow 2.5',inflow_label:'Inflow 1',outflow_amount_label:'USD 2.5B',inflow_amount_label:'USD 1B',caption:'ratio'} };
const ratioChartPath = resolve(chartDir, 'ratio-chart.json');
const ratioSeries = { profiles:{artifact:'visual/prediction-market-carousel'},frames:[{id:'card-1',blocks:[{kind:'chart',ref:'ratio-chart.json'}]}] };
const ratioBrief = { facts:tupleFacts,per_card:{'card-1':{visual_fact_ids:tupleFacts.map((fact)=>fact.id),visual_value_bindings:tupleBindings}} };
writeFileSync(ratioChartPath, JSON.stringify(ratioChart));
assert.equal(validateCardNewsChartFacts(ratioSeries,ratioBrief,chartDir).ok,true,'rate and ratio labels bind to their own sourced values');
const unboundRatioCaption = structuredClone(ratioChart); unboundRatioCaption.ratio.caption = '99:1 ratio claim';
writeFileSync(ratioChartPath, JSON.stringify(unboundRatioCaption));
assert.equal(validateCardNewsChartFacts(ratioSeries,ratioBrief,chartDir).ok,false,'ratio caption numbers are checked against cited facts');
const scenarioPath = resolve(chartDir, 'scenario.json');
const scenarioSpec = { type:'number_visual',layout:'scenario-split',title:'Scenario',source_note:'Source',date:'2026-10-21',scenarios:[{label:'Base',detail:'Impact 3%'},{label:'Risk',detail_lines:['Impact 4%']}] };
writeFileSync(scenarioPath, JSON.stringify(scenarioSpec));
const scenarioSeries = { profiles:{artifact:'visual/prediction-market-carousel'},frames:[{id:'card-1',blocks:[{kind:'chart',ref:'scenario.json'}]}] };
const scenarioBrief = { facts:[{id:'scenario',value:'Scenario values 3% and 4%',date:'2026-10-21'}],per_card:{'card-1':{visual_fact_ids:['scenario']}} };
assert.equal(validateCardNewsChartFacts(scenarioSeries,scenarioBrief,chartDir).ok,true);
scenarioSpec.scenarios[0].detail = 'Impact 99%'; writeFileSync(scenarioPath, JSON.stringify(scenarioSpec));
assert.equal(validateCardNewsChartFacts(scenarioSeries,scenarioBrief,chartDir).ok,false,'scenario.detail fallback numbers are checked against cited facts');
const visualKinds = [
  {type:'number_visual',layout:'comparison-bars',title:'A',source_note:'B',items:[{label:'C',value:4,value_label:'4%'}]},
  {type:'number_visual',layout:'dot-grid',title:'A',source_note:'B',total:100,filled:4,value_label:'4%',caption:'C'},
  {type:'number_visual',layout:'trend-area',title:'A',source_note:'B',start:3,end:4,start_label:'3%',end_label:'4%',start_date:'10.20',end_date:'10.21',points:[{observed_at:'2026-10-20T00:00:00Z',value:3},{observed_at:'2026-10-21T00:00:00Z',value:4}]},
  {type:'number_visual',layout:'dual-metric',title:'A',source_note:'B',items:[{label:'C',value:4,max:5,value_label:'4%'},{label:'D',value:3,max:5,value_label:'3%'}]},
  ratioChart,
  scenarioSpec,
];
for (const [index, original] of visualKinds.entries()) {
  const sentinelSpec = structuredClone(original);
  const inject = (value) => typeof value === 'string' ? 'sentinel 9917' : Array.isArray(value) ? value.map(inject) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, ['type','layout','render_mode'].includes(key) ? child : inject(child)])) : value;
  const poisoned = inject(sentinelSpec);
  const textFields = renderedChartTextFields(poisoned);
  const validationSeries = {profiles:{artifact:'visual/prediction-market-carousel'},frames:[{id:'card-1',blocks:[{kind:'chart',ref:'sentinel.json'}]}]};
  writeFileSync(resolve(chartDir,'sentinel.json'),JSON.stringify(poisoned));
  const result = validateCardNewsChartFacts(validationSeries,{facts:tupleFacts,per_card:{'card-1':{visual_fact_ids:tupleFacts.map((fact)=>fact.id)} }},chartDir);
  let svgHasSentinel = false;
  try { svgHasSentinel = renderNumberVisualPanel(poisoned).svg.includes('sentinel 9917'); } catch { /* Invalid poisoned geometry is itself a safe rejection. */ }
  if (svgHasSentinel) assert.equal(result.ok,false,`visual kind ${index} must reject every unbound rendered text number`);
  assert(textFields.length > 0, `visual kind ${index} exposes rendered text fields to the parity gate`);
}
for (const mutate of [
  (chart) => [chart.rates[0].label,chart.rates[1].label]=[chart.rates[1].label,chart.rates[0].label],
  (chart) => [chart.ratio.outflow_label,chart.ratio.inflow_label]=[chart.ratio.inflow_label,chart.ratio.outflow_label],
  (chart) => [chart.ratio.outflow_amount_label,chart.ratio.inflow_amount_label]=[chart.ratio.inflow_amount_label,chart.ratio.outflow_amount_label],
]) {
  const swapped=structuredClone(ratioChart); mutate(swapped); writeFileSync(ratioChartPath,JSON.stringify(swapped));
  assert.equal(validateCardNewsChartFacts(ratioSeries,ratioBrief,chartDir).ok,false,'swapping any rate or flow label/value/fact tuple is rejected');
}
const fullFlowSwap=structuredClone(ratioChart);
[fullFlowSwap.ratio.outflow_label,fullFlowSwap.ratio.inflow_label]=[fullFlowSwap.ratio.inflow_label,fullFlowSwap.ratio.outflow_label];
const fullFlowBrief=structuredClone(ratioBrief);
const flowBindings=fullFlowBrief.per_card['card-1'].visual_value_bindings;
[flowBindings[2],flowBindings[3]]=[flowBindings[3],flowBindings[2]];
writeFileSync(ratioChartPath,JSON.stringify(fullFlowSwap));
assert.equal(validateCardNewsChartFacts(ratioSeries,fullFlowBrief,chartDir).ok,false,'swapping both flow labels and their bindings cannot override direction-bound source facts');
const dualChart = { type:'number_visual',layout:'dual-metric',items:[{label:'United States',value:4,max:5,value_label:'4%'},{label:'Korea',value:3,max:5,value_label:'3%'}] };
writeFileSync(ratioChartPath,JSON.stringify(dualChart));
const dualBrief = { facts:tupleFacts.slice(0,2),per_card:{'card-1':{visual_fact_ids:['us-rate','kr-rate'],visual_value_bindings:[{...tupleBindings[0],display_value:'4%'},{...tupleBindings[1],display_value:'3%'}]}} };
assert.equal(validateCardNewsChartFacts(ratioSeries,dualBrief,chartDir).ok,true,'dual-metric labels bind to their own sourced values');
const swappedDual=structuredClone(dualChart); [swappedDual.items[0].label,swappedDual.items[1].label]=[swappedDual.items[1].label,swappedDual.items[0].label];
writeFileSync(ratioChartPath,JSON.stringify(swappedDual));
assert.equal(validateCardNewsChartFacts(ratioSeries,dualBrief,chartDir).ok,false,'swapping dual-metric labels is rejected');
const swappedDualValues=structuredClone(dualChart); [swappedDualValues.items[0].value_label,swappedDualValues.items[1].value_label]=[swappedDualValues.items[1].value_label,swappedDualValues.items[0].value_label];
writeFileSync(ratioChartPath,JSON.stringify(swappedDualValues));
assert.equal(validateCardNewsChartFacts(ratioSeries,dualBrief,chartDir).ok,false,'swapping dual-metric display values is rejected');
console.log('card-news-brief: 22 assertions PASS');
