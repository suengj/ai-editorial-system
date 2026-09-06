#!/usr/bin/env node
/**
 * Regression test for the visual job contract — AES-V2.7 (SUE-565).
 *
 * Two directions, both required:
 *   allow fixtures (the four schemas/examples/visual-job-*.example.json) → PASS
 *   deny fixtures, including the two named production regressions          → FAIL
 *
 * A gate suite that only fires on bad jobs proves nothing about good ones,
 * and a gate suite that never names its regressions cannot be checked for
 * regressing again.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, compileVisualPrompt, loadArtifactProfiles, loadSchema,
  resolveBrandProfile, validateVisualJob,
} from './lib/visual-job-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXAMPLES_DIR = resolve(ROOT, 'schemas/examples');

const schema = loadSchema();
const profiles = loadArtifactProfiles();
// No fixed brand: every fixture's own brand_profile/brand_profile_version is
// resolved fail-closed from the brand axis (B6), not defaulted to one file.
const opts = { schema, profiles };
const brand = resolveBrandProfile('suengj-com', '1.0.0'); // used only where a test needs the concrete profile object

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const loadExample = (name) => JSON.parse(readFileSync(resolve(EXAMPLES_DIR, name), 'utf8'));

// --- allow fixtures --------------------------------------------------------
console.log('allow fixtures (expect PASS)');
{
  const files = readdirSync(EXAMPLES_DIR)
    .filter((f) => f.startsWith('visual-job-') && f.endsWith('.example.json'));
  check('at least 4 visual-job example fixtures exist, covering the required cases', files.length >= 4, files.join(', '));

  for (const f of files) {
    const job = loadExample(f);
    const issues = validateVisualJob(job, opts);
    check(f, issues.length === 0, issues.map((i) => `[${i.code}] ${i.message}`).join(' | '));
  }

  const skip = loadExample('visual-job-skip.example.json');
  check('skip is a first-class, non-failing outcome (status gated_skip, no compiled_prompt)',
    skip.status === 'gated_skip' && skip.compiled_prompt === undefined);
}

// --- deny fixtures ----------------------------------------------------------
console.log('\ndeny fixtures (expect FAIL, with the specific gate named)');

const baseGood = loadExample('visual-job-body-infographic.example.json');
const codesOf = (job) => validateVisualJob(job, opts).map((i) => i.code);

{
  // SUE-531 — context contamination: a compiled prompt carrying unrelated
  // project/conversation tokens that are not derivable from any declared input.
  const job = clone(baseGood);
  job.compiled_prompt += '\nAlso remember the unrelated Q3 roadmap meeting notes and the customer churn dashboard incident from last Tuesday.';
  check('SUE-531 context contamination: leaked ambient tokens', codesOf(job).includes(CODES.CONTEXT_LEAK));
}

{
  // SUE-534 — low information gain: a visual that merely restates adjacent
  // prose is approved anyway (verdict proceed despite a failing redundancy test).
  const job = clone(baseGood);
  job.information_gain.redundancy_test.q3_merely_recreates = true;
  job.information_gain.redundancy_test.q4_worth_the_interruption = false;
  job.information_gain.verdict = 'proceed';
  check('SUE-534 low information gain: proceed despite merely-recreates redundancy test',
    codesOf(job).includes(CODES.INCONSISTENT_GAIN_VERDICT));
}

{
  // A body infographic compiled at thumbnail density.
  const job = clone(baseGood);
  job.density_check.compiled_semantic_density = 'low';
  job.density_check.compiled_visual_density = 'low';
  job.density_check.match = true; // claims a match that does not hold
  check('body infographic compiled at thumbnail density', codesOf(job).includes(CODES.DENSITY_MISMATCH));
}

{
  // A generative route asked to carry exact evidence values.
  const job = clone(loadExample('visual-job-evidence-visual.example.json'));
  job.renderer_route = 'generative';
  check('generative route asked to carry exact evidence values', codesOf(job).includes(CODES.EVIDENCE_GENERATIVE));
}

{
  // A reference colour overriding the brand profile without an explicit
  // authoritative-trait selection.
  const job = clone(baseGood);
  job.selected_reference_traits.adopt.push('reference’s warm orange accent colour instead of the house sand/camel accent');
  delete job.selected_reference_traits.authoritative_override;
  check('reference colour overrides brand profile without authorization', codesOf(job).includes(CODES.BRAND_OVERRIDE_UNAUTHORIZED));
}

{
  // Sanity: the same reference colour trait IS allowed once explicitly
  // selected as an authoritative override — the gate targets silence, not
  // the override itself.
  const job = clone(baseGood);
  job.selected_reference_traits.adopt.push('reference’s warm orange accent colour instead of the house sand/camel accent');
  job.selected_reference_traits.authoritative_override = ['reference accent colour'];
  check('the same colour trait is allowed once explicitly authorized', !codesOf(job).includes(CODES.BRAND_OVERRIDE_UNAUTHORIZED));
}

{
  // SUE-628 — an information-design plate compiled with no composition plan.
  // F1-F5 are decisions taken before any rendering occurs, so a job in one of
  // those three families that names no plan has nowhere to route a bad plate.
  const job = clone(baseGood);
  delete job.composition_plan_ref;
  check('SUE-628 information-design family with no composition_plan_ref',
    codesOf(job).includes(CODES.COMPOSITION_PLAN_REQUIRED));
}

{
  // The same gate does not fire on a skip: no plate is produced, so there is
  // nothing to plan. visual-job-skip.example.json is a visual/explanatory-diagram
  // gated to skip and carries no composition_plan_ref.
  const skip = loadExample('visual-job-skip.example.json');
  check('a skip verdict in an information-design family needs no composition_plan_ref',
    !codesOf(skip).includes(CODES.COMPOSITION_PLAN_REQUIRED));
}

{
  // Attempts budget.
  const job = clone(baseGood);
  job.attempts = job.max_attempts + 1;
  check('attempts exceeding max_attempts', codesOf(job).includes(CODES.ATTEMPTS_EXCEEDED));
}

{
  // Skip must short-circuit cleanly: a skip verdict with a compiled prompt anyway.
  const job = clone(baseGood);
  job.information_gain.verdict = 'skip';
  job.information_gain.integration_strategy = 'skip';
  check('skip verdict that still produced a compiled_prompt', codesOf(job).includes(CODES.SKIP_NOT_CLEAN));
}

{
  // Runtime identity (model name) leaking into the compiled prompt text.
  const job = clone(baseGood);
  job.compiled_prompt += `\nRendered with ${job.renderer.model}.`;
  check('renderer model name leaks into compiled_prompt', codesOf(job).includes(CODES.RUNTIME_LEAK));
}

{
  // context_isolation.excluded must name renderer_runtime_identity explicitly.
  const job = clone(baseGood);
  job.context_isolation.excluded = job.context_isolation.excluded.filter((x) => x !== 'renderer_runtime_identity');
  check('context_isolation omits renderer_runtime_identity from excluded', codesOf(job).includes(CODES.RUNTIME_NOT_EXCLUDED));
}

// --- B6: brand_profile is resolved fail-closed, never a fixed default ------
console.log('\nbrand resolution is fail-closed (B6)');
{
  // Setting an unknown brand must error rather than silently compiling
  // against suengj.com's tokens.
  const job = clone(baseGood);
  job.brand_profile = 'acme-corp';

  let validateThrew = false;
  try { validateVisualJob(job, { schema, profiles }); } catch { validateThrew = true; }
  const issues = validateThrew ? [] : validateVisualJob(job, { schema, profiles });
  check('an unknown brand_profile is reported as an issue (or throws), never silently accepted',
    validateThrew || issues.some((i) => i.code === CODES.UNKNOWN_BRAND),
    issues.map((i) => i.code).join(', '));

  let compileThrew = false;
  let compiledPrompt;
  try {
    compiledPrompt = compileVisualPrompt(job, { profiles });
  } catch {
    compileThrew = true;
  }
  check('compileVisualPrompt errors on an unresolvable brand rather than compiling against a default brand\'s tokens',
    compileThrew);
  check('no compiled_prompt was produced for the unresolvable brand',
    compileThrew && compiledPrompt === undefined);
}

{
  // A known brand must resolve to the file actually on disk, and
  // compiled_from must record that same brand/version, not job.brand_profile
  // verbatim if it ever disagreed with what was actually read.
  const job = clone(baseGood);
  const resolved = resolveBrandProfile(job.brand_profile, job.brand_profile_version);
  check('resolveBrandProfile("suengj-com", "1.0.0") loads editorial/profiles/brand/suengj-com.v1.json',
    resolved.brand === 'suengj-com' && resolved.profile_version === '1.0.0');

  const { compiled_prompt, compiled_from } = compileVisualPrompt(job, { profiles });
  check('compiled_from names the exact brand@version that was actually loaded',
    compiled_from.includes(`${resolved.brand}@${resolved.profile_version}`));
  check('the compiled prompt carries tokens derived from the resolved brand profile (background family)',
    compiled_prompt.includes(resolved.palette.background.family.split('/')[0].trim().split(' ')[0]));
}

// --- model/provider drift is visible in lineage, never in the prompt -------
console.log('\nmodel/provider drift (informational, optional per manager delta)');
{
  const jobA = clone(baseGood);
  const jobB = clone(baseGood);
  jobB.job_id = 'job:tokenized-stocks-liquidity-plate-a-rerun';
  jobB.renderer.model_version = '2026-10-15';

  const compiledA = compileVisualPrompt(jobA, { profiles, brand });
  const compiledB = compileVisualPrompt(jobB, { profiles, brand });

  check('two jobs with identical semantic_spec/profile/audience/brand but different model_version compile identical prompts',
    compiledA.compiled_prompt === compiledB.compiled_prompt);
  check('the differing model_version is visible in lineage (renderer.model_version), not in the prompt',
    jobA.renderer.model_version !== jobB.renderer.model_version &&
    !compiledB.compiled_prompt.includes(jobB.renderer.model_version));
}

// --- an information-design family may never route generative ---------------
// The composition-plan schema omits plain "generative" from its route enum for
// these three families, so a plan cannot express it. Without a matching guard
// here the visual job could still declare it and the contract would be stating
// a boundary nothing checked — signature F7 one layer up.
console.log('\ninformation-design families and the generative route (SUE-628)');
{
  for (const profile of ['visual/body-infographic', 'visual/analytical-graphic', 'visual/explanatory-diagram']) {
    const job = clone(baseGood);
    job.artifact_profile = profile;
    job.profile_ref = `editorial/profiles/artifact/${profile.replace('visual/', 'visual-')}.json`;
    job.renderer_route = 'generative';
    const codes = validateVisualJob(job, { schema, profiles, brand }).map((i) => i.code);
    check(`${profile} on a generative route is rejected`,
      codes.includes('information-design-on-generative-route'));
  }

  const hybrid = clone(baseGood);
  hybrid.renderer_route = 'hybrid';
  check('the same family on a hybrid route is not rejected for its route',
    !validateVisualJob(hybrid, { schema, profiles, brand })
      .map((i) => i.code).includes('information-design-on-generative-route'));

  const thumb = clone(baseGood);
  thumb.artifact_profile = 'visual/thumbnail';
  thumb.profile_ref = 'editorial/profiles/artifact/visual-thumbnail.json';
  thumb.renderer_route = 'generative';
  check('visual/thumbnail is unaffected — nothing in it encodes a relation by position',
    !validateVisualJob(thumb, { schema, profiles, brand })
      .map((i) => i.code).includes('information-design-on-generative-route'));
}

console.log(failures === 0 ? '\nvisual-job: ALL PASS' : `\nvisual-job: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
