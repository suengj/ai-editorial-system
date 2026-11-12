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
  assert.equal(ev.origin_commit, 'b59d37f');
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
  for (const seq of [deck.slides.map(s=>s.beat_ids[0]),video.scenes.map(s=>s.beat_id),script.turns.map(t=>t.beat_id),audio.segments.map(s=>s.beat_id)]) assert.deepEqual(seq,ids,'beat lineage');
  assert.equal(video.source_evidence.sources[0].sha256, ev.sha256);
  assert.deepEqual(validateVideoDocument('video-plan-v2',video,{verifiedProtectedSpans:resolveLocalSourceEvidence(video)}),[]);
  for (const f of docs['spoken-forms.json'].forms) { assert(bytes.includes(Buffer.from(f.display)), `display not in source: ${f.display}`); assert(bytes.includes(Buffer.from(f.spoken)), `spoken form not in source: ${f.spoken}`); }
  for (const [name, text] of Object.entries(files)) for (const n of text.match(/\b\d{2,3},\d{3}\b/g) ?? []) assert(bytes.includes(Buffer.from(n)), `${name}: unsupported number ${n}`);
  assert.equal(audio.status, 'blocked');
  assert.match(files['brief.md'], /BLOCKED/);
  const context = {videoPlan:video, verifiedProtectedSpans:resolveLocalSourceEvidence(video), narrationScript:script};
  const scriptIssues = validateVideoDocument('narration-script-v2',script,context);
  assert.equal(scriptIssues.length,6);
  assert(scriptIssues.every(i=>i.code==='protected-value-not-source-verified'));
  assert.deepEqual(validateVideoDocument('audio-plan-v2',audio,context),[]);
}
check(original);
const altered = (name, fn) => {const c={...original}; c[name]=fn(c[name]); return c;};
assert.throws(()=>check(original, Buffer.from('tampered')));
assert.throws(()=>check(original, source, {...evidence, sha256:'0'.repeat(64)}));
for (const [doc, schema] of [[JSON.parse(original['visual-story.json']), schemas[0]], [JSON.parse(original['slide-deck.json']), schemas[1]]]) {
  delete doc.source_ref; doc.article_ref = {article_id:'a',version_number:1,content_hash:'h',claims_hash:'h'};
  assert.deepEqual(validate(doc,schema),[]); delete doc.article_ref.claims_hash; assert(validate(doc,schema).length);
}
assert.throws(()=>check(original, null));
for (const name of names) assert.throws(()=>check(altered(name,t=>t.includes('82,800') ? t.replace('82,800','82,900') : name.endsWith('.json') ? t.replace(/\}\s*$/, ',"injected":"82,900"}') : t+'\n82,900')));
for (const name of ['visual-story.json','slide-deck.json','video-plan-v2-rounding.json','narration-script-v2-rounding.json','audio-plan-v2-rounding.json']) assert.throws(()=>check(altered(name,t=>t.replace(/("beat_id":\s*"|"beat_ids":\s*\[\s*")beat-01/, '$1beat-99'))));
for (const name of ['visual-story.json','slide-deck.json']) assert.throws(()=>check(altered(name,t=>t.replace('"source_ref": {','"article_ref":{"article_id":"a","version_number":1,"content_hash":"h","claims_hash":"h"},"source_ref": {'))));
console.log('source-only lesson: PASS (blocked narration and negative cases verified)');
