import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lintKoreanCopy } from './korean-copy-lint.mjs';

const flagged = (text, id, profileId = 'signalytics-news', extra = {}) => {
  const result = lintKoreanCopy({ text, profileId, ...extra });
  assert.ok(result.findings.some((f) => f.id === id), `${id} should be reported`);
  assert.equal(result.hard_blocks, 0);
  assert.ok(result.findings.every((f) => f.severity === 'warn'));
};
const clean = (text, profileId = 'signalytics-news', extra = {}) => {
  const result = lintKoreanCopy({ text, profileId, ...extra });
  assert.equal(result.findings.length, 0, JSON.stringify(result.findings));
  assert.equal(result.hard_blocks, 0);
};

clean('연준은 10월 금리를 동결했다. 시장은 12월 인상 가능성을 반영하고 있다.');
flagged('금리 시장 경제 정책이 필요합니다.', 'noun-chain');
flagged('금리 변화에 대한 설명을 진행합니다.', 'about-phrase');
flagged('자료를 통해 시장을 살펴봅니다.', 'through-phrase');
flagged('투자자는 조건을 확인하는 것이 중요합니다.', 'important-template');
flagged('정책이 되어지고 있다.', 'double-passive-doeojida');
flagged('이번 글에서는 금리 전망을 살펴보겠습니다.', 'meta-work-words');
flagged('역대급 성과를 냈다.', 'unsupported-superlative');
flagged('본문에서 35%와 35%가 반복된다.', 'repeated-hero-number', 'signalytics-news', { heroNumbers: ['35%'] });
clean('본문에서 35%와 36%를 비교한다.', 'signalytics-news', { heroNumbers: ['35%'] });
clean('다른 수치 135%는 35%와 다르다.', 'signalytics-news', { heroNumbers: ['135%'] });

const community = lintKoreanCopy({ text: '이번 글에서는 커뮤니티 이야기를 살펴보겠습니다.', profileId: 'trends-moa' });
assert.equal(community.profile_family, 'community');
assert.ok(!community.findings.some((f) => f.id === 'meta-work-words'), 'economics-desk meta detector must not override community register');
assert.equal(community.hard_blocks, 0);

const approved = JSON.parse(readFileSync(new URL('../editorial/approved-examples.json', import.meta.url), 'utf8'));
assert.ok(approved.approvals.length > 0);
assert.ok(approved.approvals.every((a) => a.kind === 'owner_selected_excerpt' && !('text' in a)), 'approved prose stays private and pointer-only in this repository');
// No detector finding is a hard block, so no approved excerpt can be blocked by this lint.
assert.ok(lintKoreanCopy({ text: '승인 예문은 private pointer로만 등록됩니다.', profileId: 'personal-linkedin' }).findings.every((f) => f.severity === 'warn'));
console.log('korean-copy-lint: PASS — deterministic positive/negative examples, profile routing, warning-only levels, and private approved-sample boundary');
