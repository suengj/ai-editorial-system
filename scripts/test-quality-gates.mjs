#!/usr/bin/env node
/**
 * Regression test for the editorial quality gates — AES-P1.3 (SUE-440).
 *
 * Two directions, both required:
 *   negative fixture (the SUE-417 failure shape) → the named gates fire
 *   golden fixture                               → nothing rejects
 *
 * A gate suite that only fires on bad text proves nothing about good text.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks, loadGates, runGates, SEVERITY } from './lib/quality-gates-core.mjs';
import { assessPolish, checkPolish, extractSpans } from './lib/polish-invariants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const NEGATIVE = resolve(ROOT, 'evals/fixtures/negative/N-01-sue-417-shape.md');
const GOLDEN = resolve(ROOT, 'evals/fixtures/golden/G-01-synthesis.md');
const BUNDLE = resolve(ROOT, 'schemas/examples/article-artifact.example.json');
const N04 = resolve(ROOT, 'evals/fixtures/negative/N-04-translationese.md');
const G02 = resolve(ROOT, 'evals/fixtures/golden/G-02-view.md');
const G03 = resolve(ROOT, 'evals/fixtures/golden/G-03-note.md');
const G04 = resolve(ROOT, 'evals/fixtures/golden/G-04-korean-native.md');

const gates = loadGates();
const negative = readFileSync(NEGATIVE, 'utf8');
const golden = readFileSync(GOLDEN, 'utf8');
const article = JSON.parse(readFileSync(BUNDLE, 'utf8')).article;

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

// --- negative fixture -----------------------------------------------------
console.log('SUE-417 failure shape (expect the named gates to fire)');
{
  const found = runGates(negative, null, gates);
  const names = found.map((f) => f.gate);
  const sev = (g) => found.find((f) => f.gate === g)?.severity;

  for (const [gate, severity] of [
    ['prompt-echo', SEVERITY.REJECT],
    ['duplicate-paragraph', SEVERITY.REJECT],
    ['scaffolding-leak', SEVERITY.REJECT],
    ['uncertainty-present', SEVERITY.REJECT],
    ['empty-hedge', SEVERITY.FIX],
    ['formulaic-sectioning', SEVERITY.FLAG],
    ['sequential-summary', SEVERITY.FLAG],
  ]) {
    check(`${gate} fires at ${severity}`, names.includes(gate) && sev(gate) === severity,
      `got [${names.join(', ')}]`);
  }
  check('the draft is blocked from materialization', blocks(found));
}

// --- golden fixture -------------------------------------------------------
console.log('golden fixture (expect nothing to reject)');
{
  const found = runGates(golden, article, gates);
  check('no findings at all on a passing article', found.length === 0,
    JSON.stringify(found.map((f) => `${f.severity}:${f.gate}`)));
  check('not blocked', !blocks(found));
  check('the golden fixture is genuinely dense',
    runGates(golden, article, gates).every((f) => f.gate !== 'evidence-density'));
}

// --- targeted gate behaviour ----------------------------------------------
console.log('targeted gate behaviour');
{
  const withArticle = (body, patch = {}) => runGates(body, { ...article, ...patch }, gates).map((f) => f.gate);

  check('an article whose frame states no uncertainty is rejected',
    withArticle(golden, { frame: { ...article.frame, uncertainty: [] } }).includes('uncertainty-present'));

  check('a title written for a different piece is caught',
    withArticle(golden, { title: 'Seoul weather in September' }).includes('headline-thesis-fidelity'));

  check('a claim-shaped title matching the thesis is not second-guessed',
    !withArticle(golden).includes('headline-thesis-fidelity'));

  const dupCitations = {
    ...article,
    verification: {
      ...article.verification,
      claims: [{
        claim_id: 'c1', text: 'x', kind: 'number', status: 'verified',
        evidence: [
          { url: 'https://example.com/a', retrieved_at: '2026-09-01' },
          { url: 'https://example.com/a', retrieved_at: '2026-09-01' },
        ],
      }],
    },
  };
  check('a repeated citation URL is caught',
    runGates(golden, dupCitations, gates).some((f) => f.gate === 'citation-integrity'));

  const workingDoc = JSON.parse(JSON.stringify(article));
  workingDoc.verification.claims[0].evidence[0].url = 'https://docs.google.com/document/d/abc/edit';
  check('a citation pointing at a working document is caught',
    runGates(golden, workingDoc, gates).some((f) => f.gate === 'citation-integrity'));

  const disposable = JSON.parse(JSON.stringify(article));
  disposable.verification.claims[0].evidence[0].title = 'AUTO-BLOG SOURCE (disposable) — pricing';
  check('a citation labelled disposable is caught',
    runGates(golden, disposable, gates).some((f) => f.gate === 'citation-integrity'));

  check('a banned opening is caught',
    runGates('In today\'s rapidly evolving landscape, pricing matters.\n\n' + golden, article, gates)
      .some((f) => f.gate === 'filler-phrase'));

  check('an overclaim is flagged, not rejected',
    runGates(golden + '\n\n이 데이터는 항상 마진 회복을 보장한다.\n', article, gates)
      .some((f) => f.gate === 'overclaim' && f.severity === SEVERITY.FLAG));

  const thin = '어떤 주장이 있다.\n\n또 다른 주장이 있다.\n\n마지막 주장이 있다.\n';
  check('a piece with no numbers, dates, or citations is flagged for density',
    runGates(thin, article, gates).some((f) => f.gate === 'evidence-density'));
}

// --- G-13 translationese-scaffold (SUE-523) --------------------------------
console.log('translationese-scaffold (G-13)');
{
  const fires = (body) => runGates(body, null, gates).some((f) => f.gate === 'translationese-scaffold');

  check('fires on N-04\'s body (genuine repetition of the same scaffold)',
    fires(readFileSync(N04, 'utf8')));

  check('silent on G-01 (no scaffold strings at all)', !fires(golden));
  check('silent on G-02', !fires(readFileSync(G02, 'utf8')));
  check('silent on G-03', !fires(readFileSync(G03, 'utf8')));
  check('silent on G-04 (the native rewrite of N-04)', !fires(readFileSync(G04, 'utf8')));

  // Threshold boundary: the same scaffold repeated three times is not yet
  // "repetition" by this gate's floor (4); four times is. The floor moved
  // 3 → 4 after review found two idiomatic three-paragraph passages at the
  // old floor of 3 (see the two false-positive checks below) — this
  // boundary pair moves with it so it stays true to the live config rather
  // than asserting a stale number.
  const thrice = '정책이 지속된다는 점에서 지지를 얻었다.\n\n시장은 정책이 유효하다는 점에서 반응했다.\n\n전문가들도 정책이 타당하다는 점에서 동의했다.\n';
  const fourTimes = thrice + '\n야당도 정책이 부당하다는 점에서 반대했다.\n';
  check('three occurrences of the same scaffold: silent', !fires(thrice));
  check('four occurrences of the same scaffold: fires', fires(fourTimes));

  // Reviewer B's verified false positive: several different scaffold
  // strings, each used once and legitimately (a third-party viewpoint, a
  // stated cause, a framed stake) — repetition of a single scaffold, not
  // the combined count, is what the gate must key on.
  const distinctOnce = [
    '규제당국은 이 거래를 승인했다.',
    '시장 지배력이 커지지 않는다는 점에서 경쟁 제한 우려가 작다고 봤다.',
    '소비자의 관점에서 보이는 그림은 다르다. 요금제는 그대로지만 선택지는 줄었다.',
    '이러한 맥락에서 2023년의 합병 심사 기준이 다시 거론된다.',
    '인수 자체보다 결국 중요한 것은 통합 이후의 운영이다.',
  ].join('\n\n');
  check('several distinct scaffolds, each used once, do not sum to a false positive',
    !fires(distinctOnce));

  // Two further false positives Reviewer B measured at the old floor of 3,
  // both idiomatic and neither translationese: attributing opposed
  // viewpoints to two named parties, and an ordinary causal connective used
  // twice. Both sat exactly at the floor, so the floor moved 3 → 4 rather
  // than excluding 의 관점에서 from the pattern list (SUE-523 names it
  // explicitly; the manager's call was to keep its coverage).
  const contrastiveAttribution = '규제당국의 관점에서 이 거래는 승인 대상이다.\n\n사업자의 관점에서는 정반대다. 이는 시장 왜곡이라는 점에서 지적된다.\n\n소비자단체는 아직 입장을 정하지 않았다.\n';
  check('contrastive viewpoint attribution to two named parties does not fire',
    !fires(contrastiveAttribution));

  const ordinaryCausal = '성능만 두 배 올랐다는 점에서 이 제품은 특별하다.\n\n업계의 관점에서 보면 그렇지 않다.\n\n원가 구조가 다르다는 점에서 비교가 쉽지 않다.\n';
  check('an ordinary causal connective used twice does not fire',
    !fires(ordinaryCausal));

  // Length scaling (D4/R5): the same repeated scaffold that fires a short
  // piece must go silent once padded out to a length where three-plus
  // occurrences are no longer a meaningful concentration. This guards the
  // one mechanism added specifically to answer D4 — without it, deleting
  // minRatePerParagraph from the gate config leaves this whole test file
  // green.
  const padding = Array.from({ length: 36 }, (_, i) => `무관한 문단 ${i}번이다. 다른 사실을 말한다.`).join('\n\n');
  const padded = fourTimes + '\n' + padding;
  check('same repeated scaffold that fires unpadded (~4 paragraphs): fires', fires(fourTimes));
  check('same repeated scaffold, padded to ~40 paragraphs of unrelated prose: goes silent',
    !fires(padded));

  // A synonym-substitution-only evasion attempt: rewrite N-04's scaffolds to
  // different words carrying the same discourse-scaffolding shape and the
  // same English clause order. This is the adversarial check the review
  // demanded — G-13 was never meant to catch this (it is a narrow mechanical
  // gate on a fixed string list, not a synonym detector), and voice.md and
  // editorial-polish's explicit anti-formula guidance is the actual defense
  // against it, not this gate. Recorded here as a bounded, known gap.
  // NOTE for future contributors: this assertion passing means the gap is
  // still open. Closing the gap (e.g. broadening the pattern list to catch
  // this specific rewrite) means DELETING this assertion, not "fixing" it
  // to keep it green — a green suite here is not a signal to leave this
  // alone.
  const synonymEvasion = readFileSync(N04, 'utf8')
    .replace(/결국 중요한 것은/g, '관건은')
    .replace(/이러한 맥락에서/g, '이런 상황에서')
    .replace(/다는 점에서/g, '다는 입장에서');
  check('synonym-substitution evasion is a known, bounded gap (documented, not silently assumed caught)',
    !fires(synonymEvasion));

  // A hit inside a protected quotation cannot be fixed without altering the
  // quotation itself, which polish-invariants forbids at reject severity.
  // The gate must not ask for a change another gate refuses to allow.
  const quotedScaffold = '이 문서는 다음과 같이 인용한다.\n\n"정책이 지속된다는 점에서 지지를 얻었다. 정책이 유효하다는 점에서 반응했다. 정책이 타당하다는 점에서 동의했다."\n\n필자는 이 인용을 그대로 받아들이지 않는다.\n';
  check('scaffold strings inside a protected quotation do not fire the gate',
    !fires(quotedScaffold));
}

// --- polish invariants ----------------------------------------------------
console.log('polish invariants');
{
  const before = '가격은 30% 하락했다. [^1] 자세한 내용은 https://example.com/pricing 참고. "gross margin" 은 2026-08-30 기준이다.';

  const rephrased = '2026-08-30 기준으로 "gross margin" 을 보면, 가격은 30% 하락했다. [^1] 자세한 내용은 https://example.com/pricing 참고.';
  const r = assessPolish(before, rephrased);
  check('reordering and rephrasing is permitted', r.ok, JSON.stringify(r.violations));
  check('and is recognised as an actual change', r.changed);

  const droppedNumber = before.replace('30%', '크게');
  check('dropping a number is a violation',
    checkPolish(before, droppedNumber).some((v) => v.class === 'numbers' && v.kind === 'removed'));

  const changedNumber = before.replace('30%', '40%');
  const cv = checkPolish(before, changedNumber);
  check('changing a number is caught in both directions',
    cv.some((v) => v.kind === 'removed' && v.value.includes('30')) &&
    cv.some((v) => v.kind === 'added' && v.value.includes('40')));

  const addedNumber = before + ' 이는 3년 만의 최대폭이다.';
  check('adding an uncited number is a fabrication, not a polish',
    checkPolish(before, addedNumber).some((v) => v.kind === 'added'));

  const droppedCitation = before.replace(' [^1]', '');
  check('dropping a citation marker is a violation',
    checkPolish(before, droppedCitation).some((v) => v.class === 'citation-markers'));

  const droppedUrl = before.replace('https://example.com/pricing', '해당 페이지');
  check('dropping a URL is a violation',
    checkPolish(before, droppedUrl).some((v) => v.class === 'urls'));

  const alteredQuote = before.replace('"gross margin"', '"gross margins"');
  check('altering a quotation is a violation',
    checkPolish(before, alteredQuote).some((v) => v.class === 'quotations'));

  const translatedTerm = before.replace('"gross margin"', '"매출총이익률"');
  check('translating a protected technical term is a violation',
    checkPolish(before, translatedTerm).length > 0);

  const spans = extractSpans(before);
  check('spans are extracted per class', spans.numbers.size > 0 && spans.urls.size === 1);
  check('an unchanged body reports ok but not changed',
    assessPolish(before, before).ok && !assessPolish(before, before).changed);
}

console.log(failures === 0 ? '\nquality gates regression: PASS' : `\nquality gates regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
