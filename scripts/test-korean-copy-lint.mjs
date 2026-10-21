import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countHeroNumericTokens, lintKoreanCopy } from './korean-copy-lint.mjs';

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
flagged('그 절차는 적용되어집니다.', 'double-passive-doeojida');
flagged('제도가 개선되어졌다.', 'double-passive-doeojida');
flagged('내용이 확정되어졌습니다.', 'double-passive-doeojida');
flagged('내용이 확정되어졌고 다음 단계로 갔다.', 'double-passive-doeojida');
flagged('이번 글에서는 금리 전망을 살펴보겠습니다.', 'meta-work-words');
flagged('역대급 성과를 냈다.', 'unsupported-superlative');
clean('일정은 최대한 여유롭게 잡았다.');
flagged('본문에서 35%와 35%가 반복된다.', 'repeated-hero-number', 'signalytics-news', { heroNumbers: ['35%'] });
clean('본문에서 35%와 36%를 비교한다.', 'signalytics-news', { heroNumbers: ['35%'] });
clean('다른 수치 135%는 35%와 다르다.', 'signalytics-news', { heroNumbers: ['135%'] });
clean('부채비율은 0.35%다. 지난해에는 1.35%였다.', 'signalytics-news', { heroNumbers: ['35%'] });
flagged('올해는 35%, 지난해도 35%.', 'repeated-hero-number', 'signalytics-news', { heroNumbers: ['35%'] });

const numericTokenCases = [
  // Existing regression cases.
  ['35%,35%,40%', '35%', 2],
  ['올해는 35%, 지난해도 35%.', '35%', 2],
  ['0.35% 1.35%', '35%', 0],
  ['35,000명', '35', 0],
  ['1,350%', '350%', 0],
  ['(35%)', '35%', 1],
  ['35%p', '35%', 0],
  // Sign, decimal, open-ended unit, and whole-token regressions.
  ['수익률은 -35%, -35%다.', '-35%', 2],
  ['−35%', '-35%', 1],
  ['+35 -35', '35', 0],
  ['35만명, 35만명', '35만명', 2],
  ['35달러, 35달러', '35달러', 2],
  ['35 명 / 35명', '35 명', 2],
  ['35 kg 35 KG', '35 kg', 2],
  ['35만', '35', 0],
  ['+3.5%p, +3.5%p', '+3.5%p', 2],
  ['35bp', '35%', 0],
  // Hero-driven matching keeps particles and punctuation as valid boundaries.
  ['35만 명, 35만 명', '35만 명', 2],
  ['35 km/h, 35 km/h', '35 km/h', 2],
  ['35만 달러, 35만 원', '35만', 0],
  ['35%였다. 35%였다.', '35%', 2],
  ['35명이다. 35명이다.', '35명', 2],
  ['35%→40%, 35%→45%', '35%', 2],
  // Currency-prefix regressions, including optional whitespace for code prefixes.
  ['$35와 $35다.', '$35', 2],
  ['₩35,000과 ₩35,000이다.', '₩35,000', 2],
  ['US$ 35, US$35', 'US$35', 2],
  // Currency and sign are equivalent in either order in hero and copy.
  ['-$35와 -$35다.', '-$35', 2],
  ['+₩35,000과 +₩35,000이다.', '+₩35,000', 2],
  ['$-35와 -$35', '-$35', 2],
];
for (const [text, heroNumber, expected] of numericTokenCases) {
  assert.equal(countHeroNumericTokens(text, heroNumber), expected, `${JSON.stringify(text)} should contain ${heroNumber} ${expected} time(s)`);
}

const community = lintKoreanCopy({ text: '이번 글에서는 커뮤니티 이야기를 살펴보겠습니다.', profileId: 'trends-moa' });
assert.equal(community.profile_family, 'community');
assert.ok(!community.findings.some((f) => f.id === 'meta-work-words'), 'economics-desk meta detector must not override community register');
assert.equal(community.hard_blocks, 0);

const approved = JSON.parse(readFileSync(new URL('../editorial/approved-examples.json', import.meta.url), 'utf8'));
assert.ok(approved.approvals.length > 0);
assert.ok(approved.approvals.every((a) => a.kind === 'owner_selected_excerpt' && !('text' in a)), 'approved prose stays private and pointer-only in this repository');
const approvedExpected = new Map([
  ['excerpt:owner-personal-20261014-o1', []],
  ['excerpt:owner-personal-20261014-l1', ['about-phrase']],
  ['excerpt:owner-personal-20261014-t1', []],
]);
const libraryRoot = process.env.INTELLIGENCE_LIBRARY_REPO ?? resolve(fileURLToPath(new URL('..', import.meta.url)), '../intelligence-library');
if (existsSync(resolve(libraryRoot, '.git'))) {
  const excerpts = approved.approvals.filter((a) => approvedExpected.has(a.entry_id));
  assert.equal(excerpts.length, approvedExpected.size, 'all selected approved pointers are registered');
  for (const excerpt of excerpts) {
    const match = excerpt.source_ref.locator.match(/\/blob\/([a-f0-9]{40})\/([^#]+)#L(\d+)/);
    assert.ok(match, `${excerpt.entry_id} must be a commit-pinned single-line pointer`);
    const [, commit, path, lineText] = match;
    const source = execFileSync('git', ['-C', libraryRoot, 'show', `${commit}:${path}`], { encoding: 'utf8' });
    const text = source.split(/\r?\n/u)[Number(lineText) - 1];
    assert.ok(text, `${excerpt.entry_id} pinned line is available`);
    const result = lintKoreanCopy({ text, profileId: 'personal-linkedin' });
    assert.deepEqual(result.findings.map((f) => f.id), approvedExpected.get(excerpt.entry_id), `${excerpt.entry_id} expected advisory findings`);
    assert.equal(result.hard_blocks, 0);
  }
  console.log('korean-copy-lint: PASS — approved pinned excerpt advisories match the recorded clean/about-phrase/clean expectations');
} else {
  console.log('korean-copy-lint: SKIP approved excerpt prose — private intelligence-library checkout unavailable');
}
console.log('korean-copy-lint: PASS — positive/negative examples, profile routing, warning-only levels, and private approved-sample boundary');
