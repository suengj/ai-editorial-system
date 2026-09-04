#!/usr/bin/env node
/**
 * Regression test for the audio plan contract — AES-V2.8 (SUE-566).
 *
 * Two directions, both required:
 *   allow fixtures (the three schemas/examples/audio-plan-*.example.json) → PASS
 *   deny fixtures, including the named failure modes from the SUE-566 brief → FAIL
 *
 * A gate suite that only fires on bad plans proves nothing about good ones,
 * and a gate suite that never names its regressions cannot be checked for
 * regressing again.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, loadArtifactProfiles, loadSchema, validateAudioPlan } from './lib/audio-plan-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXAMPLES_DIR = resolve(ROOT, 'schemas/examples');

const schema = loadSchema();
const profiles = loadArtifactProfiles();
const opts = { schema, profiles };

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const loadExample = (name) => JSON.parse(readFileSync(resolve(EXAMPLES_DIR, name), 'utf8'));
const codesOf = (plan) => validateAudioPlan(plan, opts).map((i) => i.code);

// --- allow fixtures --------------------------------------------------------
console.log('allow fixtures (expect PASS)');
{
  const files = readdirSync(EXAMPLES_DIR)
    .filter((f) => f.startsWith('audio-plan-') && f.endsWith('.example.json'));
  check('exactly 3 audio-plan example fixtures exist (monologue, dialogue, timed-narration)', files.length === 3, files.join(', '));

  for (const f of files) {
    const plan = loadExample(f);
    const issues = validateAudioPlan(plan, opts);
    check(f, issues.length === 0, issues.map((i) => `[${i.code}] ${i.message}`).join(' | '));
  }
}

const mono = loadExample('audio-plan-monologue.example.json');
const dialogue = loadExample('audio-plan-dialogue.example.json');
const timed = loadExample('audio-plan-timed-narration.example.json');

// --- deny fixtures ----------------------------------------------------------
console.log('\ndeny fixtures (expect FAIL, with the specific gate named)');

{
  // Article prose passed through as the spoken script — the default failure
  // this contract exists to prevent (AUDIO-SCRIPT.md §1).
  const plan = clone(mono);
  plan.recompilation.identical_to_source_prose = true;
  check('article prose sent straight through: recompilation.identical_to_source_prose=true', codesOf(plan).includes(CODES.ARTICLE_PROSE_UNCOMPILED));
}

{
  // Same failure mode, structural signal: a markdown heading and inline
  // citation marker left in narration_text — article conventions, not speech.
  const plan = clone(mono);
  plan.spoken_script.narration_text = '## Tokenized money-market funds\n\nAs shown in the data [1], settlement moves faster.';
  check('narration_text still carries article headings/citation markers', codesOf(plan).includes(CODES.ARTICLE_PROSE_UNCOMPILED));
}

{
  // A render attempted with no script_l1 pass.
  const plan = clone(mono);
  plan.status = 'rendering';
  plan.script_l1 = { performed: false, outcome: 'not_yet' };
  plan.render = {
    tool: 'tts-adapter', provider: 'acme-tts', model: 'acme-voice-1', model_version: '2026-01-01',
    voice_provenance_class: 'synthetic_designed',
  };
  check('render attempted before script_l1 has passed', codesOf(plan).includes(CODES.RENDER_BEFORE_SCRIPT_L1));
}

{
  // Rendered-audio QA recorded with no render lineage at all.
  const plan = clone(mono);
  plan.qa.performed = true;
  plan.qa.pronunciation_check = 'pass';
  check('qa.performed=true with render still null', codesOf(plan).includes(CODES.QA_BEFORE_RENDER));
}

{
  // Attempts budget.
  const plan = clone(mono);
  plan.attempts = plan.max_attempts + 1;
  check('attempts exceeding max_attempts', codesOf(plan).includes(CODES.ATTEMPTS_EXCEEDED));
}

{
  // Dialogue with no knowledge asymmetry: both roles carry the same
  // knowledge_position, so neither role's contribution does real work.
  const plan = clone(dialogue);
  plan.dialogue.speaker_roles = plan.dialogue.speaker_roles.map((r) => ({ ...r, knowledge_position: 'informed' }));
  check('dialogue with no knowledge asymmetry (identical knowledge_position)', codesOf(plan).includes(CODES.DIALOGUE_NO_ASYMMETRY));
}

{
  // A synthetic speaker presented as a real source — fails at the schema
  // level because persona_disclosure only accepts synthetic_non_source.
  const plan = clone(dialogue);
  plan.dialogue.speaker_roles[1].persona_disclosure = 'presented_as_real_expert';
  const issues = validateAudioPlan(plan, opts);
  check('synthetic speaker presented as a real source (invalid persona_disclosure)', issues.some((i) => i.code === CODES.SCHEMA));
}

{
  // Two alternating voices reading a monologue: a dialogue profile with a
  // single speaker role — dialogue requires at least two.
  const plan = clone(dialogue);
  plan.dialogue.speaker_roles = [plan.dialogue.speaker_roles[0]];
  check('dialogue collapses to a single role (two alternating voices reading a monologue)', codesOf(plan).includes(CODES.DIALOGUE_NO_ASYMMETRY));
}

{
  // Delivery markup leaking into the clean narration text.
  const plan = clone(mono);
  plan.spoken_script.narration_text += ' <break time="500ms"/> That pause matters.';
  check('SSML-like tag leaks into narration_text', codesOf(plan).includes(CODES.DELIVERY_MARKUP_LEAK));
}

{
  // Stage-direction-style bracket leaking into the clean narration text.
  const plan = clone(mono);
  plan.spoken_script.narration_text += ' [pause] Consider the consequence.';
  check('bracketed stage direction leaks into narration_text', codesOf(plan).includes(CODES.DELIVERY_MARKUP_LEAK));
}

{
  // Timed-narration segment with no beat_id.
  const plan = clone(timed);
  delete plan.segments[0].beat_id;
  check('timed-narration segment missing beat_id', codesOf(plan).includes(CODES.TIMED_MISSING_BEAT));
}

{
  // Timed-narration profile not actually in timed mode.
  const plan = clone(timed);
  plan.timing = { rendering_mode: 'free', target_duration_ms: null, tolerance_ms: null };
  check('audio/timed-narration plan not in timed rendering_mode', codesOf(plan).includes(CODES.TIMED_MODE_MISMATCH));
}

{
  // A dialogue segment naming a speaker that was never declared as a role.
  const plan = clone(dialogue);
  plan.segments[0].speaker = 'narrator-not-a-declared-role';
  check('segment speaker does not resolve to a declared dialogue role', codesOf(plan).includes(CODES.DIALOGUE_UNKNOWN_SPEAKER));
}

{
  // Missing article_ref/package_ref entirely.
  const plan = clone(mono);
  delete plan.article_ref;
  check('plan carries neither article_ref nor package_ref', codesOf(plan).includes(CODES.MISSING_REF));
}

console.log(failures === 0 ? '\naudio-plan: ALL PASS' : `\naudio-plan: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
