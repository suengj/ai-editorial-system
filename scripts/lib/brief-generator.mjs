/**
 * Brief generator — AES-P4.1 (SUE-452).
 *
 * Compiles a Brief from one article version plus the plan-artifacts decision
 * that authorised it. Deterministic by construction: the same article version
 * and the same plan produce byte-identical output.
 *
 * The generator cannot introduce a claim. It carries only the claim_ids the
 * plan names, and it refuses if any of them is not verified on the article.
 * A Brief is a door to the article, never a second article.
 */

import { createHash } from 'node:crypto';

export const GENERATOR_VERSION = '1.0.0';

export class BriefRefusal extends Error {}

export function generateBrief(article, decision) {
  if (!article?.version?.content_hash || !article?.version?.claims_hash) {
    throw new BriefRefusal('article has no version identity; nothing built from it could ever be classified stale');
  }
  if (decision?.kind !== 'brief') {
    throw new BriefRefusal(`expected a brief decision, got "${decision?.kind}"`);
  }
  if (decision.verdict === 'skip') {
    throw new BriefRefusal('the plan skipped the brief for this article');
  }
  if (!['final', 'published'].includes(article.state)) {
    throw new BriefRefusal(`distribution artifact requires article state final or published, got "${article.state}"`);
  }

  const verified = new Map(
    (article.verification?.claims ?? [])
      .filter((c) => c.status === 'verified')
      .map((c) => [c.claim_id, c]),
  );

  const carried = decision.carries_claims ?? [];
  if (carried.length === 0) {
    throw new BriefRefusal('a brief asserts facts and must name the claims it carries');
  }
  for (const id of carried) {
    if (!verified.has(id)) {
      throw new BriefRefusal(`claim "${id}" is not verified on the article; a brief may not introduce a claim`);
    }
  }

  const hierarchy = decision.spec?.hierarchy ?? [];
  if (hierarchy.length === 0) {
    throw new BriefRefusal('a brief needs an information hierarchy; without one it is a summary blob');
  }

  const uncertainty = article.frame?.uncertainty ?? [];
  if (uncertainty.length === 0) {
    throw new BriefRefusal('the article states no uncertainty; a brief that drops it would overstate the piece');
  }

  const slug = article.article_id.slice('art:'.length);
  const lines = [];

  // Lineage first, as a comment: a Brief must always say what it derives from.
  lines.push('<!--');
  lines.push(`artifact: ${article.article_id}#brief`);
  lines.push(`article_version: ${article.version.number}`);
  lines.push(`content_hash: ${article.version.content_hash}`);
  lines.push(`claims_hash: ${article.version.claims_hash}`);
  lines.push(`generator: brief-generator ${GENERATOR_VERSION}`);
  lines.push(`skill: ${decision.planned_by ?? 'plan-artifacts'}`);
  lines.push('-->');
  lines.push('');

  lines.push(`# ${article.title}`);
  lines.push('');
  if (article.dek) {
    lines.push(article.dek);
    lines.push('');
  }

  lines.push('## 요점');
  lines.push('');
  for (const point of hierarchy) lines.push(`- ${point}`);
  lines.push('');

  lines.push('## 근거');
  lines.push('');
  for (const id of carried) {
    const claim = verified.get(id);
    const cite = (claim.evidence ?? [])
      .map((e) => `[${e.title ?? e.url}](${e.url})`)
      .join(', ');
    lines.push(`- ${claim.text}${cite ? ` — ${cite}` : ''}`);
  }
  lines.push('');

  lines.push('## 확인되지 않은 것');
  lines.push('');
  for (const u of uncertainty) lines.push(`- ${u}`);
  lines.push('');

  lines.push(`전문: [/content/${slug}](/content/${slug})`);
  lines.push('');

  return lines.join('\n');
}

/** Stable digest of a generated artifact, for regeneration checks. */
export const digest = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
