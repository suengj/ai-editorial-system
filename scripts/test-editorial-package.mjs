#!/usr/bin/env node
/**
 * Regression test for the Editorial Package contract — AES-V2.9 (SUE-567).
 *
 * Allow/deny fixture pair per the repo's evidence rule: every contract that
 * can be checked ships with a validator and a fixture pair. Allow cases are
 * the five worked examples; deny cases are targeted mutations of them.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, computeClaimsHash, computePackageHash, loadSchema, validatePackageBundle,
} from './lib/editorial-package-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = resolve(HERE, '../schemas/examples');

const schema = loadSchema();
const load = (name) => JSON.parse(readFileSync(resolve(EXAMPLES, name), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));

const synthesizePkg = load('package-synthesize-research-suengj.example.json');
const adaptPkg = load('package-adapt-audio.example.json');

/** Recompute lineage hashes after a mutation, so a deny case fails for the
 *  reason under test rather than for an incidental hash mismatch. */
function reseal(pkg) {
  if (!pkg.article_ref) {
    pkg.lineage.claims_hash = computeClaimsHash(pkg.verified_claims);
  }
  pkg.lineage.package_hash = computePackageHash(pkg);
  return pkg;
}

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const codesOf = (pkg) => validatePackageBundle(pkg, schema).map((i) => i.code);

// --- allow: the five worked examples ---------------------------------------
console.log('worked examples (expect 0 issues)');
for (const name of [
  'package-p03-summarize-note.example.json',
  'package-synthesize-research-suengj.example.json',
  'package-adapt-audio.example.json',
  'package-notebooklm-handoff.example.json',
  'package-academic-or-promotional.example.json',
]) {
  const pkg = load(name);
  const issues = validatePackageBundle(pkg, schema);
  check(name, issues.length === 0, JSON.stringify(issues));
}

// --- deny: synthesize package with empty uncertainty ------------------------
console.log('\nuncertainty invariant');
{
  const p = clone(synthesizePkg);
  p.uncertainty = [];
  reseal(p);
  const got = codesOf(p);
  check('a synthesize package with empty uncertainty is rejected',
    got.includes(CODES.UNCERTAINTY_EMPTY), `got [${got.join(', ')}]`);
}
{
  const p = clone(synthesizePkg);
  reseal(p);
  const got = codesOf(p);
  check('the unmutated synthesize package (non-empty uncertainty) is accepted',
    !got.includes(CODES.UNCERTAINTY_EMPTY), `got [${got.join(', ')}]`);
}

// --- deny: a package carrying a source body ---------------------------------
console.log('\nsource body invariant');
{
  const p = clone(synthesizePkg);
  p.sources[0].body = 'The full text of the source, pasted in.';
  reseal(p);
  const got = codesOf(p);
  check('a source entry carrying a body is rejected',
    got.includes(CODES.SCHEMA), `got [${got.join(', ')}]`);
}

// --- deny: duplicating an article's claims while also setting article_ref --
console.log('\narticle_ref vs inline content invariant');
{
  const p = clone(adaptPkg);
  p.verified_claims = [
    { claim_id: 'c1', text: 'Duplicated straight from the article.', kind: 'assertion', status: 'verified' },
  ];
  reseal(p);
  const got = codesOf(p);
  check('a package with article_ref set may not also carry verified_claims',
    got.includes(CODES.ARTICLE_VS_INLINE), `got [${got.join(', ')}]`);
}
{
  const p = clone(adaptPkg);
  p.thesis = 'A thesis restated even though article_ref already carries the frame.';
  reseal(p);
  const got = codesOf(p);
  check('a package with article_ref set may not also carry a thesis',
    got.includes(CODES.ARTICLE_VS_INLINE), `got [${got.join(', ')}]`);
}
{
  const p = clone(adaptPkg);
  p.lineage.claims_hash = '0'.repeat(64);
  const got = codesOf(p);
  check('lineage.claims_hash must equal article_ref.claims_hash when article_ref is set',
    got.includes(CODES.CLAIMS_HASH_MISMATCH), `got [${got.join(', ')}]`);
}

// --- other invariants --------------------------------------------------------
console.log('\nother invariants');
{
  const p = clone(synthesizePkg);
  p.target_surfaces = [];
  reseal(p);
  const got = codesOf(p);
  check('a package with no target surface is rejected',
    got.includes(CODES.NO_TARGET_SURFACE), `got [${got.join(', ')}]`);
}
{
  const p = clone(synthesizePkg);
  p.transformation.value = 'synthesize';
  p.article_ref = null;
  p.thesis = null;
  reseal(p);
  const got = codesOf(p);
  check('a synthesize package with no article_ref and no thesis is rejected',
    got.includes(CODES.NO_CONTENT), `got [${got.join(', ')}]`);
}
{
  const p = clone(synthesizePkg);
  p.lineage.package_hash = '0'.repeat(64);
  const got = codesOf(p);
  check('a package_hash that does not match the recomputed content is rejected',
    got.includes(CODES.PACKAGE_HASH_MISMATCH), `got [${got.join(', ')}]`);
}
{
  const p = clone(synthesizePkg);
  p.transformation.profile_ref = 'editorial/profiles/transformation/does-not-exist.json';
  reseal(p);
  const got = codesOf(p);
  check('an unresolvable transformation.profile_ref is reported',
    got.includes(CODES.PROFILE_MISSING), `got [${got.join(', ')}]`);
}

// --- B7: produced_by.tool must carry full runtime lineage --------------------
console.log('\nproduced_by.tool runtime identity (B7)');
{
  const p = clone(synthesizePkg);
  delete p.lineage.produced_by.tool.provider;
  delete p.lineage.produced_by.tool.model_version;
  reseal(p);
  const got = codesOf(p);
  check('produced_by.tool missing provider/model_version fails schema validation',
    got.includes(CODES.SCHEMA), `got [${got.join(', ')}]`);
}
{
  const p = clone(synthesizePkg);
  const got = codesOf(p);
  check('the unmutated example carries provider/model/model_version and validates clean',
    got.length === 0 &&
    typeof p.lineage.produced_by.tool.provider === 'string' &&
    typeof p.lineage.produced_by.tool.model === 'string' &&
    typeof p.lineage.produced_by.tool.model_version === 'string',
    `got [${got.join(', ')}]`);
}

// --- fail-closed --------------------------------------------------------------
console.log('\nfail-closed behaviour');
{
  check('a null package is not a silent pass', codesOf(null).length > 0);
  check('an empty object is not a silent pass', codesOf({}).length > 0);
}

console.log(failures === 0 ? '\neditorial-package regression: PASS' : `\neditorial-package regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
