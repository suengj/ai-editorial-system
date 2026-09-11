/**
 * Visual job engine — AES-V2.7 (SUE-565).
 *
 * Validates a compiled visual job against schemas/visual-job.schema.json plus
 * the cross-field gates a schema cannot express: density/profile match,
 * renderer route vs evidence, context isolation, and attempts budget. Also
 * performs the deterministic, model-free prompt compilation described in
 * schemas/VISUAL-JOB-CONTRACT.md.
 */

import { existsSync, readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { assessVisualReferenceAdmissibility, listEvaluationFiles, loadCatalogEntries, loadCatalogRefIds } from './registry-core.mjs';
import { classifyArtifact } from './lineage.mjs';
import { validateMobileLegibility, validateObservedTextAgainstJob } from './visual-review-invariants.mjs';
import {
  AUTHORITY_CODES,
  VisualSemanticAuthorityError,
  assertPromptCoverage,
  authoritySchemaAtMount,
  collectClassifiedRenderedText,
  createPromptInputReader,
  decisionGatedProjection,
  protectedProjection,
  repairEnvelopeProjection,
  requireCommittedVisualSemanticAuthority,
  requireVisualSemanticAuthority,
  sameCanonicalProjection,
} from './visual-semantic-authority-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export const VISUAL_JOB_SCHEMA = resolve(ROOT, 'schemas/visual-job.schema.json');
export const VISUAL_BRIEF_SCHEMA = resolve(ROOT, 'schemas/visual-brief.schema.json');
export const RENDER_SPEC_SCHEMA = resolve(ROOT, 'schemas/render-spec.schema.json');
export const VISUAL_PRODUCTION_SCHEMA = resolve(ROOT, 'schemas/visual-production.schema.json');
export const VISUAL_REVIEW_SCHEMA = resolve(ROOT, 'schemas/visual-review.schema.json');
export const ARTIFACT_PROFILE_DIR = resolve(ROOT, 'editorial/profiles/artifact');
export const BRAND_PROFILE_DIR = resolve(ROOT, 'editorial/profiles/brand');
export const ARTICLE_CLAIMS_DIR = resolve(ROOT, 'references/article-claims');

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

function loadAuthoritativeClaimIds(articleRef) {
  const matches = [];
  try {
    for (const file of readdirSync(ARTICLE_CLAIMS_DIR)) {
      if (!file.endsWith('.json')) continue;
      let artifact;
      try { artifact = readJSON(resolve(ARTICLE_CLAIMS_DIR, file)); } catch { continue; }
      const ref = artifact?.article_ref;
      if (artifact?.authority !== 'repository_article_claims' ||
          ref?.article_id !== articleRef?.article_id ||
          ref?.version_number !== articleRef?.version_number ||
          ref?.content_hash !== articleRef?.content_hash ||
          ref?.claims_hash !== articleRef?.claims_hash ||
          !Array.isArray(artifact.claim_ids) || artifact.claim_ids.length === 0) continue;
      matches.push(new Set(artifact.claim_ids));
    }
  } catch { return null; }
  if (matches.length !== 1) return null;
  return matches[0];
}

export const loadSchema = (p = VISUAL_JOB_SCHEMA) => readJSON(p);
export const loadVisualBriefSchema = (p = VISUAL_BRIEF_SCHEMA) => readJSON(p);
export const loadRenderSpecSchema = (p = RENDER_SPEC_SCHEMA) => readJSON(p);
export const loadVisualProductionSchema = (p = VISUAL_PRODUCTION_SCHEMA) => readJSON(p);

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
  APPROVAL_IDENTITY_MISMATCH: 'approval-lock-identity-mismatch',
  BRIEF_REQUIRED: 'visual-brief-and-render-spec-required',
  BRIEF_SPEC_MISMATCH: 'brief-render-spec-mismatch',
  REFERENCE_AUTHORITY_UNRESOLVED: 'reference-authority-unresolved',
  REFERENCE_AUTHORITY_COUNT: 'reference-authority-count',
  REFERENCE_IS_FACTUAL_SOURCE: 'reference-is-factual-source',
  EXACT_FACT_ON_GENERATIVE_LAYER: 'exact-fact-on-generative-layer',
  ARTICLE_TITLE_IN_ARTWORK: 'article-title-in-artwork',
  UI_MIMICRY_CONTRACT_MISSING: 'ui-mimicry-contract-missing',
  BRAND_DEPTH_OVERRIDE_UNBACKED: 'brand-depth-override-unbacked',
  BRAND_MATERIALITY_CEILING_VIOLATION: 'brand-materiality-ceiling-violation',
  REFERENCE_AUTHORITY_INADMISSIBLE: 'reference-authority-inadmissible',
  REFERENCE_AUTHORITY_TRAIT_UNEVIDENCED: 'reference-authority-trait-unevidenced',
  REFERENCE_AUTHORITY_TRAIT_IRRELEVANT: 'reference-authority-trait-irrelevant-to-brief',
  REFERENCE_AUTHORITY_NOT_AUTHORITY_UNEVIDENCED: 'reference-not-authority-unevidenced',
  REFERENCE_AUTHORITY_TRAIT_REQUIRED: 'reference-authority-trait-required',
  BRIEF_REFERENCE_DIMENSIONS_REQUIRED: 'visual-brief-required-dimensions-empty',
  REQUIRES_OWNER_GATE_MISMATCH: 'requires-owner-gate-conflict-mismatch',
  TEXT_OWNERSHIP_MISMATCH: 'visual-text-ownership-mismatch',
  ARTICLE_TITLE_OWNERSHIP: 'article-title-must-be-external-overlay',
  TEXT_OWNERSHIP_CLASS_INVALID: 'visual-text-ownership-class-invalid',
  VERIFIED_FACT_PAYLOAD: 'verified-generative-fact-payload-invalid',
  VERIFIED_FACT_SOURCE: 'verified-generative-fact-source-lineage-invalid',
  VERIFIED_FACT_POST_RENDER: 'verified-generative-fact-post-render-required',
  VERIFIED_FACT_TERMINAL_REVIEW: 'verified-generative-fact-terminal-review-required',
  VERIFIED_FACT_LINEAGE: 'verified-generative-fact-lineage-unresolvable',
  VERIFIED_FACT_CLAIM_SET: 'verified-generative-fact-claim-set-invalid',
  VERIFIED_FACT_CLAIM: 'verified-generative-fact-claim-unresolvable',
  FACT_INJECTION: 'factual-invariant-undeclared-in-prompt-surface',
  HIERARCHY_MISMATCH: 'visual-information-hierarchy-mismatch',
  HIERARCHY_REFERENCE_REQUIRED: 'visual-information-hierarchy-reference-required',
  PUBLICATION_SURFACE_REQUIRED: 'visual-publication-display-surface-required',
  PUBLICATION_SURFACE_INVALID: 'visual-publication-display-surface-invalid',
  PRODUCTION_SCHEMA: 'visual-production-schema',
  PRODUCTION_LINEAGE: 'visual-production-lineage-incomplete',
  PRODUCTION_RUNTIME_LINEAGE: 'visual-production-runtime-lineage-mismatch',
  OVERLAY_PAYLOAD: 'factual-overlay-payload-hash-mismatch',
  OVERLAY_FACTS: 'factual-overlay-invariants-not-mechanically-covered',
  OVERLAY_ARTICLE_MISMATCH: 'factual-overlay-article-mismatch',
  FACTUAL_REPAIR: 'factual-repair-changed-semantic-master',
  FACTUAL_REPAIR_PREDECESSOR: 'factual-repair-predecessor-unresolvable',
  FACTUAL_REPAIR_PREDECESSOR_OUTSIDE: 'factual-repair-predecessor-outside-repository',
  FACTUAL_REPAIR_PREDECESSOR_NOT_REGULAR: 'factual-repair-predecessor-not-regular-file',
  FACTUAL_REPAIR_CYCLE: 'factual-repair-predecessor-cycle',
  FACTUAL_REPAIR_DEPTH: 'factual-repair-predecessor-depth-exceeded',
  FACTUAL_REPAIR_REVIEW: 'factual-repair-review-invalid',
  FACTUAL_REPAIR_ITEM: 'factual-repair-item-decision-invalid',
  DIRECTION_DISCOVERY: 'direction-discovery-invalid',
  DIRECTION_REFERENCE: 'direction-reference-not-selected-authority',
  REFINEMENT: 'production-refinement-invalid',
  FAILURE_ROUTE: 'visual-failure-route-mismatch',
  TELEMETRY: 'visual-production-telemetry-invalid',
  VERSION_FIELD_MISMATCH: 'visual-schema-version-field-mismatch',
  COMPILED_OUTPUT_MISMATCH: 'compiled-output-lineage-mismatch',
  VISUAL_SEMANTIC_AUTHORITY_REGISTRY_INVALID: AUTHORITY_CODES.REGISTRY_INVALID,
  VISUAL_SEMANTIC_AUTHORITY_UNCLASSIFIED_FIELD: AUTHORITY_CODES.UNCLASSIFIED_FIELD,
  VISUAL_SEMANTIC_AUTHORITY_ORPHANED_FIELD: AUTHORITY_CODES.ORPHANED_FIELD,
  VISUAL_SEMANTIC_AUTHORITY_SHAPE_MISMATCH: AUTHORITY_CODES.SHAPE_MISMATCH,
  VISUAL_SEMANTIC_AUTHORITY_PROMPT_UNCONSUMED: AUTHORITY_CODES.PROMPT_UNCONSUMED,
});

export const SUPPORTED_PROMPT_ADAPTERS = Object.freeze(['generic-v1', 'generic-v2']);
export const VISUAL_JOB_V1_1_FIELDS = Object.freeze([
  'visual_brief', 'render_spec', 'compiled_prompt_adapter',
  'brand_conflicts', 'requires_owner_gate', 'article_title',
]);
export const VISUAL_JOB_V1_2_FIELDS = Object.freeze(['visual_production', 'post_render_review']);

export const VISUAL_FAILURE_ACTIONS = Object.freeze({
  wrong_concept: 'new_direction', local_defect: 'local_edit', low_fidelity: 'fidelity_derivative',
  facts_or_text_wrong: 'factual_overlay_repair', reference_drift: 'recompile_reference_authority',
  dashboardization: 'reroute_composition_renderer', human_likes_candidate: 'human_approval_required',
});
export function expectedVisualFailureAction(failureClass) { return VISUAL_FAILURE_ACTIONS[failureClass]; }
export function createVisualFailureRoute(failureClass) { return { failure_class: failureClass, next_action: expectedVisualFailureAction(failureClass) }; }
// Provider/runtime identity is deliberately absent from these durable classes.
// `no_text` is an empty semantic surface; the three ownership classes describe
// who owns meaningful text when one exists.
export const VISUAL_TEXT_OWNERSHIP_CLASSES = Object.freeze([
  'generative_structural_text', 'verified_generative_fact', 'deterministic_external_text',
]);
export function canonicalPayloadSha256(payload) {
  const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v);
  return `sha256:${createHash('sha256').update(canonical(payload)).digest('hex')}`;
}

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
  'approved_by', 'approved_at', 'approval_context', 'approval_binding',
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
  'brief', 'editorial', 'story', 'scene', 'device', 'devices', 'forbidden',
  'layer', 'layers', 'factual', 'deterministic', 'generative', 'safe', 'zone',
  'crop', 'reading', 'direction', 'external', 'overlay', 'adapter',
  'require', 'forbid', 'controls',
  'route',
  'wide',
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
  const brief = job.visual_brief ?? {};
  const renderSpec = job.render_spec ?? {};
  parts.push(JSON.stringify(brief), JSON.stringify(renderSpec));
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

  // Free-text approval_context is retained for human context, but authority is
  // bound by structured identity. classifyArtifact owns the established
  // fresh/cosmetic/material/unknown semantics; exact approval additionally
  // requires the same article id/version and the same master ref/digest.
  const binding = asset.approval_binding;
  if (!binding) {
    out.push(issue(CODES.APPROVAL_IDENTITY_MISMATCH, where,
      'human_approved_locked requires approval_binding for the exact article revision and master ref/digest it approved'));
  } else {
    const currentArticle = job.article_ref ? {
      article_id: job.article_ref.article_id,
      version: {
        number: job.article_ref.version_number,
        content_hash: job.article_ref.content_hash,
        claims_hash: job.article_ref.claims_hash,
      },
    } : null;
    const classification = classifyArtifact({ article_ref: binding.article_ref }, currentArticle);
    const exactArticle = binding.article_ref?.article_id === job.article_ref?.article_id &&
      binding.article_ref?.version_number === job.article_ref?.version_number &&
      classification.level === 'fresh';
    const exactMaster = binding.master_ref === asset.master_ref && binding.master_digest === asset.master_digest;
    if (!exactArticle || !exactMaster) {
      out.push(issue(CODES.APPROVAL_IDENTITY_MISMATCH, where,
        `approval_binding does not match the current article/master identity (classifyArtifact=${classification.level}, article_id/version exact=${exactArticle}, master ref/digest exact=${exactMaster}); stale approval is never inherited`));
    }
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

function evaluationById() {
  const out = new Map();
  for (const path of listEvaluationFiles()) {
    try {
      const data = readJSON(path);
      if (data.evaluation_id) out.set(data.evaluation_id, data);
    } catch { /* registry validation owns parse reporting */ }
  }
  return out;
}

export function validateVisualBrief(brief, where = '<visual_brief>', schema = loadVisualBriefSchema()) {
  const issues = [];
  for (const e of validate(brief, schema)) issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  return issues;
}

export function validateRenderSpec(renderSpec, where = '<render_spec>', schema = loadRenderSpecSchema()) {
  const issues = [];
  for (const e of validate(renderSpec, schema)) issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  return issues;
}

export function validateReferenceAuthority(renderSpec, requirements, where = '<render_spec>', {
  catalogRefIds = loadCatalogRefIds(),
  catalogEntries = loadCatalogEntries(),
  evaluations = evaluationById(),
} = {}) {
  const selected = renderSpec?.reference_authority?.selected ?? [];
  const issues = [];
  if (selected.length < 1 || selected.length > 3) {
    issues.push(issue(CODES.REFERENCE_AUTHORITY_COUNT, where, 'reference_authority.selected must contain 1-3 references'));
    return issues;
  }
  for (const entry of selected) {
    const evaluation = evaluations.get(entry.evaluation_id);
    if (!evaluation || evaluation.ref_id !== entry.ref_id) {
      issues.push(issue(CODES.REFERENCE_AUTHORITY_UNRESOLVED, where, `reference ${entry?.ref_id}/${entry?.evaluation_id} is not reachable through references/catalog.json plus references/evaluations/`));
      continue;
    }
    const admitted = assessVisualReferenceAdmissibility(evaluation, requirements, { catalogRefIds, catalogEntries });
    if (!admitted.admissible) {
      issues.push(issue(CODES.REFERENCE_AUTHORITY_INADMISSIBLE, where, `${entry.evaluation_id} fails resolver admissibility: ${admitted.reason}`));
      continue;
    }
    const adopted = new Set((evaluation.dimensions ?? []).filter((d) => d.verdict === 'adopt').map((d) => d.dimension));
    if ((entry.authority ?? []).length === 0) {
      issues.push(issue(CODES.REFERENCE_AUTHORITY_TRAIT_REQUIRED, where, `${entry.evaluation_id} must name at least one authority trait`));
    }
    if ((entry.authority ?? []).some((trait) => !adopted.has(trait))) {
      issues.push(issue(CODES.REFERENCE_AUTHORITY_TRAIT_UNEVIDENCED, where, `${entry.evaluation_id} does not adopt every claimed authority trait`));
    }
    const notCopied = new Set((evaluation.dimensions ?? []).filter((d) => d.verdict === 'do_not_copy').map((d) => d.dimension));
    if ((entry.not_authority ?? []).some((trait) => !notCopied.has(trait))) {
      issues.push(issue(CODES.REFERENCE_AUTHORITY_NOT_AUTHORITY_UNEVIDENCED, where, `${entry.evaluation_id} does not mark every not_authority trait as that evaluation's do_not_copy dimension`));
    }
    const matched = new Set(admitted.matched.map((dimension) => dimension.dimension));
    if ((entry.authority ?? []).some((trait) => !matched.has(trait))) {
      issues.push(issue(CODES.REFERENCE_AUTHORITY_TRAIT_IRRELEVANT, where, `${entry.evaluation_id} claims authority outside the dimensions matched to this VisualBrief`));
    }
    if (/\b(source|fact|citation|verified claim)\b/i.test(`${entry.rationale ?? ''} ${(entry.authority ?? []).join(' ')}`)) {
      issues.push(issue(CODES.REFERENCE_IS_FACTUAL_SOURCE, where, `${entry.evaluation_id} is craft evidence only and may not be made a factual Source`));
    }
  }
  return issues;
}

function validateBrandDepthOverride(job, brand, where) {
  const brandDepthModel = normalise(brand.line_and_materiality?.depth_model);
  const allowed = brandDepthModel.includes('flat') ? ['flat_2d', 'layered_2d'] : [];
  if (allowed.includes(job.render_spec.spatial_treatment)) return [];
  const authority = job.render_spec.reference_authority.selected.flatMap((r) => r.authority ?? []);
  const backed = authority.includes(job.render_spec.spatial_treatment);
  const conflicts = job.brand_conflicts ?? [];
  const recorded = conflicts.some((c) => c.brand_field === 'line_and_materiality.depth_model' &&
    c.brand_profile_version === brand.profile_version && c.render_spec_requirement === job.render_spec.spatial_treatment &&
    c.reference_authority === job.render_spec.spatial_treatment && c.owner_review === 'pending_owner_review');
  return backed && recorded ? [] : [issue(CODES.BRAND_DEPTH_OVERRIDE_UNBACKED, where,
    'RenderSpec requests depth/spatial treatment beyond the brand depth_model without both an explicit selected reference authority trait and a human-visible brand_conflicts entry')];
}

function validateTextOwnershipAndHierarchy(job, where, validatedAuthority) {
  const issues = [];
  const brief = job.visual_brief;
  const spec = job.render_spec;
  const briefOwnership = brief?.text_ownership;
  const specOwnership = spec?.text_handling?.text_ownership;
  const renderedText = collectClassifiedRenderedText(job, validatedAuthority);
  const carriesRenderedText = renderedText.length > 0;
  const textBearing = Boolean(brief && spec && (job.text_policy !== 'no_text' || carriesRenderedText));
  if (job.text_policy === 'no_text' && carriesRenderedText) {
    issues.push(issue(CODES.TEXT_OWNERSHIP_MISMATCH, where,
      'text_policy no_text is contradicted by declared rendered text; no_text is valid only when every rendered-text surface is empty'));
  }
  if (textBearing && (!briefOwnership || !specOwnership)) {
    issues.push(issue(CODES.TEXT_OWNERSHIP_MISMATCH, where,
      'text-bearing visual jobs must declare matching VisualBrief and RenderSpec text_ownership; undeclared text has no compiler fallback'));
  }
  if (briefOwnership || specOwnership) {
    if (!briefOwnership || !specOwnership) {
      issues.push(issue(CODES.TEXT_OWNERSHIP_MISMATCH, where,
        'VisualBrief.text_ownership and RenderSpec.text_handling.text_ownership must be declared together'));
    } else if (!sameJSONValue(briefOwnership, specOwnership)) {
      issues.push(issue(CODES.TEXT_OWNERSHIP_MISMATCH, where,
        'VisualBrief and RenderSpec text ownership classes must agree exactly'));
    }
    if (briefOwnership?.article_title !== 'deterministic_external_text' || spec?.text_handling?.article_title !== 'external_overlay') {
      issues.push(issue(CODES.ARTICLE_TITLE_OWNERSHIP, where,
        'article title is external text: text_ownership.article_title must be deterministic_external_text and text_handling.article_title must remain external_overlay'));
    }
    const classes = ['generative_structural_text', 'verified_generative_fact', 'deterministic_external_text'];
    if (briefOwnership && classes.some((name) => !(name in briefOwnership))) {
      issues.push(issue(CODES.TEXT_OWNERSHIP_CLASS_INVALID, where,
        'text_ownership must explicitly represent generative_structural_text, verified_generative_fact, and deterministic_external_text'));
    }
    const declaredClasses = new Set(renderedText.map((entry) => entry.ownership_class));
    if ([...declaredClasses].some((name) => !(name in (briefOwnership ?? {})) || !(name in (specOwnership ?? {})))) {
      issues.push(issue(CODES.TEXT_OWNERSHIP_MISMATCH, where,
        'every registry-classified rendered-text value must be represented by the matching VisualBrief and RenderSpec ownership class'));
    }
    const verified = briefOwnership?.verified_generative_fact;
    const canonical = verified?.canonical_payload;
    const verifiedItems = canonical?.items ?? [];
    if (verified) {
      if (!canonical || !canonical.payload_ref || !canonical.payload_sha256 || !Array.isArray(canonical.items)) {
        issues.push(issue(CODES.VERIFIED_FACT_PAYLOAD, where,
          'verified_generative_fact requires a canonical declared payload with payload_ref, payload_sha256, and items'));
      } else if (canonical.payload_sha256 !== canonicalPayloadSha256({ payload_ref: canonical.payload_ref, claim_set: verified.claim_set, items: canonical.items })) {
        issues.push(issue(CODES.VERIFIED_FACT_PAYLOAD, where,
          'verified_generative_fact canonical_payload.payload_sha256 does not match its declared payload'));
      }
      const sourceLineage = new Set(verified.source_lineage ?? []);
      const itemSources = new Set(verifiedItems.map((item) => item.source_ref));
      const articleId = job.article_ref?.article_id;
      const claimSet = verified.claim_set;
      const canonicalSource = (sourceRef) => parseArticleClaimSourceRef(sourceRef) !== null;
      const authoritativeClaimIds = loadAuthoritativeClaimIds(job.article_ref);
      const declaredClaimIds = Array.isArray(claimSet?.claim_ids) ? new Set(claimSet.claim_ids) : new Set();
      const claimSetMatchesAuthority = authoritativeClaimIds !== null && declaredClaimIds.size === authoritativeClaimIds.size && [...declaredClaimIds].every((claimId) => authoritativeClaimIds.has(claimId));
      if (!claimSet || claimSet.article_id !== articleId || claimSet.claims_hash !== job.article_ref?.claims_hash || !Array.isArray(claimSet.claim_ids) || claimSet.claim_ids.length === 0 || new Set(claimSet.claim_ids).size !== claimSet.claim_ids.length || !claimSetMatchesAuthority) {
        issues.push(issue(CODES.VERIFIED_FACT_CLAIM_SET, where,
          'verified generative fact claim_set must exactly match the repository-authoritative article claims artifact bound to the job article/version/content/claims hashes'));
      }
      if (sourceLineage.size === 0 || sourceLineage.size !== itemSources.size ||
          verifiedItems.some((item) => !sourceLineage.has(item.source_ref)) ||
          [...sourceLineage].some((sourceRef) => !itemSources.has(sourceRef))) {
        issues.push(issue(CODES.VERIFIED_FACT_SOURCE, where,
          'verified generative fact source_lineage must exactly cover canonical item source_ref values'));
      }
      if ([...sourceLineage].some((sourceRef) => !canonicalSource(sourceRef))) {
        issues.push(issue(CODES.VERIFIED_FACT_LINEAGE, where,
          'verified generative fact lineage must resolve through article-claim:<job article_id>:<claim_id>'));
      }
      if (verified.post_render_verification?.required !== true || verified.post_render_verification?.review_dimension !== 'factual' || verified.post_render_verification?.asset_digest_bound !== true) {
        issues.push(issue(CODES.VERIFIED_FACT_POST_RENDER, where,
          'verified_generative_fact requires mandatory asset-digest-bound post-render factual verification'));
      }
      for (const item of verifiedItems) {
        const sourceClaim = parseArticleClaimSourceRef(item.source_ref);
        const sourceArticleId = sourceClaim?.article_id ?? articleIdFromSourceRef(item.source_ref);
        if (articleId && sourceArticleId && sourceArticleId !== articleId) {
          issues.push(issue(CODES.VERIFIED_FACT_SOURCE, where,
            `verified generative fact source_ref names article "${sourceArticleId}", expected job article "${articleId}"`));
        }
        if (!sourceClaim || sourceClaim.article_id !== claimSet?.article_id || !claimSet?.claim_ids?.includes(sourceClaim.claim_id) || !authoritativeClaimIds?.has(sourceClaim.claim_id)) {
          issues.push(issue(CODES.VERIFIED_FACT_CLAIM, where,
            `verified generative fact source_ref claim must resolve to a declared claim on ${claimSet?.article_id ?? articleId ?? '<article>'}`));
        }
      }
    }

    const external = briefOwnership?.deterministic_external_text;
    const externalItems = external?.items ?? [];
    const declaredVerifiedFacts = new Set(verifiedItems.map((item) => item.exact_text));
    const declaredExternalText = new Set(externalItems.map((item) => item.exact_text));
    const declaredFacts = new Set([...declaredVerifiedFacts, ...declaredExternalText]);
    const factual = brief.factual_invariants ?? [];
    if (factual.some((fact) => !declaredVerifiedFacts.has(fact))) {
      issues.push(issue(CODES.FACT_INJECTION, where,
        'every exact factual invariant must be declared by the source-bound verified_generative_fact canonical payload; deterministic_external_text is reserved for citations, dense text, and sensitive text'));
    }
    const deterministicLayer = spec.spatial_layers?.deterministic_factual ?? [];
    if (deterministicLayer.some((item) => !declaredFacts.has(item))) {
      issues.push(issue(CODES.FACT_INJECTION, where,
        'RenderSpec deterministic_factual entries must resolve to declared source-bound text items when text ownership is explicit'));
    }
    const legacyOverlay = spec.text_handling?.deterministic_overlay ?? [];
    if (legacyOverlay.some((item) => !declaredFacts.has(item))) {
      issues.push(issue(CODES.FACT_INJECTION, where,
        'legacy deterministic_overlay entries must resolve to declared source-bound text items when V2.17 ownership is explicit'));
    }
    const untrusted = [
      brief.editorial_purpose, brief.article_thesis, brief.reader_outcome,
      brief.visual_story?.primary_question, brief.visual_story?.metaphor_or_relationship,
      spec.scene_structure, spec.focal_hierarchy, spec.reading_direction,
      spec.safe_zones, spec.crop_resilience, spec.visual_devices, spec.forbidden_visual_devices,
      spec.spatial_layers?.generative_semantic,
      brief.information_hierarchy?.primary, ...(brief.information_hierarchy?.supporting ?? []), ...(brief.information_hierarchy?.detail ?? []),
      spec.information_hierarchy?.primary, ...(spec.information_hierarchy?.supporting ?? []), ...(spec.information_hierarchy?.detail ?? []),
      ...(briefOwnership?.generative_structural_text?.items ?? []),
      ...spec.reference_authority.selected.flatMap((entry) => [entry.rationale, ...(entry.authority ?? []), ...(entry.not_authority ?? [])]),
    ].flat(Infinity).filter((value) => typeof value === 'string');
    const untrustedNormalised = untrusted.map((value) => normalise(value)).filter(Boolean);
    if (factual.some((fact) => {
      const needle = normalise(fact);
      return needle && untrustedNormalised.some((surface) => surface.includes(needle));
    })) {
      issues.push(issue(CODES.FACT_INJECTION, where,
        'exact factual invariants may not enter hierarchy or generated prompt surfaces as arbitrary strings, case variants, or larger phrases; use the declared source-bound fact route'));
    }
  }

  const briefHierarchy = brief?.information_hierarchy;
  const specHierarchy = spec?.information_hierarchy;
  if (briefHierarchy || specHierarchy) {
    if (!briefHierarchy || !specHierarchy) {
      issues.push(issue(CODES.HIERARCHY_MISMATCH, where,
        'VisualBrief and RenderSpec must carry the same integrated information_hierarchy'));
    } else if (!sameJSONValue(briefHierarchy, specHierarchy)) {
      issues.push(issue(CODES.HIERARCHY_MISMATCH, where,
        'VisualBrief and RenderSpec information_hierarchy must agree exactly'));
    }
    const selected = spec?.reference_authority?.selected ?? [];
    if (!selected.some((entry) => (entry.authority ?? []).includes('hierarchy'))) {
      issues.push(issue(CODES.HIERARCHY_REFERENCE_REQUIRED, where,
        'integrated information_hierarchy requires a selected reference authority for hierarchy'));
    }
  }
  return issues;
}

function validatePublicationDisplaySurfaces(job, where) {
  const verified = job.visual_brief?.text_ownership?.verified_generative_fact;
  if (!verified) return [];
  const spec = job.render_spec;
  const surfaces = spec?.publication_display_surfaces;
  const anchors = spec?.crop_anchors;
  if (!surfaces || !surfaces.desktop || !surfaces.mobile || !Array.isArray(anchors) || anchors.length === 0) {
    return [issue(CODES.PUBLICATION_SURFACE_REQUIRED, where,
      'verified_generative_fact jobs require RenderSpec crop_anchors and authoritative desktop/mobile publication_display_surfaces')];
  }
  const desktop = surfaces.desktop;
  const mobile = surfaces.mobile;
  const declared = new Set(anchors);
  const issues = [];
  if (desktop.asset_scope !== 'full' || desktop.article_body_width_css_px !== 672 || desktop.viewport_width_css_px < 672) {
    issues.push(issue(CODES.PUBLICATION_SURFACE_INVALID, where,
      'RenderSpec desktop publication surface must declare full scope, exactly 672 CSS px article-body width, and a viewport at least that wide'));
  }
  if (desktop.surface_id === mobile.surface_id || mobile.asset_scope !== 'mobile' || mobile.derivative_of_asset_scope !== 'full' ||
      mobile.derivative_of_surface_id !== desktop.surface_id ||
      mobile.viewport_width_css_px >= desktop.article_body_width_css_px ||
      mobile.article_body_width_css_px > mobile.viewport_width_css_px ||
      !mobile.crop_anchors.every((anchor) => declared.has(anchor))) {
    issues.push(issue(CODES.PUBLICATION_SURFACE_INVALID, where,
      'RenderSpec mobile publication surface must be a narrower full-surface derivative whose crop anchors are declared semantic anchors'));
  }
  return issues;
}

function repositoryRegularFile(ref) {
  try {
    const path = resolve(ROOT, ref);
    if (!path.startsWith(`${ROOT}/`)) return null;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isFile()) return null;
    const real = realpathSync(path);
    return real.startsWith(`${ROOT}/`) ? real : null;
  } catch {
    return null;
  }
}

const digestFile = (path) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;

function validateVerifiedFactTerminalReview(job, where) {
  const verified = job.visual_brief?.text_ownership?.verified_generative_fact;
  if (!verified || !['qa_pass', 'accepted'].includes(job.status)) return [];
  const out = [];
  const link = job.post_render_review;
  if (!link) {
    return [issue(CODES.VERIFIED_FACT_TERMINAL_REVIEW, where,
      `verified_generative_fact job cannot enter status ${job.status} without an immutable post_render_review bound to real asset bytes`)];
  }
  const reviewPath = repositoryRegularFile(link.review_ref);
  if (!reviewPath || digestFile(reviewPath) !== link.review_sha256) {
    return [issue(CODES.VERIFIED_FACT_TERMINAL_REVIEW, where,
      'post_render_review.review_ref must resolve to repository-contained review bytes matching review_sha256')];
  }
  let review;
  try { review = readJSON(reviewPath); } catch {
    return [issue(CODES.VERIFIED_FACT_TERMINAL_REVIEW, where, 'post_render_review.review_ref is not parseable JSON')];
  }
  const schemaIssues = validate(review, readJSON(VISUAL_REVIEW_SCHEMA));
  if (schemaIssues.length > 0) {
    return [issue(CODES.VERIFIED_FACT_TERMINAL_REVIEW, where,
      `post-render review does not satisfy visual-review.schema.json: ${schemaIssues[0].path}: ${schemaIssues[0].message}`)];
  }
  const assetPath = repositoryRegularFile(link.asset_ref);
  const mobilePath = repositoryRegularFile(review.mobile_asset_ref);
  const binding = review.verified_fact_binding;
  const post = review.post_render_checks;
  const factual = post?.checks?.find((entry) => entry.check === 'factual');
  const allChecksPass = ['textual', 'factual', 'readability', 'mobile'].every((name) => {
    const check = post?.checks?.find((entry) => entry.check === name);
    const expectedDigest = name === 'mobile' ? review.mobile_asset_sha256 : review.asset_sha256;
    return check?.verdict === 'pass' && check.observed === true && check.asset_sha256 === expectedDigest;
  });
  const exact = review.review_id === link.review_id && review.asset_ref === link.asset_ref &&
    review.asset_sha256 === link.asset_sha256 && review.verdict === 'PASS_TO_HUMAN_REVIEW' &&
    review.final_authority === 'human' && review.review_scope === 'verified_generative_fact' &&
    binding?.job_id === job.job_id && binding?.render_spec_id === job.render_spec?.render_spec_id &&
    binding?.render_spec_sha256 === canonicalPayloadSha256(job.render_spec) &&
    binding?.payload_ref === verified.canonical_payload?.payload_ref &&
    binding?.payload_sha256 === verified.canonical_payload?.payload_sha256 &&
    binding?.asset_sha256 === review.asset_sha256 && factual?.asset_sha256 === review.asset_sha256 &&
    post?.asset_sha256 === review.asset_sha256 && post?.mobile_asset_sha256 === review.mobile_asset_sha256;
  const realAssets = assetPath && mobilePath && digestFile(assetPath) === link.asset_sha256 &&
    digestFile(mobilePath) === review.mobile_asset_sha256;
  const semanticIssues = [
    ...validateObservedTextAgainstJob(review, job),
    ...validateMobileLegibility(review),
  ];
  if (!exact || !realAssets || !allChecksPass || semanticIssues.length > 0) {
    out.push(issue(CODES.VERIFIED_FACT_TERMINAL_REVIEW, where,
      `terminal verified-fact review must match the job/payload/RenderSpec, bind real full/mobile asset bytes, and carry observed passing text/mobile checks${semanticIssues[0] ? `: ${semanticIssues[0].message}` : ''}`));
  }
  return out;
}

function normalise(value, { format = 'delete' } = {}) {
  // The two forms preserve or create word boundaries around invisible
  // separators without treating script resemblance as a security boundary.
  return String(value ?? '').normalize('NFKC').replace(/\p{M}/gu, '')
    .replace(/[\p{Cf}\u0000-\u001F\u007F-\u009F]/gu, format === 'space' ? ' ' : '')
    .trim().toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ');
}

function normalisations(value) {
  return [normalise(value), normalise(value, { format: 'space' })];
}

/**
 * The one prompt-bound text assembly. Validators inspect this exact provider
 * surface; provider adapters may reorder it but cannot introduce new inputs.
 */
function assemblePrompt(job, { profiles, brand, promptAdapter = 'generic-v1', validatedAuthority } = {}) {
  const reader = createPromptInputReader(job, validatedAuthority);
  const artifactProfile = reader.get('/artifact_profile');
  const audienceValue = reader.get('/audience/value');
  const textPolicy = reader.get('/text_policy');
  const brandProfile = reader.get('/brand_profile');
  const brandProfileVersion = reader.get('/brand_profile_version');
  const profile = profiles?.[artifactProfile] ?? {};
  const resolvedBrand = brand ?? resolveBrandProfile(brandProfile, brandProfileVersion);
  const spec = {
    question: reader.get('/semantic_spec/question'),
    must_communicate: reader.getArray('/semantic_spec/must_communicate') ?? [],
    must_not_include: reader.getArray('/semantic_spec/must_not_include') ?? [],
  };
  const refs = {
    adopt: reader.getArray('/selected_reference_traits/adopt') ?? [],
    avoid: reader.getArray('/selected_reference_traits/avoid') ?? [],
    do_not_copy: reader.getArray('/selected_reference_traits/do_not_copy') ?? [],
  };
  const audienceNote = profile.audience_adaptation?.[audienceValue];
  const brief = {
    editorial_purpose: reader.get('/visual_brief/editorial_purpose'),
    article_thesis: reader.get('/visual_brief/article_thesis'),
    reader_outcome: reader.get('/visual_brief/reader_outcome'),
    metaphor_or_relationship: reader.get('/visual_brief/visual_story/metaphor_or_relationship'),
    hierarchy: {
      primary: reader.get('/visual_brief/information_hierarchy/primary'),
      supporting: reader.getArray('/visual_brief/information_hierarchy/supporting'),
      detail: reader.getArray('/visual_brief/information_hierarchy/detail'),
    },
    forbidden_literal_copy: reader.getArray('/visual_brief/reference_requirements/forbidden_literal_copy'),
    generative_items: reader.getArray('/visual_brief/text_ownership/generative_structural_text/items'),
    verified_exact: reader.getArray('/visual_brief/text_ownership/verified_generative_fact/canonical_payload/items/*/exact_text'),
    verified_source: reader.getArray('/visual_brief/text_ownership/verified_generative_fact/canonical_payload/items/*/source_ref'),
    external_exact: reader.getArray('/visual_brief/text_ownership/deterministic_external_text/items/*/exact_text'),
    external_source: reader.getArray('/visual_brief/text_ownership/deterministic_external_text/items/*/source_ref'),
  };
  const renderSpec = {
    scene_structure: reader.get('/render_spec/scene_structure'),
    focal_hierarchy: reader.get('/render_spec/focal_hierarchy'),
    reading_direction: reader.get('/render_spec/reading_direction'),
    spatial_treatment: reader.get('/render_spec/spatial_treatment'),
    materiality_treatment: reader.get('/render_spec/materiality_treatment'),
    generative_semantic: reader.getArray('/render_spec/spatial_layers/generative_semantic'),
    deterministic_factual: reader.getArray('/render_spec/spatial_layers/deterministic_factual'),
    safe_zones: reader.getArray('/render_spec/safe_zones'),
    crop_resilience: reader.get('/render_spec/crop_resilience'),
    visual_devices: reader.getArray('/render_spec/visual_devices'),
    forbidden_visual_devices: reader.getArray('/render_spec/forbidden_visual_devices'),
    hierarchy: {
      primary: reader.get('/render_spec/information_hierarchy/primary'),
      supporting: reader.getArray('/render_spec/information_hierarchy/supporting'),
      detail: reader.getArray('/render_spec/information_hierarchy/detail'),
    },
    reference_authority: {
      ref_id: reader.getArray('/render_spec/reference_authority/selected/*/ref_id') ?? [],
      evaluation_id: reader.getArray('/render_spec/reference_authority/selected/*/evaluation_id') ?? [],
      authority: reader.getArray('/render_spec/reference_authority/selected/*/authority') ?? [],
      not_authority: reader.getArray('/render_spec/reference_authority/selected/*/not_authority') ?? [],
      rationale: reader.getArray('/render_spec/reference_authority/selected/*/rationale') ?? [],
    },
    generative_items: reader.getArray('/render_spec/text_handling/text_ownership/generative_structural_text/items'),
    verified_exact: reader.getArray('/render_spec/text_handling/text_ownership/verified_generative_fact/canonical_payload/items/*/exact_text'),
    verified_source: reader.getArray('/render_spec/text_handling/text_ownership/verified_generative_fact/canonical_payload/items/*/source_ref'),
    external_exact: reader.getArray('/render_spec/text_handling/text_ownership/deterministic_external_text/items/*/exact_text'),
    external_source: reader.getArray('/render_spec/text_handling/text_ownership/deterministic_external_text/items/*/source_ref'),
  };
  const selectedAuthority = renderSpec.reference_authority.evaluation_id.map((evaluation_id, index) => ({
    evaluation_id,
    authority: renderSpec.reference_authority.authority[index] ?? [],
    not_authority: renderSpec.reference_authority.not_authority[index] ?? [],
    rationale: renderSpec.reference_authority.rationale[index] ?? '',
  }));
  const declaredItems = brief.verified_exact === undefined && brief.external_exact === undefined ? null : {
    verified: (brief.verified_exact ?? []).map((exact_text, index) => ({ exact_text, source_ref: brief.verified_source?.[index] })),
    external: (brief.external_exact ?? []).map((exact_text, index) => ({ exact_text, source_ref: brief.external_source?.[index] })),
  };
  const v2 = brief.editorial_purpose !== undefined && renderSpec.scene_structure !== undefined;
  const hierarchy = brief.hierarchy.primary !== undefined
    ? brief.hierarchy
    : renderSpec.hierarchy.primary !== undefined ? renderSpec.hierarchy : null;
  const deterministicFacts = textPolicy === 'no_text'
    ? []
    : declaredItems
      ? declaredItems.verified.map((item) => item.exact_text)
      : renderSpec.deterministic_factual;
  const baseLines = [
    `ARTIFACT: ${profile.family ?? ''} — ${profile.primary_job ?? ''}`,
    spec.question ? `QUESTION: ${spec.question}` : null,
    `MUST COMMUNICATE: ${(spec.must_communicate ?? []).join('; ')}`,
    spec.must_not_include?.length ? `MUST NOT INCLUDE: ${spec.must_not_include.join('; ')}` : null,
    `COMPOSITION: ${profile.composition?.dominant_structure ?? ''}`,
    audienceNote ? `AUDIENCE (${audienceValue}): ${audienceNote}` : null,
    `TEXT POLICY: ${textPolicy}`,
    `BRAND (${resolvedBrand.brand}@${resolvedBrand.profile_version}): background ${resolvedBrand.palette?.background?.family}, primary ${resolvedBrand.palette?.primary_structure?.family}, accent ${resolvedBrand.palette?.accent?.family}`,
    refs.adopt?.length ? `REFERENCE TRAITS — adopt: ${refs.adopt.join('; ')}` : null,
    refs.avoid?.length ? `REFERENCE TRAITS — avoid: ${refs.avoid.join('; ')}` : null,
    refs.do_not_copy?.length ? `REFERENCE TRAITS — do not copy: ${refs.do_not_copy.join('; ')}` : null,
  ].filter(Boolean);
  const v2Lines = v2 ? [
    `EDITORIAL BRIEF: ${brief.editorial_purpose}; ${brief.article_thesis}; reader outcome: ${brief.reader_outcome}`,
    `VISUAL STORY: ${brief.metaphor_or_relationship}`,
    `SCENE: ${renderSpec.scene_structure}; focal hierarchy: ${renderSpec.focal_hierarchy}; reading: ${renderSpec.reading_direction}`,
    hierarchy ? `INFORMATION HIERARCHY: primary ${hierarchy.primary}; supporting ${(hierarchy.supporting ?? []).join('; ')}; detail ${(hierarchy.detail ?? []).join('; ')}` : null,
    `SPATIAL TREATMENT: ${renderSpec.spatial_treatment}; MATERIALITY TREATMENT: ${renderSpec.materiality_treatment}`,
    `LAYERS — semantic: ${(renderSpec.generative_semantic ?? []).join('; ')}; deterministic factual: ${(deterministicFacts ?? []).join('; ')}`,
    `SAFE ZONES: ${(renderSpec.safe_zones ?? []).join('; ')}; crop: ${renderSpec.crop_resilience}`,
    `VISUAL DEVICES — require: ${(renderSpec.visual_devices ?? []).join('; ')}; forbid: ${(renderSpec.forbidden_visual_devices ?? []).join('; ')}`,
    `REFERENCE AUTHORITY: ${selectedAuthority.map((r) => `${r.evaluation_id} controls ${r.authority.join(', ')}; do not copy ${r.not_authority.join(', ')}; rationale ${r.rationale}`).join(' | ')}`,
    brief.forbidden_literal_copy?.length ? `BRIEF-WIDE FORBIDDEN LITERAL COPY: ${brief.forbidden_literal_copy.join('; ')}` : null,
    `TEXT OWNERSHIP: ${['generative_structural_text', 'verified_generative_fact', 'deterministic_external_text'].join('; ')}`,
    declaredItems?.verified.length ? `VERIFIED FACT ROUTE: ${declaredItems.verified.map((item) => `${item.exact_text} [${item.source_ref}]`).join('; ')}` : null,
    declaredItems?.external.length ? `DETERMINISTIC EXTERNAL TEXT ROUTE: ${declaredItems.external.map((item) => `${item.exact_text} [${item.source_ref}]`).join('; ')}` : null,
    'ARTICLE TITLE: external overlay only',
  ].filter(Boolean) : [];
  const lines = promptAdapter === 'generic-v1'
    ? [...baseLines, ...v2Lines]
    : [...v2Lines.slice(0, 4), ...baseLines, ...v2Lines.slice(4)];
  const prompt = lines.join('\n');
  assertPromptCoverage(reader);
  return prompt;
}

function brandCeilingTerms(brand) {
  const ceiling = String(brand.line_and_materiality?.materiality_ceiling ?? '')
    .replace(/^never\s+/i, '').split(/,|\s+or\s+/).map((x) => x.trim()).filter(Boolean);
  const literal = [...(brand.palette?.prohibited ?? []), ...ceiling].map(normalise);
  // Singularize the profile's own "dark drop shadows" vocabulary; this is
  // still lexical matching, not an invented semantic synonym list.
  return [...new Set(literal.flatMap((term) => [term, term.replace(/\bshadows\b/g, 'shadow'), term.replace(/^dark\s+/, '').replace(/\bshadows\b/g, 'shadow')]))];
}

function validateBrandMateriality(job, brand, profiles, where, validatedAuthority) {
  const requested = normalisations(assemblePrompt(job, { profiles, brand, validatedAuthority }));
  const hit = brandCeilingTerms(brand).find((term) => term && requested.some((text) => text.includes(term)));
  return hit ? [issue(CODES.BRAND_MATERIALITY_CEILING_VIOLATION, where, `RenderSpec requests prohibited brand materiality/palette: ${hit}`)] : [];
}

function validateNoArticleTitle(job, brand, profiles, where, validatedAuthority) {
  const title = normalisations(job.article_title).filter(Boolean);
  if (title.length === 0) return [issue(CODES.ARTICLE_TITLE_IN_ARTWORK, where, 'generative/hybrid jobs require article_title lineage so prompt-bound title absence is checkable')];
  const found = normalisations(assemblePrompt(job, { profiles, brand, validatedAuthority })).some((text) => title.some((candidate) => text.includes(candidate)));
  return found ? [issue(CODES.ARTICLE_TITLE_IN_ARTWORK, where, 'article_title appears in a field that reaches compiled_prompt')]: [];
}

function validateRequiresOwnerGate(job, where) {
  const required = (job.brand_conflicts ?? []).length > 0;
  const actual = job.requires_owner_gate ?? false;
  return actual === required ? [] : [issue(CODES.REQUIRES_OWNER_GATE_MISMATCH, where,
    `requires_owner_gate must be ${required} when brand_conflicts has ${(job.brand_conflicts ?? []).length} entry/entries`)];
}

function validateVisualSchemaVersionFields(job, where) {
  const issues = [];
  if (job.schema_version === '1.0.0') {
    const present = VISUAL_JOB_V1_1_FIELDS.filter((field) => job[field] !== undefined);
    if (present.length > 0) {
      issues.push(issue(CODES.VERSION_FIELD_MISMATCH, where,
        `schema_version 1.0.0 cannot carry V1.1 fields: ${present.join(', ')}`));
    }
  }
  if (job.schema_version !== '1.2.0' && job.visual_production !== undefined) {
    issues.push(issue(CODES.VERSION_FIELD_MISMATCH, where,
      `schema_version ${job.schema_version} cannot carry V1.2 field: visual_production`));
  }
  return issues;
}

function sameJSONValue(left, right) {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((v, i) => sameJSONValue(v, right[i]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, i) => key === rightKeys[i] && sameJSONValue(left[key], right[key]));
}

function normalizeReferenceIdentity(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    parsed.protocol = parsed.protocol.toLowerCase();
    if (parsed.hostname) parsed.hostname = parsed.hostname.toLowerCase();
    // RFC 3986: decode unreserved octets below. URL parsing already maps
    // literal non-ASCII to its UTF-8 percent-encoded URI form, so those forms
    // denote the same identity; making them distinct would be a regression.
    // Reserved octets stay encoded because decoding them would change identity.
    // Keep opaque identifiers byte-distinct by limiting this normalization to
    // hierarchical authority references.
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return parsed.href;
    return parsed.href.replace(/%([0-9a-f]{2})/gi, (encoded, hex) => {
      const octet = Number.parseInt(hex, 16);
      const isUnreserved =
        (octet >= 0x41 && octet <= 0x5a) ||
        (octet >= 0x61 && octet <= 0x7a) ||
        (octet >= 0x30 && octet <= 0x39) ||
        [0x2d, 0x2e, 0x5f, 0x7e].includes(octet);
      return isUnreserved ? String.fromCharCode(octet) : encoded;
    });
  } catch {
    return trimmed.replace(/^([a-z][a-z0-9+.-]*):/i, (_, scheme) => `${scheme.toLowerCase()}:`);
  }
}

const ARTICLE_CLAIM_ARTICLE_REF = /^article-claim:(art:[a-z0-9]+(?:-[a-z0-9]+)*):/;
const ARTICLE_CLAIM_SOURCE_REF = /^article-claim:(art:[a-z0-9]+(?:-[a-z0-9]+)*):([a-z0-9]+(?:-[a-z0-9]+)*)$/;
function articleIdFromSourceRef(sourceRef) {
  return ARTICLE_CLAIM_ARTICLE_REF.exec(sourceRef ?? '')?.[1] ?? null;
}
function parseArticleClaimSourceRef(sourceRef) {
  const match = ARTICLE_CLAIM_SOURCE_REF.exec(sourceRef ?? '');
  return match ? { article_id: match[1], claim_id: match[2] } : null;
}

function validateVisualContractWithAuthority(job, { brand, profiles = loadArtifactProfiles(), referenceContext, validatedAuthority } = {}, where = job?.job_id ?? '<job>') {
  let authority;
  try {
    authority = requireVisualSemanticAuthority(validatedAuthority);
  } catch (error) {
    if (error instanceof VisualSemanticAuthorityError) return error.issues.map((entry) => issue(entry.code, where, entry.message));
    throw error;
  }
  const v2Required = ['generative', 'hybrid'].includes(job?.renderer_route);
  const ownerGateIssues = validateRequiresOwnerGate(job, where);
  const issues = [...ownerGateIssues];
  const hasBrief = job?.visual_brief !== undefined;
  const hasRenderSpec = job?.render_spec !== undefined;
  if (hasBrief) issues.push(...validateVisualBrief(job.visual_brief, where, authoritySchemaAtMount(authority, '/visual_brief')));
  if (hasRenderSpec) issues.push(...validateRenderSpec(job.render_spec, where, authoritySchemaAtMount(authority, '/render_spec')));
  if (hasBrief !== hasRenderSpec || (v2Required && !hasBrief && !hasRenderSpec)) {
    issues.push(issue(CODES.BRIEF_REQUIRED, where,
      'visual_brief and render_spec must be absent together for legacy deterministic jobs, or present together for a complete visual contract'));
  }
  if (!hasBrief && !hasRenderSpec) return issues;
  if (hasBrief !== hasRenderSpec || issues.some((i) => i.code === CODES.SCHEMA)) return issues;
  if (v2Required && job.visual_brief.reference_requirements.required_dimensions.length === 0) {
    issues.push(issue(CODES.BRIEF_REFERENCE_DIMENSIONS_REQUIRED, where, 'generative and hybrid VisualBriefs must require at least one reference dimension'));
  }
  const briefArticle = job.visual_brief.article_ref;
  const jobArticle = job.article_ref;
  const articleFields = ['article_id', 'version_number', 'content_hash', 'claims_hash'];
  if (job.visual_brief.brief_id !== job.render_spec.brief_id || job.visual_brief.artifact_profile !== job.artifact_profile ||
      articleFields.some((field) => briefArticle[field] !== jobArticle?.[field]) ||
      job.semantic_spec?.question !== job.visual_brief.visual_story.primary_question) {
    issues.push(issue(CODES.BRIEF_SPEC_MISMATCH, where, 'VisualBrief/RenderSpec/job semantic projection does not identify one article version, artifact profile, and primary question'));
  }
  const requirements = { ...job.visual_brief.reference_requirements, artifact_profile: job.artifact_profile };
  issues.push(...validateReferenceAuthority(job.render_spec, requirements, where, referenceContext));
  issues.push(...validateTextOwnershipAndHierarchy(job, where, authority));
  issues.push(...validatePublicationDisplaySurfaces(job, where));
  const factual = job.visual_brief.factual_invariants ?? [];
  const factualLayer = (job.render_spec.spatial_layers?.deterministic_factual ?? []).join(' ').toLowerCase();
  if (factual.some((item) => !factualLayer.includes(item.toLowerCase()))) {
    issues.push(issue(CODES.EXACT_FACT_ON_GENERATIVE_LAYER, where, 'every VisualBrief factual_invariant must be named in RenderSpec.spatial_layers.deterministic_factual'));
  }
  try {
    issues.push(...validateNoArticleTitle(job, brand, profiles, where, authority));
  } catch (error) {
    if (error instanceof VisualSemanticAuthorityError) {
      issues.push(...error.issues.map((entry) => issue(entry.code, where, entry.message)));
    } else {
      throw error;
    }
  }
  if (job.artifact_profile === 'visual/body-infographic') {
    const forbidden = new Set(job.render_spec.forbidden_visual_devices ?? []);
    if (!['ui_mimicry', 'dashboardization', 'flat_svg_aesthetic'].every((x) => forbidden.has(x))) {
      issues.push(issue(CODES.UI_MIMICRY_CONTRACT_MISSING, where, 'body infographic V2 contract must explicitly forbid ui_mimicry, dashboardization, and flat_svg_aesthetic'));
    }
  }
  issues.push(...validateBrandDepthOverride(job, brand, where));
  try {
    issues.push(...validateBrandMateriality(job, brand, profiles, where, authority));
  } catch (error) {
    if (error instanceof VisualSemanticAuthorityError) {
      if (!issues.some((entry) => error.issues.some((authorityIssue) => entry.code === authorityIssue.code && entry.message === authorityIssue.message))) {
        issues.push(...error.issues.map((entry) => issue(entry.code, where, entry.message)));
      }
    } else {
      throw error;
    }
  }
  return issues;
}

export function validateVisualContract(job, options = {}, where = job?.job_id ?? '<job>') {
  if (options.authorityContext !== undefined || options.validatedAuthority !== undefined) {
    return [issue(CODES.VISUAL_SEMANTIC_AUTHORITY_REGISTRY_INVALID, where,
      'caller-supplied visual semantic authority is test-only and cannot be used by a production validator')];
  }
  let validatedAuthority;
  try {
    validatedAuthority = requireCommittedVisualSemanticAuthority();
  } catch (error) {
    if (error instanceof VisualSemanticAuthorityError) return error.issues.map((entry) => issue(entry.code, where, entry.message));
    throw error;
  }
  return validateVisualContractWithAuthority(job, { ...options, validatedAuthority }, where);
}

/** SUE-645/648 control-plane validation; never replaces the approval lock. */
export const MAX_FACTUAL_REPAIR_DEPTH = 4;

function resolveFactualRepairReview(repair, where, out) {
  const reviewPath = repositoryRegularFile(repair.review_ref);
  if (!reviewPath) {
    out.push(issue(CODES.FACTUAL_REPAIR_REVIEW, where,
      'factual_repair.review_ref must resolve to a repository-contained regular-file review record'));
    return null;
  }
  if (digestFile(reviewPath) !== repair.review_sha256) {
    out.push(issue(CODES.FACTUAL_REPAIR_REVIEW, where,
      'factual_repair.review_sha256 does not match the review record bytes'));
    return null;
  }
  let review;
  try { review = readJSON(reviewPath); } catch {
    out.push(issue(CODES.FACTUAL_REPAIR_REVIEW, where, 'factual_repair review record is not parseable JSON'));
    return null;
  }
  const schemaIssues = validate(review, readJSON(VISUAL_REVIEW_SCHEMA));
  const post = review.post_render_checks;
  const actionFor = (verdict) => verdict === 'pass' ? 'KEEP' : verdict === 'fail' ? 'CHANGE' : 'DO_NOT_CHANGE';
  const requiredChecks = ['textual', 'factual', 'readability', 'mobile'];
  const routeIsConsistent = requiredChecks.every((name) => {
    const matches = post?.checks?.filter((entry) => entry.check === name) ?? [];
    return matches.length === 1 && post.repair_routing?.[name] === actionFor(matches[0].verdict);
  });
  const failureRouteIsConsistent = review.next_action === expectedVisualFailureAction(review.failure_class) &&
    review.verdict !== 'PASS_TO_HUMAN_REVIEW' && post?.checks?.some((entry) => entry.verdict === 'fail');
  if (schemaIssues.length > 0 || review.review_id !== repair.review_id ||
      !routeIsConsistent || !failureRouteIsConsistent) {
    out.push(issue(CODES.FACTUAL_REPAIR_REVIEW, where,
      'factual_repair must consume the named schema-valid failing review and its verdict-consistent KEEP/CHANGE/DO_NOT_CHANGE routing'));
    return null;
  }
  return review;
}

function validateFactualRepairDecisions(job, prior, review, where, validatedAuthority) {
  const out = [];
  const repair = job.visual_production.factual_repair;
  const currentItems = job.visual_production.factual_overlay.payload.items ?? [];
  const priorItems = prior.visual_production.factual_overlay.payload.items ?? [];
  const currentById = new Map(currentItems.map((item) => [item.item_id, item]));
  const priorById = new Map(priorItems.map((item) => [item.item_id, item]));
  const decisions = repair.item_decisions ?? [];
  const decisionById = new Map(decisions.map((entry) => [entry.item_id, entry]));
  const allIds = new Set([...priorById.keys(), ...currentById.keys()]);

  if (decisionById.size !== decisions.length || decisionById.size !== allIds.size ||
      [...allIds].some((id) => !decisionById.has(id))) {
    out.push(issue(CODES.FACTUAL_REPAIR_ITEM, where,
      'factual_repair.item_decisions must cover every prior/current overlay item_id exactly once'));
  }
  const priorProtected = protectedProjection(prior, validatedAuthority);
  const currentProtected = protectedProjection(job, validatedAuthority);
  if (!sameCanonicalProjection(priorProtected, currentProtected)) {
    out.push(issue(CODES.FACTUAL_REPAIR_ITEM, where,
      'localized factual repair changed a registry-protected semantic, lineage, or control field'));
  }
  const priorDecisionGated = decisionGatedProjection(prior, validatedAuthority);
  const currentDecisionGated = decisionGatedProjection(job, validatedAuthority);
  const priorRepairEnvelope = repairEnvelopeProjection(prior, validatedAuthority);
  const currentRepairEnvelope = repairEnvelopeProjection(job, validatedAuthority);
  const unchangedNewIdentity = validatedAuthority.registry.fields
    .filter((entry) => entry.localized_repair === 'new_record_identity')
    .some((entry) => sameJSONValue(priorRepairEnvelope[entry.path], currentRepairEnvelope[entry.path]));
  if (unchangedNewIdentity) {
    out.push(issue(CODES.FACTUAL_REPAIR_ITEM, where,
      'localized factual repair must use a new registry-declared record identity'));
  }
  for (const id of allIds) {
    const decision = decisionById.get(id);
    const before = priorById.get(id);
    const after = currentById.get(id);
    if (!decision || !before || !after) {
      out.push(issue(CODES.FACTUAL_REPAIR_ITEM, where,
        `overlay item ${id} was added/removed instead of receiving a bounded review decision`));
      continue;
    }
    const beforeDigest = canonicalPayloadSha256(before);
    const afterDigest = canonicalPayloadSha256(after);
    const routed = review.post_render_checks.repair_routing[decision.review_check];
    if (decision.decision !== routed || decision.prior_item_sha256 !== beforeDigest || decision.current_item_sha256 !== afterDigest) {
      out.push(issue(CODES.FACTUAL_REPAIR_ITEM, where,
        `overlay item ${id} decision/digests do not match the resolved review and canonical prior/current item bytes`));
      continue;
    }
    const changed = !sameJSONValue(before, after);
    const decisionGatedChanged = [...validatedAuthority.registry.fields]
      .filter((entry) => entry.localized_repair === 'decision_gated')
      .some((entry) => !sameJSONValue(priorDecisionGated[entry.path]?.[id], currentDecisionGated[entry.path]?.[id]));
    if (['KEEP', 'DO_NOT_CHANGE'].includes(decision.decision) && changed) {
      out.push(issue(CODES.FACTUAL_REPAIR_ITEM, where,
        `overlay item ${id} is ${decision.decision} but its canonical bytes changed`));
    }
    if (decision.decision === 'CHANGE' && (!changed || !decisionGatedChanged)) {
      out.push(issue(CODES.FACTUAL_REPAIR_ITEM, where,
        `overlay item ${id} is CHANGE but no registry decision-gated value changed`));
    }
  }
  if (review.failure_class !== 'facts_or_text_wrong' || review.next_action !== 'factual_overlay_repair') {
    out.push(issue(CODES.FACTUAL_REPAIR_REVIEW, where,
      'localized factual repair requires a review routed as facts_or_text_wrong/factual_overlay_repair; concept changes require the direction-discovery lane'));
  }
  const route = job.visual_production.failure_route;
  if (route && (route.failure_class !== review.failure_class || route.next_action !== review.next_action)) {
    out.push(issue(CODES.FACTUAL_REPAIR_REVIEW, where,
      'visual_production.failure_route must consume the resolved review failure_class and next_action exactly'));
  }
  return out;
}

function validateVisualProductionWithAuthority(job, where = job?.job_id ?? '<job>', referenceContext = {}, repairState = { chain: new Set(), depth: 0 }, validatedAuthority) {
  const authority = requireVisualSemanticAuthority(validatedAuthority);
  const production = job?.visual_production;
  if (!production) return [];
  const out = [];
  for (const e of validate(production, authoritySchemaAtMount(authority, '/visual_production'))) out.push(issue(CODES.PRODUCTION_SCHEMA, where, `${e.path}: ${e.message}`));
  if (out.length) return out;
  const { semantic_master: master, factual_overlay: overlay, publication_composite: composite, factual_repair: repair, direction_discovery: discovery, production_refinement: refinement, failure_route: route, telemetry } = production;
  const complete = [master, overlay, composite].filter(Boolean).length;
  if (complete !== 0 && complete !== 3) out.push(issue(CODES.PRODUCTION_LINEAGE, where, 'semantic_master, factual_overlay, and publication_composite must be present together'));
  if (complete === 3) {
    if (overlay.payload_sha256 !== canonicalPayloadSha256(overlay.payload) || composite.semantic_master_sha256 !== master.asset_sha256 || composite.factual_overlay_asset_sha256 !== overlay.asset_sha256 || composite.requires_owner_gate !== (job.requires_owner_gate ?? false) || master.render_spec_id !== job.render_spec?.render_spec_id || master.selected_direction_id !== discovery.selection.selected_direction_id) out.push(issue(CODES.OVERLAY_PAYLOAD, where, 'overlay payload, master, or composite lineage does not match declared independent sources'));
    const derivedAccessibleText = (overlay.payload.items ?? []).map((item) => item.accessible_text).join(' ');
    if (overlay.accessible_text_equivalent !== derivedAccessibleText) {
      out.push(issue(CODES.OVERLAY_PAYLOAD, where,
        'factual_overlay.accessible_text_equivalent must equal the ordered payload item accessible_text values joined by one space'));
    }
    if (!sameJSONValue(master.renderer_lineage, job.renderer)) {
      out.push(issue(CODES.PRODUCTION_RUNTIME_LINEAGE, where, 'semantic_master.renderer_lineage must equal the job renderer runtime lineage'));
    }
    const briefFacts = job.visual_brief?.factual_invariants ?? [];
    const declared = new Set(overlay.declared_factual_invariants ?? []);
    const exact = new Set((overlay.payload.items ?? []).map((item) => item.exact_text));
    if (briefFacts.some((fact) => !declared.has(fact) || !exact.has(fact))) out.push(issue(CODES.OVERLAY_FACTS, where, 'every VisualBrief factual invariant must be declared and represented by an exact overlay payload item'));
    const articleId = job.article_ref?.article_id;
    for (const item of overlay.payload.items ?? []) {
      const sourceArticleId = articleIdFromSourceRef(item.source_ref);
      if (articleId && sourceArticleId && sourceArticleId !== articleId) {
        out.push(issue(CODES.OVERLAY_ARTICLE_MISMATCH, where, `factual overlay source_ref names article "${sourceArticleId}", expected job article "${articleId}"`));
      }
    }
    if (repair) {
      const repairReview = resolveFactualRepairReview(repair, where, out);
      let prior; let priorRealPath;
      try {
        const priorPath = resolve(ROOT, repair.prior_production_ref);
        if (!priorPath.startsWith(`${ROOT}/`)) { out.push(issue(CODES.FACTUAL_REPAIR_PREDECESSOR_OUTSIDE, where, 'factual_repair.prior_production_ref resolves outside the repository')); throw new Error('outside'); }
        const stat = lstatSync(priorPath);
        if (stat.isSymbolicLink() || !stat.isFile()) { out.push(issue(CODES.FACTUAL_REPAIR_PREDECESSOR_NOT_REGULAR, where, 'factual_repair.prior_production_ref must name a repository-contained regular file, not a symlink or other file type')); throw new Error('not regular'); }
        priorRealPath = realpathSync(priorPath);
        if (!priorRealPath.startsWith(`${ROOT}/`)) { out.push(issue(CODES.FACTUAL_REPAIR_PREDECESSOR_OUTSIDE, where, 'factual_repair.prior_production_ref realpath is outside the repository')); throw new Error('outside'); }
        if (repairState.chain.has(priorRealPath)) { out.push(issue(CODES.FACTUAL_REPAIR_CYCLE, where, 'factual repair predecessor chain contains a cycle')); throw new Error('cycle'); }
        if (repairState.depth >= MAX_FACTUAL_REPAIR_DEPTH) { out.push(issue(CODES.FACTUAL_REPAIR_DEPTH, where, `factual repair predecessor chain exceeds depth ${MAX_FACTUAL_REPAIR_DEPTH}`)); throw new Error('depth'); }
        prior = readJSON(priorPath);
        if (!prior?.visual_production?.semantic_master || !prior.visual_production.factual_overlay || !prior.visual_production.publication_composite) throw new Error('not a complete visual-production record');
      } catch {
        if (!out.some((x) => [CODES.FACTUAL_REPAIR_PREDECESSOR_NOT_REGULAR, CODES.FACTUAL_REPAIR_PREDECESSOR_OUTSIDE, CODES.FACTUAL_REPAIR_CYCLE, CODES.FACTUAL_REPAIR_DEPTH].includes(x.code))) out.push(issue(CODES.FACTUAL_REPAIR_PREDECESSOR, where, 'factual_repair.prior_production_ref must resolve to a readable prior visual-job record with complete visual_production lineage'));
        prior = undefined;
      }
      if (prior) {
        const priorIssues = validateVisualJobRecord(prior, { referenceContext, validatedAuthority: authority }, { chain: new Set([...repairState.chain, priorRealPath]), depth: repairState.depth + 1 });
        out.push(...priorIssues.map((x) => issue(x.code, `${where} -> ${repair.prior_production_ref}`, `predecessor: ${x.message}`)));
        const priorProduction = prior.visual_production;
        if (master.asset_sha256 !== priorProduction.semantic_master.asset_sha256 || overlay.asset_sha256 === priorProduction.factual_overlay.asset_sha256 || composite.asset_sha256 === priorProduction.publication_composite.asset_sha256) out.push(issue(CODES.FACTUAL_REPAIR, where, 'a factual-overlay repair must preserve resolved prior master digest and replace resolved prior overlay and composite digests'));
        const reusedDerivedIdentity = [
          ['factual_overlay.overlay_id', overlay.overlay_id, priorProduction.factual_overlay.overlay_id],
          ['factual_overlay.asset_ref', overlay.asset_ref, priorProduction.factual_overlay.asset_ref],
          ['publication_composite.composite_id', composite.composite_id, priorProduction.publication_composite.composite_id],
          ['publication_composite.asset_ref', composite.asset_ref, priorProduction.publication_composite.asset_ref],
        ].filter(([, current, previous]) => normalizeReferenceIdentity(current) === normalizeReferenceIdentity(previous)).map(([path]) => path);
        if (reusedDerivedIdentity.length > 0) {
          out.push(issue(CODES.FACTUAL_REPAIR, where,
            `a factual-overlay repair must assign new derived identities and asset refs; reused predecessor fields: ${reusedDerivedIdentity.join(', ')}`));
        }
        if (repairReview) out.push(...validateFactualRepairDecisions(job, prior, repairReview, where, authority));
      }
  }
  } else if (repair) out.push(issue(CODES.FACTUAL_REPAIR, where, 'factual_repair requires complete master/overlay/composite lineage'));
  const candidates = discovery.candidates ?? [];
  if (candidates.length < 2 || candidates.length > 4 ||
      new Set(candidates.map((x) => x.direction_id)).size !== candidates.length ||
      new Set(candidates.map((x) => `${x.thesis_treatment}\u0000${x.composition_strategy}`)).size !== candidates.length) {
    out.push(issue(CODES.DIRECTION_DISCOVERY, where, 'direction discovery needs 2-4 materially distinct candidates with unique direction_id values and thesis/composition pairs'));
  }
  const selectedEntries = job.render_spec?.reference_authority?.selected ?? [];
  const selectedAuthorities = new Set(selectedEntries.map((x) => x.evaluation_id));
  const context = {
    catalogRefIds: referenceContext.catalogRefIds ?? loadCatalogRefIds(),
    catalogEntries: referenceContext.catalogEntries ?? loadCatalogEntries(),
    evaluations: referenceContext.evaluations ?? evaluationById(),
  };
  const requirements = { ...(job.visual_brief?.reference_requirements ?? {}), artifact_profile: job.artifact_profile };
  for (const candidate of candidates) for (const id of candidate.reference_evaluation_ids ?? []) {
    const entry = selectedEntries.find((x) => x.evaluation_id === id);
    const evaluation = context.evaluations.get(id);
    if (!entry || !evaluation || !assessVisualReferenceAdmissibility(evaluation, requirements, {
      catalogRefIds: context.catalogRefIds,
      catalogEntries: context.catalogEntries,
    }).admissible) out.push(issue(CODES.DIRECTION_REFERENCE, where, 'each direction must cite an admissible authority already selected on the job; absent anchors are rejected, never invented'));
  }
  const selection = discovery.selection;
  const selected = selection.selected_direction_id;
  const selectedMatches = candidates.filter((x) => x.direction_id === selected);
  if ((selection.state === 'selected' && (!selected || !selection.rationale || selectedMatches.length !== 1)) || (selection.state === 'open' && selected !== undefined)) out.push(issue(CODES.DIRECTION_DISCOVERY, where, 'direction selection must name exactly one candidate and rationale only when selected'));
  if (refinement && (selection.state !== 'selected' || refinement.selected_direction_id !== selected || refinement.local_edits.length > refinement.max_local_edits)) out.push(issue(CODES.REFINEMENT, where, 'refinement starts only after selected direction and stays within its local-edit budget'));
  if (route && expectedVisualFailureAction(route.failure_class) !== route.next_action) out.push(issue(CODES.FAILURE_ROUTE, where, 'failure class must use the single deterministic next action'));
  if (telemetry.edit_count !== (refinement?.local_edits.length ?? 0) || (telemetry.selected_direction_id !== undefined && telemetry.selected_direction_id !== selected) || (telemetry.accepted_asset_outcome === 'accepted') !== isApprovalLocked(job) || (isApprovalLocked(job) && telemetry.accepted_asset_outcome !== 'accepted')) out.push(issue(CODES.TELEMETRY, where, 'declared telemetry must match selected direction, refinement edits, and (only when present) lock acceptance'));
  return out;
}

export function validateVisualProduction(job, where = job?.job_id ?? '<job>', referenceContext = {}, repairState = { chain: new Set(), depth: 0 }, authorityContext) {
  if (authorityContext !== undefined) {
    return [issue(CODES.VISUAL_SEMANTIC_AUTHORITY_REGISTRY_INVALID, where,
      'caller-supplied visual semantic authority is test-only and cannot be used by a production validator')];
  }
  let validatedAuthority;
  try {
    validatedAuthority = requireCommittedVisualSemanticAuthority();
  } catch (error) {
    if (error instanceof VisualSemanticAuthorityError) return error.issues.map((entry) => issue(entry.code, where, entry.message));
    throw error;
  }
  return validateVisualProductionWithAuthority(job, where, referenceContext, repairState, validatedAuthority);
}

/** Validate a compiled visual job. Returns an array of issues; empty means PASS. */
function validateVisualJobRecord(job, { schema, profiles = loadArtifactProfiles(), brand, referenceContext, validatedAuthority } = {}, repairState = { chain: new Set(), depth: 0 }) {
  const issues = [];
  const where = job?.job_id ?? '<job>';

  let authority;
  try {
    authority = validatedAuthority === undefined
      ? requireCommittedVisualSemanticAuthority()
      : requireVisualSemanticAuthority(validatedAuthority);
  } catch (error) {
    if (error instanceof VisualSemanticAuthorityError) return error.issues.map((entry) => issue(entry.code, where, entry.message));
    throw error;
  }

  const mountedJobSchema = authoritySchemaAtMount(authority, '/');
  if (schema !== undefined && !sameJSONValue(schema, mountedJobSchema)) {
    return [issue(CODES.VISUAL_SEMANTIC_AUTHORITY_SHAPE_MISMATCH, where,
      'options.schema differs from the committed Visual Job schema; production schema authority cannot be replaced independently')];
  }
  const effectiveSchema = schema ?? mountedJobSchema;

  for (const e of validate(job, effectiveSchema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }
  if (issues.some((i) => i.code === CODES.SCHEMA)) return issues; // structurally unsound; cross-field checks would be noise

  issues.push(...validateVisualSchemaVersionFields(job, where));

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

  // PR A checks are additive. They never replace approvalLockIssues below.
  issues.push(...validateVisualContractWithAuthority(job, { brand: resolvedBrand, profiles, referenceContext, validatedAuthority: authority }, where));
  issues.push(...validateVerifiedFactTerminalReview(job, where));

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
  issues.push(...validateVisualProductionWithAuthority(job, where, referenceContext, repairState, authority));

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

    const adapter = job.compiled_prompt_adapter ?? 'generic-v1';
    if (SUPPORTED_PROMPT_ADAPTERS.includes(adapter)) {
      try {
        const expected = compileVisualPrompt(job, { profiles, brand: resolvedBrand, promptAdapter: adapter });
        if (expected.compiled_prompt !== job.compiled_prompt ||
            JSON.stringify(expected.compiled_from) !== JSON.stringify(job.compiled_from)) {
          issues.push(issue(CODES.COMPILED_OUTPUT_MISMATCH, where,
            `compiled_prompt and compiled_from do not exactly match deterministic ${adapter} compilation from the declared job inputs`));
        }
      } catch {
        // Other gates own refusal diagnostics for jobs that cannot be compiled;
        // do not turn the same refusal into a second lineage finding.
      }
    }
  }

  return issues;
}

export function validateVisualJob(job, options = {}) {
  if (options.authorityContext !== undefined || options.validatedAuthority !== undefined) {
    return [issue(CODES.VISUAL_SEMANTIC_AUTHORITY_REGISTRY_INVALID, job?.job_id ?? '<job>',
      'caller-supplied visual semantic authority is test-only and cannot be used by a production validator')];
  }
  return validateVisualJobRecord(job, options, options.repairState ?? { chain: new Set(), depth: 0 });
}

/** Explicit injection seam for registry tests; production callers must use validateVisualJob(). */
export function validateVisualJobWithAuthorityForTests(job, authorityContext, options = {}) {
  try {
    const validatedAuthority = requireVisualSemanticAuthority(authorityContext);
    return validateVisualJobRecord(job, { ...options, validatedAuthority }, options.repairState ?? { chain: new Set(), depth: 0 });
  } catch (error) {
    if (error instanceof VisualSemanticAuthorityError) {
      return error.issues.map((entry) => issue(entry.code, job?.job_id ?? '<job>', entry.message));
    }
    throw error;
  }
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
function compileVisualPromptWithAuthority(job, { profiles = loadArtifactProfiles(), brand, promptAdapter = 'generic-v1' } = {}, validatedAuthority) {
  const authority = requireVisualSemanticAuthority(validatedAuthority);
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
  const visualContractIssues = validateVisualContractWithAuthority(job, { brand: resolvedBrand, profiles, validatedAuthority: authority });
  if (visualContractIssues.length > 0) {
    const authorityIssues = visualContractIssues.filter((entry) => Object.values(AUTHORITY_CODES).includes(entry.code));
    if (authorityIssues.length > 0) {
      throw new VisualSemanticAuthorityError(authorityIssues.map((entry) => ({ code: entry.code, path: '/', message: entry.message })));
    }
    throw new Error(`visual contract invalid: ${visualContractIssues.map((i) => `[${i.code}] ${i.message}`).join(' | ')}`);
  }

  const v2 = job.visual_brief && job.render_spec;
  if (!SUPPORTED_PROMPT_ADAPTERS.includes(promptAdapter)) {
    throw new Error(`unknown prompt adapter: ${promptAdapter}`);
  }
  const compiled_prompt = assemblePrompt(job, { profiles, brand: resolvedBrand, promptAdapter, validatedAuthority: authority });

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
    ...(v2 ? [`visual_brief:${job.visual_brief.brief_id}`, `render_spec:${job.render_spec.render_spec_id}`, ...job.render_spec.reference_authority.selected.map((r) => r.evaluation_id)] : []),
  ].filter(Boolean);

  return { compiled_prompt, compiled_from, compiled_prompt_adapter: promptAdapter };
}

export function compileVisualPrompt(job, options = {}) {
  if (options.authorityContext !== undefined || options.validatedAuthority !== undefined) {
    throw new VisualSemanticAuthorityError([{
      code: CODES.VISUAL_SEMANTIC_AUTHORITY_REGISTRY_INVALID,
      path: '/',
      message: 'caller-supplied visual semantic authority is test-only and cannot be used by the production compiler',
    }]);
  }
  return compileVisualPromptWithAuthority(job, options, requireCommittedVisualSemanticAuthority());
}

/** Explicit injection seam for registry tests; production callers must use compileVisualPrompt(). */
export function compileVisualPromptWithAuthorityForTests(job, authorityContext, options = {}) {
  return compileVisualPromptWithAuthority(job, options, requireVisualSemanticAuthority(authorityContext));
}
