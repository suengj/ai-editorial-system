import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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
  BGM_OFF_HAS_TRACKS: 'bgm-off-has-tracks',
  BGM_SELECTED_EMPTY: 'bgm-selected-empty',
});

const issue = (code, where, message) => ({ code, where, message });

export function validateVideoDocument(kind, doc) {
  const issues = validate(doc, loadVideoSchema(kind));
  if (issues.length) return issues.map((e) => issue(CODES.SCHEMA, doc?.plan_id ?? doc?.script_id ?? doc?.catalog_id ?? '<document>', `${e.path}: ${e.message}`));
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
  return issues;
}
