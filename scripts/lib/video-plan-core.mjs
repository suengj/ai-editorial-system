import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCHEMA_DIR = resolve(ROOT, 'schemas');

function readJSON(path) { return JSON.parse(readFileSync(path, 'utf8')); }

function rewriteLocalDefs(node, prefix) {
  if (Array.isArray(node)) return node.map((v) => rewriteLocalDefs(v, prefix));
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] = key === '$ref' && typeof value === 'string' && value.startsWith('#/$defs/')
      ? `#/$defs/${prefix}__${value.slice('#/$defs/'.length)}`
      : rewriteLocalDefs(value, prefix);
  }
  return out;
}

// json-schema-lite intentionally handles local refs only. Import referenced
// repo schemas into a validation bundle, namespacing their $defs while
// preserving $ref semantics. The source schema files remain the authorities.
function bundleSchema(schema) {
  const defs = { ...(schema.$defs ?? {}) };
  const imports = new Map();
  const visit = (node) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    if (typeof node.$ref === 'string' && !node.$ref.startsWith('#/')) {
      const [file, pointer = ''] = node.$ref.split('#');
      const name = file.split('/').at(-1).replace(/\.schema\.json$/, '').replace(/[^a-z0-9]+/gi, '_');
      if (!imports.has(name)) {
        const imported = readJSON(resolve(SCHEMA_DIR, file.replace(/^schemas\//, '')));
        imports.set(name, imported);
        for (const [defName, def] of Object.entries(imported.$defs ?? {})) {
          defs[`${name}__${defName}`] = rewriteLocalDefs(def, name);
        }
        const root = { ...imported };
        delete root.$defs;
        defs[`${name}__root`] = rewriteLocalDefs(root, name);
      }
      const target = pointer ? `${name}__${pointer.replace(/^\/\$defs\//, '').replaceAll('/', '__')}` : `${name}__root`;
      node.$ref = `#/$defs/${target}`;
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(schema);
  schema.$defs = defs;
  return schema;
}

export function loadVideoSchema(kind) {
  return bundleSchema(readJSON(resolve(SCHEMA_DIR, `${kind}.schema.json`)));
}

export const CODES = Object.freeze({
  SCHEMA: 'schema', FORMAT_DURATION: 'format-duration', SCENE_TIMING: 'scene-timing', AUDIO_RECONCILIATION: 'audio-duration-not-reconciled',
  DUPLICATE_SCENE: 'duplicate-scene-id', CLAIM_UNVERIFIED: 'unverified-source-claim', UNKNOWN_CLAIM: 'unknown-source-claim',
  FABRICATED_QUOTE: 'fabricated-quote', ROLE_DISCLOSURE: 'speaker-not-disclosed-synthetic',
  TTS_SUPPORT_UNEVIDENCED: 'tts-support-unevidenced',
  DELIVERY_MARKUP_LEAK: 'delivery-markup-leak',
  BGM_OFF_HAS_TRACKS: 'bgm-off-has-tracks',
  BGM_SELECTED_EMPTY: 'bgm-selected-empty',
  UNSUPPORTED_FIELD: 'unsupported-field', PROFILE_PIN: 'profile-pin-mismatch', LOCKED_FIELD: 'locked-field-change',
  SOURCE_MISSING: 'source-missing', RIGHTS_BLOCKED: 'rights-blocked', EDUCATIONAL_ORDER: 'educational-order',
  NARRATION_REF: 'narration-reference-missing', CAPTIONS_REQUIRED: 'captions-required', SCENE_MISMATCH: 'scene-mismatch',
  CONTEXT_MISSING: 'referenced-video-plan-context-required', PROTECTED_VALUE_UNVERIFIED: 'protected-value-not-source-verified', PROTECTED_TEXT_MISMATCH: 'protected-value-text-mismatch',
  AUDIO_SCRIPT_MISMATCH: 'audio-script-mismatch',
  LAYER_GEOMETRY: 'layer-geometry-invalid',
  CAPTION_MISMATCH: 'caption-mismatch', PRE_TTS_GATE: 'pre-tts-script-check-required', MEASUREMENT_GATE: 'audio-measurement-not-reconciled',
  PROVIDER_NOT_CONFIGURED: 'provider-not-configured', BGM_UNSAFE: 'bgm-unsafe-selection', BGM_DUCKING: 'bgm-ducking-required',
  QA_RESULT: 'qa-result-inconsistent', QA_EVIDENCE: 'qa-evidence-missing', QA_GATE: 'qa-gate-disabled',
});

const issue = (code, where, message) => ({ code, where, message });

const readManifest = () => readJSON(resolve(ROOT, 'editorial/entry-manifest.json'));
const profilePins = () => readManifest().video_profiles ?? {};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const LOCKED_CHANGE_FIELDS = new Set(['source_evidence', 'rights', 'figures', 'approval']);
const EDUCATIONAL_ORDER = ['hook', 'concept', 'example', 'worked_solution', 'key_takeaway'];
const laterAudioStatuses = new Set(['rendered', 'reconciliation_pending', 'complete']);
const issueFor = (code, doc, message) => issue(code, doc?.plan_id ?? doc?.script_id ?? doc?.catalog_id ?? doc?.qa_id ?? '<document>', message);
function protectedSpanReceiptIsBound(source, span) {
  const spanHash = sha256(Buffer.from(span.exact_text, 'utf8'));
  const evidenceRef = `source-extraction://sha256/${source.sha256}/${span.extraction_sha256}/span/${span.span_id}/${spanHash}`;
  return span.source_sha256 === source.sha256 && /^[a-f0-9]{64}$/.test(span.extraction_sha256)
    && span.span_sha256 === spanHash
    && span.byte_end > span.byte_start
    && span.byte_end - span.byte_start === Buffer.byteLength(span.exact_text, 'utf8')
    && span.evidence_ref === evidenceRef;
}

const protectedSpanKey = (source, span) => `${source.sha256}:${span.span_sha256}`;

export function resolveLocalSourceEvidence(plan) {
  const verifiedProtectedSpans = new Set();
  for (const source of plan.source_evidence?.sources ?? []) {
    if (!['text', 'markdown'].includes(source.kind) || typeof source.source_ref !== 'string' || source.source_ref.includes('://')) continue;
    try {
      const path = realpathSync(resolve(ROOT, source.source_ref));
      const relativePath = relative(ROOT, path);
      if (!relativePath || relativePath.startsWith('..')) continue;
      const bytes = readFileSync(path);
      const sourceHash = sha256(bytes);
      if (sourceHash !== source.sha256) continue;
      for (const span of source.protected_spans ?? []) {
        if (!protectedSpanReceiptIsBound(source, span) || span.extraction_sha256 !== sourceHash) continue;
        if (bytes.subarray(span.byte_start, span.byte_end).toString('utf8') !== span.exact_text) continue;
        verifiedProtectedSpans.add(protectedSpanKey(source, span));
      }
    } catch {
      // Unresolvable references remain unverified; callers decide whether that blocks the requested status.
    }
  }
  return verifiedProtectedSpans;
}

function isProtectedSpanResolved(source, span, context) {
  const verified = context.verifiedProtectedSpans;
  return verified instanceof Set ? verified.has(protectedSpanKey(source, span))
    : Array.isArray(verified) && verified.includes(protectedSpanKey(source, span));
}

function validateVideoPlanV2(doc, issues, context) {
  const pins = profilePins();
  const pin = pins[doc.profile_ref.profile_id];
  if (!pin || pin.revision !== doc.profile_ref.revision || pin.sha256 !== doc.profile_ref.sha256) {
    issues.push(issueFor(CODES.PROFILE_PIN, doc, `profile_ref does not match the manifest pin for ${doc.profile_ref.profile_id}`));
  } else {
    const profileBytes = readFileSync(resolve(ROOT, pin.path));
    if (sha256(profileBytes) !== pin.sha256) issues.push(issueFor(CODES.PROFILE_PIN, doc, `profile bytes do not match the manifest SHA-256 for ${doc.profile_ref.profile_id}`));
    const profile = JSON.parse(profileBytes.toString('utf8'));
    if (profile.family !== doc.profile_ref.profile_id.split('/')[1]) issues.push(issueFor(CODES.PROFILE_PIN, doc, 'profile family does not match the pinned profile id'));
    if (!profile.defaults.aspect_ratios.includes(doc.aspect_ratio)) issues.push(issueFor(CODES.PROFILE_PIN, doc, `aspect_ratio ${doc.aspect_ratio} is not enabled by the selected profile`));
  }

  const sourceRefs = new Set(doc.source_evidence.sources.flatMap((s) => [s.source_id, s.source_ref]));
  if (sourceRefs.size !== doc.source_evidence.sources.length * 2) issues.push(issueFor(CODES.SOURCE_MISSING, doc, 'source identifiers and source references must be unique'));
  for (const source of doc.source_evidence.sources) for (const span of source.protected_spans ?? []) {
    if (!protectedSpanReceiptIsBound(source, span) || !isProtectedSpanResolved(source, span, context)) {
      issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `protected source span ${span.span_id} has no locally verified source/extraction byte match or trusted resolver receipt`));
    }
  }
  const sceneIds = new Set();
  const orderIndices = [];
  let previousEnd = -1;
  for (const scene of doc.scenes) {
    if (sceneIds.has(scene.scene_id)) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `scene ${scene.scene_id} is repeated`));
    sceneIds.add(scene.scene_id);
    if (scene.timing.start_seconds >= scene.timing.end_seconds || scene.timing.end_seconds > doc.target_duration_seconds || scene.timing.start_seconds < previousEnd) {
      issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `scene ${scene.scene_id} has invalid, overlapping, or out-of-range timing`));
    }
    previousEnd = scene.timing.end_seconds;
    for (const ref of scene.source_refs) if (!sourceRefs.has(ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `scene ${scene.scene_id} references undeclared source ${ref}`));
    for (const text of scene.on_screen_text) if (!sourceRefs.has(text.source_ref) || !scene.source_refs.includes(text.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `on-screen text in ${scene.scene_id} references an undeclared or out-of-scene source ${text.source_ref}`));
    for (const layer of scene.layers) {
      if (!sourceRefs.has(layer.source_ref) || !sourceRefs.has(layer.rights_ref) || !scene.source_refs.includes(layer.source_ref) || layer.rights_ref !== layer.source_ref) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `layer ${layer.layer_id} does not resolve the same in-scene source and rights record`));
      if (layer.timing.start_seconds < scene.timing.start_seconds || layer.timing.end_seconds > scene.timing.end_seconds || layer.timing.start_seconds >= layer.timing.end_seconds) {
        issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `layer ${layer.layer_id} timing is outside scene ${scene.scene_id}`));
      }
      const rect = layer.safe_zone;
      if (rect.x + rect.width > 1 || rect.y + rect.height > 1) issues.push(issueFor(CODES.LAYER_GEOMETRY, doc, `layer ${layer.layer_id} safe_zone exceeds normalized canvas bounds`));
    }
    const idx = EDUCATIONAL_ORDER.indexOf(scene.function);
    if (idx >= 0) orderIndices.push(idx);
  }

  const profileFamily = doc.profile_ref.profile_id.split('/')[1];
  const orderIsDefault = orderIndices.every((value, i) => i === 0 || value >= orderIndices[i - 1]);
  if (profileFamily === 'educational-summary' && !orderIsDefault && !doc.ordering_exception) {
    issues.push(issueFor(CODES.EDUCATIONAL_ORDER, doc, 'educational beats must follow Hook → Concept → Example → Worked solution → Key takeaway unless a source-order exception is recorded'));
  }
  if (doc.ordering_exception) for (const ref of doc.ordering_exception.source_refs) if (!sourceRefs.has(ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `ordering exception references undeclared source ${ref}`));

  for (const figure of doc.figures ?? []) if (!sourceRefs.has(figure.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `figure value references undeclared source ${figure.source_ref}`));
  for (const request of doc.change_requests) if (LOCKED_CHANGE_FIELDS.has(request.field)) issues.push(issueFor(CODES.LOCKED_FIELD, doc, `${request.field} is locked and cannot be changed by a user request`));

  if (doc.audio.narration_mode === 'narrated') {
    if (!doc.audio.narration_script_ref || !doc.audio.audio_plan_ref || !doc.audio.tts_contract_ref) issues.push(issueFor(CODES.NARRATION_REF, doc, 'narrated plans require narration_script_ref, audio_plan_ref, and tts_contract_ref'));
    if (!doc.captions.enabled) issues.push(issueFor(CODES.CAPTIONS_REQUIRED, doc, 'captions must be enabled when narration is present'));
  }
  if (doc.audio.measured_audio_duration_seconds !== null && doc.audio.measured_audio_duration_seconds > doc.target_duration_seconds && doc.audio.reconciliation_action === 'pending') {
    issues.push(issueFor(CODES.MEASUREMENT_GATE, doc, 'measured narration exceeds target and requires script revision, local scene timing adjustment, or a blocked result'));
  }
  if (doc.audio.narration_mode === 'silent' && doc.audio.measured_audio_duration_seconds !== null) issues.push(issueFor(CODES.MEASUREMENT_GATE, doc, 'silent plans cannot record measured narration duration'));
  if (doc.audio.narration_mode === 'silent' && (doc.audio.narration_script_ref || doc.audio.audio_plan_ref || doc.audio.tts_contract_ref)) {
    issues.push(issueFor(CODES.NARRATION_REF, doc, 'silent plans cannot claim narration, audio-plan, or TTS contract references'));
  }
}

function sourceRefsFor(doc) {
  return new Set(doc.source_evidence?.sources?.flatMap((s) => [s.source_id, s.source_ref]) ?? []);
}

function sourceForReference(plan, ref) {
  return plan.source_evidence.sources.find((source) => source.source_id === ref || source.source_ref === ref);
}

function hasProtectedSourceSpan(plan, value, context) {
  const source = sourceForReference(plan, value.source_ref);
  return source?.protected_spans?.some((span) => span.kind === value.kind
    && span.exact_text === value.exact_text && protectedSpanReceiptIsBound(source, span)
    && isProtectedSpanResolved(source, span, context)) ?? false;
}

function validateNarrationV2(doc, issues, context) {
  const plan = context.videoPlan;
  if (!plan) issues.push(issueFor(CODES.CONTEXT_MISSING, doc, 'narration script validation requires its referenced video plan and source evidence envelope'));
  if (plan && (doc.video_plan_ref !== plan.plan_id || doc.source_evidence_ref !== plan.source_evidence.envelope_id)) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, 'narration script must reference the same video plan and source evidence envelope'));
  const scenes = new Map((plan?.scenes ?? []).map((s) => [s.scene_id, s]));
  const refs = plan ? sourceRefsFor(plan) : new Set();
  for (const turn of doc.turns) {
    if (plan) {
      const scene = scenes.get(turn.scene_id);
      if (!scene || scene.beat_id !== turn.beat_id) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `turn ${turn.turn_id} does not match a video-plan scene and beat`));
    }
    for (const ref of turn.source_refs) if (!refs.has(ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `turn ${turn.turn_id} references undeclared source ${ref}`));
    for (const text of turn.on_screen_text) if (!refs.has(text.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `turn ${turn.turn_id} on-screen text references undeclared source ${text.source_ref}`));
    if (/<[a-z][^>]*>/i.test(turn.spoken_text) || /\[(pause|whispers?|laughs?|sighs?|emphasis)\]/i.test(turn.spoken_text)) issues.push(issueFor(CODES.DELIVERY_MARKUP_LEAK, doc, `turn ${turn.turn_id} contains delivery markup in canonical spoken text`));
  }
  for (const value of doc.protected_values) {
    if (!refs.has(value.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `protected ${value.kind} ${value.exact_text} references undeclared source ${value.source_ref}`));
    else if (plan && !hasProtectedSourceSpan(plan, value, context)) issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `protected ${value.kind} ${value.exact_text} does not match locally verified source bytes or a trusted resolver receipt`));
    if (!doc.turns.some((turn) => turn.spoken_text.includes(value.exact_text))) issues.push(issueFor(CODES.PROTECTED_TEXT_MISMATCH, doc, `protected ${value.kind} ${value.exact_text} is absent from canonical spoken text`));
  }
  for (const entry of doc.pronunciation_glossary) if (!refs.has(entry.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `pronunciation entry ${entry.term} references undeclared source ${entry.source_ref}`));
  const check = doc.canonical_script_check;
  if (check.outcome !== 'not_yet' && (check.performed !== true || !knownRightsText(check.evidence_ref))) issues.push(issueFor(CODES.PRE_TTS_GATE, doc, 'a completed pre-TTS canonical script check requires performed=true and evidence_ref'));
}

function validateAudioPlanV2(doc, issues, context) {
  const plan = context.videoPlan;
  const script = context.narrationScript;
  if (!plan) issues.push(issueFor(CODES.CONTEXT_MISSING, doc, 'audio-plan validation requires its referenced video plan and source evidence envelope'));
  if (!script) issues.push(issueFor(CODES.CONTEXT_MISSING, doc, 'audio-plan validation requires its referenced canonical narration script'));
  if (plan) {
    if (doc.video_plan_ref !== plan.plan_id || doc.source_evidence_ref !== plan.source_evidence.envelope_id) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, 'audio plan must reference the same video plan and source evidence envelope'));
    if (plan.audio.narration_script_ref !== doc.script_ref || plan.audio.audio_plan_ref !== doc.plan_id) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, 'video plan narration references must resolve to this script and audio plan'));
    const refs = sourceRefsFor(plan);
    const scenes = new Map(plan.scenes.map((s) => [s.scene_id, s]));
    for (const segment of doc.segments) {
      const scene = scenes.get(segment.scene_id);
      if (!scene || scene.beat_id !== segment.beat_id) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `audio segment ${segment.segment_id} does not match a video-plan scene and beat`));
    }
    for (const caption of doc.captions.segments) if (!scenes.has(caption.scene_id)) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `caption segment references unknown scene ${caption.scene_id}`));
    for (const value of doc.protected_values) {
      if (!refs.has(value.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `protected ${value.kind} ${value.exact_text} references undeclared source ${value.source_ref}`));
      else if (!hasProtectedSourceSpan(plan, value, context)) issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `protected ${value.kind} ${value.exact_text} does not match locally verified source bytes or a trusted resolver receipt`));
      if (!doc.segments.some((segment) => segment.spoken_text.includes(value.exact_text))) issues.push(issueFor(CODES.PROTECTED_TEXT_MISMATCH, doc, `protected ${value.kind} ${value.exact_text} is absent from canonical spoken segments`));
      if (!doc.captions.segments.some((caption) => caption.exact_text.includes(value.exact_text) && caption.protected_exact_words.includes(value.exact_text))) issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `protected ${value.kind} ${value.exact_text} is absent or unprotected in captions`));
    }
    for (const entry of doc.pronunciation_glossary) if (!refs.has(entry.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `pronunciation entry ${entry.term} references undeclared source ${entry.source_ref}`));
    const target = plan.target_duration_seconds;
    const measured = doc.measurement.measured_audio_duration_seconds;
    if (measured !== null && measured > target && doc.reconciliation.action === 'pending') issues.push(issueFor(CODES.MEASUREMENT_GATE, doc, 'measured audio exceeds target and requires script revision, local scene timing adjustment, or a blocked result'));
  }
  if (script) {
    if (doc.script_ref !== script.script_id || script.video_plan_ref !== doc.video_plan_ref || script.source_evidence_ref !== doc.source_evidence_ref) {
      issues.push(issueFor(CODES.SCENE_MISMATCH, doc, 'audio plan must reference the canonical script for the same video plan and source evidence envelope'));
    }
    if (doc.goal !== script.goal || doc.audience !== script.audience
      || doc.canonical_script_check.performed !== script.canonical_script_check.performed
      || doc.canonical_script_check.outcome !== script.canonical_script_check.outcome
      || doc.canonical_script_check.evidence_ref !== script.canonical_script_check.evidence_ref) {
      issues.push(issueFor(CODES.AUDIO_SCRIPT_MISMATCH, doc, 'audio plan goal, audience, and pre-TTS check must match the canonical narration script'));
    }
    for (const segment of doc.segments) {
      const turn = script.turns.find((candidate) => candidate.scene_id === segment.scene_id && candidate.beat_id === segment.beat_id);
      if (!turn || segment.spoken_text !== turn.spoken_text) issues.push(issueFor(CODES.AUDIO_SCRIPT_MISMATCH, doc, `audio segment ${segment.segment_id} differs from its canonical narration turn`));
      if (segment.narration_span_hash !== sha256(Buffer.from(segment.spoken_text, 'utf8'))) issues.push(issueFor(CODES.AUDIO_SCRIPT_MISMATCH, doc, `audio segment ${segment.segment_id} narration_span_hash does not match its exact spoken text`));
    }
    for (const turn of script.turns) if (!doc.segments.some((segment) => segment.scene_id === turn.scene_id && segment.beat_id === turn.beat_id && segment.spoken_text === turn.spoken_text)) {
      issues.push(issueFor(CODES.AUDIO_SCRIPT_MISMATCH, doc, `canonical narration turn ${turn.turn_id} is missing from the audio plan`));
    }
    const scriptProtected = script.protected_values.map((value) => `${value.kind}\u0000${value.exact_text}\u0000${value.source_ref}`).sort();
    const audioProtected = doc.protected_values.map((value) => `${value.kind}\u0000${value.exact_text}\u0000${value.source_ref}`).sort();
    if (scriptProtected.join('\u0001') !== audioProtected.join('\u0001')) issues.push(issueFor(CODES.AUDIO_SCRIPT_MISMATCH, doc, 'audio-plan protected values must exactly match the canonical narration script'));
  }
  const rendered = laterAudioStatuses.has(doc.status);
  const preTtsRequired = ['script_checked', 'rendered', 'reconciliation_pending', 'complete'].includes(doc.status);
  const check = doc.canonical_script_check;
  if ((check.outcome !== 'not_yet' && (check.performed !== true || !knownRightsText(check.evidence_ref)))
    || (preTtsRequired && (check.performed !== true || check.outcome !== 'pass' || !knownRightsText(check.evidence_ref)))) {
    issues.push(issueFor(CODES.PRE_TTS_GATE, doc, 'script_checked or later audio requires performed=true, a passing pre-TTS canonical script check, and evidence_ref'));
  }
  if (rendered && doc.measurement.provider_status !== 'configured') issues.push(issueFor(CODES.PROVIDER_NOT_CONFIGURED, doc, 'audio cannot be marked rendered when the provider is not configured or is unknown'));
  if (doc.measurement.measured_audio_duration_seconds !== null && (!knownRightsText(doc.measurement.measured_at) || !knownRightsText(doc.measurement.evidence_ref))) {
    issues.push(issueFor(CODES.MEASUREMENT_GATE, doc, 'measured audio duration requires a measurement timestamp and evidence reference'));
  }
  if (['adjust_scene_timing', 'revise_script'].includes(doc.reconciliation.action)) {
    if (doc.measurement.measured_audio_duration_seconds === null || !knownRightsText(doc.reconciliation.evidence_ref)) issues.push(issueFor(CODES.MEASUREMENT_GATE, doc, 'post-measurement reconciliation requires a measured duration and evidence reference'));
    if (!doc.reconciliation.affected_scene_ids.length) issues.push(issueFor(CODES.MEASUREMENT_GATE, doc, 'local timing or script revision must name the affected scene IDs'));
    if (plan) {
      const validScenes = new Set(plan.scenes.map((scene) => scene.scene_id));
      for (const id of doc.reconciliation.affected_scene_ids) if (!validScenes.has(id)) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `reconciliation references unknown scene ${id}`));
    }
  }
  if (doc.reconciliation.action === 'blocked' && !knownRightsText(doc.reconciliation.evidence_ref)) issues.push(issueFor(CODES.MEASUREMENT_GATE, doc, 'blocked reconciliation requires evidence_ref'));
  if (doc.status === 'complete' && (doc.measurement.measured_audio_duration_seconds === null || !knownRightsText(doc.measurement.evidence_ref) || ['pending', 'blocked'].includes(doc.reconciliation.action) || doc.captions.alignment_status !== 'pass')) {
    issues.push(issueFor(CODES.MEASUREMENT_GATE, doc, 'complete audio requires a measured duration, resolved reconciliation, and passing caption alignment'));
  }
  if (rendered) {
    const segmentScenes = doc.segments.map((segment) => segment.scene_id);
    const captionScenes = doc.captions.segments.map((caption) => caption.scene_id);
    const duplicate = (ids) => new Set(ids).size !== ids.length;
    if (duplicate(segmentScenes) || duplicate(captionScenes) || segmentScenes.length !== captionScenes.length || segmentScenes.some((id) => !captionScenes.includes(id))) {
      issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, 'rendered audio requires exactly one caption segment for every spoken scene and no extra caption scenes'));
    }
  }
  for (const caption of doc.captions.segments) {
    const segment = doc.segments.find((s) => s.scene_id === caption.scene_id);
    if (segment && caption.exact_text !== segment.spoken_text) issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `caption text for ${caption.scene_id} does not match canonical spoken text`));
    if (caption.start_seconds >= caption.end_seconds) issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `caption timing for ${caption.scene_id} is invalid`));
    if (caption.lines.join(' ') !== caption.exact_text) issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `caption lines for ${caption.scene_id} do not reconstruct exact_text`));
    for (const word of caption.protected_exact_words) if (!caption.exact_text.includes(word)) issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `protected caption word ${word} is missing from exact_text`));
  }
}

const knownRightsText = (value) => typeof value === 'string' && value.trim().length > 0 && !/^(unknown|not known|n\/a|null|none)$/i.test(value.trim());
const safeContentIdStatuses = new Set(['clear', 'cleared', 'no_claim', 'not_registered']);
const trackRightsSafe = (track, platform) => track.rights_status === 'verified'
  && [track.master_rights_owner, track.composition_rights_owner, track.license, track.rights_evidence_ref, track.file].every(knownRightsText)
  && ![track.master_rights_owner, track.composition_rights_owner, track.license, track.file].some((value) => typeof value === 'string' && /(javascript:|<[^>]*>|[\r\n])/i.test(value))
  && track.monetization_allowed === true && track.platforms.includes(platform)
  && safeContentIdStatuses.has(track.content_id_status)
  && track.self_claim === false;

function validateBgmV2(doc, issues, context) {
  const where = doc.catalog_id;
  if (!context.videoPlan) issues.push(issue(CODES.CONTEXT_MISSING, where, 'BGM catalog validation requires its referenced video plan'));
  else if (doc.video_plan_ref !== context.videoPlan.plan_id) issues.push(issue(CODES.SCENE_MISMATCH, where, 'BGM catalog must reference the supplied video plan'));
  if (doc.mode === 'off') {
    if (doc.tracks.length || doc.selected_track_id !== null || doc.auto_match !== null) issues.push(issue(CODES.BGM_OFF_HAS_TRACKS, where, 'BGM off requires no selected track, match request, or track list'));
    return;
  }
  if (doc.mode !== 'selected_track' && doc.selected_track_id !== null) issues.push(issue(CODES.BGM_UNSAFE, where, 'selected_track_id is only valid in selected_track mode'));
  if (doc.mode !== 'auto_match' && doc.auto_match !== null) issues.push(issue(CODES.BGM_UNSAFE, where, 'auto_match criteria are only valid in auto_match mode'));
  if (doc.mode === 'auto_match' && doc.selected_track_id !== null) issues.push(issue(CODES.BGM_UNSAFE, where, 'auto_match cannot also pin a selected_track_id'));
  if (!doc.tracks.length) issues.push(issue(CODES.BGM_SELECTED_EMPTY, where, 'an active BGM mode requires at least one candidate track'));
  let selected = [];
  if (doc.mode === 'selected_track') {
    selected = doc.tracks.filter((t) => t.track_id === doc.selected_track_id);
    if (!doc.selected_track_id || selected.length !== 1) issues.push(issue(CODES.BGM_SELECTED_EMPTY, where, 'selected_track mode requires one matching selected_track_id'));
  } else if (doc.mode === 'auto_match') {
    if (!doc.auto_match) issues.push(issue(CODES.BGM_UNSAFE, where, 'auto_match requires explicit mood, tempo, energy, and platform criteria'));
    selected = doc.tracks.filter((t) => doc.auto_match && trackRightsSafe(t, doc.auto_match.platform));
    if (!selected.length) issues.push(issue(CODES.BGM_UNSAFE, where, 'auto_match found no track with verified master/composition rights, license, platform, monetization, Content ID, self-claim, and file hash'));
  } else {
    selected = doc.tracks;
  }
  const platform = doc.auto_match?.platform ?? context.platform ?? 'youtube';
  if (selected.some((t) => !trackRightsSafe(t, platform))) issues.push(issue(CODES.BGM_UNSAFE, where, 'active BGM selection contains unknown, missing, denied, or unverified rights metadata'));
  if (doc.mode !== 'off' && context.videoPlan?.audio?.narration_mode === 'narrated' && !doc.narration_ducking.enabled) issues.push(issue(CODES.BGM_DUCKING, where, 'narration ducking must be enabled when BGM accompanies narration'));
}

function validateVideoQa(doc, issues, context) {
  if (!context.videoPlan) issues.push(issueFor(CODES.CONTEXT_MISSING, doc, 'video QA validation requires its referenced video plan and source evidence envelope'));
  else if (doc.plan_ref !== context.videoPlan.plan_id) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, 'video QA must reference the supplied video plan'));
  const statuses = [
    ...Object.values(doc.checks).map((x) => x.status),
    ...Object.values(doc.gates).map((x) => x.status),
  ];
  if (Object.values(doc.gates).some((x) => x.required !== true)) issues.push(issueFor(CODES.QA_GATE, doc, 'cost, rights, and approval gates are required and cannot be disabled'));
  for (const [name, check] of Object.entries(doc.checks)) if (check.status === 'pass' && !check.evidence_refs.length) issues.push(issueFor(CODES.QA_EVIDENCE, doc, `${name} passed without an evidence reference`));
  for (const [name, gate] of Object.entries(doc.gates)) if (gate.status === 'pass' && !gate.evidence_refs.length) issues.push(issueFor(CODES.QA_EVIDENCE, doc, `${name} gate passed without an evidence reference`));
  const metrics = new Set(doc.measurable_evidence.map((entry) => entry.metric));
  if (doc.checks.technical_resolution_fps_duration.status === 'pass') {
    for (const metric of ['video.resolution', 'video.fps', 'video.duration_seconds']) if (!metrics.has(metric)) issues.push(issueFor(CODES.QA_EVIDENCE, doc, `technical QA passed without measurable ${metric} evidence`));
  }
  if (doc.checks.caption_completeness_alignment.status === 'pass' && !metrics.has('captions.alignment')) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'caption QA passed without measurable alignment evidence'));
  const failed = statuses.includes('fail');
  const pending = statuses.includes('not_yet');
  const expected = failed ? 'FAILED' : pending ? 'PARTIAL' : 'PASS';
  if (doc.result !== expected) issues.push(issueFor(CODES.QA_RESULT, doc, `result ${doc.result} conflicts with check and gate states; expected ${expected}`));
  if (doc.result === 'PASS' && !doc.measurable_evidence.length) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'PASS requires measurable evidence'));
  if (doc.result === 'PASS' && doc.checks.source_evidence_resolution.status !== 'pass') issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'PASS requires source-evidence extraction receipts to be independently resolved'));
  if (doc.result === 'PASS' && context.videoPlan) for (const source of context.videoPlan.source_evidence.sources) for (const span of source.protected_spans ?? []) {
    if (!isProtectedSpanResolved(source, span, context)) issues.push(issueFor(CODES.QA_EVIDENCE, doc, `PASS cannot treat protected source span ${span.span_id} as verified without resolved source bytes`));
  }
  if (doc.repair.scope === 'affected_scenes_only' && !doc.repair.affected_scene_ids.length) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'scene-local rerender must name affected scenes'));
  if (doc.repair.scope === 'none' && doc.repair.affected_scene_ids.length) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'repair scope none cannot list affected scenes'));
  if (context.videoPlan) {
    const validScenes = new Set(context.videoPlan.scenes.map((s) => s.scene_id));
    for (const id of doc.repair.affected_scene_ids) if (!validScenes.has(id)) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `repair references unknown scene ${id}`));
    const rightStatus = context.videoPlan.source_evidence.sources.every((s) => s.rights.status === 'verified'
      && knownRightsText(s.rights.license) && knownRightsText(s.rights.rights_owner) && knownRightsText(s.rights.evidence_ref)
      && s.rights.platforms.length > 0 && s.rights.commercial_use === true && s.rights.modification_allowed === true);
    if (doc.result === 'PASS' && !rightStatus) issues.push(issueFor(CODES.RIGHTS_BLOCKED, doc, 'video QA cannot PASS while source rights are unknown, missing, denied, or unverified'));
    if (doc.result === 'PASS' && !['approved', 'not_required'].includes(context.videoPlan.approval.status)) issues.push(issueFor(CODES.QA_GATE, doc, 'video QA cannot PASS without an approved or explicitly not-required approval state'));
    if (doc.gates.approval.status === 'pass' && !['approved', 'not_required'].includes(context.videoPlan.approval.status)) issues.push(issueFor(CODES.QA_GATE, doc, 'approval gate cannot pass while plan approval is pending or rejected'));
    if (context.videoPlan.audio.bgm_mode === 'off' && doc.checks.bgm_loudness_ducking_clipping.status === 'pass' && !metrics.has('bgm.mode')) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'BGM-off QA requires measurable evidence that BGM mode is off'));
    if (context.videoPlan.audio.bgm_mode !== 'off' && doc.checks.bgm_loudness_ducking_clipping.status === 'pass') {
      for (const metric of ['bgm.loudness_lufs', 'bgm.ducking_db', 'bgm.clipped_samples']) if (!metrics.has(metric)) issues.push(issueFor(CODES.QA_EVIDENCE, doc, `BGM QA passed without measurable ${metric} evidence`));
    }
  }
}

export function validateVideoDocument(kind, doc, context = {}) {
  const issues = validate(doc, loadVideoSchema(kind));
  if (issues.length) return issues.map((e) => issue(kind.endsWith('-v2') && /unexpected property/.test(e.message) ? CODES.UNSUPPORTED_FIELD : CODES.SCHEMA, doc?.plan_id ?? doc?.script_id ?? doc?.catalog_id ?? doc?.qa_id ?? '<document>', `${e.path}: ${e.message}`));
  const where = doc.plan_id ?? doc.script_id ?? doc.catalog_id ?? '<document>';
  if (kind === 'video-plan') {
    if (doc.format === 'short' && ![6, 15, 30].includes(doc.target_duration_seconds)) issues.push(issue(CODES.FORMAT_DURATION, where, 'short target_duration_seconds must be 6, 15, or 30'));
    if (doc.format === 'long' && doc.target_duration_seconds <= 30) issues.push(issue(CODES.FORMAT_DURATION, where, 'long format requires an explicit duration greater than 30 seconds'));
    const measured = doc.audio_reconciliation.measured_audio_duration_seconds;
    if (measured !== null && measured > doc.target_duration_seconds) issues.push(issue(CODES.AUDIO_RECONCILIATION, where, 'measured narration is longer than the target; extend and retime the video plan or revise the script before proceeding, never compress narration'));
    const ids = new Set();
    let previousStart = -1;
    for (const scene of doc.scenes) {
      if (ids.has(scene.id)) issues.push(issue(CODES.DUPLICATE_SCENE, where, `${scene.id} is repeated`));
      ids.add(scene.id);
      if (scene.timing.start_seconds >= scene.timing.end_seconds || scene.timing.end_seconds > doc.target_duration_seconds || scene.timing.start_seconds < previousStart) issues.push(issue(CODES.SCENE_TIMING, where, `${scene.id} has invalid, overlapping-order, or out-of-range timing`));
      previousStart = scene.timing.start_seconds;
    }
  }
  if (kind === 'narration-script') {
    const claimIds = new Set(doc.source_claims.map((claim) => claim.claim_id));
    for (const claim of doc.source_claims) {
      if (!claim.verified) issues.push(issue(CODES.CLAIM_UNVERIFIED, where, `claim ${claim.claim_id} is not verified`));
      if (claim.quote && !claim.verified) issues.push(issue(CODES.FABRICATED_QUOTE, where, `quote claim ${claim.claim_id} must be source-linked and verified`));
    }
    for (const turn of doc.turns) for (const claimId of turn.claim_ids) if (!claimIds.has(claimId)) issues.push(issue(CODES.UNKNOWN_CLAIM, where, `turn references undeclared claim ${claimId}`));
    if (doc.mode === 'dialogue' && doc.turns.some((turn) => !turn.role || turn.role.persona_disclosure !== 'synthetic_non_source')) issues.push(issue(CODES.ROLE_DISCLOSURE, where, 'every dialogue turn requires a disclosed synthetic_non_source role'));
  }
  if (kind === 'tts-contract' && doc.support.status !== 'unknown' && (!doc.support.checked_at || !doc.support.evidence_ref)) issues.push(issue(CODES.TTS_SUPPORT_UNEVIDENCED, where, 'verified provider support requires a check date and evidence reference'));
  if (kind === 'bgm-catalog') {
    if (doc.status === 'off' && doc.tracks.length) issues.push(issue(CODES.BGM_OFF_HAS_TRACKS, where, 'BGM OFF requires an empty track list'));
    if (doc.status === 'selected' && !doc.tracks.length) issues.push(issue(CODES.BGM_SELECTED_EMPTY, where, 'selected BGM requires at least one track'));
  }
  if (kind === 'video-plan-v2') validateVideoPlanV2(doc, issues, context);
  if (kind === 'narration-script-v2') validateNarrationV2(doc, issues, context);
  if (kind === 'audio-plan-v2') validateAudioPlanV2(doc, issues, context);
  if (kind === 'bgm-catalog-v2') validateBgmV2(doc, issues, context);
  if (kind === 'video-qa') validateVideoQa(doc, issues, context);
  return issues;
}
