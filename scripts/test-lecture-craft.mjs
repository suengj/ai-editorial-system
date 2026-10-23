#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { RuleReader, resolveEditorial, STATUS } from './lib/resolve-core.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('editorial/entry-manifest.json'));
const pin = manifest.video_genre_presets['video-genre/math-lecture'];
assert.ok(pin, 'math lecture genre is registered');
const presetBytes = read(pin.path);
assert.equal(createHash('sha256').update(presetBytes).digest('hex'), pin.sha256);
const preset = JSON.parse(presetBytes);
assert.equal(preset.profile_id, 'video-genre/math-lecture');
assert.equal(preset.base_profile_id, 'video/educational-summary');

// Production references must be selected only for the lecture genre. These
// declarations are the runtime load contract; answer-bearing cases stay in evals.
for (const path of ['skills/compile-visual-story/SKILL.md', 'skills/compile-audio-script/SKILL.md']) {
  const skill = read(path);
  const ref = skill.match(/path: references\/math-lecture\.md\n\s+load_when: ([^\n]+)/);
  assert.ok(ref, `${path} declares its lecture reference`);
  assert.match(ref[1], /^the selected video genre is video-genre\/math-lecture/,
    `${path} must not make the lecture reference unconditional`);
}

// Exercise the production editorial resolver on a non-lecture video route.
const intent = { intent_id: 'intent:lecture-craft-negative-control', request: { language: 'ko' }, axes: {
  transformation: { value: 'synthesize' }, content_type: { value: 'research' },
  audience: { value: 'domain-practitioner' }, surface: { value: 'newsletter' },
  artifacts: [{ value: 'text/brief' }],
} };
const resolved = resolveEditorial(intent, { flowId: 'news', taskKind: 'text', reader: new RuleReader({ revision: 'lecture-craft-test' }) });
assert.equal(resolved.status, STATUS.READY);
const loadedPaths = resolved.loads.map((entry) => entry.path);
assert.ok(loadedPaths.includes('editorial/profiles/surface/newsletter.json'));
for (const path of ['skills/compile-visual-story/references/math-lecture.md', 'skills/compile-audio-script/references/math-lecture.md', 'evals/fixtures/video/math-lecture-cases.json']) {
  assert.ok(!loadedPaths.includes(path), `non-lecture resolver loaded ${path}`);
}

// Behavioral oracle over evaluator-only answer-bearing cases. Positive and
// negative controls ensure a broken candidate is rejected, not just recognized.
const cases = JSON.parse(read('evals/fixtures/video/math-lecture-cases.json'));
assert.equal(cases.status, 'acceptance_cases_not_outcome_evidence');
const productionCraft = read('skills/compile-visual-story/references/math-lecture.md');
const findCase = (id) => {
  const item = cases.cases.find((candidate) => candidate.id === id);
  assert.ok(item, `missing evaluator case ${id}`);
  return item;
};
const formulaCase = findCase('formula-span-preservation');
const formulaIsPreserved = (rendering) => formulaCase.must_preserve.every((span) => rendering.includes(span));
const goodFormula = 'x^2 - 1 = (x - 1)(x + 1), for x != 1';
assert.equal(formulaIsPreserved(goodFormula), true, 'unchanged formula passes');
assert.equal(formulaIsPreserved(goodFormula.replace('x^2', 'x^3')), false, 'mutated exponent fails');
assert.ok(formulaCase.reject_if.length >= 3, 'formula negative-control cases remain present');

const speechCase = findCase('korean-spoken-notation');
const conventionLines = productionCraft.split('\n');
const convention = new Map(conventionLines.flatMap((line) => {
  const match = line.match(/^\| `([^`]+)` \| `([^`]+)`/);
  return match ? [[match[1], match[2]]] : [];
}));
const readings = new Map(speechCase.input.map((notation, i) => {
  assert.equal(speechCase.expected_house_reading[i], convention.get(notation), `fixture reading for ${notation} must match production convention`);
  return [notation, convention.get(notation)];
}));
const readingMatches = (notation, spoken) => readings.get(notation) === spoken;
assert.equal(readingMatches('1/2', '이분의 일'), true, 'house reading passes');
assert.equal(readingMatches('1/2', '일분의 이'), false, 'reversed fraction reading fails');
assert.equal(speechCase.input.length, speechCase.expected_house_reading.length);
assert.ok(speechCase.reject_if.length >= 2, 'spoken-notation negative controls remain present');

const syncCase = findCase('stepwise-derivation-sync');
const spokenSteps = ['2(x + 1) = 8', 'x + 1 = 4', 'x = 3'];
const visibleSteps = [...spokenSteps];
const syncIsOrdered = (spoken, visible, captions) => spoken.length === visible.length
  && visible.every((step, index) => step === spoken[index] && captions[index] === step);
const captions = [...spokenSteps];
assert.equal(syncIsOrdered(spokenSteps, visibleSteps, captions), true, 'ordered narration, frames, and captions pass');
assert.equal(syncIsOrdered(spokenSteps, [...visibleSteps].reverse(), captions), false, 'revealed step order mutation fails');
assert.equal(syncIsOrdered(spokenSteps, visibleSteps, [...captions].reverse()), false, 'caption order mutation fails');
assert.ok(syncCase.must_show.some((item) => item.includes('caption matches')));
assert.ok(syncCase.reject_if.length >= 2, 'synchronization negative controls remain present');

for (const phrase of ['domain restrictions', 'one justified change per', 'caption-safe', 'near-transfer', 'independent retrieval']) {
  assert.ok(productionCraft.includes(phrase), `production craft rule covers ${phrase}`);
}
assert.ok(productionCraft.includes('answer-bearing evaluation fixtures'), 'production reference states the evaluator-only boundary');
assert.ok(!productionCraft.includes('math-lecture-cases.json'), 'production reference does not depend on the answer fixture');
console.log('lecture-craft: PASS — resolver route, evaluator isolation, formula/speech/synchronization behavior and negative controls');
