/**
 * Journey envelope — SUE-790.
 *
 * This module validates and reads a reference envelope. It deliberately has
 * no writer, renderer, materializer, publisher, deployment, or approval-grant
 * operation. Owner decisions and downstream outcomes are recorded only by
 * immutable references and digests.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { classifyArtifact } from './lineage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
export const SCHEMA_PATH = resolve(ROOT, 'schemas/journey-envelope.schema.json');

export const loadSchema = (path = SCHEMA_PATH) => parseJourneyJson(readFileSync(path), path);

export const PROGRESS_STATES = Object.freeze([
  'RECEIVED',
  'SELECTED',
  'DRAFT_READY',
  'IN_REVIEW',
  'APPROVED_REVISION',
  'ASSETS_LOCKED',
  'PUBLISH_ACCEPTED',
  'SOURCE_COMMITTED',
  'ARTIFACT_DEPLOYED',
  'LIVE_VERIFIED',
]);

export const INTERRUPT_STATES = Object.freeze([
  'NEEDS_EVIDENCE',
  'NO_ARTICLE',
  'BLOCKED_AUTH',
  'BLOCKED_TRANSPORT',
  'STALE_REVISION',
  'MEDIA_DIGEST_MISMATCH',
  'ARTICLE_ANCHOR_MISSING',
  'GIT_CONCURRENT_UPDATE',
  'DEPLOYMENT_PARTIAL',
]);

export const CODES = Object.freeze({
  HANDOFF_INVALID: 'HANDOFF_INVALID',
  STALE_REVISION: 'STALE_REVISION',
  MEDIA_DIGEST_MISMATCH: 'MEDIA_DIGEST_MISMATCH',
  ARTICLE_ANCHOR_MISSING: 'ARTICLE_ANCHOR_MISSING',
  GIT_CONCURRENT_UPDATE: 'GIT_CONCURRENT_UPDATE',
  DEPLOYMENT_PARTIAL: 'DEPLOYMENT_PARTIAL',
  NEEDS_EVIDENCE: 'NEEDS_EVIDENCE',
  NO_ARTICLE: 'NO_ARTICLE',
  BLOCKED_AUTH: 'BLOCKED_AUTH',
  BLOCKED_TRANSPORT: 'BLOCKED_TRANSPORT',
  DERIVED_EVIDENCE: 'derived-evidence-role',
  SELECTION_REQUIRED: 'SELECTION_REQUIRED',
});

/**
 * One declarative authority table covers every external record pointer. A new
 * pointer must be added here to become validator-trusted.
 */
export const REFERENCE_AUTHORITIES = Object.freeze([
  Object.freeze({ name: 'candidate ledger', path: Object.freeze(['candidate', 'ledger_ref']), repository: 'suengj/intelligence-library', exactPath: 'intelligence/candidates/ledger.json' }),
  Object.freeze({ name: 'dossier', path: Object.freeze(['dossier']), repository: 'suengj/intelligence-library' }),
  Object.freeze({ name: 'editorial review', path: Object.freeze(['review_ref']), repository: 'suengj/ai-editorial-system' }),
  Object.freeze({ name: 'handoff receipt', path: Object.freeze(['handoff_receipt_ref']), repository: 'suengj/ai-editorial-system' }),
  Object.freeze({ name: 'publish approval', path: Object.freeze(['approved_revision', 'record_ref']), repository: 'suengj/suengj-com' }),
  Object.freeze({ name: 'visual approval', path: Object.freeze(['asset_bindings', '*', 'visual_approval', 'record_ref']), repository: 'suengj/ai-editorial-system' }),
  Object.freeze({ name: 'publish run', path: Object.freeze(['publish_run', 'record_ref']), repository: 'suengj/suengj-com' }),
  Object.freeze({ name: 'source commit', path: Object.freeze(['source_commit']), repository: 'suengj/suengj-com' }),
  Object.freeze({ name: 'deployment', path: Object.freeze(['deployed_artifact', 'record_ref']), repository: 'suengj/suengj-com' }),
  Object.freeze({ name: 'live verification', path: Object.freeze(['live_verification_ref']), repository: 'suengj/suengj-com' }),
  Object.freeze({ name: 'interruption reason', path: Object.freeze(['interruption', 'reason_ref']), repository: 'suengj/ai-editorial-system' }),
]);

const PROGRESS_INDEX = new Map(PROGRESS_STATES.map((state, index) => [state, index]));
const INTERRUPT_MINIMUM = Object.freeze({
  NEEDS_EVIDENCE: 'RECEIVED',
  NO_ARTICLE: 'SELECTED',
  BLOCKED_AUTH: 'SELECTED',
  BLOCKED_TRANSPORT: 'SELECTED',
  STALE_REVISION: 'APPROVED_REVISION',
  MEDIA_DIGEST_MISMATCH: 'ASSETS_LOCKED',
  ARTICLE_ANCHOR_MISSING: 'ASSETS_LOCKED',
  GIT_CONCURRENT_UPDATE: 'PUBLISH_ACCEPTED',
  DEPLOYMENT_PARTIAL: 'SOURCE_COMMITTED',
});

const RESUME_OPERATIONS = Object.freeze({
  NEEDS_EVIDENCE: 'inspectEvidence',
  BLOCKED_AUTH: 'inspectAuthority',
  BLOCKED_TRANSPORT: 'inspectTransport',
  STALE_REVISION: 'inspectApproval',
  MEDIA_DIGEST_MISMATCH: 'inspectReceipt',
  ARTICLE_ANCHOR_MISSING: 'inspectReceipt',
  GIT_CONCURRENT_UPDATE: 'inspectSource',
  DEPLOYMENT_PARTIAL: 'inspectDeployment',
});

const issue = (code, where, message) => ({ code, where, message });
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const sha256Json = (value) => createHash('sha256')
  .update(JSON.stringify(canonical(value)), 'utf8')
  .digest('hex');
const present = (value) => value !== undefined;
const meaningful = (value) => typeof value === 'string' && value.trim().length > 0;

function duplicateKeyPath(serialized) {
  let cursor = 0;
  const whitespace = () => {
    while (/\s/.test(serialized[cursor] ?? '')) cursor += 1;
  };
  const stringToken = () => {
    const start = cursor;
    cursor += 1;
    while (cursor < serialized.length) {
      if (serialized[cursor] === '\\') {
        cursor += 2;
        continue;
      }
      if (serialized[cursor] === '"') {
        cursor += 1;
        return JSON.parse(serialized.slice(start, cursor));
      }
      cursor += 1;
    }
    return '';
  };
  const value = (path) => {
    whitespace();
    if (serialized[cursor] === '{') return object(path);
    if (serialized[cursor] === '[') return array(path);
    if (serialized[cursor] === '"') {
      stringToken();
      return null;
    }
    while (cursor < serialized.length && !/[\s,}\]]/.test(serialized[cursor])) cursor += 1;
    return null;
  };
  const object = (path) => {
    cursor += 1;
    whitespace();
    const keys = new Set();
    if (serialized[cursor] === '}') {
      cursor += 1;
      return null;
    }
    while (cursor < serialized.length) {
      whitespace();
      if (serialized[cursor] !== '"') return null;
      const key = stringToken();
      const keyPath = `${path}.${key}`;
      if (keys.has(key)) return keyPath;
      keys.add(key);
      whitespace();
      if (serialized[cursor] !== ':') return null;
      cursor += 1;
      const nested = value(keyPath);
      if (nested) return nested;
      whitespace();
      if (serialized[cursor] === '}') {
        cursor += 1;
        return null;
      }
      if (serialized[cursor] !== ',') return null;
      cursor += 1;
    }
    return null;
  };
  const array = (path) => {
    cursor += 1;
    whitespace();
    let index = 0;
    if (serialized[cursor] === ']') {
      cursor += 1;
      return null;
    }
    while (cursor < serialized.length) {
      const nested = value(`${path}[${index}]`);
      if (nested) return nested;
      whitespace();
      if (serialized[cursor] === ']') {
        cursor += 1;
        return null;
      }
      if (serialized[cursor] !== ',') return null;
      cursor += 1;
      index += 1;
    }
    return null;
  };
  return value('$');
}

/** Parse raw JSON while refusing ambiguous duplicate object keys. */
export function parseJourneyJson(serialized, label = '$') {
  const text = Buffer.isBuffer(serialized) ? serialized.toString('utf8') : serialized;
  if (typeof text !== 'string') {
    const error = new TypeError(`${label} must be supplied as raw JSON bytes or text`);
    error.code = CODES.HANDOFF_INVALID;
    throw error;
  }
  let duplicate;
  try {
    duplicate = duplicateKeyPath(text);
  } catch (cause) {
    const error = new SyntaxError(`${label} is not valid JSON: ${cause.message}`);
    error.code = CODES.HANDOFF_INVALID;
    throw error;
  }
  if (duplicate) {
    const error = new SyntaxError(`${label} contains duplicate JSON key ${duplicate}`);
    error.code = CODES.HANDOFF_INVALID;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (cause) {
    const error = new SyntaxError(`${label} is not valid JSON: ${cause.message}`);
    error.code = CODES.HANDOFF_INVALID;
    throw error;
  }
}

/** Canonical digest used by every record_ref.content_sha256 check. */
export function canonicalRecordSha256(record) {
  return sha256Json(record);
}

export function assetDigestSetHash(assetDigests) {
  return createHash('sha256').update(JSON.stringify(assetDigests), 'utf8').digest('hex');
}

function exactArticleTuple(articleRef) {
  return {
    article_id: articleRef?.article_id,
    version_number: articleRef?.version_number,
    content_hash: articleRef?.content_hash,
    claims_hash: articleRef?.claims_hash,
  };
}

/** Digest written beside an external approval at decision time. */
export function approvalBindingSha256(articleRef, orderedAssetDigests) {
  return sha256Json({
    format_version: 'journey-approval-binding/1',
    article_revision: exactArticleTuple(articleRef),
    ordered_asset_digests: orderedAssetDigests,
  });
}

/** Cross-binds the selected candidate, exact dossier revision, and article. */
export function journeyBindingSha256(candidate, dossier, articleRef) {
  return sha256Json({
    format_version: 'journey-identity-binding/1',
    candidate,
    dossier,
    article_ref: articleRef,
  });
}

function validRelativePath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') &&
    !path.includes('\\') && !path.split('/').some((part) => part === '..' || part === '');
}

function validCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function walkFileRefs(value, path = '$', out = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkFileRefs(entry, `${path}[${index}]`, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (Object.hasOwn(value, 'repository') && Object.hasOwn(value, 'commit') &&
      Object.hasOwn(value, 'path') && Object.hasOwn(value, 'content_sha256')) {
    out.push({ ref: value, path });
  }
  for (const [key, entry] of Object.entries(value)) walkFileRefs(entry, `${path}.${key}`, out);
  return out;
}

const LOCAL_REPOSITORY = 'suengj/ai-editorial-system';
const referenceKey = (ref) => `${ref?.repository}@${ref?.commit}:${ref?.path}`;
const resolutionKey = (ref) => `${referenceKey(ref)}#${ref?.content_sha256}`;

function validImmutableRecordRef(ref) {
  return ref && typeof ref === 'object' && !Array.isArray(ref) &&
    /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(ref.repository ?? '') &&
    /^[a-f0-9]{7,40}$/.test(ref.commit ?? '') &&
    validRelativePath(ref.path) &&
    /^[a-f0-9]{64}$/.test(ref.content_sha256 ?? '');
}

/**
 * Resolve and verify one immutable record reference.
 *
 * `resolveExternalRecord(ref)` is the explicit SIT seam. It must return raw
 * JSON bytes/text, never an already-parsed object. This module performs no
 * network or cross-repository fetch itself.
 */
export function resolveAndVerifyJourneyReference(ref, {
  localRoot = ROOT,
  resolveExternalRecord,
} = {}) {
  if (!validImmutableRecordRef(ref)) {
    return {
      ok: false,
      code: CODES.HANDOFF_INVALID,
      issue: issue(CODES.HANDOFF_INVALID, '$.record_ref',
        'record reference must use repository owner/name, a 7-40 lowercase-hex commit, a safe relative path, and a 64-hex content digest'),
    };
  }
  let raw;
  if (ref?.repository === LOCAL_REPOSITORY) {
    try {
      raw = execFileSync('git', ['show', `${ref.commit}:${ref.path}`], {
        cwd: localRoot,
        encoding: null,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (cause) {
      return {
        ok: false,
        code: CODES.HANDOFF_INVALID,
        issue: issue(CODES.HANDOFF_INVALID, '$.record_ref',
          `local referenced record is unresolvable: ${cause.message}`),
      };
    }
  } else {
    if (typeof resolveExternalRecord !== 'function') {
      return {
        ok: false,
        code: CODES.BLOCKED_TRANSPORT,
        issue: issue(CODES.BLOCKED_TRANSPORT, '$.record_ref',
          `external reference ${referenceKey(ref)} requires the SUE-787 resolver seam`),
      };
    }
    try {
      raw = resolveExternalRecord(clone(ref));
    } catch (cause) {
      return {
        ok: false,
        code: CODES.BLOCKED_TRANSPORT,
        issue: issue(CODES.BLOCKED_TRANSPORT, '$.record_ref',
          `external reference ${referenceKey(ref)} could not be resolved: ${cause.message}`),
      };
    }
    if (raw === undefined || raw === null) {
      return {
        ok: false,
        code: CODES.BLOCKED_TRANSPORT,
        issue: issue(CODES.BLOCKED_TRANSPORT, '$.record_ref',
          `external reference ${referenceKey(ref)} was not resolved`),
      };
    }
    if (!Buffer.isBuffer(raw) && typeof raw !== 'string') {
      return {
        ok: false,
        code: CODES.HANDOFF_INVALID,
        issue: issue(CODES.HANDOFF_INVALID, '$.record_ref',
          'external resolver must return raw JSON bytes or text, not a parsed object'),
      };
    }
  }

  let record;
  let actual;
  if (ref.path.endsWith('.json')) {
    try {
      record = parseJourneyJson(raw, referenceKey(ref));
    } catch (cause) {
      return {
        ok: false,
        code: CODES.HANDOFF_INVALID,
        issue: issue(CODES.HANDOFF_INVALID, '$.record_ref', cause.message),
      };
    }
    actual = canonicalRecordSha256(record);
  } else {
    actual = createHash('sha256').update(raw).digest('hex');
  }
  if (actual !== ref?.content_sha256) {
    return {
      ok: false,
      code: CODES.HANDOFF_INVALID,
      issue: issue(CODES.HANDOFF_INVALID, '$.record_ref.content_sha256',
        `referenced record digest mismatch: expected ${ref?.content_sha256}, got ${actual}`),
    };
  }
  return { ok: true, code: null, record, canonical_sha256: actual };
}

function collectRecordWrappers(value, out = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectRecordWrappers(entry, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  if (value.record_ref && typeof value.resolved_bytes_base64 === 'string') {
    out.set(referenceKey(value.record_ref), Buffer.from(value.resolved_bytes_base64, 'base64'));
  } else if (value.record_ref && Object.hasOwn(value, 'record')) {
    out.set(referenceKey(value.record_ref), JSON.stringify(canonical(value.record)));
  }
  Object.values(value).forEach((entry) => collectRecordWrappers(entry, out));
  return out;
}

/** Build a raw-byte external resolver from a strict-parsed fixture/SIT bundle. */
export function createRecordBundleResolver(recordBundle) {
  const index = collectRecordWrappers(recordBundle);
  return (ref) => index.get(referenceKey(ref));
}

function verifyEnvelopeReferences(envelope, options, issues) {
  const seen = new Set();
  const resolutions = new Map();
  for (const { ref, path } of walkFileRefs(envelope)) {
    const key = resolutionKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    const result = resolveAndVerifyJourneyReference(ref, options);
    resolutions.set(key, result);
    if (!result.ok) issues.push({ ...result.issue, where: path });
  }
  return resolutions;
}

function resolvedObjectRecord(resolutions, ref, issues, where) {
  const resolution = resolutions.get(resolutionKey(ref));
  if (!resolution?.ok) return undefined;
  const record = resolution.record;
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    issues.push(issue(CODES.HANDOFF_INVALID, where,
      'a resolved journey record must be a non-null JSON object'));
    return undefined;
  }
  return record;
}

function valuesAtPath(value, parts) {
  if (parts.length === 0) return value === undefined ? [] : [value];
  if (value === undefined || value === null) return [];
  const [head, ...tail] = parts;
  if (head === '*') {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => valuesAtPath(entry, tail));
  }
  return valuesAtPath(value[head], tail);
}

function articleForLineage(articleRef) {
  return {
    article_id: articleRef?.article_id,
    version: {
      number: articleRef?.version_number,
      content_hash: articleRef?.content_hash,
      claims_hash: articleRef?.claims_hash,
      ...(articleRef?.commit ? { commit: articleRef.commit } : {}),
    },
  };
}

/** Derive the last completed stage from present, contiguous records. */
function deriveProgressStateFromShape(envelope) {
  if (!envelope || typeof envelope !== 'object') return null;
  let state = 'RECEIVED';
  if (envelope.candidate?.selection === null || envelope.candidate?.selection === undefined) return state;
  state = 'SELECTED';
  if (![envelope.dossier, envelope.article_ref, envelope.journey_binding_sha256].every(present)) return state;
  state = 'DRAFT_READY';
  if (!present(envelope.review_ref)) return state;
  state = 'IN_REVIEW';
  if (!present(envelope.approved_revision)) return state;
  state = 'APPROVED_REVISION';
  if (!present(envelope.handoff_receipt_ref) || !Array.isArray(envelope.asset_bindings)) return state;
  state = 'ASSETS_LOCKED';
  if (!present(envelope.publish_run)) return state;
  state = 'PUBLISH_ACCEPTED';
  if (!present(envelope.source_commit)) return state;
  state = 'SOURCE_COMMITTED';
  if (!present(envelope.deployed_artifact)) return state;
  state = 'ARTIFACT_DEPLOYED';
  if (!present(envelope.live_verification_ref) || !present(envelope.live_verification)) return state;
  return 'LIVE_VERIFIED';
}

/**
 * Derive a progress state only after the complete envelope verification path
 * accepts the persisted bindings. The internal shape helper is used by that
 * path to validate state labels without recursing through this public API.
 */
export function deriveProgressState(envelope, options = {}) {
  const verification = verifyJourneyEnvelope(envelope, options);
  return verification.issues.length === 0 ? deriveProgressStateFromShape(envelope) : null;
}

function validateAuthority(envelope, issues) {
  for (const rule of REFERENCE_AUTHORITIES) {
    for (const ref of valuesAtPath(envelope, rule.path)) {
      const where = `$.${rule.path.join('.').replace('.*.', '[*].')}`;
      if (ref?.repository !== rule.repository) {
        issues.push(issue(CODES.HANDOFF_INVALID, `${where}.repository`,
          `${rule.name} must be authoritative in ${rule.repository}`));
      }
      if (rule.exactPath && ref?.path !== rule.exactPath) {
        issues.push(issue(CODES.HANDOFF_INVALID, `${where}.path`,
          `${rule.name} must use ${rule.exactPath}`));
      }
    }
  }
}

function validateDossierPath(envelope, issues) {
  if (!envelope.dossier || !envelope.candidate?.slug) return;
  const prefix = 'intelligence/dossiers/';
  const path = envelope.dossier.path;
  const filename = typeof path === 'string' && path.startsWith(prefix) ? path.slice(prefix.length) : '';
  const exact = `${envelope.candidate.slug}.md`;
  const datedPrefix = `${envelope.candidate.slug}-`;
  const dated = filename.startsWith(datedPrefix) && filename.endsWith('.md')
    ? filename.slice(datedPrefix.length, -3)
    : null;
  if (filename !== exact && !validCalendarDate(dated)) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.dossier.path',
      'the dossier path must be the exact selected slug or that slug plus a real YYYY-MM-DD refresh date'));
  }
}

/** One path for structure, reference resolution, and semantic record bindings. */
function verifyJourneyEnvelope(envelope, {
  schema = loadSchema(),
  localRoot = ROOT,
  resolveExternalRecord,
} = {}) {
  const issues = [];
  for (const error of validate(envelope, schema)) {
    issues.push(issue(CODES.HANDOFF_INVALID, error.path, error.message));
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return { issues, resolutions: new Map() };
  }

  for (const { ref, path } of walkFileRefs(envelope)) {
    if (!validRelativePath(ref.path)) {
      issues.push(issue(CODES.HANDOFF_INVALID, `${path}.path`,
        'file references must use a non-empty repository-relative path without empty or parent segments'));
    }
  }
  validateAuthority(envelope, issues);
  validateDossierPath(envelope, issues);
  const resolutions = verifyEnvelopeReferences(
    envelope, { localRoot, resolveExternalRecord }, issues,
  );

  const selection = envelope.candidate?.selection;
  if (selection !== null && selection !== undefined &&
      (!meaningful(selection.selected_by) || !validCalendarDate(selection.selection_date))) {
    issues.push(issue(CODES.SELECTION_REQUIRED, '$.candidate.selection',
      'selection requires a non-blank selector and a real calendar date'));
  }

  if (envelope.dossier?.evidence_role === 'primary') {
    issues.push(issue(CODES.DERIVED_EVIDENCE, '$.dossier.evidence_role',
      'an intelligence_dossier is derived scaffolding and cannot become primary evidence'));
  }
  if (envelope.candidate?.slug && envelope.journey_id !== `journey:${envelope.candidate.slug}`) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.journey_id',
      'journey_id must encode the selected candidate slug'));
  }

  const derivedState = deriveProgressStateFromShape(envelope);
  const derivedIndex = PROGRESS_INDEX.get(derivedState);
  const claimedIndex = PROGRESS_INDEX.get(envelope.state);
  const interrupted = INTERRUPT_STATES.includes(envelope.state);

  if (claimedIndex !== undefined) {
    if (envelope.state !== derivedState || envelope.last_good_state !== derivedState) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.state',
        `progress labels must equal the record-derived state ${derivedState}`));
    }
    if (envelope.interruption !== undefined) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.interruption',
        'a progress state cannot retain an interruption record'));
    }
  } else if (interrupted) {
    if (envelope.interruption?.code !== envelope.state) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.interruption.code',
        'an interrupt state must have a matching interruption code'));
    }
    if (envelope.last_good_state !== derivedState) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.last_good_state',
        `last_good_state must equal the record-derived state ${derivedState}`));
    }
    const minimum = PROGRESS_INDEX.get(INTERRUPT_MINIMUM[envelope.state]);
    if (derivedIndex === undefined || derivedIndex < minimum) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.last_good_state',
        `${envelope.state} is not reachable from ${derivedState ?? '<missing>'}`));
    }
  }

  if ((claimedIndex ?? (PROGRESS_INDEX.get(envelope.last_good_state) ?? -1)) >= PROGRESS_INDEX.get('SELECTED') &&
      selection === null) {
    issues.push(issue(CODES.SELECTION_REQUIRED, '$.candidate.selection',
      'a candidate without explicit human selection cannot advance past RECEIVED'));
  }

  if (envelope.state === 'NO_ARTICLE') {
    const forbidden = [
      'dossier', 'article_ref', 'journey_binding_sha256', 'review_ref', 'approved_revision',
      'handoff_receipt_ref', 'asset_bindings', 'publish_run', 'source_commit',
      'deployed_artifact', 'live_verification_ref', 'live_verification',
    ].filter((field) => present(envelope[field]));
    if (derivedState !== 'SELECTED' || forbidden.length > 0) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.state',
        `NO_ARTICLE is terminal after SELECTED and cannot carry downstream fields${forbidden.length ? `: ${forbidden.join(', ')}` : ''}`));
    }
  }

  if (envelope.journey_binding_sha256 && envelope.candidate && envelope.dossier && envelope.article_ref) {
    const expected = journeyBindingSha256(envelope.candidate, envelope.dossier, envelope.article_ref);
    if (envelope.journey_binding_sha256 !== expected) {
      issues.push(issue(CODES.STALE_REVISION, '$.journey_binding_sha256',
        'candidate, dossier, and article no longer match their persisted identity binding'));
    }
  }

  let actualStale = false;
  const approval = envelope.approved_revision;
  if (approval) {
    if (assetDigestSetHash(approval.asset_digests ?? []) !== approval.asset_digest_set_hash) {
      actualStale = true;
      issues.push(issue(CODES.STALE_REVISION, '$.approved_revision.asset_digest_set_hash',
        'the ordered asset digest set no longer matches its persisted set hash'));
    }
    const expectedBinding = approvalBindingSha256(approval.article_ref, approval.asset_digests ?? []);
    if (approval.binding_sha256 !== expectedBinding) {
      actualStale = true;
      issues.push(issue(CODES.STALE_REVISION, '$.approved_revision.binding_sha256',
        'the external publish decision is not self-bound to its recorded article revision and ordered asset digests'));
    }
    const currentAssetDigests = Array.isArray(envelope.asset_bindings)
      ? envelope.asset_bindings.map((binding) => binding?.asset_sha256)
      : approval.asset_digests;
    const currentBinding = approvalBindingSha256(envelope.article_ref, currentAssetDigests ?? []);
    if (approval.binding_sha256 !== currentBinding) {
      actualStale = true;
      if (envelope.state !== 'STALE_REVISION') {
        issues.push(issue(CODES.STALE_REVISION, '$.approved_revision.binding_sha256',
          'the approval-time digest does not bind the envelope current article and ordered asset set'));
      }
    }
    if (envelope.article_ref && !same(approval.article_ref, envelope.article_ref)) {
      actualStale = true;
      if (envelope.state !== 'STALE_REVISION') {
        issues.push(issue(CODES.STALE_REVISION, '$.approved_revision.article_ref',
          'the recorded publish approval does not bind the current exact article revision'));
      }
    }
  }

  if (Array.isArray(envelope.asset_bindings)) {
    const digests = approval?.asset_digests ?? [];
    if (envelope.asset_bindings.length !== digests.length) {
      actualStale = true;
      issues.push(issue(CODES.STALE_REVISION, '$.asset_bindings',
        'asset bindings must equal the complete ordered publish-gate digest set'));
    }
    envelope.asset_bindings.forEach((binding, index) => {
      if (binding?.receipt_artifact_index !== index) {
        issues.push(issue(CODES.HANDOFF_INVALID, `$.asset_bindings[${index}].receipt_artifact_index`,
          'asset bindings must be contiguous and ordered exactly like the handoff receipt artifacts'));
      }
      if (binding?.asset_sha256 !== digests[index]) {
        actualStale = true;
        if (envelope.state !== 'STALE_REVISION') {
          issues.push(issue(CODES.STALE_REVISION, `$.asset_bindings[${index}].asset_sha256`,
            'the visual and publish-gate decisions do not bind the same asset digest'));
        }
      }
      const expectedVisualBinding = approvalBindingSha256(binding?.article_ref, [binding?.asset_sha256]);
      if (binding?.visual_approval?.binding_sha256 !== expectedVisualBinding) {
        actualStale = true;
        issues.push(issue(CODES.STALE_REVISION, `$.asset_bindings[${index}].visual_approval.binding_sha256`,
          'the external visual decision is not self-bound to its article lineage and asset digest'));
      }
      if (envelope.article_ref && binding?.article_ref?.article_id !== envelope.article_ref.article_id) {
        issues.push(issue(CODES.HANDOFF_INVALID, `$.asset_bindings[${index}].article_ref.article_id`,
          'an asset lineage must belong to the journey article'));
      }
      if (envelope.article_ref && (derivedIndex ?? -1) >= PROGRESS_INDEX.get('ASSETS_LOCKED')) {
        const lineage = classifyArtifact({ article_ref: binding?.article_ref }, articleForLineage(envelope.article_ref));
        if (!lineage.presentable) {
          actualStale = true;
          if (envelope.state !== 'STALE_REVISION') {
            issues.push(issue(CODES.STALE_REVISION, `$.asset_bindings[${index}].article_ref`,
              `the recorded visual approval is ${lineage.level} against the current article revision`));
          }
        }
      }
    });
  }

  if (envelope.state === 'STALE_REVISION' && !actualStale) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.state',
      'STALE_REVISION requires observable drift from a self-bound approval'));
  }

  if (envelope.live_verification &&
      (Object.hasOwn(envelope.live_verification, 'media_url') !==
       Object.hasOwn(envelope.live_verification, 'media_sha256'))) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.live_verification',
      'media_url and media_sha256 must either both be present or both be absent'));
  }
  verifyResolvedJourneyBindings(envelope, resolutions, issues);
  return { issues, resolutions };
}

/** Validate structure plus the cross-field invariants JSON Schema cannot express. */
export function validateJourneyEnvelope(envelope, options = {}) {
  return verifyJourneyEnvelope(envelope, options).issues;
}

export function validateJourneyEnvelopeFile(path, options = {}) {
  let envelope;
  try {
    envelope = parseJourneyJson(readFileSync(path), path);
  } catch (error) {
    return [issue(CODES.HANDOFF_INVALID, path, `unparseable journey envelope: ${error.message}`)];
  }
  return validateJourneyEnvelope(envelope, options);
}

/** Validate the literal SUE-789 manifest/receipt/LIVE_VERIFIED boundary. */
export function validateSUE789Interop({ manifest, receipt, result } = {}) {
  const issues = [];
  const bare = /^[a-f0-9]{64}$/;
  const prefixed = /^sha256:[a-f0-9]{64}$/;
  if (!manifest || manifest.state !== 'HUMAN_APPROVED_LOCKED') {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.manifest.state', 'manifest must be HUMAN_APPROVED_LOCKED'));
  }
  if (!bare.test(manifest?.expected_article_sha256 ?? '')) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.manifest.expected_article_sha256',
      'manifest expected_article_sha256 must remain bare hex'));
  }
  if (!meaningful(manifest?.expected_source_ref) || !/^[a-f0-9]{40,64}$/.test(manifest?.expected_source_sha ?? '')) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.manifest.expected_source_sha',
      'manifest expected_source_ref requires a 40-64 character lowercase hex expected_source_sha'));
  }
  if (!meaningful(receipt?.article_ref) || !/^\/media\//.test(receipt?.production_ref ?? '') ||
      !prefixed.test(receipt?.production_sha256 ?? '')) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.receipt',
      'receipt must carry article_ref, root-relative production_ref, and prefixed production_sha256'));
  }
  const allowedResultKeys = new Set(['state', 'article_url', 'article_body_sha256', 'media_url', 'media_sha256']);
  if (!result || result.state !== 'LIVE_VERIFIED' || !meaningful(result.article_url) ||
      !prefixed.test(result.article_body_sha256 ?? '') ||
      Object.keys(result ?? {}).some((key) => !allowedResultKeys.has(key))) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.result',
      'result must be the literal LIVE_VERIFIED shape with prefixed article digest'));
  }
  const hasMediaUrl = Object.hasOwn(result ?? {}, 'media_url');
  const hasMediaDigest = Object.hasOwn(result ?? {}, 'media_sha256');
  if (hasMediaUrl !== hasMediaDigest || (hasMediaDigest && !prefixed.test(result.media_sha256))) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.result',
      'LIVE_VERIFIED media_url and prefixed media_sha256 must appear together'));
  }
  if (hasMediaDigest && result.media_sha256 !== receipt?.production_sha256) {
    issues.push(issue(CODES.MEDIA_DIGEST_MISMATCH, '$.result.media_sha256',
      'live media digest must exactly equal the publication receipt digest'));
  }
  if (hasMediaUrl && receipt?.production_ref) {
    try {
      if (new URL(result.media_url).pathname !== receipt.production_ref) {
        issues.push(issue(CODES.HANDOFF_INVALID, '$.result.media_url',
          'live media URL path must exactly equal receipt.production_ref'));
      }
    } catch {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.result.media_url', 'live media_url must be an absolute URL'));
    }
  }
  return issues;
}

function expectSame(issues, actual, expected, code, where, message) {
  if (!same(actual, expected)) issues.push(issue(code, where, message));
}

function publishDecisionRecord(approval) {
  return {
    approved_by: approval?.approved_by,
    approved_at: approval?.approved_at,
    article_ref: approval?.article_ref,
    asset_digests: approval?.asset_digests,
    asset_digest_set_hash: approval?.asset_digest_set_hash,
    binding_sha256: approval?.binding_sha256,
  };
}

function visualDecisionRecord(binding) {
  return {
    approved_by: binding?.visual_approval?.approved_by,
    approved_at: binding?.visual_approval?.approved_at,
    article_ref: binding?.article_ref,
    asset_digests: [binding?.asset_sha256],
    binding_sha256: binding?.visual_approval?.binding_sha256,
  };
}

function verifyResolvedJourneyBindings(envelope, resolutions, issues) {
  const recordedArticle = envelope.approved_revision?.article_ref ?? envelope.article_ref;
  const candidateLedger = resolvedObjectRecord(
    resolutions, envelope.candidate?.ledger_ref, issues, '$.candidate.ledger_ref',
  );
  if (candidateLedger !== undefined && envelope.candidate?.selection !== null) {
    expectSame(issues, candidateLedger.candidate,
      { slug: envelope.candidate.slug, selection: envelope.candidate.selection },
      CODES.HANDOFF_INVALID, '$.candidate.ledger_ref',
      'resolved candidate selection does not bind the envelope candidate');
  }

  const review = resolvedObjectRecord(resolutions, envelope.review_ref, issues, '$.review_ref');
  if (review !== undefined) {
    expectSame(issues, review.dossier_ref, envelope.dossier,
      CODES.STALE_REVISION, '$.review_ref',
      'resolved editorial review does not bind the exact dossier revision');
    expectSame(issues, review.article_ref, recordedArticle,
      CODES.STALE_REVISION, '$.review_ref',
      'resolved editorial review does not bind the reviewed article revision');
  }

  const handoffReceipt = resolvedObjectRecord(
    resolutions, envelope.handoff_receipt_ref, issues, '$.handoff_receipt_ref',
  );
  if (handoffReceipt !== undefined) {
    expectSame(issues, handoffReceipt.article_ref, recordedArticle,
      CODES.STALE_REVISION, '$.handoff_receipt_ref',
      'resolved handoff receipt does not bind the approved article revision');
    expectSame(issues, handoffReceipt.artifacts?.map((entry) => entry.asset_sha256),
      envelope.asset_bindings?.map((entry) => entry.asset_sha256),
      CODES.MEDIA_DIGEST_MISMATCH, '$.handoff_receipt_ref',
      'resolved handoff receipt does not bind the ordered envelope asset digests');
  }

  const publishApproval = resolvedObjectRecord(
    resolutions, envelope.approved_revision?.record_ref, issues,
    '$.approved_revision.record_ref',
  );
  if (publishApproval !== undefined) {
    expectSame(issues, publishApproval, publishDecisionRecord(envelope.approved_revision),
      CODES.STALE_REVISION, '$.approved_revision.record_ref',
      'resolved publish decision does not bind the recorded approval');
  }

  envelope.asset_bindings?.forEach((binding, index) => {
    const visualApproval = resolvedObjectRecord(
      resolutions, binding?.visual_approval?.record_ref, issues,
      `$.asset_bindings[${index}].visual_approval.record_ref`,
    );
    if (visualApproval !== undefined) {
      expectSame(issues, visualApproval, visualDecisionRecord(binding),
        CODES.STALE_REVISION, `$.asset_bindings[${index}].visual_approval.record_ref`,
        'resolved visual decision does not bind this exact asset lineage and digest');
    }
  });

  const publishRun = resolvedObjectRecord(
    resolutions, envelope.publish_run?.record_ref, issues, '$.publish_run.record_ref',
  );
  if (publishRun !== undefined) {
    expectSame(issues, publishRun.run_id, envelope.publish_run.run_id,
      CODES.HANDOFF_INVALID, '$.publish_run.record_ref',
      'resolved publish run identity disagrees with the envelope');
  }

  const deployment = resolvedObjectRecord(
    resolutions, envelope.deployed_artifact?.record_ref, issues,
    '$.deployed_artifact.record_ref',
  );
  if (deployment !== undefined) {
    expectSame(issues, deployment.deployment_id, envelope.deployed_artifact.deployment_id,
      CODES.HANDOFF_INVALID, '$.deployed_artifact.record_ref',
      'resolved deployment identity disagrees with the envelope');
    expectSame(issues, deployment.source_commit, envelope.source_commit,
      CODES.HANDOFF_INVALID, '$.deployed_artifact.record_ref',
      'resolved deployment source commit disagrees with the envelope');
  }

  const liveVerification = resolvedObjectRecord(
    resolutions, envelope.live_verification_ref, issues, '$.live_verification_ref',
  );
  if (liveVerification !== undefined) {
    expectSame(issues, liveVerification.result, envelope.live_verification,
      CODES.HANDOFF_INVALID, '$.live_verification_ref',
      'resolved live read-back result disagrees with the envelope');
    if (publishRun) {
      issues.push(...validateSUE789Interop({
        manifest: publishRun.manifest,
        receipt: publishRun.receipt,
        result: liveVerification.result,
      }));
    }
  }
}

function resolvedWrapper(issues, wrapper, expectedRef, resolutions, code, where) {
  expectSame(issues, wrapper?.record_ref, expectedRef, CODES.HANDOFF_INVALID,
    `${where}.record_ref`, 'record pointer disagrees with the envelope');
  const resolution = resolutions.get(resolutionKey(expectedRef));
  if (!resolution?.ok) return undefined;
  expectSame(issues, wrapper?.record, resolution.record, code, `${where}.record`,
    'caller-supplied record metadata disagrees with hash-verified record bytes');
  return resolution.record;
}

/** Resolve independent record metadata and prove cross-repository agreement. */
export function validateJourneyReferences(envelope, records, options = {}) {
  const verification = verifyJourneyEnvelope(envelope, options);
  const issues = verification.issues;
  if (issues.length > 0) return issues;
  if (!records || typeof records !== 'object') {
    return [issue(CODES.HANDOFF_INVALID, '$.records', 'independent referenced records are required')];
  }
  const { resolutions } = verification;
  const candidateLedger = resolvedWrapper(issues, records.candidate_ledger,
    envelope.candidate.ledger_ref, resolutions, CODES.HANDOFF_INVALID, '$.records.candidate_ledger');
  expectSame(issues, records.dossier_source?.record_ref, envelope.dossier,
    CODES.HANDOFF_INVALID, '$.records.dossier_source.record_ref', 'dossier pointer disagrees');
  const dossierSource = records.dossier_source?.record;
  const review = resolvedWrapper(issues, records.review,
    envelope.review_ref, resolutions, CODES.STALE_REVISION, '$.records.review');
  const handoffReceipt = resolvedWrapper(issues, records.handoff_receipt,
    envelope.handoff_receipt_ref, resolutions, CODES.HANDOFF_INVALID, '$.records.handoff_receipt');
  const publishApproval = resolvedWrapper(issues, records.publish_approval,
    envelope.approved_revision.record_ref, resolutions, CODES.STALE_REVISION, '$.records.publish_approval');
  const visualApprovals = envelope.asset_bindings.map((binding, index) => resolvedWrapper(
    issues,
    records.visual_approvals?.[index],
    binding.visual_approval.record_ref,
    resolutions,
    CODES.STALE_REVISION,
    `$.records.visual_approvals[${index}]`,
  ));
  const publishRun = resolvedWrapper(issues, records.publish_run,
    envelope.publish_run.record_ref, resolutions, CODES.HANDOFF_INVALID, '$.records.publish_run');
  const deployment = resolvedWrapper(issues, records.deployment,
    envelope.deployed_artifact.record_ref, resolutions, CODES.HANDOFF_INVALID, '$.records.deployment');
  const liveVerification = resolvedWrapper(issues, records.live_verification,
    envelope.live_verification_ref, resolutions, CODES.HANDOFF_INVALID, '$.records.live_verification');

  expectSame(issues, candidateLedger?.candidate,
    { slug: envelope.candidate.slug, selection: envelope.candidate.selection },
    CODES.HANDOFF_INVALID, '$.records.candidate_ledger.candidate', 'candidate selection disagrees');
  expectSame(issues, dossierSource?.identity, envelope.dossier,
    CODES.STALE_REVISION, '$.records.dossier_source.identity', 'exact dossier revision disagrees');
  expectSame(issues, dossierSource?.used_by_article, envelope.article_ref,
    CODES.STALE_REVISION, '$.records.dossier_source.used_by_article', 'dossier-to-article binding disagrees');
  expectSame(issues, review?.article_ref, envelope.article_ref,
    CODES.STALE_REVISION, '$.records.review.article_ref', 'reviewed article revision disagrees');
  expectSame(issues, handoffReceipt?.article_ref, envelope.article_ref,
    CODES.STALE_REVISION, '$.records.handoff_receipt.article_ref', 'handoff article revision disagrees');
  expectSame(issues, handoffReceipt?.artifacts?.map((entry) => entry.asset_sha256),
    envelope.asset_bindings.map((entry) => entry.asset_sha256),
    CODES.MEDIA_DIGEST_MISMATCH, '$.records.handoff_receipt.artifacts', 'handoff asset order or digest disagrees');
  expectSame(issues, publishApproval, publishDecisionRecord(envelope.approved_revision),
    CODES.STALE_REVISION, '$.records.publish_approval', 'resolved publish decision disagrees');
  expectSame(issues, visualApprovals, envelope.asset_bindings.map(visualDecisionRecord),
    CODES.STALE_REVISION, '$.records.visual_approvals', 'resolved visual decision binding disagrees');
  expectSame(issues, publishRun?.run_id, envelope.publish_run.run_id,
    CODES.HANDOFF_INVALID, '$.records.publish_run.run_id', 'publish run identity disagrees');
  issues.push(...validateSUE789Interop({
    manifest: publishRun?.manifest,
    receipt: publishRun?.receipt,
    result: liveVerification?.result,
  }));
  expectSame(issues, deployment?.deployment_id, envelope.deployed_artifact.deployment_id,
    CODES.HANDOFF_INVALID, '$.records.deployment.deployment_id', 'deployment identity disagrees');
  expectSame(issues, deployment?.source_commit, envelope.source_commit,
    CODES.HANDOFF_INVALID, '$.records.deployment.source_commit', 'source commit disagrees');
  expectSame(issues, liveVerification?.result, envelope.live_verification,
    CODES.HANDOFF_INVALID, '$.records.live_verification.result', 'live read-back result disagrees');
  return issues;
}

/** Rehydrate only from persisted bytes. No module or process state is used. */
export function recoverJourneyState(serialized, options = {}) {
  let envelope;
  try {
    envelope = parseJourneyJson(serialized, 'persisted journey envelope');
  } catch (error) {
    return {
      ok: false,
      code: CODES.HANDOFF_INVALID,
      state: CODES.HANDOFF_INVALID,
      issues: [issue(CODES.HANDOFF_INVALID, '$', `unparseable journey envelope: ${error.message}`)],
    };
  }
  const verification = verifyJourneyEnvelope(envelope, options);
  const issues = verification.issues;
  if (issues.length > 0) {
    return { ok: false, code: issues[0].code, state: issues[0].code, issues };
  }
  const terminal = envelope.state === 'NO_ARTICLE';
  return {
    ok: true,
    code: null,
    envelope,
    state: envelope.state,
    last_good_state: envelope.last_good_state,
    terminal,
    resume_from: terminal ? null : (INTERRUPT_STATES.includes(envelope.state) ? envelope.last_good_state : envelope.state),
  };
}

/** Execute the one bounded recovery probe selected by persisted state. */
export function resumeJourney(serialized, adapters = {}, referenceOptions = {}) {
  const recovered = recoverJourneyState(serialized, referenceOptions);
  if (!recovered.ok) return recovered;
  if (recovered.terminal) return { ...recovered, invoked: false, operation: null };
  if (!INTERRUPT_STATES.includes(recovered.state)) {
    return { ...recovered, invoked: false, operation: null };
  }
  const operation = RESUME_OPERATIONS[recovered.state];
  const adapter = adapters[operation];
  if (typeof adapter !== 'function') {
    return {
      ok: false,
      code: CODES.HANDOFF_INVALID,
      issues: [issue(CODES.HANDOFF_INVALID, '$.state', `missing recovery adapter ${operation}`)],
    };
  }
  const idempotencyKey = sha256Json({
    journey_id: recovered.envelope.journey_id,
    state: recovered.state,
    last_good_state: recovered.last_good_state,
    interruption: recovered.envelope.interruption,
  });
  const observation = adapter({
    envelope: clone(recovered.envelope),
    resume_from: recovered.resume_from,
    idempotency_key: idempotencyKey,
  });
  return { ...recovered, invoked: true, operation, idempotency_key: idempotencyKey, observation };
}

/** Return the linked identity chain after resolving independent record metadata. */
export function reconstructIdentityChain(envelope, records, referenceOptions = {}) {
  const issues = validateJourneyReferences(envelope, records, referenceOptions);
  if (issues.length > 0) return { ok: false, code: issues[0].code, issues };
  if (envelope.last_good_state !== 'LIVE_VERIFIED') {
    const incomplete = issue(CODES.HANDOFF_INVALID, '$.last_good_state',
      'the complete identity chain is not reconstructable before LIVE_VERIFIED');
    return { ok: false, code: CODES.HANDOFF_INVALID, issues: [incomplete] };
  }
  return {
    ok: true,
    code: null,
    chain: {
      candidate: clone(records.candidate_ledger.record.candidate),
      dossier: clone(records.dossier_source.record.identity),
      article_ref: clone(records.handoff_receipt.record.article_ref),
      handoff_receipt_ref: clone(records.handoff_receipt.record_ref),
      assets: clone(records.handoff_receipt.record.artifacts),
      approved_revision: clone(records.publish_approval.record),
      visual_approvals: clone(records.visual_approvals.map((entry) => entry.record)),
      publish_run: { run_id: records.publish_run.record.run_id, record_ref: clone(records.publish_run.record_ref) },
      source_commit: clone(records.deployment.record.source_commit),
      deployed_artifact: { deployment_id: records.deployment.record.deployment_id, record_ref: clone(records.deployment.record_ref) },
      live_verification: clone(records.live_verification.record.result),
    },
  };
}

/** Exact publish-gate binding. The current envelope state is authoritative. */
export function assessPublishGate(envelope, {
  articleRef = envelope?.article_ref,
  assetDigests,
  referenceOptions = {},
} = {}) {
  const verification = verifyJourneyEnvelope(envelope, referenceOptions);
  const baselineIssues = verification.issues;
  if (baselineIssues.length > 0) {
    return { accepted: false, code: baselineIssues[0].code, issues: baselineIssues };
  }
  if (envelope.state === 'STALE_REVISION') {
    const stale = issue(CODES.STALE_REVISION, '$.state', 'a stale envelope cannot pass the publish gate');
    return { accepted: false, code: CODES.STALE_REVISION, issues: [stale] };
  }
  const decision = verification.resolutions.get(
    resolutionKey(envelope.approved_revision?.record_ref),
  );
  if (!decision?.ok) {
    const failure = decision ?? {
      code: CODES.HANDOFF_INVALID,
      issue: issue(CODES.HANDOFF_INVALID, '$.approved_revision.record_ref',
        'publish approval record was not resolved by the shared verification path'),
    };
    return { accepted: false, code: failure.code, issues: [failure.issue] };
  }
  if (!same(decision.record, publishDecisionRecord(envelope.approved_revision))) {
    const stale = issue(CODES.STALE_REVISION, '$.approved_revision.record_ref',
      'the resolved external publish decision does not match the envelope approval binding');
    return { accepted: false, code: CODES.STALE_REVISION, issues: [stale] };
  }
  if (!articleRef || !same(articleRef, envelope.article_ref) || !Array.isArray(assetDigests)) {
    const invalid = issue(CODES.STALE_REVISION, '$.article_ref',
      'publish-gate assessment must use the envelope current article_ref and ordered asset digests');
    return { accepted: false, code: CODES.STALE_REVISION, issues: [invalid] };
  }
  const approval = envelope.approved_revision;
  const articleMatches = same(approval?.article_ref, envelope.article_ref);
  const digestsMatch = same(approval?.asset_digests, assetDigests) &&
    approval?.asset_digest_set_hash === assetDigestSetHash(assetDigests) &&
    approval?.binding_sha256 === approvalBindingSha256(envelope.article_ref, assetDigests);
  if (!articleMatches || !digestsMatch) {
    const stale = issue(CODES.STALE_REVISION, '$.approved_revision',
      'publish approval does not bind the current article revision and exact ordered asset digest set');
    return { accepted: false, code: CODES.STALE_REVISION, issues: [stale] };
  }
  return { accepted: true, code: null, issues: [] };
}

/** Check one independent visual decision through classifyArtifact() unchanged. */
export function assessAssetApproval(envelope, receiptArtifactIndex, {
  articleRef,
  assetDigest,
  referenceOptions = {},
} = {}) {
  const verification = verifyJourneyEnvelope(envelope, referenceOptions);
  const baselineIssues = verification.issues;
  if (baselineIssues.length > 0) {
    return { approval_valid: false, presentable: false, code: baselineIssues[0].code, lineage: null, issues: baselineIssues };
  }
  const binding = envelope?.asset_bindings?.[receiptArtifactIndex];
  if (!binding || binding.receipt_artifact_index !== receiptArtifactIndex ||
      !articleRef || typeof articleRef !== 'object') {
    return { approval_valid: false, presentable: false, code: CODES.HANDOFF_INVALID, lineage: null };
  }
  const lineage = classifyArtifact({ article_ref: binding.article_ref }, articleForLineage(articleRef));
  const decision = verification.resolutions.get(
    resolutionKey(binding.visual_approval?.record_ref),
  );
  if (!decision?.ok) {
    const failure = decision ?? {
      code: CODES.HANDOFF_INVALID,
      issue: issue(CODES.HANDOFF_INVALID, '$.asset_bindings[].visual_approval.record_ref',
        'visual approval record was not resolved by the shared verification path'),
    };
    return { approval_valid: false, presentable: false, code: failure.code, lineage, issues: [failure.issue] };
  }
  const externallyBound = same(decision.record, visualDecisionRecord(binding));
  const selfBound = binding.visual_approval.binding_sha256 ===
    approvalBindingSha256(binding.article_ref, [binding.asset_sha256]);
  if (assetDigest !== binding.asset_sha256 || !lineage.presentable || !selfBound || !externallyBound) {
    return { approval_valid: false, presentable: false, code: CODES.STALE_REVISION, lineage };
  }
  return { approval_valid: true, presentable: true, code: null, lineage };
}

/** Record a typed pause while preserving every existing identity and digest. */
export function recordInterrupt(envelope, code, { observedAt, reasonRef, referenceOptions = {} } = {}) {
  const baselineIssues = validateJourneyEnvelope(envelope, referenceOptions);
  if (baselineIssues.length > 0 || !INTERRUPT_STATES.includes(code) || !PROGRESS_INDEX.has(envelope?.state)) {
    return {
      ok: false,
      code: baselineIssues[0]?.code ?? CODES.HANDOFF_INVALID,
      issues: baselineIssues.length > 0
        ? baselineIssues
        : [issue(CODES.HANDOFF_INVALID, '$.state', `cannot record interrupt ${code}`)],
    };
  }
  const minimum = PROGRESS_INDEX.get(INTERRUPT_MINIMUM[code]);
  if (PROGRESS_INDEX.get(envelope.last_good_state) < minimum ||
      (code === 'NO_ARTICLE' && envelope.last_good_state !== 'SELECTED')) {
    return {
      ok: false,
      code: CODES.HANDOFF_INVALID,
      issues: [issue(CODES.HANDOFF_INVALID, '$.last_good_state',
        `${code} is not reachable from ${envelope.last_good_state}`)],
    };
  }
  const next = clone(envelope);
  next.state = code;
  next.updated_at = observedAt;
  next.interruption = {
    code,
    observed_at: observedAt,
    ...(reasonRef ? { reason_ref: clone(reasonRef) } : {}),
  };
  const issues = validateJourneyEnvelope(next, referenceOptions);
  return issues.length > 0
    ? { ok: false, code: issues[0].code, issues }
    : { ok: true, code, envelope: next, terminal: code === 'NO_ARTICLE', recovery_operation: RESUME_OPERATIONS[code] ?? null };
}
