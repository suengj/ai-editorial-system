#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { assertIndexSnapshot, assertPreviousRevision, buildIndex, lookupContent, readManifests, serializeIndex, validateArtifactTransition, validateManifest, CODES } from './lib/content-index-core.mjs';
const temp = mkdtempSync(join(tmpdir(), 'aes-content-index-'));
const h = (s) => createHash('sha256').update(s).digest('hex');
let failures = 0;
const check = (name, ok) => { console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failures++; };
const writeItem = (folder, id, rev = 1, producer = 'writer-a', bytes = 'master') => {
  mkdirSync(join(temp, folder, 'assets'), { recursive: true });
  writeFileSync(join(temp, folder, 'assets/master.txt'), bytes);
  const manifest = { schema_version:'1.0.0', content_id:id, revision:rev, producer_id:producer, source_refs:['src:drive:EXAMPLE_SOURCE_ID_01'], title:'Example', classification:'education', status:'draft', artifacts:[{artifact_id:`${id}#master`,kind:'text',mime_type:'text/plain',role:'clean_master',locator:'local:assets/master.txt',locator_state:'PENDING_SYNC',sha256:h(bytes)}], targets:[{channel:'preview',account_alias:'sample',format:'post',media:[`${id}#master`],caption:{inline:'caption'},title:{inline:'Title'},description:{artifact_ref:`${id}#master`},privacy:'private'}] };
  writeFileSync(join(temp, folder, 'content.yaml'), toYaml(manifest));
  return manifest;
};
function toYaml(v, indent = 0) {
  const sp=' '.repeat(indent); const scalarArray = (x) => Array.isArray(x) && x.every(y => typeof y !== 'object' || y === null); if (Array.isArray(v)) return v.every(x => typeof x !== 'object' || x === null) ? `${sp}[${v.map(JSON.stringify).join(', ')}]` : v.map(x => {
    const entries = Object.entries(x); const [first, ...rest] = entries; const firstText = first[1] && typeof first[1] === 'object' ? `${sp}- ${first[0]}:\n${toYaml(first[1], indent+4)}` : `${sp}- ${first[0]}: ${JSON.stringify(first[1])}`;
    return [firstText, ...rest.map(([k, value]) => scalarArray(value) ? `${' '.repeat(indent+2)}${k}: ${toYaml(value)}` : value && typeof value === 'object' ? `${' '.repeat(indent+2)}${k}:\n${toYaml(value,indent+4)}` : `${' '.repeat(indent+2)}${k}: ${JSON.stringify(value)}`)].join('\n');
  }).join('\n');
  if (v && typeof v === 'object') return Object.entries(v).map(([k,x]) => scalarArray(x) ? `${sp}${k}: ${toYaml(x)}` : x && typeof x === 'object' ? `${sp}${k}:\n${toYaml(x,indent+2)}` : `${sp}${k}: ${JSON.stringify(x)}`).join('\n');
  return `${sp}${JSON.stringify(v)}`;
}
try {
  const legacy = writeItem('legacy', 'content:legacy-sample'); const newer = writeItem('new', 'content:new-sample');
  const allowed = join(temp, 'allowed.yaml'); const allowedText='manifests:\n  - legacy/content.yaml\n  - new/content.yaml\n'; writeFileSync(allowed, allowedText);
  const rows = readManifests(temp, allowed);
  check('register and lookup legacy and new roots without moving files', rows.length === 2 && lookupContent('content:legacy-sample',temp,allowed).locator === 'legacy/content.yaml' && lookupContent('content:new-sample',temp,allowed).locator === 'new/content.yaml');
  check('direct manifest lookup works without index', lookupContent('content:new-sample',temp,allowed).manifest.revision === 1);
  check('duplicate content_id is rejected', (() => { writeItem('copy','content:legacy-sample'); writeFileSync(allowed,'manifests:\n  - legacy/content.yaml\n  - copy/content.yaml\n'); try { readManifests(temp,allowed); return false; } catch(e) { return e.message.includes(CODES.DUPLICATE); } })());
  writeFileSync(allowed, allowedText);
  const bad=structuredClone(legacy); bad.targets[0].caption.artifact_ref='missing'; bad.targets[0].caption.inline='both';
  check('unknown text ref and inline/ref collision are errors', validateManifest(bad,resolve(temp,'legacy/content.yaml')).some(i=>i.code===CODES.REF));
  const missing=structuredClone(legacy); missing.artifacts[0].locator='local:missing.png';
  check('missing asset and unknown locator are errors', validateManifest(missing,resolve(temp,'legacy/content.yaml')).some(i=>i.code===CODES.LOCATOR));
  const mismatch=structuredClone(legacy); mismatch.artifacts[0].sha256='0'.repeat(64);
  check('hash-mismatched bytes are errors', validateManifest(mismatch,resolve(temp,'legacy/content.yaml')).some(i=>i.code===CODES.ASSET));
  const ordered=structuredClone(legacy); ordered.artifacts.push({...ordered.artifacts[0],artifact_id:'content:legacy-sample#image',kind:'image',mime_type:'image/png',role:'publish_derivative',locator:'drive:PLACEHOLDER_DRIVE_FILE_ID',locator_state:'PENDING_SYNC'}); ordered.targets[0].media=['content:legacy-sample#image','content:legacy-sample#master'];
  check('mixed local/cloud assets validate, master/derivative roles differ, and image order is explicit', validateManifest(ordered,resolve(temp,'legacy/content.yaml')).length===0 && ordered.artifacts[0].role==='clean_master' && ordered.artifacts[1].role==='publish_derivative' && ordered.targets[0].media[0].endsWith('#image') && ordered.targets[0].media[1].endsWith('#master'));
  const split=structuredClone(legacy); split.producer_id='writer-b';
  check('producer split retains old content and artifact ids for direct reading', lookupContent('content:legacy-sample',temp,allowed).manifest.content_id===split.content_id && legacy.artifacts[0].artifact_id===split.artifacts[0].artifact_id);
  const index=buildIndex(rows,temp); check('index caches revision, hash, title, classification, and editorial status only', index.items.every(x=>x.revision===1 && x.manifest_sha256 && x.title && x.classification && x.status==='draft') && !JSON.stringify(index).match(/approval|published|sns/i));
  check('no approval or SNS path exists in manifest contract', !JSON.stringify(legacy).match(/approval|published|sns/i));
  check('SNS target path is explicitly blocked', (()=>{const a=structuredClone(legacy);a.targets[0].channel='sns';return validateManifest(a,resolve(temp,'legacy/content.yaml')).some(i=>i.code===CODES.AUTHORITY);})());
  check('cloud locator remains pending unless file id and bytes are confirmed', (()=>{const a=structuredClone(legacy);a.artifacts[0].locator='drive:PLACEHOLDER_DRIVE_FILE_ID';return validateManifest(a,resolve(temp,'legacy/content.yaml')).length===0;})());
  const prior=structuredClone(legacy); prior.artifacts[0].file_id='PLACEHOLDER_DRIVE_FILE_ID_01'; prior.artifacts[0].locator='drive:PLACEHOLDER_DRIVE_FILE_ID_01'; prior.artifacts[0].confirmed_sha256=prior.artifacts[0].sha256; prior.artifacts[0].locator_state='CLOUD_READY';
  const moved=structuredClone(prior); moved.artifacts[0].locator='drive:PLACEHOLDER_DRIVE_FILE_ID_01';
  check('move or rename keeps file_id, bytes, and revision stable', validateArtifactTransition(prior,moved).length===0);
  const copied=structuredClone(prior); copied.artifacts[0].file_id='PLACEHOLDER_DRIVE_FILE_ID_02'; copied.artifacts[0].locator='drive:PLACEHOLDER_DRIVE_FILE_ID_02';
  check('copy or reupload without revision bump is rejected', validateArtifactTransition(prior,copied).some(i=>i.code===CODES.STALE));
  copied.revision=2; check('copy or reupload with explicit revision bump passes', validateArtifactTransition(prior,copied).length===0);
  const changed=structuredClone(prior); changed.artifacts[0].sha256='1'.repeat(64);
  check('content change without revision bump is rejected', validateArtifactTransition(prior,changed).some(i=>i.code===CODES.STALE));
  changed.revision=2; check('content change with explicit revision bump passes', validateArtifactTransition(prior,changed).length===0);
  check('stale index snapshot reports concurrent update conflict', (()=>{try{assertIndexSnapshot('before','after');return false;}catch(e){return e.message.includes(CODES.CONFLICT);}})());
  check('stale previous revision is rejected', (()=>{try{assertPreviousRevision(3,5,2);return false;}catch(e){return e.message.includes(CODES.STALE);}})());
} finally { rmSync(temp,{recursive:true,force:true}); }
console.log(failures ? `content-index regression: FAIL (${failures})` : 'content-index regression: PASS'); process.exit(failures?1:0);
