/**
 * Visual job engine — AES-V2.7 (SUE-565).
 *
 * Validates a compiled visual job against schemas/visual-job.schema.json plus
 * the cross-field gates a schema cannot express: density/profile match,
 * renderer route vs evidence, context isolation, and attempts budget. Also
 * performs the deterministic, model-free prompt compilation described in
 * schemas/VISUAL-JOB-CONTRACT.md.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export const VISUAL_JOB_SCHEMA = resolve(ROOT, 'schemas/visual-job.schema.json');
export const ARTIFACT_PROFILE_DIR = resolve(ROOT, 'editorial/profiles/artifact');
export const BRAND_PROFILE_PATH = resolve(ROOT, 'editorial/profiles/brand/suengj-com.v1.json');

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

export function loadBrandProfile(p = BRAND_PROFILE_PATH) {
  return readJSON(p);
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
  INCONSISTENT_GAIN_VERDICT: 'information-gain-verdict-inconsistent-with-redundancy-test',
});

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

/** Validate a compiled visual job. Returns an array of issues; empty means PASS. */
export function validateVisualJob(job, { schema = loadSchema(), profiles = loadArtifactProfiles(), brand = loadBrandProfile() } = {}) {
  const issues = [];
  const where = job?.job_id ?? '<job>';

  for (const e of validate(job, schema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }
  if (issues.some((i) => i.code === CODES.SCHEMA)) return issues; // structurally unsound; cross-field checks would be noise

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

  if (job.brand_profile === brand?.brand && job.brand_profile_version !== brand?.profile_version) {
    issues.push(issue(CODES.BRAND_VERSION_MISMATCH, where,
      `job compiled against brand_profile_version "${job.brand_profile_version}" but the current profile is "${brand?.profile_version}" — record which version was actually used, not silently the latest`));
  }

  if (job.attempts > job.max_attempts) {
    issues.push(issue(CODES.ATTEMPTS_EXCEEDED, where, `attempts (${job.attempts}) exceeds max_attempts (${job.max_attempts})`));
  }

  if (!(job.context_isolation?.excluded ?? []).includes('renderer_runtime_identity')) {
    issues.push(issue(CODES.RUNTIME_NOT_EXCLUDED, where,
      'context_isolation.excluded must declare "renderer_runtime_identity" — provider/model/model_version/quality_tier are lineage, never a compiled-prompt input'));
  }

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
    const vocabulary = permittedVocabulary(job, { profiles, brand });
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
export function compileVisualPrompt(job, { profiles = loadArtifactProfiles(), brand = loadBrandProfile() } = {}) {
  if (job.information_gain?.verdict === 'skip') {
    return { compiled_prompt: undefined, compiled_from: [] };
  }

  const profile = profiles[job.artifact_profile];
  if (!profile) throw new Error(`unknown artifact profile: ${job.artifact_profile}`);

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
    `BRAND (${job.brand_profile}@${job.brand_profile_version}): background ${brand.palette?.background?.family}, primary ${brand.palette?.primary_structure?.family}, accent ${brand.palette?.accent?.family}`,
    refs.adopt?.length ? `REFERENCE TRAITS — adopt: ${refs.adopt.join('; ')}` : null,
    refs.avoid?.length ? `REFERENCE TRAITS — avoid: ${refs.avoid.join('; ')}` : null,
    refs.do_not_copy?.length ? `REFERENCE TRAITS — do not copy: ${refs.do_not_copy.join('; ')}` : null,
  ].filter(Boolean);

  const compiled_from = [
    job.profile_ref,
    `${job.brand_profile}@${job.brand_profile_version}`,
    job.audience?.profile_ref,
    'semantic_spec',
    'selected_reference_traits',
  ].filter(Boolean);

  return { compiled_prompt: lines.join('\n'), compiled_from };
}
