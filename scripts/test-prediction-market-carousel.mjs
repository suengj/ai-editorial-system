import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planCarousel } from './lib/carousel-core.mjs';
import { CARD_NEWS_TYPE_TOKENS } from './lib/typography-core.mjs';
import { checkTrendCardEligibility } from './lib/numeric-visual-core.mjs';

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
assert.equal(profile.trend_image_mode.id, 'illustrative_trend_image');
assert.equal(profile.trend_image_mode.owner_decision, true);
assert.equal(profile.trend_image_mode.requires_raw_history, true);
assert.deepEqual(profile.trend_image_mode.renderer_overlays, ['start_value', 'end_value', 'change_pp']);
assert.equal(profile.trend_image_mode.numeric_parity_check, 'required');
assert.deepEqual(recipe.visual_style, { default: 'R4', fallback: 'R7', fallback_when: 'no suitable rights-cleared photo' });
assert.equal(recipe.card_count, 5);
assert.deepEqual(template.frames.map((f) => f.id), ['hook', 'trend', 'why', 'korea-impact', 'watch-next']);
assert(template.frames.every((f) => f.headline && f.takeaway && f.blocks.length));
assert(template.frames[1].blocks.some((b) => b.kind === 'chart' && b.sha256.startsWith('PLACEHOLDER:')));
assert.equal(template.footer_policy, 'content_only');
assert.equal(template.recipe, 'r4-photo-fullbleed');
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
const planned = planCarousel(ready);
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
const badCopy = structuredClone(ready);
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
const factIds = ['f1','f2','f3','f4','f5','f6'];
const brief = {
  schema_version: '1.0.0', reader_question: '시장 가격은 어떤 방향으로 움직였나?',
  angle: '가격의 변화는 회의 전 기대와 국내 금융 여건을 함께 움직인다.',
  so_what: '독자는 시장 가격과 국내 환율 및 대출금리의 연결을 읽을 수 있다.',
  trend_eligibility: structuredClone(trendEligibility),
  facts: factIds.map((id) => ({ id, value: '42% confirmed value', date: '2026-10-21', source_url: 'https://example.com/source', source_name: 'Source' })),
  per_card: Object.fromEntries(numericReady.frames.map((frame, i) => [frame.id, {
    claim: '가격 흐름이 바뀌었다.', evidence: '42% confirmed value', evidence_fact_ids: i === 0 ? [factIds[0], factIds[5]] : [factIds[i]], takeaway: '다음 회의를 주시한다.'
  }]))
};
const numericPlan = planCarousel(numericReady, undefined, brief);
const numericLayers = numericPlan.frames.flatMap((frame) => frame.plan.layers).filter((layer) => layer.kind === 'text');
assert(numericPlan.frames.every((frame) => frame.plan.layers.some((layer) => layer.kind === 'chart')), 'numeric profile requires a data visual on every card');
assert(numericLayers.every((layer) => [64, 150, 110, 34, 36].includes(layer.font_size)), 'numeric profile uses only shared card-news font sizes');
assert(Object.values(numericPlan.typography).every((style) => [64, 150, 110, 34, 36].includes(style.font_size)), 'renderer typography config exposes no non-token font sizes');
assert.deepEqual(numericPlan.card_news_type_tokens, CARD_NEWS_TYPE_TOKENS, 'renderer plan carries the shared token contract');
assert.equal(numericLayers.find((layer) => layer.id === 'headline').font_family, CARD_NEWS_TYPE_TOKENS.headline.font_family);
const noVisual = structuredClone(numericReady); noVisual.frames[0].blocks = noVisual.frames[0].blocks.filter((block) => block.kind !== 'chart');
assert.throws(() => planCarousel(noVisual, undefined, brief), (error) => error.code === 'CARD_NEWS_DATA_VISUAL', 'numeric profile rejects a card without a hero data visual');
const noTrendHistory = structuredClone(brief); noTrendHistory.trend_eligibility.observations = [];
assert.throws(() => planCarousel(numericReady, undefined, noTrendHistory), (error) => error.code === 'CARD_NEWS_BRIEF_INVALID' && /TREND_HISTORY_REQUIRED/.test(error.message), 'numeric card-news trend gate rejects missing history');
for (const banned of ['투자 권유 아님', '2026-10-21 기준 시각', '선두', '원관측', 'illustrative', '연출 이미지', 'USD bn', '수치는 정확하지 않음']) {
  const blocked = structuredClone(numericReady); blocked.frames[0].headline = banned;
  assert.throws(() => planCarousel(blocked, undefined, brief), (error) => error.code === 'SERIES_COPY', `card-news copy rejects ${banned}`);
}
for (const banned of [
  '계약 가격은 연준의 실제 결정을 확정하지 않습니다',
  '두 사실이 이번 가격 변화를 일으켰다고 단정할 수 없습니다',
  '확정하지 않습니다', '확정하지 않는다', '확정되지 않습니다', '단정할 수 없습니다', '단정하지 않는다', '투자 권유', '참고용',
]) {
  const blocked = structuredClone(ready);
  blocked.frames[0].blocks[1].text = banned;
  assert.throws(() => planCarousel(blocked), (error) => error.code === 'SERIES_COPY', `visible-copy ban rejects: ${banned}`);
}
console.log('prediction-market-carousel: 30 assertions PASS');
