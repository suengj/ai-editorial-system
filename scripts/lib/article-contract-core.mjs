/**
 * Article + Artifact contract core — AES-P0.3 (SUE-436).
 *
 * Structural conformance to article.schema.json / artifact.schema.json plus
 * the cross-field and cross-object invariants they cannot express.
 * See schemas/ARTICLE-ARTIFACT-CONTRACT.md.
 *
 * Fail-closed. Nothing here can produce a published article or an
 * unattributed factual artifact.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = resolve(HERE, '../../schemas');

export function loadSchemas() {
  return {
    article: JSON.parse(readFileSync(resolve(SCHEMA_DIR, 'article.schema.json'), 'utf8')),
    artifact: JSON.parse(readFileSync(resolve(SCHEMA_DIR, 'artifact.schema.json'), 'utf8')),
  };
}

export const CODES = Object.freeze({
  SCHEMA: 'schema',
  PARSE: 'parse',
  FRAME: 'frame-incomplete',
  NO_ARTICLE: 'no-article-reason',
  AUTHORITY: 'lifecycle-authority',
  STATUS_MAP: 'status-mapping',
  PUBLISH_GATE: 'publication-gate',
  PATH_MAP: 'path-mapping',
  MEDIA_STAGE: 'media-stage',
  DISTRIBUTION_GATE: 'distribution-gate',
  CLAIM_LINK: 'claim-link',
  STALENESS: 'staleness',
  ARTIFACT_ID: 'artifact-id',
  TRANSFORMATION: 'transformation',
  VISUAL_RIGHTS: 'visual-rights',
});

/** state → the only `suengj-com` status it may be materialized as. */
export const STATUS_MAP = Object.freeze({
  final: 'draft',
  published: 'published',
  revised: 'draft',
  archived: 'archived',
});

const PRE_MATERIALIZATION = new Set([
  'candidate', 'framed', 'drafted', 'verified', 'polished', 'reviewed',
]);

const HUMAN_ONLY_STATES = new Set(['final', 'published']);

const CONTENT_TYPE_TO_COLLECTION = Object.freeze({
  note: 'notes',
  research: 'research',
  view: 'views',
  project: 'projects',
  news: 'editorial',
});

const EVIDENCE_KINDS = new Set(['evidence_visual', 'sources']);
const DISTRIBUTION_KINDS = new Set(['brief', 'full', 'slides', 'infographic', 'audio', 'video']);
/** Artifact kinds that assert facts on their own and must cite them. */
const FACT_BEARING_KINDS = new Set(['brief', 'slides', 'infographic', 'audio', 'video', 'evidence_visual']);
const DISTRIBUTION_ALLOWED_STATES = new Set(['final', 'published']);

/** States at which the article is materialized and the rights record must hold. */
const MATERIALIZED_STATES = new Set(['final', 'published', 'revised']);

/** Visual artifact kinds that must carry a rights record. */
const VISUAL_KINDS = new Set(['evidence_visual', 'infographic']);
/** Visual classes that reproduce someone else's work. */
const BORROWED_VISUAL_CLASSES = new Set(['screenshot', 'thumbnail', 'source_image', 'remix']);
const OWN_VISUAL_CLASSES = new Set(['generated_chart', 'generated_diagram']);

const issue = (code, where, message) => ({ code, where, message });

/** Validate one process Article. */
export function validateArticle(article, schemas = loadSchemas()) {
  const issues = [];
  const where = article?.article_id ?? '<article>';

  for (const e of validate(article, schemas.article)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }

  const state = article?.state;

  // --- frame completeness ---
  if (article?.frame && Array.isArray(article.frame.uncertainty) && article.frame.uncertainty.length === 0) {
    issues.push(issue(CODES.FRAME, where, 'frame.uncertainty is empty; a frame that admits no uncertainty is not a frame'));
  }

  // --- no_article ---
  if (state === 'no_article' && !article?.no_article_reason) {
    issues.push(issue(CODES.NO_ARTICLE, where, 'state "no_article" requires no_article_reason'));
  }
  if (state && state !== 'no_article' && article?.no_article_reason) {
    issues.push(issue(CODES.NO_ARTICLE, where, `no_article_reason is set but state is "${state}"`));
  }

  // --- authority ---
  if (HUMAN_ONLY_STATES.has(state) && article?.lifecycle_authority !== 'human') {
    issues.push(issue(
      CODES.AUTHORITY, where,
      `state "${state}" requires lifecycle_authority "human"; AI may advance an article no further than "reviewed"`,
    ));
  }

  // --- publication mapping ---
  const pub = article?.publication;
  if (pub) {
    if (PRE_MATERIALIZATION.has(state) || state === 'no_article') {
      issues.push(issue(CODES.STATUS_MAP, where, `state "${state}" must not carry a publication block; nothing is materialized before "final"`));
    } else if (STATUS_MAP[state] && pub.target_status !== STATUS_MAP[state]) {
      issues.push(issue(
        CODES.STATUS_MAP, where,
        `state "${state}" maps to target_status "${STATUS_MAP[state]}", got "${pub.target_status}"`,
      ));
    }

    if (pub.target_status === 'published' && !(pub.approved_by && pub.approved_at)) {
      issues.push(issue(
        CODES.PUBLISH_GATE, where,
        'target_status "published" requires approved_by and approved_at; human finalization is not publication',
      ));
    }

    const slug = typeof article.article_id === 'string' ? article.article_id.slice('art:'.length) : null;
    const expectedCollection = CONTENT_TYPE_TO_COLLECTION[article?.content_type];
    if (slug && expectedCollection && typeof pub.target_path === 'string') {
      const expected = `content/${expectedCollection}/${slug}.md`;
      if (pub.target_path !== expected) {
        issues.push(issue(CODES.PATH_MAP, where, `target_path should be "${expected}", got "${pub.target_path}"`));
      }
    }
    if (slug && pub.canonical_url && pub.canonical_url !== `/content/${slug}`) {
      issues.push(issue(CODES.PATH_MAP, where, `canonical_url should be "/content/${slug}", got "${pub.canonical_url}"`));
    }
  }

  // --- transformation record (AES-P0.4) ---
  if (MATERIALIZED_STATES.has(state)) {
    const t = article?.transformation;
    if (!t) {
      issues.push(issue(
        CODES.TRANSFORMATION, where,
        `state "${state}" requires a transformation record; source-derived work must show original framing before it is materialized`,
      ));
    } else {
      if (t.transcript_shaped === true) {
        issues.push(issue(
          CODES.TRANSFORMATION, where,
          'transcript_shaped is true; a piece that still follows the source\'s order and phrasing may not be materialized',
        ));
      }
      if (t.original_framing !== true) {
        issues.push(issue(CODES.TRANSFORMATION, where, 'original_framing must be true before an article is materialized'));
      }
    }
  }

  return issues;
}

/**
 * Validate one Artifact, optionally against the article it claims to derive
 * from. Without the article, cross-object rules are reported as unverifiable
 * rather than silently skipped.
 */
export function validateArtifact(artifact, article = null, schemas = loadSchemas()) {
  const issues = [];
  const where = artifact?.artifact_id ?? '<artifact>';

  for (const e of validate(artifact, schemas.artifact)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }

  const kind = artifact?.kind;

  // --- id encodes article and kind ---
  if (typeof artifact?.artifact_id === 'string' && artifact?.article_ref?.article_id) {
    const [idArticle, rest] = artifact.artifact_id.split('#');
    if (idArticle !== artifact.article_ref.article_id) {
      issues.push(issue(CODES.ARTIFACT_ID, where, `artifact_id article segment "${idArticle}" does not match article_ref.article_id`));
    }
    if (rest && kind && rest.split('.')[0] !== kind) {
      issues.push(issue(CODES.ARTIFACT_ID, where, `artifact_id kind segment "${rest.split('.')[0]}" does not match kind "${kind}"`));
    }
  }

  // --- media stage matches kind ---
  if (kind) {
    const expected = EVIDENCE_KINDS.has(kind) ? 'evidence' : DISTRIBUTION_KINDS.has(kind) ? 'distribution' : null;
    if (expected && artifact.media_stage !== expected) {
      issues.push(issue(CODES.MEDIA_STAGE, where, `kind "${kind}" is ${expected} media, got media_stage "${artifact.media_stage}"`));
    }
  }

  // --- fact-bearing artifacts must cite ---
  if (FACT_BEARING_KINDS.has(kind) && !(artifact?.source_references?.length > 0)) {
    issues.push(issue(
      CODES.CLAIM_LINK, where,
      `kind "${kind}" asserts facts and requires source_references tying its claims to verified article claims`,
    ));
  }

  // --- visual rights (AES-P0.4) ---
  if (VISUAL_KINDS.has(kind)) {
    const v = artifact?.visual;
    if (!v) {
      issues.push(issue(CODES.VISUAL_RIGHTS, where, `kind "${kind}" requires a visual rights record`));
    } else {
      if (v.rights_basis === 'unclear' && v.embedded !== false) {
        issues.push(issue(
          CODES.VISUAL_RIGHTS, where,
          'rights_basis is unclear; the visual may be referenced by link but never embedded — set embedded: false',
        ));
      }
      if (BORROWED_VISUAL_CLASSES.has(v.visual_class)) {
        if (v.rights_basis === 'own_work') {
          issues.push(issue(CODES.VISUAL_RIGHTS, where, `visual_class "${v.visual_class}" reproduces someone else's work and cannot claim own_work`));
        }
        if (v.embedded === true && !v.attribution) {
          issues.push(issue(CODES.VISUAL_RIGHTS, where, `embedded "${v.visual_class}" requires attribution`));
        }
        if (v.embedded === true && v.rights_basis === 'licensed' && !v.license) {
          issues.push(issue(CODES.VISUAL_RIGHTS, where, 'rights_basis "licensed" requires a named license'));
        }
      }
      if (OWN_VISUAL_CLASSES.has(v.visual_class) && v.rights_basis !== 'own_work') {
        issues.push(issue(CODES.VISUAL_RIGHTS, where, `visual_class "${v.visual_class}" is our own work; rights_basis should be own_work`));
      }
    }
  }

  if (!article) return issues;

  // --- cross-object: distribution gate ---
  if (artifact?.media_stage === 'distribution' && !DISTRIBUTION_ALLOWED_STATES.has(article.state)) {
    issues.push(issue(
      CODES.DISTRIBUTION_GATE, where,
      `distribution media requires article state "final" or "published", article is "${article.state}"`,
    ));
  }
  if (artifact?.media_stage === 'evidence' && article.state === 'candidate') {
    issues.push(issue(CODES.DISTRIBUTION_GATE, where, 'evidence media requires an article frame; article is still "candidate"'));
  }

  // --- cross-object: claim resolution ---
  const claimIds = new Set((article.verification?.claims ?? [])
    .filter((c) => c.status === 'verified')
    .map((c) => c.claim_id));
  for (const ref of artifact?.source_references ?? []) {
    if (!claimIds.has(ref.claim_id)) {
      issues.push(issue(
        CODES.CLAIM_LINK, where,
        `source_reference claim_id "${ref.claim_id}" does not resolve to a verified claim on the article`,
      ));
    }
  }

  // --- cross-object: staleness is computed, never asserted ---
  const computed = computeStaleness(artifact?.article_ref, article?.version);
  if (artifact?.staleness && computed && artifact.staleness.level !== computed) {
    issues.push(issue(
      CODES.STALENESS, where,
      `staleness.level "${artifact.staleness.level}" contradicts the recorded hashes, which compute "${computed}"`,
    ));
  }
  if (computed === 'material' && artifact?.state === 'approved') {
    issues.push(issue(
      CODES.STALENESS, where,
      'the article\'s verified claims changed; a materially stale artifact must be regenerated before it may remain approved',
    ));
  }

  return issues;
}

/**
 * Classify an artifact against the current article version.
 * Returns 'fresh' | 'cosmetic' | 'material', or null when undecidable.
 */
export function computeStaleness(articleRef, version) {
  if (!articleRef || !version) return null;
  if (!articleRef.content_hash || !version.content_hash) return null;
  if (articleRef.claims_hash !== version.claims_hash) return 'material';
  if (articleRef.content_hash !== version.content_hash) return 'cosmetic';
  return 'fresh';
}

/** Validate an { article, artifacts } bundle file. */
export function validateBundleFile(path, schemas = loadSchemas()) {
  let bundle;
  try {
    bundle = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable bundle: ${err.message}`)];
  }
  return validateBundle(bundle, schemas);
}

export function validateBundle(bundle, schemas = loadSchemas()) {
  const issues = [...validateArticle(bundle?.article, schemas)];
  for (const artifact of bundle?.artifacts ?? []) {
    issues.push(...validateArtifact(artifact, bundle?.article ?? null, schemas));
  }
  return issues;
}
