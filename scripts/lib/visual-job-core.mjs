/**
 * Visual job engine — AES-V2.7 (SUE-565).
 *
 * Validates a compiled visual job against schemas/visual-job.schema.json plus
 * the cross-field gates a schema cannot express: density/profile match,
 * renderer route vs evidence, context isolation, and attempts budget. Also
 * performs the deterministic, model-free prompt compilation described in
 * schemas/VISUAL-JOB-CONTRACT.md.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export const VISUAL_JOB_SCHEMA = resolve(ROOT, 'schemas/visual-job.schema.json');
export const ARTIFACT_PROFILE_DIR = resolve(ROOT, 'editorial/profiles/artifact');
export const BRAND_PROFILE_DIR = resolve(ROOT, 'editorial/profiles/brand');

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

export const loadSchema = (p = VISUAL_JOB_SCHEMA) => readJSON(p);

/** Load every editorial/profiles/artifact/visual-*.json, keyed by its `artifact` id. */
export function loadArtifactProfiles(dir = ARTIFACT_PROFILE_DIR) {
  const out = {};
  for (const f of readdirSync(dir)) {
    if (!f.startsWith('visual-') || !f.endsWith('.json')) continue;
    const profile = readJSON(resolve(dir, f));
    out[profile.artifact] = profile;
  }
  return out;
}

/**
 * Resolve a brand profile from the brand axis (editorial/profiles/brand/,
 * filenames `<brand-id>.v<major>.json` per editorial/profiles/axes.json) by
 * the job's own `brand_profile` + `brand_profile_version` fields.
 *
 * Fails closed: B6 (AES-V2 FIX review) found that a fixed default brand
 * profile path made `job.brand_profile` decorative — any brand id compiled
 * successfully against suengj.com's tokens while the lineage record claimed
 * the requested brand had loaded. There is no fallback brand here. An
 * unresolvable id or version throws rather than silently loading a default.
 */
export function resolveBrandProfile(brandId, brandProfileVersion, dir = BRAND_PROFILE_DIR) {
  if (typeof brandId !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(brandId)) {
    throw new Error(`invalid brand_profile id: ${JSON.stringify(brandId)} — expected editorial/profiles/axes.json's brand axis id_pattern`);
  }
  const major = /^\d+\.\d+\.\d+$/.test(String(brandProfileVersion ?? '')) ? brandProfileVersion.split('.')[0] : null;
  if (major === null) {
    throw new Error(`invalid brand_profile_version: ${JSON.stringify(brandProfileVersion)} for brand "${brandId}"`);
  }
  const filename = `${brandId}.v${major}.json`;
  const path = resolve(dir, filename);
  if (!existsSync(path)) {
    throw new Error(`unknown brand profile "${brandId}"@v${major} — expected ${relative(ROOT, path)} under editorial/profiles/brand/ (fail-closed: there is no default brand fallback)`);
  }
  const profile = readJSON(path);
  if (profile.brand !== brandId) {
    throw new Error(`${relative(ROOT, path)} declares brand "${profile.brand}", expected "${brandId}"`);
  }
  return profile;
}

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  UNKNOWN_PROFILE: 'unknown-artifact-profile',
  PROFILE_REF_MISMATCH: 'profile-ref-mismatch',
  DENSITY_DRIFT: 'density-drift-from-profile',
  DENSITY_MISMATCH: 'density-profile-mismatch',
  EVIDENCE_GENERATIVE: 'evidence-visual-on-generative-route',
  CONTEXT_LEAK: 'context-isolation-leak',
  ATTEMPTS_EXCEEDED: 'attempts-exceed-max',
  SKIP_NOT_CLEAN: 'skip-verdict-not-clean',
  MISSING_REF: 'missing-article-or-package-ref',
  RUNTIME_LEAK: 'renderer-runtime-identity-in-prompt',
  RUNTIME_NOT_EXCLUDED: 'renderer-runtime-identity-not-declared-excluded',
  BRAND_OVERRIDE_UNAUTHORIZED: 'reference-trait-overrides-brand-without-authorization',
  BRAND_VERSION_MISMATCH: 'brand-profile-version-mismatch',
  UNKNOWN_BRAND: 'unknown-brand-profile',
  INCONSISTENT_GAIN_VERDICT: 'information-gain-verdict-inconsistent-with-redundancy-test',
  REVISION_WITHOUT_APPROVAL: 'revision-intent-without-approved-asset',
  APPROVED_IDENTITY_INCOMPLETE: 'approved-master-missing-immutable-identity',
  APPROVAL_FLAGS_INCONSISTENT: 'approval-lock-flags-inconsistent-with-revision-intent',
  REGENERATION_FORBIDDEN: 'regeneration-forbidden-after-human-approval',
  GENERATION_PROMPT_FORBIDDEN: 'generation-prompt-compiled-after-human-approval',
  REVISION_AUTHORIZATION_MISSING: 'revision-intent-requires-explicit-authorization',
  APPROVAL_STATE_INCONSISTENT: 'approved-master-identity-without-approval-lock',
  APPROVAL_ATTRIBUTION_MISSING: 'approval-lock-without-owner-attribution',
});

/**
 * Post-approval intents that are derivative/media work, never new artwork
 * (editorial/APPROVED-VISUAL-ASSET-LIFECYCLE.md §3). "Make it high quality",
 * "convert it to WebP", "upload it", "bust the cache" all land here.
 */
export const NON_GENERATIVE_INTENTS = Object.freeze([
  'publication_only', 'fidelity_only', 'format_only', 'layout_only',
]);

/** Intents that may reopen the renderer, and only with explicit authorization. */
export const REOPENING_INTENTS = Object.freeze(['local_edit', 'concept_change']);

export const isApprovalLocked = (job) => job?.approved_asset?.state === 'human_approved_locked';

/** Every field that only a record naming a specific approved master would carry. */
export const MASTER_IDENTITY_FIELDS = Object.freeze([
  'master_ref', 'master_digest', 'native_geometry', 'format',
  'approved_by', 'approved_at', 'approval_context',
]);

/** A string that is present and is not only whitespace. */
const isMeaningful = (v) => typeof v === 'string' && v.trim().length > 0;
const meaningfulEntries = (arr) => (Array.isArray(arr) ? arr.filter(isMeaningful) : []);

/**
 * True only for an explicitly authorized reopen: a stated local_edit or
 * concept_change that names who authorized it, what they asked for, and — for
 * a bounded edit — exactly what may change and what must not.
 *
 * The authorization has to be complete here, not merely declared, because this
 * predicate is what re-opens the renderer. An intent word on its own is a
 * claim; this is the evidence for it.
 */
export function hasAuthorizedReopen(job) {
  const revision = job?.revision;
  if (!revision || !REOPENING_INTENTS.includes(revision.intent)) return false;
  if (revision.regeneration_allowed !== true) return false;
  const auth = revision.authorization;
  if (!isMeaningful(auth?.authorized_by) || !isMeaningful(auth?.statement)) return false;
  if (revision.intent === 'local_edit') {
    if (meaningfulEntries(auth.bounded_delta).length === 0) return false;
    if (meaningfulEntries(auth.protected_invariants).length === 0) return false;
  }
  return true;
}

/**
 * True when no image-generation prompt may be compiled for this job.
 *
 * Closed by default, and that default is the whole point. An earlier form of
 * this predicate sealed a locked master only when it also declared one of the
 * four non-generative intents — so omitting `revision` entirely, which the
 * schema permits, walked a human_approved_locked master straight back to a
 * generative renderer with no diagnostic at all. Silence is not authorization.
 * Approval closes the edge; only an explicitly authorized local_edit or
 * concept_change reopens it.
 */
export function isRegenerationSealed(job) {
  return isApprovalLocked(job) && !hasAuthorizedReopen(job);
}

/** Thrown by compileVisualPrompt when a sealed or lock-violating job asks for a fresh prompt. */
export class RegenerationSealedError extends Error {
  constructor(job, issues = []) {
    // Two different refusals reach here and they need different sentences. A
    // sealed job is locked and unauthorized — the advice is to declare an
    // authorized intent. A job refused for an unresolved lock finding may not
    // even be locked (a demoted `candidate`), or may already declare a
    // complete authorization whose flags contradict it; telling that caller to
    // "declare local_edit or concept_change" would be wrong.
    const sealed = isApprovalLocked(job) && !hasAuthorizedReopen(job);
    const detail = issues.length > 0
      ? `\n  approval lock: ${issues.map((i) => `[${i.code}] ${i.message}`).join('\n  ')}`
      : '';
    super(sealed
      ? `visual job "${job?.job_id ?? '<job>'}" carries a human_approved_locked master ` +
        `(revision.intent: ${job?.revision?.intent ? `"${job.revision.intent}"` : 'not declared'}) — ` +
        'no image-generation prompt may be compiled for it. Fidelity, format, layout, and publication work ' +
        'are deterministic media operations on the approved master ' +
        '(editorial/APPROVED-VISUAL-ASSET-LIFECYCLE.md §3-§6). If the image itself must change, declare ' +
        'revision.intent local_edit or concept_change with a complete revision.authorization; an undeclared ' +
        `intent is not an authorization to regenerate.${detail}`
      : `visual job "${job?.job_id ?? '<job>'}" has an unresolved approval-lock finding, so no ` +
        'image-generation prompt may be compiled for it. The record does not hold together: resolve the ' +
        `finding below before compiling anything from it.${detail}`);
    this.name = 'RegenerationSealedError';
    this.code = CODES.GENERATION_PROMPT_FORBIDDEN;
    this.issues = issues;
  }
}

const issue = (code, where, message) => ({ code, where, message });

// A small stopword list so the context-isolation token check does not flag
// ordinary connective English as a "leak". Deliberately conservative: any
// content word not traceable to a declared input still fails.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'as',
  'is', 'are', 'be', 'by', 'at', 'from', 'this', 'that', 'it', 'its', 'not',
  'no', 'none', 'when', 'where', 'which', 'than', 'must', 'never', 'always',
  'only', 'per', 'into', 'over', 'without', 'within', 'artifact', 'semantic',
  'spec', 'brand', 'audience', 'text', 'policy', 'composition', 'reference',
  'traits', 'adopt', 'avoid', 'do', 'copy', 'question', 'communicate',
  'include', 'adjustment', 'reject', 'accept', 'family', 'style', 'render',
  'palette', 'background', 'primary', 'accent',
]);

function tokenize(str) {
  return (str.match(/[a-z0-9]+/gi) ?? [])
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Every string a compiled prompt is legally allowed to derive tokens from. */
function permittedVocabulary(job, { profiles, brand }) {
  const parts = [];
  const profile = profiles[job.artifact_profile];
  if (profile) {
    parts.push(profile.family, profile.primary_job);
    parts.push(profile.composition?.dominant_structure ?? '');
    parts.push(JSON.stringify(profile.audience_adaptation ?? {}));
    parts.push(JSON.stringify(profile.text_policy ?? {}));
  }
  const spec = job.semantic_spec ?? {};
  parts.push(spec.question ?? '', ...(spec.must_communicate ?? []), ...(spec.must_not_include ?? []));
  parts.push(job.audience?.value ?? '', ...(job.audience?.traits_applied ?? []));
  const refs = job.selected_reference_traits ?? {};
  parts.push(...(refs.adopt ?? []), ...(refs.avoid ?? []), ...(refs.do_not_copy ?? []), ...(refs.authoritative_override ?? []));
  if (brand) {
    parts.push(JSON.stringify(brand.palette ?? {}));
    parts.push(JSON.stringify(brand.desired_impression ?? {}));
    parts.push(JSON.stringify(brand.line_and_materiality ?? {}));
  }
  parts.push(job.artifact_profile ?? '', job.brand_profile ?? '', job.text_policy ?? '');
  return new Set(parts.flatMap(tokenize));
}

/**
 * The approval lock (SUE-639 / SUE-638).
 *
 * Human approval converts a rendered candidate into an immutable master. From
 * that point the normal edge back to a generative renderer is closed: the
 * production incident this encodes went approved infographic → awkward upload
 * → low-resolution workaround → "make it high quality" → new generative render
 * → different artwork. Every step after the lock is a media operation on the
 * approved bytes, so these checks fail closed rather than trusting that an
 * orchestrator classified the request correctly.
 *
 * Two exceptions reopen the renderer, and only explicitly: a bounded
 * local_edit with stated protected invariants, and a concept_change the human
 * actually asked for.
 */
export function approvalLockIssues(job, where = job?.job_id ?? '<job>') {
  const out = [];
  const asset = job.approved_asset;
  const revision = job.revision;

  if (revision && !asset) {
    out.push(issue(CODES.REVISION_WITHOUT_APPROVAL, where,
      `revision.intent "${revision.intent}" is a post-approval classification but the job carries no approved_asset — approval must be machine state on this record, not conversational memory (editorial/APPROVED-VISUAL-ASSET-LIFECYCLE.md §2)`));
    return out;
  }
  if (!asset) return out;

  if (asset.state !== 'human_approved_locked') {
    // A candidate is still in generation, and that is the PASS path for
    // unapproved work — but only for a record that names no approved master.
    // Otherwise `state: candidate` beside a real master_ref/master_digest is a
    // demotion: it keeps the identity of the approved artifact while skipping
    // every guard below, which is approval laundering rather than candidacy.
    const identity = MASTER_IDENTITY_FIELDS.filter((f) => asset[f] !== undefined);
    if (identity.length > 0) {
      out.push(issue(CODES.APPROVAL_STATE_INCONSISTENT, where,
        `approved_asset.state is "${asset.state}" but the record still carries approved-master identity (${identity.join(', ')}) — a record that names an approved master is locked. Approval is not something a later job can demote by rewriting one field while keeping the master it points at.`));
    }
    return out;
  }

  // 1. A lock is only a lock if it names what was approved.
  const missing = [];
  if (!asset.master_ref) missing.push('master_ref');
  if (!asset.master_digest) missing.push('master_digest');
  if (!asset.format) missing.push('format');
  const geom = asset.native_geometry ?? {};
  const hasPixels = Number.isInteger(geom.width) && Number.isInteger(geom.height);
  const hasViewBox = typeof geom.view_box === 'string' && geom.view_box.length > 0;
  if (asset.format === 'svg') {
    if (!hasViewBox && !hasPixels) missing.push('native_geometry.view_box');
  } else if (!hasPixels) {
    missing.push('native_geometry.width/height');
  }
  if (missing.length > 0) {
    out.push(issue(CODES.APPROVED_IDENTITY_INCOMPLETE, where,
      `approved_asset.state is human_approved_locked but the master has no immutable identity: missing ${missing.join(', ')} — a lock without a digest and native geometry cannot prove which artifact was approved or that a derivative came from it`));
  }

  // The declared format must agree with what master_ref actually points at, so
  // "svg" cannot be used to walk past the raster geometry requirement above on
  // a master that is plainly a .png.
  const ext = /\.([a-z0-9]+)$/i.exec(asset.master_ref ?? '')?.[1]?.toLowerCase();
  const normalizeFormat = (f) => (f === 'jpg' ? 'jpeg' : f);
  if (ext && asset.format && normalizeFormat(ext) !== normalizeFormat(asset.format)) {
    out.push(issue(CODES.APPROVED_IDENTITY_INCOMPLETE, where,
      `approved_asset.format is "${asset.format}" but master_ref ends in ".${ext}" — the declared format must describe the artifact the lock points at, not a different one`));
  }

  // Who approved it, when, and against what. None of this makes the record
  // unforgeable — an agent that can write this file can write these fields too
  // — but it removes the silent path: a lock can no longer be asserted without
  // naming an approver and a context a human can check. See
  // editorial/APPROVED-VISUAL-ASSET-LIFECYCLE.md §2 on the residual limit.
  const attribution = ['approved_by', 'approved_at', 'approval_context']
    .filter((f) => !isMeaningful(asset[f]));
  // The schema's `format: date` is a shape check (\d{4}-\d{2}-\d{2}), so
  // "0000-00-00" passes it. A date nobody can look up is not an audit trail.
  // Round-tripped rather than merely parsed: Date.parse is lenient about day
  // overflow and silently rolls "2025-02-29" into March, so a parse check
  // alone still accepts dates that never happened.
  if (isMeaningful(asset.approved_at)) {
    const parsed = new Date(`${asset.approved_at}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== asset.approved_at) {
      out.push(issue(CODES.APPROVAL_ATTRIBUTION_MISSING, where,
        `approved_asset.approved_at "${asset.approved_at}" is date-shaped but is not a real calendar date`));
    }
  }
  if (attribution.length > 0) {
    out.push(issue(CODES.APPROVAL_ATTRIBUTION_MISSING, where,
      `approved_asset.state is human_approved_locked but the approval is unattributed: missing or blank ${attribution.join(', ')} — a lock must record who approved the master and against which article/package version, so the claim is auditable rather than ambient`));
  }

  // From here the routing guard applies whether or not a revision was declared.
  // An undeclared intent is the fail-closed case, not an exemption: approval
  // closes the edge to a generative renderer, and only an explicitly
  // authorized reopen opens it again.
  const intent = revision?.intent;
  const sealed = isRegenerationSealed(job);
  const under = intent ? `under revision.intent "${intent}"` : 'with no declared revision.intent';

  if (sealed && job.renderer_route !== 'deterministic') {
    out.push(issue(CODES.REGENERATION_FORBIDDEN, where,
      `a human_approved_locked master ${under} routed to renderer_route "${job.renderer_route}" — high-resolution delivery, format conversion, responsive layout, and publication are derivative/media operations on the approved master, not new image-generation jobs. The generative lineage of the master itself belongs in approved_asset.renderer_lineage.`));
  }
  if (sealed && job.compiled_prompt !== undefined) {
    out.push(issue(CODES.GENERATION_PROMPT_FORBIDDEN, where,
      `a human_approved_locked master ${under} still compiled an image-generation prompt — a post-approval job must not compile a fresh prompt unless an authorized local_edit/concept_change reopened generation (editorial/APPROVED-VISUAL-ASSET-LIFECYCLE.md §8)`));
  }

  if (!revision) {
    // The lock alone is a valid record. The guard above already held it closed;
    // the flag/authorization checks below need a declared intent to talk about.
    return out;
  }

  // 2. Identity flags must agree with the intent, so the record cannot claim
  //    a lock while quietly declaring regeneration open.
  if (NON_GENERATIVE_INTENTS.includes(intent)) {
    if (revision.preserve_visual_identity !== true || revision.regeneration_allowed !== false) {
      out.push(issue(CODES.APPROVAL_FLAGS_INCONSISTENT, where,
        `revision.intent "${intent}" on a human_approved_locked master requires preserve_visual_identity=true and regeneration_allowed=false, got ${revision.preserve_visual_identity}/${revision.regeneration_allowed}`));
    }
  }

  // 3. Reopening generation is explicit or it does not happen.
  if (REOPENING_INTENTS.includes(intent)) {
    const auth = revision.authorization;
    // Whitespace is not authorization. The schema's minLength:1 stops the empty
    // string and stops there; a single space would otherwise satisfy every
    // field that is supposed to say what a human actually asked for.
    if (!isMeaningful(auth?.authorized_by) || !isMeaningful(auth?.statement)) {
      out.push(issue(CODES.REVISION_AUTHORIZATION_MISSING, where,
        `revision.intent "${intent}" reopens the renderer on an approved master and therefore requires revision.authorization with a non-blank authorized_by (who authorized it) and statement (what they asked for)`));
    }
    if (revision.regeneration_allowed !== true) {
      out.push(issue(CODES.APPROVAL_FLAGS_INCONSISTENT, where,
        `revision.intent "${intent}" reopens the renderer but regeneration_allowed is ${revision.regeneration_allowed} — an authorized reopen must say so on the record`));
    }
    if (intent === 'local_edit') {
      if (meaningfulEntries(auth?.bounded_delta).length === 0 ||
          meaningfulEntries(auth?.protected_invariants).length === 0) {
        out.push(issue(CODES.REVISION_AUTHORIZATION_MISSING, where,
          'local_edit requires both a non-blank authorization.bounded_delta (exactly what may change) and authorization.protected_invariants (what must survive unchanged) — an unbounded "edit" is a concept_change wearing a smaller name'));
      }
      if (revision.preserve_visual_identity !== true) {
        out.push(issue(CODES.APPROVAL_FLAGS_INCONSISTENT, where,
          'local_edit is a bounded correction inside the approved identity: preserve_visual_identity must remain true'));
      }
    }
    if (intent === 'concept_change' && revision.preserve_visual_identity !== false) {
      out.push(issue(CODES.APPROVAL_FLAGS_INCONSISTENT, where,
        'concept_change deliberately replaces the approved visual identity: preserve_visual_identity must be false, so the record never claims a preserved identity it is about to discard'));
    }
  }

  return out;
}

/** Validate a compiled visual job. Returns an array of issues; empty means PASS. */
export function validateVisualJob(job, { schema = loadSchema(), profiles = loadArtifactProfiles(), brand } = {}) {
  const issues = [];
  const where = job?.job_id ?? '<job>';

  for (const e of validate(job, schema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }
  if (issues.some((i) => i.code === CODES.SCHEMA)) return issues; // structurally unsound; cross-field checks would be noise

  // Resolve the brand actually named on this job — never a fixed default
  // (B6). An unresolvable brand fails closed and short-circuits the rest of
  // the brand-dependent checks below, the same way a schema failure does.
  let resolvedBrand = brand;
  if (resolvedBrand === undefined) {
    try {
      resolvedBrand = resolveBrandProfile(job.brand_profile, job.brand_profile_version);
    } catch (err) {
      issues.push(issue(CODES.UNKNOWN_BRAND, where, err.message));
      return issues;
    }
  }

  if (!job.article_ref && !job.package_ref) {
    issues.push(issue(CODES.MISSING_REF, where, 'a visual job must carry exactly one of article_ref or package_ref'));
  }

  const profile = profiles[job.artifact_profile];
  if (!profile) {
    issues.push(issue(CODES.UNKNOWN_PROFILE, where, `"${job.artifact_profile}" is not a known artifact profile`));
  } else {
    const expectedRef = `editorial/profiles/artifact/visual-${job.artifact_profile.split('/')[1]}.json`;
    if (job.profile_ref !== expectedRef) {
      issues.push(issue(CODES.PROFILE_REF_MISMATCH, where, `profile_ref "${job.profile_ref}" does not match "${expectedRef}"`));
    }

    const dc = job.density_check;
    if (dc.profile_semantic_density !== profile.semantic_density.level) {
      issues.push(issue(CODES.DENSITY_DRIFT, where,
        `density_check.profile_semantic_density "${dc.profile_semantic_density}" does not match the artifact profile's actual semantic_density.level "${profile.semantic_density.level}"`));
    }
    if (dc.profile_visual_density !== profile.visual_density.level) {
      issues.push(issue(CODES.DENSITY_DRIFT, where,
        `density_check.profile_visual_density "${dc.profile_visual_density}" does not match the artifact profile's actual visual_density.level "${profile.visual_density.level}"`));
    }
    const shouldMatch = dc.compiled_semantic_density === dc.profile_semantic_density &&
      dc.compiled_visual_density === dc.profile_visual_density;
    if (dc.match !== shouldMatch) {
      issues.push(issue(CODES.DENSITY_MISMATCH, where,
        `density_check.match is ${dc.match} but compiled densities (${dc.compiled_semantic_density}/${dc.compiled_visual_density}) vs profile (${dc.profile_semantic_density}/${dc.profile_visual_density}) imply ${shouldMatch}`));
    }
    if (!shouldMatch) {
      issues.push(issue(CODES.DENSITY_MISMATCH, where,
        `compiled density does not match the "${job.artifact_profile}" profile — a body infographic compiled at thumbnail density (or the reverse) fails regardless of render quality`));
    }
  }

  const rt = job.information_gain?.redundancy_test;
  if (rt && job.information_gain?.verdict === 'proceed' &&
      (rt.q3_merely_recreates === true || rt.q4_worth_the_interruption === false)) {
    issues.push(issue(CODES.INCONSISTENT_GAIN_VERDICT, where,
      'redundancy_test says the visual merely recreates the adjacent representation (q3) or is not worth the interruption (q4), but the verdict is "proceed" — editorial/VISUAL-INFORMATION-GAIN.md §2 requires skip/replace/reposition in this case, a visual that restates adjacent prose is not approved by being accurate'));
  }

  if (job.artifact_profile === 'visual/evidence-visual' && job.renderer_route === 'generative') {
    issues.push(issue(CODES.EVIDENCE_GENERATIVE, where,
      'visual/evidence-visual must never route to a generative-only renderer; exact values/axes/citations must stay deterministic'));
  }

  if ((job.selected_reference_traits?.authoritative_override ?? []).length === 0) {
    const adoptedColor = (job.selected_reference_traits?.adopt ?? []).some((t) => /colou?r|palette|hue/i.test(t));
    if (adoptedColor) {
      issues.push(issue(CODES.BRAND_OVERRIDE_UNAUTHORIZED, where,
        'a colour/palette trait is adopted from a reference without an explicit authoritative_override — the brand profile must not be silently outranked'));
    }
  }

  if (job.brand_profile === resolvedBrand?.brand && job.brand_profile_version !== resolvedBrand?.profile_version) {
    issues.push(issue(CODES.BRAND_VERSION_MISMATCH, where,
      `job compiled against brand_profile_version "${job.brand_profile_version}" but the resolved profile is "${resolvedBrand?.profile_version}" — record which version was actually used, not silently the latest`));
  }

  if (job.attempts > job.max_attempts) {
    issues.push(issue(CODES.ATTEMPTS_EXCEEDED, where, `attempts (${job.attempts}) exceeds max_attempts (${job.max_attempts})`));
  }

  if (!(job.context_isolation?.excluded ?? []).includes('renderer_runtime_identity')) {
    issues.push(issue(CODES.RUNTIME_NOT_EXCLUDED, where,
      'context_isolation.excluded must declare "renderer_runtime_identity" — provider/model/model_version/quality_tier are lineage, never a compiled-prompt input'));
  }

  issues.push(...approvalLockIssues(job, where));

  if (job.information_gain?.verdict === 'skip') {
    if (job.compiled_prompt !== undefined || (job.compiled_from ?? []).length > 0) {
      issues.push(issue(CODES.SKIP_NOT_CLEAN, where,
        'information_gain.verdict is "skip" but a compiled_prompt/compiled_from was still produced — skip must short-circuit before compilation'));
    }
    if (job.status !== 'gated_skip') {
      issues.push(issue(CODES.SKIP_NOT_CLEAN, where, `a skip verdict should carry status "gated_skip", got "${job.status}"`));
    }
  } else if (job.compiled_prompt !== undefined) {
    if (!(job.compiled_from?.length > 0)) {
      issues.push(issue(CODES.CONTEXT_LEAK, where, 'compiled_prompt is present without compiled_from lineage'));
    }
    const vocabulary = permittedVocabulary(job, { profiles, brand: resolvedBrand });
    const promptTokens = tokenize(job.compiled_prompt);
    const leaked = promptTokens.filter((t) => !vocabulary.has(t));
    if (leaked.length > 0) {
      issues.push(issue(CODES.CONTEXT_LEAK, where,
        `compiled_prompt contains token(s) not derivable from any declared input: ${[...new Set(leaked)].slice(0, 8).join(', ')}`));
    }

    // Runtime identity is lineage, not an input: the provider/model identity
    // string must never appear verbatim in the compiled prompt. Checked as
    // whole-string containment, not a per-token check, so an incidental
    // single-word overlap (e.g. "chart" appearing both in a model id and in
    // ordinary compositional language) is not a false positive. model_version
    // and quality_tier are deliberately excluded from this containment check:
    // version numbers routinely collide with the legitimate brand_profile
    // version string that IS a permitted input (e.g. "1.0.0"); that ambiguity
    // is exactly why model_version belongs in lineage rather than prose.
    const runtime = job.renderer ?? {};
    const promptLower = job.compiled_prompt.toLowerCase();
    const contaminated = [runtime.provider, runtime.model]
      .filter((v) => typeof v === 'string' && v.length >= 4)
      .filter((v) => promptLower.includes(v.toLowerCase()));
    if (contaminated.length > 0) {
      issues.push(issue(CODES.RUNTIME_LEAK, where,
        `compiled_prompt contains renderer runtime identity string(s): ${contaminated.join(', ')} — provider/model/model_version/quality_tier must stay in lineage, never in the prompt`));
    }
  }

  return issues;
}

export function validateVisualJobFile(path, options = {}) {
  let job;
  try {
    job = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable job: ${err.message}`)];
  }
  return validateVisualJob(job, options);
}

/**
 * Deterministic, model-free prompt assembly from declared inputs only.
 * No network call, no LLM call — pure string composition.
 */
export function compileVisualPrompt(job, { profiles = loadArtifactProfiles(), brand } = {}) {
  // The approval lock is enforced here as well as in the validator: a sealed
  // job must not be able to obtain a fresh generation prompt by calling the
  // compiler directly and validating afterwards.
  //
  // The seal alone is not enough for that promise. It answers "is this locked
  // and unauthorized", so a record that launders the lock instead of tripping
  // it — `state: candidate` beside a full master identity, or a reopening
  // intent whose identity flags contradict it — was still compiling here and
  // only failing later at validation. Any unresolved approval-lock finding
  // refuses compilation, so the two enforcement points cannot disagree.
  const lockIssues = approvalLockIssues(job);
  if (isRegenerationSealed(job) || lockIssues.length > 0) {
    throw new RegenerationSealedError(job, lockIssues);
  }

  if (job.information_gain?.verdict === 'skip') {
    return { compiled_prompt: undefined, compiled_from: [] };
  }

  const profile = profiles[job.artifact_profile];
  if (!profile) throw new Error(`unknown artifact profile: ${job.artifact_profile}`);

  // Resolve the brand this job actually names — never a fixed default (B6).
  // An unresolvable brand throws here rather than silently compiling against
  // suengj.com's tokens under a different brand's name.
  const resolvedBrand = brand ?? resolveBrandProfile(job.brand_profile, job.brand_profile_version);

  const spec = job.semantic_spec ?? {};
  const refs = job.selected_reference_traits ?? { adopt: [], avoid: [], do_not_copy: [] };
  const audienceNote = profile.audience_adaptation?.[job.audience?.value];

  const lines = [
    `ARTIFACT: ${profile.family} — ${profile.primary_job}`,
    spec.question ? `QUESTION: ${spec.question}` : null,
    `MUST COMMUNICATE: ${(spec.must_communicate ?? []).join('; ')}`,
    spec.must_not_include?.length ? `MUST NOT INCLUDE: ${spec.must_not_include.join('; ')}` : null,
    `COMPOSITION: ${profile.composition?.dominant_structure ?? ''}`,
    audienceNote ? `AUDIENCE (${job.audience.value}): ${audienceNote}` : null,
    `TEXT POLICY: ${job.text_policy}`,
    `BRAND (${resolvedBrand.brand}@${resolvedBrand.profile_version}): background ${resolvedBrand.palette?.background?.family}, primary ${resolvedBrand.palette?.primary_structure?.family}, accent ${resolvedBrand.palette?.accent?.family}`,
    refs.adopt?.length ? `REFERENCE TRAITS — adopt: ${refs.adopt.join('; ')}` : null,
    refs.avoid?.length ? `REFERENCE TRAITS — avoid: ${refs.avoid.join('; ')}` : null,
    refs.do_not_copy?.length ? `REFERENCE TRAITS — do not copy: ${refs.do_not_copy.join('; ')}` : null,
  ].filter(Boolean);

  // compiled_from records the brand actually loaded (resolvedBrand.brand /
  // .profile_version), never job.brand_profile verbatim — the two agree
  // whenever resolution succeeded, but only the file actually read is a
  // truthful lineage entry (B6).
  const compiled_from = [
    job.profile_ref,
    `${resolvedBrand.brand}@${resolvedBrand.profile_version}`,
    job.audience?.profile_ref,
    'semantic_spec',
    'selected_reference_traits',
  ].filter(Boolean);

  return { compiled_prompt: lines.join('\n'), compiled_from };
}
