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
  VIDEO_QUALITY_GATE: 'video-quality-gate-failed',
  CONTEXT_MISSING: 'referenced-video-plan-context-required', PROTECTED_VALUE_UNVERIFIED: 'protected-value-not-source-verified', PROTECTED_TEXT_MISMATCH: 'protected-value-text-mismatch',
  DUPLICATE_SOURCE_ID: 'duplicate-source-id', DUPLICATE_SPAN_ID: 'duplicate-span-id',
  AUDIO_SCRIPT_MISMATCH: 'audio-script-mismatch',
  LAYER_GEOMETRY: 'layer-geometry-invalid',
  CAPTION_MISMATCH: 'caption-mismatch', ENGINE_QA_EVIDENCE: 'engine-qa-evidence-invalid', PRE_TTS_GATE: 'pre-tts-script-check-required', MEASUREMENT_GATE: 'audio-measurement-not-reconciled',
  PROVIDER_NOT_CONFIGURED: 'provider-not-configured', BGM_UNSAFE: 'bgm-unsafe-selection', BGM_DUCKING: 'bgm-ducking-required',
  QA_RESULT: 'qa-result-inconsistent', QA_EVIDENCE: 'qa-evidence-missing', QA_GATE: 'qa-gate-disabled',
});

const issue = (code, where, message) => ({ code, where, message });

const readManifest = () => readJSON(resolve(ROOT, 'editorial/entry-manifest.json'));
const profilePins = () => readManifest().video_profiles ?? {};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const alignmentPayloadRef = (evidence) => `alignment-evidence://sha256/${sha256(Buffer.from(canonicalJson({
  audio_ref: evidence.audio_ref,
  audio_sha256: evidence.audio_sha256,
  segments: evidence.segments,
}), 'utf8'))}`;
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

function evidenceSpanReceiptIsBound(source, span) {
  const spanHash = sha256(Buffer.from(span.exact_text, 'utf8'));
  const evidenceRef = `source-extraction://sha256/${source.sha256}/${span.extraction_sha256}/span/${span.span_id}/${spanHash}`;
  return span.source_sha256 === source.sha256 && /^[a-f0-9]{64}$/.test(span.extraction_sha256)
    && span.span_sha256 === spanHash && span.byte_end > span.byte_start
    && span.byte_end - span.byte_start === Buffer.byteLength(span.exact_text, 'utf8')
    && span.evidence_ref === evidenceRef;
}

// Resolver results are bound to the complete source extraction receipt. An ID
// alone is not authority: duplicate IDs or a changed byte range must not reuse
// a receipt obtained for a different span.
const spanReceiptKey = (source, span) => JSON.stringify([
  source.source_id,
  source.source_ref,
  source.sha256,
  span.span_id,
  span.source_sha256,
  span.extraction_sha256,
  span.span_sha256,
  span.byte_start,
  span.byte_end,
  span.exact_text,
]);

export function resolveLocalSourceEvidence(plan) {
  const verifiedProtectedSpans = new Set();
  const verifiedEvidenceSpans = new Set();
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
        verifiedProtectedSpans.add(spanReceiptKey(source, span));
      }
      for (const span of source.evidence_spans ?? []) {
        if (!evidenceSpanReceiptIsBound(source, span) || span.extraction_sha256 !== sourceHash) continue;
        if (bytes.subarray(span.byte_start, span.byte_end).toString('utf8') !== span.exact_text) continue;
        verifiedEvidenceSpans.add(spanReceiptKey(source, span));
      }
    } catch {
      // Unresolvable references remain unverified; callers decide whether that blocks the requested status.
    }
  }
  verifiedProtectedSpans.verifiedEvidenceSpans = verifiedEvidenceSpans;
  return verifiedProtectedSpans;
}

function isProtectedSpanResolved(source, span, context) {
  const verified = context.verifiedProtectedSpans;
  return verified instanceof Set ? verified.has(spanReceiptKey(source, span))
    : Array.isArray(verified) && verified.includes(spanReceiptKey(source, span));
}

function sourceBoundSpan(plan, sourceRef, exactText, context, kinds = null) {
  const source = sourceForReference(plan, sourceRef);
  return source?.protected_spans?.some((span) => span.exact_text === exactText
    && (!kinds || kinds.includes(span.kind))
    && protectedSpanReceiptIsBound(source, span)
    && isProtectedSpanResolved(source, span, context)) ?? false;
}

function recursivelyContainsLockedField(value) {
  if (Array.isArray(value)) return value.some(recursivelyContainsLockedField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nested]) => LOCKED_CHANGE_FIELDS.has(key) || recursivelyContainsLockedField(nested));
}

function validChangeRequestShape(request) {
  const value = request.requested_value;
  switch (request.field) {
    case 'source_evidence': case 'rights': case 'figures': case 'approval': return false;
    case 'target_duration_seconds': return typeof value === 'number' && Number.isFinite(value) && value > 0;
    case 'aspect_ratio': return ['16:9', '9:16', '1:1', '4:5'].includes(value);
    case 'semantic_controls': return value && typeof value === 'object' && !Array.isArray(value)
      && Object.entries(value).every(([key, entry]) => ({
        thinking: ['off', 'quiet', 'countdown', 'progress_ring', 'progress_bar', 'auto'],
        reveal: ['instant', 'step_by_step', 'delayed', 'auto'],
        presentation: ['sequential', 'simultaneous', 'hybrid', 'auto'],
      })[key]?.includes(entry));
    case 'captions': return value && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).every((key) => ['enabled', 'max_lines', 'safe_zone', 'protected_exact_text', 'alignment_status'].includes(key))
      && (!('enabled' in value) || typeof value.enabled === 'boolean')
      && (!('max_lines' in value) || [1, 2].includes(value.max_lines))
      && (!('safe_zone' in value) || ['caption-safe', 'all-safe'].includes(value.safe_zone))
      && (!('protected_exact_text' in value) || (Array.isArray(value.protected_exact_text) && value.protected_exact_text.every((x) => typeof x === 'string')))
      && (!('alignment_status' in value) || ['not_yet', 'pass', 'fail'].includes(value.alignment_status));
    case 'narration': return typeof value === 'string' || (value !== null && typeof value === 'object' && !Array.isArray(value)
      && Object.keys(value).every((key) => ['goal', 'audience', 'voice', 'tone', 'pace', 'pause_after_ms', 'emphasis'].includes(key))
      && Object.entries(value).every(([key, entry]) => {
        if (['goal', 'voice', 'tone', 'pace'].includes(key)) return typeof entry === 'string' && entry.trim().length > 0;
        if (key === 'audience') return ['general-reader', 'professional-generalist', 'domain-practitioner', 'domain-expert', 'beginner-learner', 'child-upper-elementary'].includes(entry);
        if (key === 'pause_after_ms') return Array.isArray(entry) && entry.every((x) => Number.isInteger(x) && x >= 0);
        if (key === 'emphasis') return Array.isArray(entry) && entry.every((x) => typeof x === 'string' && x.length > 0);
        return false;
      }));
    default: return false;
  }
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
    const gates = profile.quality_gates;
    const req = doc.render_requirements;
    const fail = (message) => issues.push(issueFor(CODES.VIDEO_QUALITY_GATE, doc, message));
    if (gates && req) {
      if (req.hook_duration_seconds > gates.hook_max_seconds) fail(`hook duration exceeds ${gates.hook_max_seconds}s`);
      const range = gates.scene_length_seconds;
      for (const scene of doc.scenes) {
        const duration = scene.timing.end_seconds - scene.timing.start_seconds;
        if (duration < range.min) fail(`scene ${scene.scene_id} is shorter than ${range.min}s`);
        if (duration > range.max) fail(`scene ${scene.scene_id} exceeds ${range.max}s`);
      }
      for (const caption of req.caption_samples) {
        if (!doc.scenes.some((scene) => scene.scene_id === caption.scene_id)) fail(`caption sample references unknown scene ${caption.scene_id}`);
        if (caption.lines.length > gates.caption_max_lines || caption.lines.some((line) => [...line].length > gates.caption_max_chars_per_line)) fail(`caption sample in ${caption.scene_id} exceeds line or character limits`);
        if (caption.lines.join(' ') !== caption.exact_text) fail(`caption sample in ${caption.scene_id} breaks a word boundary or changes exact text`);
      }
      if (req.min_contrast_ratio < gates.min_contrast_ratio) fail(`declared minimum contrast is below ${gates.min_contrast_ratio}:1`);
      const margin = gates.safe_margins[doc.aspect_ratio];
      if (margin) for (const side of ['top','bottom','left','right']) {
        const required = margin[side] ?? margin.all;
        if (required !== undefined && req.safe_margins[side] < required) fail(`${side} safe margin is below ${required}`);
      }
      const audio = gates.audio_loudness_lufs;
      if (Math.abs(req.integrated_loudness_lufs - audio.integrated_target) > audio.tolerance) fail('integrated loudness is outside the profile target tolerance');
      if (Math.abs(req.bgm_loudness_lufs - audio.bgm_target) > audio.tolerance) fail('BGM loudness is outside the profile target tolerance');
      if (Math.abs(req.ducking_db - audio.ducking_db) > 1) fail('narration ducking is outside the profile target tolerance');
      if (req.true_peak_dbtp > audio.true_peak_max_dbtp) fail(`true peak exceeds ${audio.true_peak_max_dbtp} dBTP`);
      for (const event of req.sfx_events) if (!event.semantic_only || event.semantic_role === 'none') fail(`SFX in ${event.scene_id} must serve a declared semantic role`);
    }
    const genreRef = doc.genre_preset_ref;
    if (genreRef) {
      const genrePin = readManifest().video_genre_presets?.[genreRef.profile_id];
      if (!genrePin || genrePin.revision !== genreRef.revision || genrePin.sha256 !== genreRef.sha256 || genrePin.base_profile_id !== doc.profile_ref.profile_id) {
        issues.push(issueFor(CODES.PROFILE_PIN, doc, `genre_preset_ref does not match a manifest pin based on ${doc.profile_ref.profile_id}`));
      } else {
        const genreBytes = readFileSync(resolve(ROOT, genrePin.path));
        if (sha256(genreBytes) !== genrePin.sha256) issues.push(issueFor(CODES.PROFILE_PIN, doc, `genre preset bytes do not match the manifest SHA-256 for ${genreRef.profile_id}`));
      }
    }
  }

  const sourceRefs = new Set(doc.source_evidence.sources.flatMap((s) => [s.source_id, s.source_ref]));
  if (sourceRefs.size !== doc.source_evidence.sources.length * 2) issues.push(issueFor(CODES.DUPLICATE_SOURCE_ID, doc, 'source identifiers and source references must be unique'));
  const spanIds = new Set();
  for (const source of doc.source_evidence.sources) for (const span of [...(source.protected_spans ?? []), ...(source.evidence_spans ?? [])]) {
    if (spanIds.has(span.span_id)) issues.push(issueFor(CODES.DUPLICATE_SPAN_ID, doc, `source span id ${span.span_id} is repeated`));
    spanIds.add(span.span_id);
  }
  for (const source of doc.source_evidence.sources) for (const span of source.protected_spans ?? []) {
    if (!protectedSpanReceiptIsBound(source, span) || !isProtectedSpanResolved(source, span, context)) {
      issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `protected source span ${span.span_id} has no locally verified source/extraction byte match or trusted resolver receipt`));
    }
  }
  for (const source of doc.source_evidence.sources) for (const span of source.evidence_spans ?? []) {
    const verified = context.verifiedEvidenceSpans ?? context.verifiedProtectedSpans?.verifiedEvidenceSpans;
    if (!evidenceSpanReceiptIsBound(source, span) || !(verified instanceof Set && verified.has(spanReceiptKey(source, span)))) {
      issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `source evidence span ${span.span_id} has no locally verified source/extraction byte match or trusted resolver receipt`));
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
    for (const text of scene.on_screen_text) {
      if (!sourceRefs.has(text.source_ref) || !scene.source_refs.includes(text.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `on-screen text in ${scene.scene_id} references an undeclared or out-of-scene source ${text.source_ref}`));
      if (!hasCitedEvidenceText(doc, text.source_ref, text.evidence_span_ids, text.exact_text, context)) issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `on-screen text in ${scene.scene_id} lacks a source-byte-verified evidence excerpt present in the text`));
      if (text.protected && !sourceBoundSpan(doc, text.source_ref, text.exact_text, context)) issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `protected on-screen text in ${scene.scene_id} is not bound to verified protected source bytes`));
    }
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

  for (const figure of doc.figures ?? []) {
    if (!sourceRefs.has(figure.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `figure value references undeclared source ${figure.source_ref}`));
    const exact = String(figure.exact_value);
    const exactWithUnit = figure.unit ? `${exact} ${figure.unit}` : exact;
    if (!sourceBoundSpan(doc, figure.source_ref, exact, context, ['number', 'date', 'name', 'quote'])
      && !sourceBoundSpan(doc, figure.source_ref, exactWithUnit, context, ['number', 'date', 'name', 'quote'])) {
      issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `locked figure ${exact} is not bound to verified source bytes`));
    }
    if (figure.unit && !sourceBoundSpan(doc, figure.source_ref, exactWithUnit, context, ['number', 'date', 'name', 'quote'])
      && !sourceBoundSpan(doc, figure.source_ref, figure.unit, context, ['unit'])) {
      issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `figure unit ${figure.unit} is not bound to verified source bytes`));
    }
  }
  for (const request of doc.change_requests) {
    if (LOCKED_CHANGE_FIELDS.has(request.field) || recursivelyContainsLockedField(request.requested_value)) {
      issues.push(issueFor(CODES.LOCKED_FIELD, doc, `${request.field} request contains a locked source, rights, figures, or approval change`));
    }
    if (!validChangeRequestShape(request)) issues.push(issueFor(CODES.UNSUPPORTED_FIELD, doc, `requested_value has an invalid shape for ${request.field}`));
    if (request.field === 'captions' && Array.isArray(request.requested_value?.protected_exact_text)
      && request.requested_value.protected_exact_text.join('\u0000') !== doc.captions.protected_exact_text.join('\u0000')) {
      issues.push(issueFor(CODES.LOCKED_FIELD, doc, 'caption requests cannot replace or remove protected exact text'));
    }
    if (request.field === 'captions' && Array.isArray(request.requested_value?.protected_exact_text)
      && request.requested_value.protected_exact_text.some((text) => !doc.source_evidence.sources.some((source) =>
        sourceBoundSpan(doc, source.source_id, text, context) || sourceBoundSpan(doc, source.source_ref, text, context)))) {
      issues.push(issueFor(CODES.LOCKED_FIELD, doc, 'caption requests may include only source-byte-verified protected exact text'));
    }
  }

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

function hasCitedEvidenceText(plan, sourceRef, spanIds, exactText, context) {
  const verified = context.verifiedEvidenceSpans ?? context.verifiedProtectedSpans?.verifiedEvidenceSpans;
  return plan.source_evidence.sources.some((source) => [source.source_id, source.source_ref].includes(sourceRef)
    && (source.evidence_spans ?? []).some((span) => spanIds.includes(span.span_id) && exactText === span.exact_text
      && evidenceSpanReceiptIsBound(source, span) && verified instanceof Set && verified.has(spanReceiptKey(source, span))));
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
    const verifiedEvidence = context.verifiedEvidenceSpans ?? context.verifiedProtectedSpans?.verifiedEvidenceSpans;
    const citedSpans = plan ? turn.evidence_span_ids.map((spanId) => {
      const source = plan.source_evidence.sources.find((candidate) => turn.source_refs.some((ref) => [candidate.source_id, candidate.source_ref].includes(ref))
        && candidate.evidence_spans?.some((span) => span.span_id === spanId));
      const span = source?.evidence_spans?.find((candidate) => candidate.span_id === spanId);
      return source && span && evidenceSpanReceiptIsBound(source, span) && verifiedEvidence instanceof Set
        && verifiedEvidence.has(spanReceiptKey(source, span)) ? span : null;
    }).filter(Boolean) : [];
    const citedText = citedSpans.map((span) => span.exact_text).join(' ');
    if (!citedSpans.length || citedSpans.length !== turn.evidence_span_ids.length
      || new Set(turn.evidence_span_ids).size !== turn.evidence_span_ids.length || turn.spoken_text !== citedText) {
      issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `turn ${turn.turn_id} spoken text must exactly match its ordered source-byte-verified evidence excerpts`));
    }
    for (const text of turn.on_screen_text) {
      if (!refs.has(text.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `turn ${turn.turn_id} on-screen text references undeclared source ${text.source_ref}`));
      if (plan && !hasCitedEvidenceText(plan, text.source_ref, text.evidence_span_ids, text.exact_text, context)) {
        issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `narration overlay in ${turn.turn_id} lacks a source-byte-verified evidence excerpt present in the text`));
      }
      if (text.protected && plan && !sourceBoundSpan(plan, text.source_ref, text.exact_text, context)) {
        issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `protected narration overlay in ${turn.turn_id} is not bound to verified source bytes`));
      }
    }
    if (/<[a-z][^>]*>/i.test(turn.spoken_text) || /\[(pause|whispers?|laughs?|sighs?|emphasis)\]/i.test(turn.spoken_text)) issues.push(issueFor(CODES.DELIVERY_MARKUP_LEAK, doc, `turn ${turn.turn_id} contains delivery markup in canonical spoken text`));
  }
  for (const value of doc.protected_values) {
    if (!refs.has(value.source_ref)) issues.push(issueFor(CODES.SOURCE_MISSING, doc, `protected ${value.kind} ${value.exact_text} references undeclared source ${value.source_ref}`));
    else if (plan && !hasProtectedSourceSpan(plan, value, context)) issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `protected ${value.kind} ${value.exact_text} does not match locally verified source bytes or a trusted resolver receipt`));
    if (!doc.turns.some((turn) => turn.spoken_text.includes(value.exact_text))) issues.push(issueFor(CODES.PROTECTED_TEXT_MISMATCH, doc, `protected ${value.kind} ${value.exact_text} is absent from canonical spoken text`));
  }
  if (plan) for (const source of plan.source_evidence.sources) for (const span of source.protected_spans ?? []) {
    if (!doc.protected_values.some((value) => [source.source_id, source.source_ref].includes(value.source_ref) && value.kind === span.kind && value.exact_text === span.exact_text)) {
      issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `source-protected span ${span.span_id} is omitted from narration protected_values`));
    }
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
    for (const source of plan.source_evidence.sources) for (const span of source.protected_spans ?? []) {
      if (!doc.protected_values.some((value) => [source.source_id, source.source_ref].includes(value.source_ref) && value.kind === span.kind && value.exact_text === span.exact_text)) {
        issues.push(issueFor(CODES.PROTECTED_VALUE_UNVERIFIED, doc, `source-protected span ${span.span_id} is omitted from audio protected_values`));
      }
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
  const alignmentStatus = doc.captions.alignment_status;
  const alignmentEvidence = doc.captions.alignment_evidence;
  if (alignmentStatus !== 'not_yet' && !alignmentEvidence) {
    issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, 'completed caption alignment requires a shorts_gen qa_repair StageResult evidence record'));
  }
  if (alignmentStatus === 'pass' && !rendered) {
    issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, 'caption alignment cannot pass before the audio has been rendered'));
  }
  const alignmentBySegment = new Map();
  if (alignmentEvidence) {
    const stageResult = alignmentEvidence.stage_result;
    if (alignmentEvidence.evidence_ref !== alignmentPayloadRef(alignmentEvidence)) {
      issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, 'alignment evidence_ref must be the SHA-256 content address of its audio identity and measured segment payload'));
    }
    if (!stageResult.output_refs.includes(alignmentEvidence.evidence_ref)) {
      issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, 'content-addressed alignment evidence_ref must be an output of the shorts_gen QA StageResult'));
    }
    if (alignmentStatus === 'pass' && stageResult.errors.length) {
      issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, 'passing alignment evidence cannot include engine QA StageResult errors'));
    }
    if (stageResult.receipts.some((receipt) => receipt.duration_s <= 0 || receipt.fps <= 0)) {
      issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, 'engine render receipts must report positive duration and frame rate'));
    }
    if (doc.measurement.audio_ref !== alignmentEvidence.audio_ref || doc.measurement.audio_sha256 !== alignmentEvidence.audio_sha256) {
      issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, 'alignment evidence must bind the exact measured audio ref and SHA-256'));
    }
    if (doc.measurement.measured_audio_duration_seconds === null || doc.measurement.measured_audio_duration_seconds <= 0) {
      issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, 'engine alignment evidence requires a positive measured audio duration'));
    }
    const audioSegments = new Map();
    for (const segment of doc.segments) {
      if (audioSegments.has(segment.segment_id)) issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, `audio segment id ${segment.segment_id} is repeated`));
      audioSegments.set(segment.segment_id, segment);
    }
    for (const measured of alignmentEvidence.segments) {
      if (alignmentBySegment.has(measured.segment_id)) issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, `alignment evidence repeats segment ${measured.segment_id}`));
      alignmentBySegment.set(measured.segment_id, measured);
      const segment = audioSegments.get(measured.segment_id);
      const scene = plan?.scenes.find((candidate) => candidate.scene_id === measured.scene_id);
      if (!segment || segment.scene_id !== measured.scene_id || !scene) {
        issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `engine alignment evidence references unknown or mismatched segment/scene ${measured.segment_id}/${measured.scene_id}`));
        continue;
      }
      if (measured.spoken_text_sha256 !== segment.narration_span_hash
        || segment.narration_span_hash !== sha256(Buffer.from(segment.spoken_text, 'utf8'))) {
        issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, `engine alignment evidence for ${measured.segment_id} is not bound to the canonical spoken-text hash`));
      }
      const duration = doc.measurement.measured_audio_duration_seconds;
      if (measured.measured_start_seconds >= measured.measured_end_seconds
        || measured.measured_start_seconds < scene.timing.start_seconds
        || measured.measured_end_seconds > scene.timing.end_seconds
        || (duration !== null && measured.measured_end_seconds > duration)) {
        issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, `engine measured boundaries for ${measured.segment_id} fall outside its scene or measured audio duration`));
      }
    }
    if (alignmentEvidence.segments.length !== doc.segments.length
      || doc.segments.some((segment) => !alignmentBySegment.has(segment.segment_id))) {
      issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, 'engine alignment evidence must cover every canonical audio segment exactly once'));
    }
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
    const scene = plan?.scenes.find((s) => s.scene_id === caption.scene_id);
    if (segment && caption.exact_text !== segment.spoken_text) issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `caption text for ${caption.scene_id} does not match canonical spoken text`));
    if (caption.start_seconds >= caption.end_seconds) issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `caption timing for ${caption.scene_id} is invalid`));
    const hasAlignmentMeasurement = caption.measured_start_seconds != null
      || caption.measured_end_seconds != null || caption.alignment_evidence_ref != null;
    if (alignmentStatus !== 'not_yet' || hasAlignmentMeasurement) {
      const measuredStart = caption.measured_start_seconds;
      const measuredEnd = caption.measured_end_seconds;
      const measuredEvidence = alignmentBySegment.get(segment?.segment_id);
      if (typeof measuredStart !== 'number' || typeof measuredEnd !== 'number' || !knownRightsText(caption.alignment_evidence_ref)) {
        issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, `caption ${caption.scene_id} must carry measured boundaries and an engine QA evidence reference once alignment is recorded`));
      } else if (!alignmentEvidence || caption.alignment_evidence_ref !== alignmentEvidence.evidence_ref
        || !measuredEvidence || measuredEvidence.scene_id !== caption.scene_id
        || measuredEvidence.measured_start_seconds !== measuredStart || measuredEvidence.measured_end_seconds !== measuredEnd) {
        issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, `caption ${caption.scene_id} measurements do not match the referenced engine QA evidence for its spoken segment`));
      }
      const duration = doc.measurement.measured_audio_duration_seconds;
      if (typeof measuredStart === 'number' && typeof measuredEnd === 'number'
        && (measuredStart >= measuredEnd || (scene && (measuredStart < scene.timing.start_seconds || measuredEnd > scene.timing.end_seconds))
          || (duration !== null && measuredEnd > duration))) {
        issues.push(issueFor(CODES.ENGINE_QA_EVIDENCE, doc, `caption ${caption.scene_id} measured boundaries fall outside its scene or measured audio duration`));
      }
      if (alignmentStatus === 'pass' && typeof measuredStart === 'number' && typeof measuredEnd === 'number') {
        const alignmentToleranceSeconds = 0.1;
        if (Math.abs(caption.start_seconds - measuredStart) > alignmentToleranceSeconds
          || Math.abs(caption.end_seconds - measuredEnd) > alignmentToleranceSeconds) {
          issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `caption timing for ${caption.scene_id} must align with engine-measured spoken-segment boundaries within ${alignmentToleranceSeconds} second`));
        }
      }
    }
    if (scene && (caption.start_seconds < scene.timing.start_seconds || caption.end_seconds > scene.timing.end_seconds)) issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `caption timing for ${caption.scene_id} falls outside its scene bounds`));
    const measured = doc.measurement.measured_audio_duration_seconds;
    if (measured !== null && caption.end_seconds > measured && alignmentStatus !== 'not_yet') issues.push(issueFor(CODES.CAPTION_MISMATCH, doc, `caption timing for ${caption.scene_id} exceeds measured audio duration`));
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
  const metrics = new Map(doc.measurable_evidence.map((entry) => [entry.metric, entry]));
  if (metrics.size !== doc.measurable_evidence.length) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'measurable evidence cannot repeat metric names'));
  if (doc.checks.technical_resolution_fps_duration.status === 'pass') {
    for (const metric of ['video.resolution', 'video.fps', 'video.duration_seconds']) if (!metrics.has(metric)) issues.push(issueFor(CODES.QA_EVIDENCE, doc, `technical QA passed without measurable ${metric} evidence`));
  }
  if (doc.checks.caption_completeness_alignment.status === 'pass' && !metrics.has('captions.alignment')) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'caption QA passed without measurable alignment evidence'));
  const plan = context.videoPlan;
  const resolution = metrics.get('video.resolution');
  const resolutionMatch = typeof resolution?.value === 'string' && /^(\d+)x(\d+)$/.exec(resolution.value);
  if (resolution && (!resolutionMatch || Number(resolutionMatch[1]) <= 0 || Number(resolutionMatch[2]) <= 0 || resolution.unit !== 'pixels')) {
    issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'video.resolution must be a positive WIDTHxHEIGHT pixel measurement'));
  }
  if (resolutionMatch && plan) {
    const ratio = Number(resolutionMatch[1]) / Number(resolutionMatch[2]);
    const expectedRatio = ({ '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 })[plan.aspect_ratio];
    if (Math.abs(ratio - expectedRatio) > 0.02) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'measured resolution aspect ratio conflicts with the video plan'));
  }
  const fps = metrics.get('video.fps');
  if (fps && (typeof fps.value !== 'number' || !Number.isFinite(fps.value) || fps.value <= 0 || fps.unit !== 'frames/second'
    || (plan && Math.abs(fps.value - plan.fps) > 0.01))) {
    issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'video.fps must be positive and match the planned frame rate'));
  }
  const duration = metrics.get('video.duration_seconds');
  const durationToleranceSeconds = 1;
  if (duration && (typeof duration.value !== 'number' || !Number.isFinite(duration.value) || duration.value <= 0 || duration.unit !== 'seconds'
    || (plan && Math.abs(duration.value - plan.target_duration_seconds) > durationToleranceSeconds))) {
    issues.push(issueFor(CODES.QA_EVIDENCE, doc, `video.duration_seconds must match the planned duration within ${durationToleranceSeconds} second`));
  }
  const captionAlignment = metrics.get('captions.alignment');
  if (captionAlignment && (captionAlignment.value !== true || captionAlignment.unit !== 'boolean')) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'captions.alignment must report a passing boolean measurement'));
  const failed = statuses.includes('fail');
  const pending = statuses.includes('not_yet');
  const expected = failed ? 'FAILED' : pending ? 'PARTIAL' : 'PASS';
  if (doc.result !== expected) issues.push(issueFor(CODES.QA_RESULT, doc, `result ${doc.result} conflicts with check and gate states; expected ${expected}`));
  if (doc.result === 'PASS' && !doc.measurable_evidence.length) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'PASS requires measurable evidence'));
  if (doc.result === 'PASS' && doc.checks.source_evidence_resolution.status !== 'pass') issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'PASS requires source-evidence extraction receipts to be independently resolved'));
  if (doc.result === 'PASS' && plan) for (const source of plan.source_evidence.sources) for (const span of source.protected_spans ?? []) {
    if (!isProtectedSpanResolved(source, span, context)) issues.push(issueFor(CODES.QA_EVIDENCE, doc, `PASS cannot treat protected source span ${span.span_id} as verified without resolved source bytes`));
  }
  if (doc.repair.scope === 'affected_scenes_only' && !doc.repair.affected_scene_ids.length) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'scene-local rerender must name affected scenes'));
  if (doc.repair.scope === 'none' && doc.repair.affected_scene_ids.length) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'repair scope none cannot list affected scenes'));
  if (plan) {
    const validScenes = new Set(plan.scenes.map((s) => s.scene_id));
    for (const id of doc.repair.affected_scene_ids) if (!validScenes.has(id)) issues.push(issueFor(CODES.SCENE_MISMATCH, doc, `repair references unknown scene ${id}`));
    const rightStatus = plan.source_evidence.sources.every((s) => s.rights.status === 'verified'
      && knownRightsText(s.rights.license) && knownRightsText(s.rights.rights_owner) && knownRightsText(s.rights.evidence_ref)
      && s.rights.platforms.length > 0 && s.rights.commercial_use === true && s.rights.modification_allowed === true);
    if (doc.result === 'PASS' && !rightStatus) issues.push(issueFor(CODES.RIGHTS_BLOCKED, doc, 'video QA cannot PASS while source rights are unknown, missing, denied, or unverified'));
    if (doc.result === 'PASS' && !['approved', 'not_required'].includes(plan.approval.status)) issues.push(issueFor(CODES.QA_GATE, doc, 'video QA cannot PASS without an approved or explicitly not-required approval state'));
    if (plan.approval.status === 'approved' && !knownRightsText(plan.approval.evidence_ref)) issues.push(issueFor(CODES.QA_GATE, doc, 'approved video plan must include approval evidence'));
    if (doc.gates.approval.status === 'pass' && !['approved', 'not_required'].includes(plan.approval.status)) issues.push(issueFor(CODES.QA_GATE, doc, 'approval gate cannot pass while plan approval is pending or rejected'));
    if (plan.audio.bgm_mode === 'off' && doc.checks.bgm_loudness_ducking_clipping.status === 'pass' && !metrics.has('bgm.mode')) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'BGM-off QA requires measurable evidence that BGM mode is off'));
    const bgmMode = metrics.get('bgm.mode');
    if (doc.checks.bgm_loudness_ducking_clipping.status === 'pass' && !bgmMode) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'BGM QA requires a measurable BGM mode value'));
    if (bgmMode && (bgmMode.value !== plan.audio.bgm_mode || bgmMode.unit !== 'mode')) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'bgm.mode measurement must match the planned BGM mode'));
    const bgmLoudness = metrics.get('bgm.loudness_lufs');
    if (bgmLoudness && (typeof bgmLoudness.value !== 'number' || !Number.isFinite(bgmLoudness.value) || bgmLoudness.value < -100 || bgmLoudness.value > 0 || bgmLoudness.unit !== 'LUFS')) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'bgm.loudness_lufs must be a finite LUFS measurement between -100 and 0'));
    const bgmDucking = metrics.get('bgm.ducking_db');
    if (bgmDucking && (typeof bgmDucking.value !== 'number' || !Number.isFinite(bgmDucking.value) || bgmDucking.value > 0 || bgmDucking.value < -100 || bgmDucking.unit !== 'dB')) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'bgm.ducking_db must be a finite attenuation measurement between -100 and 0 dB'));
    const clippedSamples = metrics.get('bgm.clipped_samples');
    if (clippedSamples && (typeof clippedSamples.value !== 'number' || !Number.isInteger(clippedSamples.value) || clippedSamples.value < 0 || clippedSamples.unit !== 'samples')) issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'bgm.clipped_samples must be a non-negative integer sample count'));
    if (plan.audio.bgm_mode === 'off' && ['bgm.loudness_lufs', 'bgm.ducking_db', 'bgm.clipped_samples'].some((metric) => metrics.has(metric))) {
      issues.push(issueFor(CODES.QA_EVIDENCE, doc, 'BGM-off QA cannot report active BGM loudness, ducking, or clipping measurements'));
    }
    if (plan.audio.bgm_mode !== 'off' && doc.checks.bgm_loudness_ducking_clipping.status === 'pass') {
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
  if (kind === 'bgm-catalog-v2') for (const track of doc.tracks) {
    const { start_seconds: start, end_seconds: end } = track.loop_points;
    if ((start === null) !== (end === null) || (start !== null && end <= start)) {
      issues.push(issue(CODES.BGM_UNSAFE, doc.catalog_id, `track ${track.track_id} loop points must both be null or have end_seconds greater than start_seconds`));
    }
  }
  if (kind === 'video-qa') validateVideoQa(doc, issues, context);
  return issues;
}
