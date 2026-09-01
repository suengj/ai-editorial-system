/**
 * Artifact plan engine — AES-P2.6 (SUE-448).
 *
 * Validates a plan against schemas/artifact-plan.schema.json plus the
 * cross-object rules that make a plan handable to any generator: the claims
 * it carries must be verified on the article, the kinds it plans must fit the
 * content type, and distribution kinds must not precede finalization.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { loadProfiles } from './profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
export const PLAN_SCHEMA = resolve(ROOT, 'schemas/artifact-plan.schema.json');

export const loadSchema = (p = PLAN_SCHEMA) => JSON.parse(readFileSync(p, 'utf8'));

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  UNVERIFIED_CLAIM: 'carries-unverified-claim',
  ARTIFACT_FIT: 'kind-not-appropriate',
  DISTRIBUTION_GATE: 'distribution-before-final',
  LINEAGE_MISMATCH: 'article-ref-mismatch',
  MISSING_CLAIMS: 'fact-bearing-without-claims',
  SILENT_OMISSION: 'kind-not-considered',
  MISSING_QUESTION: 'evidence-visual-without-question',
});

const FACT_BEARING = new Set(['brief', 'slides', 'infographic', 'audio', 'video', 'evidence_visual']);
const DISTRIBUTION = new Set(['brief', 'full', 'slides', 'infographic', 'audio', 'video']);
const ALL_KINDS = ['brief', 'full', 'sources', 'evidence_visual', 'slides', 'infographic', 'audio', 'video'];
const FINAL_STATES = new Set(['final', 'published']);

const issue = (code, where, message) => ({ code, where, message });

/** Validate a plan, optionally against the article it plans for. */
export function validatePlan(plan, article = null, { schema = loadSchema(), profiles = loadProfiles() } = {}) {
  const issues = [];
  const where = plan?.article_ref?.article_id ?? '<plan>';

  for (const e of validate(plan, schema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }

  const decisions = plan?.decisions ?? [];
  const considered = new Set(decisions.map((d) => d.kind));
  for (const kind of ALL_KINDS) {
    if (!considered.has(kind)) {
      issues.push(issue(CODES.SILENT_OMISSION, where,
        `"${kind}" was not considered; a silent omission is indistinguishable from an oversight — record a skip with a reason`));
    }
  }

  for (const d of decisions) {
    if (d.verdict === 'skip') continue;

    if (FACT_BEARING.has(d.kind) && !(d.carries_claims?.length > 0)) {
      issues.push(issue(CODES.MISSING_CLAIMS, d.kind,
        `"${d.kind}" asserts facts; a non-skipped plan must name the claims it carries`));
    }
    if (d.kind === 'evidence_visual' && !d.spec?.question) {
      issues.push(issue(CODES.MISSING_QUESTION, d.kind,
        'an evidence visual needs the single question it must answer; without one it is decoration'));
    }
  }

  if (!article) return issues;

  // --- lineage --------------------------------------------------------------
  const ref = plan?.article_ref ?? {};
  const v = article.version ?? {};
  if (ref.article_id !== article.article_id ||
      ref.content_hash !== v.content_hash ||
      ref.claims_hash !== v.claims_hash) {
    issues.push(issue(CODES.LINEAGE_MISMATCH, where,
      'article_ref does not match the article version it claims to plan for'));
  }

  // --- claims must be verified ---------------------------------------------
  const verified = new Set((article.verification?.claims ?? [])
    .filter((c) => c.status === 'verified')
    .map((c) => c.claim_id));
  for (const d of decisions) {
    for (const id of d.carries_claims ?? []) {
      if (!verified.has(id)) {
        issues.push(issue(CODES.UNVERIFIED_CLAIM, d.kind,
          `plans to carry claim "${id}", which is not verified on the article`));
      }
    }
  }

  // --- fit and stage --------------------------------------------------------
  const profile = profiles[article.content_type];
  for (const d of decisions) {
    if (d.verdict === 'skip') continue;
    if ((profile?.artifacts?.inappropriate ?? []).includes(d.kind)) {
      issues.push(issue(CODES.ARTIFACT_FIT, d.kind,
        `"${d.kind}" is not appropriate for a ${article.content_type}`));
    }
    if (DISTRIBUTION.has(d.kind) && !FINAL_STATES.has(article.state)) {
      issues.push(issue(CODES.DISTRIBUTION_GATE, d.kind,
        `distribution artifact planned for an article in state "${article.state}"`));
    }
  }

  return issues;
}

export function validatePlanFile(path, article = null, options = {}) {
  let plan;
  try {
    plan = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable plan: ${err.message}`)];
  }
  return validatePlan(plan, article, options);
}
