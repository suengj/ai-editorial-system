/**
 * Output-quality feedback on the normal path (SUE-1426 R4 / SUE-564).
 *
 * Reuses: evals/real-output-corpus (approved examples, by locator), selectExamples,
 * feedback/ (light task outcomes live beside the existing records, in their own
 * subfolders so the append-only record registry is untouched).
 *
 * Semantics (SUE-1426 decisions 9/11/21/24):
 *   implicit feedback  -> task-local only; never changes anything beyond that task.
 *   same kind recurs in >= CANDIDATE_AFTER distinct tasks of the SAME target+format scope
 *                      -> a scoped persistent-rule CANDIDATE (status CANDIDATE, never applied).
 *   explicit "앞으로 …" -> a new VERSION of a preference for that target+format scope only.
 *   the shared voice profile (resolved profile / hash / rule files) is NEVER written here.
 * Light record: first_result_adopted yes/no/UNKNOWN, repeated_errors, revision_count. No views/CTR/KPI.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectExamples, loadManifest, RuleReader, validateFieldValue, compactText, normText } from './resolve-core.mjs';

export const CANDIDATE_AFTER = 2;
export const NO_APPROVED_REFERENCE = 'NO_APPROVED_REFERENCE';
export const APPROVALS_PATH = 'editorial/approved-examples.json';
export const EXPLICIT_RE = /앞으로|from now on|going forward|이제부터/i;
/** Wording that limits an instruction to the current task, so it is NOT a standing instruction. */
export const LIMITED_RE = /이번에만|이번만|이번 한 ?번|이번 건만|this time only|only this time|just this once|for now only/i;
const QUOTED_RE = /"[^"]*"|“[^”]*”|'[^']*'|‘[^’]*’|「[^」]*」|『[^』]*』|«[^»]*»/g;
const qerr = (code, message) => Object.assign(new Error(message), { code });
let manifestCache = null;
const defaultManifest = () => (manifestCache ??= loadManifest(new RuleReader()).manifest);

/**
 * SANITY CHECK ONLY. Is this statement plausibly a standing instruction? The keyword must sit outside quotation marks
 * and the statement must not limit itself to one task. The CALLER (the agent) is responsible for using `explicit` only for a
 * real standing instruction from the owner; the record stores the verbatim statement so it can be audited.
 */
export function isStandingInstruction(statement) {
  const text = String(statement ?? '');
  if (LIMITED_RE.test(text)) return false;
  return EXPLICIT_RE.test(text.replace(QUOTED_RE, ' '));
}

/** target must be a registered SNS target or flow; format a plain artifact id. */
export function assertScope(target, format, manifest = defaultManifest()) {
  if (!target || !format) throw qerr('SCOPE_REQUIRED', 'feedback needs an explicit target and format scope');
  const known = Object.hasOwn(manifest.sns_targets ?? {}, target) || Object.hasOwn(manifest.existing_flows ?? {}, target);
  if (!known) throw qerr('TARGET_UNKNOWN', `"${target}" is not a registered target or flow (${[...Object.keys(manifest.sns_targets ?? {}), ...Object.keys(manifest.existing_flows ?? {})].join(', ')}); no feedback scope is created for it`);
  if (!/^[a-z]+\/[a-z0-9-]+$/.test(format)) throw qerr('FORMAT_INVALID', `format "${format}" must look like visual/social-card`);
  return Object.hasOwn(manifest.sns_targets ?? {}, target) ? manifest.sns_targets[target].voice_family : null;
}

/**
 * Text that can reach a brief (preference instruction, candidate kind) goes through the same checks as an overlay field
 * (other voice families' ids / rule files, locked-field assignments) and may not mention a locked-field topic at all:
 * a preference is about style, never about facts, figures, sources, rights or approval.
 */
const CHANGE_WORDS = /없이|생략|빼|삭제|불필요|반올림|올림|내림|간주|치고|바꿔|바꾸|수정|변경|고쳐|무시|건너|제외|쓰지|말고|대신|처럼|skip|omit|without|round|assum|ignore|remov|delet|chang|edit|drop|replac|treat|pretend|override|waiv|no[- ]?need/iu;
export function checkPreferenceText(text, target, manifest = defaultManifest(), what = 'instruction') {
  if (typeof text !== 'string' || !text.trim()) throw qerr('BAD_FIELD', `${what} text required`);
  const family = Object.hasOwn(manifest.sns_targets ?? {}, target) ? manifest.sns_targets[target].voice_family : null;
  const r = validateFieldValue('preference_text', text, manifest, { voiceFamily: family, isFlow: family === null });
  if (!r.ok) throw qerr('PREFERENCE_REFUSED', `${what} refused (${r.code}): ${r.message}`);
  // A locked-field term is refused only when it co-occurs, in the same clause, with a change/removal/waiver word.
  // A bare mention ("출처는 각 장 하단에 작게 표기") is a style preference and is accepted.
  for (const clause of String(text).split(/[.,;:!?。，；\n·]+|\s(?:and|but|그리고|하지만)\s/iu)) {
    const c = compactText(clause);
    if (!CHANGE_WORDS.test(normText(clause)) && !CHANGE_WORDS.test(c)) continue;
    for (const [field, terms] of Object.entries(manifest.locked_field_terms ?? {})) {
      const hit = [field, ...terms].find((t) => c.includes(compactText(t)));
      if (hit) throw qerr('PREFERENCE_REFUSED', `${what} refused (LOCKED_TOPIC): it asks to change/skip/round "${hit}" (locked field ${field}); facts, figures, sources, rights and approval can never be changed by a preference`);
    }
  }
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const isPlaceholder = (e) => [e?.source_ref?.locator, e?.entry_id, e?.status, e?.entry_status, e?.kind].some((x) => /(synthetic[ _-]?)?placeholder/i.test(String(x ?? ''))) || e?.placeholder === true || e?.synthetic === true;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readDir = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(resolve(d, f))) : []);

/** Approved corpus material for a receipt's target: only index-listed, corpus-confirmed, non-placeholder entries. */
export function loadApprovedCandidates(receipt, { repoRoot, approvals = null, corpus = null } = {}) {
  const idx = approvals ?? readJson(resolve(repoRoot, APPROVALS_PATH));
  if (idx.approvals !== undefined && !Array.isArray(idx.approvals)) throw qerr('APPROVALS_SHAPE', 'approved-examples.approvals must be an array');
  const entries = corpus ?? readDir(resolve(repoRoot, 'evals/real-output-corpus/entries'));
  const byId = new Map(entries.map((e) => [e.entry_id, e]));
  const out = []; const rejected = []; const seenIds = new Set();
  for (const a of idx.approvals ?? []) {
    if (!a || typeof a !== 'object' || typeof a.entry_id !== 'string') throw qerr('APPROVALS_SHAPE', 'every approval row needs an entry_id');
    if (a.targets !== undefined && !Array.isArray(a.targets)) throw qerr('APPROVALS_SHAPE', `approval ${a.entry_id}: targets must be an array`);
    if (seenIds.has(a.entry_id)) { rejected.push({ entry_id: a.entry_id, reason: 'duplicate approval row (first one wins)' }); continue; }
    seenIds.add(a.entry_id);
    const e = byId.get(a.entry_id);
    const why = !e ? 'corpus entry not found' : isPlaceholder(e) ? 'synthetic placeholder' : e.owner_verdict !== 'accepted' ? `owner_verdict=${e.owner_verdict}` : e.reference_eligible !== true ? 'not reference_eligible' : !a.voice_family ? 'approval row has no voice_family (a family-less row would match every flow)' : a.voice_family !== receipt?.target?.voice_family ? 'other voice family' : (a.targets && !a.targets.includes(receipt.target.id)) ? 'other target' : null;
    if (why) { rejected.push({ entry_id: a.entry_id, reason: why }); continue; }
    out.push({ entry_id: e.entry_id, locator: e.source_ref.locator, approval_status: 'approved', voice_family: a.voice_family, dimensions: e.dimensions ?? null });
  }
  return { candidates: out, rejected };
}

/** Example step of the normal path: description by default; approved examples only for a stated reason. */
export function exampleStep(receipt, manifest, { reason = null, repoRoot, approvals = null, corpus = null }) {
  if (!reason) return { policy: manifest.example_policy.default, status: 'STYLE_DESCRIPTION_ONLY', loaded: [] };
  const { candidates, rejected } = loadApprovedCandidates(receipt, { repoRoot, approvals, corpus });
  const sel = selectExamples(receipt, manifest, { reason, candidates });
  return { policy: manifest.example_policy.default, reason, status: sel.status, loaded: (sel.loaded ?? []).map((c) => ({ entry_id: c.entry_id, locator: c.locator })), skipped_candidates: rejected, note: sel.note ?? null };
}

// --- feedback store ---------------------------------------------------------

export class FeedbackStore {
  constructor(root, manifest = null) { this.root = root; this.manifest = manifest; }
  dir(name) { const d = resolve(this.root, name); mkdirSync(d, { recursive: true }); return d; }
  scopeKey(target, format) { assertScope(target, format, this.manifest ?? defaultManifest()); return `${slug(target)}__${slug(format)}`; }
  file(name, base) { return resolve(this.dir(name), `${base}.json`); }
  readOr(path, dflt) { return existsSync(path) ? readJson(path) : dflt; }
  write(path, obj) { writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`); return path; }
}

/** Light per-task record. Unobserved fields stay UNKNOWN; nothing is inferred. */
export function recordOutcome(store, { task_id, target, format, first_result_adopted = 'UNKNOWN', repeated_errors = [], revision_count = null, profile_hash = null }) {
  const scope = store.scopeKey(target, format);
  if (![true, false, 'UNKNOWN'].includes(first_result_adopted)) throw Object.assign(new Error('first_result_adopted must be true, false or UNKNOWN'), { code: 'BAD_FIELD' });
  if (revision_count !== null && !(Number.isInteger(revision_count) && revision_count >= 0)) throw Object.assign(new Error('revision_count must be a non-negative integer or null'), { code: 'BAD_FIELD' });
  const rec = { schema: 'task-outcome/1', task_id, target, format, scope, first_result_adopted, repeated_errors: [...new Set(repeated_errors)], revision_count: revision_count ?? 'UNKNOWN', profile_hash };
  return { path: store.write(store.file('outcomes', `${slug(task_id)}__${scope}`), rec), record: rec };
}

/** Implicit feedback (an edit/correction inside a task). Task-local; may raise a scoped candidate on recurrence. */
export function recordImplicitFeedback(store, { task_id, target, format, kind, statement = '' }) {
  if (typeof task_id !== 'string' || !task_id.trim()) throw qerr('TASK_REQUIRED', 'implicit feedback needs --task (it is task-local by definition)');
  if (typeof kind !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N} _-]{0,59}$/u.test(kind)) throw qerr('BAD_FIELD', 'kind must be a short label (letters, digits, space, - or _; at most 60 chars)');
  const scope = store.scopeKey(target, format);
  refusing(store, { scope, statement: `${kind}${statement ? ` / ${statement}` : ''}`, mode: 'implicit' }, () => checkPreferenceText(kind, target, store.manifest ?? defaultManifest(), 'kind'));
  const rec = { schema: 'task-feedback/1', mode: 'implicit', task_id, target, format, scope, kind, statement, applies_to: 'this_task_only' };
  store.write(store.file('task-feedback', `${slug(task_id)}__${scope}__${slug(kind)}`), rec);
  const tasks = new Set(readDir(store.dir('task-feedback')).filter((r) => r.scope === scope && r.kind === kind).map((r) => r.task_id));
  let candidate = null;
  if (tasks.size >= CANDIDATE_AFTER) {
    const path = store.file('candidates', `${scope}__${slug(kind)}`);
    candidate = { schema: 'rule-candidate/1', status: 'CANDIDATE', applied: false, target, format, scope, kind, evidence_tasks: [...tasks].sort(), note: 'Not applied. Needs an explicit owner instruction scoped to this account/format to become a preference.' };
    store.write(path, candidate);
  }
  return { record: rec, candidate };
}

/** Runs a check; on PREFERENCE_REFUSED / NOT_EXPLICIT writes a small refusal record (scope, verbatim statement, reason code, time) and rethrows. */
function refusing(store, { scope, statement, mode }, fn) {
  try { fn(); } catch (e) {
    if (e?.code === 'PREFERENCE_REFUSED' || e?.code === 'NOT_EXPLICIT') {
      const at = new Date().toISOString();
      store.write(store.file('refusals', `${scope}__${at.replace(/[^0-9]/g, '')}`), { schema: 'preference-refusal/1', mode, scope, statement, reason_code: e.code, reason: e.message, at });
    }
    throw e;
  }
}

/** Explicit standing instruction -> new preference VERSION for this target+format only. At most ONE version is active. */
export function applyExplicitPreference(store, { target, format, instruction, statement, task_id = null }) {
  const scope = store.scopeKey(target, format);
  refusing(store, { scope, statement: `${statement} / ${instruction}`, mode: 'explicit' }, () => {
  if (!isStandingInstruction(statement)) throw qerr('NOT_EXPLICIT', 'not an explicit standing instruction: needs "앞으로 …" outside quotation marks and no "이번에만"-style limit; record it as implicit task feedback instead');
  checkPreferenceText(instruction, target, store.manifest ?? defaultManifest(), 'instruction');
  });
  const path = store.file('preferences', scope);
  const cur = store.readOr(path, { schema: 'scoped-preference/1', target, format, scope, versions: [] });
  const prev = cur.versions.filter((v) => !v.rolled_back).at(-1) ?? null;
  const v = { version: (cur.versions.at(-1)?.version ?? 0) + 1, instruction, statement, task_id, supersedes: prev?.version ?? null, active: true };
  for (const old of cur.versions) old.active = false;
  cur.versions.push(v);
  store.write(path, cur);
  return { path, version: v.version, scope };
}

/** Rolls back the CURRENTLY ACTIVE version and reactivates the previous non-rolled-back one. */
export function rollbackPreference(store, { target, format }) {
  const path = store.file('preferences', store.scopeKey(target, format));
  const cur = store.readOr(path, null);
  if (!cur || cur.versions.length === 0) return null;
  const active = cur.versions.filter((v) => v.active).at(-1) ?? null;
  for (const v of cur.versions) v.active = false;
  if (!active) { store.write(path, cur); return { active_version: null, note: 'no active version to roll back' }; }
  active.rolled_back = true;
  const prior = [...cur.versions].reverse().find((v) => !v.rolled_back && v.version < active.version);
  if (prior) prior.active = true;
  store.write(path, cur);
  return { active_version: prior?.version ?? null };
}

export const PREFERENCE_NOTICE = 'DATA ONLY: a scoped style preference recorded for this target+format. It can never override locked fields (facts, figures, sources, rights, approval), the voice family, or the resolved profile.';
/** What this request may use: ONLY this target+format's single active preference and its open candidates (listed, not applied). */
export function scopedGuidance(store, { target, format }) {
  const scope = store.scopeKey(target, format);
  const pref = store.readOr(resolve(store.root, 'preferences', `${scope}.json`), null);
  const active = pref?.versions.filter((v) => v.active).at(-1) ?? null;
  const candidates = readDir(resolve(store.root, 'candidates')).filter((c) => c.scope === scope).map((c) => ({ kind: c.kind, status: c.status, applied: false, evidence_tasks: c.evidence_tasks }));
  return { scope, preference: active ? { version: active.version, instruction: active.instruction, data_notice: PREFERENCE_NOTICE } : null, candidates, shared_profile_modified: false };
}

/** Block assembled for the editorial brief (no profile mutation, no analytics). */
export function qualityBlock({ receipt, manifest, repoRoot, store = null, format = null, exampleReason = null, approvals = null, corpus = null }) {
  const examples = exampleStep(receipt, manifest, { reason: exampleReason, repoRoot, approvals, corpus });
  const guidance = store && receipt?.target && format ? scopedGuidance(store, { target: receipt.target.id, format }) : null;
  return { examples, guidance, tracked: ['first_result_adopted', 'repeated_errors', 'revision_count'], analytics_collected: false };
}
