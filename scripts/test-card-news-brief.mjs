import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCardNewsBrief, validateCardNewsContentQa } from './lib/card-news-brief-core.mjs';
import { planCarousel } from './lib/carousel-core.mjs';

const frames = Array.from({ length: 6 }, (_, i) => ({
  id: `card-${i + 1}`, headline: `헤드라인 ${i + 1}`,
  blocks: [{ id: 'copy', kind: 'text', region: 'copy', text: `첫째 근거 문장에 2026년 10월 ${i + 14}일 수치를 담습니다.\n둘째 문장에서 독자에게 작동 원리를 구체적으로 설명합니다.` }],
}));
const facts = Array.from({ length: 6 }, (_, i) => ({ id: `fact-${i + 1}`, value: `확인된 사실의 구체 값 ${i + 1}`, date: `2026-10-${14 + i}`, source_url: `https://example.com/${i + 1}`, source_name: '검증 출처' }));
const series = { frames };
const brief = {
  schema_version: '1.0.0', reader_question: '연준 금리 인상 계약의 가격이 의미하는 바는 무엇인가?',
  angle: '뜨거운 물가와 약한 고용이 맞서는 가운데 시장 가격은 인상 가능성을 높게 둔다.',
  facts, so_what: '한국 독자는 미국 금리 변화가 환율과 수입 가격, 국내 차입 비용으로 이어지는 경로를 읽을 수 있다.',
  per_card: Object.fromEntries(frames.map((f, i) => [f.id, { claim: '가격은 이벤트 확률의 시장 표시다.', evidence: `2026-10-${14 + i} 기준으로 0.${i + 1} 수치가 확인된다.`, evidence_fact_ids: [`fact-${i + 1}`], takeaway: '가격과 실제 사건을 구분해서 읽는다.' }])),
};
assert.equal(validateCardNewsBrief(series, brief).ok, true);
const fail = (mutate, code) => { const s = structuredClone(series), b = structuredClone(brief); mutate(s, b); assert(validateCardNewsBrief(s, b).issues.some((x) => x.code === code), code); };
fail((s, b) => { delete b.per_card['card-1']; }, 'CARD_NEWS_CARD_EVIDENCE');
fail((s, b) => { s.frames[0].blocks[0].text = '둘째 줄'; }, 'CARD_NEWS_BODY_TOO_THIN');
fail((s, b) => { s.frames[0].blocks[0].text = `${'가'.repeat(121)}\n${'나'.repeat(5)}`; }, 'CARD_NEWS_BODY_TOO_LONG');
fail((s, b) => { b.per_card['card-1'].evidence_fact_ids = ['unknown']; }, 'CARD_NEWS_CARD_EVIDENCE');
fail((s, b) => { b.per_card['card-1'].evidence = 'The sourced value is 2026, but no matching number is printed on this card.'; s.frames[0].blocks[0].text = '첫째 문장은 독자에게 작동 원리를 차분하게 설명합니다.\n둘째 문장은 이해를 돕는 충분한 맥락을 제공합니다.'; }, 'CARD_NEWS_EVIDENCE_NOT_VISIBLE');
fail((s, b) => { for (const id of Object.keys(b.per_card).slice(1)) b.per_card[id].evidence_fact_ids = ['fact-1']; }, 'CARD_NEWS_FACTS_USED');
fail((s, b) => { b.facts = b.facts.slice(0, 5); }, 'CARD_NEWS_FACT_COUNT');
const carousel = JSON.parse(readFileSync('scripts/fixtures/carousel/series.json', 'utf8'));
assert.throws(() => planCarousel({ ...carousel, content_kind: 'card-news' }), (error) => error.code === 'CARD_NEWS_BRIEF_REQUIRED');
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
console.log('card-news-brief: 16 assertions PASS');
