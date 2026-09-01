/**
 * Artifact lineage operations — AES-P4.4 (SUE-455).
 *
 * Lineage is carried by the recorded article version, not by where a file
 * lives. Moving an artifact changes its location and nothing else.
 *
 * Two rules that need code rather than documentation:
 *   - A stale artifact cannot be presented as current merely because its file
 *     still exists.
 *   - Review and verification status are not inherited across regeneration.
 */

import { computeStaleness } from './article-contract-core.mjs';

/**
 * Explicit, machine-readable staleness record for an artifact against the
 * current article version.
 */
export function classifyArtifact(artifact, article, { now = null } = {}) {
  const level = computeStaleness(artifact?.article_ref, article?.version);

  if (level === null) {
    // Fail-safe: an artifact we cannot classify is treated as requiring
    // review, never as current.
    return {
      level: 'unknown',
      presentable: false,
      requires: 'review',
      reason: 'lineage is incomplete; an artifact that cannot be classified is not current',
      checked_at: now,
      against_version: article?.version?.number ?? null,
    };
  }

  const presentable = level === 'fresh' || level === 'cosmetic';
  return {
    level,
    presentable,
    requires: level === 'material' ? 'regeneration' : level === 'cosmetic' ? 'optional-regeneration' : 'nothing',
    reason: level === 'material'
      ? 'the article\'s verified claims changed; the artifact may assert something the article no longer says'
      : level === 'cosmetic'
        ? 'prose changed but the verified claims did not'
        : 'the artifact matches the current article version',
    checked_at: now,
    against_version: article?.version?.number ?? null,
  };
}

/** True when an artifact may be shown to a reader as current. */
export function isPresentable(artifact, article) {
  return classifyArtifact(artifact, article).presentable;
}

/**
 * Rebind an artifact to a new article version.
 *
 * Review and verification status are deliberately dropped: an artifact that
 * was approved against version 3 has not been approved against version 4, and
 * inheriting that approval would launder a human decision onto content the
 * human never saw.
 */
export function regenerate(artifact, article, { generatedAt = null } = {}) {
  const { verified_at: _dropped, ...rest } = artifact;
  return {
    ...rest,
    article_ref: {
      ...artifact.article_ref,
      article_id: article.article_id,
      version_number: article.version.number,
      content_hash: article.version.content_hash,
      claims_hash: article.version.claims_hash,
      ...(article.version.commit ? { commit: article.version.commit } : {}),
    },
    state: 'generated',
    generated_at: generatedAt ?? artifact.generated_at,
    staleness: {
      level: 'fresh',
      checked_at: generatedAt ?? artifact.generated_at,
      against_version: article.version.number,
    },
  };
}

/** Moving an artifact changes where it is, not what it derives from. */
export function relocate(artifact, location) {
  return { ...artifact, location };
}
