#!/usr/bin/env node
/**
 * Regression test for the Article + Artifact contract — AES-P0.3 (SUE-436).
 *
 * The canonical example bundle is the positive fixture; every negative case
 * mutates one field and asserts that a specific rule code fires.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, STATUS_MAP, computeStaleness, loadSchemas, validateBundle,
} from './lib/article-contract-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = resolve(HERE, '../schemas/examples/article-artifact.example.json');

const schemas = loadSchemas();
const base = JSON.parse(readFileSync(EXAMPLE, 'utf8'));
const clone = () => JSON.parse(JSON.stringify(base));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const codes = (b) => validateBundle(b, schemas).map((i) => i.code);

// --- positive -------------------------------------------------------------
console.log('canonical example (expect 0 issues)');
{
  check('example bundle is valid', validateBundle(base, schemas).length === 0,
    JSON.stringify(validateBundle(base, schemas)));

  const kinds = new Set(base.artifacts.map((a) => a.kind));
  for (const k of ['brief', 'evidence_visual', 'slides', 'sources']) {
    check(`covers artifact kind ${k}`, kinds.has(k));
  }
  check('content type and artifact kinds are disjoint vocabularies',
    !kinds.has(base.article.content_type));
  check('a human-finalized article maps to status draft, not published',
    base.article.state === 'final' && base.article.publication.target_status === 'draft');
  check('an unverified claim is retained rather than dropped',
    base.article.verification.claims.some((c) => c.status === 'unverified'));
  check('a contradicting source is part of the lineage',
    base.article.source_set.some((s) => s.role === 'contradicting'));
}

// --- answer unit (AEO-P2.3 / SUE-525) ------------------------------------
console.log('an answer unit may only compress what the article verified');
{
  const withAnswer = (answer) => {
    const b = clone();
    b.article.answer = answer;
    return b;
  };
  const unit = (claims) => ({
    question: 'Did per-token price cuts move the filer\'s gross margin?',
    summary: 'Published prices fell while the reported gross margin did not move materially.',
    claims,
  });
  const ref = (claim_id, kind) => ({
    claim_id,
    kind,
    anchor: 'the filer\'s reported gross margin did not move materially',
  });

  check('an article with no answer unit stays valid',
    !('answer' in base.article) && validateBundle(base, schemas).length === 0);
  check('an answer over verified, evidenced claims is valid',
    codes(withAnswer(unit([ref('c1', 'fact'), ref('c2', 'fact')]))).length === 0,
    JSON.stringify(validateBundle(withAnswer(unit([ref('c1', 'fact')])), schemas)));
  check('an answer with no claims at all is still valid',
    codes(withAnswer({ question: 'q?', summary: 'a.' })).length === 0);
  check('a claim the verification block never carried is refused',
    codes(withAnswer(unit([ref('c9', 'fact')]))).includes(CODES.ANSWER));
  check('an unverified claim may not be presented as fact',
    codes(withAnswer(unit([ref('c3', 'fact')]))).includes(CODES.ANSWER));
  check('the same unverified claim is fine as an interpretation',
    codes(withAnswer(unit([ref('c3', 'interpretation')]))).length === 0);
  check('a verified claim stripped of its evidence may not be presented as fact', (() => {
    const b = withAnswer(unit([ref('c1', 'fact')]));
    b.article.verification.claims.find((c) => c.claim_id === 'c1').evidence = [];
    return codes(b).includes(CODES.ANSWER);
  })());
  check('the same claim may not be referenced twice',
    codes(withAnswer(unit([ref('c1', 'fact'), ref('c1', 'fact')]))).includes(CODES.ANSWER));
  check('a summary longer than the cap is refused by the schema',
    codes(withAnswer({ question: 'q?', summary: 'x'.repeat(401) })).includes(CODES.SCHEMA));
  check('an anchor too short to locate in the body is refused by the schema',
    codes(withAnswer(unit([{ claim_id: 'c1', kind: 'fact', anchor: 'short' }]))).includes(CODES.SCHEMA));
}

// --- staleness classification --------------------------------------------
console.log('staleness is computed from the two hashes');
{
  const v = base.article.version;
  const ref = (content, claims) => ({ content_hash: content, claims_hash: claims });
  check('identical hashes → fresh',
    computeStaleness(ref(v.content_hash, v.claims_hash), v) === 'fresh');
  check('prose changed, claims unchanged → cosmetic',
    computeStaleness(ref('f'.repeat(64), v.claims_hash), v) === 'cosmetic');
  check('claims changed → material',
    computeStaleness(ref(v.content_hash, 'f'.repeat(64)), v) === 'material');
  check('undecidable without a version → null', computeStaleness(ref('a', 'b'), null) === null);
  check('the example slides artifact is genuinely cosmetic-stale',
    computeStaleness(base.artifacts[2].article_ref, v) === 'cosmetic');
}

// --- negatives ------------------------------------------------------------
console.log('single-field mutations (expect the named code)');

const cases = [
  ['AI cannot advance an article to final', CODES.AUTHORITY, (b) => {
    b.article.lifecycle_authority = 'ai';
  }],
  ['AI cannot publish', CODES.AUTHORITY, (b) => {
    b.article.state = 'published';
    b.article.lifecycle_authority = 'ai';
    b.article.publication.target_status = 'published';
    b.article.publication.approved_by = 'someone';
    b.article.publication.approved_at = '2026-09-01T00:00:00Z';
  }],
  ['final must not map to published', CODES.STATUS_MAP, (b) => {
    b.article.publication.target_status = 'published';
  }],
  ['published target requires recorded human approval', CODES.PUBLISH_GATE, (b) => {
    b.article.state = 'published';
    b.article.publication.target_status = 'published';
  }],
  ['a pre-final article carries no publication block', CODES.STATUS_MAP, (b) => {
    b.article.state = 'reviewed';
    b.article.lifecycle_authority = 'ai';
  }],
  ['target_path collection must match content_type', CODES.PATH_MAP, (b) => {
    b.article.publication.target_path = 'content/notes/ai-inference-pricing-and-saas-gross-margin.md';
  }],
  ['canonical_url must match the slug', CODES.PATH_MAP, (b) => {
    b.article.publication.canonical_url = '/content/something-else';
  }],
  ['a frame admitting no uncertainty is rejected', CODES.FRAME, (b) => {
    b.article.frame.uncertainty = [];
  }],
  ['an incomplete frame is rejected', CODES.SCHEMA, (b) => {
    delete b.article.frame.original_value_add;
  }],
  ['no_article requires a reason', CODES.NO_ARTICLE, (b) => {
    b.article.state = 'no_article';
    b.article.lifecycle_authority = 'ai';
    delete b.article.publication;
  }],
  ['a reason without no_article is rejected', CODES.NO_ARTICLE, (b) => {
    b.article.no_article_reason = 'thesis did not hold';
  }],
  ['artifact kind is not a content type', CODES.SCHEMA, (b) => {
    b.artifacts[1].kind = 'news';
  }],
  ['media_stage must match kind', CODES.MEDIA_STAGE, (b) => {
    b.artifacts[1].media_stage = 'evidence';
  }],
  ['distribution media cannot be built from an unreviewed draft', CODES.DISTRIBUTION_GATE, (b) => {
    b.article.state = 'drafted';
    b.article.lifecycle_authority = 'ai';
    delete b.article.publication;
  }],
  ['a brief must cite its claims', CODES.CLAIM_LINK, (b) => {
    delete b.artifacts[1].source_references;
  }],
  ['an artifact cannot cite a claim the article never verified', CODES.CLAIM_LINK, (b) => {
    b.artifacts[1].source_references = [{ claim_id: 'c99' }];
  }],
  ['an artifact cannot cite an unverified claim as support', CODES.CLAIM_LINK, (b) => {
    b.artifacts[1].source_references = [{ claim_id: 'c3' }];
  }],
  ['staleness cannot be asserted against the hashes', CODES.STALENESS, (b) => {
    b.artifacts[2].staleness.level = 'fresh';
  }],
  ['a materially stale artifact cannot stay approved', CODES.STALENESS, (b) => {
    b.artifacts[0].article_ref.claims_hash = 'f'.repeat(64);
  }],
  ['artifact_id must match its article', CODES.ARTIFACT_ID, (b) => {
    b.artifacts[1].artifact_id = 'art:some-other-article#brief';
  }],
  ['artifact_id must match its kind', CODES.ARTIFACT_ID, (b) => {
    b.artifacts[1].artifact_id = 'art:ai-inference-pricing-and-saas-gross-margin#slides';
  }],
  ['generator requires a versioned skill', CODES.SCHEMA, (b) => {
    delete b.artifacts[1].generator.skill.version;
  }],
  ['unknown artifact property is rejected', CODES.SCHEMA, (b) => {
    b.artifacts[1].vendor_thread_id = 'abc';
  }],
  ['unknown article property is rejected', CODES.SCHEMA, (b) => {
    b.article.notebooklm_project = 'abc';
  }],
];

for (const [name, expected, mutate] of cases) {
  const b = clone();
  mutate(b);
  const got = codes(b);
  check(name, got.includes(expected), `expected ${expected}, got [${[...new Set(got)].join(', ')}]`);
}

// --- mapping table integrity ----------------------------------------------
console.log('state → suengj-com status mapping');
{
  check('final maps to draft', STATUS_MAP.final === 'draft');
  check('revised maps back to draft', STATUS_MAP.revised === 'draft');
  check('published is the only state mapping to published',
    Object.entries(STATUS_MAP).filter(([, v]) => v === 'published').map(([k]) => k).join() === 'published');
  check('no pre-final state has a mapping',
    ['candidate', 'framed', 'drafted', 'verified', 'polished', 'reviewed', 'no_article']
      .every((s) => !(s in STATUS_MAP)));
}

// --- fail-closed ----------------------------------------------------------
console.log('fail-closed behaviour');
{
  check('an empty bundle is not a silent pass', codes({}).length > 0);
  check('a null bundle is not a silent pass', codes(null).length > 0);
}

console.log(failures === 0 ? '\narticle contract regression: PASS' : `\narticle contract regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
