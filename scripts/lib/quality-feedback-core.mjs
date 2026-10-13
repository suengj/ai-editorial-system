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
import { selectExamples } from './resolve-core.mjs';

export const CANDIDATE_AFTER = 2;
export const NO_APPROVED_REFERENCE = 'NO_APPROVED_REFERENCE';
export const APPROVALS_PATH = 'editorial/approved-examples.json';
export const EXPLICIT_RE = /앞으로|from now on|going forward|이제부터/i;

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const isPlaceholder = (e) => /SYNTHETIC PLACEHOLDER/.test(e?.source_ref?.locator ?? '') || /placeholder/i.test(e?.entry_id ?? '');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const readDir = (d) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')).sort().map((f) => readJson(resolve(d, f))) : []);

/** Approved corpus material for a receipt's target: only index-listed, corpus-confirmed, non-placeholder entries. */
export function loadApprovedCandidates(receipt, { repoRoot, approvals = null, corpus = null } = {}) {
  const idx = approvals ?? readJson(resolve(repoRoot, APPROVALS_PATH));
  const entries = corpus ?? readDir(resolve(repoRoot, 'evals/real-output-corpus/entries'));
  const byId = new Map(entries.map((e) => [e.entry_id, e]));
  const out = []; const rejected = [];
  for (const a of idx.approvals ?? []) {
    const e = byId.get(a.entry_id);
    const why = !e ? 'corpus entry not found' : isPlaceholder(e) ? 'synthetic placeholder' : e.owner_verdict !== 'accepted' ? `owner_verdict=${e.owner_verdict}` : e.reference_eligible !== true ? 'not reference_eligible' : a.voice_family !== receipt?.target?.voice_family ? 'other voice family' : (a.targets && !a.targets.includes(receipt.target.id)) ? 'other target' : null;
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
  constructor(root) { this.root = root; }
  dir(name) { const d = resolve(this.root, name); mkdirSync(d, { recursive: true }); return d; }
  scopeKey(target, format) { if (!target || !format) throw Object.assign(new Error('feedback needs an explicit target and format scope'), { code: 'SCOPE_REQUIRED' }); return `${slug(target)}__${slug(format)}`; }
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
  const scope = store.scopeKey(target, format);
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

/** Explicit standing instruction -> new preference VERSION for this target+format only. */
export function applyExplicitPreference(store, { target, format, instruction, statement, task_id = null }) {
  const scope = store.scopeKey(target, format);
  if (!EXPLICIT_RE.test(statement ?? '')) throw Object.assign(new Error('not an explicit standing instruction (needs "앞으로 …"); record it as implicit task feedback instead'), { code: 'NOT_EXPLICIT' });
  if (!instruction) throw Object.assign(new Error('instruction text required'), { code: 'BAD_FIELD' });
  const path = store.file('preferences', scope);
  const cur = store.readOr(path, { schema: 'scoped-preference/1', target, format, scope, versions: [] });
  const prev = cur.versions.at(-1) ?? null;
  const v = { version: (prev?.version ?? 0) + 1, instruction, statement, task_id, supersedes: prev?.version ?? null, active: true };
  if (prev) prev.active = false;
  cur.versions.push(v);
  store.write(path, cur);
  return { path, version: v.version, scope };
}

export function rollbackPreference(store, { target, format }) {
  const path = store.file('preferences', store.scopeKey(target, format));
  const cur = store.readOr(path, null);
  if (!cur || cur.versions.length === 0) return null;
  const last = cur.versions.at(-1);
  last.active = false; last.rolled_back = true;
  const prior = [...cur.versions].reverse().find((v) => !v.rolled_back && v !== last);
  if (prior) prior.active = true;
  store.write(path, cur);
  return { active_version: prior?.version ?? null };
}

/** What this request may use: ONLY this target+format's active preference and its open candidates (listed, not applied). */
export function scopedGuidance(store, { target, format }) {
  const scope = store.scopeKey(target, format);
  const pref = store.readOr(resolve(store.root, 'preferences', `${scope}.json`), null);
  const active = pref?.versions.find((v) => v.active) ?? null;
  const candidates = readDir(resolve(store.root, 'candidates')).filter((c) => c.scope === scope).map((c) => ({ kind: c.kind, status: c.status, applied: false, evidence_tasks: c.evidence_tasks }));
  return { scope, preference: active ? { version: active.version, instruction: active.instruction } : null, candidates, shared_profile_modified: false };
}

/** Block assembled for the editorial brief (no profile mutation, no analytics). */
export function qualityBlock({ receipt, manifest, repoRoot, store = null, format = null, exampleReason = null, approvals = null, corpus = null }) {
  const examples = exampleStep(receipt, manifest, { reason: exampleReason, repoRoot, approvals, corpus });
  const guidance = store && receipt?.target && format ? scopedGuidance(store, { target: receipt.target.id, format }) : null;
  return { examples, guidance, tracked: ['first_result_adopted', 'repeated_errors', 'revision_count'], analytics_collected: false };
}
