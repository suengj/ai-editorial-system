/**
 * Content-type profile engine — AES-P1.4 (SUE-441) and AES-P1.5 (SUE-442).
 *
 * Profiles share the constitution and the voice; they differ in evidence
 * burden, required fields, and which derived artifacts make sense. This
 * module enforces the differences that are mechanically decidable, so a Note
 * cannot quietly acquire a Research burden and a Research piece cannot quietly
 * shed one.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROFILES_ROOT = resolve(HERE, '../../editorial/profiles');
export const PROFILE_DIR = resolve(PROFILES_ROOT, 'content');
export const AXES_FILE = resolve(PROFILES_ROOT, 'axes.json');

export function loadProfiles(dir = PROFILE_DIR) {
  const out = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const p = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
    out[p.content_type] = p;
  }
  return out;
}

/**
 * The axis registry (AES-V2.2 / SUE-560): every axis this system recognises,
 * whether or not it is populated yet. Adding an axis is adding a row here,
 * never a code change — nothing below hardcodes an axis id.
 */
export function loadAxes(file = AXES_FILE) {
  const registry = JSON.parse(readFileSync(file, 'utf8'));
  return registry.axes;
}

/**
 * Load every profile file under an axis's declared directory, keyed by the
 * profile's own id field. Which field that is comes from axes.json's
 * `id_field` for that axis, so no axis id or field name is hardcoded here.
 */
export function loadAxisProfiles(axisId, { axes = loadAxes(), root = PROFILES_ROOT } = {}) {
  const axis = axes.find((a) => a.axis === axisId);
  if (!axis) throw new Error(`unknown axis "${axisId}"`);
  if (!axis.populated) return {};

  const dir = resolve(root, axis.dir);
  const out = {};
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const profile = JSON.parse(readFileSync(resolve(dir, f), 'utf8'));
    const id = profile[axis.id_field] ?? f.replace(/\.json$/, '');
    out[id] = profile;
  }
  return out;
}

export const CODES = Object.freeze({
  UNKNOWN_TYPE: 'unknown-content-type',
  EVIDENCE_BURDEN: 'evidence-burden',
  SOURCE_ROLE: 'missing-source-role',
  TYPE_FIELD: 'missing-type-field',
  FRAME_FIELD: 'missing-frame-field',
  LENGTH_LIMIT: 'length-limit',
  FRESHNESS: 'source-freshness',
  ARTIFACT_FIT: 'artifact-not-appropriate',
  REPO_EVIDENCE: 'repo-prose-as-evidence',
});

const issue = (code, where, message) => ({ code, where, message });

const wordCount = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;

/**
 * Check an article (and optionally its body and artifacts) against the
 * profile for its content type.
 */
export function validateAgainstProfile(article, { body = null, artifacts = [], profiles = loadProfiles() } = {}) {
  const issues = [];
  const where = article?.article_id ?? '<article>';
  const profile = profiles[article?.content_type];

  if (!profile) {
    return [issue(CODES.UNKNOWN_TYPE, where, `no profile for content_type "${article?.content_type}"`)];
  }

  const { evidence_burden: burden } = profile;
  const sources = article?.source_set ?? [];
  const claims = article?.verification?.claims ?? [];
  const verified = claims.filter((c) => c.status === 'verified');

  // --- evidence burden ----------------------------------------------------
  if (sources.length < burden.min_sources) {
    issues.push(issue(CODES.EVIDENCE_BURDEN, where,
      `${profile.content_type} requires at least ${burden.min_sources} source(s), found ${sources.length} — ${burden.rationale}`));
  }
  if (verified.length < burden.min_verified_claims) {
    issues.push(issue(CODES.EVIDENCE_BURDEN, where,
      `${profile.content_type} requires at least ${burden.min_verified_claims} verified claim(s), found ${verified.length}`));
  }
  const roles = new Set(sources.map((s) => s.role));
  for (const role of burden.min_source_roles ?? []) {
    if (!roles.has(role)) {
      issues.push(issue(CODES.SOURCE_ROLE, where,
        `${profile.content_type} requires a source with role "${role}" — ${burden.rationale}`));
    }
  }

  // --- required frame and type fields -------------------------------------
  for (const field of profile.required_frame_fields ?? []) {
    const v = article?.frame?.[field];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0) || v === '') {
      issues.push(issue(CODES.FRAME_FIELD, where, `${profile.content_type} requires frame.${field}`));
    }
  }
  for (const field of profile.required_type_fields ?? []) {
    const v = article?.type_fields?.[field];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0) || v === '') {
      issues.push(issue(CODES.TYPE_FIELD, where,
        `${profile.content_type} requires type_fields.${field}`));
    }
  }

  // --- length limit (a Note must stay a Note) -----------------------------
  if (profile.limits?.max_words && body) {
    const words = wordCount(body);
    if (words > profile.limits.max_words) {
      issues.push(issue(CODES.LENGTH_LIMIT, where,
        `${words} words exceeds the ${profile.content_type} limit of ${profile.limits.max_words} — ${profile.limits.rationale}`));
    }
  }

  // --- freshness ----------------------------------------------------------
  if (profile.freshness?.max_source_age_days && article?.type_fields?.event_date) {
    const event = Date.parse(article.type_fields.event_date);
    const verifiedAt = Date.parse(article?.verification?.verified_at ?? '');
    if (!Number.isNaN(event) && !Number.isNaN(verifiedAt)) {
      const ageDays = (verifiedAt - event) / 86_400_000;
      if (ageDays > profile.freshness.max_source_age_days) {
        issues.push(issue(CODES.FRESHNESS, where,
          `event is ${Math.round(ageDays)} days before verification, over the ${profile.freshness.max_source_age_days}-day limit — ${profile.freshness.rationale}`));
      }
    }
  }

  // --- project: repository prose is a claim, not evidence ------------------
  if (profile.source_rules?.requires_pinned_ref) {
    for (const s of sources) {
      if (s.source_id?.startsWith('src:github:') && !s.pinned_ref) {
        issues.push(issue(CODES.REPO_EVIDENCE, where,
          `source ${s.source_id} needs a pinned_ref — ${profile.source_rules.rationale}`));
      }
    }
  }

  // --- artifact fit -------------------------------------------------------
  for (const a of artifacts) {
    if ((profile.artifacts?.inappropriate ?? []).includes(a.kind)) {
      issues.push(issue(CODES.ARTIFACT_FIT, a.artifact_id ?? a.kind,
        `"${a.kind}" is not an appropriate artifact for a ${profile.content_type}`));
    }
  }

  return issues;
}

/** Artifacts a profile expects by default, for planning rather than validation. */
export function defaultArtifacts(contentType, profiles = loadProfiles()) {
  return profiles[contentType]?.artifacts?.default ?? [];
}
