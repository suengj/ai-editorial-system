/**
 * Audio plan engine — AES-V2.8 (SUE-566).
 *
 * Validates a compiled audio plan against schemas/audio-plan.schema.json plus
 * the cross-field gates a schema cannot express: the script-L1-before-render
 * gate, attempts budget, dialogue knowledge-asymmetry/persona-boundary checks,
 * timed-narration beat linkage, and clean-narration-text contamination.
 * Deliberately mirrors scripts/lib/visual-job-core.mjs rather than inventing a
 * parallel shape for the sibling modality.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export const AUDIO_PLAN_SCHEMA = resolve(ROOT, 'schemas/audio-plan.schema.json');
export const ARTIFACT_PROFILE_DIR = resolve(ROOT, 'editorial/profiles/artifact');

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

export const loadSchema = (p = AUDIO_PLAN_SCHEMA) => readJSON(p);

/** Load every editorial/profiles/artifact/audio-*.json, keyed by its `artifact` id. */
export function loadArtifactProfiles(dir = ARTIFACT_PROFILE_DIR) {
  const out = {};
  for (const f of readdirSync(dir)) {
    if (!f.startsWith('audio-') || !f.endsWith('.json')) continue;
    const profile = readJSON(resolve(dir, f));
    out[profile.artifact] = profile;
  }
  return out;
}

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  UNKNOWN_PROFILE: 'unknown-artifact-profile',
  PROFILE_REF_MISMATCH: 'profile-ref-mismatch',
  MISSING_REF: 'missing-article-or-package-ref',
  ARTICLE_PROSE_UNCOMPILED: 'article-prose-sent-as-spoken-script',
  DELIVERY_MARKUP_LEAK: 'delivery-markup-leaks-into-narration-text',
  RENDER_BEFORE_SCRIPT_L1: 'render-attempted-before-script-l1-pass',
  ATTEMPTS_EXCEEDED: 'attempts-exceed-max',
  DIALOGUE_MISSING: 'dialogue-block-missing-for-dialogue-profile',
  DIALOGUE_NO_ASYMMETRY: 'dialogue-no-knowledge-asymmetry',
  DIALOGUE_PERSONA_LEAK: 'dialogue-persona-not-disclosed-synthetic',
  DIALOGUE_UNKNOWN_SPEAKER: 'segment-speaker-not-a-declared-role',
  TIMED_MISSING_BEAT: 'timed-narration-segment-missing-beat-id',
  TIMED_MODE_MISMATCH: 'timed-narration-profile-not-in-timed-mode',
  QA_BEFORE_RENDER: 'rendered-audio-qa-recorded-before-render',
});

const issue = (code, where, message) => ({ code, where, message });

const RENDERING_OR_LATER = new Set([
  'rendering', 'rendered', 'qa_pass', 'qa_fail', 'accepted',
]);

// Provider-markup / stage-direction / SSML-like leakage into clean narration
// text (AUDIO-SCRIPT.md §12, §13). Deliberately conservative: these patterns
// are things a renderer control uses, never ordinary spoken prose.
const MARKUP_PATTERNS = [
  /<[a-z][^>]*>/i, // SSML-like tags, e.g. <break time="500ms"/>
  /\[(pause|whispers?|laughs?|sighs?|emphasis|pace_(slow|fast))\]/i, // audio-tag style bracket directions
  /\bvoice\s*[:=]\s*["'\w-]+/i, // voice: id / voice="..."
  /\bssml\b/i,
];

// Structural signals of uncompiled article prose leaking straight into a
// spoken script (AUDIO-SCRIPT.md §1) — headings and inline citation markup
// are article conventions, never spoken conventions.
const ARTICLE_PROSE_PATTERNS = [
  /^#{1,6}\s/m, // markdown heading
  /\[\^[^\]]+\]/, // footnote-style citation marker
  /\[\d+\]/, // inline numeric citation marker
];

function findMarkupLeak(text) {
  for (const re of MARKUP_PATTERNS) {
    if (re.test(text)) return re.source;
  }
  return null;
}

function looksLikeUncompiledProse(text) {
  return ARTICLE_PROSE_PATTERNS.some((re) => re.test(text));
}

/** Validate a compiled audio plan. Returns an array of issues; empty means PASS. */
export function validateAudioPlan(plan, { schema = loadSchema(), profiles = loadArtifactProfiles() } = {}) {
  const issues = [];
  const where = plan?.plan_id ?? '<plan>';

  for (const e of validate(plan, schema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }
  if (issues.some((i) => i.code === CODES.SCHEMA)) return issues; // structurally unsound; cross-field checks would be noise

  if (!plan.article_ref && !plan.package_ref) {
    issues.push(issue(CODES.MISSING_REF, where, 'an audio plan must carry exactly one of article_ref or package_ref'));
  }

  const profile = profiles[plan.artifact_profile];
  if (!profile) {
    issues.push(issue(CODES.UNKNOWN_PROFILE, where, `"${plan.artifact_profile}" is not a known artifact profile`));
  } else {
    const expectedRef = `editorial/profiles/artifact/audio-${plan.artifact_profile.split('/')[1]}.json`;
    if (plan.profile_ref !== expectedRef) {
      issues.push(issue(CODES.PROFILE_REF_MISMATCH, where, `profile_ref "${plan.profile_ref}" does not match "${expectedRef}"`));
    }
  }

  // --- The single most important gate: article prose is never the spoken script (§1) ---
  if (plan.recompilation?.identical_to_source_prose === true || plan.recompilation?.performed === false) {
    issues.push(issue(CODES.ARTICLE_PROSE_UNCOMPILED, where,
      'recompilation.identical_to_source_prose is true (or recompilation.performed is false) — article prose sent straight to TTS is the default failure this contract exists to prevent (AUDIO-SCRIPT.md §1)'));
  }
  const narration = plan.spoken_script?.narration_text ?? '';
  if (looksLikeUncompiledProse(narration)) {
    issues.push(issue(CODES.ARTICLE_PROSE_UNCOMPILED, where,
      'narration_text contains article conventions (a heading or inline citation marker) that do not belong in listener-first spoken prose (AUDIO-SCRIPT.md §1, §2)'));
  }

  // --- Clean narration text vs delivery state vs provider markup (§2, §12, §13) ---
  const leak = findMarkupLeak(narration);
  if (leak) {
    issues.push(issue(CODES.DELIVERY_MARKUP_LEAK, where,
      `narration_text contains provider markup or a stage direction matching /${leak}/ — delivery/performance state must stay out of the clean narration text (AUDIO-SCRIPT.md §12, §13)`));
  }
  for (const field of ['register', 'affect']) {
    const v = plan.delivery_intent?.[field];
    if (typeof v === 'string' && findMarkupLeak(v)) {
      issues.push(issue(CODES.DELIVERY_MARKUP_LEAK, where, `delivery_intent.${field} contains provider markup — delivery_intent must stay a provider-neutral intent, not SSML`));
    }
  }

  // --- Cheap-before-expensive gate: script_l1 must pass before rendering (§9, §20) ---
  if (RENDERING_OR_LATER.has(plan.status)) {
    if (!(plan.script_l1?.performed === true && plan.script_l1?.outcome === 'pass')) {
      issues.push(issue(CODES.RENDER_BEFORE_SCRIPT_L1, where,
        `status "${plan.status}" is a rendering-or-later state but script_l1 has not passed (performed=${plan.script_l1?.performed}, outcome=${plan.script_l1?.outcome}) — a bad direction routes back to planning, not to an unbounded reroll (docs/architecture/V2-EDITORIAL-LEARNING-CORE.md §9)`));
    }
    if (!plan.render) {
      issues.push(issue(CODES.RENDER_BEFORE_SCRIPT_L1, where, `status "${plan.status}" implies a render occurred but render lineage is null`));
    }
  }
  if (plan.qa?.performed === true && !plan.render) {
    issues.push(issue(CODES.QA_BEFORE_RENDER, where, 'qa.performed is true but no render lineage is recorded — rendered-audio QA cannot certify a render that never happened'));
  }

  // --- Attempts budget ---
  if (plan.attempts > plan.max_attempts) {
    issues.push(issue(CODES.ATTEMPTS_EXCEEDED, where, `attempts (${plan.attempts}) exceeds max_attempts (${plan.max_attempts})`));
  }

  // --- Dialogue: knowledge asymmetry and persona boundary (§15) ---
  if (plan.artifact_profile === 'audio/dialogue') {
    const dlg = plan.dialogue;
    if (!dlg) {
      issues.push(issue(CODES.DIALOGUE_MISSING, where, 'artifact_profile is audio/dialogue but the "dialogue" block is missing'));
    } else {
      const roles = dlg.speaker_roles ?? [];
      const positions = new Set(roles.map((r) => r.knowledge_position));
      if (roles.length < 2 || positions.size < 2) {
        issues.push(issue(CODES.DIALOGUE_NO_ASYMMETRY, where,
          'dialogue.speaker_roles does not establish a genuine knowledge asymmetry — at least two roles with distinct knowledge_position are required; a cosmetic split where every role already knows everything is not a dialogue (AUDIO-SCRIPT.md §15)'));
      }
      const nonSynthetic = roles.filter((r) => r.persona_disclosure !== 'synthetic_non_source');
      if (nonSynthetic.length > 0) {
        issues.push(issue(CODES.DIALOGUE_PERSONA_LEAK, where,
          `speaker role(s) ${nonSynthetic.map((r) => r.role_id).join(', ')} are not declared persona_disclosure: synthetic_non_source — a synthetic speaker may never be presented as a real source (AUDIO-SCRIPT.md §15)`));
      }
      const roleIds = new Set(roles.map((r) => r.role_id));
      for (const seg of plan.segments ?? []) {
        if (seg.speaker && !roleIds.has(seg.speaker)) {
          issues.push(issue(CODES.DIALOGUE_UNKNOWN_SPEAKER, where, `segment "${seg.segment_id}" speaker "${seg.speaker}" does not resolve to a declared dialogue.speaker_roles[].role_id`));
        }
      }
    }
  }

  // --- Timed narration: rendering_mode and beat linkage (§16; VISUAL-STORY-COMPILATION.md §3) ---
  if (plan.artifact_profile === 'audio/timed-narration') {
    if (plan.timing?.rendering_mode !== 'timed' || plan.timing?.target_duration_ms == null) {
      issues.push(issue(CODES.TIMED_MODE_MISMATCH, where,
        'artifact_profile is audio/timed-narration but timing.rendering_mode is not "timed" with an explicit target_duration_ms — a real duration constraint must be known before writing (AUDIO-SCRIPT.md §16)'));
    }
    const missingBeat = (plan.segments ?? []).filter((s) => !s.beat_id);
    if (missingBeat.length > 0) {
      issues.push(issue(CODES.TIMED_MISSING_BEAT, where,
        `segment(s) ${missingBeat.map((s) => s.segment_id).join(', ')} carry no beat_id — timed-narration segments must link to the shared argument-beat graph (editorial/VISUAL-STORY-COMPILATION.md §3)`));
    }
  }

  return issues;
}

export function validateAudioPlanFile(path, options = {}) {
  let plan;
  try {
    plan = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable plan: ${err.message}`)];
  }
  return validateAudioPlan(plan, options);
}
