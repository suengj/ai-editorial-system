import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { planCarousel } from './lib/carousel-core.mjs';
import { compileExecution } from './lib/visual-execution-core.mjs';
import { CARD_NEWS_TYPE_TOKENS } from './lib/typography-core.mjs';
import { svgTextNodesWithEffectiveFontSize } from './lib/svg-effective-font-size.mjs';
import { checkTrendCardEligibility } from './lib/numeric-visual-core.mjs';
import { loadPmcPlotBundle } from './lib/pmc-bundle-binding.mjs';
import { pmcPlotToChartSpec } from './lib/pmc-bundle-binding.mjs';
import { validateCardNewsBrief, validateCardNewsChartFacts, loadAndValidateCardNewsBrief } from './lib/card-news-brief-core.mjs';
import { renderNumberVisualPanel } from './lib/chart-renderer.mjs';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = read('editorial/entry-manifest.json');
const target = manifest.sns_targets['signalytics-news'];
const profile = read('editorial/profiles/artifact/visual-prediction-market-carousel.json');
const recipe = read('editorial/prediction-market-carousel.v1.json');
const template = read('editorial/templates/prediction-market-carousel.series.json');

assert(target.visual.artifacts.includes('visual/prediction-market-carousel'));
assert(target.visual.artifacts.includes('visual/evidence-visual'));
assert(target.copy_files.includes('editorial/SIGNALYTICS-PREDICTION-MARKET-CAROUSEL.md'));
assert(target.visual.files.includes('editorial/PMC-BUNDLE-BINDING.md'));
assert(target.visual.files.includes('editorial/INSTAGRAM-NUMERIC-VISUAL-POLICY.md'));
assert(target.visual.values.includes('editorial/prediction-market-carousel.v1.json'));
assert(target.visual.values.includes('editorial/templates/prediction-market-carousel.series.json'));
assert.equal(profile.artifact, 'visual/prediction-market-carousel');
assert.equal(profile.trend_render_mode,'flow','prediction-market carousel profile defaults to flow mode');
assert.equal(profile.trend_image_mode.id, 'illustrative_trend_image');
assert.equal(profile.trend_image_mode.owner_decision, true);
assert.equal(profile.trend_image_mode.requires_raw_history, true);
assert.deepEqual(profile.trend_image_mode.renderer_overlays, ['start_value', 'end_value', 'change_pp']);
assert.equal(profile.trend_image_mode.numeric_parity_check, 'required');
assert(/no pagination/i.test(profile.composition.chrome_level), 'selected profile forbids pagination on content-only artwork');
assert(profile.acceptance.some((rule) => /sixth only for a distinct sourced fact/.test(rule)), 'selected profile allows a conditional sixth card');
assert(profile.acceptance.some((rule) => /placeholders are forbidden/.test(rule)), 'selected profile bans editor-check placeholders');
assert.deepEqual(recipe.visual_style, { default: 'R4', fallback: 'R7', fallback_when: 'no suitable rights-cleared photo' });
assert.equal(recipe.card_count, 5);
assert.deepEqual(template.frames.map((f) => f.id), ['hook', 'trend', 'why', 'korea-impact', 'watch-next']);
assert(template.frames.every((f) => f.headline && f.takeaway && f.blocks.length));
assert(template.frames[1].blocks.some((b) => b.kind === 'chart' && b.sha256.startsWith('PLACEHOLDER:')));
assert.equal(template.footer_policy, 'content_only');
assert.equal(template.recipe, 'r4-photo-fullbleed');
assert.throws(() => planCarousel(template), (error) => error.code === 'CARD_NEWS_BRIEF_REQUIRED', 'selected production template cannot plan without its required sourced brief');
const missingNumericContract = structuredClone(template); delete missingNumericContract.numeric_profile;
assert.throws(() => planCarousel(missingNumericContract, undefined, {}), (error) => error.code === 'CARD_NEWS_PROFILE_CONTRACT', 'selected profile cannot disable numeric gates by omitting its flag');
assert.equal(template.content_kind, 'card-news');
assert.equal(profile.requires_brief, true);
assert.equal(template.requires_brief, true);
const missingKind = structuredClone(template); delete missingKind.content_kind;
assert.equal(loadAndValidateCardNewsBrief(missingKind, 'scripts/fixtures/pmc-bundle/series.json').ok, false, 'the resolver blocks a selected PMC profile whose content_kind is absent');
for (const field of ['content_kind','numeric_profile','footer_policy']) {
  const incomplete = structuredClone(template); delete incomplete[field];
  assert.equal(loadAndValidateCardNewsBrief(incomplete, 'scripts/fixtures/pmc-bundle/series.json').ok, false, `the resolver blocks missing ${field} before issuing READY`);
  assert.throws(() => planCarousel(incomplete, undefined, {}), /card-news|numeric|footer/i, `the planner applies the same ${field} prerequisite`);
}
assert.equal(template.numeric_profile, true);
assert.equal(template.profiles.artifact, 'visual/prediction-market-carousel');
assert.equal(template.visual_style.requested_style, 'R4');
assert(template.frames.every((f) => ['hero', 'visual'].includes(f.layout)), 'prediction-market series reuses shared carousel layouts');
assert.equal(template.frames[0].blocks.find((b) => b.text_role === 'hero').region, 'hero-value');
assert.equal(template.frames.filter((f) => f.blocks.some((b) => b.kind === 'generated')).length, 4);
assert.equal(template.typography.headline.font_family, "'Noto Serif KR', 'Noto Serif CJK KR', serif");
assert.equal(template.typography.body.font_family, 'AES Sans KR');
assert(!Object.keys(read('editorial/visual-recipes.v1.json').layouts).some((name) => name.startsWith('pm-')), 'no prediction-market-only layout family');
assert(!/disclaimer|not investment advice|투자 권유 아님|투자 조언|베팅하러|지금 투자/i.test(JSON.stringify(template)));
assert(!template.frames.some((f) => /timestamp|기준 시각 카드|데이터 시각 카드/i.test(f.headline)));
const ready = structuredClone(template);
const values = {
  '[플랫폼 원문 시장명]': 'Test market original title',
  '[PMC hero value]': '42%',
  '[한 줄 한국어 해석]': '금리 인하 가능성은 아직 팽팽합니다.',
  '[이번 주 변동을 요약하는 한 줄]': '이번 주 테스트 확률은 38%에서 42%로 4%p 올랐습니다.',
  '[날짜와 PMC 값으로만 구성한 변곡점 1–3개]': '10월 16일 38%\n10월 19일 47%\n10월 21일 42%',
  '[움직임의 크기를 담은 한 줄]': '고점에서 5%p 내려왔습니다.',
  '[검증된 계약 정산일]': '2026년 12월 31일',
  '[정산 판단에 직접 연결되는 확인된 공개 일정 또는 규칙]': '테스트 계약은 공식 발표문에 적힌 목표 범위로 판정됩니다.',
  '[PMC value]': '42%',
  '[날짜가 확인된 공개 정보 1–3줄]': '테스트 공식 발표의 날짜와 핵심 사실을 기입합니다.',
  '[가격 신호와 확인 사실을 구분하는 한 줄]': '계약은 연내 인하 가능성을 42%로 가격에 반영합니다.'
};
const replaceStrings = (value) => {
  if (typeof value === 'string') return Object.entries(values).reduce((text, [token, replacement]) => text.replaceAll(token, replacement), value);
  if (Array.isArray(value)) return value.map(replaceStrings);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceStrings(item)]));
  return value;
};
Object.assign(ready, replaceStrings(ready));
for (const frame of ready.frames) for (const block of frame.blocks) if (block.kind === 'chart') block.sha256 = `sha256:${'a'.repeat(64)}`;
const genericReady = structuredClone(ready); delete genericReady.content_kind; delete genericReady.numeric_profile; delete genericReady.requires_brief; genericReady.profiles.artifact = 'visual/slide-image';
const planned = planCarousel(genericReady);
assert.equal(planned.frames.length, 5);
assert.equal(planned.density_profile, 'silent_carousel');
assert.equal(planned.publication_authorized, false);
const visibleText = planned.frames.flatMap((frame) => frame.plan.layers.filter((layer) => layer.kind === 'text').map((layer) => layer.text));
assert(planned.frames.every((frame) => !frame.plan.layers.some((layer) => ['source', 'pagination'].includes(layer.id))), 'content-only series must not compile source or page-number footers');
assert(!/\b\d+\s*\/\s*\d+\b/.test(visibleText.join('\n')), 'page-number footer text is forbidden');
assert(!/30일 요청|실제 차트는 7일|거래가 관측된 점만 이었다|움직임은 확인, 원인은 확인 중|계약 가격은 사건의 확인이 아니다|편집자 확인 필요/i.test(visibleText.join('\n')), 'process/meta phrases are forbidden in rendered copy');
assert(!/\[[^\]]+\]|PLACEHOLDER|TODO|TBD/i.test(visibleText.join('\n')), 'placeholder text is forbidden in rendered copy');
assert(planned.frames[0].plan.layers.some((layer) => layer.id === 'hero-value' && layer.font_size >= 140), 'hero probability must be visually dominant');
assert(planned.frames[0].plan.layers.every((layer) => !Object.hasOwn(layer, 'text_role')), 'text_role is consumed by the planner, not leaked into visual layers');
const badCopy = structuredClone(genericReady);
badCopy.frames[0].blocks[1].text = '30일 요청, 실제 차트는 7일';
assert.throws(() => planCarousel(badCopy), (error) => error.code === 'SERIES_COPY', 'pipeline/meta copy must fail closed before rendering');
const trendEligibility = {
  volume_24h: 10,
  updated_at: '2026-10-21T10:00:00Z',
  checked_at: '2026-10-21T11:00:00Z',
  observations: [{ t: '2026-10-20T10:00:00Z', p: 30 }, { t: '2026-10-21T10:00:00Z', p: 42 }],
  direction: 'up'
};
assert.deepEqual(checkTrendCardEligibility(trendEligibility), [], 'liquid fresh history allows a direction derived from its endpoints');
assert(checkTrendCardEligibility({ ...trendEligibility, volume_24h: 0 }).some((issue) => issue.code === 'TREND_ILLIQUID'));
assert(checkTrendCardEligibility({ ...trendEligibility, updated_at: '2026-10-19T00:00:00Z' }).some((issue) => issue.code === 'TREND_STALE'));
assert(checkTrendCardEligibility({ ...trendEligibility, observations: [] }).some((issue) => issue.code === 'TREND_HISTORY_REQUIRED'), 'no history blocks a trend card');
assert(checkTrendCardEligibility({ ...trendEligibility, direction: 'down' }).some((issue) => issue.code === 'TREND_DIRECTION'), 'trend direction cannot contradict raw history');

const numericReady = structuredClone(ready);
numericReady.content_kind = 'card-news';
numericReady.numeric_profile = true;
numericReady.profiles.artifact = 'visual/prediction-market-carousel';
numericReady.source.ref = 'scripts/fixtures/pmc-bundle/manifold-illustrative-gap-1ec91c13.plot.json';
numericReady.footer_policy = 'content_only';
for (const frame of numericReady.frames) {
  frame.blocks = frame.blocks.map((block) => block.kind === 'generated'
    ? { id: `${frame.id}-data-visual`, region: block.region, kind: 'chart', ref: `charts/${frame.id}.json`, sha256: `sha256:${'a'.repeat(64)}` }
    : block);
  for (const block of frame.blocks) if (block.kind === 'text' && block.text_role === 'hero') block.text = '99%';
  const body = frame.blocks.find((block) => block.kind === 'text' && block.text_role === 'body');
  if (body) body.text = `10월 21일 기준 42%의 가격을 보였습니다.\n이 흐름은 다음 회의 전 환율과 대출금리 전망에도 영향을 줍니다.`;
  else {
    frame.layout = 'split';
    const chart = frame.blocks.find((block) => block.kind === 'chart');
    chart.region = 'left';
    frame.blocks.push({ id: `${frame.id}-body`, region: 'right', kind: 'text', text: `10월 21일 기준 42%의 가격을 보였습니다.\n이 흐름은 다음 회의 전 환율과 대출금리 전망에도 영향을 줍니다.`, text_role: 'body', source_ref: 'source-sidecar.json' });
  }
}
const factIds = ['oct-market','dec-market','dec-history','september-cpi','fed-range','fomc-date'];
const factValues = ['15% Kalshi October market price','81% Kalshi December market price','Raw history 31.2% to 48.5% endpoint','0.6% September CPI month-over-month','4.00% Fed range upper bound and 3.00% Bank of Korea rate','October 27–28 FOMC meeting'];
const frameFactIds = [[factIds[0],factIds[1]],[factIds[2]],[factIds[3],factIds[1]],[factIds[4]],[factIds[5]]];
const fixtureBundle = loadPmcPlotBundle(numericReady.source.ref);
const plotPoints = fixtureBundle.plot.points.map((p) => ({ t: p.observed_at, p: Number((p.value * 100).toPrecision(12)) }));
const historyUpdated = plotPoints.at(-1).t;
const historyChecked = new Date(Date.parse(historyUpdated) + 60 * 60 * 1000).toISOString();
const brief = {
  schema_version: '1.0.0', reader_question: '시장 가격은 어떤 방향으로 움직였나?',
  angle: '가격의 변화는 회의 전 기대와 국내 금융 여건을 함께 움직인다.',
  so_what: '독자는 시장 가격과 국내 환율 및 대출금리의 연결을 읽을 수 있다.',
  trend_eligibility: { source_type: 'market_pmc', volume_24h: 10, updated_at: historyUpdated, checked_at: historyChecked, observations: plotPoints, direction: plotPoints.at(-1).p > plotPoints[0].p ? 'up' : 'down' },
  facts: factIds.map((id, i) => ({ id, value: factValues[i], date: '2026-10-21', source_url: `https://example.com/${id}`, source_name: 'Source' })),
  per_card: Object.fromEntries(numericReady.frames.map((frame, i) => [frame.id, {
    claim: '가격 흐름이 바뀌었다.', evidence: frameFactIds[i].map((id) => factValues[factIds.indexOf(id)]).join('; '), evidence_fact_ids: frameFactIds[i], visual_fact_ids: frameFactIds[i], takeaway: '다음 회의를 주시한다.'
  }]))
};
const KoreanMagnitudeSeries = structuredClone(numericReady);
KoreanMagnitudeSeries.frames[0].blocks.find((block) => block.kind === 'text').text = '유입액은 USD 129.4 billion입니다.';
assert(validateCardNewsBrief(KoreanMagnitudeSeries, brief).issues.some((item) => item.code === 'CARD_NEWS_KO_MAGNITUDE'), 'Korean PM card visible text rejects English magnitude words');
assert.throws(() => planCarousel(numericReady, undefined, brief), (error) => error.code === 'CARD_NEWS_BRIEF_INVALID' && /CARD_NEWS_HERO_NOT_CANONICAL/.test(error.message), '7% or 99% hero cannot pass against differently bound sourced evidence');
const heroValues = { hook: '15%', trend: '48.5%', why: '0.6%', 'korea-impact': '4.00%', 'watch-next': '27–28' };
const bodyValues = { hook: '81%', trend: '31.2%', why: '81%', 'korea-impact': '3.00%', 'watch-next': '10월 27일 시작, 28일 종료' };
for (const frame of numericReady.frames) {
  frame.headline = '확인된 가격과 다음 변수';
  for (const block of frame.blocks) if (block.kind === 'text') {
  if (block.text_role === 'hero') block.text = heroValues[frame.id];
  else if (block.text_role === 'body') block.text = `확인된 공개 자료에서 수치는 ${bodyValues[frame.id]}로 기록됐습니다.\n이 흐름은 다음 회의 전에 환율과 대출금리 전망에도 영향을 줍니다.`;
  }
}
const numericPlan = planCarousel(numericReady, undefined, brief);
const pmcChartDir = mkdtempSync(resolve(tmpdir(), 'aes-pmc-chart-binding-'));
copyFileSync(numericReady.source.ref, resolve(pmcChartDir, 'pmc.plot.json'));
const boundTrendFrame = structuredClone(numericReady.frames.find((frame) => frame.function === 'show_evidence'));
boundTrendFrame.blocks = [{ id:'trend-chart',kind:'chart',ref:'chart.spec.json' }];
const boundTrendSeries = { ...numericReady, source:{ ...numericReady.source,ref:'pmc.plot.json' },frames:[boundTrendFrame] };
const boundTrendBrief = { ...brief, per_card:{[boundTrendFrame.id]:brief.per_card[boundTrendFrame.id]} };
const pmcBundle = loadPmcPlotBundle(resolve(pmcChartDir,'pmc.plot.json'));
writeFileSync(resolve(pmcChartDir,'chart.spec.json'), JSON.stringify(pmcPlotToChartSpec(pmcBundle)));
const boundTrendChartResult = validateCardNewsChartFacts(boundTrendSeries,boundTrendBrief,pmcChartDir);
assert.equal(boundTrendChartResult.ok,true,`the trend chart must exactly match points and labels from the verified selected PMC bundle (${JSON.stringify(boundTrendChartResult.issues)})`);
const pmcStart=pmcBundle.plot.points.find((point)=>point.observed_at===pmcBundle.plot.delta.baseline_at);
const pmcEnd=pmcBundle.plot.points.find((point)=>point.observed_at===pmcBundle.plot.delta.last_at);
const pmcTrendArea = {
  type:'number_visual',layout:'trend-area',start:Number((pmcStart.value*100).toPrecision(12)),end:Number((pmcEnd.value*100).toPrecision(12)),
  start_label:`${Number((pmcStart.value*100).toPrecision(12))}%`,
  end_label:`${Number((pmcEnd.value*100).toPrecision(12))}%`,
  start_date:`${String(new Date(pmcBundle.plot.delta.baseline_at).getUTCMonth()+1).padStart(2,'0')}.${String(new Date(pmcBundle.plot.delta.baseline_at).getUTCDate()).padStart(2,'0')}`,
  end_date:`${String(new Date(pmcBundle.plot.delta.last_at).getUTCMonth()+1).padStart(2,'0')}.${String(new Date(pmcBundle.plot.delta.last_at).getUTCDate()).padStart(2,'0')}`,
  delta_label:`${Number(pmcBundle.plot.delta.value_pp)>0?'+':Number(pmcBundle.plot.delta.value_pp)<0?'−':''}${Math.abs(Number(pmcBundle.plot.delta.value_pp))}%p`,
  points:pmcBundle.plot.points.filter((point)=>point.value!==null).map((point)=>({observed_at:point.observed_at,value:Number((point.value*100).toPrecision(12))})),
};
const forgedStartLabel = structuredClone(pmcTrendArea); forgedStartLabel.start_label = '89%';
writeFileSync(resolve(pmcChartDir,'chart.spec.json'), JSON.stringify(forgedStartLabel));
assert.equal(validateCardNewsChartFacts(boundTrendSeries,boundTrendBrief,pmcChartDir).ok,false,'a forged displayed start label fails PMC chart binding');
for (const [field, value] of [['start_label','31.2% 99%'],['end_label','44%'],['delta_label','+4%p'],['start_date','10.99'],['end_date','10.98']]) {
  const forged = {...pmcTrendArea,[field]:value};
  writeFileSync(resolve(pmcChartDir,'chart.spec.json'), JSON.stringify(forged));
  assert.equal(validateCardNewsChartFacts(boundTrendSeries,boundTrendBrief,pmcChartDir).ok,false,`a forged displayed ${field} fails PMC chart binding`);
}
const labeledFlowSpec = {...pmcTrendArea,intermediate_labels:['10.18: 44%']};
writeFileSync(resolve(pmcChartDir,'chart.spec.json'), JSON.stringify(labeledFlowSpec));
assert.equal(validateCardNewsChartFacts(boundTrendSeries,boundTrendBrief,pmcChartDir).ok,false,'flow mode is refused when intermediate point labels are present');
const forgedChartSpec = pmcPlotToChartSpec(pmcBundle); forgedChartSpec.series[0].points[0][1] += 5;
writeFileSync(resolve(pmcChartDir,'chart.spec.json'), JSON.stringify(forgedChartSpec));
assert.equal(validateCardNewsChartFacts(boundTrendSeries,boundTrendBrief,pmcChartDir).ok,false,'a forged trend point fails PMC chart binding');
const canonicalLineSpec = pmcPlotToChartSpec(pmcBundle);
const indexedForgedLineSpec = structuredClone(canonicalLineSpec);
indexedForgedLineSpec.series[0].points = indexedForgedLineSpec.series[0].points.map((point, index) => [index, point[1] + 7]);
writeFileSync(resolve(pmcChartDir,'chart.spec.json'), JSON.stringify(indexedForgedLineSpec));
assert.equal(validateCardNewsChartFacts(boundTrendSeries,boundTrendBrief,pmcChartDir).ok,false,'PMC-bound trends reject forged observations even when timestamps are replaced with sequential indices and calendar ticks remain');
for (const [mutate, description] of [
  [(s) => { s.x.tick_labels[String(s.series[0].points[0][0])] = '10.99'; }, 'tick'],
  [(s) => { s.title = '2099.01'; }, 'title'],
  [(s) => { s.period = '2099'; }, 'period'],
]) {
  const forged = structuredClone(canonicalLineSpec); mutate(forged);
  writeFileSync(resolve(pmcChartDir,'chart.spec.json'), JSON.stringify(forged));
  assert.equal(validateCardNewsChartFacts(boundTrendSeries,boundTrendBrief,pmcChartDir).ok,false,`forged displayed line-chart text (${description}) fails PMC binding`);
}

const trendPoints = Array.from({length:24},(_,i)=>({observed_at:new Date(Date.UTC(2026,9,14)+i*60*60*1000).toISOString(),value:i===0?90:i===23?81:90-(i/23)*9+(i%3===0?1.8:-1.2)}));
const trendVisual = {type:'number_visual',layout:'trend-area',title:'test trend',source_note:'Kalshi',start:90,end:81,start_label:'90%',end_label:'81%',start_date:'10.14',end_date:'10.15',delta_label:'−9%p',points:trendPoints};
const rawDefault=renderNumberVisualPanel(trendVisual,{width:936,height:769,theme:{accent:'#FF6B5B'}});
assert.throws(()=>renderNumberVisualPanel({...trendVisual,points:undefined},{width:936,height:769}),/requires at least two finite ordered dated observations/u,'raw trend mode cannot invent a curve without observations');
assert.throws(()=>renderNumberVisualPanel({...trendVisual,points:[]},{width:936,height:769}),/requires at least two finite ordered dated observations/u,'empty raw history cannot produce synthetic geometry');
const rawExplicit=renderNumberVisualPanel({...trendVisual,render_mode:'raw'},{width:936,height:769,theme:{accent:'#FF6B5B'}});
const rawTrendText = svgTextNodesWithEffectiveFontSize(rawDefault.svg);
const cardNewsTokenSizes = Object.values(CARD_NEWS_TYPE_TOKENS).map((token) => token?.font_size).filter(Number.isFinite);
assert(rawTrendText.length > 0 && rawTrendText.every((node) => cardNewsTokenSizes.some((token) => Math.abs(node.effectiveFontSize - token) < 0.01)), 'every trend-panel text node uses a shared token after SVG scaling');
for (const label of ['90%', '10.14', '10.15']) {
  const node = rawTrendText.find((item) => item.text === label);
  assert(node, `trend panel includes ${label}`);
  assert.equal(node.effectiveFontSize, CARD_NEWS_TYPE_TOKENS.label.font_size, `${label} renders at the 34px label token after SVG scaling`);
  assert.equal(node.attrs['font-weight'], String(CARD_NEWS_TYPE_TOKENS.label.weight), `${label} uses the shared label weight`);
  assert.equal(node.attrs.fill, '#14213D', `${label} uses the date-label color`);
}
const curvePath=(svg)=>svg.match(/<path d="([^"]+)" fill="url\(#trend-area-gradient\)"/u)?.[1];
assert.equal(curvePath(rawDefault.svg),curvePath(rawExplicit.svg),'raw mode preserves the exact monotone path (0px difference, within 0.5px)');
assert.equal(rawDefault.displayed[0].render_mode,'raw');
const flow=renderNumberVisualPanel({...trendVisual,render_mode:'flow',raw_data_sha256:`sha256:${'a'.repeat(64)}`},{width:936,height:769,theme:{accent:'#FF6B5B'}}).displayed[0];
assert.equal(flow.curve_endpoints.start.value,90,'flow first curve point equals the raw start exactly');
assert.equal(flow.curve_endpoints.end.value,81,'flow last curve point equals the raw end exactly');
assert.equal(flow.direction,'down','flow preserves the raw overall direction');
assert.equal(flow.delta_label,'−9%p','flow delta badge remains bound to the raw delta');
assert.equal(flow.smoothing.method,'uniform_resample_gaussian');
assert.deepEqual(flow.smoothing.parameters,{resample_count:40,sigma_samples:2,kernel_radius:6,endpoints:'raw_exact'});
assert.equal(flow.raw_data_sha256,`sha256:${'a'.repeat(64)}`);
const twoPointTrend={...trendVisual,start:90,end:81,start_label:'90%',end_label:'81%',points:[{observed_at:'2026-10-14T00:00:00Z',value:90},{observed_at:'2026-10-15T00:00:00Z',value:81}]};
const twoPointRaw=renderNumberVisualPanel({...twoPointTrend,render_mode:'raw'},{width:936,height:769,theme:{accent:'#FF6B5B'}}).displayed[0];
assert.equal(twoPointRaw.point_count,2,'raw mode renders two observations');
const isolatedRaw = renderNumberVisualPanel({ ...trendVisual, points:[
  {observed_at:'2026-10-14T00:00:00Z',value:90},
  {observed_at:'2026-10-17T00:00:00Z',value:80},
  {observed_at:'2026-10-20T00:00:00Z',value:70},
], start:90, end:70, start_label:'90%', end_label:'70%' }, {width:936,height:769,theme:{accent:'#FF6B5B'}});
assert.equal(isolatedRaw.displayed[0].isolated_observation_count,3,'each raw observation in its own gap segment is recorded as isolated');
assert.equal((isolatedRaw.svg.match(/<circle\b/gu) ?? []).length,3,'raw singleton segments receive visible dots, including the middle observation');
assert.equal(twoPointRaw.curve_endpoints.start.value,90,'raw two-point segment preserves its first endpoint');
assert.equal(twoPointRaw.curve_endpoints.end.value,81,'raw two-point segment preserves its last endpoint');
const twoPointFlow=renderNumberVisualPanel({...twoPointTrend,render_mode:'flow',raw_data_sha256:`sha256:${'b'.repeat(64)}`},{width:936,height:769,theme:{accent:'#FF6B5B'}}).displayed[0];
assert.equal(twoPointFlow.point_count,2,'flow mode renders two raw observations');
assert.equal(twoPointFlow.curve_endpoints.start.value,90,'flow mode preserves the exact two-point start');
assert.equal(twoPointFlow.curve_endpoints.end.value,81,'flow mode preserves the exact two-point end');
assert.equal(flow.start_label_path_bbox_check.passed,true,'the start label bounding box does not intersect the sampled curve path');
assert.throws(()=>renderNumberVisualPanel({...trendVisual,render_mode:'flow',raw_data_sha256:`sha256:${'a'.repeat(64)}`,intermediate_labels:['10.14: 90%']},{width:936,height:769}),/flow mode is forbidden/u);
const numericLayers = numericPlan.frames.flatMap((frame) => frame.plan.layers).filter((layer) => layer.kind === 'text');
assert(numericPlan.frames.every((frame) => frame.plan.layers.some((layer) => layer.kind === 'chart')), 'numeric profile requires a data visual on every card');
assert(numericLayers.every((layer) => [64, 150, 110, 34, 36].includes(layer.font_size)), 'numeric profile uses only shared card-news font sizes');
assert(Object.values(numericPlan.typography).every((style) => [64, 150, 110, 34, 36].includes(style.font_size)), 'renderer typography config exposes no non-token font sizes');
assert.deepEqual(numericPlan.card_news_type_tokens, CARD_NEWS_TYPE_TOKENS, 'renderer plan carries the shared token contract');
assert.equal(numericLayers.find((layer) => layer.id === 'headline').font_family, CARD_NEWS_TYPE_TOKENS.headline.font_family);
assert(numericLayers.every((layer) => layer.min_contrast === 4.5), 'compiled profile text carries a measured contrast requirement');
assert(numericLayers.every((layer) => Math.abs(layer.slot.x * 1080 - 72) < 1 || layer.slot.x > 0.1), 'compiled text slots use the shared 72px left margin');
const r4Bands = numericPlan.frames.flatMap((frame) => frame.plan.layers.filter((layer) => layer.kind === 'solid' && layer.id === 'r4-text-zone-scrim'));
assert.equal(r4Bands.length, numericPlan.frames.filter((frame) => frame.layout === 'hero').length, 'every R4 photo-led frame has an explicit compiled text-zone scrim');
const compiledDir = mkdtempSync(resolve(tmpdir(), 'aes-pmc-slots-'));
const chartPath = resolve(compiledDir, 'number-visual.json');
writeFileSync(chartPath, JSON.stringify({ type:'number_visual', layout:'dot-grid', title:'가격', source_note:'brief', total:100, filled:15, value_label:'15%', caption:'15개' }));
const slotTestFrame = numericPlan.frames.find((frame) => frame.layout === 'split');
const compilablePlan = structuredClone(slotTestFrame.plan);
compilablePlan.source.ref = resolve(numericReady.source.ref);
for (const layer of compilablePlan.layers) if (layer.kind === 'text') layer.source_ref = 'request';
for (const layer of compilablePlan.layers) if (layer.kind === 'chart') { layer.ref = chartPath; delete layer.sha256; }
const compiledPacket = await compileExecution(compilablePlan, { baseDir: compiledDir, preset: numericPlan.preset });
const plannedChart = slotTestFrame.plan.layers.find((layer) => layer.kind === 'chart');
assert(compiledPacket.layers.filter((layer) => ['headline', plannedChart.id].includes(layer.id)).every((layer) => layer.pixel_slot.x === 72), 'compiled headline and left data panel use the exact 72px left margin');
const compiledChart = compiledPacket.layers.find((layer) => layer.kind === 'chart');
assert.equal(compiledChart.pixel_slot.width, Math.round(plannedChart.slot.width * 1080), 'compiled data panel width preserves the profile slot geometry');
const noVisual = structuredClone(numericReady); noVisual.frames[0].blocks = noVisual.frames[0].blocks.filter((block) => block.kind !== 'chart');
assert.throws(() => planCarousel(noVisual, undefined, brief), (error) => error.code === 'CARD_NEWS_DATA_VISUAL', 'numeric profile rejects a card without a hero data visual');
const noTrendHistory = structuredClone(brief); noTrendHistory.trend_eligibility.observations = [];
assert.throws(() => planCarousel(numericReady, undefined, noTrendHistory), (error) => error.code === 'CARD_NEWS_BRIEF_INVALID' && /TREND_HISTORY_REQUIRED/.test(error.message), 'numeric card-news trend gate rejects missing history');
for (const mutate of [
  (input) => { input.observations[0].t = 'not-a-time'; },
  (input) => { input.observations[2].p = -900; },
  (input) => { input.observations[2].p = 1000; },
  (input) => { input.observations[2].t = input.observations[0].t; },
]) {
  const invalid = structuredClone(brief); mutate(invalid.trend_eligibility);
  assert.throws(() => planCarousel(numericReady, undefined, invalid), (error) => error.code === 'CARD_NEWS_BRIEF_INVALID', 'invalid, out-of-range, or unordered PMC history is rejected');
}
const renamedTrend = structuredClone(numericReady); renamedTrend.frames.find((frame) => frame.id === 'trend').id = 'renamed-market-history';
const renamedBrief = structuredClone(brief); renamedBrief.per_card['renamed-market-history'] = renamedBrief.per_card.trend; delete renamedBrief.per_card.trend;
renamedBrief.trend_eligibility.observations[2].p = -900;
assert.throws(() => planCarousel(renamedTrend, undefined, renamedBrief), (error) => error.code === 'CARD_NEWS_BRIEF_INVALID' && /TREND_HISTORY_INVALID/.test(error.message), 'renaming a trend frame cannot bypass valid ordered PMC history checks');
for (const banned of ['투자 권유 아님', '2026-10-21 기준 시각', '선두', '원관측', 'illustrative', '연출 이미지', 'USD bn', '수치는 정확하지 않음']) {
  const blocked = structuredClone(numericReady); blocked.frames[0].headline = banned;
  assert.throws(() => planCarousel(blocked, undefined, brief), (error) => error.code === 'SERIES_COPY', `card-news copy rejects ${banned}`);
}
for (const banned of [
  '계약 가격은 연준의 실제 결정을 확정하지 않습니다',
  '두 사실이 이번 가격 변화를 일으켰다고 단정할 수 없습니다',
  '확정하지 않습니다', '확정하지 않는다', '확정되지 않습니다', '단정할 수 없습니다', '단정하지 않는다', '투자 권유', '참고용',
]) {
  const blocked = structuredClone(genericReady);
  blocked.frames[0].blocks[1].text = banned;
  assert.throws(() => planCarousel(blocked), (error) => error.code === 'SERIES_COPY', `visible-copy ban rejects: ${banned}`);
}
console.log('prediction-market-carousel: 30 assertions PASS');
