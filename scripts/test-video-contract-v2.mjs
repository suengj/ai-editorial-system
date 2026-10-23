#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, loadVideoSchema, resolveLocalSourceEvidence, validateVideoDocument } from './lib/video-plan-core.mjs';
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
check('required 2.0 video/audio/BGM/QA fixtures are present', v2AllowFiles.length === 17, v2AllowFiles.join(', '));
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
for (const [family, file] of [
  ['educational-summary', 'video-plan-v2-revision2-educational-summary.json'],
  ['interactive-information', 'video-plan-v2-revision2-interactive-information.json'],
  ['narrated-explainer', 'video-plan-v2-revision2-narrated-explainer.json'],
]) {
  const plan = read(ALLOW, file);
  const firstSceneDuration = plan.scenes[0].timing.end_seconds - plan.scenes[0].timing.start_seconds;
  check(`${family} has a passing revision 2 example with a bounded hook inside scene 1`,
    plan.profile_ref.profile_id === `video/${family}` && plan.profile_ref.revision === 2
      && plan.render_requirements.hook_end_seconds > 0
      && plan.render_requirements.hook_end_seconds <= 1.5
      && plan.render_requirements.hook_end_seconds <= firstSceneDuration
      && firstSceneDuration >= 2.5
      && validateVideoDocument('video-plan-v2', plan, { verifiedProtectedSpans: resolveLocalSourceEvidence(plan) }).length === 0);
}

const manifest = JSON.parse(readFileSync(resolve(ROOT, 'editorial/entry-manifest.json'), 'utf8'));
const profiles = manifest.video_profiles;
const profileSchema = JSON.parse(readFileSync(resolve(ROOT, 'schemas/video-profile.schema.json'), 'utf8'));
check('manifest pins exactly the three registered video families', Object.keys(profiles).sort().join() === 'video/educational-summary,video/interactive-information,video/narrated-explainer');
for (const [id, pin] of Object.entries(profiles)) {
  const profile = read(ROOT, pin.path);
  check(`${id} validates and matches its exact ID/revision/hash`, validate(profile, profileSchema).length === 0 && profile.profile_id === id && profile.revision === pin.revision && createHash('sha256').update(readFileSync(resolve(ROOT, pin.path))).digest('hex') === pin.sha256);
  const planFile = id.endsWith('educational-summary') ? 'video-plan-v2-example-45s.json' : id.endsWith('interactive-information') ? 'video-plan-v2-interactive-hybrid.json' : 'video-plan-v2-narrated-mixed.json';
  const plan = read(ALLOW, planFile);
  check(`${id} plan carries the exact manifest SHA pin`, plan.profile_ref.profile_id === id && plan.profile_ref.revision === pin.revision && plan.profile_ref.sha256 === pin.sha256);
}
for (const [id,pin] of Object.entries(manifest.video_style_profiles ?? {})) { const bytes=readFileSync(resolve(ROOT,pin.path)); const profile=JSON.parse(bytes); check(`${id} revision 2 style profile validates and matches its byte pin`, validate(profile,profileSchema).length===0 && profile.revision===2 && createHash('sha256').update(bytes).digest('hex')===pin.sha256); }
const genreSchema = JSON.parse(readFileSync(resolve(ROOT, 'schemas/video-genre-preset.schema.json'), 'utf8'));
check('manifest pins the six additive genre presets', Object.keys(manifest.video_genre_presets ?? {}).sort().join() === ['video-genre/data-journalism','video-genre/learning','video-genre/math-lecture','video-genre/motion-design','video-genre/science-explainer','video-genre/shortform-native'].sort().join());
for (const [id, pin] of Object.entries(manifest.video_genre_presets ?? {})) {
  const bytes = readFileSync(resolve(ROOT, pin.path)); const preset = JSON.parse(bytes);
  check(`${id} validates against its base family and byte pin`, validate(preset, genreSchema).length === 0 && preset.profile_id === id && preset.base_profile_id === pin.base_profile_id && createHash('sha256').update(bytes).digest('hex') === pin.sha256 && Boolean(profiles[pin.base_profile_id]));
}
const critiqueSchema = loadVideoSchema('video-critique');
const critique = read(ROOT, 'schemas/examples/video/allow/video-critique-pass.json');
check('frame-sample critique wrapper carries an upstream-compatible render StageResult', validate(critique, critiqueSchema).length === 0);
const badCritique = clone(critique); badCritique.frame_samples[0].checklist[0].result = 'uncertain';
check('critique checklist rejects non pass/fail output', validate(badCritique, critiqueSchema).length > 0);
const critiqueBytes=readFileSync(resolve(ROOT,'schemas/examples/video/allow/video-critique-pass.json'));
const upstreamStageSchema=JSON.parse(readFileSync(resolve(ROOT,'schemas/vendor/shorts-gen-6d24e8c/stage-result.schema.json'),'utf8'));
check('critique StageResult validates against pinned shorts_gen upstream schema', validate(critique.stage_result,upstreamStageSchema).length===0 && createHash('sha256').update(readFileSync(resolve(ROOT,'schemas/vendor/shorts-gen-6d24e8c/stage-result.schema.json'))).digest('hex')==='1718e299953abe9ac3cc6c4d9934acb1adbf3604b729e7795ab253a3f1945631');
const badProfile=clone(read(ROOT,manifest.video_style_profiles['video/educational-summary'].path)); badProfile.motion.scene_length_seconds.mim=0.8;
check('profile schema rejects misspelled nested motion settings', validate(badProfile,profileSchema).length>0);
const badPreset=clone(read(ROOT,manifest.video_genre_presets['video-genre/shortform-native'].path)); badPreset.overrides.motion.scene_length_seconds.maximum=2;
check('genre schema rejects misspelled nested override settings', validate(badPreset,genreSchema).length>0);
const emptyPreset=clone(badPreset); emptyPreset.overrides={};
check('genre schema rejects empty override objects', validate(emptyPreset,genreSchema).length>0);
const emptyMotion=clone(badPreset); emptyMotion.overrides.motion={};
check('genre schema rejects empty nested override sections', validate(emptyMotion,genreSchema).length>0);
const emptyProfileSection=clone(read(ROOT,manifest.video_style_profiles['video/educational-summary'].path)); emptyProfileSection.motion={};
check('profile schema rejects empty nested profile sections', validate(emptyProfileSection,profileSchema).length>0);
const badGatePlan = read(ROOT, 'schemas/examples/video/deny/video-plan-v2-quality-gate.json');
check('quality gate deny fixture fails measured plan contract checks', codes('video-plan-v2', badGatePlan).includes(CODES.VIDEO_QUALITY_GATE));
const gateMessages = (plan) => validateVideoDocument('video-plan-v2', plan).filter((item) => item.code === CODES.VIDEO_QUALITY_GATE).map((item) => item.message);
const qualityCase = clone(badGatePlan);
const gateCase = (name, mutate, expected) => { const testPlan=clone(qualityCase); mutate(testPlan); check(name, gateMessages(testPlan).some((message)=>message.includes(expected))); };
gateCase('hook interval cannot exceed the profile hook maximum', p => { p.render_requirements.hook_end_seconds=1.6; }, 'hook interval exceeds 1.5s');
gateCase('hook interval must end inside scene 1', p => { p.scenes[0].timing.end_seconds=1; p.render_requirements.hook_end_seconds=1.2; }, 'exceeds scene 1 duration 1s');
gateCase('hook interval must have a positive end offset', p => { p.render_requirements.hook_end_seconds=0; }, 'positive hook interval within scene 1');
const missingHookInterval=clone(qualityCase); delete missingHookInterval.render_requirements.hook_end_seconds;
check('revision 2 render requirements require a bounded hook interval declaration', codes('video-plan-v2', missingHookInterval).includes(CODES.SCHEMA));
gateCase('revision 2 quality profiles require the render requirements block', p => { delete p.render_requirements; }, 'require quality_gates and render_requirements');
gateCase('scene maximum duration gate is checked independently', p => { p.scenes[1].timing.end_seconds=22; p.scenes[1].layers[0].timing.end_seconds=22; }, 'exceeds effective preset maximum');
gateCase('caption coverage rejects missing planned text samples', p => { p.captions.planned_segments=[{scene_id:'scene-1',exact_text:'Caption text'}]; }, 'cover every planned caption');
gateCase('revision 2 plans cannot omit the planned caption source list', p => { p.captions.enabled=true; }, 'require captions.planned_segments');
gateCase('caption length gate rejects excess characters', p => { p.captions.planned_segments=[{scene_id:'scene-1',exact_text:'123456789012345'}]; p.render_requirements.caption_samples=[{scene_id:'scene-1',exact_text:'123456789012345',lines:['123456789012345']}]; }, 'exceeds line or character limits');
gateCase('caption wrapping gate rejects changed word boundaries', p => { p.captions.planned_segments=[{scene_id:'scene-1',exact_text:'Keep words intact'}]; p.render_requirements.caption_samples=[{scene_id:'scene-1',exact_text:'Keep words intact',lines:['Keep words','not intact']}]; }, 'breaks a word boundary');
gateCase('contrast gate rejects low contrast', p => { p.render_requirements.min_contrast_ratio=3.2; }, 'declared minimum contrast');
gateCase('safe margin gate rejects insufficient bottom margin', p => { p.render_requirements.safe_margins.bottom=0; }, 'bottom safe margin');
gateCase('integrated loudness gate rejects out of range level', p => { p.render_requirements.integrated_loudness_lufs=-19; }, 'integrated loudness');
gateCase('BGM loudness gate rejects out of range level', p => { p.render_requirements.bgm_loudness_lufs=-16; }, 'BGM loudness');
gateCase('ducking gate rejects mismatched attenuation', p => { p.render_requirements.ducking_db=-2; }, 'narration ducking');
gateCase('true peak gate rejects excessive peak', p => { p.render_requirements.true_peak_dbtp=0; }, 'true peak exceeds');
gateCase('SFX gate rejects nonsemantic events', p => { p.render_requirements.sfx_events=[{scene_id:'scene-1',semantic_only:true,semantic_role:'none'}]; }, 'must serve a declared semantic role');
const shortformPlan=clone(qualityCase); const shortformPin=manifest.video_style_profiles['video/interactive-information'];
shortformPlan.profile_ref={profile_id:'video/interactive-information',revision:shortformPin.revision,sha256:shortformPin.sha256};
shortformPlan.genre_preset_ref={profile_id:'video-genre/shortform-native',revision:manifest.video_genre_presets['video-genre/shortform-native'].revision,sha256:manifest.video_genre_presets['video-genre/shortform-native'].sha256};
shortformPlan.scenes[0].timing={start_seconds:0,end_seconds:0.7}; shortformPlan.scenes[0].layers[0].timing={start_seconds:0,end_seconds:0.7};
check('genre override is applied before scene validation and rejects below its 0.8s effective minimum', gateMessages(shortformPlan).some((message)=>message.includes('effective preset minimum 0.8s')));
const shortformValid=clone(shortformPlan); shortformValid.scenes[0].timing={start_seconds:0,end_seconds:1.2}; shortformValid.scenes[0].layers[0].timing={start_seconds:0,end_seconds:1.2}; shortformValid.scenes[1].timing={start_seconds:1.2,end_seconds:2.7}; shortformValid.scenes[1].layers[0].timing={start_seconds:1.2,end_seconds:2.7}; shortformValid.render_requirements.hook_duration_seconds=1.2;
check('shortform 1.5s scene is judged by its genre range instead of the 2.5s family minimum', !gateMessages(shortformValid).some((message)=>message.includes('scene scene-2 is shorter than effective preset minimum')));
const shortformTooLong=clone(shortformPlan); shortformTooLong.scenes[1].timing={start_seconds:1,end_seconds:6}; shortformTooLong.scenes[1].layers[0].timing={start_seconds:1,end_seconds:6};
check('shortform five-second scenes fail the effective two-second genre maximum', gateMessages(shortformTooLong).some((message)=>message.includes('scene scene-2 exceeds effective preset maximum 2s')));
const legacyGenrePlan=clone(read(ALLOW,'video-plan-v2-interactive-hybrid.json'));
legacyGenrePlan.genre_preset_ref={profile_id:'video-genre/shortform-native',revision:manifest.video_genre_presets['video-genre/shortform-native'].revision,sha256:manifest.video_genre_presets['video-genre/shortform-native'].sha256};
check('the unchanged three-scene, five-second revision 1 fixture explicitly rejects a correctly pinned genre preset', codes('video-plan-v2',legacyGenrePlan).some((code)=>code===CODES.VIDEO_QUALITY_GATE) && validateVideoDocument('video-plan-v2',legacyGenrePlan).some((item)=>item.message.includes('genre presets require a revision 2 style profile')));


const landscape = read(ALLOW, 'video-plan-v2-silent-60s-16-9.json');
const portrait = read(ALLOW, 'video-plan-v2-silent-60s-9-16.json');
check('60-second source-only landscape has no editorial package or fabricated article/claim', landscape.target_duration_seconds === 60 && landscape.aspect_ratio === '16:9' && landscape.scenes.every((s) => s.source_only) && !('editorial_package_ref' in landscape) && !('article_id' in landscape) && !('claim' in landscape));
check('60-second source-only portrait has no editorial package or fabricated article/claim', portrait.target_duration_seconds === 60 && portrait.aspect_ratio === '9:16' && portrait.scenes.every((s) => s.source_only) && !('editorial_package_ref' in portrait) && !('article_id' in portrait) && !('claim' in portrait));
const example45 = read(ALLOW, 'video-plan-v2-example-45s.json');
check('45-second educational example uses the profile default beat order', example45.target_duration_seconds === 45 && example45.scenes.map((s) => s.function).join() === 'hook,concept,example,worked_solution,key_takeaway');
const legacyV2Hashes={
  'schemas/examples/video/allow/video-plan-v2-example-45s.json':'0d72e21093b497ffd3999052853cf563fd6d2a9b5eaf3f3dd3d3e2b4589274ee',
  'schemas/examples/video/allow/video-plan-v2-interactive-hybrid.json':'12f9503571cae8a90d383b7dc6ef465d477ecf5f50fe65aab2279147dcc62f7b',
  'schemas/examples/video/allow/video-plan-v2-interactive-sequential.json':'054f9e4073e9770d6a84f082f0a93386e13118f7500bf908244bace54bf502bd',
  'schemas/examples/video/allow/video-plan-v2-interactive-simultaneous.json':'dd3fc0c2f8d767f577be827fd0fef84a46d5cd0ff1b29e2904196cab645c31ac',
  'schemas/examples/video/allow/video-plan-v2-narrated-mixed.json':'b2623d3e3ce2afde853b18d7f0855b6e3756b28797bcd31ffb9e815f486f1148',
  'schemas/examples/video/allow/video-plan-v2-silent-60s-16-9.json':'07fe06b29df3757c57ffd6887e3a53650ed871de58b09c35d8d26a7b14d5a9e3',
  'schemas/examples/video/allow/video-plan-v2-silent-60s-9-16.json':'5a6c8ec01b8936cb3d26c466071a68e82177106c87319aa2af989df4dd8a4803',
  'schemas/examples/video/deny/video-plan-v2-locked-rights-change.json':'f9e470e4d4c7e4f83ffd806d465e9afc329984a2c93c9de054365a4d85e9b9fd',
  'schemas/examples/video/deny/video-plan-v2-missing-source.json':'a2d0f08691600f4b93f4d62b250ebc0ac3d31b25d2571ae3dd49323f6a597e43',
  'schemas/examples/video/deny/video-plan-v2-unsupported-field.json':'138ceb542bda7e3c0b8de8aec1cfd09709e631f88a24889b24a2a65b669c9bda',
  'editorial/profiles/video/educational-summary.json':'52958745b4033174373a99e952349de9779577d2bc0343a98bea33906ba348b3',
  'editorial/profiles/video/interactive-information.json':'f53bb623c189a9d2d0de0ebc9ce26027b558d751b4561f422f875886c5667a35',
  'editorial/profiles/video/narrated-explainer.json':'59508120c531cb4578cf119aa91ad01566317e76d1872c8ee79b5a5cfbccb099'
};
check('all origin/main v2 plans and family profiles remain byte-identical', Object.entries(legacyV2Hashes).every(([path,hash])=>createHash('sha256').update(readFileSync(resolve(ROOT,path))).digest('hex')===hash));
check('origin/main v2 example and family profile retain their original byte pins and validate without opt-in quality fields', createHash('sha256').update(readFileSync(resolve(ALLOW, 'video-plan-v2-example-45s.json'))).digest('hex') === '0d72e21093b497ffd3999052853cf563fd6d2a9b5eaf3f3dd3d3e2b4589274ee' && validate(example45, JSON.parse(readFileSync(resolve(ROOT, 'schemas/video-plan-v2.schema.json')))).length === 0 && !('render_requirements' in example45));
check('legacy family profile shape remains valid unchanged', validate(read(ROOT, 'editorial/profiles/video/educational-summary.json'), profileSchema).length === 0 && createHash('sha256').update(readFileSync(resolve(ROOT, 'editorial/profiles/video/educational-summary.json'))).digest('hex') === '52958745b4033174373a99e952349de9779577d2bc0343a98bea33906ba348b3');
const badGenrePin = clone(example45); badGenrePin.genre_preset_ref = { profile_id:'video-genre/motion-design', revision:1, sha256:'0'.repeat(64) };
check('video plan rejects a stale or mismatched genre preset pin', codes('video-plan-v2', badGenrePin).includes(CODES.PROFILE_PIN));
const mathLecturePlan = clone(read(ALLOW, 'video-plan-v2-revision2-educational-summary.json'));
const mathLecturePin = manifest.video_genre_presets['video-genre/math-lecture'];
mathLecturePlan.genre_preset_ref = { profile_id:'video-genre/math-lecture', revision:mathLecturePin.revision, sha256:mathLecturePin.sha256 };
check('revision 2 video plan accepts the exactly pinned math-lecture genre preset', codes('video-plan-v2', mathLecturePlan).length === 0);
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
