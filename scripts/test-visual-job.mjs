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

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, RegenerationSealedError, compileVisualPrompt, hasAuthorizedReopen,
  isRegenerationSealed, loadArtifactProfiles, loadSchema, resolveBrandProfile,
  validateVisualJob,
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
const sha256File = (path) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
const codesOf = (job) => validateVisualJob(job, opts).map((i) => i.code);

// --- allow fixtures --------------------------------------------------------
console.log('allow fixtures (expect PASS)');
{
  const files = readdirSync(EXAMPLES_DIR)
    .filter((f) => f.startsWith('visual-job-') && f.endsWith('.example.json'));
  check('at least 6 visual-job example fixtures exist, covering the required cases', files.length >= 6, files.join(', '));

  for (const f of files) {
    const job = loadExample(f);
    const issues = validateVisualJob(job, opts);
    check(f, issues.length === 0, issues.map((i) => `[${i.code}] ${i.message}`).join(' | '));
  }

  const skip = loadExample('visual-job-skip.example.json');
  check('skip is a first-class, non-failing outcome (status gated_skip, no compiled_prompt)',
    skip.status === 'gated_skip' && skip.compiled_prompt === undefined);
}

{
  const reviewerMutation = JSON.parse(readFileSync(resolve(ROOT, 'evals/visual-review/sue671-ai-hiring-missing-rungs-job.json'), 'utf8'));
  reviewerMutation.status = 'accepted';
  reviewerMutation.qa = { performed: true, information_gain_recheck: 'pass', density_recheck: 'pass' };
  check('SUE-670 reviewer exact mutation: verified-fact job cannot be accepted on QA/schema declarations alone',
    codesOf(reviewerMutation).includes(CODES.VERIFIED_FACT_TERMINAL_REVIEW), codesOf(reviewerMutation).join(', '));

  const scope = mkdtempSync(resolve(ROOT, '.visual-job-terminal-review-'));
  try {
    const job = JSON.parse(readFileSync(resolve(ROOT, 'evals/visual-review/fixtures/semantic-negative/authoritative-job.json'), 'utf8'));
    const review = JSON.parse(readFileSync(resolve(ROOT, 'evals/visual-review/fixtures/semantic-negative/wrong-number.review.json'), 'utf8'));
    review.review_id = 'visual-review:fixture-terminal-allow';
    review.post_render_checks.checks.find((entry) => entry.check === 'factual').observed_text_items[0].observed_text = '41.4%';
    const reviewPath = resolve(scope, 'review.json');
    writeFileSync(reviewPath, JSON.stringify(review));
    job.schema_version = '1.2.0';
    job.status = 'accepted';
    job.qa = { performed: true, information_gain_recheck: 'pass', density_recheck: 'pass' };
    job.post_render_review = {
      review_id: review.review_id,
      review_ref: relative(ROOT, reviewPath),
      review_sha256: sha256File(reviewPath),
      asset_ref: review.asset_ref,
      asset_sha256: review.asset_sha256,
    };
    check('asset-bound terminal verified-fact review linkage validates',
      validateVisualJob(job, opts).length === 0,
      validateVisualJob(job, opts).map((i) => `[${i.code}] ${i.message}`).join(' | '));
  } finally {
    rmSync(scope, { recursive: true, force: true });
  }
}

// --- deny fixtures ----------------------------------------------------------
console.log('\ndeny fixtures (expect FAIL, with the specific gate named)');

const baseGood = loadExample('visual-job-body-infographic.example.json');

{
  const production = clone(loadExample('visual-job-body-infographic-v2.example.json'));
  production.schema_version = '1.1.0';
  check('V1.1 cannot carry the V1.2 visual_production field',
    codesOf(production).includes(CODES.VERSION_FIELD_MISMATCH));
  const v1 = clone(baseGood);
  v1.visual_brief = clone(production.visual_brief);
  check('V1.0 cannot carry V1.1 visual fields',
    codesOf(v1).includes(CODES.VERSION_FIELD_MISMATCH));
}

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

// --- SUE-639: the human-approval lock ---------------------------------------
// The production incident (SUE-638): an approved infographic, an awkward
// upload, a low-resolution workaround, "make it high quality", and a fresh
// generative render that changed the artwork. Every check below is one edge of
// that path being closed, in both directions — prohibited and authorized.
console.log('\napproval lock (SUE-639)');

const approvedFormat = loadExample('visual-job-approved-format-derivative.example.json');
const approvedConcept = loadExample('visual-job-approved-concept-change.example.json');

{
  // PASS: an unapproved candidate may still route to a generative renderer.
  const job = clone(loadExample('visual-job-thumbnail-concept.example.json'));
  check('PASS unapproved candidate → generative render allowed',
    job.renderer_route === 'generative' && validateVisualJob(job, opts).length === 0);

  // The same job carrying an explicit candidate state is still open.
  const candidate = clone(job);
  candidate.approved_asset = { state: 'candidate' };
  check('PASS approved_asset.state "candidate" leaves generation open',
    validateVisualJob(candidate, opts).length === 0,
    codesOf(candidate).join(', '));
}

{
  // FAIL: approved + fidelity_only routed to a generative renderer.
  // "Make it high resolution" is not a redraw instruction.
  const job = clone(approvedFormat);
  job.revision.intent = 'fidelity_only';
  job.revision.request = 'make this high quality';
  job.renderer_route = 'generative';
  check('FAIL approved + fidelity_only → generative renderer',
    codesOf(job).includes(CODES.REGENERATION_FORBIDDEN), codesOf(job).join(', '));
}

{
  // FAIL: approved + publication_only that compiled a generation prompt anyway.
  const job = clone(approvedFormat);
  job.revision.intent = 'publication_only';
  job.revision.request = 'upload it to the site';
  const { compiled_prompt, compiled_from } = compileVisualPrompt(
    clone(loadExample('visual-job-body-infographic.example.json')), { profiles });
  job.compiled_prompt = compiled_prompt;
  job.compiled_from = compiled_from;
  check('FAIL approved + publication_only → compiled generation prompt',
    codesOf(job).includes(CODES.GENERATION_PROMPT_FORBIDDEN), codesOf(job).join(', '));
}

{
  // The compiler itself refuses, so a caller cannot obtain a prompt by
  // skipping validation.
  for (const intent of ['publication_only', 'fidelity_only', 'format_only', 'layout_only']) {
    const job = clone(approvedFormat);
    job.revision.intent = intent;
    let threw = false;
    let result;
    try { result = compileVisualPrompt(job, { profiles }); } catch (err) { threw = err instanceof RegenerationSealedError; }
    check(`compileVisualPrompt refuses a human_approved_locked master under ${intent}`,
      threw && result === undefined);
    check(`isRegenerationSealed is true for ${intent}`, isRegenerationSealed(job));
  }
}

{
  // PASS: approved + format_only on the deterministic media route, with no
  // compiled prompt — the WebP/PNG derivative path.
  check('PASS approved + format_only → deterministic media route',
    approvedFormat.renderer_route === 'deterministic' &&
    approvedFormat.compiled_prompt === undefined &&
    validateVisualJob(approvedFormat, opts).length === 0,
    codesOf(approvedFormat).join(', '));
  check('the format_only derivative job still carries the master digest and geometry it derives from',
    /^sha256:[a-f0-9]{64}$/.test(approvedFormat.approved_asset.master_digest) &&
    approvedFormat.approved_asset.native_geometry.width > 0);
  check('the master\'s generative/deterministic origin stays auditable in approved_asset.renderer_lineage',
    typeof approvedFormat.approved_asset.renderer_lineage?.model_version === 'string');
}

{
  // PASS: an explicitly authorized concept_change reopens generation.
  check('PASS approved + explicitly authorized concept_change → generation reopened',
    approvedConcept.renderer_route === 'generative' &&
    approvedConcept.revision.regeneration_allowed === true &&
    validateVisualJob(approvedConcept, opts).length === 0,
    codesOf(approvedConcept).join(', '));
  check('an authorized concept_change compiles a prompt without refusal',
    typeof compileVisualPrompt(clone(approvedConcept), { profiles }).compiled_prompt === 'string');

  // FAIL: the same concept_change without the authorization record.
  const unauthorized = clone(approvedConcept);
  delete unauthorized.revision.authorization;
  check('FAIL concept_change without revision.authorization',
    codesOf(unauthorized).includes(CODES.REVISION_AUTHORIZATION_MISSING));
}

{
  // PASS: a bounded local_edit with a delta and protected invariants.
  const job = clone(approvedConcept);
  job.revision = {
    intent: 'local_edit',
    preserve_visual_identity: true,
    regeneration_allowed: true,
    request: 'the arrow between the two panels points the wrong way — fix just that',
    authorization: {
      authorized_by: 'suengjae-hong',
      statement: 'Fix the reversed arrow only. Everything else stays exactly as approved.',
      bounded_delta: ['reverse the direction of the arrow between the two domain panels'],
      protected_invariants: [
        'panel composition and placement',
        'all labels and their wording',
        'palette and line weight',
      ],
    },
  };
  check('PASS approved + bounded local_edit with protected invariants',
    validateVisualJob(job, opts).length === 0, codesOf(job).join(', '));

  // FAIL: the same local_edit with no bounded delta — an unbounded "edit".
  const unbounded = clone(job);
  unbounded.revision.authorization.bounded_delta = [];
  check('FAIL local_edit without a bounded delta',
    codesOf(unbounded).includes(CODES.REVISION_AUTHORIZATION_MISSING));

  // FAIL: the same local_edit with no protected invariants.
  const unprotected = clone(job);
  delete unprotected.revision.authorization.protected_invariants;
  check('FAIL local_edit without protected invariants',
    codesOf(unprotected).includes(CODES.REVISION_AUTHORIZATION_MISSING));
}

{
  // FAIL: an approved master with no immutable identity — the lock is a claim
  // about which artifact was approved, and cannot be made without one.
  for (const field of ['master_ref', 'master_digest', 'native_geometry']) {
    const job = clone(approvedFormat);
    delete job.approved_asset[field];
    check(`FAIL human_approved_locked master missing ${field}`,
      codesOf(job).includes(CODES.APPROVED_IDENTITY_INCOMPLETE), codesOf(job).join(', '));
  }

  const noGeometry = clone(approvedFormat);
  delete noGeometry.approved_asset.native_geometry.height;
  check('FAIL raster master whose native_geometry has no pixel height',
    codesOf(noGeometry).includes(CODES.APPROVED_IDENTITY_INCOMPLETE));

  // A vector master is identified by its view_box rather than pixel geometry.
  // master_ref moves to .svg too: the declared format has to describe the
  // artifact the lock actually points at (see the I3 regression below).
  const vector = clone(approvedFormat);
  vector.approved_asset.format = 'svg';
  vector.approved_asset.master_ref = 'assets/visual-masters/articles/tokenized-stocks-instant-payments-liquidity-rights/liquidity-plate-a.svg';
  vector.approved_asset.approval_binding.master_ref = vector.approved_asset.master_ref;
  vector.approved_asset.native_geometry = { view_box: '0 0 2400 1350' };
  check('PASS vector master identified by view_box instead of pixel geometry',
    !codesOf(vector).includes(CODES.APPROVED_IDENTITY_INCOMPLETE), codesOf(vector).join(', '));
}

{
  // FAIL: the record claims a lock while declaring regeneration open.
  const job = clone(approvedFormat);
  job.revision.regeneration_allowed = true;
  check('FAIL format_only on a locked master with regeneration_allowed=true',
    codesOf(job).includes(CODES.APPROVAL_FLAGS_INCONSISTENT));

  const identity = clone(approvedFormat);
  identity.revision.preserve_visual_identity = false;
  check('FAIL format_only on a locked master with preserve_visual_identity=false',
    codesOf(identity).includes(CODES.APPROVAL_FLAGS_INCONSISTENT));

  const conceptClaimsPreserved = clone(approvedConcept);
  conceptClaimsPreserved.revision.preserve_visual_identity = true;
  check('FAIL concept_change that claims it preserves the approved visual identity',
    codesOf(conceptClaimsPreserved).includes(CODES.APPROVAL_FLAGS_INCONSISTENT));
}

{
  // FAIL: a post-approval intent asserted with no approved asset behind it —
  // approval must be machine state, not conversational memory.
  const job = clone(loadExample('visual-job-body-infographic.example.json'));
  job.revision = { intent: 'fidelity_only', preserve_visual_identity: true, regeneration_allowed: false };
  check('FAIL revision intent without an approved_asset on the record',
    codesOf(job).includes(CODES.REVISION_WITHOUT_APPROVAL));
}

{
  // SUE-565 must not regress: the lock is additive, so the pre-existing
  // context-isolation and renderer-lineage gates still fire on locked jobs.
  const leaky = clone(approvedConcept);
  leaky.compiled_prompt += '\nAlso remember the unrelated Q3 roadmap meeting notes.';
  check('SUE-565 context isolation still fires on an approval-locked job',
    codesOf(leaky).includes(CODES.CONTEXT_LEAK));

  const runtimeLeak = clone(approvedConcept);
  runtimeLeak.compiled_prompt += `\nRendered with ${runtimeLeak.renderer.model}.`;
  check('SUE-565 renderer-runtime leak still fires on an approval-locked job',
    codesOf(runtimeLeak).includes(CODES.RUNTIME_LEAK));

  const notExcluded = clone(approvedFormat);
  notExcluded.context_isolation.excluded =
    notExcluded.context_isolation.excluded.filter((x) => x !== 'renderer_runtime_identity');
  check('SUE-565 renderer_runtime_identity exclusion still required on an approval-locked job',
    codesOf(notExcluded).includes(CODES.RUNTIME_NOT_EXCLUDED));
}

// --- independent review of PR #13: the lock was open in three places -------
// Every check below is a falsification an adversarial reviewer actually
// executed against the shipped scripts. They are here so the same holes cannot
// reopen silently.
console.log('\napproval-lock review regressions (SUE-639 review)');

{
  // B1. THE BIG ONE. `revision` is optional in the schema, and the first
  // implementation returned early when it was absent — so a locked master with
  // no declared intent compiled a generative prompt and validated PASS. Silence
  // is not authorization: the lock is closed by default now, and only an
  // explicitly authorized reopen opens it.
  const job = clone(approvedFormat);
  delete job.revision;
  job.renderer_route = 'generative';
  job.compiled_prompt = baseGood.compiled_prompt;
  job.compiled_from = baseGood.compiled_from;
  const c = codesOf(job);
  check('B1 FAIL locked master with NO revision declared → generative route',
    c.includes(CODES.REGENERATION_FORBIDDEN), c.join(', '));
  check('B1 FAIL locked master with NO revision declared → compiled prompt',
    c.includes(CODES.GENERATION_PROMPT_FORBIDDEN), c.join(', '));

  let threw = false;
  try { compileVisualPrompt(job, { profiles }); } catch (err) { threw = err instanceof RegenerationSealedError; }
  check('B1 compileVisualPrompt refuses a locked master with no declared intent', threw);
  check('B1 isRegenerationSealed is true when no revision is declared', isRegenerationSealed(job));

  // The lock alone, with nothing else wrong, is still a valid record.
  const quiet = clone(approvedFormat);
  delete quiet.revision;
  check('B1 a locked master with no revision and a deterministic route is still valid',
    validateVisualJob(quiet, opts).length === 0, codesOf(quiet).join(', '));
}

{
  // B2. Demotion: `state: candidate` while keeping the approved master's
  // identity skipped every guard. A record that names an approved master is
  // locked; approval is not demotable by rewriting one field.
  const job = clone(approvedFormat);
  job.approved_asset.state = 'candidate';
  check('B2 FAIL state demoted to "candidate" while still naming the approved master',
    codesOf(job).includes(CODES.APPROVAL_STATE_INCONSISTENT), codesOf(job).join(', '));

  for (const field of ['master_ref', 'master_digest', 'format', 'approved_by']) {
    const one = clone(loadExample('visual-job-thumbnail-concept.example.json'));
    one.approved_asset = { state: 'candidate', [field]: approvedFormat.approved_asset[field] };
    check(`B2 FAIL a candidate carrying ${field} alone`,
      codesOf(one).includes(CODES.APPROVAL_STATE_INCONSISTENT));
  }

  // A genuine candidate — no master identity at all — is still the PASS path.
  const genuine = clone(loadExample('visual-job-thumbnail-concept.example.json'));
  genuine.approved_asset = { state: 'candidate' };
  check('B2 PASS a genuine candidate naming no master still allows generation',
    validateVisualJob(genuine, opts).length === 0, codesOf(genuine).join(', '));
}

{
  // B3. Attribution. A lock asserted with nobody's name on it is ambient
  // memory wearing a schema. This does not make the record unforgeable — see
  // the residual limit in editorial/APPROVED-VISUAL-ASSET-LIFECYCLE.md §2 —
  // but it removes the silent path.
  for (const field of ['approved_by', 'approved_at', 'approval_context']) {
    const job = clone(approvedFormat);
    delete job.approved_asset[field];
    check(`B3 FAIL human_approved_locked with no ${field}`,
      codesOf(job).includes(CODES.APPROVAL_ATTRIBUTION_MISSING), codesOf(job).join(', '));
  }
  const blank = clone(approvedFormat);
  blank.approved_asset.approved_by = '   ';
  check('B3 FAIL a whitespace-only approver name is not an attribution',
    codesOf(blank).includes(CODES.APPROVAL_ATTRIBUTION_MISSING));
}

{
  const revision = clone(approvedFormat);
  revision.article_ref.version_number = 3;
  revision.article_ref.content_hash = 'c'.repeat(64);
  revision.article_ref.claims_hash = 'd'.repeat(64);
  check('SUE-669 reviewer exact mutation: v2 approval cannot survive article v3 identity',
    codesOf(revision).includes(CODES.APPROVAL_IDENTITY_MISMATCH), codesOf(revision).join(', '));

  const masterDigest = clone(approvedFormat);
  masterDigest.approved_asset.master_digest = `sha256:${'e'.repeat(64)}`;
  check('SUE-669 reviewer exact mutation: approval cannot survive changed master_digest',
    codesOf(masterDigest).includes(CODES.APPROVAL_IDENTITY_MISMATCH), codesOf(masterDigest).join(', '));

  const masterRef = clone(approvedFormat);
  masterRef.approved_asset.master_ref = 'assets/visual-masters/articles/tokenized-stocks-instant-payments-liquidity-rights/another-master.png';
  check('SUE-669 reviewer exact mutation: approval cannot survive changed master_ref',
    codesOf(masterRef).includes(CODES.APPROVAL_IDENTITY_MISMATCH), codesOf(masterRef).join(', '));
}

{
  // I2. Whitespace is not authorization. minLength:1 stops the empty string and
  // stops there; a single space would otherwise reopen the renderer.
  const job = clone(approvedConcept);
  job.revision.authorization = { authorized_by: ' ', statement: ' ' };
  const c = codesOf(job);
  check('I2 FAIL concept_change authorized by whitespace',
    c.includes(CODES.REVISION_AUTHORIZATION_MISSING), c.join(', '));
  check('I2 a whitespace authorization does not reopen the renderer (job stays sealed)',
    isRegenerationSealed(job) && c.includes(CODES.REGENERATION_FORBIDDEN));

  const edit = clone(approvedConcept);
  edit.revision = {
    intent: 'local_edit', preserve_visual_identity: true, regeneration_allowed: true,
    authorization: {
      authorized_by: 'suengjae-hong', statement: 'fix the arrow',
      bounded_delta: ['  '], protected_invariants: ['  '],
    },
  };
  check('I2 FAIL local_edit bounded by whitespace-only delta and invariants',
    codesOf(edit).includes(CODES.REVISION_AUTHORIZATION_MISSING));
}

{
  // I3. The declared format must describe the artifact the lock points at, so
  // "svg" cannot walk past the raster geometry requirement on a .png master.
  const job = clone(approvedFormat);
  job.approved_asset.format = 'svg';
  job.approved_asset.native_geometry = { view_box: '0 0 2400 1350' };
  check('I3 FAIL format "svg" declared on a master_ref ending .png',
    codesOf(job).includes(CODES.APPROVED_IDENTITY_INCOMPLETE), codesOf(job).join(', '));
}

{
  // I1. Three enforcement branches survived mutation testing with the suite
  // still green — correct behaviour, but nothing held them in place.
  const noFlag = clone(approvedConcept);
  noFlag.revision.regeneration_allowed = false;
  check('I1 FAIL a reopening intent that does not declare regeneration_allowed',
    codesOf(noFlag).includes(CODES.APPROVAL_FLAGS_INCONSISTENT), codesOf(noFlag).join(', '));

  const drifting = clone(approvedConcept);
  drifting.revision = {
    intent: 'local_edit', preserve_visual_identity: false, regeneration_allowed: true,
    authorization: {
      authorized_by: 'suengjae-hong', statement: 'fix the arrow only',
      bounded_delta: ['reverse the arrow'], protected_invariants: ['every label'],
    },
  };
  check('I1 FAIL local_edit that abandons preserve_visual_identity',
    codesOf(drifting).includes(CODES.APPROVAL_FLAGS_INCONSISTENT), codesOf(drifting).join(', '));

  const hollowVector = clone(approvedFormat);
  hollowVector.approved_asset.format = 'svg';
  hollowVector.approved_asset.master_ref = 'assets/visual-masters/articles/x/plate.svg';
  hollowVector.approved_asset.native_geometry = {};
  check('I1 FAIL a locked vector master with empty native_geometry',
    codesOf(hollowVector).includes(CODES.APPROVED_IDENTITY_INCOMPLETE), codesOf(hollowVector).join(', '));
}

// --- delta re-review: the compiler must not disagree with the validator ----
console.log('\ncompiler and validator agree (SUE-639 delta review)');
{
  // The seal answers "locked and unauthorized". A record that launders the
  // lock rather than tripping it was still compiling here and failing only at
  // validation — so `--compile` was a door back to a generative prompt off a
  // demoted approved master.
  const demoted = clone(approvedFormat);
  demoted.approved_asset.state = 'candidate';
  demoted.renderer_route = 'generative';
  let threw = false;
  try { compileVisualPrompt(demoted, { profiles }); } catch (err) { threw = err instanceof RegenerationSealedError; }
  check('compileVisualPrompt refuses a demoted approved master (B2 shape)', threw);

  // hasAuthorizedReopen does not consult the identity flags, so these two
  // compiled while validation rejected them.
  const conceptPreserving = clone(approvedConcept);
  conceptPreserving.revision.preserve_visual_identity = true;
  check('compileVisualPrompt refuses a concept_change claiming preserved identity',
    (() => { try { compileVisualPrompt(conceptPreserving, { profiles }); return false; } catch (e) { return e instanceof RegenerationSealedError; } })());

  const editDrifting = clone(approvedConcept);
  editDrifting.revision = {
    intent: 'local_edit', preserve_visual_identity: false, regeneration_allowed: true,
    authorization: {
      authorized_by: 'suengjae-hong', statement: 'fix the arrow',
      bounded_delta: ['reverse the arrow'], protected_invariants: ['every label'],
    },
  };
  check('compileVisualPrompt refuses a local_edit that abandons preserve_visual_identity',
    (() => { try { compileVisualPrompt(editDrifting, { profiles }); return false; } catch (e) { return e instanceof RegenerationSealedError; } })());

  // The compiler-side seal conditions themselves, which the validator's
  // equivalents were covering for.
  const noFlag = clone(approvedConcept);
  noFlag.revision.regeneration_allowed = false;
  check('compileVisualPrompt refuses a reopening intent with regeneration_allowed false',
    isRegenerationSealed(noFlag) &&
    (() => { try { compileVisualPrompt(noFlag, { profiles }); return false; } catch (e) { return e instanceof RegenerationSealedError; } })());

  const unbounded = clone(approvedConcept);
  unbounded.revision = {
    intent: 'local_edit', preserve_visual_identity: true, regeneration_allowed: true,
    authorization: { authorized_by: 'suengjae-hong', statement: 'fix it' },
  };
  check('compileVisualPrompt refuses a local_edit with no bounded delta',
    isRegenerationSealed(unbounded) &&
    (() => { try { compileVisualPrompt(unbounded, { profiles }); return false; } catch (e) { return e instanceof RegenerationSealedError; } })());
  check('hasAuthorizedReopen is false for an unbounded local_edit', !hasAuthorizedReopen(unbounded));

  // A date nobody can look up is not an audit trail. Date.parse is lenient
  // about day overflow — it rolls 2025-02-29 into March rather than failing —
  // so the check round-trips instead of merely parsing.
  for (const d of ['0000-00-00', '2026-13-01', '2025-02-29', '2026-02-30', '2026-04-31']) {
    const badDate = clone(approvedFormat);
    badDate.approved_asset.approved_at = d;
    check(`FAIL approved_at "${d}" is date-shaped but is not a real calendar date`,
      codesOf(badDate).includes(CODES.APPROVAL_ATTRIBUTION_MISSING));
  }
  for (const d of ['2024-02-29', '2026-09-05', '9999-12-31']) {
    const okDate = clone(approvedFormat);
    okDate.approved_asset.approved_at = d;
    check(`PASS approved_at "${d}" is a real date`,
      !codesOf(okDate).includes(CODES.APPROVAL_ATTRIBUTION_MISSING), codesOf(okDate).join(', '));
  }

  // The refusal message has to describe the refusal that actually happened:
  // a demoted record is not "a human_approved_locked master", and telling that
  // caller to declare an authorized intent would be wrong advice.
  const demoted2 = clone(approvedFormat);
  demoted2.approved_asset.state = 'candidate';
  let demotedMessage = '';
  try { compileVisualPrompt(demoted2, { profiles }); } catch (err) { demotedMessage = err.message; }
  check('a lock-finding refusal does not claim the job carries a locked master',
    demotedMessage.includes('unresolved approval-lock finding') &&
    !demotedMessage.includes('carries a human_approved_locked master'), demotedMessage.split('\n')[0]);
  check('and still names the specific finding for diagnosis',
    demotedMessage.includes(CODES.APPROVAL_STATE_INCONSISTENT));

  const sealedMessage = (() => {
    const j = clone(approvedFormat);
    delete j.revision;
    j.renderer_route = 'generative';
    try { compileVisualPrompt(j, { profiles }); return ''; } catch (err) { return err.message; }
  })();
  check('a sealed refusal still explains how to reopen generation legitimately',
    sealedMessage.includes('carries a human_approved_locked master') &&
    sealedMessage.includes('local_edit or concept_change'));

  // And the legitimate paths still compile.
  check('an authorized concept_change still compiles after the tightening',
    typeof compileVisualPrompt(clone(approvedConcept), { profiles }).compiled_prompt === 'string');
  check('an ordinary unapproved job still compiles',
    typeof compileVisualPrompt(clone(baseGood), { profiles }).compiled_prompt === 'string');
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

console.log(failures === 0 ? '\nvisual-job: ALL PASS' : `\nvisual-job: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
