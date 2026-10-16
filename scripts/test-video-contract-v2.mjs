#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, resolveLocalSourceEvidence, validateVideoDocument } from './lib/video-plan-core.mjs';
import { validate } from './lib/json-schema-lite.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOW = resolve(ROOT, 'schemas/examples/video/allow');
const DENY = resolve(ROOT, 'schemas/examples/video/deny');
const read = (dir, file) => JSON.parse(readFileSync(resolve(dir, file), 'utf8'));
const kind = (file) => ['video-plan-v2', 'narration-script-v2', 'audio-plan-v2', 'bgm-catalog-v2', 'video-qa'].find((prefix) => file.startsWith(prefix));
const clone = (value) => JSON.parse(JSON.stringify(value));
let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS ${name}`);
  else { failures++; console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
};
const codes = (type, doc, context = {}) => validateVideoDocument(type, doc, context).map((item) => item.code);

console.log('video plan v2 allow fixtures');
const v2AllowFiles = readdirSync(ALLOW).filter((file) => file.includes('-v2-') || file.startsWith('video-qa-')).sort();
check('required 2.0 video/audio/BGM/QA fixtures are present', v2AllowFiles.length === 14, v2AllowFiles.join(', '));
const allowDocs = v2AllowFiles.map((file) => ({ file, doc: read(ALLOW, file) }));
const planById = new Map(allowDocs.filter(({ file }) => file.startsWith('video-plan-v2-')).map(({ doc }) => [doc.plan_id, doc]));
const scriptById = new Map(allowDocs.filter(({ file }) => file.startsWith('narration-script-v2-')).map(({ doc }) => [doc.script_id, doc]));
const evidenceByPlan = new Map([...planById].map(([id, plan]) => [id, resolveLocalSourceEvidence(plan)]));
for (const file of v2AllowFiles) {
  const doc = read(ALLOW, file);
  const planRef = doc.video_plan_ref ?? doc.plan_ref;
  const videoPlan = file.startsWith('video-plan-v2-') ? doc : planRef && planById.has(planRef) ? planById.get(planRef) : null;
  const context = {
    ...(videoPlan ? { videoPlan, verifiedProtectedSpans: evidenceByPlan.get(videoPlan.plan_id) } : {}),
    ...(doc.script_ref && scriptById.has(doc.script_ref) ? { narrationScript: scriptById.get(doc.script_ref) } : {}),
  };
  const issues = validateVideoDocument(kind(file), doc, context);
  check(file, issues.length === 0, issues.map((item) => `[${item.code}] ${item.message}`).join('; '));
}

const manifest = JSON.parse(readFileSync(resolve(ROOT, 'editorial/entry-manifest.json'), 'utf8'));
const profiles = manifest.video_profiles;
const profileSchema = JSON.parse(readFileSync(resolve(ROOT, 'schemas/video-profile.schema.json'), 'utf8'));
check('manifest pins exactly the three registered video families', Object.keys(profiles).sort().join() === 'video/educational-summary,video/interactive-information,video/narrated-explainer');
for (const [id, pin] of Object.entries(profiles)) {
  const profile = read(ROOT, pin.path);
  check(`${id} validates and matches its exact ID/revision`, validate(profile, profileSchema).length === 0 && profile.profile_id === id && profile.revision === pin.revision);
  const planFile = id.endsWith('educational-summary') ? 'video-plan-v2-example-45s.json' : id.endsWith('interactive-information') ? 'video-plan-v2-interactive-hybrid.json' : 'video-plan-v2-narrated-mixed.json';
  const plan = read(ALLOW, planFile);
  check(`${id} plan carries the exact manifest SHA pin`, plan.profile_ref.profile_id === id && plan.profile_ref.revision === pin.revision && plan.profile_ref.sha256 === pin.sha256);
}

const landscape = read(ALLOW, 'video-plan-v2-silent-60s-16-9.json');
const portrait = read(ALLOW, 'video-plan-v2-silent-60s-9-16.json');
check('60-second source-only landscape has no editorial package or fabricated article/claim', landscape.target_duration_seconds === 60 && landscape.aspect_ratio === '16:9' && landscape.scenes.every((s) => s.source_only) && !('editorial_package_ref' in landscape) && !('article_id' in landscape) && !('claim' in landscape));
check('60-second source-only portrait has no editorial package or fabricated article/claim', portrait.target_duration_seconds === 60 && portrait.aspect_ratio === '9:16' && portrait.scenes.every((s) => s.source_only) && !('editorial_package_ref' in portrait) && !('article_id' in portrait) && !('claim' in portrait));
const example45 = read(ALLOW, 'video-plan-v2-example-45s.json');
check('45-second educational example uses the profile default beat order', example45.target_duration_seconds === 45 && example45.scenes.map((s) => s.function).join() === 'hook,concept,example,worked_solution,key_takeaway');
check('interactive profile fixtures cover sequential, simultaneous, and hybrid', ['sequential','simultaneous','hybrid'].every((mode) => read(ALLOW, `video-plan-v2-interactive-${mode}.json`).semantic_controls.presentation === mode));
check('square and portrait social aspects are allowed in addition to the required landscape and portrait aspects', ['1:1','4:5'].every((aspect) => {
  const plan = clone(example45); plan.aspect_ratio = aspect; return codes('video-plan-v2', plan).length === 0;
}));

const narratedPlan = read(ALLOW, 'video-plan-v2-narrated-mixed.json');
const script = read(ALLOW, 'narration-script-v2-source-only.json');
const audioPlan = read(ALLOW, 'audio-plan-v2-narrated-mixed.json');
const narratedEvidence = resolveLocalSourceEvidence(narratedPlan);
const audioContext = { videoPlan: narratedPlan, narrationScript: script, verifiedProtectedSpans: narratedEvidence };
check('source-only narration validates against its versioned source envelope', codes('narration-script-v2', script, audioContext).length === 0 && script.source_evidence_ref === narratedPlan.source_evidence.envelope_id && !('article_id' in script) && !('source_claims' in script));
check('measured narration plan reconciles after the pre-TTS script check', codes('audio-plan-v2', audioPlan, audioContext).length === 0 && audioPlan.canonical_script_check.phase === 'pre_tts' && audioPlan.reconciliation.phase === 'post_measurement');
const plannedAudio = clone(audioPlan);
plannedAudio.status = 'planned';
plannedAudio.measurement = { provider_status:'not_configured', measured_audio_duration_seconds:null, measured_at:null, evidence_ref:null, audio_ref:null, audio_sha256:null };
plannedAudio.reconciliation = { phase:'post_measurement', action:'pending', affected_scene_ids:[], evidence_ref:null };
plannedAudio.captions.alignment_status = 'not_yet';
delete plannedAudio.captions.alignment_evidence;
for (const caption of plannedAudio.captions.segments) {
  delete caption.measured_start_seconds;
  delete caption.measured_end_seconds;
  delete caption.alignment_evidence_ref;
}
plannedAudio.captions.segments[0].measured_start_seconds = null;
plannedAudio.captions.segments[0].measured_end_seconds = null;
plannedAudio.captions.segments[0].alignment_evidence_ref = null;
check('premeasurement planned audio may have an unconfigured provider and no alignment measurements', codes('audio-plan-v2', plannedAudio, audioContext).length === 0);
check('BGM auto-match allows a fully rights-verified track', codes('bgm-catalog-v2', read(ALLOW, 'bgm-catalog-v2-auto-match.json'), { videoPlan: narratedPlan }).length === 0);
const activeClaimCatalog = clone(read(ALLOW, 'bgm-catalog-v2-auto-match.json'));
activeClaimCatalog.tracks[0].content_id_status = 'active_claim';
activeClaimCatalog.tracks[0].whitelist = [{ platform:'youtube', evidence_ref:'fixture://bgm/whitelist' }];
check('BGM auto-match blocks an active Content ID claim even when whitelist metadata exists', codes('bgm-catalog-v2', activeClaimCatalog, { videoPlan: narratedPlan }).includes(CODES.BGM_UNSAFE));
const selfClaimCatalog = clone(read(ALLOW, 'bgm-catalog-v2-auto-match.json'));
selfClaimCatalog.tracks[0].self_claim = true;
check('BGM auto-match does not infer safety from a self claim', codes('bgm-catalog-v2', selfClaimCatalog, { videoPlan: narratedPlan }).includes(CODES.BGM_UNSAFE));
check('QA accepts evidence-backed PASS, FAILED, and PARTIAL outcomes', ['video-qa-pass.json','video-qa-failed.json','video-qa-partial.json'].every((file) => codes('video-qa', read(ALLOW, file), audioContext).length === 0));
const unresolvedSourceQa = clone(read(ALLOW, 'video-qa-pass.json'));
unresolvedSourceQa.checks.source_evidence_resolution = { status:'not_yet', evidence_refs:[] };
check('video QA cannot PASS until source extraction evidence is independently resolved', codes('video-qa', unresolvedSourceQa, { videoPlan: narratedPlan }).includes(CODES.QA_EVIDENCE));
const qaBadFps = clone(read(ALLOW, 'video-qa-pass.json'));
qaBadFps.measurable_evidence.find((entry) => entry.metric === 'video.fps').value = 0;
check('video QA rejects zero or plan-mismatched fps measurements', codes('video-qa', qaBadFps, audioContext).includes(CODES.QA_EVIDENCE));
const qaBadDuration = clone(read(ALLOW, 'video-qa-pass.json'));
qaBadDuration.measurable_evidence.find((entry) => entry.metric === 'video.duration_seconds').value = 900;
check('video QA rejects duration measurements beyond the plan', codes('video-qa', qaBadDuration, audioContext).includes(CODES.QA_EVIDENCE));
const qaShortDuration = clone(read(ALLOW, 'video-qa-pass.json'));
qaShortDuration.measurable_evidence.find((entry) => entry.metric === 'video.duration_seconds').value = 1;
check('video QA rejects measured duration shorter than plan tolerance', codes('video-qa', qaShortDuration, audioContext).includes(CODES.QA_EVIDENCE));
const qaWrongBgmMode = clone(read(ALLOW, 'video-qa-pass.json'));
qaWrongBgmMode.measurable_evidence.find((entry) => entry.metric === 'bgm.mode').value = 'auto_match';
check('video QA BGM mode measurement must match the video plan', codes('video-qa', qaWrongBgmMode, audioContext).includes(CODES.QA_EVIDENCE));
const qaInvalidBgmMetrics = clone(read(ALLOW, 'video-qa-pass.json'));
qaInvalidBgmMetrics.measurable_evidence.push({ metric:'bgm.clipped_samples', value:-1, unit:'samples', evidence_ref:'fixture://qa/clipping', scene_id:null, source_ref:null });
check('video QA rejects invalid BGM measurement values', codes('video-qa', qaInvalidBgmMetrics, audioContext).includes(CODES.QA_EVIDENCE));
const qaMissingPlanApproval = clone(narratedPlan); qaMissingPlanApproval.approval.evidence_ref = null;
check('video QA cannot PASS when approved plan evidence is null', codes('video-qa', read(ALLOW, 'video-qa-pass.json'), { ...audioContext, videoPlan:qaMissingPlanApproval }).includes(CODES.QA_GATE));
check('standalone narration, audio, QA, and BGM validation fail closed without the referenced plan context', [
  codes('narration-script-v2', script), codes('audio-plan-v2', audioPlan), codes('video-qa', read(ALLOW, 'video-qa-pass.json')),
  codes('bgm-catalog-v2', read(ALLOW, 'bgm-catalog-v2-auto-match.json')),
].every((found) => found.includes(CODES.CONTEXT_MISSING)));
check('audio-plan validation also requires the referenced narration script when the video plan is present', codes('audio-plan-v2', audioPlan, { videoPlan: narratedPlan }).includes(CODES.CONTEXT_MISSING));
const skippedScriptCheck = clone(audioPlan);
skippedScriptCheck.canonical_script_check = { phase:'pre_tts', performed:false, outcome:'pass', evidence_ref:null };
check('rendered audio cannot claim a passing pre-TTS check that was not performed', codes('audio-plan-v2', skippedScriptCheck, audioContext).includes(CODES.PRE_TTS_GATE));
const audioDrift = clone(audioPlan);
audioDrift.segments[1].spoken_text = 'An invented unsupported statement.';
audioDrift.captions.segments[1].exact_text = audioDrift.segments[1].spoken_text;
audioDrift.captions.segments[1].lines = [audioDrift.segments[1].spoken_text];
check('audio segments and captions cannot drift from canonical narration text', codes('audio-plan-v2', audioDrift, audioContext).includes(CODES.AUDIO_SCRIPT_MISMATCH));
const inventedNarration = clone(script);
inventedNarration.turns[0].spoken_text += ' Dr Invented proved that 999 patients were cured.';
check('invented narration is blocked by missing byte-verified evidence coverage even when protected values remain', codes('narration-script-v2', inventedNarration, audioContext).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const removedProtectionsAndEvidence = clone(narratedPlan);
removedProtectionsAndEvidence.source_evidence.sources[0].protected_spans = [];
const inventedWithoutProtection = clone(script);
inventedWithoutProtection.protected_values = [];
inventedWithoutProtection.turns[0].spoken_text += ' Dr Invented proved that 999 patients were cured.';
check('clearing optional protected spans and values cannot make unsupported narration pass', codes('narration-script-v2', inventedWithoutProtection, { videoPlan:removedProtectionsAndEvidence, verifiedProtectedSpans:resolveLocalSourceEvidence(removedProtectionsAndEvidence) }).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const inventedPlanOutput = clone(removedProtectionsAndEvidence);
inventedPlanOutput.scenes[0].on_screen_text[0].exact_text += ' Dr Invented proved that 999 patients were cured.';
check('video-plan factual text needs its own verified evidence coverage after protected spans are removed', codes('video-plan-v2', inventedPlanOutput, { verifiedProtectedSpans:resolveLocalSourceEvidence(inventedPlanOutput) }).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const falseNarrationOverlay = clone(script);
falseNarrationOverlay.turns[0].on_screen_text[0] = { exact_text:'999 seconds', source_ref:'source-1', protected:true, evidence_span_ids:['evidence-1'] };
check('protected narration overlays must be bound to verified source bytes', codes('narration-script-v2', falseNarrationOverlay, audioContext).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const incompleteCaptions = clone(audioPlan);
incompleteCaptions.captions.segments.splice(1, 2);
check('rendered audio requires one caption segment for every spoken scene', codes('audio-plan-v2', incompleteCaptions, audioContext).includes(CODES.CAPTION_MISMATCH));
const outOfBoundsCaption = clone(audioPlan);
outOfBoundsCaption.captions.segments[0].start_seconds = 999;
outOfBoundsCaption.captions.segments[0].end_seconds = 1000;
check('caption timing must stay inside the referenced scene and measured audio', codes('audio-plan-v2', outOfBoundsCaption, audioContext).includes(CODES.CAPTION_MISMATCH));
const captionTimingDrift = clone(audioPlan);
captionTimingDrift.captions.segments[0].end_seconds = 0.001;
check('caption timing cannot claim alignment when it conflicts with measured spoken-segment boundaries', codes('audio-plan-v2', captionTimingDrift, audioContext).includes(CODES.CAPTION_MISMATCH));
const missingEngineAlignment = clone(audioPlan);
missingEngineAlignment.captions.segments[0].end_seconds = 0.001;
missingEngineAlignment.captions.segments[0].measured_end_seconds = 0.001;
missingEngineAlignment.captions.segments[0].alignment_evidence_ref = 'does-not-exist://alignment';
delete missingEngineAlignment.captions.alignment_evidence;
check('self-asserted alignment pass without an engine QA StageResult is rejected', codes('audio-plan-v2', missingEngineAlignment, audioContext).includes(CODES.ENGINE_QA_EVIDENCE));
const detachedEngineAlignment = clone(audioPlan);
detachedEngineAlignment.captions.segments[0].measured_end_seconds = 0.001;
check('alignment measurements must match the engine QA segment evidence', codes('audio-plan-v2', detachedEngineAlignment, audioContext).includes(CODES.ENGINE_QA_EVIDENCE));
const malformedStageResult = clone(audioPlan);
malformedStageResult.captions.alignment_evidence.stage_result.input_hash = 'not-a-sha256';
check('engine QA StageResult input hashes must use the required SHA-256 shape', codes('audio-plan-v2', malformedStageResult, audioContext).includes(CODES.SCHEMA));
const detachedEngineOutput = clone(audioPlan);
detachedEngineOutput.captions.alignment_evidence.stage_result.output_refs = ['fixture://different-output'];
check('alignment evidence ref must be an output of the engine QA StageResult', codes('audio-plan-v2', detachedEngineOutput, audioContext).includes(CODES.ENGINE_QA_EVIDENCE));
const reusedAlignmentReceipt = clone(audioPlan);
const reusedAlignmentEvidence = reusedAlignmentReceipt.captions.alignment_evidence;
reusedAlignmentEvidence.audio_ref = 'fixture://audio/replaced';
reusedAlignmentEvidence.audio_sha256 = 'a'.repeat(64);
reusedAlignmentEvidence.segments[0].measured_end_seconds = 0.001;
reusedAlignmentReceipt.measurement.audio_ref = reusedAlignmentEvidence.audio_ref;
reusedAlignmentReceipt.measurement.audio_sha256 = reusedAlignmentEvidence.audio_sha256;
reusedAlignmentReceipt.captions.segments[0].end_seconds = 0.001;
reusedAlignmentReceipt.captions.segments[0].measured_end_seconds = 0.001;
reusedAlignmentReceipt.captions.segments[0].alignment_evidence_ref = reusedAlignmentEvidence.evidence_ref;
reusedAlignmentReceipt.status = 'complete';
check('an unchanged engine receipt cannot authorize replaced audio and caption boundaries', codes('audio-plan-v2', reusedAlignmentReceipt, audioContext).includes(CODES.ENGINE_QA_EVIDENCE));
const unknownAlignmentSegment = clone(audioPlan);
unknownAlignmentSegment.captions.alignment_evidence.segments[0].segment_id = 'seg-missing';
check('engine QA evidence must reference existing scene and segment IDs', codes('audio-plan-v2', unknownAlignmentSegment, audioContext).includes(CODES.SCENE_MISMATCH));
const outOfBoundsEngineMeasurement = clone(audioPlan);
outOfBoundsEngineMeasurement.captions.alignment_evidence.segments[0].measured_end_seconds = 45;
outOfBoundsEngineMeasurement.captions.segments[0].measured_end_seconds = 45;
check('engine measured caption boundaries must remain within the scene and audio duration', codes('audio-plan-v2', outOfBoundsEngineMeasurement, audioContext).includes(CODES.ENGINE_QA_EVIDENCE));
const inventedProtectedValue = clone(script);
inventedProtectedValue.protected_values[0] = { kind:'quote', exact_text:'an invented quotation', source_ref:'source-1', locked:true };
const inventedIssues = codes('narration-script-v2', inventedProtectedValue, { videoPlan: narratedPlan });
check('protected narration text must match an extracted source span and appear in spoken text', inventedIssues.includes(CODES.PROTECTED_VALUE_UNVERIFIED) && inventedIssues.includes(CODES.PROTECTED_TEXT_MISMATCH));
const omittedProtectedValues = clone(script); omittedProtectedValues.protected_values = [];
check('removing protected_values cannot bypass source-span coverage', codes('narration-script-v2', omittedProtectedValues, audioContext).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const falseProtectedText = clone(narratedPlan);
falseProtectedText.scenes[0].on_screen_text[0] = { exact_text:'999 seconds', source_ref:'source-1', protected:true, evidence_span_ids:['evidence-1'] };
check('protected on-screen text must match a verified source span', codes('video-plan-v2', falseProtectedText, audioContext).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const falseFigure = clone(narratedPlan); falseFigure.figures = [{ exact_value:999, unit:'seconds', source_ref:'source-1', locked:true }];
check('locked figures must match verified source spans', codes('video-plan-v2', falseFigure, audioContext).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const detachedSpanReceipt = clone(narratedPlan);
detachedSpanReceipt.source_evidence.sources[0].protected_spans[0].source_sha256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
check('protected source spans must bind the exact span hash and byte range to the pinned source and extraction receipt', codes('video-plan-v2', detachedSpanReceipt).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const staleRangePlan = clone(narratedPlan);
staleRangePlan.source_evidence.sources[0].evidence_spans[0].byte_start += 1;
staleRangePlan.source_evidence.sources[0].evidence_spans[0].byte_end += 1;
check('a locally verified evidence receipt cannot be reused after its byte range changes', codes('video-plan-v2', staleRangePlan, { verifiedProtectedSpans:narratedEvidence }).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const staleExtractionPlan = clone(narratedPlan);
const staleExtractionSpan = staleExtractionPlan.source_evidence.sources[0].evidence_spans[0];
staleExtractionSpan.extraction_sha256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
staleExtractionSpan.evidence_ref = `source-extraction://sha256/${staleExtractionSpan.source_sha256}/${staleExtractionSpan.extraction_sha256}/span/${staleExtractionSpan.span_id}/${staleExtractionSpan.span_sha256}`;
check('a locally verified evidence receipt cannot be reused after its extraction hash changes', codes('video-plan-v2', staleExtractionPlan, { verifiedProtectedSpans:narratedEvidence }).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const duplicateSourcePlan = clone(example45);
duplicateSourcePlan.source_evidence.sources.push({ ...clone(duplicateSourcePlan.source_evidence.sources[0]), source_ref:'schemas/examples/video/evidence/duplicate-source.txt', evidence_spans:[], protected_spans:[] });
check('duplicate source identifiers are rejected', codes('video-plan-v2', duplicateSourcePlan).includes(CODES.DUPLICATE_SOURCE_ID));
const duplicateEvidencePlan = clone(narratedPlan);
const evidenceSource = duplicateEvidencePlan.source_evidence.sources[0];
const authenticEvidenceSpan = clone(evidenceSource.evidence_spans[0]);
const inventedPatientText = 'The source reports that 999 patients recovered after 45 seconds.';
const inventedPatientHash = createHash('sha256').update(inventedPatientText).digest('hex');
const forgedDuplicateSpan = {
  ...authenticEvidenceSpan,
  exact_text:inventedPatientText,
  byte_start:0,
  byte_end:Buffer.byteLength(inventedPatientText, 'utf8'),
  span_sha256:inventedPatientHash,
  evidence_ref:`source-extraction://sha256/${authenticEvidenceSpan.source_sha256}/${authenticEvidenceSpan.extraction_sha256}/span/${authenticEvidenceSpan.span_id}/${inventedPatientHash}`,
};
evidenceSource.evidence_spans.unshift(forgedDuplicateSpan);
duplicateEvidencePlan.scenes[0].on_screen_text[0].exact_text = inventedPatientText;
const duplicateEvidenceScript = clone(script);
duplicateEvidenceScript.turns[0].spoken_text = inventedPatientText;
duplicateEvidenceScript.turns[0].on_screen_text[0].exact_text = inventedPatientText;
const duplicateEvidenceContext = { videoPlan:duplicateEvidencePlan, narrationScript:duplicateEvidenceScript, verifiedProtectedSpans:resolveLocalSourceEvidence(duplicateEvidencePlan) };
check('duplicate evidence span IDs cannot lend authentic-byte verification to forged plan text', codes('video-plan-v2', duplicateEvidencePlan, duplicateEvidenceContext).includes(CODES.DUPLICATE_SPAN_ID) && codes('video-plan-v2', duplicateEvidencePlan, duplicateEvidenceContext).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
check('duplicate evidence span IDs cannot lend authentic-byte verification to forged narration', codes('narration-script-v2', duplicateEvidenceScript, duplicateEvidenceContext).includes(CODES.PROTECTED_VALUE_UNVERIFIED));
const forgedPlan = clone(narratedPlan);
const forgedSpan = forgedPlan.source_evidence.sources[0].protected_spans[0];
forgedSpan.exact_text = '999 fabricated units';
forgedSpan.byte_start = 0;
forgedSpan.byte_end = Buffer.byteLength(forgedSpan.exact_text, 'utf8');
forgedSpan.span_sha256 = createHash('sha256').update(forgedSpan.exact_text).digest('hex');
forgedSpan.evidence_ref = `source-extraction://sha256/${forgedSpan.source_sha256}/${forgedSpan.extraction_sha256}/span/${forgedSpan.span_id}/${forgedSpan.span_sha256}`;
const forgedEvidence = resolveLocalSourceEvidence(forgedPlan);
const forgedScript = clone(script);
forgedScript.protected_values[0].exact_text = forgedSpan.exact_text;
forgedScript.turns[0].spoken_text = 'The supplied source includes 999 fabricated units.';
const forgedAudio = clone(audioPlan);
forgedAudio.protected_values[0].exact_text = forgedSpan.exact_text;
forgedAudio.segments[0].spoken_text = forgedScript.turns[0].spoken_text;
forgedAudio.segments[0].narration_span_hash = createHash('sha256').update(forgedAudio.segments[0].spoken_text).digest('hex');
forgedAudio.captions.segments[0].exact_text = forgedAudio.segments[0].spoken_text;
forgedAudio.captions.segments[0].lines = [forgedAudio.segments[0].spoken_text];
forgedAudio.captions.segments[0].protected_exact_words = [forgedSpan.exact_text];
const forgedContext = { videoPlan:forgedPlan, narrationScript:forgedScript, verifiedProtectedSpans:forgedEvidence };
check('self-consistent fabricated text, hashes, offsets, script, and captions remain unverified against source bytes', [
  codes('video-plan-v2', forgedPlan, forgedContext),
  codes('narration-script-v2', forgedScript, forgedContext),
  codes('audio-plan-v2', forgedAudio, forgedContext),
].every((found) => found.includes(CODES.PROTECTED_VALUE_UNVERIFIED)));
check('a fabricated extraction receipt cannot support video QA PASS', codes('video-qa', read(ALLOW, 'video-qa-pass.json'), forgedContext).includes(CODES.QA_EVIDENCE));

console.log('\nvideo plan v2 deny fixtures');
const denied = [
  ['video-plan-v2-locked-rights-change.json', 'video-plan-v2', CODES.LOCKED_FIELD],
  ['video-plan-v2-unsupported-field.json', 'video-plan-v2', CODES.UNSUPPORTED_FIELD],
  ['video-plan-v2-missing-source.json', 'video-plan-v2', CODES.SOURCE_MISSING],
  ['audio-plan-v2-scene-mismatch.json', 'audio-plan-v2', CODES.SCENE_MISMATCH],
  ['audio-plan-v2-caption-mismatch.json', 'audio-plan-v2', CODES.CAPTION_MISMATCH],
  ['audio-plan-v2-provider-not-configured.json', 'audio-plan-v2', CODES.PROVIDER_NOT_CONFIGURED],
  ['bgm-catalog-v2-unknown-rights.json', 'bgm-catalog-v2', CODES.BGM_UNSAFE],
  ['bgm-catalog-v2-missing-rights.json', 'bgm-catalog-v2', CODES.SCHEMA],
  ['bgm-catalog-v2-malicious-rights.json', 'bgm-catalog-v2', CODES.BGM_UNSAFE],
  ['bgm-catalog-v2-no-ducking.json', 'bgm-catalog-v2', CODES.BGM_DUCKING],
  ['video-qa-cost-gate-disabled.json', 'video-qa', CODES.SCHEMA],
  ['video-qa-inconsistent-pass.json', 'video-qa', CODES.QA_RESULT],
  ['video-qa-scene-mismatch.json', 'video-qa', CODES.SCENE_MISMATCH],
];
for (const [file, type, expected] of denied) {
  const doc = read(DENY, file);
  const context = type === 'video-qa' ? audioContext : type === 'bgm-catalog-v2' ? { videoPlan: narratedPlan } : type === 'audio-plan-v2' ? audioContext : {};
  const found = codes(type, doc, context);
  check(`${file} rejected by ${expected}`, found.includes(expected), found.join(', '));
}
const unknownRightsPlan = clone(narratedPlan);
unknownRightsPlan.source_evidence.sources[0].rights = { status:'unknown', license:null, rights_owner:null, attribution:null, platforms:[], commercial_use:null, modification_allowed:null, evidence_ref:null };
check('QA cannot PASS while source rights remain UNKNOWN', codes('video-qa', read(DENY, 'video-qa-unknown-rights.json'), { ...audioContext, videoPlan: unknownRightsPlan }).includes(CODES.RIGHTS_BLOCKED));
for (const field of ['source_evidence','rights','figures','approval']) {
  const changed = clone(example45); changed.change_requests = [{ field, requested_value: 'user-requested-change' }];
  check(`${field} cannot be changed by a user request`, codes('video-plan-v2', changed).includes(CODES.LOCKED_FIELD));
}
const nestedLockedRequest = clone(example45);
nestedLockedRequest.change_requests = [{ field:'captions', requested_value:{ enabled:true, nested:{ rights:{ status:'verified' } } } }];
check('caption change requests cannot smuggle nested locked-field edits', codes('video-plan-v2', nestedLockedRequest).includes(CODES.LOCKED_FIELD));
const malformedRequest = clone(example45);
malformedRequest.change_requests = [{ field:'captions', requested_value:'turn captions off' }];
check('change request payloads must match their field shape', codes('video-plan-v2', malformedRequest).includes(CODES.UNSUPPORTED_FIELD));
const protectedCaptionReplacement = clone(example45);
protectedCaptionReplacement.captions.protected_exact_text = ['45 seconds'];
protectedCaptionReplacement.change_requests = [{ field:'captions', requested_value:{ protected_exact_text:['999 seconds'] } }];
check('caption requests cannot replace protected exact text', codes('video-plan-v2', protectedCaptionReplacement).includes(CODES.LOCKED_FIELD));
const reversedLoop = clone(read(ALLOW, 'bgm-catalog-v2-auto-match.json'));
reversedLoop.tracks[0].loop_points = { start_seconds:50, end_seconds:10 };
check('BGM catalog rejects reversed loop points', codes('bgm-catalog-v2', reversedLoop, { videoPlan:narratedPlan }).includes(CODES.BGM_UNSAFE));
const captionsOff = clone(narratedPlan); captionsOff.captions.enabled = false;
check('narrated video requires default-on captions', codes('video-plan-v2', captionsOff).includes(CODES.CAPTIONS_REQUIRED));

const invalidOrder = clone(example45);
invalidOrder.scenes.reverse();
invalidOrder.scenes.forEach((scene, index) => {
  scene.timing = { start_seconds:index*9, end_seconds:(index+1)*9 };
  scene.layers = scene.layers.map((layer) => ({ ...layer, timing: { ...scene.timing } }));
});
check('educational order exception requires an explicit source rationale', codes('video-plan-v2', invalidOrder).includes(CODES.EDUCATIONAL_ORDER));
invalidOrder.ordering_exception = { kind:'source_order', source_refs:['source-1'], rationale:'The supplied source is intentionally presented in its original sequence.' };
check('explicit source-order exception is allowed', !codes('video-plan-v2', invalidOrder).includes(CODES.EDUCATIONAL_ORDER));

console.log(failures === 0 ? '\nvideo-contract-v2: ALL PASS' : `\nvideo-contract-v2: ${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
