#!/usr/bin/env node
/** SUE-790 journey-envelope acceptance and anti-vacuity regression tests. */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES,
  assetDigestSetHash,
  assessAssetApproval,
  assessPublishGate,
  reconstructIdentityChain,
  recordInterrupt,
  recoverJourneyState,
  validateJourneyEnvelope,
  validateJourneyEnvelopeFile,
} from './lib/journey-envelope-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXAMPLE = resolve(ROOT, 'schemas/examples/journey-envelope.example.json');
const DENY = resolve(ROOT, 'scripts/fixtures/journey-envelope/deny-primary-dossier.json');
const base = JSON.parse(readFileSync(EXAMPLE, 'utf8'));
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

function assertNamedMutation(name, expectedCode, mutate) {
  const candidate = clone(base);
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
  const index = [
    'RECEIVED', 'SELECTED', 'DRAFT_READY', 'IN_REVIEW', 'APPROVED_REVISION',
    'ASSETS_LOCKED', 'PUBLISH_ACCEPTED', 'SOURCE_COMMITTED',
    'ARTIFACT_DEPLOYED', 'LIVE_VERIFIED',
  ].indexOf(state);
  if (index < 9) delete envelope.live_verification;
  if (index < 8) delete envelope.deployed_artifact;
  if (index < 7) delete envelope.source_commit;
  if (index < 6) delete envelope.publish_run;
  if (index < 5) {
    delete envelope.handoff_receipt_ref;
    delete envelope.asset_bindings;
  }
  if (index < 4) delete envelope.approved_revision;
  if (index < 2) {
    delete envelope.dossier;
    delete envelope.article_ref;
  }
  return envelope;
}

console.log('acceptance 1 — complete round-trip identity chain');
{
  const baseline = codes(base);
  const result = reconstructIdentityChain(base);
  check('complete example is validator-clean', baseline.length === 0, JSON.stringify(validateJourneyEnvelope(base)));
  check('round-trip reconstructs candidate selection through live read-back using references and digests',
    result.ok &&
      result.chain.candidate.slug === base.candidate.slug &&
      result.chain.candidate.selection.selected_by === base.candidate.selection.selected_by &&
      result.chain.dossier.content_sha256 === base.dossier.content_sha256 &&
      result.chain.article_ref.content_hash === base.article_ref.content_hash &&
      result.chain.assets.map((entry) => entry.asset_sha256).join(',') === base.approved_revision.asset_digests.join(',') &&
      result.chain.approved_revision.asset_digest_set_hash === base.approved_revision.asset_digest_set_hash &&
      result.chain.publish_run.run_id === base.publish_run.run_id &&
      result.chain.source_commit.commit === base.source_commit.commit &&
      result.chain.deployed_artifact.deployment_id === base.deployed_artifact.deployment_id &&
      result.chain.live_verification.article_body_sha256 === base.live_verification.article_body_sha256);
  assertNamedMutation('a LIVE_VERIFIED envelope missing live read-back identity', CODES.HANDOFF_INVALID,
    (envelope) => { delete envelope.live_verification; });
}

console.log('acceptance 2 — restart from persisted envelope only');
{
  const persisted = JSON.stringify(base);
  const recovered = recoverJourneyState(persisted);
  check('restart recovers exact state and resume point without in-memory context',
    recovered.ok && recovered.state === 'LIVE_VERIFIED' && recovered.last_good_state === 'LIVE_VERIFIED' &&
      recovered.resume_from === 'LIVE_VERIFIED' && recovered.envelope.journey_id === base.journey_id);
  const malformed = recoverJourneyState(persisted.replace(/^\{/, '{not-json'));
  check(`one corruption of a validator-clean persisted envelope fails with ${CODES.HANDOFF_INVALID}`,
    recovered.ok && !malformed.ok && malformed.code === CODES.HANDOFF_INVALID);
}

console.log('acceptance 3 — cosmetic revision preserves unrelated visual approval');
{
  const baseline = codes(base);
  const textOnlyRevision = {
    ...base.article_ref,
    version_number: base.article_ref.version_number + 1,
    content_hash: '1'.repeat(64),
  };
  const result = assessAssetApproval(base, 0, {
    articleRef: textOnlyRevision,
    assetDigest: base.approved_revision.asset_digests[0],
  });
  const publish = assessPublishGate(base, {
    articleRef: textOnlyRevision,
    assetDigests: base.approved_revision.asset_digests,
  });
  check('classifyArtifact reports cosmetic and preserves the unchanged visual approval',
    baseline.length === 0 && result.lineage?.level === 'cosmetic' && result.lineage.presentable === true &&
      result.approval_valid === true && result.code === null,
    JSON.stringify(result));
  check(`the same text-only revision independently invalidates the publish gate with ${CODES.STALE_REVISION}`,
    baseline.length === 0 && publish.accepted === false && publish.code === CODES.STALE_REVISION,
    JSON.stringify(publish));

  const unknownArticle = { ...base.article_ref };
  delete unknownArticle.content_hash;
  const unknown = assessAssetApproval(base, 0, {
    articleRef: unknownArticle,
    assetDigest: base.approved_revision.asset_digests[0],
  });
  check(`unknown lineage fails safe with named ${CODES.STALE_REVISION} from a validator-clean baseline`,
    baseline.length === 0 && unknown.lineage?.level === 'unknown' && unknown.presentable === false &&
      unknown.approval_valid === false && unknown.code === CODES.STALE_REVISION,
    JSON.stringify(unknown));
}

console.log('acceptance 4 — material claim change stales dependent visual');
{
  const baseline = codes(base);
  const changed = { ...base.article_ref, claims_hash: '0'.repeat(64) };
  const result = assessAssetApproval(base, 0, {
    articleRef: changed,
    assetDigest: base.approved_revision.asset_digests[0],
  });
  check(`claims_hash change is material, not presentable, and returns ${CODES.STALE_REVISION} from a validator-clean baseline`,
    baseline.length === 0 && result.lineage?.level === 'material' && result.lineage.presentable === false &&
      result.approval_valid === false && result.code === CODES.STALE_REVISION,
    JSON.stringify(result));
}

console.log('acceptance 5 — changed asset digest inherits no approval');
{
  const baseline = codes(base);
  const visual = assessAssetApproval(base, 0, {
    articleRef: base.article_ref,
    assetDigest: '0'.repeat(64),
  });
  const publish = assessPublishGate(base, {
    articleRef: base.article_ref,
    assetDigests: ['0'.repeat(64), base.approved_revision.asset_digests[1]],
  });
  check(`changed digest loses the per-asset approval with ${CODES.STALE_REVISION} from a validator-clean baseline`,
    baseline.length === 0 && visual.lineage?.level === 'cosmetic' &&
      visual.approval_valid === false && visual.presentable === false && visual.code === CODES.STALE_REVISION,
    JSON.stringify(visual));
  check(`changed digest set refuses the publish gate with ${CODES.STALE_REVISION} from a validator-clean baseline`,
    baseline.length === 0 && publish.accepted === false && publish.code === CODES.STALE_REVISION,
    JSON.stringify(publish));
  const accepted = assessPublishGate(base, {
    articleRef: base.article_ref,
    assetDigests: base.approved_revision.asset_digests,
  });
  check('the exact revision and ordered digest set is accepted', accepted.accepted && accepted.code === null);
  const reorderedArticleRef = Object.fromEntries(Object.entries(base.article_ref).reverse());
  const reordered = assessPublishGate(base, {
    articleRef: reorderedArticleRef,
    assetDigests: base.approved_revision.asset_digests,
  });
  check('article-ref property insertion order does not create false revision drift',
    reordered.accepted && reordered.code === null);
  check('digest-set hash is deterministic and order-sensitive',
    assetDigestSetHash(base.approved_revision.asset_digests) === base.approved_revision.asset_digest_set_hash &&
      assetDigestSetHash([...base.approved_revision.asset_digests].reverse()) !== base.approved_revision.asset_digest_set_hash);
}

console.log('acceptance 6 — transport failure resumes without regeneration');
{
  const publishAccepted = atProgress('PUBLISH_ACCEPTED');
  const baseline = codes(publishAccepted);
  const identitiesBefore = JSON.stringify({
    candidate: publishAccepted.candidate,
    dossier: publishAccepted.dossier,
    article_ref: publishAccepted.article_ref,
    approved_revision: publishAccepted.approved_revision,
    asset_bindings: publishAccepted.asset_bindings,
    handoff_receipt_ref: publishAccepted.handoff_receipt_ref,
    publish_run: publishAccepted.publish_run,
  });
  const paused = recordInterrupt(publishAccepted, CODES.BLOCKED_TRANSPORT, {
    observedAt: '2026-09-11T06:16:00Z',
  });
  const identitiesAfter = JSON.stringify({
    candidate: paused.envelope?.candidate,
    dossier: paused.envelope?.dossier,
    article_ref: paused.envelope?.article_ref,
    approved_revision: paused.envelope?.approved_revision,
    asset_bindings: paused.envelope?.asset_bindings,
    handoff_receipt_ref: paused.envelope?.handoff_receipt_ref,
    publish_run: paused.envelope?.publish_run,
  });
  const recovered = paused.ok ? recoverJourneyState(JSON.stringify(paused.envelope)) : null;
  check(`transport pause records named ${CODES.BLOCKED_TRANSPORT} from a validator-clean baseline`,
    baseline.length === 0 && paused.ok && paused.code === CODES.BLOCKED_TRANSPORT &&
      paused.envelope.state === 'BLOCKED_TRANSPORT' && paused.envelope.last_good_state === 'PUBLISH_ACCEPTED');
  check('transport pause preserves every text/asset identity and requests no effects',
    identitiesBefore === identitiesAfter && JSON.stringify(paused.effects) === '[]');
  check('restart resumes transport failure from the last good publish state',
    recovered?.ok && recovered.state === 'BLOCKED_TRANSPORT' && recovered.resume_from === 'PUBLISH_ACCEPTED');

  const authPaused = recordInterrupt(publishAccepted, CODES.BLOCKED_AUTH, {
    observedAt: '2026-09-11T06:17:00Z',
  });
  const authIdentity = JSON.stringify({
    candidate: authPaused.envelope?.candidate,
    dossier: authPaused.envelope?.dossier,
    article_ref: authPaused.envelope?.article_ref,
    approved_revision: authPaused.envelope?.approved_revision,
    asset_bindings: authPaused.envelope?.asset_bindings,
    handoff_receipt_ref: authPaused.envelope?.handoff_receipt_ref,
    publish_run: authPaused.envelope?.publish_run,
  });
  check(`${CODES.BLOCKED_AUTH} also preserves all identities and requests no regeneration effects`,
    baseline.length === 0 && authPaused.ok && authPaused.code === CODES.BLOCKED_AUTH &&
      authIdentity === identitiesBefore && JSON.stringify(authPaused.effects) === '[]');
}

console.log('acceptance 7 — NO_ARTICLE and NEEDS_EVIDENCE remain reachable');
{
  const selected = atProgress('SELECTED');
  const baseline = codes(selected);
  const noArticle = recordInterrupt(selected, CODES.NO_ARTICLE, { observedAt: '2026-09-11T05:01:00Z' });
  const needsEvidence = recordInterrupt(selected, CODES.NEEDS_EVIDENCE, { observedAt: '2026-09-11T05:02:00Z' });
  check(`${CODES.NO_ARTICLE} remains a named resumable outcome from validator-clean SELECTED`,
    baseline.length === 0 && noArticle.ok && noArticle.code === CODES.NO_ARTICLE &&
      noArticle.envelope.last_good_state === 'SELECTED' && !('article_ref' in noArticle.envelope));
  check(`${CODES.NEEDS_EVIDENCE} remains a named resumable outcome from validator-clean SELECTED`,
    baseline.length === 0 && needsEvidence.ok && needsEvidence.code === CODES.NEEDS_EVIDENCE &&
      needsEvidence.envelope.last_good_state === 'SELECTED' && !('article_ref' in needsEvidence.envelope));

  const received = atProgress('RECEIVED');
  received.candidate.selection = null;
  const receivedBaseline = codes(received);
  received.state = 'SELECTED';
  received.last_good_state = 'SELECTED';
  const advancedCodes = codes(received);
  check(`unselected candidate cannot advance past RECEIVED and returns named ${CODES.SELECTION_REQUIRED}`,
    receivedBaseline.length === 0 && advancedCodes.includes(CODES.SELECTION_REQUIRED),
    `baseline=[${receivedBaseline.join(', ')}] got=[${[...new Set(advancedCodes)].join(', ')}]`);
}

console.log('acceptance 8 — derived intelligence cannot become primary evidence');
{
  const denyIssues = validateJourneyEnvelopeFile(DENY);
  const denyCodes = denyIssues.map((entry) => entry.code);
  check(`committed deny fixture fails the named ${CODES.DERIVED_EVIDENCE} code`,
    denyIssues.length === 1 && denyCodes.includes(CODES.DERIVED_EVIDENCE),
    `got [${[...new Set(denyCodes)].join(', ')}]`);
  assertNamedMutation('promoting a dossier reference to primary evidence', CODES.DERIVED_EVIDENCE,
    (envelope) => { envelope.dossier.evidence_role = 'primary'; });
}

console.log('acceptance 9 — repository command wiring');
{
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
  check('npm run validate includes validate:journey',
    typeof pkg.scripts['validate:journey'] === 'string' && pkg.scripts.validate.includes('npm run validate:journey'));
  check('npm test includes test:journey',
    typeof pkg.scripts['test:journey'] === 'string' && pkg.scripts.test.includes('npm run test:journey'));
}

console.log('contract boundaries — references and decisions only');
{
  assertNamedMutation('embedding an article body in the envelope', CODES.HANDOFF_INVALID,
    (envelope) => { envelope.article_body = 'forbidden copied prose'; });
  assertNamedMutation('setting publication status through the envelope', CODES.HANDOFF_INVALID,
    (envelope) => { envelope.publication_status = 'published'; });
  const schemaText = readFileSync(resolve(ROOT, 'schemas/journey-envelope.schema.json'), 'utf8');
  check('durable journey schema declares no provider or model field',
    !/"(?:provider|model|model_name|model_version)"\s*:/.test(schemaText));
}

console.log(failures === 0
  ? '\njourney envelope regression: PASS'
  : `\njourney envelope regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
