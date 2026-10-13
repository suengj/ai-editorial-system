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
import { loadAxisProfiles } from './profile-core.mjs';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const MANIFEST_PATH = 'editorial/entry-manifest.json';
export const RECEIPT_VERSION = '1.0.0';

export const STATUS = Object.freeze({
  READY: 'READY',
  BLOCKED_MISSING_RULE: 'BLOCKED_MISSING_RULE',
  BLOCKED_TARGET_REQUIRED: 'BLOCKED_TARGET_REQUIRED',
  BLOCKED_UNKNOWN_TARGET: 'BLOCKED_UNKNOWN_TARGET',
  BLOCKED_LEAK: 'BLOCKED_LEAK',
  BLOCKED_FIELD_INVALID: 'BLOCKED_FIELD_INVALID',
  BLOCKED_INVALID_ID: 'BLOCKED_INVALID_ID',
});
const MD_MIN_BYTES = 120;
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
      else if (git.dirty.has(rel)) {
        entry.verification = VERIFY.DIRTY;
        // A dirty file that is a strict prefix of its HEAD blob is a cut-off copy, not an edit.
        if (want && buf.length < want.size) {
          const head = spawnSync('git', ['-C', this.root, 'cat-file', 'blob', want.blob], { maxBuffer: 64 * 1024 * 1024 });
          if (head.status === 0 && head.stdout.length > buf.length && head.stdout.subarray(0, buf.length).equals(buf)) { entry.status = READ.TRUNCATED; entry.reason = `strict prefix of HEAD blob ${want.blob.slice(0, 12)} (cut off)`; }
        }
      }
      else { entry.status = want && buf.length < want.size ? READ.TRUNCATED : READ.MODIFIED; entry.reason = want ? `differs from HEAD blob ${want.blob.slice(0, 12)}` : 'not tracked at HEAD'; entry.expected_git_blob = want?.blob ?? null; }
    }
    if (entry.status === READ.READ && /\.md$/i.test(path) && /^\s*<(html|!doctype)/i.test(text)) { entry.status = READ.INVALID; entry.reason = 'markdown rule file starts with HTML (an error page or wrong download)'; }
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

/** Ids that become file paths or manifest keys: lowercase kebab, optional one-level "modality/name". No dots, slashes beyond that, or case variants. */
export const ID_RE = /^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)?$/;
const TASK_KINDS = ['text', 'visual', 'both'];
/** Every id the request would turn into a path or key; returns the first offender or null. */
export function firstInvalidId(intent, { targetId, flowId, taskKind }) {
  const a = intent?.axes ?? {};
  const ids = [['target', targetId], ['flow', flowId], ['surface', a.surface?.value], ['transformation', a.transformation?.value], ['content_type', a.content_type?.value], ['audience', a.audience?.value], ...((Array.isArray(a.artifacts) ? a.artifacts : []).map((x) => ['artifact', x?.value]))];
  for (const [what, v] of ids) if (v !== undefined && v !== null && (typeof v !== 'string' || !ID_RE.test(v))) return { what, value: v };
  if (taskKind !== undefined && taskKind !== null && !TASK_KINDS.includes(taskKind)) return { what: 'task_kind', value: taskKind };
  return null;
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
  if (typeof lang === 'string' && Object.hasOwn(manifest.language_packs, lang)) add(manifest.language_packs[lang], 'language');

  const target = targetId && Object.hasOwn(manifest.sns_targets, targetId) ? manifest.sns_targets[targetId] : null;
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

/** Normal form used for every domain comparison: NFC, trim, case-fold, whitespace/underscore runs -> hyphen. */
export const normText = (x) => String(x).normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-').trim().toLowerCase().replace(/[\s_]+/g, '-');
/** normText with every separator removed: "suengj.style", "suengj style" and "suengj-style" all become "suengjstyle". */
export const compactText = (x) => normText(x).replace(/[^\p{L}\p{N}]/gu, '');

/** First key at any depth that names a locked field (case/whitespace-insensitive), as a dotted path, else null. */
function lockedKeyPath(value, locked, path = '') {
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i++) { const r = lockedKeyPath(value[i], locked, `${path}[${i}]`); if (r) return r; } return null; }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (locked.includes(normText(k)) || locked.map(compactText).includes(compactText(k))) return `${path}.${k}`.replace(/^\./, '');
      const r = lockedKeyPath(v, locked, `${path}.${k}`); if (r) return r;
    }
  }
  return null;
}
const allStrings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); allStrings(x, out); } return out; };

/**
 * Validate one field value against manifest.field_domains. ctx = { voiceFamily|null, isFlow }.
 * Returns { ok, value } (value normalised for enums) or { ok:false, code, message, block }.
 * block = 'leak' for a reference to another voice family, 'invalid' for the rest.
 */
export function validateFieldValue(field, value, manifest, ctx = {}) {
  const dom = manifest.field_domains?.[field];
  if (!dom || field.startsWith('_')) return { ok: true, value };
  const bad = (code, message, block = 'invalid') => ({ ok: false, code, message, block });
  const family = ctx.voiceFamily ?? '_flow';
  const locked = manifest.locked_fields.map(normText);
  if (dom.type === 'enum' || dom.type === 'enum_by_voice_family') {
    if (typeof value !== 'string') return bad('FIELD_TYPE', `${field} must be a string enum value, got ${Array.isArray(value) ? 'array' : typeof value}`);
    const n = normText(value);
    const allowed = dom.type === 'enum' ? dom.allowed : (Object.hasOwn(dom.allowed, family) ? dom.allowed[family] : []);
    if (!allowed.includes(n)) {
      const otherFamilyHasIt = dom.type === 'enum_by_voice_family' && Object.entries(dom.allowed).some(([f, a]) => f !== family && f !== '_flow' && a.includes(n) && !allowed.includes(n));
      return bad('FIELD_DOMAIN', `${field}=${JSON.stringify(value)} is not allowed for ${family === '_flow' ? 'a non-SNS flow' : `voice family ${family}`} (allowed: ${allowed.join(', ') || 'none'})`, otherFamilyHasIt ? 'leak' : 'invalid');
    }
    return { ok: true, value: n };
  }
  if (dom.type === 'text') {
    if (typeof value !== 'string') return bad('FIELD_TYPE', `${field} must be a string, got ${Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}`);
    if (value.length > dom.max_length) return bad('FIELD_TOO_LONG', `${field} is ${value.length} chars; the cap is ${dom.max_length}`);
  } else if (dom.type === 'structure') {
    const t = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    if (!dom.value_types.includes(t)) return bad('FIELD_TYPE', `${field} must be ${dom.value_types.join(' or ')}, got ${t}`);
    if (JSON.stringify(value).length > dom.max_json_length) return bad('FIELD_TOO_LONG', `${field} exceeds ${dom.max_json_length} JSON chars`);
    const lk = lockedKeyPath(value, locked);
    if (lk) return bad('LOCKED_KEY_NESTED', `${field} carries a locked field name at "${lk}"; locked fields can never be set through an overlay`);
  }
  // Voice isolation for free text: no other family's profile id / rule file name (separator-, width- and dash-insensitive).
  const mine = new Set((manifest.voice_profile_ids?.[ctx.voiceFamily] ?? []).map(compactText));
  const compacts = allStrings(value).map(compactText);
  for (const [fam, ids] of Object.entries(manifest.voice_profile_ids ?? {})) {
    if (fam.startsWith('_') || fam === ctx.voiceFamily) continue;
    for (const id of ids) {
      const nid = compactText(id);
      if (mine.has(nid) || [...mine].some((m) => m.includes(nid) || nid.includes(m))) continue;
      if (compacts.some((t) => t.includes(nid))) return bad('VOICE_REFERENCE', `${field} references the ${fam} voice ("${id}"); a ${ctx.voiceFamily ?? 'non-SNS'} request may not name another voice profile`, 'leak');
    }
  }
  // A locked-field word used as a key/value assignment inside a string ("approval: granted") is an attempt to set it.
  const lockedWord = new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${manifest.locked_fields.map((w) => normText(w).replace(/[-]/g, '[-_ ]?')).join('|')})\\s*[:=]`, 'u');
  for (const t of allStrings(value)) if (lockedWord.test(normText(t).replace(/-/g, ' ').replace(/ /g, ' ')) || lockedWord.test(normText(t))) return bad('LOCKED_ASSIGNMENT', `${field} contains a locked-field assignment ("${t.slice(0, 40)}"); facts/figures/sources/rights/approval can never be set through a preference or overlay`);
  // Family-specific id spaces (e.g. community hook ids H01..) may not appear outside their family.
  for (const [fam, pat] of Object.entries(dom.family_id_patterns ?? {})) {
    if (fam === ctx.voiceFamily) continue;
    const re = new RegExp(pat, 'i');
    if (allStrings(value).some((t) => re.test(normText(t)))) return bad('FAMILY_ID_REFERENCE', `${field} uses an id of the ${fam} family ("${String(value).slice(0, 30)}"); not allowed for ${ctx.voiceFamily ?? 'a non-SNS flow'}`, 'leak');
  }
  return { ok: true, value };
}

/**
 * Field-wise precedence. layers = { explicit_request, task_row, sheet_override,
 * account_series, surface_brand_default } -> { field: value }. (surface_brand_default is intentionally empty today.)
 * Locked/unknown/not-allowed-at-this-layer fields are IGNORED and recorded.
 */
export function resolveFields(layers, manifest, ctx = {}) {
  const values = {}; const origins = {}; const conflicts = [];
  const order = manifest.precedence;
  const has = (o, k) => Object.hasOwn(o, k);
  if (layers !== undefined && layers !== null && !isObj(layers)) conflicts.push({ code: 'INVALID_LAYER', layer: null, message: 'layers must be an object keyed by precedence layer name' });
  const given = isObj(layers) ? layers : {};
  for (const layer of Object.keys(given)) {
    // `__sources` used to let a caller choose the origin text recorded for a field; origins are now always the layer name.
    if (layer === '__sources') { conflicts.push({ code: 'IGNORED_RESERVED_KEY', layer, message: '"__sources" is not accepted; origins are the layer name' }); continue; }
    if (!order.includes(layer)) conflicts.push({ code: 'UNKNOWN_LAYER', layer, message: `layer "${layer}" is not in the precedence list` });
  }
  for (const layer of order) {
    if (!has(given, layer)) continue;
    const set = given[layer];
    if (!isObj(set)) { if (set !== undefined && set !== null) conflicts.push({ code: 'INVALID_LAYER', layer, message: `layer "${layer}" must be an object of field values, got ${Array.isArray(set) ? 'array' : typeof set}`, ignored_value: set }); continue; }
    for (let [field, value] of Object.entries(set)) {
      if (manifest.locked_fields.includes(field)) {
        conflicts.push({ code: 'LOCKED_FIELD', field, layer, message: `"${field}" is a mandatory lock; no overlay may change it`, ignored_value: value });
        continue;
      }
      const allowed = has(manifest.overridable_fields, field) ? manifest.overridable_fields[field] : null;
      if (!allowed) { conflicts.push({ code: 'UNKNOWN_FIELD', field, layer, message: `"${field}" is not an overridable field`, ignored_value: value }); continue; }
      if (!allowed.includes(layer)) { conflicts.push({ code: 'LAYER_NOT_ALLOWED', field, layer, message: `"${field}" may not be set from layer ${layer}`, ignored_value: value }); continue; }
      const checked = validateFieldValue(field, value, manifest, ctx);
      if (!checked.ok) { conflicts.push({ code: checked.code, field, layer, block: checked.block, message: checked.message, ignored_value: value }); continue; }
      value = checked.value;
      if (has(values, field) && stable(values[field]) !== stable(value) && JSON.stringify(stable(values[field])) !== JSON.stringify(stable(value))) {
        // Higher-precedence layer already supplied it (order is high -> low): record the shadowed value.
        conflicts.push({ code: 'SHADOWED', field, layer, message: `value from ${layer} shadowed by ${origins[field].layer}`, ignored_value: value });
        continue;
      }
      if (!has(values, field)) { values[field] = value; origins[field] = { layer, source: layer }; }
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
  const badId = firstInvalidId(intent, { targetId, flowId, taskKind });
  if (badId) { receipt.status = STATUS.BLOCKED_INVALID_ID; receipt.conflicts.push({ code: 'INVALID_ID', message: `${badId.what} ${JSON.stringify(badId.value)} is not a valid id (lowercase kebab-case, optional modality/name); ids become file paths and are never normalised`, field: badId.what }); return receipt; }
  const flow = flowId && Object.hasOwn(manifest.existing_flows ?? {}, flowId) ? manifest.existing_flows[flowId] : null;
  if (flowId) {
    const bad = (code, message) => { receipt.status = STATUS.BLOCKED_UNKNOWN_TARGET; receipt.conflicts.push({ code, message }); return receipt; };
    if (targetId) return bad('FLOW_AND_TARGET', 'a flow (non-SNS) and an SNS target are mutually exclusive');
    if (!flow) return bad('UNKNOWN_FLOW', `"${flowId}" is not a registered existing flow (known: ${Object.keys(manifest.existing_flows ?? {}).join(', ')})`);
    if (surfaceId && flow.surface !== surfaceId) return bad('FLOW_SURFACE_MISMATCH', `flow ${flowId} is on surface ${flow.surface}, intent surface is ${surfaceId}`);
    receipt.flow = { id: flowId, surface: flow.surface, status: flow.status };
  }
  // Target routing: never guess an account. Surfaces with several registered targets need an explicit one.
  const targetsOnSurface = Object.entries(manifest.sns_targets).filter(([, t]) => t.surface === surfaceId).map(([id]) => id);
  if (targetId && !Object.hasOwn(manifest.sns_targets, targetId)) { receipt.status = STATUS.BLOCKED_UNKNOWN_TARGET; receipt.conflicts.push({ code: 'UNKNOWN_TARGET', message: `"${targetId}" is not a registered SNS target`, known: Object.keys(manifest.sns_targets) }); return receipt; }
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
    // Sanity floor for a required .md rule file: a stub (<120 bytes or no heading) cannot be a rule document.
    else if (f.required && /\.md$/i.test(f.path) && (r.bytes < MD_MIN_BYTES || !/^#{1,6}\s+\S/m.test(r.text ?? ''))) {
      receipt.loads[receipt.loads.length - 1].status = READ.INVALID; receipt.loads[receipt.loads.length - 1].reason = `required .md rule file below sanity floor (>=${MD_MIN_BYTES} bytes and a heading)`;
      receipt.unread_required.push({ path: f.path, status: READ.INVALID });
    }
  }
  if (receipt.unread_required.length) receipt.status = STATUS.BLOCKED_MISSING_RULE;
  const readLoads = receipt.loads.filter((l) => l.status === READ.READ);
  receipt.integrity = {
    rule_files: readLoads.some((l) => l.verification === VERIFY.DIRTY) ? 'dirty_unverified' : readLoads.length && readLoads.every((l) => l.verification === VERIFY.GIT_BLOB) ? 'git_verified' : 'unverified',
    dirty_unverified: readLoads.filter((l) => l.verification === VERIFY.DIRTY).map((l) => l.path),
    // REQUIRED rule files that could not be verified against git (dirty, or not a git checkout): the receipt says so in its hashed body.
    integrity: (() => { const req = new Set(plan.files.filter((f) => f.required).map((f) => f.path)); const bad = readLoads.filter((l) => req.has(l.path) && l.verification !== VERIFY.GIT_BLOB).map((l) => l.path); return bad.length ? 'UNVERIFIED' : 'VERIFIED'; })(),
    unverified_required: (() => { const req = new Set(plan.files.filter((f) => f.required).map((f) => f.path)); return readLoads.filter((l) => req.has(l.path) && l.verification !== VERIFY.GIT_BLOB).map((l) => l.path); })(),
    note: 'git_verified = every rule file byte-identical to its HEAD blob; dirty_unverified = file differs from HEAD in a dirty tree and is recorded, not verified; unverified = not a git checkout of this repository',
  };

  // Field resolution. surface_brand_default is intentionally empty: surface-profile defaults (e.g. instagram's
  // style_overlay_default suengj-style) are personal-voice values and must not become the lowest-precedence fallback for
  // another voice. Each target's own defaults are the account_series layer.
  const layers = { surface_brand_default: {}, account_series: {}, ...(isObj(overrides) ? overrides : {}) };
  if (overrides !== undefined && overrides !== null && !isObj(overrides)) receipt.conflicts.push({ code: 'INVALID_LAYER', layer: null, message: 'overrides must be an object keyed by layer name' });
  if (target) {
    if (overrides?.account_series !== undefined && overrides.account_series !== null && !isObj(overrides.account_series)) receipt.conflicts.push({ code: 'INVALID_LAYER', layer: 'account_series', message: `layer "account_series" must be an object of field values, got ${Array.isArray(overrides.account_series) ? 'array' : typeof overrides.account_series}`, ignored_value: overrides.account_series });
    layers.account_series = { ...target.copy_defaults, ...(target.visual?.defaults ? { canvas: target.visual.defaults.canvas, text_policy: target.visual.defaults.text_policy } : {}), ...(isObj(overrides?.account_series) ? overrides.account_series : {}) };
    // The instagram surface profile defaults to suengj-style; only a personal target keeps it.
    if (target.voice_family !== 'personal' && !(isObj(overrides?.account_series) && Object.hasOwn(overrides.account_series, 'style_overlay'))) layers.account_series.style_overlay = target.copy_defaults.style_overlay;
  }
  const fields = resolveFields(layers, manifest, { voiceFamily: target?.voice_family ?? null, isFlow: Boolean(flow) });
  receipt.conflicts.push(...fields.conflicts);
  receipt.field_origins = fields.origins;
  // A value outside its domain is never silently dropped: the run is blocked and the conflict names the field.
  const bad = fields.conflicts.filter((c) => c.block);
  if (bad.length && receipt.status === STATUS.READY) receipt.status = bad.some((c) => c.block === 'leak') ? STATUS.BLOCKED_LEAK : STATUS.BLOCKED_FIELD_INVALID;

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
    status: receipt.status,
    intent_id: receipt.intent_id,
    revision: reader.revision,
    target_id: targetId ?? null,
    flow_id: flowId ?? null,
    id: targetId ? `target:${targetId}` : flowId ? `flow:${flowId}` : `surface:${surfaceId ?? 'none'}`,
    voice_family: target?.voice_family ?? null,
    task_kind: plan.task_kind,
    fields: fields.values,
    visual: target?.visual ? { artifacts: target.visual.artifacts } : null,
    rule_files: receipt.loads.filter((l) => l.status === READ.READ).map((l) => ({ path: l.path, sha256: l.sha256 })),
    manifest_sha256: manifestHash,
  };
  // A blocked receipt carries NO profile: nothing downstream can mistake it for a resolved one.
  if (receipt.status !== STATUS.READY) return receipt;
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
  if (receipt?.status !== STATUS.READY) return [{ code: 'NOT_READY', message: `receipt status is ${receipt?.status}; only a READY receipt can be stage-checked` }];
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
/**
 * Render gate. A receipt is INTEGRITY-CHECKED (its hashed body is internally consistent and matches the current
 * rule files / manifest / revision); it is NOT cryptographically authenticated: anyone who can write a file can
 * recompute a hash. The gate stops accidental and agent-error renders, not a determined forger.
 *
 * ctx = { reader?, pinnedRevision? }. The receipt's revision must equal the current revision, or the caller must
 * pass pinnedRevision equal to the receipt's revision; the choice is recorded in the returned object.
 */
export function gateRender(plan, receipt, manifest, ctx = {}) {
  const surface = plan?.profiles?.surface;
  const fail = (code, message) => ({ ok: false, applies: true, code, message });
  if (typeof surface === 'string' && !SNS_SURFACES.includes(surface) && SNS_SURFACES.includes(normText(surface))) return fail('INVALID_ID', `surface "${surface}" is a case/space variant of a registered SNS surface; ids are never normalised`);
  const isSns = SNS_SURFACES.includes(surface);
  if (!isSns && !receipt?.flow) {
    // A non-SNS surface label must not be a way around the gate: an SNS receipt, or an artifact only SNS targets map, still needs the full check.
    const flowArtifacts = new Set(Object.values(manifest.existing_flows ?? {}).filter((f) => f.surface === surface).flatMap((f) => f.artifacts));
    const snsOnly = new Set(Object.values(manifest.sns_targets).flatMap((t) => t.visual?.artifacts ?? []).filter((a) => !flowArtifacts.has(a)));
    // Legacy behaviour kept: a non-SNS surface profile that itself declares the artifact (artifact_fit) was never SNS-gated.
    let ownFit = [];
    try { ownFit = loadAxisProfiles('surface')[surface]?.artifact_fit ?? []; } catch { ownFit = []; }
    if (ownFit.includes(plan?.profiles?.artifact)) { snsOnly.delete(plan.profiles.artifact); }
    if (receipt?.target) return fail('PROFILE_TARGET_MISMATCH', `receipt names SNS target ${receipt.target.id} but the plan surface is ${surface}`);
    if (snsOnly.has(plan?.profiles?.artifact)) return fail('PROFILE_RECEIPT_REQUIRED', `artifact ${plan.profiles.artifact} is mapped only for SNS targets but the plan surface is ${surface}; set profiles.surface to the real SNS surface and pass --profile-receipt`);
    return { ok: true, applies: false };
  }
  if (!receipt) return fail('PROFILE_RECEIPT_REQUIRED', `surface ${surface} is a registered SNS surface: run scripts/resolve-editorial.mjs --plan <plan.json> --target <id> --out receipt.json and pass --profile-receipt`);
  if (receipt.status !== STATUS.READY || !receipt.profile) return fail('PROFILE_RECEIPT_NOT_READY', `receipt status ${receipt.status}`);
  const body = receipt.profile.body;
  if (!isObj(body) || hashOf(body) !== receipt.profile.resolved_hash) return fail('PROFILE_RECEIPT_HASH_MISMATCH', 'receipt body does not match its resolved_hash');
  if (body.status !== STATUS.READY) return fail('PROFILE_RECEIPT_NOT_READY', `hashed body status is ${body.status}`);
  if (!['visual', 'both'].includes(body.task_kind)) return fail('PROFILE_TASK_KIND', `receipt was resolved for task_kind "${body.task_kind}"; rendering needs visual or both (resolve-editorial --task-kind visual)`);

  let rules = [];
  let identity;
  if (isSns) {
    const tid = receipt.target?.id;
    const t = tid && Object.hasOwn(manifest.sns_targets, tid) ? manifest.sns_targets[tid] : null;
    if (!t || t.surface !== surface) return fail('PROFILE_TARGET_MISMATCH', `receipt target ${tid} is not on surface ${surface}`);
    if (body.id !== `target:${tid}` || body.target_id !== tid) return fail('PROFILE_TARGET_MISMATCH', `hashed profile id ${body.id} does not name target ${tid}`);
    if (!t.visual) return fail('NO_VISUAL_PROFILE', `target ${tid} has no registered visual profile`);
    if (!t.visual.artifacts.includes(plan.profiles.artifact)) return fail('ARTIFACT_NOT_MAPPED', `${plan.profiles.artifact} is not mapped for ${tid}`);
    rules = [...t.visual.files, ...t.visual.values];
    identity = { profile_id: receipt.profile.id, target: tid };
  } else {
    const fid = receipt.flow?.id;
    const f = fid && Object.hasOwn(manifest.existing_flows ?? {}, fid) ? manifest.existing_flows[fid] : null;
    if (!f || f.surface !== surface || receipt.flow.surface !== surface) return fail('PROFILE_TARGET_MISMATCH', `flow receipt ${fid} is on surface ${receipt.flow?.surface}, plan surface is ${surface}`);
    if (body.id !== `flow:${fid}` || body.flow_id !== fid) return fail('PROFILE_TARGET_MISMATCH', `hashed profile id ${body.id} does not name flow ${fid}`);
    if (!f.artifacts.includes(plan.profiles.artifact)) return fail('ARTIFACT_NOT_MAPPED', `${plan.profiles.artifact} is not mapped for flow ${fid}`);
    identity = { profile_id: receipt.profile.id, flow: fid };
  }
  const reader = ctx.reader ?? new RuleReader();
  const mf = reader.read(MANIFEST_PATH);
  if (mf.status !== READ.READ) return fail('MANIFEST_UNREADABLE', `entry manifest ${mf.status}`);
  if (body.manifest_sha256 !== mf.sha256 || receipt.manifest?.sha256 !== mf.sha256) return fail('MANIFEST_CHANGED', 'the entry manifest changed since this receipt was resolved; re-run resolve-editorial');
  const current = reader.revision;
  let revisionCheck = 'current';
  if (body.revision !== current) {
    if (ctx.pinnedRevision && ctx.pinnedRevision === body.revision) revisionCheck = 'pinned';
    else return fail('PROFILE_REVISION_STALE', `receipt was resolved at revision ${body.revision}, current is ${current}; re-run resolve-editorial or pass --pinned-revision ${body.revision} to render against the pinned revision on purpose`);
  }
  const have = new Map((body.rule_files ?? []).map((r) => [r.path, r.sha256]));
  for (const path of rules) {
    if (!have.has(path)) return fail('VISUAL_RULES_NOT_LOADED', `receipt did not load visual rule file ${path} for ${plan.profiles.artifact}; resolve with --task-kind visual`);
    if (revisionCheck === 'current') {
      const cur = reader.read(path);
      if (cur.status !== READ.READ) return fail('VISUAL_RULES_UNREADABLE', `${path}: ${cur.status}`);
      if (cur.sha256 !== have.get(path)) return fail('VISUAL_RULES_CHANGED', `${path} changed since this receipt was resolved; re-run resolve-editorial`);
    }
  }
  return { ok: true, applies: true, resolved_hash: receipt.profile.resolved_hash, ...identity, revision: body.revision, revision_check: revisionCheck, current_revision: current, integrity: 'hash-checked, not cryptographically authenticated' };
}

/** Signalytics-style delivery contract check (file names only; no Drive writes are ever represented). Called by `resolve-editorial.mjs --check-package <dir> --target <id>`. */
export function checkDeliveryPackage(targetId, fileNames, manifest) {
  const c = manifest.sns_targets[targetId]?.output_contract;
  if (!c) return { ok: true, applicable: false, issues: [] };
  const issues = [];
  const pngs = fileNames.filter((f) => /\.png$/i.test(f)).length;
  if (pngs < c.png.min || pngs > c.png.max) issues.push(`PNG count ${pngs}, expected ${c.png.min}-${c.png.max}${c.png.sixth_conditional ? ' (sixth only when conditioned)' : ''}`);
  for (const f of c.required_files) if (!fileNames.includes(f)) issues.push(`missing ${f}`);
  if (fileNames.some((f) => /^drive:/i.test(f) || /(^|[\/\s"'(])(https?:\/\/)?(drive|docs)\.google\.com\b/i.test(f))) issues.push('Drive result writes/links are forbidden (drive: prefix or drive.google.com / docs.google.com URL)');
  return { ok: issues.length === 0, applicable: true, issues };
}
