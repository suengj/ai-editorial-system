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
