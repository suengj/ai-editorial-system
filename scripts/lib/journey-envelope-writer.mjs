/**
 * Journey envelope writer — SUE-1659.
 *
 * A thin, append-only persistence layer over `journey-envelope-core.mjs`.
 * It owns no state machine: the core derives the progress state from the
 * records actually present and rejects any label that disagrees, so a
 * transition here is "merge evidence refs, relabel, ask the core validator".
 * Anything the validator refuses is never written.
 *
 * Boundaries (unchanged from the core contract): it stores references and
 * digests only, grants no approval, and performs no publication. No database,
 * queue, or service — one JSON file, replaced atomically.
 */

import {
  closeSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, unlinkSync, writeSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import {
  CODES,
  INTERRUPT_STATES,
  PROGRESS_STATES,
  journeyBindingSha256,
  loadSchema,
  parseJourneyJson,
  recordInterrupt,
  validateJourneyEnvelope,
} from './journey-envelope-core.mjs';

/**
 * Vocabulary alignment (SUE-787 F14): the downstream publication-state reader
 * says SOURCE_MERGED for what the envelope calls SOURCE_COMMITTED. The writer
 * accepts the alias on input and always persists the canonical envelope name.
 */
export const STATE_ALIASES = Object.freeze({ SOURCE_MERGED: 'SOURCE_COMMITTED' });
export const canonicalState = (state) => STATE_ALIASES[state] ?? state;

const PROGRESS_INDEX = new Map(PROGRESS_STATES.map((state, index) => [state, index]));
// Fields owned by the writer or fixed at init; everything else in the schema is evidence.
const CONTROL_FIELDS = Object.freeze([
  'schema_version', 'journey_id', 'state', 'last_good_state', 'updated_at', 'candidate', 'interruption',
]);
// `selection` and `ledger_ref` are the evidence keys that live under `candidate`. The ledger
// is re-pointed at its post-selection commit only together with the selection (RECEIVED -> SELECTED).
const SELECTION_KEY = 'selection';
const LEDGER_KEY = 'ledger_ref';

const issue = (code, where, message) => ({ code, where, message });
const fail = (issues) => ({ ok: false, code: issues[0].code, issues });
const refuse = (code, where, message) => fail([issue(code, where, message)]);
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

export const evidenceKeys = () => [
  ...Object.keys(loadSchema().properties).filter((key) => !CONTROL_FIELDS.includes(key)),
  SELECTION_KEY,
  LEDGER_KEY,
];

/** A brand-new journey at RECEIVED. The candidate is not selected yet. */
export function createJourney({ slug, ledgerRef, observedAt = nowIso() } = {}, referenceOptions = {}) {
  const envelope = {
    schema_version: '1.0.0',
    journey_id: `journey:${slug}`,
    state: 'RECEIVED',
    last_good_state: 'RECEIVED',
    updated_at: observedAt,
    candidate: { slug, ledger_ref: clone(ledgerRef), selection: null },
  };
  const issues = validateJourneyEnvelope(envelope, referenceOptions);
  return issues.length > 0 ? fail(issues) : { ok: true, result: 'written', envelope };
}

function mergeEvidence(envelope, evidence) {
  const allowed = evidenceKeys();
  const next = clone(envelope);
  let changed = false;
  for (const [key, value] of Object.entries(evidence)) {
    if (!allowed.includes(key)) {
      return refuse(CODES.HANDOFF_INVALID, `$.evidence.${key}`,
        `unknown or writer-controlled field; allowed evidence fields: ${allowed.join(', ')}`);
    }
    const current = key === SELECTION_KEY ? envelope.candidate.selection
      : key === LEDGER_KEY ? envelope.candidate.ledger_ref : envelope[key];
    const absent = current === undefined || current === null;
    if (key === LEDGER_KEY && envelope.candidate.selection === null && evidence[SELECTION_KEY] !== undefined) {
      if (!same(current, value)) {
        next.candidate.ledger_ref = clone(value);
        changed = true;
      }
      continue;
    }
    if (!absent) {
      if (!same(current, value)) {
        return refuse(CODES.HANDOFF_INVALID, `$.${key}`,
          `${key} is already recorded with different content; the envelope is append-only`);
      }
      continue;
    }
    changed = true;
    if (key === SELECTION_KEY) next.candidate.selection = clone(value);
    else next[key] = clone(value);
  }
  return { ok: true, next, changed };
}

/**
 * Advance (or resume) a journey to `to`, recording the supplied evidence refs.
 * Duplicate identical requests are no-ops. The core validator is the only
 * judge of whether the resulting records support the claimed state.
 */
export function applyTransition(envelope, { to, evidence = {}, observedAt = nowIso() } = {}, referenceOptions = {}) {
  const target = canonicalState(to);
  if (!PROGRESS_INDEX.has(target)) {
    return refuse(CODES.HANDOFF_INVALID, '$.to',
      `${to} is not a progress state; use interrupt for ${INTERRUPT_STATES.join(', ')}`);
  }
  if (!isPlainObject(evidence)) {
    return refuse(CODES.HANDOFF_INVALID, '$.evidence', 'evidence must be a JSON object of envelope fields');
  }
  const baseline = validateJourneyEnvelope(envelope, referenceOptions);
  if (baseline.length > 0) return fail(baseline);

  const interrupted = INTERRUPT_STATES.includes(envelope.state);
  if (envelope.state === 'NO_ARTICLE') {
    return refuse(CODES.HANDOFF_INVALID, '$.state', 'NO_ARTICLE is terminal; it has no resume point');
  }

  const merged = mergeEvidence(envelope, evidence);
  if (!merged.ok) return merged;
  const next = merged.next;

  if (!interrupted) {
    const targetIndex = PROGRESS_INDEX.get(target);
    const currentIndex = PROGRESS_INDEX.get(envelope.state);
    if (targetIndex <= currentIndex) {
      // Replaying an already-applied transition is a no-op; anything else is a regression.
      return !merged.changed
        ? { ok: true, result: 'unchanged', envelope: clone(envelope) }
        : refuse(CODES.HANDOFF_INVALID, '$.to',
          `transitions are forward-only: ${envelope.state} -> ${target} is refused`);
    }
  } else {
    delete next.interruption;
  }

  if (next.dossier !== undefined && next.article_ref !== undefined && next.journey_binding_sha256 === undefined) {
    next.journey_binding_sha256 = journeyBindingSha256(next.candidate, next.dossier, next.article_ref);
  }
  next.state = target;
  next.last_good_state = target;
  next.updated_at = observedAt;

  const issues = validateJourneyEnvelope(next, referenceOptions);
  return issues.length > 0 ? fail(issues) : { ok: true, result: 'written', envelope: next };
}

/** Record a typed pause through the core `recordInterrupt`, idempotently. */
export function applyInterrupt(envelope, code, { reasonRef, observedAt = nowIso() } = {}, referenceOptions = {}) {
  const baseline = validateJourneyEnvelope(envelope, referenceOptions);
  if (baseline.length > 0) return fail(baseline);
  if (envelope.state === code && envelope.interruption?.code === code &&
      same(envelope.interruption.reason_ref, reasonRef)) {
    return { ok: true, result: 'unchanged', envelope: clone(envelope) };
  }
  const recorded = recordInterrupt(envelope, code, { observedAt, reasonRef, referenceOptions });
  return recorded.ok ? { ok: true, result: 'written', envelope: recorded.envelope } : fail(recorded.issues);
}

/** Read one envelope file; unparseable, truncated, tampered, or symlinked input fails closed. */
export function readJourneyFile(path, referenceOptions = {}) {
  let raw;
  try {
    if (lstatSync(path).isSymbolicLink()) {
      return refuse(CODES.HANDOFF_INVALID, path, 'refusing to follow a symlinked journey envelope');
    }
    raw = readFileSync(path);
  } catch (error) {
    return refuse(CODES.HANDOFF_INVALID, path, `cannot read journey envelope: ${error.message}`);
  }
  let envelope;
  try {
    envelope = parseJourneyJson(raw, path);
  } catch (error) {
    return refuse(CODES.HANDOFF_INVALID, path, `unparseable journey envelope: ${error.message}`);
  }
  const issues = validateJourneyEnvelope(envelope, referenceOptions);
  return issues.length > 0 ? fail(issues) : { ok: true, envelope, raw };
}

export const serializeJourney = (envelope) => `${JSON.stringify(envelope, null, 2)}\n`;

/**
 * Replace `path` atomically: write a sibling temp file, fsync, read the temp
 * bytes back through the validator, then rename. Nothing is renamed unless the
 * bytes that will exist on disk validate.
 */
export function writeJourneyFileAtomic(path, envelope, referenceOptions = {}) {
  const tmp = join(dirname(path), `.${basename(path)}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`);
  let fd;
  try {
    fd = openSync(tmp, 'wx', 0o644);
    writeSync(fd, serializeJourney(envelope));
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    const issues = validateJourneyEnvelope(parseJourneyJson(readFileSync(tmp), tmp), referenceOptions);
    if (issues.length > 0) {
      unlinkSync(tmp);
      return fail(issues);
    }
    renameSync(tmp, path);
    return { ok: true };
  } catch (error) {
    try { if (fd !== undefined) closeSync(fd); } catch { /* already closed */ }
    try { unlinkSync(tmp); } catch { /* never created or already renamed */ }
    return refuse(CODES.HANDOFF_INVALID, path, `atomic write failed: ${error.message}`);
  }
}

/** Run `step` under an exclusive lock file so two writers cannot interleave. */
export function withJourneyLock(path, step) {
  const lock = `${path}.lock`;
  let fd;
  try {
    fd = openSync(lock, 'wx', 0o600);
    writeSync(fd, `${process.pid}\n`);
  } catch (error) {
    return refuse(CODES.HANDOFF_INVALID, lock,
      `journey envelope is locked by another writer (${error.code ?? error.message}); remove the lock only after confirming no writer is running`);
  }
  try {
    return step();
  } finally {
    closeSync(fd);
    try { unlinkSync(lock); } catch { /* already gone */ }
  }
}

/** Read → apply → atomic write, all under the lock. Unchanged results do not touch the file. */
export function updateJourneyFile(path, apply, referenceOptions = {}) {
  return withJourneyLock(path, () => {
    const current = readJourneyFile(path, referenceOptions);
    if (!current.ok) return current;
    const outcome = apply(current.envelope);
    if (!outcome.ok || outcome.result === 'unchanged') return outcome;
    const written = writeJourneyFileAtomic(path, outcome.envelope, referenceOptions);
    return written.ok ? outcome : written;
  });
}

/** Create the file once; an identical replay is a no-op and a different journey is refused. */
export function initJourneyFile(path, request, referenceOptions = {}) {
  return withJourneyLock(path, () => {
    let exists = true;
    try { lstatSync(path); } catch (error) { if (error.code === 'ENOENT') exists = false; }
    const created = createJourney(request, referenceOptions);
    if (!created.ok) return created;
    if (exists) {
      const current = readJourneyFile(path, referenceOptions);
      if (!current.ok) return current;
      const e = current.envelope;
      return e.candidate.slug === request.slug && same(e.candidate.ledger_ref, request.ledgerRef)
        ? { ok: true, result: 'unchanged', envelope: e }
        : refuse(CODES.HANDOFF_INVALID, path, 'a different journey envelope already exists at this path');
    }
    const written = writeJourneyFileAtomic(path, created.envelope, referenceOptions);
    return written.ok ? created : written;
  });
}
