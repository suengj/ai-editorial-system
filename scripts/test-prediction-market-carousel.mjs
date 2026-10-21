import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planCarousel } from './lib/carousel-core.mjs';

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
