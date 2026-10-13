/**
 * Intelligence Library -> Editorial intake adapter (SUE-1572 / SUE-1426 R3).
 *
 * Consumes an `intelligence-library-input/1` packet (produced by
 * `python -m multimodal.units handoff`) and maps ONLY the needed fields onto the
 * EXISTING intake (editorial-intent `inputs.sources` / `inputs.references`) and
 * the EXISTING source manifest (schemas/source.schema.json). It is not a router
 * and not a second schema: resolveEditorial() still decides profile/precedence.
 *
 * Authority is kept apart by construction:
 *   knowledge          -> fact authority   (inputs.sources + manifest) ONLY when pinned, hash-verified,
 *                         active and epistemic_status === 'supported'; otherwise context-only.
 *   editorial_pattern  -> craft authority  (inputs.references, modality text)
 *   visual_reference   -> craft authority  (inputs.references, modality visual)
 * A craft reference never satisfies a fact requirement and a knowledge fragment never
 * sets a style/visual field. Library text is DATA: this module never copies or forwards
 * unit/note text, never emits overrides, and ignores the packet's `usage` prose.
 * Locators only (path/sha256/commit); no private corpus text or image bytes.
 * No analytics (views/CTR/engagement) are read or recorded.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, stable } from './resolve-core.mjs';
import { validateManifest } from './source-contract-core.mjs';

export const PACKET_FORMAT = 'intelligence-library-input/1';
export const BRIEF_VERSION = 'editorial-brief/1';
export const LIBRARY_REPO = 'suengj/intelligence-library';
const CHANNELS = { knowledge: { section: 'notes/fragments/', role: 'fact' }, editorial_pattern: { section: 'patterns/', role: 'craft', modality: 'text' }, visual_reference: { section: 'patterns/', role: 'craft', modality: 'visual' } };
const PACKET_KEYS = ['format_version', 'repository', 'source_commit', 'working_tree_preview', 'topic', 'surface', 'requested_intensity', 'channels', 'provenance', 'consumer', 'publication_authorized', 'usage'];
const ITEM_KEYS = ['id', 'path', 'sha256', 'epistemic_status', 'as_of'];
const ID = /^unit-[a-z0-9][a-z0-9._-]{2,127}$/;
const HEX = /^[a-f0-9]{64}$/;
const INTENSITIES = ['low', 'medium', 'high', 'extreme'];
const EPISTEMIC = ['unverified', 'supported', 'disputed', 'personal', 'not_applicable'];
// Informational only: flags text that talks like instructions. It never changes authority either way.
const INSTRUCTION_LIKE = /(ignore (all |any )?(previous|prior|above)|disregard|override|you must|system\s*:|set (the )?(epistemic|style|status)|mark (this )?(as )?(verified|approved)|지시|무시하고|따르라|무조건 (승인|사실))/i;

export class LibraryInputError extends Error { constructor(code, message) { super(message); this.code = code; } }
const fail = (code, msg) => { throw new LibraryInputError(code, msg); };
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

/** Reads selected library files only. One instance per task: identical path+revision is read once. */
export class LibraryReader {
  constructor(root = null) {
    this.root = root ? resolve(root) : null; this.cache = new Map(); this.reads = 0; this.cacheHits = 0;
    this.head = this.root ? gitHead(this.root) : null;
  }
  read(path) {
    if (!this.root) return { status: 'no_root' };
    if (this.cache.has(path)) { this.cacheHits++; return this.cache.get(path); }
    const full = resolve(this.root, path);
    const rel = relative(this.root, full);
    let r;
    if (rel.startsWith('..') || isAbsolute(rel)) r = { status: 'outside_root' };
    else if (!existsSync(full)) r = { status: 'missing' };
    else { this.reads++; const buf = readFileSync(full); r = { status: 'read', sha256: sha(buf), buf }; }
    this.cache.set(path, r);
    return r;
  }
}
/**
 * Pin verification (review2 #5): a packet that claims source_commit must match git, not just itself.
 * The commit must exist in the library root, and each file's content must equal that commit's blob for the path.
 */
LibraryReader.prototype.pinCheck = function pinCheck(commit, path, buf) {
  if (!this.root) return 'no_root';
  this.commitOk ??= new Map();
  if (!this.commitOk.has(commit)) this.commitOk.set(commit, spawnSync('git', ['-C', this.root, 'cat-file', '-e', `${commit}^{commit}`], { encoding: 'utf8' }).status === 0);
  if (!this.commitOk.get(commit)) return this.head === null ? 'pin_unverifiable_no_git' : 'pin_commit_missing';
  const g = spawnSync('git', ['-C', this.root, 'rev-parse', '--verify', '-q', `${commit}:${path}`], { encoding: 'utf8' });
  if (g.status !== 0) return 'pin_not_in_commit';
  const want = g.stdout.trim(), got = createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
  return want === got ? 'ok' : 'pin_blob_mismatch';
};
function gitHead(root) {
  const g = spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return g.status === 0 ? g.stdout.trim() : null;
}

/** Strict structural check (unknown fields rejected). Throws LibraryInputError. */
export function parsePacket(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('PACKET_SHAPE', 'packet must be an object');
  // The Library CLI wraps every result as {"ok": true, ...}. Accept and drop exactly ok===true; anything else is refused.
  let packet = input;
  if (Object.hasOwn(input, 'ok')) {
    if (input.ok !== true) fail('PACKET_SHAPE', `packet "ok" must be exactly true when present (got ${JSON.stringify(input.ok)}); a failed Library result is not a packet`);
    const { ok, ...rest } = input; packet = rest;
  }
  if (packet.format_version !== PACKET_FORMAT) fail('PACKET_FORMAT', `expected ${PACKET_FORMAT}`);
  const extra = Object.keys(packet).filter((k) => !PACKET_KEYS.includes(k));
  if (extra.length) fail('PACKET_UNKNOWN_FIELD', `unknown packet field(s): ${extra.join(', ')}`);
  if (packet.repository !== LIBRARY_REPO) fail('PACKET_REPOSITORY', `repository must be ${LIBRARY_REPO}`);
  if (packet.publication_authorized !== false) fail('PACKET_PUBLICATION', 'packet may never authorize publication');
  if (typeof packet.working_tree_preview !== 'boolean') fail('PACKET_SHAPE', 'working_tree_preview must be boolean');
  if (packet.source_commit !== null && !/^[a-f0-9]{7,64}$/.test(packet.source_commit ?? '')) fail('PACKET_SHAPE', 'source_commit must be a hex commit or null');
  if ((packet.source_commit === null) !== packet.working_tree_preview) fail('PACKET_SHAPE', 'working_tree_preview must be true exactly when source_commit is null');
  if (packet.requested_intensity != null && !INTENSITIES.includes(packet.requested_intensity)) fail('PACKET_SHAPE', 'invalid requested_intensity');
  if (!packet.channels || typeof packet.channels !== 'object') fail('PACKET_SHAPE', 'channels missing');
  const badChannel = Object.keys(packet.channels).filter((k) => !CHANNELS[k]);
  if (badChannel.length) fail('PACKET_UNKNOWN_FIELD', `unknown channel(s): ${badChannel.join(', ')}`);
  const seen = new Set();
  for (const [channel, items] of Object.entries(packet.channels)) {
    if (!Array.isArray(items)) fail('PACKET_SHAPE', `channels.${channel} must be an array`);
    for (const it of items) {
      const keys = Object.keys(it ?? {});
      const bad = keys.filter((k) => !ITEM_KEYS.includes(k));
      if (bad.length) fail('PACKET_UNKNOWN_FIELD', `channels.${channel}[].${bad.join(',')} is not an accepted field (authority is derived here, never supplied by the packet)`);
      if (!ID.test(it.id ?? '')) fail('PACKET_ITEM', `bad unit id ${it.id}`);
      if (it.path !== `${CHANNELS[channel].section}${it.id}.json`) fail('PACKET_ITEM', `${it.id}: path must be ${CHANNELS[channel].section}${it.id}.json for channel ${channel}`);
      if (!HEX.test(it.sha256 ?? '')) fail('PACKET_ITEM', `${it.id}: sha256 must be 64 hex`);
      if (!EPISTEMIC.includes(it.epistemic_status)) fail('PACKET_ITEM', `${it.id}: invalid epistemic_status`);
      if (seen.has(it.id)) fail('PACKET_ITEM', `${it.id} appears twice (one unit has one channel)`);
      seen.add(it.id);
    }
  }
  for (const p of packet.provenance ?? []) {
    if (typeof p?.path !== 'string' || !HEX.test(p.sha256 ?? '') || p.path.includes('..') || isAbsolute(p.path)) fail('PACKET_ITEM', 'bad provenance entry');
  }
  return packet;
}

const refSlug = (id, digest) => `ref:lib-${id.replace(/^unit-/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${digest.slice(0, 8)}`;
const locatorOf = (packet, item) => `library://${LIBRARY_REPO}/${item.path}?rev=${packet.source_commit ?? 'working-tree-preview'}&sha256=${item.sha256}`;

function referenceDimensions(modality, repoRoot) {
  const p = join(repoRoot, 'editorial/profiles/reference', `${modality}.json`);
  return new Set(JSON.parse(readFileSync(p, 'utf8')).dimensions.map((d) => d.id));
}

/**
 * Convert + verify. Never throws for per-item problems: those block only the affected use and are reported.
 * selections: { "<unit id>": { dimensions?: [..], confirmed?: bool, uses?: [..] } }
 */
export function adaptLibraryPacket(rawPacket, { reader = new LibraryReader(null), selections = {}, allowPreview = false, now = new Date().toISOString(), repoRoot = REPO_ROOT } = {}) {
  const packet = parsePacket(rawPacket);
  const pinned = packet.source_commit !== null && !packet.working_tree_preview;
  const out = {
    adapter_version: '1.0.0', packet: { source_commit: packet.source_commit, pinned, working_tree_preview: packet.working_tree_preview, topic: packet.topic, surface: packet.surface ?? null, requested_intensity: packet.requested_intensity ?? null },
    stale_revision: Boolean(pinned && reader.head && reader.head !== packet.source_commit),
    items: [], inputs: { sources: [], references: [] }, manifest: null, context_only: [], supporting_notes: [], fallbacks: [], blocked_uses: [], notes: [],
  };
  if (!pinned) out.notes.push('packet is an unpinned working-tree preview: knowledge cannot be fact authority' + (allowPreview ? '; craft references accepted for exploration only' : '; all items blocked unless --allow-preview'));
  if (out.stale_revision) out.notes.push(`packet commit ${packet.source_commit} differs from library HEAD ${reader.head}; each file hash is re-checked, so unchanged items stay usable`);

  // Provenance chain: a changed/missing provenance file taints the knowledge that cites it.
  const provBad = [];
  for (const p of packet.provenance ?? []) {
    const r = reader.read(p.path);
    const noteLike = /^(notes|maps|intelligence\/knowledge)\/.+\.md$/.test(p.path);
    let status = r.status === 'no_root' ? 'unverified_no_root' : r.status !== 'read' ? r.status : r.sha256 === p.sha256 ? 'verified' : 'hash_mismatch';
    if (status === 'verified' && pinned) { const pc = reader.pinCheck(packet.source_commit, p.path, r.buf); if (pc !== 'ok') status = pc; }
    if (!['verified'].includes(status)) provBad.push({ path: p.path, status });
    if (noteLike) out.supporting_notes.push({ path: p.path, sha256: p.sha256, verification: status, use: 'context_only', locator: `library://${LIBRARY_REPO}/${p.path}?rev=${packet.source_commit ?? 'working-tree-preview'}&sha256=${p.sha256}` });
  }

  const entries = [];
  for (const [channel, items] of Object.entries(packet.channels)) {
    const spec = CHANNELS[channel];
    for (const it of items) {
      const sel = selections[it.id] ?? {};
      const item = { id: it.id, channel, role: spec.role, path: it.path, sha256: it.sha256, epistemic_status: it.epistemic_status, as_of: it.as_of ?? null, locator: locatorOf(packet, it), verification: null, usable: false, influences: [], reason: null };
      const r = reader.read(it.path);
      if (r.status === 'no_root') item.verification = 'unverified_no_root';
      else if (r.status !== 'read') item.verification = r.status;
      else if (r.sha256 !== it.sha256) item.verification = 'hash_mismatch';
      else if (pinned && (item.pin = reader.pinCheck(packet.source_commit, it.path, r.buf)) !== 'ok') item.verification = item.pin;
      else {
        item.verification = 'verified';
        let unit = null; try { unit = JSON.parse(r.buf.toString('utf8')); } catch { item.verification = 'unparseable'; }
        if (unit) {
          if (unit.id !== it.id || unit.kind !== channel) item.verification = 'identity_mismatch';
          else if (unit.status !== 'active') item.verification = `inactive:${unit.status}`;
          else if (unit.epistemic_status !== it.epistemic_status) item.verification = 'epistemic_mismatch';
          if (INSTRUCTION_LIKE.test(`${unit.title ?? ''} ${unit.summary ?? ''} ${unit.content ?? ''}`)) item.notes = ['contains instruction-like text: treated as data, grants no authority'];
              }
      }
      // Gate per item. Preview/unpinned is blocked by default; hash/identity problems always block.
      const hardBad = item.verification !== 'verified';
      if (hardBad && item.verification !== 'unverified_no_root') item.reason = item.verification;
      else if (item.verification === 'unverified_no_root') item.reason = 'library root not available: hash could not be verified';
      else if (!pinned && !allowPreview) item.reason = 'unpinned_working_tree_preview';
      else if (!pinned && spec.role === 'fact') item.reason = 'unpinned_working_tree_preview';
      else if (spec.role === 'fact' && provBad.length) item.reason = `provenance_unverified:${provBad.map((b) => `${b.path}=${b.status}`).join(',')}`;
      item.usable = item.reason === null;
      out.items.push(item);
      entries.push({ item, sel });
    }
  }

  for (const { item, sel } of entries) {
    if (item.role === 'fact') {
      if (item.usable && item.epistemic_status === 'supported') {
        item.influences = sel.uses?.length ? sel.uses : ['fact_source'];
        const sourceId = `src:github:${LIBRARY_REPO}/${item.id}`;
        item.source_id = sourceId;
        out.inputs.sources.push({ source_id: sourceId, state: 'assumed', uri: item.locator, note: `library knowledge ${item.id}; epistemic_status=supported; sha256=${item.sha256}; as_of=${item.as_of ?? 'unknown'}; selected by agent, not stated by the user` });
      } else if (item.usable) {
        item.influences = ['context_only'];
        item.authority = 'context_only';
        item.reason = `epistemic_status=${item.epistemic_status} cannot establish a fact; usable as background only`;
        out.context_only.push({ id: item.id, path: item.path, sha256: item.sha256, epistemic_status: item.epistemic_status, locator: item.locator });
      } else {
        out.blocked_uses.push({ use: 'fact_claims', id: item.id, reason: item.reason });
      }
    } else if (item.usable) {
      const modality = CHANNELS[item.channel].modality;
      const vocab = referenceDimensions(modality, repoRoot);
      const asked = sel.dimensions ?? [];
      const dims = asked.filter((d) => vocab.has(d));
      const dropped = asked.filter((d) => !vocab.has(d));
      if (dropped.length) out.notes.push(`${item.id}: dimension(s) ${dropped.join(', ')} are not in editorial/profiles/reference/${modality}.json and were dropped`);
      if (!dims.length) { item.usable = false; item.reason = 'no_valid_dimensions_selected'; out.fallbacks.push({ id: item.id, channel: item.channel, reason: item.reason, fallback: 'profile default style description; no reference applied' }); continue; }
      item.influences = dims;
      item.ref_id = refSlug(item.id, item.sha256);
      out.inputs.references.push({ ref_id: item.ref_id, state: sel.confirmed ? 'confirmed' : 'assumed', modality, dimensions: dims, note: `library ${item.channel} ${item.id}; locator ${item.locator}; craft only, no factual authority` });
    } else {
      out.fallbacks.push({ id: item.id, channel: item.channel, reason: item.reason, fallback: 'optional reference skipped; profile default style description used' });
    }
  }

  const factEntries = out.items.filter((i) => i.source_id);
  if (factEntries.length) {
    out.manifest = {
      schema_version: '1.0.0', generated_at: now,
      sources: factEntries.map((i) => ({
        source_id: i.source_id, kind: 'intelligence_dossier', origin: 'github',
        origin_ref: { repo: LIBRARY_REPO, ref: packet.source_commit, path: i.path },
        title: `Library unit ${i.id}`, source_created_at: null, ingested_at: now, content_observed_at: now,
        content_hash: { algo: 'sha256', value: i.sha256 }, revision: 1,
        disposition: 'candidate', disposition_authority: 'ai_recommended', disposition_changed_at: now,
        rights: { license: null, quotable: false, redistributable: false, attribution: 'Private library fragment; locator only, body not copied. Claim-level evidence must resolve to the unit\'s cited sources.' },
        notes: `epistemic_status=${i.epistemic_status}; as_of=${i.as_of ?? 'unknown'}`,
      })),
    };
    const issues = validateManifest(out.manifest);
    if (issues.length) fail('MANIFEST_INVALID', issues.map((i) => `[${i.code}] ${i.where} ${i.message}`).join('; '));
  }
  out.satisfies = { fact_requirement: out.inputs.sources.length > 0, craft_requirement: out.inputs.references.length > 0 };
  return out;
}

/** Merge into an existing intent without touching axes/overrides/constraints. Returns a new object. */
export function mergeIntoIntent(intent, adapted) {
  const next = JSON.parse(JSON.stringify(intent));
  next.inputs = next.inputs ?? { sources: [], references: [] };
  const sourceIds = new Set(next.inputs.sources.map((s) => s.source_id));
  const refIds = new Set(next.inputs.references.map((r) => r.ref_id));
  for (const s of adapted.inputs.sources) { if (refIds.has(s.source_id)) fail('AUTHORITY_MIX', `${s.source_id} is already a reference`); if (!sourceIds.has(s.source_id)) next.inputs.sources.push(s); }
  for (const r of adapted.inputs.references) { if (sourceIds.has(r.ref_id)) fail('AUTHORITY_MIX', `${r.ref_id} is already a source`); if (!refIds.has(r.ref_id)) next.inputs.references.push(r); }
  return next;
}

/** Decide whether Library search/handoff is needed at all. */
export function libraryDecision(intent, { packet = null, noLibrary = false, factRequired = false } = {}) {
  const own = (intent?.inputs?.sources ?? []).filter((s) => !String(s.source_id).includes(LIBRARY_REPO) && s.state !== 'missing_material');
  if (packet) return { searched: true, skipped: false, reason: 'packet_provided', user_sources: own.length };
  if (own.length > 0) return { searched: false, skipped: true, reason: 'user_source_sufficient', user_sources: own.length };
  return { searched: false, skipped: true, reason: noLibrary ? 'library_disabled_by_caller' : 'no_packet_provided', user_sources: 0, fact_source_missing: Boolean(factRequired) };
}

/** Build the copy plan / visual plan brief from the resolved receipt and the adapted library input. */
export function buildEditorialBrief({ intent, receipt, adapted = null, decision, factRequired = false, taskKind = null }) {
  const body = receipt.profile?.body ?? null;
  const userSources = (intent.inputs?.sources ?? []).filter((s) => !String(s.source_id).includes(LIBRARY_REPO) && s.state !== 'missing_material').map((s) => s.source_id);
  const librarySources = adapted?.items.filter((i) => i.source_id).map((i) => i.source_id) ?? [];
  const factAvailable = userSources.length + librarySources.length > 0;
  const blocked = [...(adapted?.blocked_uses ?? [])];
  if (factRequired && !factAvailable) blocked.push({ use: 'fact_claims', reason: 'required fact source missing (no user source and no verified library knowledge)' });
  const factBlocked = factRequired && !factAvailable;
  const refs = (modality) => (adapted?.items ?? []).filter((i) => i.ref_id && CHANNELS[i.channel].modality === modality).map((i) => ({ ref_id: i.ref_id, library_id: i.id, channel: i.channel, dimensions: i.influences, path: i.path, sha256: i.sha256, locator: i.locator, factual_authority: false }));
  const wantsText = !taskKind || taskKind === 'text' || taskKind === 'both' || taskKind === 'combined';
  const wantsVisual = !taskKind || taskKind === 'visual' || taskKind === 'both' || taskKind === 'combined';
  return stable({
    brief_version: BRIEF_VERSION, intent_id: intent.intent_id ?? null,
    status: receipt.status !== 'READY' ? receipt.status : blocked.length ? 'READY_WITH_BLOCKED_USES' : 'READY',
    integrity: receipt.integrity ? { state: receipt.integrity.integrity ?? null, unverified_required: receipt.integrity.unverified_required ?? [] } : null,
    target: receipt.target, profile: receipt.profile ? { id: receipt.profile.id, version: receipt.profile.version, resolved_hash: receipt.profile.resolved_hash } : null,
    library: {
      searched: decision.searched, skipped: decision.skipped, skip_reason: decision.skipped ? decision.reason : null,
      packet: adapted?.packet ?? null, stale_revision: adapted?.stale_revision ?? false,
      selected: (adapted?.items ?? []).map((i) => ({ id: i.id, channel: i.channel, role: i.role, usable: i.usable, authority: i.source_id ? 'fact_source' : i.authority ?? (i.ref_id ? 'craft_reference' : 'none'), influenced: i.influences, path: i.path, sha256: i.sha256, as_of: i.as_of, verification: i.verification, reason: i.reason })),
      fallbacks: adapted?.fallbacks ?? [], notes: adapted?.notes ?? [], supporting_notes: adapted?.supporting_notes ?? [],
      data_only: true, analytics_collected: false,
    },
    blocked_uses: blocked,
    copy_plan: wantsText && body ? {
      voice_family: body.voice_family, fields: body.fields, rule_files: body.rule_files.map((f) => f.path),
      factual_claims: factBlocked ? 'BLOCKED' : factAvailable ? 'allowed_with_sources' : 'no_new_factual_claims_without_a_source',
      fact_sources: { user: userSources, library: librarySources }, context_only: adapted?.context_only ?? [],
      expression_references: refs('text'), requested_intensity: adapted?.packet.requested_intensity ?? null,
    } : null,
    visual_plan: wantsVisual && body?.visual ? {
      artifacts: body.visual.artifacts, canvas: body.fields.canvas ?? null, text_policy: body.fields.text_policy ?? null,
      visual_references: refs('visual'), reference_may_establish_facts: false, requested_intensity: adapted?.packet.requested_intensity ?? null,
      execution: 'plan only; no image generated or rendered by this step',
    } : null,
    conflicts: receipt.conflicts,
  });
}
