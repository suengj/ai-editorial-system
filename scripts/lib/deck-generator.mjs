/**
 * Deck generator — AES-P4.3 (SUE-454).
 *
 * Compiles a Marp-compatible Markdown deck from one article version and the
 * plan-artifacts narrative. The deck source stays Markdown end to end:
 * article → deck source → rendered deck, each step diffable and re-runnable.
 *
 * Theme is a name, not a stylesheet. Which colours and type that name resolves
 * to is suengj-com's decision, exactly as in the presentation contract.
 */

export const GENERATOR_VERSION = '1.0.0';

export class DeckRefusal extends Error {}

export function generateDeck(article, decision, { theme = 'suengj' } = {}) {
  if (decision?.kind !== 'slides') {
    throw new DeckRefusal(`expected a slides decision, got "${decision?.kind}"`);
  }
  if (decision.verdict === 'skip') {
    throw new DeckRefusal('the plan skipped slides for this article');
  }
  if (!['final', 'published'].includes(article?.state)) {
    throw new DeckRefusal(`distribution artifact requires article state final or published, got "${article?.state}"`);
  }
  if (!article?.version?.content_hash || !article?.version?.claims_hash) {
    throw new DeckRefusal('article has no version identity');
  }

  const narrative = decision.spec?.narrative ?? [];
  if (narrative.length === 0) {
    throw new DeckRefusal('a deck needs an argument beat per page; without one it is a slideshow of the article');
  }

  const target = decision.spec?.page_target;
  if (target && Math.abs(narrative.length - target) > 1) {
    throw new DeckRefusal(`narrative has ${narrative.length} beats against a page target of ${target}`);
  }

  const verified = new Map(
    (article.verification?.claims ?? [])
      .filter((c) => c.status === 'verified')
      .map((c) => [c.claim_id, c]),
  );
  for (const id of decision.carries_claims ?? []) {
    if (!verified.has(id)) {
      throw new DeckRefusal(`claim "${id}" is not verified on the article; a deck may not introduce a claim`);
    }
  }

  const slug = article.article_id.slice('art:'.length);
  const out = [];

  out.push('---');
  out.push('marp: true');
  out.push(`theme: ${theme}`);
  out.push('paginate: true');
  out.push('---');
  out.push('');
  out.push(`<!--`);
  out.push(`artifact: ${article.article_id}#slides`);
  out.push(`article_version: ${article.version.number}`);
  out.push(`content_hash: ${article.version.content_hash}`);
  out.push(`claims_hash: ${article.version.claims_hash}`);
  out.push(`generator: deck-generator ${GENERATOR_VERSION}`);
  out.push(`-->`);
  out.push('');

  out.push(`# ${article.title}`);
  if (article.dek) {
    out.push('');
    out.push(article.dek);
  }
  out.push('');

  for (const beat of narrative) {
    out.push('---');
    out.push('');
    out.push(`## ${beat}`);
    out.push('');
  }

  out.push('---');
  out.push('');
  out.push('## 확인되지 않은 것');
  out.push('');
  for (const u of article.frame?.uncertainty ?? []) out.push(`- ${u}`);
  out.push('');
  out.push(`전문: /content/${slug}`);
  out.push('');

  return out.join('\n');
}
