#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { validate } from './lib/json-schema-lite.mjs';
import { resolveLocalSourceEvidence, validateVideoDocument } from './lib/video-plan-core.mjs';
const root = 'examples/sue-2316/';
const read = (p) => readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const names = ['brief.md','visual-story.json','slide-deck.json','video-plan-v2-rounding.json','narration-script-v2-rounding.json','audio-plan-v2-rounding.json','spoken-forms.json'];
const original = Object.fromEntries(names.map(n => [n, read(root+n)]));
const evidence = json(root+'source/source-evidence.json');
const source = readFileSync(root+'source/lesson-facts.md');
const schemas = ['visual-story-plan','slide-deck-plan'].map(n => json(`schemas/${n}.schema.json`));
function check(files, bytes = source, ev = evidence) {
  assert(bytes && hash(bytes) === ev.sha256 && bytes.length === ev.bytes, 'source hash or length');
  assert.equal(ev.origin_commit, '710251f');
  const docs = Object.fromEntries(names.filter(n => n.endsWith('.json')).map(n => [n, JSON.parse(files[n])]));
  const story = docs['visual-story.json'], deck = docs['slide-deck.json'], video = docs['video-plan-v2-rounding.json'], script = docs['narration-script-v2-rounding.json'], audio = docs['audio-plan-v2-rounding.json'];
  for (const [doc,schema] of [[story,schemas[0]],[deck,schemas[1]]]) {
    assert.deepEqual(validate(doc,schema), [], 'plan schema');
    assert.equal(doc.source_ref.sha256, ev.sha256);
    assert.equal(doc.source_ref.path, root+'source/lesson-facts.md');
    for (const sp of doc.source_ref.spans) assert.equal(hash(bytes.subarray(sp.byte_start,sp.byte_end)), sp.sha256, 'span hash');
  }
  assert.deepEqual(story.source_ref, deck.source_ref);
  const ids = story.beats.map(b => b.beat_id);
  assert.deepEqual(ids, Array.from({length:6},(_,i)=>`beat-0${i+1}`));
  assert.deepEqual(deck.slides.map(s=>s.beat_ids[0]), ids, 'slide beat lineage');
  const sceneBeats = ['beat-01','beat-02','beat-02','beat-03','beat-04','beat-05','beat-05','beat-06','beat-06'];
  for (const seq of [video.scenes.map(s=>s.beat_id),script.turns.map(t=>t.beat_id),audio.segments.map(s=>s.beat_id)]) assert.deepEqual(seq,sceneBeats,'scene beat lineage');
  const sceneIds = video.scenes.map(s=>s.scene_id);
  assert.deepEqual(sceneIds, ['scene-01','scene-02a','scene-02b','scene-03','scene-04','scene-05a','scene-05b','scene-06a','scene-06b']);
  for (const seq of [script.turns.map(t=>t.scene_id), audio.segments.map(s=>s.scene_id), audio.captions.segments.map(s=>s.scene_id)]) assert.deepEqual(seq,sceneIds,'scene lineage');
  for (const scene of video.scenes) assert(ids.includes(scene.beat_id) && deck.slides.some(slide=>slide.beat_ids.includes(scene.beat_id)), 'scene linked to story and slide');
  assert.equal(video.source_evidence.sources[0].sha256, ev.sha256);
  const videoIssues = validateVideoDocument('video-plan-v2',video,{verifiedProtectedSpans:resolveLocalSourceEvidence(video)});
  assert.deepEqual(videoIssues, []);
  for (const f of docs['spoken-forms.json'].forms) { assert(bytes.includes(Buffer.from(f.display)), `display not in source: ${f.display}`); assert(bytes.includes(Buffer.from(f.spoken)), `spoken form not in source: ${f.spoken}`); }
  for (const [name, text] of Object.entries(files)) for (const n of text.match(/\b\d{2,3},\d{3}\b/g) ?? []) assert(bytes.includes(Buffer.from(n)), `${name}: unsupported number ${n}`);
  assert.equal(audio.status, 'script_checked');
  assert.equal(audio.measurement.measured_audio_duration_seconds, null);
  assert.equal(audio.captions.alignment_status, 'not_yet');
  assert.equal(video.approval.status, 'pending');
  const context = {videoPlan:video, verifiedProtectedSpans:resolveLocalSourceEvidence(video), narrationScript:script};
  const scriptIssues = validateVideoDocument('narration-script-v2',script,context);
  assert.deepEqual(scriptIssues, []);
  const locked = source.toString('utf8').split('## Locked narration (approved wording, ko)')[1].split('## 출처와 권리')[0];
  const lines = [...locked.matchAll(/^(beat-0[1-6])\.([1-3]): (.+)$/gm)];
  assert.equal(lines.length, 13);
  for (const [sceneId, lineNumbers] of Object.entries({'scene-02a':[1], 'scene-02b':[2], 'scene-05a':[1], 'scene-05b':[2], 'scene-06a':[1,2], 'scene-06b':[3]})) {
    const turn = script.turns.find(t=>t.scene_id === sceneId);
    assert.deepEqual(turn.evidence_span_ids, lineNumbers.map(n=>`evidence-${turn.beat_id}-line-${n}`), 'split at locked narration lines');
  }
  const cited = script.turns.flatMap(turn => turn.evidence_span_ids.map(id => ({beat: turn.beat_id, span: video.source_evidence.sources[0].evidence_spans.find(s => s.span_id === id)})));
  assert.deepEqual(cited.map(({beat,span}) => [beat,span.exact_text]), lines.map(m => [m[1],m[3]]));
  assert(video.target_duration_seconds >= 55 && video.target_duration_seconds <= 65);
  for (const segment of audio.segments) {
    const scene = video.scenes.find(s=>s.scene_id === segment.scene_id);
    const syllables = (segment.spoken_text.match(/[가-힣]/g) ?? []).length;
    assert(Math.abs(segment.target_duration_seconds - (scene.timing.end_seconds - scene.timing.start_seconds)) < 1e-9);
    assert(segment.target_duration_seconds >= syllables / 4.7 + segment.pause_after_ms / 1000);
  }
  assert.deepEqual(validateVideoDocument('audio-plan-v2',audio,context),[]);
}
check(original);
const tooLong = JSON.parse(original['video-plan-v2-rounding.json']);
tooLong.scenes[0].timing.end_seconds = 12.5;
assert(validateVideoDocument('video-plan-v2', tooLong, {verifiedProtectedSpans:resolveLocalSourceEvidence(tooLong)}).some(i => i.message === 'scene scene-01 exceeds effective preset maximum 12s'), '12.5-second scene must fail the preset gate');
const altered = (name, fn) => {const c={...original}; c[name]=fn(c[name]); return c;};
assert.throws(()=>check(original, Buffer.from('tampered')));
assert.throws(()=>check(original, source, {...evidence, sha256:'0'.repeat(64)}));
for (const [doc, schema] of [[JSON.parse(original['visual-story.json']), schemas[0]], [JSON.parse(original['slide-deck.json']), schemas[1]]]) {
  delete doc.source_ref; doc.article_ref = {article_id:'a',version_number:1,content_hash:'h',claims_hash:'h'};
  assert.deepEqual(validate(doc,schema),[]); delete doc.article_ref.claims_hash; assert(validate(doc,schema).length);
}
assert.throws(()=>check(original, null));
const mutatedScript = JSON.parse(original['narration-script-v2-rounding.json']);
mutatedScript.turns[0].spoken_text = mutatedScript.turns[0].spoken_text.replace('두 경기장', '세 경기장');
const video = JSON.parse(original['video-plan-v2-rounding.json']);
assert(validateVideoDocument('narration-script-v2', mutatedScript, {videoPlan: video, verifiedProtectedSpans: resolveLocalSourceEvidence(video)}).some(i => i.code === 'protected-value-not-source-verified'));
assert.throws(()=>check({...original, 'narration-script-v2-rounding.json': JSON.stringify(mutatedScript)}));
for (const name of names) assert.throws(()=>check(altered(name,t=>t.includes('82,800') ? t.replace('82,800','82,900') : name.endsWith('.json') ? t.replace(/\}\s*$/, ',"injected":"82,900"}') : t+'\n82,900')));
for (const name of ['visual-story.json','slide-deck.json','video-plan-v2-rounding.json','narration-script-v2-rounding.json','audio-plan-v2-rounding.json']) assert.throws(()=>check(altered(name,t=>t.replace(/("beat_id":\s*"|"beat_ids":\s*\[\s*")beat-01/, '$1beat-99'))));
for (const name of ['visual-story.json','slide-deck.json']) assert.throws(()=>check(altered(name,t=>t.replace('"source_ref": {','"article_ref":{"article_id":"a","version_number":1,"content_hash":"h","claims_hash":"h"},"source_ref": {'))));
console.log('source-only lesson: PASS (source-verified narration and negative cases verified)');
