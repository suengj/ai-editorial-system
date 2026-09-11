#!/usr/bin/env node
/** SUE-790 journey-envelope acceptance and anti-vacuity regression tests. */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES,
  INTERRUPT_STATES,
  PROGRESS_STATES,
  REFERENCE_AUTHORITIES,
  approvalBindingSha256,
  assetDigestSetHash,
  assessAssetApproval,
  assessPublishGate,
  canonicalRecordSha256,
  createRecordBundleResolver,
  deriveProgressState,
  journeyBindingSha256,
  parseJourneyJson,
  reconstructIdentityChain,
  recordInterrupt,
  recoverJourneyState,
  resolveAndVerifyJourneyReference,
  resumeJourney,
  validateJourneyEnvelope,
  validateJourneyEnvelopeFile,
  validateJourneyReferences,
  validateSUE789Interop,
} from './lib/journey-envelope-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXAMPLE = resolve(ROOT, 'schemas/examples/journey-envelope.example.json');
const DENY = resolve(ROOT, 'scripts/fixtures/journey-envelope/deny-primary-dossier.json');
const RECORDS = resolve(ROOT, 'scripts/fixtures/journey-envelope/cross-repo-records.json');
const base = parseJourneyJson(readFileSync(EXAMPLE), EXAMPLE);
const records = parseJourneyJson(readFileSync(RECORDS), RECORDS);
const referenceOptions = Object.freeze({
  resolveExternalRecord: createRecordBundleResolver(records),
});
const clone = (value) => JSON.parse(JSON.stringify(value));
const codes = (envelope, options = referenceOptions) =>
  validateJourneyEnvelope(envelope, options).map((entry) => entry.code);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};

function assertNamedMutation(name, expectedCode, mutate, source = base) {
  const candidate = clone(source);
  const baseline = codes(candidate);
  mutate(candidate);
  const got = codes(candidate);
  check(`${name} fails ${expectedCode} from a validator-clean baseline`,
    baseline.length === 0 && got.includes(expectedCode),
    `baseline=[${baseline.join(', ')}] got=[${[...new Set(got)].join(', ')}]`);
}

function atProgress(state) {
  const envelope = clone(base);
  envelope.state = state;
  envelope.last_good_state = state;
  delete envelope.interruption;
  const index = PROGRESS_STATES.indexOf(state);
  if (index < 9) {
    delete envelope.live_verification_ref;
    delete envelope.live_verification;
  }
  if (index < 8) delete envelope.deployed_artifact;
  if (index < 7) delete envelope.source_commit;
  if (index < 6) delete envelope.publish_run;
  if (index < 5) {
    delete envelope.handoff_receipt_ref;
    delete envelope.asset_bindings;
  }
  if (index < 4) delete envelope.approved_revision;
  if (index < 3) delete envelope.review_ref;
  if (index < 2) {
    delete envelope.dossier;
    delete envelope.article_ref;
    delete envelope.journey_binding_sha256;
  }
  if (index < 1) envelope.candidate.selection = null;
  return envelope;
}

function staleTextEnvelope({ material = false } = {}) {
  const envelope = clone(base);
  envelope.article_ref.version_number += 1;
  envelope.article_ref.content_hash = '1'.repeat(64);
  if (material) envelope.article_ref.claims_hash = '0'.repeat(64);
  envelope.journey_binding_sha256 = journeyBindingSha256(
    envelope.candidate, envelope.dossier, envelope.article_ref,
  );
  envelope.state = CODES.STALE_REVISION;
  envelope.last_good_state = 'LIVE_VERIFIED';
  envelope.interruption = {
    code: CODES.STALE_REVISION,
    observed_at: '2026-09-11T06:31:00Z',
  };
  return envelope;
}

console.log('acceptance 1 — cross-record round-trip identity agreement');
{
  const envelopeIssues = codes(base);
  const referenceIssues = validateJourneyReferences(base, records, referenceOptions);
  const result = reconstructIdentityChain(base, records, referenceOptions);
  check('complete envelope and separately persisted record metadata agree',
    envelopeIssues.length === 0 && referenceIssues.length === 0 && result.ok,
    JSON.stringify({ envelopeIssues, referenceIssues }));
  check('round-trip resolves independent candidate, dossier, handoff, approval, deployment, and live identities',
    result.chain.candidate.slug === records.candidate_ledger.record.candidate.slug &&
      result.chain.dossier.content_sha256 === records.dossier_source.record.identity.content_sha256 &&
      result.chain.article_ref.content_hash === records.handoff_receipt.record.article_ref.content_hash &&
      result.chain.assets.map((entry) => entry.asset_sha256).join(',') ===
        records.handoff_receipt.record.artifacts.map((entry) => entry.asset_sha256).join(',') &&
      result.chain.approved_revision.binding_sha256 === records.publish_approval.record.binding_sha256 &&
      result.chain.deployed_artifact.deployment_id === records.deployment.record.deployment_id &&
      result.chain.live_verification.article_body_sha256 === records.live_verification.record.result.article_body_sha256);

  const changedRecords = clone(records);
  changedRecords.handoff_receipt.record.artifacts[0].asset_sha256 = '0'.repeat(64);
  const changedCodes = validateJourneyReferences(base, changedRecords, referenceOptions).map((entry) => entry.code);
  check(`caller-edited receipt metadata fails named ${CODES.HANDOFF_INVALID} against hash-verified bytes`,
    referenceIssues.length === 0 && changedCodes.includes(CODES.HANDOFF_INVALID),
    `got=[${[...new Set(changedCodes)].join(', ')}]`);
}

console.log('acceptance 2 — record-derived restart and replay');
{
  for (const state of PROGRESS_STATES) {
    const envelope = atProgress(state);
    const recovered = recoverJourneyState(JSON.stringify(envelope), referenceOptions);
    check(`${state} is derived and recovered from persisted records`,
      codes(envelope).length === 0 && deriveProgressState(envelope, referenceOptions) === state &&
        recovered.ok && recovered.state === state && recovered.resume_from === state);
  }

  const interruptSources = {
    NEEDS_EVIDENCE: atProgress('RECEIVED'),
    NO_ARTICLE: atProgress('SELECTED'),
    BLOCKED_AUTH: atProgress('SELECTED'),
    BLOCKED_TRANSPORT: atProgress('PUBLISH_ACCEPTED'),
    MEDIA_DIGEST_MISMATCH: atProgress('ASSETS_LOCKED'),
    ARTICLE_ANCHOR_MISSING: atProgress('ASSETS_LOCKED'),
    GIT_CONCURRENT_UPDATE: atProgress('PUBLISH_ACCEPTED'),
    DEPLOYMENT_PARTIAL: atProgress('SOURCE_COMMITTED'),
  };
  for (const code of INTERRUPT_STATES.filter((entry) => entry !== CODES.STALE_REVISION)) {
    const source = interruptSources[code];
    const recorded = recordInterrupt(source, code, {
      observedAt: '2026-09-11T07:00:00Z', referenceOptions,
    });
    const recovered = recorded.ok
      ? recoverJourneyState(JSON.stringify(recorded.envelope), referenceOptions)
      : null;
    const terminal = code === CODES.NO_ARTICLE;
    check(`${code} recovery preserves its named code and ${terminal ? 'terminates' : 'resumes from derived progress'}`,
      codes(source).length === 0 && recorded.ok && recorded.envelope.interruption.code === code &&
        recovered?.ok && recovered.state === code && recovered.terminal === terminal &&
        recovered.resume_from === (terminal ? null : source.state),
      JSON.stringify(recorded));
  }
  const stale = staleTextEnvelope();
  const staleRecovered = recoverJourneyState(JSON.stringify(stale), referenceOptions);
  check(`${CODES.STALE_REVISION} recovery preserves its named code and derived LIVE_VERIFIED resume point`,
    codes(stale).length === 0 && staleRecovered.ok && staleRecovered.state === CODES.STALE_REVISION &&
      staleRecovered.resume_from === 'LIVE_VERIFIED');

  const malformed = recoverJourneyState(JSON.stringify(base).replace(/^\{/, '{not-json'), referenceOptions);
  check(`persisted-byte corruption fails named ${CODES.HANDOFF_INVALID}`,
    !malformed.ok && malformed.code === CODES.HANDOFF_INVALID);
}

console.log('acceptance 3 — text-only change separates publish and visual bindings');
{
  const stale = staleTextEnvelope();
  const visual = assessAssetApproval(stale, 0, {
    articleRef: stale.article_ref,
    assetDigest: stale.asset_bindings[0].asset_sha256,
    referenceOptions,
  });
  const publish = assessPublishGate(stale, {
    articleRef: stale.approved_revision.article_ref,
    assetDigests: stale.approved_revision.asset_digests,
    referenceOptions,
  });
  check('classifyArtifact reports cosmetic and preserves the unrelated visual decision without regeneration',
    codes(stale).length === 0 && visual.lineage?.level === 'cosmetic' && visual.lineage.presentable &&
      visual.approval_valid && visual.code === null, JSON.stringify(visual));
  check(`the same envelope refuses even its old approved tuple with named ${CODES.STALE_REVISION}`,
    codes(stale).length === 0 && !publish.accepted && publish.code === CODES.STALE_REVISION,
    JSON.stringify(publish));

  const unknownArticle = { ...base.article_ref };
  delete unknownArticle.content_hash;
  const unknown = assessAssetApproval(base, 0, {
    articleRef: unknownArticle,
    assetDigest: base.asset_bindings[0].asset_sha256,
    referenceOptions,
  });
  check(`unknown lineage fails safe with named ${CODES.STALE_REVISION} from a validator-clean baseline`,
    codes(base).length === 0 && unknown.lineage?.level === 'unknown' && !unknown.presentable &&
      !unknown.approval_valid && unknown.code === CODES.STALE_REVISION, JSON.stringify(unknown));
}

console.log('acceptance 4 — material claim change stales the dependent visual');
{
  const stale = staleTextEnvelope({ material: true });
  const result = assessAssetApproval(stale, 0, {
    articleRef: stale.article_ref,
    assetDigest: stale.asset_bindings[0].asset_sha256,
    referenceOptions,
  });
  check(`claims_hash change is material and fails named ${CODES.STALE_REVISION} from a validator-clean stale baseline`,
    codes(stale).length === 0 && result.lineage?.level === 'material' && !result.presentable &&
      !result.approval_valid && result.code === CODES.STALE_REVISION, JSON.stringify(result));
}

console.log('acceptance 5 — exact ordered asset set and self-binding approvals');
{
  const baseline = codes(base);
  const accepted = assessPublishGate(base, {
    articleRef: base.article_ref,
    assetDigests: base.approved_revision.asset_digests,
    referenceOptions,
  });
  check('exact current article and ordered digest set passes the recorded publish decision',
    baseline.length === 0 && accepted.accepted && accepted.code === null);
  const unresolvedGate = assessPublishGate(base, {
    articleRef: base.article_ref,
    assetDigests: base.approved_revision.asset_digests,
  });
  const unresolvedVisual = assessAssetApproval(base, 0, {
    articleRef: base.article_ref,
    assetDigest: base.asset_bindings[0].asset_sha256,
  });
  check(`unresolved approval pointers fail closed with named ${CODES.BLOCKED_TRANSPORT} from a clean baseline`,
    baseline.length === 0 && !unresolvedGate.accepted && unresolvedGate.code === CODES.BLOCKED_TRANSPORT &&
      !unresolvedVisual.approval_valid && unresolvedVisual.code === CODES.BLOCKED_TRANSPORT);

  const mutations = [
    ['substitution', ['0'.repeat(64), base.approved_revision.asset_digests[1]]],
    ['addition', [...base.approved_revision.asset_digests, '0'.repeat(64)]],
    ['removal', [base.approved_revision.asset_digests[0]]],
    ['reorder', [...base.approved_revision.asset_digests].reverse()],
  ];
  for (const [name, assetDigests] of mutations) {
    const result = assessPublishGate(base, {
      articleRef: base.article_ref,
      assetDigests,
      referenceOptions,
    });
    check(`${name} refuses the publish gate with named ${CODES.STALE_REVISION} from a validator-clean baseline`,
      baseline.length === 0 && !result.accepted && result.code === CODES.STALE_REVISION,
      JSON.stringify(result));
  }
  const visual = assessAssetApproval(base, 0, {
    articleRef: base.article_ref,
    assetDigest: '0'.repeat(64),
    referenceOptions,
  });
  check(`changed visual bytes inherit no approval and fail named ${CODES.STALE_REVISION}`,
    baseline.length === 0 && !visual.approval_valid && visual.code === CODES.STALE_REVISION);
  check('digest-set hash is deterministic and order-sensitive',
    assetDigestSetHash(base.approved_revision.asset_digests) === base.approved_revision.asset_digest_set_hash &&
      assetDigestSetHash([...base.approved_revision.asset_digests].reverse()) !== base.approved_revision.asset_digest_set_hash);

  const coordinated = clone(base);
  const coordinatedBaseline = codes(coordinated);
  {
    const envelope = coordinated;
      envelope.article_ref = {
        ...envelope.article_ref,
        version_number: 5,
        content_hash: '1'.repeat(64),
        claims_hash: '2'.repeat(64),
      };
      envelope.journey_binding_sha256 = journeyBindingSha256(
        envelope.candidate, envelope.dossier, envelope.article_ref,
      );
      envelope.approved_revision.article_ref = clone(envelope.article_ref);
      envelope.approved_revision.asset_digests = ['3'.repeat(64), '4'.repeat(64)];
      envelope.approved_revision.asset_digest_set_hash =
        assetDigestSetHash(envelope.approved_revision.asset_digests);
      envelope.asset_bindings.forEach((binding, index) => {
        binding.article_ref = clone(envelope.article_ref);
        binding.asset_sha256 = envelope.approved_revision.asset_digests[index];
      });
  }
  const coordinatedCodes = codes(coordinated);
  const coordinatedGate = assessPublishGate(coordinated, {
    articleRef: coordinated.article_ref,
    assetDigests: coordinated.approved_revision.asset_digests,
    referenceOptions,
  });
  const coordinatedVisual = assessAssetApproval(coordinated, 0, {
    articleRef: coordinated.article_ref,
    assetDigest: coordinated.asset_bindings[0].asset_sha256,
    referenceOptions,
  });
  check(`coordinated rewrite retaining old decision refs and binding digests fails named ${CODES.STALE_REVISION}`,
    coordinatedBaseline.length === 0 && coordinatedCodes.includes(CODES.STALE_REVISION) &&
      !coordinatedGate.accepted && coordinatedGate.code === CODES.STALE_REVISION &&
      !coordinatedVisual.approval_valid && coordinatedVisual.code === CODES.STALE_REVISION,
    JSON.stringify({ coordinatedCodes, coordinatedGate, coordinatedVisual }));

  const rebound = clone(coordinated);
  rebound.approved_revision.binding_sha256 = approvalBindingSha256(
    rebound.approved_revision.article_ref, rebound.approved_revision.asset_digests,
  );
  rebound.asset_bindings.forEach((binding) => {
    binding.visual_approval.binding_sha256 = approvalBindingSha256(
      binding.article_ref, [binding.asset_sha256],
    );
  });
  const reboundGate = assessPublishGate(rebound, {
    articleRef: rebound.article_ref,
    assetDigests: rebound.approved_revision.asset_digests,
    referenceOptions,
  });
  const reboundVisual = assessAssetApproval(rebound, 0, {
    articleRef: rebound.article_ref,
    assetDigest: rebound.asset_bindings[0].asset_sha256,
    referenceOptions,
  });
  const reboundReferences = validateJourneyReferences(rebound, records, referenceOptions).map((entry) => entry.code);
  const reboundRecovery = recoverJourneyState(JSON.stringify(rebound), referenceOptions);
  check(`shared verification catches recomputed forged envelope bindings with named ${CODES.STALE_REVISION}`,
    coordinatedBaseline.length === 0 && validateJourneyReferences(base, records, referenceOptions).length === 0 &&
      codes(rebound).includes(CODES.STALE_REVISION) && !reboundRecovery.ok &&
      reboundRecovery.code === CODES.STALE_REVISION &&
      !reboundGate.accepted && reboundGate.code === CODES.STALE_REVISION &&
      !reboundVisual.approval_valid && reboundVisual.code === CODES.STALE_REVISION &&
      reboundReferences.includes(CODES.STALE_REVISION),
    JSON.stringify({ reboundCodes: codes(rebound), reboundRecovery, reboundGate, reboundVisual, reboundReferences }));
}

console.log('acceptance 6 — blocked transport executes only the recovery seam');
{
  const publishAccepted = atProgress('PUBLISH_ACCEPTED');
  const paused = recordInterrupt(publishAccepted, CODES.BLOCKED_TRANSPORT, {
    observedAt: '2026-09-11T07:10:00Z',
    referenceOptions,
  });
  let transportObservations = 0;
  let generated = 0;
  let published = 0;
  const seen = new Set();
  const adapters = {
    inspectTransport({ idempotency_key: key }) {
      transportObservations += 1;
      const replay = seen.has(key);
      seen.add(key);
      return { reachable: false, replay };
    },
    generateText() { generated += 1; },
    regenerateAsset() { generated += 1; },
    publish() { published += 1; },
  };
  const serialized = JSON.stringify(paused.envelope);
  const first = resumeJourney(serialized, adapters, referenceOptions);
  const replay = resumeJourney(serialized, adapters, referenceOptions);
  check(`transport pause is validator-clean and retains named ${CODES.BLOCKED_TRANSPORT}`,
    paused.ok && codes(paused.envelope).length === 0 && paused.envelope.interruption.code === CODES.BLOCKED_TRANSPORT);
  check('natural resume and replay execute the transport probe with one stable idempotency identity',
    first.ok && replay.ok && first.invoked && replay.invoked &&
      first.operation === 'inspectTransport' && first.idempotency_key === replay.idempotency_key &&
      first.observation.replay === false && replay.observation.replay === true && transportObservations === 2);
  check('natural resume and replay invoke no text, asset, approval, or publication seam',
    generated === 0 && published === 0);
}

console.log('acceptance 7 — NO_ARTICLE is terminal; NEEDS_EVIDENCE remains resumable');
{
  const selected = atProgress('SELECTED');
  const noArticle = recordInterrupt(selected, CODES.NO_ARTICLE, {
    observedAt: '2026-09-11T07:20:00Z', referenceOptions,
  });
  let invoked = 0;
  const terminalResume = resumeJourney(JSON.stringify(noArticle.envelope), {
    inspectEvidence() { invoked += 1; },
  }, referenceOptions);
  check(`${CODES.NO_ARTICLE} is terminal after validator-clean SELECTED and cannot resume downstream`,
    codes(selected).length === 0 && noArticle.ok && noArticle.terminal && terminalResume.ok &&
      terminalResume.terminal && terminalResume.resume_from === null && !terminalResume.invoked && invoked === 0);
  assertNamedMutation('NO_ARTICLE carrying downstream article identity', CODES.HANDOFF_INVALID,
    (envelope) => {
      envelope.dossier = clone(base.dossier);
      envelope.article_ref = clone(base.article_ref);
      envelope.journey_binding_sha256 = journeyBindingSha256(
        envelope.candidate, envelope.dossier, envelope.article_ref,
      );
    }, noArticle.envelope);
  assertNamedMutation('completed LIVE_VERIFIED chain relabelled NO_ARTICLE', CODES.HANDOFF_INVALID,
    (envelope) => {
      envelope.state = CODES.NO_ARTICLE;
      envelope.interruption = {
        code: CODES.NO_ARTICLE,
        observed_at: '2026-09-11T07:20:01Z',
      };
    });

  const received = atProgress('RECEIVED');
  const needs = recordInterrupt(received, CODES.NEEDS_EVIDENCE, {
    observedAt: '2026-09-11T07:21:00Z', referenceOptions,
  });
  const needsRecovered = recoverJourneyState(JSON.stringify(needs.envelope), referenceOptions);
  check(`${CODES.NEEDS_EVIDENCE} is reachable and resumes from RECEIVED`,
    codes(received).length === 0 && needs.ok && needsRecovered.ok &&
      needsRecovered.resume_from === 'RECEIVED' && !needsRecovered.terminal);

  assertNamedMutation('whitespace-only selected_by', CODES.SELECTION_REQUIRED,
    (envelope) => { envelope.candidate.selection.selected_by = '   '; });
  assertNamedMutation('impossible month in selection_date', CODES.SELECTION_REQUIRED,
    (envelope) => { envelope.candidate.selection.selection_date = '2026-99-11'; });
  assertNamedMutation('impossible day in selection_date', CODES.SELECTION_REQUIRED,
    (envelope) => { envelope.candidate.selection.selection_date = '2026-02-30'; });
  const unselected = atProgress('RECEIVED');
  const receivedBaseline = codes(unselected);
  unselected.state = 'SELECTED';
  unselected.last_good_state = 'SELECTED';
  const unselectedCodes = codes(unselected);
  check(`null selection cannot advance and fails named ${CODES.SELECTION_REQUIRED} from clean RECEIVED`,
    receivedBaseline.length === 0 && unselectedCodes.includes(CODES.SELECTION_REQUIRED));
}

console.log('acceptance 8 — exact dossier identity stays derived, bound, and non-primary');
{
  const denyIssues = validateJourneyEnvelopeFile(DENY, referenceOptions);
  const denyCodes = denyIssues.map((entry) => entry.code);
  check(`committed deny fixture fails exactly named ${CODES.DERIVED_EVIDENCE}`,
    denyIssues.length === 1 && denyCodes[0] === CODES.DERIVED_EVIDENCE,
    `got=[${[...new Set(denyCodes)].join(', ')}]`);
  assertNamedMutation('promoting a dossier to primary evidence', CODES.DERIVED_EVIDENCE,
    (envelope) => {
      envelope.dossier.evidence_role = 'primary';
      envelope.journey_binding_sha256 = journeyBindingSha256(
        envelope.candidate, envelope.dossier, envelope.article_ref,
      );
    });
  assertNamedMutation('swapping to another exact dossier revision while retaining the old identity binding',
    CODES.STALE_REVISION, (envelope) => {
      envelope.dossier.commit = '6bf6b44';
      envelope.dossier.path = 'intelligence/dossiers/agent-cost-curve-2026-09-10.md';
      envelope.dossier.content_sha256 = '8'.repeat(64);
    });
  assertNamedMutation('using a prefix-only dossier name', CODES.HANDOFF_INVALID,
    (envelope) => { envelope.dossier.path = 'intelligence/dossiers/agent-cost-curve-imposter.md'; });
}

console.log('acceptance 9 — exact downstream interop, authority, and command wiring');
{
  const literalResult = clone(records.live_verification.record.result);
  const interopBaseline = validateSUE789Interop({
    manifest: records.publish_run.record.manifest,
    receipt: records.publish_run.record.receipt,
    result: literalResult,
  });
  check('literal suengj-com LIVE_VERIFIED result with prefixed digests is accepted unchanged',
    interopBaseline.length === 0 && JSON.stringify(literalResult) === JSON.stringify(base.live_verification),
    JSON.stringify(interopBaseline));
  const bareResult = clone(literalResult);
  bareResult.article_body_sha256 = bareResult.article_body_sha256.slice('sha256:'.length);
  const bareCodes = validateSUE789Interop({
    manifest: records.publish_run.record.manifest,
    receipt: records.publish_run.record.receipt,
    result: bareResult,
  }).map((entry) => entry.code);
  check(`bare live digest fails named ${CODES.HANDOFF_INVALID} from a clean literal interop baseline`,
    interopBaseline.length === 0 && bareCodes.includes(CODES.HANDOFF_INVALID));

  const mismatchedMedia = clone(literalResult);
  mismatchedMedia.media_sha256 = `sha256:${'0'.repeat(64)}`;
  const mismatchedMediaCodes = validateSUE789Interop({
    manifest: records.publish_run.record.manifest,
    receipt: records.publish_run.record.receipt,
    result: mismatchedMedia,
  }).map((entry) => entry.code);
  check(`live/receipt media drift fails named ${CODES.MEDIA_DIGEST_MISMATCH} from a clean interop baseline`,
    interopBaseline.length === 0 && mismatchedMediaCodes.includes(CODES.MEDIA_DIGEST_MISMATCH));

  const sha64Manifest = clone(records.publish_run.record.manifest);
  sha64Manifest.expected_source_sha = 'b'.repeat(64);
  const sha64Issues = validateSUE789Interop({
    manifest: sha64Manifest,
    receipt: records.publish_run.record.receipt,
    result: literalResult,
  });
  check('a downstream-valid 64-character expected_source_sha is accepted',
    interopBaseline.length === 0 && sha64Issues.length === 0, JSON.stringify(sha64Issues));

  const shortManifest = clone(records.publish_run.record.manifest);
  shortManifest.expected_source_sha = 'b'.repeat(39);
  const shortShaCodes = validateSUE789Interop({
    manifest: shortManifest,
    receipt: records.publish_run.record.receipt,
    result: literalResult,
  }).map((entry) => entry.code);
  check(`a short expected_source_sha fails named ${CODES.HANDOFF_INVALID} from a clean interop baseline`,
    interopBaseline.length === 0 && shortShaCodes.includes(CODES.HANDOFF_INVALID));
  check('the committed expected_source_sha is downstream-valid full SHA length',
    records.publish_run.record.manifest.expected_source_sha.length === 40);

  const authorityMutations = [
    ['candidate ledger', (e) => { e.candidate.ledger_ref.repository = 'attacker/fake'; }],
    ['dossier', (e) => { e.dossier.repository = 'attacker/fake'; }],
    ['editorial review', (e) => { e.review_ref.repository = 'attacker/fake'; }],
    ['handoff receipt', (e) => { e.handoff_receipt_ref.repository = 'attacker/fake'; }],
    ['publish approval', (e) => { e.approved_revision.record_ref.repository = 'attacker/fake'; }],
    ['visual review', (e) => { e.asset_bindings[0].visual_approval.record_ref.repository = 'attacker/fake'; }],
    ['publish run', (e) => { e.publish_run.record_ref.repository = 'attacker/fake'; }],
    ['source commit', (e) => { e.source_commit.repository = 'attacker/fake'; }],
    ['deployment', (e) => { e.deployed_artifact.record_ref.repository = 'attacker/fake'; }],
    ['live verification', (e) => { e.live_verification_ref.repository = 'attacker/fake'; }],
  ];
  for (const [name, mutate] of authorityMutations) {
    assertNamedMutation(`${name} pointer to a non-authoritative repository`, CODES.HANDOFF_INVALID, mutate);
  }
  check('one declarative authority registry covers all ten durable pointer families',
    REFERENCE_AUTHORITIES.length === 11 &&
      new Set(REFERENCE_AUTHORITIES.map((entry) => entry.repository)).size === 3);

  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  check('npm run validate includes validate:journey',
    typeof pkg.scripts['validate:journey'] === 'string' && pkg.scripts.validate.includes('npm run validate:journey'));
  check('npm test includes test:journey',
    typeof pkg.scripts['test:journey'] === 'string' && pkg.scripts.test.includes('npm run test:journey'));
}

console.log('repair round 2 — fail-closed record resolution and unambiguous bytes');
{
  const baseline = codes(base);
  check('external JSON record content_sha256 is the recomputed canonical record digest',
    baseline.length === 0 &&
      canonicalRecordSha256(records.publish_approval.record) ===
        records.publish_approval.record_ref.content_sha256);

  const hashMismatch = clone(base);
  hashMismatch.approved_revision.record_ref.content_sha256 = '0'.repeat(64);
  const hashMismatchCodes = codes(hashMismatch);
  check(`external record bytes that disagree with content_sha256 fail named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && hashMismatchCodes.includes(CODES.HANDOFF_INVALID),
    `got=[${[...new Set(hashMismatchCodes)].join(', ')}]`);

  const localHashMismatch = clone(base);
  localHashMismatch.review_ref.content_sha256 = '0'.repeat(64);
  const localHashMismatchCodes = codes(localHashMismatch);
  check(`repository-local Git bytes that disagree with content_sha256 fail named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && localHashMismatchCodes.includes(CODES.HANDOFF_INVALID),
    `got=[${[...new Set(localHashMismatchCodes)].join(', ')}]`);

  const nonexistentExternal = clone(base);
  nonexistentExternal.approved_revision.record_ref.path =
    'handoffs/agent-cost-curve/nonexistent-approval.json';
  const nonexistentExternalCodes = codes(nonexistentExternal);
  const nonexistentExternalRecovery = recoverJourneyState(
    JSON.stringify(nonexistentExternal), referenceOptions,
  );
  check(`a nonexistent external approval path fails validation and recovery with named ${CODES.BLOCKED_TRANSPORT}`,
    baseline.length === 0 && nonexistentExternalCodes.includes(CODES.BLOCKED_TRANSPORT) &&
      !nonexistentExternalRecovery.ok &&
      nonexistentExternalRecovery.code === CODES.BLOCKED_TRANSPORT &&
      nonexistentExternalRecovery.state !== 'LIVE_VERIFIED');

  const nonexistentLocal = clone(base);
  nonexistentLocal.asset_bindings[0].visual_approval.record_ref.path =
    'scripts/fixtures/journey-envelope/records/nonexistent-visual-approval.json';
  const nonexistentLocalCodes = codes(nonexistentLocal);
  const nonexistentLocalRecovery = recoverJourneyState(JSON.stringify(nonexistentLocal), referenceOptions);
  check(`a nonexistent repository-local path fails validation and recovery with named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && nonexistentLocalCodes.includes(CODES.HANDOFF_INVALID) &&
      !nonexistentLocalRecovery.ok && nonexistentLocalRecovery.code === CODES.HANDOFF_INVALID &&
      nonexistentLocalRecovery.state !== 'LIVE_VERIFIED');

  const fixtureResolver = referenceOptions.resolveExternalRecord;
  const objectResolverCodes = codes(base, {
    resolveExternalRecord(ref) {
      const raw = fixtureResolver(ref);
      return raw === undefined ? undefined : parseJourneyJson(raw, 'test resolver record');
    },
  });
  check(`a resolver returning caller-parsed objects fails named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && objectResolverCodes.includes(CODES.HANDOFF_INVALID));

  const forged = clone(base);
  forged.article_ref = {
    ...forged.article_ref,
    version_number: 9,
    content_hash: '1'.repeat(64),
    claims_hash: '2'.repeat(64),
    commit: 'feedface',
  };
  forged.journey_binding_sha256 = journeyBindingSha256(
    forged.candidate, forged.dossier, forged.article_ref,
  );
  forged.approved_revision.article_ref = clone(forged.article_ref);
  forged.approved_revision.asset_digests = ['3'.repeat(64), '4'.repeat(64)];
  forged.approved_revision.asset_digest_set_hash =
    assetDigestSetHash(forged.approved_revision.asset_digests);
  forged.approved_revision.binding_sha256 = approvalBindingSha256(
    forged.article_ref, forged.approved_revision.asset_digests,
  );
  forged.asset_bindings.forEach((binding, index) => {
    binding.article_ref = clone(forged.article_ref);
    binding.asset_sha256 = forged.approved_revision.asset_digests[index];
    binding.visual_approval.binding_sha256 = approvalBindingSha256(
      binding.article_ref, [binding.asset_sha256],
    );
  });

  const forgedRecords = clone(records);
  forgedRecords.dossier_source.record.used_by_article = clone(forged.article_ref);
  forgedRecords.review.record.article_ref = clone(forged.article_ref);
  forgedRecords.handoff_receipt.record.article_ref = clone(forged.article_ref);
  forgedRecords.handoff_receipt.record.artifacts = forged.asset_bindings.map((binding) => ({
    asset_sha256: binding.asset_sha256,
  }));
  forgedRecords.publish_approval.record = clone(forged.approved_revision);
  delete forgedRecords.publish_approval.record.record_ref;
  forgedRecords.visual_approvals.forEach((wrapper, index) => {
    const binding = forged.asset_bindings[index];
    wrapper.record = {
      approved_by: binding.visual_approval.approved_by,
      approved_at: binding.visual_approval.approved_at,
      article_ref: clone(binding.article_ref),
      asset_digests: [binding.asset_sha256],
      binding_sha256: binding.visual_approval.binding_sha256,
    };
  });
  forgedRecords.publish_run.record.manifest.expected_article_sha256 = forged.article_ref.content_hash;
  const forgedOptions = {
    resolveExternalRecord: createRecordBundleResolver(forgedRecords),
  };
  const forgedReferenceCodes = validateJourneyReferences(
    forged, forgedRecords, forgedOptions,
  ).map((entry) => entry.code);
  const forgedGate = assessPublishGate(forged, {
    articleRef: forged.article_ref,
    assetDigests: forged.approved_revision.asset_digests,
    referenceOptions: forgedOptions,
  });
  const forgedVisual = assessAssetApproval(forged, 0, {
    articleRef: forged.article_ref,
    assetDigest: forged.asset_bindings[0].asset_sha256,
    referenceOptions: forgedOptions,
  });
  check(`fully forged caller metadata retaining old refs fails named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && forgedReferenceCodes.includes(CODES.HANDOFF_INVALID) &&
      !forgedGate.accepted && forgedGate.code === CODES.HANDOFF_INVALID &&
      !forgedVisual.approval_valid && forgedVisual.code === CODES.HANDOFF_INVALID,
    JSON.stringify({ forgedReferenceCodes, forgedGate, forgedVisual }));

  const duplicateEnvelope = JSON.stringify(base).replace(
    '"journey_id":', '"journey_id":"journey:forged","journey_id":',
  );
  const duplicateRecovery = recoverJourneyState(duplicateEnvelope, referenceOptions);
  check(`duplicate envelope keys fail before canonicalization with named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && !duplicateRecovery.ok &&
      duplicateRecovery.code === CODES.HANDOFF_INVALID);

  let escapedDuplicateCode = null;
  try {
    parseJourneyJson('{"a":1,"\\u0061":2}', 'escaped duplicate fixture');
  } catch (error) {
    escapedDuplicateCode = error.code;
  }
  check(`escaped-equivalent duplicate keys fail named ${CODES.HANDOFF_INVALID}`,
    escapedDuplicateCode === CODES.HANDOFF_INVALID);

  const duplicateRecordOptions = {
    resolveExternalRecord(ref) {
      const raw = fixtureResolver(ref);
      if (ref.path !== records.publish_approval.record_ref.path || raw === undefined) return raw;
      return raw.toString().replace(
        '"approved_by":"owner"',
        '"approved_by":"owner","approved_by":"forged"',
      );
    },
  };
  const duplicateRecordCodes = codes(base, duplicateRecordOptions);
  check(`duplicate referenced-record keys fail named ${CODES.HANDOFF_INVALID} from a clean baseline`,
    baseline.length === 0 && duplicateRecordCodes.includes(CODES.HANDOFF_INVALID));

  const cli = resolve(ROOT, 'scripts/validate-journey-envelope.mjs');
  const customWithRecords = spawnSync(
    process.execPath, [cli, EXAMPLE, '--records', RECORDS],
    { cwd: ROOT, encoding: 'utf8' },
  );
  check('custom-file CLI performs cross-record checking when given raw record bytes',
    customWithRecords.status === 0,
    `${customWithRecords.stdout}${customWithRecords.stderr}`);

  const cliTemp = mkdtempSync(join(tmpdir(), 'sue-790-cli-'));
  try {
    const driftedRecords = clone(records);
    driftedRecords.dossier_source.record.used_by_article.content_hash = '0'.repeat(64);
    const driftedRecordsPath = join(cliTemp, 'drifted-records.json');
    writeFileSync(driftedRecordsPath, JSON.stringify(driftedRecords), 'utf8');
    const customDrift = spawnSync(
      process.execPath, [cli, EXAMPLE, '--records', driftedRecordsPath],
      { cwd: ROOT, encoding: 'utf8' },
    );
    check(`custom-file CLI actually cross-checks metadata and fails named ${CODES.STALE_REVISION}`,
      customDrift.status !== 0 &&
        `${customDrift.stdout}${customDrift.stderr}`.includes(CODES.STALE_REVISION),
      `${customDrift.stdout}${customDrift.stderr}`);
  } finally {
    rmSync(cliTemp, { recursive: true, force: true });
  }

  const customWithoutRecords = spawnSync(
    process.execPath, [cli, EXAMPLE], { cwd: ROOT, encoding: 'utf8' },
  );
  check(`custom-file CLI without an external resolver fails named ${CODES.BLOCKED_TRANSPORT}`,
    customWithoutRecords.status !== 0 &&
      `${customWithoutRecords.stdout}${customWithoutRecords.stderr}`.includes(CODES.BLOCKED_TRANSPORT),
      `${customWithoutRecords.stdout}${customWithoutRecords.stderr}`);

  const validResolutionBaseline = recoverJourneyState(JSON.stringify(base), referenceOptions);
  check('validator-clean legitimate envelope still recovers as LIVE_VERIFIED',
    baseline.length === 0 && validResolutionBaseline.ok &&
      validResolutionBaseline.state === 'LIVE_VERIFIED');

  const resolver = referenceOptions.resolveExternalRecord;
  const wrongDecisionRecord = clone(records.visual_approvals[0].record);
  const wrongDecision = clone(base);
  wrongDecision.approved_revision.record_ref.content_sha256 = canonicalRecordSha256(wrongDecisionRecord);
  const wrongDecisionOptions = {
    resolveExternalRecord(ref) {
      if (ref.repository === wrongDecision.approved_revision.record_ref.repository &&
          ref.commit === wrongDecision.approved_revision.record_ref.commit &&
          ref.path === wrongDecision.approved_revision.record_ref.path) {
        return JSON.stringify(wrongDecisionRecord);
      }
      return resolver(ref);
    },
  };
  const wrongDecisionCodes = codes(wrongDecision, wrongDecisionOptions);
  const wrongDecisionRecovery = recoverJourneyState(
    JSON.stringify(wrongDecision), wrongDecisionOptions,
  );
  check(`hash-consistent semantically wrong publish bytes fail validation and recovery with named ${CODES.STALE_REVISION}`,
    baseline.length === 0 && wrongDecisionCodes.includes(CODES.STALE_REVISION) &&
      !wrongDecisionRecovery.ok && wrongDecisionRecovery.code === CODES.STALE_REVISION &&
      wrongDecisionRecovery.state !== 'LIVE_VERIFIED',
    JSON.stringify({ wrongDecisionCodes, wrongDecisionRecovery }));

  const reusedVisual = clone(base);
  reusedVisual.asset_bindings[1].visual_approval.record_ref =
    clone(base.asset_bindings[0].visual_approval.record_ref);
  const reusedVisualCodes = codes(reusedVisual);
  const reusedVisualRecovery = recoverJourneyState(
    JSON.stringify(reusedVisual), referenceOptions,
  );
  check(`reusing a valid visual decision for another asset fails validation and recovery with named ${CODES.STALE_REVISION}`,
    baseline.length === 0 && reusedVisualCodes.includes(CODES.STALE_REVISION) &&
      !reusedVisualRecovery.ok && reusedVisualRecovery.code === CODES.STALE_REVISION &&
      reusedVisualRecovery.state !== 'LIVE_VERIFIED',
    JSON.stringify({ reusedVisualCodes, reusedVisualRecovery }));

  const reusedApproval = clone(base);
  reusedApproval.approved_revision.record_ref = {
    ...reusedApproval.approved_revision.record_ref,
    path: base.review_ref.path,
    content_sha256: base.review_ref.content_sha256,
  };
  const reusedApprovalOptions = {
    resolveExternalRecord(ref) {
      if (ref.repository === reusedApproval.approved_revision.record_ref.repository &&
          ref.commit === reusedApproval.approved_revision.record_ref.commit &&
          ref.path === reusedApproval.approved_revision.record_ref.path) {
        return JSON.stringify(records.review.record);
      }
      return resolver(ref);
    },
  };
  const reusedApprovalCodes = codes(reusedApproval, reusedApprovalOptions);
  const reusedApprovalRecovery = recoverJourneyState(
    JSON.stringify(reusedApproval), reusedApprovalOptions,
  );
  check(`repointing publish approval at another valid JSON record fails validation and recovery with named ${CODES.STALE_REVISION}`,
    baseline.length === 0 && reusedApprovalCodes.includes(CODES.STALE_REVISION) &&
      !reusedApprovalRecovery.ok && reusedApprovalRecovery.code === CODES.STALE_REVISION &&
      reusedApprovalRecovery.state !== 'LIVE_VERIFIED',
    JSON.stringify({ reusedApprovalCodes, reusedApprovalRecovery }));

  const swappedDossier = clone(base);
  swappedDossier.dossier.path = 'intelligence/dossiers/agent-cost-curve-2026-09-10.md';
  swappedDossier.dossier.commit = '6bf6b44';
  swappedDossier.journey_binding_sha256 = journeyBindingSha256(
    swappedDossier.candidate, swappedDossier.dossier, swappedDossier.article_ref,
  );
  const dossierBytes = resolver(base.dossier);
  const swappedDossierOptions = {
    resolveExternalRecord(ref) {
      if (ref.repository === swappedDossier.dossier.repository &&
          ref.commit === swappedDossier.dossier.commit &&
          ref.path === swappedDossier.dossier.path) {
        return dossierBytes;
      }
      return resolver(ref);
    },
  };
  const swappedDossierCodes = codes(swappedDossier, swappedDossierOptions);
  const swappedDossierRecovery = recoverJourneyState(
    JSON.stringify(swappedDossier), swappedDossierOptions,
  );
  check(`hash-consistent dossier swap fails validation and recovery with named ${CODES.STALE_REVISION}`,
    baseline.length === 0 && swappedDossierCodes.includes(CODES.STALE_REVISION) &&
      !swappedDossierRecovery.ok && swappedDossierRecovery.code === CODES.STALE_REVISION &&
      swappedDossierRecovery.state !== 'LIVE_VERIFIED',
    JSON.stringify({ swappedDossierCodes, swappedDossierRecovery }));

  const revisionExpressions = ['4f3fc2c^{tree}', 'HEAD', 'main', '4f3fc2c:scripts/fixtures'];
  const revisionResults = revisionExpressions.map((commit) => resolveAndVerifyJourneyReference(
    { ...base.review_ref, commit }, { localRoot: ROOT },
  ));
  check(`resolution boundary refuses Git revision expressions with named ${CODES.HANDOFF_INVALID}`,
    revisionResults.every((result) => !result.ok && result.code === CODES.HANDOFF_INVALID),
    JSON.stringify(revisionResults));
}

console.log('repair round 4 — resolved records must be JSON objects');
{
  const baseline = codes(base);
  const baselineRecovery = recoverJourneyState(JSON.stringify(base), referenceOptions);
  const resolver = referenceOptions.resolveExternalRecord;
  const primitiveCases = [
    ['null', null],
    ['false', false],
    ['zero', 0],
    ['empty string', ''],
  ];
  const makePrimitiveCase = (value) => {
    const envelope = clone(base);
    const candidateRef = envelope.candidate.ledger_ref;
    candidateRef.content_sha256 = canonicalRecordSha256(value);
    envelope.journey_binding_sha256 = journeyBindingSha256(
      envelope.candidate, envelope.dossier, envelope.article_ref,
    );
    const options = {
      resolveExternalRecord(ref) {
        if (ref.repository === candidateRef.repository &&
            ref.commit === candidateRef.commit && ref.path === candidateRef.path) {
          return JSON.stringify(value);
        }
        return resolver(ref);
      },
    };
    return { envelope, options };
  };

  check('validator-clean legitimate envelope still validates and recovers as LIVE_VERIFIED',
    baseline.length === 0 && baselineRecovery.ok &&
      baselineRecovery.state === 'LIVE_VERIFIED');

  for (const [label, value] of primitiveCases) {
    const candidate = makePrimitiveCase(value);
    const validationCodes = codes(candidate.envelope, candidate.options);
    const recovered = recoverJourneyState(
      JSON.stringify(candidate.envelope), candidate.options,
    );
    const resolution = resolveAndVerifyJourneyReference(
      candidate.envelope.candidate.ledger_ref, candidate.options,
    );
    check(`${label} candidate ledger fails validation and recovery with named ${CODES.HANDOFF_INVALID}`,
      baseline.length === 0 && validationCodes.includes(CODES.HANDOFF_INVALID) &&
        !recovered.ok && recovered.code === CODES.HANDOFF_INVALID &&
        recovered.state !== 'LIVE_VERIFIED',
      JSON.stringify({ validationCodes, recovered }));
    check(`${label} remains accepted by the raw-byte digest boundary before semantic verification`,
      baseline.length === 0 && resolution.ok && Object.is(resolution.record, value));
  }

  const nullCandidate = makePrimitiveCase(null);
  const fileTemp = mkdtempSync(join(tmpdir(), 'sue-790-r4-file-'));
  const invalidEnvelopePath = join(fileTemp, 'null-candidate.json');
  try {
    writeFileSync(invalidEnvelopePath, JSON.stringify(nullCandidate.envelope), 'utf8');
    const fileCodes = validateJourneyEnvelopeFile(
      invalidEnvelopePath, nullCandidate.options,
    ).map((entry) => entry.code);
    const fileBaseline = validateJourneyEnvelopeFile(EXAMPLE, referenceOptions);
    check(`validateJourneyEnvelopeFile inherits the named ${CODES.HANDOFF_INVALID} refusal`,
      baseline.length === 0 && fileBaseline.length === 0 &&
        fileCodes.includes(CODES.HANDOFF_INVALID),
      `baseline=[${fileBaseline.map((entry) => entry.code).join(', ')}] got=[${fileCodes.join(', ')}]`);
  } finally {
    rmSync(fileTemp, { recursive: true, force: true });
  }

  const publishGate = assessPublishGate(nullCandidate.envelope, {
    articleRef: nullCandidate.envelope.article_ref,
    assetDigests: nullCandidate.envelope.approved_revision.asset_digests,
    referenceOptions: nullCandidate.options,
  });
  check(`null candidate ledger fails assessPublishGate with named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && !publishGate.accepted &&
      publishGate.code === CODES.HANDOFF_INVALID, JSON.stringify(publishGate));

  const visualApproval = assessAssetApproval(nullCandidate.envelope, 0, {
    articleRef: nullCandidate.envelope.article_ref,
    assetDigest: nullCandidate.envelope.asset_bindings[0].asset_sha256,
    referenceOptions: nullCandidate.options,
  });
  check(`null candidate ledger fails assessAssetApproval with named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && !visualApproval.approval_valid &&
      visualApproval.code === CODES.HANDOFF_INVALID, JSON.stringify(visualApproval));

  const resumed = resumeJourney(JSON.stringify(nullCandidate.envelope), {}, nullCandidate.options);
  check(`null candidate ledger fails resumeJourney with named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && !resumed.ok && resumed.code === CODES.HANDOFF_INVALID,
    JSON.stringify(resumed));

  const interrupted = recordInterrupt(nullCandidate.envelope, CODES.DEPLOYMENT_PARTIAL, {
    observedAt: '2026-09-11T08:00:00Z',
    referenceOptions: nullCandidate.options,
  });
  check(`null candidate ledger fails recordInterrupt with named ${CODES.HANDOFF_INVALID}`,
    baseline.length === 0 && !interrupted.ok &&
      interrupted.code === CODES.HANDOFF_INVALID, JSON.stringify(interrupted));

  check('deriveProgressState cannot report LIVE_VERIFIED for invalid resolved bindings',
    baseline.length === 0 && deriveProgressState(
      nullCandidate.envelope, nullCandidate.options,
    ) === null);

  const cli = resolve(ROOT, 'scripts/validate-journey-envelope.mjs');
  const recordsOnly = spawnSync(
    process.execPath, [cli, '--records', RECORDS], { cwd: ROOT, encoding: 'utf8' },
  );
  check(`malformed --records-only invocation fails with named ${CODES.HANDOFF_INVALID}`,
    recordsOnly.status !== 0 &&
      `${recordsOnly.stdout}${recordsOnly.stderr}`.includes(CODES.HANDOFF_INVALID),
    `${recordsOnly.stdout}${recordsOnly.stderr}`);
}

console.log('contract boundaries — refs and digests only');
{
  assertNamedMutation('embedding an article body', CODES.HANDOFF_INVALID,
    (envelope) => { envelope.article_body = 'forbidden copied prose'; });
  assertNamedMutation('setting publication status', CODES.HANDOFF_INVALID,
    (envelope) => { envelope.publication_status = 'published'; });
  const schemaText = readFileSync(resolve(ROOT, 'schemas/journey-envelope.schema.json'), 'utf8');
  check('durable schema declares no provider or model field',
    !/"(?:provider|model|model_name|model_version)"\s*:/.test(schemaText));
  check('publish decision binding recomputes from the exact article tuple and ordered asset set',
    approvalBindingSha256(base.approved_revision.article_ref, base.approved_revision.asset_digests) ===
      base.approved_revision.binding_sha256);
}

console.log(failures === 0
  ? '\njourney envelope regression: PASS'
  : `\njourney envelope regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
