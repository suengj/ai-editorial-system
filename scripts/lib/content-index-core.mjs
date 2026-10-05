/** Bounded per-content manifest registry, layered on the SUE-1300 static hub. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './yaml-lite.mjs';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');
export const ALLOWLIST = resolve(ROOT, 'contents-allowed.yaml');
export const INDEX = resolve(ROOT, 'contents-index.yaml');
export const MANIFEST_SCHEMA = resolve(ROOT, 'schemas/content-manifest.schema.json');
export const CODES = Object.freeze({ PARSE:'parse', SCHEMA:'schema', DUPLICATE:'duplicate-content-id', STALE:'stale-revision', CONFLICT:'concurrent-update-conflict', LOCATOR:'unknown-locator', ASSET:'asset-integrity', REF:'unknown-reference', AUTHORITY:'approval-disabled' });
const issue = (code, where, message) => ({ code, where, message });
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const readYaml = (path) => parseYaml(readFileSync(path, 'utf8'));
export const loadManifestSchema = () => JSON.parse(readFileSync(MANIFEST_SCHEMA, 'utf8'));

export function loadAllowed(root = ROOT, allowlist = ALLOWLIST) {
  const value = readYaml(allowlist);
  if (!Array.isArray(value?.manifests) || value.manifests.length === 0) throw new Error('allowlist must contain a non-empty manifests list');
  const unique = new Set();
  return value.manifests.map((locator) => {
    if (typeof locator !== 'string' || isAbsolute(locator) || locator.split(/[\\/]/).includes('..') || !locator.endsWith('/content.yaml')) throw new Error(`unknown locator: ${locator}`);
    if (unique.has(locator)) throw new Error(`duplicate manifest locator: ${locator}`);
    unique.add(locator);
    const path = resolve(root, locator);
    if (!path.startsWith(`${resolve(root)}/`) || !existsSync(path)) throw new Error(`unknown locator: ${locator}`);
    return { locator, path };
  });
}

export function validateManifest(manifest, manifestPath, schema = loadManifestSchema()) {
  const issues = validate(manifest, schema).map((e) => issue(CODES.SCHEMA, e.path, e.message));
  const ids = new Set((manifest?.artifacts ?? []).map((a) => a.artifact_id));
  if (ids.size !== (manifest?.artifacts ?? []).length) issues.push(issue(CODES.REF, manifestPath, 'artifact_id values must be unique within a manifest'));
  const roles = (manifest?.artifacts ?? []).map((a) => a.role);
  if (roles.filter((r) => r === 'clean_master').length !== 1) issues.push(issue(CODES.SCHEMA, manifestPath, 'exactly one clean_master artifact is required'));
  for (const [ai, artifact] of (manifest?.artifacts ?? []).entries()) {
    if (typeof artifact.locator !== 'string' || !artifact.locator.startsWith('local:') && !artifact.locator.startsWith('drive:')) {
      issues.push(issue(CODES.LOCATOR, `artifacts[${ai}].locator`, 'locator must use local: or drive: address form')); continue;
    }
    if (artifact.locator.startsWith('local:')) {
      const rel = artifact.locator.slice(6);
      const path = resolve(dirname(manifestPath), rel);
      if (isAbsolute(rel) || rel.split(/[\\/]/).includes('..') || !path.startsWith(`${resolve(dirname(manifestPath))}/`) || !existsSync(path)) {
        issues.push(issue(CODES.LOCATOR, `artifacts[${ai}].locator`, `unknown or missing local locator: ${artifact.locator}`));
      } else if (digest(readFileSync(path)) !== artifact.sha256) issues.push(issue(CODES.ASSET, `artifacts[${ai}].sha256`, `asset bytes do not match ${artifact.locator}`));
      if (artifact.locator_state !== 'PENDING_SYNC' || artifact.file_id || artifact.confirmed_sha256) issues.push(issue(CODES.LOCATOR, `artifacts[${ai}]`, 'local previews must remain PENDING_SYNC and cannot carry cloud confirmation'));
    } else if (!artifact.file_id || !artifact.confirmed_sha256 || artifact.confirmed_sha256 !== artifact.sha256) {
      // An unresolved Drive address remains PENDING_SYNC. It is valid for preview, but never cloud-ready.
      if (artifact.locator_state !== 'PENDING_SYNC') issues.push(issue(CODES.LOCATOR, `artifacts[${ai}].locator_state`, 'cloud locator requires confirmed file_id and matching bytes before CLOUD_READY'));
      if (artifact.confirmed_sha256 && artifact.confirmed_sha256 !== artifact.sha256) issues.push(issue(CODES.ASSET, `artifacts[${ai}].confirmed_sha256`, 'cloud-confirmed bytes do not match sha256'));
    } else if (artifact.locator_state !== 'CLOUD_READY') issues.push(issue(CODES.LOCATOR, `artifacts[${ai}].locator_state`, 'confirmed cloud file and bytes require CLOUD_READY'));
  }
  for (const [ti, target] of (manifest?.targets ?? []).entries()) {
    if (/^sns$/i.test(target.channel ?? '')) issues.push(issue(CODES.AUTHORITY, `targets[${ti}].channel`, 'SNS integration is not part of CONTENT-INDEX'));
    for (const id of target.media ?? []) if (!ids.has(id)) issues.push(issue(CODES.REF, `targets[${ti}].media`, `unknown artifact_id ${id}`));
    for (const field of ['caption', 'title', 'description']) {
      const value = target[field];
      if (value && (Object.hasOwn(value, 'inline') === Object.hasOwn(value, 'artifact_ref'))) issues.push(issue(CODES.REF, `targets[${ti}].${field}`, 'exactly one of inline or artifact_ref is required'));
      if (value?.artifact_ref && !ids.has(value.artifact_ref)) issues.push(issue(CODES.REF, `targets[${ti}].${field}`, `unknown text artifact_id ${value.artifact_ref}`));
    }
  }
  for (const key of Object.keys(manifest ?? {})) if (/approval|publish|published/i.test(key)) issues.push(issue(CODES.AUTHORITY, key, 'approval and publishing are disabled in CONTENT-INDEX'));
  return issues;
}

export function readManifests(root = ROOT, allowlist = ALLOWLIST) {
  const entries = loadAllowed(root, allowlist);
  const seen = new Map();
  const rows = [];
  for (const entry of entries) {
    let manifest;
    try { manifest = readYaml(entry.path); } catch (err) { throw new Error(`parse ${entry.locator}: ${err.message}`); }
    const problems = validateManifest(manifest, entry.path);
    if (problems.length) throw new Error(`${entry.locator}: ${problems.map((p) => `[${p.code}] ${p.message}`).join('; ')}`);
    if (seen.has(manifest.content_id)) throw new Error(`[${CODES.DUPLICATE}] ${manifest.content_id} at ${seen.get(manifest.content_id)} and ${entry.locator}`);
    seen.set(manifest.content_id, entry.locator);
    rows.push({ locator: entry.locator, manifest });
  }
  return rows;
}

export function buildIndex(rows, root = ROOT) {
  return { schema_version: '1.0.0', items: rows.map(({ locator, manifest }) => ({
    content_id: manifest.content_id, manifest: locator, revision: manifest.revision,
    manifest_sha256: digest(readFileSync(resolve(root, locator))), title: manifest.title,
    classification: manifest.classification, status: manifest.status,
  })).sort((a,b) => a.content_id.localeCompare(b.content_id)) };
}

/** Validate address/content identity edits against the prior revision. */
export function validateArtifactTransition(previous, next) {
  const issues = [];
  const oldById = new Map((previous?.artifacts ?? []).map((a) => [a.artifact_id, a]));
  for (const artifact of next?.artifacts ?? []) {
    const old = oldById.get(artifact.artifact_id);
    if (!old) {
      if (next.revision <= previous.revision) issues.push(issue(CODES.STALE, artifact.artifact_id, 'new artifact requires an explicit content revision bump'));
      continue;
    }
    const fileChanged = artifact.file_id && old.file_id !== artifact.file_id;
    const bytesChanged = old.sha256 !== artifact.sha256;
    if ((fileChanged || bytesChanged) && next.revision <= previous.revision) {
      issues.push(issue(CODES.STALE, artifact.artifact_id, 'new file_id or changed bytes require an explicit content revision bump'));
    }
  }
  const nextIds = new Set((next?.artifacts ?? []).map((a) => a.artifact_id));
  for (const artifact of previous?.artifacts ?? []) if (!nextIds.has(artifact.artifact_id) && next.revision <= previous.revision) {
    issues.push(issue(CODES.STALE, artifact.artifact_id, 'removing an artifact requires an explicit content revision bump'));
  }
  return issues;
}

export function assertIndexSnapshot(expected, actual) {
  if (expected !== actual) throw new Error(`[${CODES.CONFLICT}] index changed while rebuilding`);
}

export function assertPreviousRevision(indexedRevision, manifestRevision, expectedPrevious) {
  if (indexedRevision !== expectedPrevious || manifestRevision !== expectedPrevious + 1) {
    throw new Error(`[${CODES.STALE}] expected previous revision ${expectedPrevious}; index=${indexedRevision ?? 0}, manifest=${manifestRevision}`);
  }
}

const q = (s) => JSON.stringify(String(s));
export function serializeIndex(index) {
  const lines = ['schema_version: "1.0.0"', 'items:'];
  for (const item of index.items) {
    lines.push(`  - content_id: ${q(item.content_id)}`, `    manifest: ${q(item.manifest)}`, `    revision: ${item.revision}`, `    manifest_sha256: ${q(item.manifest_sha256)}`, `    title: ${q(item.title)}`, `    classification: ${q(item.classification)}`, `    status: ${q(item.status)}`);
  }
  return `${lines.join('\n')}\n`;
}
export function lookupContent(contentId, root = ROOT, allowlist = ALLOWLIST) {
  const found = readManifests(root, allowlist).filter((row) => row.manifest.content_id === contentId);
  if (found.length !== 1) throw new Error(`content lookup expected one ${contentId}, found ${found.length}`);
  return found[0];
}
