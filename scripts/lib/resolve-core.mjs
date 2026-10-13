/**
 * Common editorial entry — SUE-1426 R1/R2.
 *
 * Builds on the EXISTING intake (Editorial Intent), axis profiles and
 * visual-execution/carousel renderers. It adds only:
 *   - a selective LOAD PLAN (which rule files this request needs, read once per
 *     revision, with honest read status),
 *   - field-wise precedence with locks and a conflict/origin record,
 *   - the SNS target -> copy profile / visual profile map,
 *   - one resolved-profile object with a hash that generate/polish/review share.
 * No LLM, network, publication or account access. Natural-language meaning is
 * resolved by the calling LLM (it passes target/overrides); this code only does
 * deterministic assembly, conflict detection and validation.
 */
import { readFileSync as realRead, statSync as realStat, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const MANIFEST_PATH = 'editorial/entry-manifest.json';
export const RECEIPT_VERSION = '1.0.0';

export const STATUS = Object.freeze({
  READY: 'READY',
  BLOCKED_MISSING_RULE: 'BLOCKED_MISSING_RULE',
  BLOCKED_TARGET_REQUIRED: 'BLOCKED_TARGET_REQUIRED',
  BLOCKED_UNKNOWN_TARGET: 'BLOCKED_UNKNOWN_TARGET',
  BLOCKED_LEAK: 'BLOCKED_LEAK',
});
export const READ = Object.freeze({ READ: 'read', MISSING: 'missing', TRUNCATED: 'truncated', INACCESSIBLE: 'inaccessible', INVALID: 'invalid', MODIFIED: 'modified' });

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
export const stable = (x) => (Array.isArray(x) ? x.map(stable) : isObj(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, stable(x[k])])) : x);
export const hashOf = (x) => `sha256:${createHash('sha256').update(Buffer.isBuffer(x) ? x : JSON.stringify(stable(x))).digest('hex')}`;

/**
 * Flows that have no Editorial Intent (e.g. the Signalytics packet -> series.json flow) derive the
 * minimal intent the resolver needs (surface + artifact) from the render plan itself. The receipt records
 * that it was plan-derived; it grants no more than an intent with those two axes would.
 */
export function intentFromPlan(plan) {
  const surface = plan?.profiles?.surface, artifact = plan?.profiles?.artifact;
  if (typeof surface !== 'string' || typeof artifact !== 'string' || !surface || !artifact) {
    throw Object.assign(new Error('plan has no profiles.surface / profiles.artifact to derive an entry request from'), { code: 'PLAN_PROFILES_MISSING' });
  }
  return { intent_id: `plan:${hashOf(plan)}`, derived_from: { kind: 'plan', surface, artifact }, request: {}, axes: { surface: { value: surface }, artifacts: [{ value: artifact }] } };
}

export const UNKNOWN_REVISION = 'UNKNOWN';
/** How a rule file's bytes were checked against git. */
export const VERIFY = Object.freeze({ GIT_BLOB: 'git_blob_verified', DIRTY: 'dirty_unverified', NO_GIT: 'unverified_no_git' });
const gitOut = (root, args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
/** git blob id of bytes, identical to `git hash-object --stdin` (no filters). */
export const gitBlobId = (buf) => createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
const sameDir = (a, b) => { try { return realpathSync(a) === realpathSync(b); } catch { return false; } };

/**
 * Git state of `root`, only when `root` IS the repository top level. `git -C root` walks up to a parent
 * repository (a non-git copy under $HOME would otherwise report the home repo's revision), so the top level must
 * equal the expected root; anything else is UNKNOWN. `tree`/`dirty` cover the rule trees only.
 */
export function gitState(root = REPO_ROOT, { full = true } = {}) {
  const top = gitOut(root, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0 || !sameDir(top.stdout.trim(), root)) return { ok: false, revision: UNKNOWN_REVISION };
  const head = gitOut(root, ['rev-parse', '--short', 'HEAD']);
  if (head.status !== 0) return { ok: false, revision: UNKNOWN_REVISION };
  const st = gitOut(root, ['status', '--porcelain', '-z', '-uall', '--', 'editorial', 'skills']);
  const dirty = new Set();
  const parts = st.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) { const e = parts[i]; dirty.add(e.slice(3)); if (/^[RC]/.test(e)) i += 1; }
  const state = { ok: true, revision: `${head.stdout.trim()}${dirty.size ? '+dirty' : ''}`, dirty };
  if (full) {
    state.tree = new Map();
    for (const line of gitOut(root, ['ls-tree', '-r', '-l', 'HEAD', '--', 'editorial', 'skills']).stdout.split('\n')) {
      const m = /^\d+ blob ([0-9a-f]{40})\s+(\d+|-)\t(.+)$/.exec(line);
      if (m) state.tree.set(m[3], { blob: m[1], size: Number(m[2]) });
    }
  }
  return state;
}

/** Best-effort revision of the rule tree: git HEAD (+dirty marker) of THIS repository, else 'UNKNOWN'. */
export function currentRevision(root = REPO_ROOT) { return gitState(root, { full: false }).revision; }

/**
 * Reads rule files once per (path, revision). A dirty/unknown revision is additionally validated by
 * size+mtime so an edited file is never served stale. `fs` is injectable so truncation/inaccessible handling
 * is testable.
 *
 * A required rule file is `read` only when it is non-empty, not shorter than its own size, valid JSON if it is
 * a .json file, and (inside a git repository) byte-identical to its HEAD blob. On a dirty file that differs
 * from HEAD the bytes cannot be verified: it is `read` with verification `dirty_unverified`, recorded as such
 * in the load record and the receipt, never as verified.
 */
export class RuleReader {
  constructor({ root = REPO_ROOT, revision = null, fs = { readFileSync: realRead, statSync: realStat }, git = null } = {}) {
    this.root = root; this.fs = fs; this.cache = new Map();
    this.stats = { reads: 0, hits: 0 };
    this._git = git;
    this.revision = revision ?? this.#git().revision;
  }

  #git() { return (this._git ??= gitState(this.root)); }

  read(path) {
    const abs = resolve(this.root, path);
    let st = null;
    try { st = this.fs.statSync(abs); } catch (e) { return this.#fail(path, e); }
    const key = `${path}@${this.revision}`;
    const stamp = `${st.size}:${Math.floor(st.mtimeMs ?? 0)}`;
    const hit = this.cache.get(key);
    if (hit && hit.stamp === stamp) { this.stats.hits += 1; return { ...hit.entry, text: hit.text, cached: true }; }
    let buf;
    try { buf = this.fs.readFileSync(abs); } catch (e) { return this.#fail(path, e); }
    this.stats.reads += 1;
    const entry = { path, status: READ.READ, bytes: buf.length, expected_bytes: st.size, sha256: hashOf(buf), revision: this.revision, verification: VERIFY.NO_GIT };
    const text = buf.toString('utf8');
    const git = this.#git();
    const rel = path.split('\\').join('/');
    if (buf.length === 0) { entry.status = READ.TRUNCATED; entry.reason = 'empty file'; }
    else if (buf.length < st.size) { entry.status = READ.TRUNCATED; entry.reason = 'short read'; }
    else if (git.ok) {
      const want = git.tree.get(rel), got = gitBlobId(buf);
      entry.git_blob = got;
      if (want && want.blob === got) entry.verification = VERIFY.GIT_BLOB;
      else if (git.dirty.has(rel)) entry.verification = VERIFY.DIRTY;
      else { entry.status = want && buf.length < want.size ? READ.TRUNCATED : READ.MODIFIED; entry.reason = want ? `differs from HEAD blob ${want.blob.slice(0, 12)}` : 'not tracked at HEAD'; entry.expected_git_blob = want?.blob ?? null; }
    }
    if (entry.status === READ.READ && /\.json$/i.test(path)) {
      try { JSON.parse(text); } catch (e) { entry.status = READ.INVALID; entry.reason = `invalid JSON: ${e.message}`; }
    }
    if (entry.status === READ.READ) this.cache.set(key, { stamp, entry, text });
    return { ...entry, cached: false, text };
  }

  text(path) { const e = this.cache.get(`${path}@${this.revision}`); return e ? e.text : this.read(path).text; }

  #fail(path, e) {
    const status = e?.code === 'ENOENT' ? READ.MISSING : READ.INACCESSIBLE;
    return { path, status, bytes: 0, expected_bytes: null, sha256: null, revision: this.revision, verification: null, error: e?.code ?? String(e) };
  }
}

const dashed = (id) => id.replace('/', '-');

export function loadManifest(reader) {
  const r = reader.read(MANIFEST_PATH);
  if (r.status !== READ.READ) throw Object.assign(new Error(`entry manifest ${r.status}: ${MANIFEST_PATH}`), { code: 'MANIFEST_UNREADABLE' });
  return { manifest: JSON.parse(r.text), sha256: r.sha256 };
}

function taskKindOf(intent, override) {
  if (override) return override;
  const mods = new Set((intent?.axes?.artifacts ?? []).map((a) => String(a.value ?? '').split('/')[0]).filter(Boolean));
  if (mods.has('visual') && mods.has('text')) return 'both';
  if (mods.has('visual')) return 'visual';
  return 'text';
}

/** Which rule files does this request need? Pure selection; reading happens in resolve. */
export function buildLoadPlan(intent, manifest, { targetId = null, taskKind = null } = {}) {
  const kind = taskKindOf(intent, taskKind);
  const kinds = kind === 'both' ? ['text', 'visual'] : [kind];
  const files = new Map(); // path -> { role, required }
  const add = (path, role, required = true) => { if (path && !files.has(path)) files.set(path, { path, role, required }); };
  const notes = [];

  for (const k of kinds) for (const p of manifest.task_kinds[k].core) add(p, `core:${k}`);

  const axes = intent?.axes ?? {};
  const pick = (axis, value) => {
    if (!value) return;
    add(manifest.axis_profile_paths[axis].replace('{id}', value).replace('{id_dashed}', dashed(value)), `axis:${axis}`);
  };
  pick('transformation', axes.transformation?.value);
  pick('content_type', axes.content_type?.value);
  pick('audience', axes.audience?.value);
  pick('surface', axes.surface?.value);
  for (const a of axes.artifacts ?? []) if (String(a.value ?? '').startsWith('visual/') || String(a.value ?? '').startsWith('audio/')) pick('artifact', a.value);
  const lang = intent?.constraints?.output_language ?? intent?.request?.language;
  if (lang && manifest.language_packs[lang]) add(manifest.language_packs[lang], 'language');

  const target = targetId ? manifest.sns_targets[targetId] : null;
  if (target) {
    // On-image copy is still copy: the target's own voice doc is loaded for visual tasks too (and only that voice).
    for (const p of target.copy_files) add(p, `copy:${target.voice_family}`);
    if (kinds.includes('visual') && target.visual) {
      for (const p of target.visual.files) add(p, 'visual:rules');
      for (const p of target.visual.values) add(p, 'visual:values');
    }
    if (kinds.includes('visual') && !target.visual) notes.push(`target ${targetId} has no registered visual profile: ${target.visual_note}`);
  }

  const skipped = [];
  for (const [family, docs] of Object.entries(manifest.voice_docs)) {
    if (target && family !== target.voice_family) skipped.push({ family, reason: 'other voice family — never loaded for this target', files: docs });
  }
  return {
    task_kind: kind, target: targetId,
    files: [...files.values()],
    skipped, notes,
    examples: { policy: manifest.example_policy.default, loaded: [], reason: null },
  };
}

/** Voice-leak detection: a plan/loads may only contain the target's own voice docs. */
export function detectVoiceLeak(paths, voiceFamily, manifest) {
  const leaks = [];
  for (const [family, docs] of Object.entries(manifest.voice_docs)) {
    if (family === voiceFamily) continue;
    for (const p of paths) if (docs.includes(p)) leaks.push({ path: p, belongs_to: family, target_voice: voiceFamily });
  }
  return leaks;
}

/**
 * Field-wise precedence. layers = { explicit_request, task_row, sheet_override,
 * account_series, surface_brand_default } -> { field: value }.
 * Locked/unknown/not-allowed-at-this-layer fields are IGNORED and recorded.
 */
export function resolveFields(layers, manifest) {
  const values = {}; const origins = {}; const conflicts = [];
  const order = manifest.precedence;
  for (const layer of Object.keys(layers ?? {})) {
    if (!order.includes(layer)) conflicts.push({ code: 'UNKNOWN_LAYER', layer, message: `layer "${layer}" is not in the precedence list` });
  }
  for (const layer of order) {
    const set = layers?.[layer];
    if (!isObj(set)) continue;
    for (const [field, value] of Object.entries(set)) {
      if (manifest.locked_fields.includes(field)) {
        conflicts.push({ code: 'LOCKED_FIELD', field, layer, message: `"${field}" is a mandatory lock; no overlay may change it`, ignored_value: value });
        continue;
      }
      const allowed = manifest.overridable_fields[field];
      if (!allowed) { conflicts.push({ code: 'UNKNOWN_FIELD', field, layer, message: `"${field}" is not an overridable field`, ignored_value: value }); continue; }
      if (!allowed.includes(layer)) { conflicts.push({ code: 'LAYER_NOT_ALLOWED', field, layer, message: `"${field}" may not be set from layer ${layer}`, ignored_value: value }); continue; }
      if (field in values && stable(values[field]) !== stable(value) && JSON.stringify(stable(values[field])) !== JSON.stringify(stable(value))) {
        // Higher-precedence layer already supplied it (order is high -> low): record the shadowed value.
        conflicts.push({ code: 'SHADOWED', field, layer, message: `value from ${layer} shadowed by ${origins[field].layer}`, ignored_value: value });
        continue;
      }
      if (!(field in values)) { values[field] = value; origins[field] = { layer, source: layers.__sources?.[layer] ?? layer }; }
    }
  }
  return { values, origins, conflicts };
}

/** Whole resolution: plan -> reads -> fields -> one resolved profile + receipt. */
export function resolveEditorial(intent, { targetId = null, flowId = null, overrides = {}, taskKind = null, reader = new RuleReader(), planCache = null } = {}) {
  const { manifest, sha256: manifestHash } = loadManifest(reader);
  const surfaceId = intent?.axes?.surface?.value ?? null;
  const receipt = {
    receipt_version: RECEIPT_VERSION, intent_id: intent?.intent_id ?? null, status: STATUS.READY,
    revision: reader.revision, manifest: { path: MANIFEST_PATH, version: manifest.manifest_version, sha256: manifestHash },
    target: null, load_plan: null, loads: [], unread_required: [], conflicts: [], field_origins: {}, freshness: null, profile: null,
  };

  // R5: existing non-SNS flows (blog/news/report) use the same entry with NO voice family; SNS voices must never appear.
  const flow = flowId ? manifest.existing_flows?.[flowId] ?? null : null;
  if (flowId) {
    const bad = (code, message) => { receipt.status = STATUS.BLOCKED_UNKNOWN_TARGET; receipt.conflicts.push({ code, message }); return receipt; };
    if (targetId) return bad('FLOW_AND_TARGET', 'a flow (non-SNS) and an SNS target are mutually exclusive');
    if (!flow) return bad('UNKNOWN_FLOW', `"${flowId}" is not a registered existing flow (known: ${Object.keys(manifest.existing_flows ?? {}).join(', ')})`);
    if (surfaceId && flow.surface !== surfaceId) return bad('FLOW_SURFACE_MISMATCH', `flow ${flowId} is on surface ${flow.surface}, intent surface is ${surfaceId}`);
    receipt.flow = { id: flowId, surface: flow.surface, status: flow.status };
  }
  // Target routing: never guess an account. Surfaces with several registered targets need an explicit one.
  const targetsOnSurface = Object.entries(manifest.sns_targets).filter(([, t]) => t.surface === surfaceId).map(([id]) => id);
  if (targetId && !manifest.sns_targets[targetId]) { receipt.status = STATUS.BLOCKED_UNKNOWN_TARGET; receipt.conflicts.push({ code: 'UNKNOWN_TARGET', message: `"${targetId}" is not a registered SNS target`, known: Object.keys(manifest.sns_targets) }); return receipt; }
  if (targetId && surfaceId && manifest.sns_targets[targetId].surface !== surfaceId) {
    receipt.status = STATUS.BLOCKED_UNKNOWN_TARGET;
    receipt.conflicts.push({ code: 'TARGET_SURFACE_MISMATCH', message: `target ${targetId} is on surface ${manifest.sns_targets[targetId].surface}, intent surface is ${surfaceId}` });
    return receipt;
  }
  if (!targetId && targetsOnSurface.length > 0) {
    receipt.status = STATUS.BLOCKED_TARGET_REQUIRED;
    receipt.conflicts.push({ code: 'TARGET_REQUIRED', message: `surface ${surfaceId} has ${targetsOnSurface.length} registered target(s); the account is never inferred — pass an explicit target`, candidates: targetsOnSurface });
    return receipt;
  }
  const target = targetId ? manifest.sns_targets[targetId] : null;
  receipt.target = target ? { id: targetId, surface: target.surface, account: target.account, voice_family: target.voice_family, status: target.status } : null;

  const cacheKey = hashOf({ revision: reader.revision, manifestHash, targetId, flowId, kind: taskKind, intent_axes: intent?.axes ?? null, lang: intent?.constraints?.output_language ?? null });
  let plan = planCache?.get(cacheKey);
  const planReused = Boolean(plan);
  if (!plan) { plan = buildLoadPlan(intent, manifest, { targetId, taskKind }); planCache?.set(cacheKey, plan); }
  receipt.load_plan = { ...plan, reused: planReused, cache_key: cacheKey };

  // Voice isolation: the plan itself must not carry another family's docs.
  if (target || flow) {
    const leaks = detectVoiceLeak(plan.files.map((f) => f.path), target?.voice_family ?? null, manifest);
    if (leaks.length) { receipt.status = STATUS.BLOCKED_LEAK; receipt.conflicts.push(...leaks.map((l) => ({ code: 'VOICE_LEAK', ...l }))); return receipt; }
  }

  for (const f of plan.files) {
    const r = reader.read(f.path);
    receipt.loads.push({ path: f.path, role: f.role, status: r.status, verification: r.verification ?? null, sha256: r.sha256, bytes: r.bytes, expected_bytes: r.expected_bytes, cached: Boolean(r.cached), ...(r.error ? { error: r.error } : {}), ...(r.reason ? { reason: r.reason } : {}) });
    if (f.required && r.status !== READ.READ) receipt.unread_required.push({ path: f.path, status: r.status });
  }
  if (receipt.unread_required.length) receipt.status = STATUS.BLOCKED_MISSING_RULE;
  const readLoads = receipt.loads.filter((l) => l.status === READ.READ);
  receipt.integrity = {
    rule_files: readLoads.some((l) => l.verification === VERIFY.DIRTY) ? 'dirty_unverified' : readLoads.length && readLoads.every((l) => l.verification === VERIFY.GIT_BLOB) ? 'git_verified' : 'unverified',
    dirty_unverified: readLoads.filter((l) => l.verification === VERIFY.DIRTY).map((l) => l.path),
    note: 'git_verified = every rule file byte-identical to its HEAD blob; dirty_unverified = file differs from HEAD in a dirty tree and is recorded, not verified; unverified = not a git checkout of this repository',
  };

  // Field resolution (surface profile defaults are values the target/surface already declare).
  const layers = { surface_brand_default: {}, account_series: {}, ...(overrides ?? {}) };
  if (target) {
    layers.account_series = { ...target.copy_defaults, ...(target.visual?.defaults ? { canvas: target.visual.defaults.canvas, text_policy: target.visual.defaults.text_policy } : {}), ...(overrides?.account_series ?? {}) };
    // The instagram surface profile defaults to suengj-style; only a personal target keeps it.
    if (target.voice_family !== 'personal' && !('style_overlay' in (overrides?.account_series ?? {}))) layers.account_series.style_overlay = target.copy_defaults.style_overlay;
  }
  const fields = resolveFields(layers, manifest);
  receipt.conflicts.push(...fields.conflicts);
  receipt.field_origins = fields.origins;

  // Surface style_overlay_default must not leak a personal overlay into a non-personal voice.
  if (target && target.voice_family !== 'personal' && fields.values.style_overlay === 'suengj-style') {
    receipt.status = STATUS.BLOCKED_LEAK;
    receipt.conflicts.push({ code: 'VOICE_LEAK', message: `style_overlay suengj-style resolved for ${target.voice_family} target ${targetId}` });
  }

  if (flow && fields.values.style_overlay === 'suengj-style') {
    receipt.status = STATUS.BLOCKED_LEAK;
    receipt.conflicts.push({ code: 'VOICE_LEAK', message: `style_overlay suengj-style resolved for non-SNS flow ${flowId}` });
  }

  // Dynamic facts are never served from cache: freshness stays a per-run re-read.
  receipt.freshness = { rule_files: 'pinned_by_revision', dynamic_sources: 'reread_each_run', max_source_age_days: intent?.constraints?.max_source_age_days ?? null, cache_applies_to: 'rule files only' };

  const profileBody = {
    id: targetId ? `target:${targetId}` : flowId ? `flow:${flowId}` : `surface:${surfaceId ?? 'none'}`,
    voice_family: target?.voice_family ?? null,
    task_kind: plan.task_kind,
    fields: fields.values,
    visual: target?.visual ? { artifacts: target.visual.artifacts } : null,
    rule_files: receipt.loads.filter((l) => l.status === READ.READ).map((l) => ({ path: l.path, sha256: l.sha256 })),
    manifest_sha256: manifestHash,
  };
  receipt.profile = { id: profileBody.id, version: `${manifest.manifest_version}+${reader.revision}`, resolved_hash: hashOf(profileBody), body: profileBody };
  return receipt;
}

/** Minimal approved-example loader: description by default; 2-3 approved examples only with a stated reason. */
export function selectExamples(receipt, manifest, { reason, candidates = [] }) {
  const p = manifest.example_policy;
  if (!p.load_only_for.includes(reason)) return { loaded: [], status: 'NOT_LOADED', note: `reason must be one of ${p.load_only_for.join(', ')}` };
  const approved = candidates.filter((c) => c.approval_status === 'approved' && c.voice_family === receipt.target?.voice_family);
  if (approved.length === 0) return { loaded: [], status: p.absent, note: 'no approved example for this voice family; nothing is fabricated' };
  const loaded = approved.slice(0, p.max);
  return { loaded, status: loaded.length < p.min ? 'FEWER_THAN_MIN_APPROVED' : 'LOADED', reason };
}

// --- stage consistency: generate -> polish -> review consume the same profile ---

export const stageStamp = (receipt, stage) => ({ stage, profile_id: receipt.profile.id, profile_version: receipt.profile.version, resolved_hash: receipt.profile.resolved_hash });

export function verifyStages(receipt, stamps) {
  const issues = [];
  if (!receipt?.profile) return [{ code: 'NO_PROFILE', message: 'receipt carries no resolved profile (status ' + receipt?.status + ')' }];
  if (hashOf(receipt.profile.body) !== receipt.profile.resolved_hash) issues.push({ code: 'RECEIPT_HASH_MISMATCH', message: 'profile body does not hash to its resolved_hash (tampered or stale)' });
  for (const stage of ['generate', 'polish', 'review']) {
    const s = stamps?.[stage];
    if (!s) { issues.push({ code: 'STAGE_MISSING', stage, message: `no ${stage} stamp` }); continue; }
    if (s.resolved_hash !== receipt.profile.resolved_hash) issues.push({ code: 'STAGE_HASH_MISMATCH', stage, message: `${stage} used ${s.resolved_hash}, resolved profile is ${receipt.profile.resolved_hash}` });
    if (s.profile_version !== receipt.profile.version) issues.push({ code: 'STAGE_VERSION_MISMATCH', stage, message: `${stage} used version ${s.profile_version}` });
    if (s.profile_id !== receipt.profile.id) issues.push({ code: 'STAGE_PROFILE_MISMATCH', stage, message: `${stage} used ${s.profile_id}` });
  }
  return issues;
}

// --- render gate: the real image entry points call this -------------------

export const SNS_SURFACES = ['instagram', 'linkedin'];

/**
 * render-visual / render-carousel call this before doing anything. A plan on a
 * registered SNS surface needs a READY receipt whose target is on that surface,
 * has a visual mapping and allows the plan's artifact. Other surfaces pass through.
 */
export function gateRender(plan, receipt, manifest) {
  const surface = plan?.profiles?.surface;
  if (!SNS_SURFACES.includes(surface)) {
    // Legacy non-SNS render stays ungated unless a flow receipt is supplied; then it must be consistent.
    if (!receipt?.flow) return { ok: true, applies: false };
    const f = (code, message) => ({ ok: false, applies: true, code, message });
    if (receipt.status !== STATUS.READY || !receipt.profile) return f('PROFILE_RECEIPT_NOT_READY', `receipt status ${receipt.status}`);
    if (hashOf(receipt.profile.body) !== receipt.profile.resolved_hash) return f('PROFILE_RECEIPT_HASH_MISMATCH', 'receipt body does not match its resolved_hash');
    if (receipt.flow.surface !== surface) return f('PROFILE_TARGET_MISMATCH', `flow receipt ${receipt.flow.id} is on surface ${receipt.flow.surface}, plan surface is ${surface}`);
    return { ok: true, applies: true, resolved_hash: receipt.profile.resolved_hash, profile_id: receipt.profile.id };
  }
  const fail = (code, message) => ({ ok: false, applies: true, code, message });
  if (!receipt) return fail('PROFILE_RECEIPT_REQUIRED', `surface ${surface} is a registered SNS surface: run scripts/resolve-editorial.mjs --target <id> and pass --profile-receipt`);
  if (receipt.status !== STATUS.READY || !receipt.profile) return fail('PROFILE_RECEIPT_NOT_READY', `receipt status ${receipt.status}`);
  if (hashOf(receipt.profile.body) !== receipt.profile.resolved_hash) return fail('PROFILE_RECEIPT_HASH_MISMATCH', 'receipt body does not match its resolved_hash');
  const t = manifest.sns_targets[receipt.target?.id];
  if (!t || t.surface !== surface) return fail('PROFILE_TARGET_MISMATCH', `receipt target ${receipt.target?.id} is not on surface ${surface}`);
  if (!t.visual) return fail('NO_VISUAL_PROFILE', `target ${receipt.target.id} has no registered visual profile`);
  if (!t.visual.artifacts.includes(plan.profiles.artifact)) return fail('ARTIFACT_NOT_MAPPED', `${plan.profiles.artifact} is not mapped for ${receipt.target.id}`);
  return { ok: true, applies: true, resolved_hash: receipt.profile.resolved_hash, profile_id: receipt.profile.id };
}

/** Signalytics-style delivery contract check (file names only; no Drive writes are ever represented). */
export function checkDeliveryPackage(targetId, fileNames, manifest) {
  const c = manifest.sns_targets[targetId]?.output_contract;
  if (!c) return { ok: true, applicable: false, issues: [] };
  const issues = [];
  const pngs = fileNames.filter((f) => /\.png$/i.test(f)).length;
  if (pngs < c.png.min || pngs > c.png.max) issues.push(`PNG count ${pngs}, expected ${c.png.min}-${c.png.max}${c.png.sixth_conditional ? ' (sixth only when conditioned)' : ''}`);
  for (const f of c.required_files) if (!fileNames.includes(f)) issues.push(`missing ${f}`);
  if (fileNames.some((f) => /^drive:/i.test(f))) issues.push('Drive result writes are forbidden');
  return { ok: issues.length === 0, applicable: true, issues };
}
