/**
 * Corpus axis-membership check — AES-V2 FIX (I1).
 *
 * schemas/corpus-entry.schema.json's `audience` and `surface` fields were
 * closed enums duplicating (and hardcoding suengj.com's default surface
 * into) the audience/surface axis vocabulary that
 * editorial/profiles/{audience,surface}/*.json already own
 * (docs/architecture/V2-EDITORIAL-LEARNING-CORE.md §8's extension rule: a
 * new audience or surface is data, added under the matching axis directory,
 * never a schema edit). The schema now accepts any axis-id-shaped string;
 * this module is the real membership check, kept out of
 * scripts/lib/corpus-core.mjs so this fix does not touch a file another
 * concurrent Writer owns.
 *
 * Mirrors the resolution scripts/validate-profiles.mjs and
 * scripts/validate-intent.mjs already perform for other axes: an id must
 * resolve to a profile file actually present under the axis directory.
 */

import { loadAxes, loadAxisProfiles, PROFILES_ROOT } from './profile-core.mjs';

export const CODES = Object.freeze({
  UNKNOWN_AUDIENCE: 'unknown-audience-profile',
  UNKNOWN_SURFACE: 'unknown-surface-profile',
});

const issue = (code, where, message) => ({ code, where, message });

/**
 * Check one corpus entry's `audience` and `surface` fields resolve to a real
 * profile file under their axis directory. Returns an array of issues; empty
 * means both fields resolve.
 */
export function checkCorpusAxisReferences(entry, { axes = loadAxes(), root = PROFILES_ROOT } = {}) {
  const issues = [];
  const where = entry?.entry_id ?? '<entry>';

  const audiences = loadAxisProfiles('audience', { axes, root });
  if (entry.audience !== undefined && !(entry.audience in audiences)) {
    issues.push(issue(CODES.UNKNOWN_AUDIENCE, where,
      `"${entry.audience}" is not a known profile in editorial/profiles/audience/`));
  }

  const surfaces = loadAxisProfiles('surface', { axes, root });
  if (entry.surface !== undefined && !(entry.surface in surfaces)) {
    issues.push(issue(CODES.UNKNOWN_SURFACE, where,
      `"${entry.surface}" is not a known profile in editorial/profiles/surface/`));
  }

  return issues;
}
