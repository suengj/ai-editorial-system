#!/usr/bin/env node
/** SUE-790 journey-envelope acceptance and anti-vacuity regression tests. */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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
  deriveProgressState,
  journeyBindingSha256,
  reconstructIdentityChain,
  recordInterrupt,
  recoverJourneyState,
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
const base = JSON.parse(readFileSync(EXAMPLE, 'utf8'));
const records = JSON.parse(readFileSync(RECORDS, 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
const codes = (envelope) => validateJourneyEnvelope(envelope).map((entry) => entry.code);

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
  const referenceIssues = validateJourneyReferences(base, records);
  const result = reconstructIdentityChain(base, records);
  check('complete envelope and separately persisted record metadata agree',
    envelopeIssues.length === 0 && referenceIssues.length === 0 && result.ok,
    JSON.stringify({ envelopeIssues, referenceIssues }));
  check('round-trip resolves independent candidate, dossier, handoff, approval, deployment, and live identities',
    result.chain.candidate.slug === records.candidate_ledger.candidate.slug &&
      result.chain.dossier.content_sha256 === records.dossier_source.identity.content_sha256 &&
      result.chain.article_ref.content_hash === records.handoff_receipt.article_ref.content_hash &&
      result.chain.assets.map((entry) => entry.asset_sha256).join(',') ===
        records.handoff_receipt.artifacts.map((entry) => entry.asset_sha256).join(',') &&
      result.chain.approved_revision.binding_sha256 === records.publish_approval.binding_sha256 &&
      result.chain.deployed_artifact.deployment_id === records.deployment.deployment_id &&
      result.chain.live_verification.article_body_sha256 === records.live_verification.result.article_body_sha256);

  const changedRecords = clone(records);
  changedRecords.handoff_receipt.artifacts[0].asset_sha256 = '0'.repeat(64);
  const changedCodes = validateJourneyReferences(base, changedRecords).map((entry) => entry.code);
  check(`independent receipt drift fails named ${CODES.MEDIA_DIGEST_MISMATCH} from clean cross-record metadata`,
    referenceIssues.length === 0 && changedCodes.includes(CODES.MEDIA_DIGEST_MISMATCH),
    `got=[${[...new Set(changedCodes)].join(', ')}]`);
}

console.log('acceptance 2 — record-derived restart and replay');
{
  for (const state of PROGRESS_STATES) {
    const envelope = atProgress(state);
    const recovered = recoverJourneyState(JSON.stringify(envelope));
    check(`${state} is derived and recovered from persisted records`,
      codes(envelope).length === 0 && deriveProgressState(envelope) === state &&
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
    const recorded = recordInterrupt(source, code, { observedAt: '2026-09-11T07:00:00Z' });
    const recovered = recorded.ok ? recoverJourneyState(JSON.stringify(recorded.envelope)) : null;
    const terminal = code === CODES.NO_ARTICLE;
    check(`${code} recovery preserves its named code and ${terminal ? 'terminates' : 'resumes from derived progress'}`,
      codes(source).length === 0 && recorded.ok && recorded.envelope.interruption.code === code &&
        recovered?.ok && recovered.state === code && recovered.terminal === terminal &&
        recovered.resume_from === (terminal ? null : source.state),
      JSON.stringify(recorded));
  }
  const stale = staleTextEnvelope();
  const staleRecovered = recoverJourneyState(JSON.stringify(stale));
  check(`${CODES.STALE_REVISION} recovery preserves its named code and derived LIVE_VERIFIED resume point`,
    codes(stale).length === 0 && staleRecovered.ok && staleRecovered.state === CODES.STALE_REVISION &&
      staleRecovered.resume_from === 'LIVE_VERIFIED');

  const malformed = recoverJourneyState(JSON.stringify(base).replace(/^\{/, '{not-json'));
  check(`persisted-byte corruption fails named ${CODES.HANDOFF_INVALID}`,
    !malformed.ok && malformed.code === CODES.HANDOFF_INVALID);
}

console.log('acceptance 3 — text-only change separates publish and visual bindings');
{
  const stale = staleTextEnvelope();
  const visual = assessAssetApproval(stale, 0, {
    articleRef: stale.article_ref,
    assetDigest: stale.asset_bindings[0].asset_sha256,
    approvalRecord: records.visual_approvals[0],
  });
  const publish = assessPublishGate(stale, {
    articleRef: stale.approved_revision.article_ref,
    assetDigests: stale.approved_revision.asset_digests,
    approvalRecord: records.publish_approval,
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
    approvalRecord: records.visual_approvals[0],
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
    approvalRecord: records.visual_approvals[0],
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
    approvalRecord: records.publish_approval,
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
  check(`unresolved approval pointers fail closed with named ${CODES.STALE_REVISION} from a clean baseline`,
    baseline.length === 0 && !unresolvedGate.accepted && unresolvedGate.code === CODES.STALE_REVISION &&
      !unresolvedVisual.approval_valid && unresolvedVisual.code === CODES.STALE_REVISION);

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
      approvalRecord: records.publish_approval,
    });
    check(`${name} refuses the publish gate with named ${CODES.STALE_REVISION} from a validator-clean baseline`,
      baseline.length === 0 && !result.accepted && result.code === CODES.STALE_REVISION,
      JSON.stringify(result));
  }
  const visual = assessAssetApproval(base, 0, {
    articleRef: base.article_ref,
    assetDigest: '0'.repeat(64),
    approvalRecord: records.visual_approvals[0],
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
    approvalRecord: records.publish_approval,
  });
  const coordinatedVisual = assessAssetApproval(coordinated, 0, {
    articleRef: coordinated.article_ref,
    assetDigest: coordinated.asset_bindings[0].asset_sha256,
    approvalRecord: records.visual_approvals[0],
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
    approvalRecord: records.publish_approval,
  });
  const reboundVisual = assessAssetApproval(rebound, 0, {
    articleRef: rebound.article_ref,
    assetDigest: rebound.asset_bindings[0].asset_sha256,
    approvalRecord: records.visual_approvals[0],
  });
  const reboundReferences = validateJourneyReferences(rebound, records).map((entry) => entry.code);
  check(`recomputing forged envelope digests cannot reuse the old external decisions and fails named ${CODES.STALE_REVISION}`,
    codes(rebound).length === 0 && validateJourneyReferences(base, records).length === 0 &&
      !reboundGate.accepted && reboundGate.code === CODES.STALE_REVISION &&
      !reboundVisual.approval_valid && reboundVisual.code === CODES.STALE_REVISION &&
      reboundReferences.includes(CODES.STALE_REVISION),
    JSON.stringify({ reboundGate, reboundVisual, reboundReferences }));
}

console.log('acceptance 6 — blocked transport executes only the recovery seam');
{
  const publishAccepted = atProgress('PUBLISH_ACCEPTED');
  const paused = recordInterrupt(publishAccepted, CODES.BLOCKED_TRANSPORT, {
    observedAt: '2026-09-11T07:10:00Z',
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
  const first = resumeJourney(serialized, adapters);
  const replay = resumeJourney(serialized, adapters);
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
  const noArticle = recordInterrupt(selected, CODES.NO_ARTICLE, { observedAt: '2026-09-11T07:20:00Z' });
  let invoked = 0;
  const terminalResume = resumeJourney(JSON.stringify(noArticle.envelope), {
    inspectEvidence() { invoked += 1; },
  });
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
  const needs = recordInterrupt(received, CODES.NEEDS_EVIDENCE, { observedAt: '2026-09-11T07:21:00Z' });
  const needsRecovered = recoverJourneyState(JSON.stringify(needs.envelope));
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
  const denyIssues = validateJourneyEnvelopeFile(DENY);
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
  const literalResult = clone(records.live_verification.result);
  const interopBaseline = validateSUE789Interop({
    manifest: records.publish_run.manifest,
    receipt: records.publish_run.receipt,
    result: literalResult,
  });
  check('literal suengj-com LIVE_VERIFIED result with prefixed digests is accepted unchanged',
    interopBaseline.length === 0 && JSON.stringify(literalResult) === JSON.stringify(base.live_verification),
    JSON.stringify(interopBaseline));
  const bareResult = clone(literalResult);
  bareResult.article_body_sha256 = bareResult.article_body_sha256.slice('sha256:'.length);
  const bareCodes = validateSUE789Interop({
    manifest: records.publish_run.manifest,
    receipt: records.publish_run.receipt,
    result: bareResult,
  }).map((entry) => entry.code);
  check(`bare live digest fails named ${CODES.HANDOFF_INVALID} from a clean literal interop baseline`,
    interopBaseline.length === 0 && bareCodes.includes(CODES.HANDOFF_INVALID));

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
