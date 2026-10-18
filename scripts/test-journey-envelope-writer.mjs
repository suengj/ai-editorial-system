#!/usr/bin/env node
/** SUE-1659 journey-envelope writer regression tests. */

import {
  existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES,
  PROGRESS_STATES,
  canonicalRecordSha256,
  createRecordBundleResolver,
  parseJourneyJson,
  recoverJourneyState,
  validateJourneyEnvelope,
} from './lib/journey-envelope-core.mjs';
import {
  STATE_ALIASES,
  applyInterrupt,
  applyTransition,
  createJourney,
  evidenceKeys,
  initJourneyFile,
  readJourneyFile,
  updateJourneyFile,
  withJourneyLock,
} from './lib/journey-envelope-writer.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CLI = resolve(ROOT, 'scripts/journey-envelope.mjs');
const EXAMPLE = resolve(ROOT, 'schemas/examples/journey-envelope.example.json');
const RECORDS = resolve(ROOT, 'scripts/fixtures/journey-envelope/cross-repo-records.json');
const base = parseJourneyJson(readFileSync(EXAMPLE), EXAMPLE);
const records = parseJourneyJson(readFileSync(RECORDS), RECORDS);
const referenceOptions = Object.freeze({ resolveExternalRecord: createRecordBundleResolver(records) });
const clone = (value) => JSON.parse(JSON.stringify(value));
const AT = '2026-09-11T07:00:00Z';

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
};
const codesOf = (outcome) => (outcome.issues ?? []).map((entry) => entry.code);

// The evidence recorded at each progress stage, taken from the validator-clean example.
const STAGE_EVIDENCE = {
  SELECTED: () => ({ selection: clone(base.candidate.selection) }),
  DRAFT_READY: () => ({ dossier: clone(base.dossier), article_ref: clone(base.article_ref) }),
  IN_REVIEW: () => ({ review_ref: clone(base.review_ref) }),
  APPROVED_REVISION: () => ({ approved_revision: clone(base.approved_revision) }),
  ASSETS_LOCKED: () => ({
    handoff_receipt_ref: clone(base.handoff_receipt_ref),
    asset_bindings: clone(base.asset_bindings),
  }),
  PUBLISH_ACCEPTED: () => ({ publish_run: clone(base.publish_run) }),
  SOURCE_COMMITTED: () => ({ source_commit: clone(base.source_commit) }),
  ARTIFACT_DEPLOYED: () => ({ deployed_artifact: clone(base.deployed_artifact) }),
  LIVE_VERIFIED: () => ({
    live_verification_ref: clone(base.live_verification_ref),
    live_verification: clone(base.live_verification),
  }),
};

function freshReceived() {
  const created = createJourney({ slug: base.candidate.slug, ledgerRef: base.candidate.ledger_ref, observedAt: AT },
    referenceOptions);
  if (!created.ok) throw new Error(`fixture init failed: ${JSON.stringify(created.issues)}`);
  return created.envelope;
}

/** Walk the example journey up to (and including) `state` through the writer. */
function advanceTo(state) {
  let envelope = freshReceived();
  for (const stage of PROGRESS_STATES.slice(1, PROGRESS_STATES.indexOf(state) + 1)) {
    const step = applyTransition(envelope, { to: stage, evidence: STAGE_EVIDENCE[stage](), observedAt: AT },
      referenceOptions);
    if (!step.ok) throw new Error(`fixture ${stage} failed: ${JSON.stringify(step.issues)}`);
    envelope = step.envelope;
  }
  return envelope;
}

const dir = mkdtempSync(join(tmpdir(), 'journey-writer-'));
const filePath = (name) => join(dir, name);
const leftovers = () => readdirSync(dir).filter((name) => name.endsWith('.tmp') || name.endsWith('.lock'));
const cli = (...args) => spawnSync(process.execPath, [CLI, ...args, '--records', RECORDS], {
  cwd: ROOT, encoding: 'utf8',
});
const readJsonFile = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (name, value) => { const path = filePath(name); writeFileSync(path, JSON.stringify(value)); return path; };

try {
  console.log('init and the full RECEIVED -> LIVE_VERIFIED walk');
  {
    const envelope = freshReceived();
    check('init produces a validator-clean RECEIVED envelope with an unselected candidate',
      validateJourneyEnvelope(envelope, referenceOptions).length === 0 &&
        envelope.state === 'RECEIVED' && envelope.candidate.selection === null);

    const walked = advanceTo('LIVE_VERIFIED');
    const expected = { ...clone(base), updated_at: AT };
    check('walking every stage through the writer reproduces the committed LIVE_VERIFIED example exactly',
      JSON.stringify(Object.entries(walked).sort()) === JSON.stringify(Object.entries(expected).sort()),
      JSON.stringify(walked).slice(0, 200));

    for (const stage of PROGRESS_STATES.slice(1)) {
      const at = advanceTo(stage);
      const recovered = recoverJourneyState(JSON.stringify(at), referenceOptions);
      check(`${stage} written by the writer is recovered by the existing reader`,
        recovered.ok && recovered.state === stage && at.last_good_state === stage);
    }

    // journey_binding_sha256 is derived by the writer and never accepted as evidence;
    // candidate.ledger_ref is the post-selection ledger pointer.
    check('writer evidence keys are exactly the schema evidence fields plus the candidate keys',
      JSON.stringify(evidenceKeys().sort()) === JSON.stringify(
        [...Object.keys(STAGE_EVIDENCE).flatMap((stage) => Object.keys(STAGE_EVIDENCE[stage]())),
          'ledger_ref'].sort()));
    check('a caller-supplied journey_binding_sha256 is refused as writer-controlled',
      !applyTransition(advanceTo('SELECTED'), {
        to: 'DRAFT_READY',
        evidence: { ...STAGE_EVIDENCE.DRAFT_READY(), journey_binding_sha256: base.journey_binding_sha256 },
        observedAt: AT,
      }, referenceOptions).ok);
  }

  console.log('invalid transitions are refused by the existing validator');
  {
    const received = freshReceived();
    const skipped = applyTransition(received, {
      to: 'IN_REVIEW', evidence: STAGE_EVIDENCE.IN_REVIEW(), observedAt: AT,
    }, referenceOptions);
    check('a review ref with no selected candidate or article is refused (label cannot outrun records)',
      !skipped.ok && codesOf(skipped).includes(CODES.HANDOFF_INVALID), JSON.stringify(skipped.issues));

    const noEvidence = applyTransition(received, { to: 'SELECTED', evidence: {}, observedAt: AT }, referenceOptions);
    check('claiming SELECTED without a human selection is refused', !noEvidence.ok);

    const blankSelector = applyTransition(received, {
      to: 'SELECTED', evidence: { selection: { selected_by: ' ', selection_date: '2026-09-11' } }, observedAt: AT,
    }, referenceOptions);
    check(`a blank selector is refused with ${CODES.SELECTION_REQUIRED}`,
      !blankSelector.ok && codesOf(blankSelector).includes(CODES.SELECTION_REQUIRED));

    const draft = advanceTo('DRAFT_READY');
    const wrongTarget = applyTransition(draft, {
      to: 'APPROVED_REVISION', evidence: STAGE_EVIDENCE.IN_REVIEW(), observedAt: AT,
    }, referenceOptions);
    check('evidence for IN_REVIEW cannot be filed under APPROVED_REVISION', !wrongTarget.ok);

    const tamperedRef = STAGE_EVIDENCE.IN_REVIEW();
    tamperedRef.review_ref.content_sha256 = '0'.repeat(64);
    const badDigest = applyTransition(draft, { to: 'IN_REVIEW', evidence: tamperedRef, observedAt: AT }, referenceOptions);
    check('a record ref whose digest does not match the resolved bytes is refused', !badDigest.ok);

    const wrongAuthority = STAGE_EVIDENCE.IN_REVIEW();
    wrongAuthority.review_ref.repository = 'suengj/suengj-com';
    check('a ref in a repository that is not authoritative for it is refused',
      !applyTransition(draft, { to: 'IN_REVIEW', evidence: wrongAuthority, observedAt: AT }, referenceOptions).ok);

    const primary = STAGE_EVIDENCE.DRAFT_READY();
    primary.dossier.evidence_role = 'primary';
    const derived = applyTransition(advanceTo('SELECTED'), {
      to: 'DRAFT_READY', evidence: primary, observedAt: AT,
    }, referenceOptions);
    check(`a dossier recorded as primary evidence is refused with ${CODES.DERIVED_EVIDENCE}`,
      !derived.ok && codesOf(derived).includes(CODES.DERIVED_EVIDENCE));

    const staleApproval = STAGE_EVIDENCE.APPROVED_REVISION();
    staleApproval.approved_revision.binding_sha256 = '1'.repeat(64);
    const stale = applyTransition(advanceTo('IN_REVIEW'), {
      to: 'APPROVED_REVISION', evidence: staleApproval, observedAt: AT,
    }, referenceOptions);
    check(`an approval that is not self-bound to its article tuple is refused with ${CODES.STALE_REVISION}`,
      !stale.ok && codesOf(stale).includes(CODES.STALE_REVISION));

    const external = applyTransition(draft, {
      to: 'IN_REVIEW', evidence: STAGE_EVIDENCE.IN_REVIEW(), observedAt: AT,
    }, {});
    check('without a resolver, external refs fail closed instead of being trusted',
      !external.ok && codesOf(external).includes(CODES.BLOCKED_TRANSPORT));

    check('an interrupt code is not accepted as a transition target',
      !applyTransition(draft, { to: 'BLOCKED_AUTH', observedAt: AT }, referenceOptions).ok);
    check('an unknown state name is refused', !applyTransition(draft, { to: 'PUBLISHED', observedAt: AT }, referenceOptions).ok);
    check('a writer-controlled field cannot be injected as evidence',
      !applyTransition(draft, { to: 'IN_REVIEW', evidence: { ...STAGE_EVIDENCE.IN_REVIEW(), state: 'LIVE_VERIFIED' }, observedAt: AT },
        referenceOptions).ok);
    check('an unknown evidence field (e.g. an embedded article body) is refused',
      !applyTransition(draft, { to: 'IN_REVIEW', evidence: { ...STAGE_EVIDENCE.IN_REVIEW(), article_body: 'x' }, observedAt: AT },
        referenceOptions).ok);
  }

  console.log('append-only and forward-only discipline');
  {
    const approved = advanceTo('APPROVED_REVISION');
    const rewrite = STAGE_EVIDENCE.DRAFT_READY();
    rewrite.article_ref.version_number += 1;
    const rewritten = applyTransition(approved, { to: 'ASSETS_LOCKED', evidence: { ...rewrite, ...STAGE_EVIDENCE.ASSETS_LOCKED() }, observedAt: AT },
      referenceOptions);
    check('re-filing a different article_ref over a recorded one is refused', !rewritten.ok);

    const backwards = applyTransition(approved, { to: 'DRAFT_READY', evidence: {}, observedAt: AT }, referenceOptions);
    check('a backwards transition with no new evidence is refused as forward-only, not reported unchanged',
      !backwards.ok && backwards.code === CODES.HANDOFF_INVALID);
    const live = advanceTo('LIVE_VERIFIED');
    check('transition --to RECEIVED on a LIVE_VERIFIED envelope is refused',
      !applyTransition(live, { to: 'RECEIVED', evidence: {}, observedAt: AT }, referenceOptions).ok);
    const sameState = applyTransition(approved, { to: 'APPROVED_REVISION', evidence: {}, observedAt: AT }, referenceOptions);
    check('an identical replay of the current state is still unchanged', sameState.ok && sameState.result === 'unchanged');
    const backwardsNew = applyTransition(approved, { to: 'DRAFT_READY', evidence: STAGE_EVIDENCE.ASSETS_LOCKED(), observedAt: AT },
      referenceOptions);
    check('a backwards transition carrying new evidence is refused', !backwardsNew.ok);
  }

  console.log('updated_at never moves backwards');
  {
    const selected = advanceTo('SELECTED');
    const older = '2026-09-10T00:00:00Z';
    const t = applyTransition(selected, { to: 'DRAFT_READY', evidence: STAGE_EVIDENCE.DRAFT_READY(), observedAt: older }, referenceOptions);
    check('a transition with an --at earlier than the stored updated_at is refused', !t.ok && t.code === CODES.HANDOFF_INVALID);
    check('an interrupt with an --at earlier than the stored updated_at is refused',
      !applyInterrupt(selected, 'BLOCKED_AUTH', { observedAt: older }, referenceOptions).ok);
    check('an unparseable --at is refused',
      !applyTransition(selected, { to: 'DRAFT_READY', evidence: STAGE_EVIDENCE.DRAFT_READY(), observedAt: 'not-a-time' }, referenceOptions).ok);
    check('an --at equal to or later than the stored updated_at is accepted',
      applyTransition(selected, { to: 'DRAFT_READY', evidence: STAGE_EVIDENCE.DRAFT_READY(), observedAt: AT }, referenceOptions).ok &&
      applyTransition(selected, { to: 'DRAFT_READY', evidence: STAGE_EVIDENCE.DRAFT_READY(), observedAt: '2026-09-12T00:00:00Z' }, referenceOptions).ok);
  }

  console.log('idempotency');
  {
    const draft = advanceTo('DRAFT_READY');
    const replay = applyTransition(draft, { to: 'DRAFT_READY', evidence: STAGE_EVIDENCE.DRAFT_READY(), observedAt: '2026-09-12T00:00:00Z' },
      referenceOptions);
    check('an identical duplicate transition reports unchanged and keeps updated_at',
      replay.ok && replay.result === 'unchanged' && replay.envelope.updated_at === AT);

    const path = filePath('idempotent.json');
    const init = initJourneyFile(path, { slug: base.candidate.slug, ledgerRef: base.candidate.ledger_ref, observedAt: AT },
      referenceOptions);
    const bytesAfterInit = readFileSync(path, 'utf8');
    const initAgain = initJourneyFile(path, { slug: base.candidate.slug, ledgerRef: base.candidate.ledger_ref, observedAt: '2026-10-01T00:00:00Z' },
      referenceOptions);
    check('init is idempotent for the same journey and leaves bytes untouched',
      init.ok && init.result === 'written' && initAgain.ok && initAgain.result === 'unchanged' &&
        readFileSync(path, 'utf8') === bytesAfterInit);

    const step = () => updateJourneyFile(path, (e) => applyTransition(e,
      { to: 'SELECTED', evidence: STAGE_EVIDENCE.SELECTED(), observedAt: AT }, referenceOptions), referenceOptions);
    const first = step();
    const afterFirst = readFileSync(path, 'utf8');
    const second = step();
    check('replaying the same file transition writes once and then leaves the bytes identical',
      first.result === 'written' && second.ok && second.result === 'unchanged' &&
        readFileSync(path, 'utf8') === afterFirst);

    const other = initJourneyFile(path, { slug: 'another-slug', ledgerRef: base.candidate.ledger_ref, observedAt: AT }, referenceOptions);
    check('init refuses to overwrite a different journey at the same path', !other.ok);

    const interrupt = () => updateJourneyFile(path, (e) => applyInterrupt(e, 'BLOCKED_AUTH', { observedAt: AT }, referenceOptions),
      referenceOptions);
    const paused = interrupt();
    const bytesPaused = readFileSync(path, 'utf8');
    const pausedAgain = interrupt();
    check('a duplicate interrupt is a no-op', paused.result === 'written' && pausedAgain.result === 'unchanged' &&
      readFileSync(path, 'utf8') === bytesPaused);
    check('a different interrupt while paused is refused until the first is resumed',
      !updateJourneyFile(path, (e) => applyInterrupt(e, 'BLOCKED_TRANSPORT', { observedAt: AT }, referenceOptions), referenceOptions).ok);
  }

  console.log('interrupt and resume');
  {
    const selected = advanceTo('SELECTED');
    const paused = applyInterrupt(selected, 'NEEDS_EVIDENCE', { observedAt: AT }, referenceOptions);
    check('NEEDS_EVIDENCE is recorded through the core recordInterrupt',
      paused.ok && paused.envelope.state === 'NEEDS_EVIDENCE' && paused.envelope.last_good_state === 'SELECTED');
    const resumed = applyTransition(paused.envelope, {
      to: 'DRAFT_READY', evidence: STAGE_EVIDENCE.DRAFT_READY(), observedAt: AT,
    }, referenceOptions);
    check('a paused journey resumes forward once evidence arrives and drops the interruption',
      resumed.ok && resumed.envelope.state === 'DRAFT_READY' && resumed.envelope.interruption === undefined);
    const cleared = applyTransition(paused.envelope, { to: 'SELECTED', evidence: {}, observedAt: AT }, referenceOptions);
    check('a pause can be cleared back to its last good state',
      cleared.ok && cleared.envelope.state === 'SELECTED' && cleared.envelope.interruption === undefined);

    const noArticle = applyInterrupt(selected, 'NO_ARTICLE', { observedAt: AT }, referenceOptions);
    check('NO_ARTICLE is recordable from SELECTED', noArticle.ok);
    const revived = applyTransition(noArticle.envelope, {
      to: 'DRAFT_READY', evidence: STAGE_EVIDENCE.DRAFT_READY(), observedAt: AT,
    }, referenceOptions);
    const cleared2 = applyTransition(noArticle.envelope, { to: 'SELECTED', evidence: {}, observedAt: AT }, referenceOptions);
    check('NO_ARTICLE stays terminal: no forward transition and no clearing', !revived.ok && !cleared2.ok);

    check('an interrupt that is unreachable from the current stage is refused',
      !applyInterrupt(selected, 'DEPLOYMENT_PARTIAL', { observedAt: AT }, referenceOptions).ok);
    check('STALE_REVISION cannot be asserted without observable drift',
      !applyInterrupt(advanceTo('LIVE_VERIFIED'), 'STALE_REVISION', { observedAt: AT }, referenceOptions).ok);
  }

  console.log('SOURCE_MERGED alias (F14)');
  {
    const deployedPrev = advanceTo('PUBLISH_ACCEPTED');
    const viaAlias = applyTransition(deployedPrev, {
      to: 'SOURCE_MERGED', evidence: STAGE_EVIDENCE.SOURCE_COMMITTED(), observedAt: AT,
    }, referenceOptions);
    check('SOURCE_MERGED is accepted and persisted as the canonical SOURCE_COMMITTED',
      viaAlias.ok && viaAlias.envelope.state === 'SOURCE_COMMITTED' && viaAlias.envelope.last_good_state === 'SOURCE_COMMITTED');
    check('the alias table maps only SOURCE_MERGED and no progress state is renamed',
      JSON.stringify(STATE_ALIASES) === '{"SOURCE_MERGED":"SOURCE_COMMITTED"}' &&
        PROGRESS_STATES.includes('SOURCE_COMMITTED') && !PROGRESS_STATES.includes('SOURCE_MERGED'));
    const alias = applyTransition(viaAlias.envelope, { to: 'SOURCE_MERGED', evidence: STAGE_EVIDENCE.SOURCE_COMMITTED(), observedAt: AT },
      referenceOptions);
    check('the alias is idempotent too', alias.ok && alias.result === 'unchanged');
    const schemaText = readFileSync(resolve(ROOT, 'schemas/journey-envelope.schema.json'), 'utf8');
    check('the alias never reaches the schema', !schemaText.includes('SOURCE_MERGED'));
  }

  console.log('fail closed on tampered, truncated, or unsafe files');
  {
    const good = advanceTo('IN_REVIEW');
    const path = filePath('victim.json');
    const text = `${JSON.stringify(good, null, 2)}\n`;
    writeFileSync(path, text);
    const apply = () => updateJourneyFile(path, (e) => applyTransition(e,
      { to: 'APPROVED_REVISION', evidence: STAGE_EVIDENCE.APPROVED_REVISION(), observedAt: AT }, referenceOptions), referenceOptions);

    writeFileSync(path, text.slice(0, Math.floor(text.length / 2)));
    const truncated = text.slice(0, Math.floor(text.length / 2));
    const truncatedRun = apply();
    check(`a truncated file is refused with ${CODES.HANDOFF_INVALID} and left byte-for-byte untouched`,
      !truncatedRun.ok && truncatedRun.code === CODES.HANDOFF_INVALID && readFileSync(path, 'utf8') === truncated);

    const tampered = text.replace(good.article_ref.content_hash, 'e'.repeat(64));
    writeFileSync(path, tampered);
    const tamperedRun = apply();
    check(`a tampered article hash is refused with ${CODES.STALE_REVISION} and not rewritten`,
      !tamperedRun.ok && codesOf(tamperedRun).includes(CODES.STALE_REVISION) && readFileSync(path, 'utf8') === tampered);

    const relabelled = text.replace('"state": "IN_REVIEW"', '"state": "LIVE_VERIFIED"');
    writeFileSync(path, relabelled);
    check('a hand-edited state label that outruns the records is refused',
      !apply().ok && readFileSync(path, 'utf8') === relabelled);

    const duplicateKey = text.replace('"state": "IN_REVIEW",', '"state": "IN_REVIEW", "state": "RECEIVED",');
    writeFileSync(path, duplicateKey);
    check('duplicate JSON keys are refused', !apply().ok && readFileSync(path, 'utf8') === duplicateKey);

    writeFileSync(path, '');
    check('an empty file is refused', !apply().ok && readFileSync(path, 'utf8') === '');

    check('a missing file is refused for transition', !updateJourneyFile(filePath('absent.json'), (e) => ({ ok: true, result: 'written', envelope: e }),
      referenceOptions).ok);

    writeFileSync(path, text);
    const link = filePath('link.json');
    symlinkSync(path, link);
    check('a symlinked envelope path is refused', !readJourneyFile(link, referenceOptions).ok);

    check('a failed run leaves no temp or lock files behind', leftovers().length === 0, leftovers().join(','));
  }

  console.log('atomic write and locking');
  {
    const path = filePath('atomic.json');
    initJourneyFile(path, { slug: base.candidate.slug, ledgerRef: base.candidate.ledger_ref, observedAt: AT }, referenceOptions);
    const before = readFileSync(path, 'utf8');

    // A write the validator rejects at the read-back stage must not replace the target or leak a temp file.
    const poisoned = updateJourneyFile(path, (e) => {
      const bad = clone(e);
      bad.state = 'LIVE_VERIFIED';
      bad.last_good_state = 'LIVE_VERIFIED';
      return { ok: true, result: 'written', envelope: bad };
    }, referenceOptions);
    check('an envelope that fails read-back validation is never renamed into place',
      !poisoned.ok && readFileSync(path, 'utf8') === before && leftovers().length === 0, JSON.stringify(poisoned.issues));

    const ok = updateJourneyFile(path, (e) => applyTransition(e,
      { to: 'SELECTED', evidence: STAGE_EVIDENCE.SELECTED(), observedAt: AT }, referenceOptions), referenceOptions);
    check('a successful write replaces the file with valid, trailing-newline JSON and no temp leftovers',
      ok.ok && readFileSync(path, 'utf8').endsWith('}\n') && leftovers().length === 0 &&
        readJourneyFile(path, referenceOptions).envelope.state === 'SELECTED');

    const contested = withJourneyLock(path, () => updateJourneyFile(path, (e) => ({ ok: true, result: 'unchanged', envelope: e }),
      referenceOptions));
    check('a second writer is refused while the lock is held, and the lock is then released',
      !contested.ok && !existsSync(`${path}.lock`) && leftovers().length === 0, JSON.stringify(contested));
    const innerLocked = withJourneyLock(path, () => withJourneyLock(path, () => ({ ok: true })));
    check('contention reports "locked by another writer"', /locked by another writer/.test(innerLocked.issues?.[0]?.message ?? ''));

    const missingDir = initJourneyFile(join(dir, 'no-such-dir', 'e.json'),
      { slug: base.candidate.slug, ledgerRef: base.candidate.ledger_ref, observedAt: AT }, referenceOptions);
    const missingMessage = missingDir.issues?.[0]?.message ?? '';
    check('init into a missing directory fails closed without claiming another writer holds a lock',
      !missingDir.ok && /cannot create the journey lock file/.test(missingMessage) && !/locked by another writer/.test(missingMessage),
      missingMessage);
  }

  console.log('CLI');
  {
    const ledger = writeJson('ledger-ref.json', base.candidate.ledger_ref);
    const path = filePath('cli.json');
    const init = cli('init', '--file', path, '--slug', base.candidate.slug, '--ledger-ref', ledger, '--at', AT);
    check('cli init writes a RECEIVED envelope and prints one JSON result line',
      init.status === 0 && JSON.parse(init.stdout).state === 'RECEIVED' && JSON.parse(init.stdout).result === 'written',
      init.stderr);

    let ok = true;
    for (const stage of PROGRESS_STATES.slice(1)) {
      const evidence = writeJson(`evidence-${stage}.json`, STAGE_EVIDENCE[stage]());
      const step = cli('transition', '--file', path, '--to', stage, '--evidence', evidence, '--at', AT);
      ok &&= step.status === 0 && JSON.parse(step.stdout).state === stage;
      if (!ok) console.error(step.stderr);
    }
    check('cli transition walks all nine stages to LIVE_VERIFIED', ok);

    const bytes = readFileSync(path, 'utf8');
    const replay = cli('transition', '--file', path, '--to', 'LIVE_VERIFIED',
      '--evidence', filePath('evidence-LIVE_VERIFIED.json'), '--at', '2027-01-01T00:00:00Z');
    check('cli replay of the last transition exits 0 as unchanged without touching the file',
      replay.status === 0 && JSON.parse(replay.stdout).result === 'unchanged' && readFileSync(path, 'utf8') === bytes);

    const show = cli('show', '--file', path);
    check('cli show prints the recovered state', show.status === 0 && show.stdout.includes('LIVE_VERIFIED'), show.stderr);
    const showJson = cli('show', '--file', path, '--json');
    check('cli show --json exposes resume_from and terminal', showJson.status === 0 &&
      JSON.parse(showJson.stdout).resume_from === 'LIVE_VERIFIED' && JSON.parse(showJson.stdout).terminal === false);

    const refused = cli('transition', '--file', path, '--to', 'IN_REVIEW', '--evidence', writeJson('empty.json', { review_ref: base.review_ref, extra: 1 }));
    check('cli exits 1 with a named code on a refused transition',
      refused.status === 1 && refused.stderr.includes(`[${CODES.HANDOFF_INVALID}]`), refused.stderr);

    const alias = filePath('alias.json');
    cli('init', '--file', alias, '--slug', base.candidate.slug, '--ledger-ref', ledger, '--at', AT);
    for (const stage of PROGRESS_STATES.slice(1, PROGRESS_STATES.indexOf('SOURCE_COMMITTED'))) {
      cli('transition', '--file', alias, '--to', stage, '--evidence', filePath(`evidence-${stage}.json`), '--at', AT);
    }
    const aliasRun = cli('transition', '--file', alias, '--to', 'SOURCE_MERGED', '--evidence', filePath('evidence-SOURCE_COMMITTED.json'), '--at', AT);
    check('cli accepts SOURCE_MERGED and reports the canonical SOURCE_COMMITTED',
      aliasRun.status === 0 && JSON.parse(aliasRun.stdout).state === 'SOURCE_COMMITTED', aliasRun.stderr);

    const paused = cli('interrupt', '--file', alias, '--code', 'DEPLOYMENT_PARTIAL', '--at', AT);
    check('cli interrupt records a typed pause and show reports the resume point',
      paused.status === 0 && cli('show', '--file', alias).stdout.includes('resume from SOURCE_COMMITTED'), paused.stderr);

    writeFileSync(path, bytes.slice(0, 40));
    const broken = cli('show', '--file', path);
    check('cli show fails closed (exit 1, named code) on a truncated file',
      broken.status === 1 && broken.stderr.includes(`[${CODES.HANDOFF_INVALID}]`), broken.stderr);

    const usage = spawnSync(process.execPath, [CLI, 'frobnicate', '--file', path], { cwd: ROOT, encoding: 'utf8' });
    const missing = spawnSync(process.execPath, [CLI, 'show'], { cwd: ROOT, encoding: 'utf8' });
    check('cli exits 2 on usage errors', usage.status === 2 && missing.status === 2);

    const noResolver = spawnSync(process.execPath, [CLI, 'init', '--file', filePath('noresolver.json'),
      '--slug', base.candidate.slug, '--ledger-ref', ledger], { cwd: ROOT, encoding: 'utf8' });
    check(`cli without a resolver fails closed with ${CODES.BLOCKED_TRANSPORT} and writes nothing`,
      noResolver.status === 1 && noResolver.stderr.includes(CODES.BLOCKED_TRANSPORT) &&
        !existsSync(filePath('noresolver.json')), noResolver.stderr);
  }

  console.log('git-backed resolution (--repo) and the post-selection ledger pointer');
  {
    const repoDir = filePath('il-clone');
    const git = (...args) => execFileSync('git',
      ['-c', 'user.name=writer-test', '-c', 'user.email=writer-test@example.invalid', ...args],
      { cwd: repoDir, encoding: 'utf8' }).trim();
    execFileSync('git', ['init', '-q', repoDir]);
    const commitLedger = (candidate) => {
      execFileSync('mkdir', ['-p', join(repoDir, 'intelligence/candidates')]);
      const record = { candidate };
      writeFileSync(join(repoDir, 'intelligence/candidates/ledger.json'), JSON.stringify(record));
      git('add', '.');
      git('commit', '-q', '-m', 'ledger');
      return {
        repository: 'suengj/intelligence-library',
        commit: git('rev-parse', 'HEAD'),
        path: 'intelligence/candidates/ledger.json',
        content_sha256: canonicalRecordSha256(record),
      };
    };
    const received = commitLedger({ slug: base.candidate.slug, selection: null });
    const selected = commitLedger({ slug: base.candidate.slug, selection: base.candidate.selection });
    const resolverArgs = ['--repo', `suengj/intelligence-library=${repoDir}`];
    const run = (...args) => spawnSync(process.execPath, [CLI, ...args, ...resolverArgs], { cwd: ROOT, encoding: 'utf8' });

    const path = filePath('git-backed.json');
    const init = run('init', '--file', path, '--slug', base.candidate.slug, '--ledger-ref', writeJson('ledger-received.json', received), '--at', AT);
    check('init resolves the candidate ledger from a local clone through --repo', init.status === 0, init.stderr);

    const stale = run('transition', '--file', path, '--to', 'SELECTED',
      '--evidence', writeJson('select-only.json', STAGE_EVIDENCE.SELECTED()), '--at', AT);
    check('selecting against the pre-selection ledger commit is refused (the ledger does not record the selection)',
      stale.status === 1 && stale.stderr.includes(CODES.HANDOFF_INVALID), stale.stderr);

    const ledgerOnly = run('transition', '--file', path, '--to', 'RECEIVED',
      '--evidence', writeJson('ledger-only.json', { ledger_ref: selected }), '--at', AT);
    check('the ledger pointer cannot be swapped without a selection', ledgerOnly.status === 1, ledgerOnly.stdout);

    const ok = run('transition', '--file', path, '--to', 'SELECTED',
      '--evidence', writeJson('select-and-ledger.json', { ...STAGE_EVIDENCE.SELECTED(), ledger_ref: selected }), '--at', AT);
    const persisted = readJsonFile(path);
    check('selection plus the post-selection ledger commit advances to SELECTED',
      ok.status === 0 && persisted.state === 'SELECTED' && persisted.candidate.ledger_ref.commit === selected.commit, ok.stderr);

    const replay = run('transition', '--file', path, '--to', 'SELECTED',
      '--evidence', filePath('select-and-ledger.json'), '--at', '2027-01-01T00:00:00Z');
    check('replaying the selection with its ledger pointer is a no-op', replay.status === 0 && JSON.parse(replay.stdout).result === 'unchanged');

    const swap = run('transition', '--file', path, '--to', 'SELECTED',
      '--evidence', writeJson('swap.json', { ledger_ref: received }), '--at', AT);
    check('once selected, the ledger pointer is immutable', swap.status === 1, swap.stdout);

    const unknownRepo = spawnSync(process.execPath, [CLI, 'show', '--file', path, '--repo', `suengj/other=${repoDir}`],
      { cwd: ROOT, encoding: 'utf8' });
    check(`show without a clone for the ledger repository fails closed with ${CODES.BLOCKED_TRANSPORT}`,
      unknownRepo.status === 1 && unknownRepo.stderr.includes(CODES.BLOCKED_TRANSPORT), unknownRepo.stderr);
  }

  console.log('boundary — the core stays a validator and the writer stays reference-only');
  {
    const core = readFileSync(resolve(ROOT, 'scripts/lib/journey-envelope-core.mjs'), 'utf8');
    check('the core module still has no write operation', !/writeFileSync|renameSync|openSync/.test(core));
    const writer = readFileSync(resolve(ROOT, 'scripts/lib/journey-envelope-writer.mjs'), 'utf8');
    check('the writer defines no state list of its own (it imports the core lists)',
      !/'RECEIVED'\s*,\s*'SELECTED'/.test(writer.replace(/state: 'RECEIVED'/g, '')));
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failures === 0
  ? '\njourney envelope writer regression: PASS'
  : `\njourney envelope writer regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
