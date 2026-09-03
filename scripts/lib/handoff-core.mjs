/**
 * Cross-repo handoff — AES-P6.1 (SUE-459).
 *
 * Builds and checks what ai-editorial-system hands to suengj-com.
 *
 * The serialization decision this implements: semantic roles travel as a
 * **front-matter sidecar with text anchors**, not as body syntax. The body
 * stays plain Markdown that the existing gray-matter + marked pipeline already
 * handles, so the handoff requires no renderer change to be safe — only to be
 * useful.
 *
 * Degradation is the design: an anchor that does not match is dropped, an
 * unknown role renders as plain content, and an incompatible major version is
 * refused. In every failure the canonical article still reads correctly.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
export const SCHEMA_PATH = resolve(ROOT, 'schemas/handoff-receipt.schema.json');

export const loadSchema = (p = SCHEMA_PATH) => JSON.parse(readFileSync(p, 'utf8'));

export const CONTRACT_VERSION = '1.0.0';

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  BODY_DRIFT: 'body-digest-mismatch',
  ANCHOR_UNRESOLVED: 'presentation-anchor-unresolved',
  ANCHOR_AMBIGUOUS: 'presentation-anchor-ambiguous',
  UNKNOWN_ROLE: 'presentation-role-unknown',
  STALE_ARTIFACT: 'stale-artifact-handed-off',
  STATUS_NOT_DRAFT: 'status-not-draft',
  PATH_MISMATCH: 'target-path-mismatch',
  VERSION_INCOMPATIBLE: 'contract-version-incompatible',
  RUNTIME_DEPENDENCY: 'reader-runtime-dependency',
});

/** Roles suengj-com is expected to know in this contract major version. */
export const KNOWN_ROLES = Object.freeze([
  'key_point', 'evidence', 'caution', 'comparison', 'procedure',
  'example', 'code_example', 'data_table', 'timeline', 'visual_ref',
]);

const CONTENT_TYPE_TO_COLLECTION = Object.freeze({
  note: 'notes', research: 'research', view: 'views', project: 'projects', news: 'editorial',
});
const CONTENT_TYPE_TO_SITE_TYPE = Object.freeze({
  note: 'note', research: 'research', view: 'view', project: 'project', news: 'editorial',
});

export const digest = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const issue = (code, where, message) => ({ code, where, message });

/**
 * Build the receipt for a finalized article.
 * Deterministic: same inputs produce the same receipt except `produced_at`.
 */
export function buildReceipt(article, body, {
  artifacts = [], presentationPlan = null, evidence = {}, producedAt,
} = {}) {
  const slug = article.article_id.slice('art:'.length);
  const collection = CONTENT_TYPE_TO_COLLECTION[article.content_type];

  const front = {
    type: CONTENT_TYPE_TO_SITE_TYPE[article.content_type],
    title: article.title,
    date: article.version?.date ?? (article.review?.reviewed_at ?? '').slice(0, 10),
    status: 'draft',
    provenance: {
      article_version: article.version.number,
      content_hash: article.version.content_hash,
      claims_hash: article.version.claims_hash,
      ...(article.version.commit ? { commit: article.version.commit } : {}),
    },
    ai_assistance: { disclosed: true, scope: 'draft_generation,verification' },
  };

  const citations = (article.verification?.claims ?? [])
    .filter((c) => c.status === 'verified')
    .flatMap((c) => (c.evidence ?? []).map((e) => ({
      id: c.claim_id, label: e.title ?? e.url, url: e.url,
    })));
  if (citations.length > 0) front.citations = citations;

  /*
   * The answer unit crosses the boundary resolved, not by reference: the site
   * renders and validates it without reading this repository's claim store.
   * Claim text and supporting URLs are copied from the verified claim, so the
   * site can never publish an answer whose support this repo did not record.
   */
  if (article.answer) {
    const claimsById = new Map((article.verification?.claims ?? []).map((c) => [c.claim_id, c]));
    front.answer = {
      question: article.answer.question,
      summary: article.answer.summary,
      ...((article.answer.claims ?? []).length > 0
        ? {
            claims: article.answer.claims.map((ref) => {
              const claim = claimsById.get(ref.claim_id);
              const support = (claim?.evidence ?? []).map((e) => e.url);
              return {
                id: ref.claim_id,
                text: claim?.text ?? '',
                kind: ref.kind,
                anchor: ref.anchor,
                ...(support.length > 0 ? { support } : {}),
              };
            }),
          }
        : {}),
    };
  }

  const receipt = {
    schema_version: CONTRACT_VERSION,
    article_id: article.article_id,
    produced_at: producedAt,
    target: {
      path: `content/${collection}/${slug}.md`,
      canonical_url: `/content/${slug}`,
      status: 'draft',
    },
    front_matter: front,
    body_sha256: digest(body),
    artifacts: artifacts.map((a) => ({
      artifact_id: a.artifact_id,
      kind: a.kind,
      staleness: a.staleness?.level ?? 'unknown',
      location: a.location?.path ?? a.location?.kind ?? 'pending',
    })),
  };

  if (presentationPlan) {
    receipt.presentation = {
      schema_version: presentationPlan.schema_version ?? '1.0.0',
      blocks: (presentationPlan.blocks ?? []).map((b) => ({
        role: b.role,
        anchor: b.fallback ?? b.content,
      })),
    };
  }
  if (Object.keys(evidence).length > 0) receipt.evidence = evidence;

  return receipt;
}

/**
 * Resolve the presentation sidecar against the body, the way a renderer would.
 * Returns { applied, dropped } — never throws, because a renderer must not
 * fail a build over presentation metadata.
 */
export function resolvePresentation(receipt, body, { knownRoles = KNOWN_ROLES } = {}) {
  const applied = [];
  const dropped = [];

  const major = (v) => Number(String(v).split('.')[0]);
  if (receipt?.presentation && major(receipt.presentation.schema_version) !== major(CONTRACT_VERSION)) {
    return {
      applied: [],
      dropped: (receipt.presentation.blocks ?? []).map((b) => ({ ...b, reason: 'incompatible-major-version' })),
    };
  }

  for (const b of receipt?.presentation?.blocks ?? []) {
    if (!knownRoles.includes(b.role)) {
      dropped.push({ ...b, reason: 'unknown-role' });   // degrades to plain content
      continue;
    }
    const count = occurrences(body, b.anchor);
    if (count === 0) dropped.push({ ...b, reason: 'anchor-not-found' });
    else if (count > 1) dropped.push({ ...b, reason: 'anchor-ambiguous' });
    else applied.push(b);
  }

  return { applied, dropped };
}

function occurrences(haystack, needle) {
  if (!needle) return 0;
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) { n += 1; i = haystack.indexOf(needle, i + needle.length); }
  return n;
}

/** Validate a receipt before a suengj-com change is opened. */
export function validateReceipt(receipt, body = null, {
  schema = loadSchema(), acceptedMajors = [1], strictPresentation = true,
} = {}) {
  const issues = [];
  const where = receipt?.article_id ?? '<receipt>';

  for (const e of validate(receipt, schema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }

  const major = Number(String(receipt?.schema_version ?? '').split('.')[0]);
  if (!acceptedMajors.includes(major)) {
    issues.push(issue(CODES.VERSION_INCOMPATIBLE, where,
      `contract major ${major} is not accepted (accepted: ${acceptedMajors.join(', ')}); a mismatch is refused rather than guessed at`));
  }

  if (receipt?.target?.status !== 'draft') {
    issues.push(issue(CODES.STATUS_NOT_DRAFT, where,
      'handoff always targets status draft; publication is a separate human act inside suengj-com'));
  }

  const slug = typeof receipt?.article_id === 'string' ? receipt.article_id.slice('art:'.length) : null;
  if (slug && receipt?.target?.canonical_url !== `/content/${slug}`) {
    issues.push(issue(CODES.PATH_MISMATCH, where, `canonical_url must be /content/${slug}`));
  }

  for (const a of receipt?.artifacts ?? []) {
    if (a.staleness === 'material' || a.staleness === 'unknown') {
      issues.push(issue(CODES.STALE_ARTIFACT, a.artifact_id,
        `artifact is ${a.staleness}; a stale artifact may not be handed off as current`));
    }
  }

  // Nothing in the front matter may require our code to interpret.
  const fm = JSON.stringify(receipt?.front_matter ?? {});
  if (/ai-editorial-system|skills\/|scripts\/lib/.test(fm)) {
    issues.push(issue(CODES.RUNTIME_DEPENDENCY, where,
      'front matter references editorial-system internals; a reader must never need our code to render a published article'));
  }

  if (body !== null) {
    if (digest(body) !== receipt?.body_sha256) {
      issues.push(issue(CODES.BODY_DRIFT, where, 'body digest does not match the receipt'));
    }
    const { dropped } = resolvePresentation(receipt, body);
    if (strictPresentation) {
      for (const d of dropped) {
        const code = d.reason === 'unknown-role' ? CODES.UNKNOWN_ROLE
          : d.reason === 'anchor-ambiguous' ? CODES.ANCHOR_AMBIGUOUS
            : CODES.ANCHOR_UNRESOLVED;
        issues.push(issue(code, d.role ?? '<block>',
          `presentation block dropped (${d.reason}); it degrades safely but should be fixed before handoff`));
      }
    }
  }

  return issues;
}

export function validateReceiptFile(path, bodyPath = null, options = {}) {
  let receipt;
  try {
    receipt = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable receipt: ${err.message}`)];
  }
  const body = bodyPath ? readFileSync(bodyPath, 'utf8') : null;
  return validateReceipt(receipt, body, options);
}
