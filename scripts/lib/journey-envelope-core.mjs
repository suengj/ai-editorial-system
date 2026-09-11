/**
 * Journey envelope — SUE-790.
 *
 * This module validates and reads a reference envelope. It deliberately has
 * no writer, renderer, materializer, publisher, deployment, or approval-grant
 * operation. Owner decisions and downstream outcomes are recorded only by
 * immutable references and digests.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { classifyArtifact } from './lineage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
export const SCHEMA_PATH = resolve(ROOT, 'schemas/journey-envelope.schema.json');

export const loadSchema = (path = SCHEMA_PATH) => JSON.parse(readFileSync(path, 'utf8'));

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

export function assetDigestSetHash(assetDigests) {
  return createHash('sha256').update(JSON.stringify(assetDigests), 'utf8').digest('hex');
}

function validRelativePath(path) {
  return typeof path === 'string' && path.length > 0 && !path.startsWith('/') &&
    !path.includes('\\') && !path.split('/').some((part) => part === '..' || part === '');
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

function requireAtLeast(envelope, state, fields, issues) {
  if ((PROGRESS_INDEX.get(envelope?.last_good_state) ?? -1) < PROGRESS_INDEX.get(state)) return;
  for (const field of fields) {
    if (envelope?.[field] === undefined) {
      issues.push(issue(CODES.HANDOFF_INVALID, `$.${field}`,
        `${state} or later requires ${field}`));
    }
  }
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

/** Validate structure plus the cross-field invariants JSON Schema cannot express. */
export function validateJourneyEnvelope(envelope, { schema = loadSchema() } = {}) {
  const issues = [];

  for (const error of validate(envelope, schema)) {
    issues.push(issue(CODES.HANDOFF_INVALID, error.path, error.message));
  }

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return issues;

  for (const { ref, path } of walkFileRefs(envelope)) {
    if (!validRelativePath(ref.path)) {
      issues.push(issue(CODES.HANDOFF_INVALID, `${path}.path`,
        'file references must use a non-empty repository-relative path without empty or parent segments'));
    }
  }

  const progressIndex = PROGRESS_INDEX.get(envelope.last_good_state);
  if (PROGRESS_INDEX.has(envelope.state)) {
    if (envelope.state !== envelope.last_good_state) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.last_good_state',
        'a progress state must equal last_good_state'));
    }
    if (envelope.interruption !== undefined) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.interruption',
        'a progress state cannot retain an interruption record'));
    }
  } else if (INTERRUPT_STATES.includes(envelope.state)) {
    if (envelope.interruption?.code !== envelope.state) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.interruption.code',
        'an interrupt state must have a matching interruption code'));
    }
    const minimum = PROGRESS_INDEX.get(INTERRUPT_MINIMUM[envelope.state]);
    if (progressIndex === undefined || progressIndex < minimum) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.last_good_state',
        `${envelope.state} is not reachable from ${envelope.last_good_state ?? '<missing>'}`));
    }
  }

  if ((progressIndex ?? -1) >= PROGRESS_INDEX.get('SELECTED') && envelope.candidate?.selection === null) {
    issues.push(issue(CODES.SELECTION_REQUIRED, '$.candidate.selection',
      'a candidate without explicit human selection cannot advance past RECEIVED'));
  }

  if (envelope.dossier?.evidence_role === 'primary') {
    issues.push(issue(CODES.DERIVED_EVIDENCE, '$.dossier.evidence_role',
      'an intelligence_dossier is derived scaffolding and cannot become primary evidence'));
  }

  if (envelope.dossier && envelope.candidate?.slug) {
    const filename = typeof envelope.dossier.path === 'string'
      ? envelope.dossier.path.slice('intelligence/dossiers/'.length)
      : '';
    if (filename !== `${envelope.candidate.slug}.md` &&
        !filename.startsWith(`${envelope.candidate.slug}-`)) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.dossier.path',
        'the dossier path must identify the selected candidate slug or one of its dated refresh variants'));
    }
  }

  if (envelope.candidate?.slug && envelope.journey_id !== `journey:${envelope.candidate.slug}`) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.journey_id',
      'journey_id must encode the selected candidate slug'));
  }

  requireAtLeast(envelope, 'DRAFT_READY', ['dossier', 'article_ref'], issues);
  requireAtLeast(envelope, 'APPROVED_REVISION', ['approved_revision'], issues);
  requireAtLeast(envelope, 'ASSETS_LOCKED', ['handoff_receipt_ref', 'asset_bindings'], issues);
  requireAtLeast(envelope, 'PUBLISH_ACCEPTED', ['publish_run'], issues);
  requireAtLeast(envelope, 'SOURCE_COMMITTED', ['source_commit'], issues);
  requireAtLeast(envelope, 'ARTIFACT_DEPLOYED', ['deployed_artifact'], issues);
  requireAtLeast(envelope, 'LIVE_VERIFIED', ['live_verification'], issues);

  const approval = envelope.approved_revision;
  if (approval) {
    if (assetDigestSetHash(approval.asset_digests ?? []) !== approval.asset_digest_set_hash) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.approved_revision.asset_digest_set_hash',
        'asset_digest_set_hash must be sha256(JSON.stringify(asset_digests)) in exact order'));
    }
    if (envelope.state !== 'STALE_REVISION' && envelope.article_ref &&
        !same(approval.article_ref, envelope.article_ref)) {
      issues.push(issue(CODES.STALE_REVISION, '$.approved_revision.article_ref',
        'the recorded publish approval does not bind the current exact article revision'));
    }
  }

  if (Array.isArray(envelope.asset_bindings)) {
    const digests = approval?.asset_digests ?? [];
    if (envelope.asset_bindings.length !== digests.length) {
      issues.push(issue(CODES.HANDOFF_INVALID, '$.asset_bindings',
        'asset_bindings must have one entry for each ordered approved asset digest'));
    }
    envelope.asset_bindings.forEach((binding, index) => {
      if (binding?.receipt_artifact_index !== index) {
        issues.push(issue(CODES.HANDOFF_INVALID, `$.asset_bindings[${index}].receipt_artifact_index`,
          'asset bindings must be contiguous and ordered exactly like the handoff receipt artifacts'));
      }
      if (binding?.asset_sha256 !== digests[index] && envelope.state !== 'STALE_REVISION') {
        issues.push(issue(CODES.STALE_REVISION, `$.asset_bindings[${index}].asset_sha256`,
          'the per-asset visual approval and publish-gate approval do not bind the same current asset digest'));
      }
      if (envelope.article_ref && binding?.article_ref?.article_id !== envelope.article_ref.article_id) {
        issues.push(issue(CODES.HANDOFF_INVALID, `$.asset_bindings[${index}].article_ref.article_id`,
          'an asset lineage must belong to the journey article'));
      }
      if (envelope.state !== 'STALE_REVISION' && envelope.article_ref &&
          (progressIndex ?? -1) >= PROGRESS_INDEX.get('ASSETS_LOCKED')) {
        const lineage = classifyArtifact({ article_ref: binding?.article_ref }, articleForLineage(envelope.article_ref));
        if (!lineage.presentable) {
          issues.push(issue(CODES.STALE_REVISION, `$.asset_bindings[${index}].article_ref`,
            `the recorded visual approval is ${lineage.level} against the current article revision`));
        }
      }
    });
  }

  if (envelope.live_verification &&
      (Object.hasOwn(envelope.live_verification, 'media_url') !==
       Object.hasOwn(envelope.live_verification, 'media_sha256'))) {
    issues.push(issue(CODES.HANDOFF_INVALID, '$.live_verification',
      'media_url and media_sha256 must either both be present or both be absent'));
  }

  return issues;
}

export function validateJourneyEnvelopeFile(path, options = {}) {
  let envelope;
  try {
    envelope = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return [issue(CODES.HANDOFF_INVALID, path, `unparseable journey envelope: ${error.message}`)];
  }
  return validateJourneyEnvelope(envelope, options);
}

/**
 * Rehydrate only from the persisted bytes. No module or process state is used.
 * The returned resume point is the last good progress state for interruptions.
 */
export function recoverJourneyState(serialized, options = {}) {
  let envelope;
  try {
    envelope = JSON.parse(serialized);
  } catch (error) {
    return {
      ok: false,
      code: CODES.HANDOFF_INVALID,
      issues: [issue(CODES.HANDOFF_INVALID, '$', `unparseable journey envelope: ${error.message}`)],
    };
  }
  const issues = validateJourneyEnvelope(envelope, options);
  if (issues.length > 0) return { ok: false, code: issues[0].code, issues };
  return {
    ok: true,
    code: null,
    envelope,
    state: envelope.state,
    last_good_state: envelope.last_good_state,
    resume_from: INTERRUPT_STATES.includes(envelope.state) ? envelope.last_good_state : envelope.state,
  };
}

/** Return the complete linked identity chain without resolving or copying bodies. */
export function reconstructIdentityChain(envelope, options = {}) {
  const issues = validateJourneyEnvelope(envelope, options);
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
      candidate: clone(envelope.candidate),
      dossier: clone(envelope.dossier),
      article_ref: clone(envelope.article_ref),
      handoff_receipt_ref: clone(envelope.handoff_receipt_ref),
      assets: envelope.asset_bindings.map((binding, index) => ({
        receipt_artifact_index: binding.receipt_artifact_index,
        asset_sha256: binding.asset_sha256,
        article_ref: clone(binding.article_ref),
        visual_approval: clone(binding.visual_approval),
      })),
      approved_revision: clone(envelope.approved_revision),
      publish_run: clone(envelope.publish_run),
      source_commit: clone(envelope.source_commit),
      deployed_artifact: clone(envelope.deployed_artifact),
      live_verification: clone(envelope.live_verification),
    },
  };
}

/** Exact publish-gate binding. Any article or ordered digest drift is refused. */
export function assessPublishGate(envelope, { articleRef, assetDigests } = {}) {
  const baselineIssues = validateJourneyEnvelope(envelope);
  if (baselineIssues.length > 0) {
    return { accepted: false, code: baselineIssues[0].code, issues: baselineIssues };
  }
  if (!articleRef || typeof articleRef !== 'object' || !Array.isArray(assetDigests)) {
    const invalid = issue(CODES.HANDOFF_INVALID, '$.approved_revision',
      'publish-gate assessment requires a current article_ref and ordered asset digest array');
    return { accepted: false, code: CODES.HANDOFF_INVALID, issues: [invalid] };
  }
  const approval = envelope.approved_revision;
  const articleMatches = same(approval?.article_ref, articleRef);
  const digestsMatch = same(approval?.asset_digests, assetDigests) &&
    approval?.asset_digest_set_hash === assetDigestSetHash(assetDigests);
  if (!articleMatches || !digestsMatch) {
    const why = !articleMatches ? 'article revision' : 'ordered asset digest set';
    const stale = issue(CODES.STALE_REVISION, '$.approved_revision',
      `publish approval does not bind the current ${why}`);
    return { accepted: false, code: CODES.STALE_REVISION, issues: [stale] };
  }
  return { accepted: true, code: null, issues: [] };
}

/**
 * Check one recorded visual decision. The approval survives cosmetic article
 * drift only when the asset digest at its receipt position is unchanged.
 */
export function assessAssetApproval(envelope, receiptArtifactIndex, { articleRef, assetDigest } = {}) {
  const baselineIssues = validateJourneyEnvelope(envelope);
  if (baselineIssues.length > 0) {
    return {
      approval_valid: false,
      presentable: false,
      code: baselineIssues[0].code,
      lineage: null,
      issues: baselineIssues,
    };
  }
  const binding = envelope?.asset_bindings?.[receiptArtifactIndex];
  if (!binding || binding.receipt_artifact_index !== receiptArtifactIndex || !binding.asset_sha256) {
    return {
      approval_valid: false,
      presentable: false,
      code: CODES.HANDOFF_INVALID,
      lineage: null,
    };
  }

  const lineage = classifyArtifact({ article_ref: binding.article_ref }, articleForLineage(articleRef));
  if (assetDigest !== binding.asset_sha256 || !lineage.presentable) {
    return {
      approval_valid: false,
      presentable: false,
      code: CODES.STALE_REVISION,
      lineage,
    };
  }
  return {
    approval_valid: true,
    presentable: true,
    code: null,
    lineage,
  };
}

/**
 * Record a typed pause without generating or mutating text/assets. The only
 * changed fields are state, updated_at, and interruption; last_good_state and
 * every identity/digest binding are preserved byte-for-byte.
 */
export function recordInterrupt(envelope, code, { observedAt, reasonRef } = {}) {
  const baselineIssues = validateJourneyEnvelope(envelope);
  if (baselineIssues.length > 0 || !INTERRUPT_STATES.includes(code)) {
    return {
      ok: false,
      code: baselineIssues[0]?.code ?? CODES.HANDOFF_INVALID,
      issues: baselineIssues.length > 0
        ? baselineIssues
        : [issue(CODES.HANDOFF_INVALID, '$.state', `unknown interrupt state ${code}`)],
    };
  }
  const minimum = PROGRESS_INDEX.get(INTERRUPT_MINIMUM[code]);
  if (PROGRESS_INDEX.get(envelope.last_good_state) < minimum) {
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
  const issues = validateJourneyEnvelope(next);
  return issues.length > 0
    ? { ok: false, code: issues[0].code, issues }
    : { ok: true, code, envelope: next, effects: [] };
}
