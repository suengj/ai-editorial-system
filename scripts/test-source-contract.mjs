#!/usr/bin/env node
/**
 * Regression test for the source contract — AES-P0.2 (SUE-435).
 *
 * The canonical example is the positive fixture. Every negative case is a
 * single-field mutation of it, so a failure names exactly one broken rule and
 * the example itself is proven to be the only difference.
 *
 * Absence is never PASS: each negative case asserts that a specific code
 * fires, not merely that "something" failed.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, loadSchema, validateManifest } from './lib/source-contract-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const EXAMPLE = resolve(REPO_ROOT, 'schemas/examples/source-manifest.example.json');

const schema = loadSchema();
const base = JSON.parse(readFileSync(EXAMPLE, 'utf8'));
const clone = () => JSON.parse(JSON.stringify(base));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const codes = (manifest) => validateManifest(manifest, schema).map((i) => i.code);

// --- positive -------------------------------------------------------------
console.log('canonical example (expect 0 issues)');
{
  const issues = validateManifest(base, schema);
  check('example manifest is valid', issues.length === 0, JSON.stringify(issues));
  const kinds = new Set(base.sources.map((s) => s.kind));
  for (const k of ['youtube_summary', 'market_brief', 'research_draft', 'project_repo']) {
    check(`covers source class ${k}`, kinds.has(k));
  }
  check(
    'a source with genuinely unknown authored date uses null, not the ingestion date',
    base.sources.some((s) => s.source_created_at === null),
  );
}

// --- negatives ------------------------------------------------------------
console.log('single-field mutations (expect the named code)');

const cases = [
  ['unknown property is rejected (additionalProperties: false)', CODES.SCHEMA, (m) => {
    m.sources[0].approved = true;
  }],
  ['unknown kind is rejected (finite vocabulary)', CODES.SCHEMA, (m) => {
    m.sources[0].kind = 'blog_post';
  }],
  ['publication vocabulary in disposition is named and rejected', CODES.PUBLICATION_VOCAB, (m) => {
    m.sources[0].disposition = 'published';
  }],
  ['archived requires human authority', CODES.AUTHORITY, (m) => {
    m.sources[3].disposition = 'archived';
    m.sources[3].disposition_authority = 'ai_recommended';
  }],
  ['rejected requires human authority', CODES.AUTHORITY, (m) => {
    m.sources[5].disposition_authority = 'ai_recommended';
  }],
  ['origin_ref shape must match origin', CODES.ORIGIN_REF_SHAPE, (m) => {
    delete m.sources[3].origin_ref.ref;
  }],
  ['origin_ref rejects fields belonging to another origin', CODES.ORIGIN_REF_SHAPE, (m) => {
    m.sources[0].origin_ref.repo = 'suengj/whatever';
  }],
  ['source_id prefix must match origin', CODES.ID_PREFIX, (m) => {
    m.sources[3].source_id = 'src:drive:suengj/p05_finance';
  }],
  ['duplicate source_id is rejected', CODES.ID_DUPLICATE, (m) => {
    m.sources[1].source_id = m.sources[0].source_id;
    m.sources[1].origin_ref.file_id = m.sources[0].origin_ref.file_id;
  }],
  ['one Drive file cannot gain a second identity after a rename or move', CODES.IDENTITY_DRIFT, (m) => {
    m.sources[1].origin_ref.file_id = m.sources[0].origin_ref.file_id;
    m.sources[1].origin_ref.path_hint = 'Archive/renamed-and-moved.md';
  }],
  ['superseded requires a superseded_by link', CODES.SUPERSEDE_LINK, (m) => {
    delete m.sources[4].superseded_by;
  }],
  ['superseded_by must resolve', CODES.SUPERSEDE_LINK, (m) => {
    m.sources[4].superseded_by = 'src:drive:doesNotExist000000000000000000';
  }],
  ['duplicate_of must resolve', CODES.DUPLICATE_LINK, (m) => {
    m.sources[2].duplicate_of = 'src:drive:doesNotExist000000000000000000';
  }],
  ['duplicate_of with a different hash is not a duplicate', CODES.DUPLICATE_LINK, (m) => {
    m.sources[2].duplicate_of = m.sources[0].source_id;
  }],
  ['a candidate cannot already be used', CODES.USED_BY_STATE, (m) => {
    m.sources[0].disposition = 'candidate';
  }],
  ['source_created_at cannot postdate ingested_at', CODES.DATE_ORDER, (m) => {
    m.sources[0].source_created_at = '2026-09-30';
  }],
  ['content_observed_at cannot predate ingested_at', CODES.DATE_ORDER, (m) => {
    m.sources[0].content_observed_at = '2026-08-01T00:00:00Z';
  }],
  ['fabricated date format is rejected', CODES.SCHEMA, (m) => {
    m.sources[0].source_created_at = 'sometime in August';
  }],
  ['content_hash must be a sha256 digest', CODES.SCHEMA, (m) => {
    m.sources[0].content_hash.value = 'not-a-hash';
  }],
  ['missing required field is rejected', CODES.SCHEMA, (m) => {
    delete m.sources[0].rights;
  }],
];

for (const [name, expected, mutate] of cases) {
  const m = clone();
  mutate(m);
  const got = codes(m);
  check(name, got.includes(expected), `expected ${expected}, got [${[...new Set(got)].join(', ')}]`);
}

// --- fail-closed ----------------------------------------------------------
console.log('fail-closed behaviour');
{
  check('an empty object is not a silent pass', codes({}).length > 0);
  check('a null manifest is not a silent pass', codes(null).length > 0);
  check(
    'a manifest with no sources still validates its own envelope',
    codes({ schema_version: '1.0.0', generated_at: '2026-09-01T08:00:00Z', sources: [] }).length === 0,
  );
}

console.log(failures === 0 ? '\nsource contract regression: PASS' : `\nsource contract regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
