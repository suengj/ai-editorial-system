#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('editorial/entry-manifest.json'));
const presetPin = manifest.video_genre_presets['video-genre/math-lecture'];
assert.ok(presetPin, 'math lecture genre is registered');
const presetBytes = read(presetPin.path);
assert.equal(createHash('sha256').update(presetBytes).digest('hex'), presetPin.sha256, 'genre preset matches its manifest pin');
const preset = JSON.parse(presetBytes);
assert.equal(preset.profile_id, 'video-genre/math-lecture');
assert.equal(preset.base_profile_id, 'video/educational-summary');
assert.equal(preset.overrides.motion.build_one_concept_at_a_time, true);

const references = [
  ['skills/compile-visual-story/SKILL.md', 'skills/compile-visual-story/references/math-lecture.md'],
  ['skills/compile-audio-script/SKILL.md', 'skills/compile-audio-script/references/math-lecture.md'],
];
for (const [skillPath, refPath] of references) {
  const skill = read(skillPath);
  const declaration = skill.match(/path: references\/math-lecture\.md\n\s+load_when: ([^\n]+)/);
  assert.ok(declaration, `${skillPath} declares the lecture reference conditionally`);
  assert.match(declaration[1], /video-genre\/math-lecture/);
  const ref = read(refPath);
  assert.match(ref, /Gemini Charon/);
  assert.match(ref, /canonical narration script only/);
  assert.match(ref, /x\^2/);
  assert.match(ref, /1\/2/);
}
assert.match(read('skills/compile-audio-script/references/math-lecture.md'), /Gemini Charon/);
assert.match(read('skills/compile-audio-script/references/math-lecture.md'), /canonical narration script only/);

const craft = read('skills/compile-visual-story/references/math-lecture.md');
for (const phrase of ['domain restrictions', 'one justified change per', 'caption-safe', 'near-transfer', 'independent retrieval']) {
  assert.ok(craft.includes(phrase), `lecture craft reference covers ${phrase}`);
}
const cases = JSON.parse(read('evals/fixtures/video/math-lecture-cases.json'));
assert.equal(cases.status, 'acceptance_cases_not_outcome_evidence');
assert.deepEqual(cases.cases.map((item) => item.id), [
  'formula-span-preservation', 'korean-spoken-notation', 'stepwise-derivation-sync', 'tts-script-only',
]);
console.log('lecture-craft: PASS — conditional skill references, pinned genre preset, and four acceptance cases');
