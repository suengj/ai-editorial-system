#!/usr/bin/env node
/**
 * Schema clone parity — V2 tuning review, finding I7.
 *
 * `scripts/lib/json-schema-lite.mjs` forbids cross-file `$ref`, so any shape
 * shared by more than one schema has to be copy-pasted into each file. That
 * is an accepted constraint of this repo's validator, not a bug — but
 * nothing previously checked that the copies stayed identical, and one of
 * them (`article_ref`) had already drifted: `editorial-package.schema.json`
 * carried a `commit` field that `visual-job.schema.json` and
 * `audio-plan.schema.json` did not.
 *
 * This test asserts the known duplicated shapes are structurally identical
 * across every file that copies them, so a future edit to one copy that
 * forgets the others fails CI instead of shipping silent drift.
 *
 * article_ref reconciliation (this fix): `schemas/artifact.schema.json`'s
 * $defs.article_ref is treated as canonical — it is the oldest (V1) copy,
 * its `commit` field is optional (not in `required`), and
 * `editorial-package.schema.json` (V2, AES-V2.9) already documented itself
 * as "Same shape as artifact.schema.json#/$defs/article_ref" and carried
 * `commit`. `audio-plan.schema.json` and `visual-job.schema.json` were
 * missing `commit` — the actual drift — and have been brought back into
 * parity by adding it (additive, optional, no behavior change).
 * `artifact-plan.schema.json` was also missing it and has been aligned the
 * same way for the same reason: it is the same "which article version
 * produced this" reference, just for a different downstream artifact.
 *
 * `editorial-package.schema.json`'s copy is `type: ["object", "null"]`
 * instead of `type: "object"` — that is NOT drift, it is a deliberate,
 * documented difference (a package can exist with no backing article), so
 * this test compares only `required` and `properties`, not `type`, for
 * article_ref.
 *
 * $defs.evaluator is duplicated across corpus-entry, feedback-record, and
 * reference-evaluation and is identical among those three.
 * `l1-review.schema.json` has its own `evaluator`-shaped `$defs` entry that
 * is deliberately NOT the same shape (its own doc comment says so: "full
 * runtime lineage... Field names deliberately match visual-job.schema.json's
 * `renderer`/`runtime` $defs" — provider/model/model_version are required,
 * unlike the plain human/agent evaluator elsewhere). It is intentionally
 * excluded from this parity group rather than silently treated as a match.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

// Deep, key-order-independent stringify for comparison.
const canon = (v) => {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  }
  return v;
};
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// --- article_ref -------------------------------------------------------
console.log('article_ref parity (schemas/artifact.schema.json is canonical)');
{
  const canonical = load('schemas/artifact.schema.json').$defs.article_ref;
  const canonicalShape = { required: canonical.required, properties: canonical.properties };

  const copies = [
    { file: 'schemas/audio-plan.schema.json', get: (j) => j.$defs.article_ref },
    { file: 'schemas/visual-job.schema.json', get: (j) => j.$defs.article_ref },
    { file: 'schemas/artifact-plan.schema.json', get: (j) => j.properties.article_ref },
    { file: 'schemas/editorial-package.schema.json', get: (j) => j.properties.article_ref },
  ];

  for (const { file, get } of copies) {
    const j = load(file);
    const copy = get(j);
    check(`${file}: article_ref present`, Boolean(copy), 'no article_ref found at the expected path');
    if (!copy) continue;
    const copyShape = { required: copy.required, properties: copy.properties };
    check(`${file}: article_ref.required/properties match schemas/artifact.schema.json#/$defs/article_ref`,
      same(canonicalShape, copyShape),
      `expected ${JSON.stringify(canonicalShape)}, got ${JSON.stringify(copyShape)}`);
  }
}

// --- $defs.evaluator -----------------------------------------------------
console.log('\n$defs.evaluator parity (human/agent evaluator group; l1-review is a deliberate variant, excluded)');
{
  const files = [
    'schemas/corpus-entry.schema.json',
    'schemas/feedback-record.schema.json',
    'schemas/reference-evaluation.schema.json',
    'schemas/polish-decision.schema.json',
  ];
  const shapes = files.map((f) => ({ file: f, shape: load(f).$defs.evaluator }));
  for (const { file, shape } of shapes) {
    check(`${file}: $defs.evaluator present`, Boolean(shape), 'no $defs.evaluator found');
  }
  const [first, ...rest] = shapes;
  for (const { file, shape } of rest) {
    check(`${file}: $defs.evaluator matches ${first.file}`, same(first.shape, shape),
      `expected ${JSON.stringify(first.shape)}, got ${JSON.stringify(shape)}`);
  }

  // l1-review's evaluator-shaped $defs entry is a deliberate variant, not a
  // clone — assert it stays DIFFERENT so this test would notice if someone
  // "fixed" it into false parity, which would silently weaken the
  // model-drift-detection contract that field exists for.
  const l1 = load('schemas/l1-review.schema.json');
  const l1Evaluator = l1.$defs?.evaluator;
  check('schemas/l1-review.schema.json: $defs.evaluator present (own variant)', Boolean(l1Evaluator));
  if (l1Evaluator) {
    check('schemas/l1-review.schema.json: $defs.evaluator is deliberately NOT identical to the plain human/agent evaluator (full runtime lineage instead)',
      !same(first.shape, l1Evaluator),
      'l1-review.schema.json#/$defs/evaluator now matches the plain evaluator shape — if this was intentional, update this test\'s comment and expectation together, do not just flip the assertion');
  }
}

// --- axis-vocabulary parity ---------------------------------------------------
// A second class of copy: json-schema-lite cannot read editorial/profiles/,
// so any schema enumerating profile ids holds a hand-maintained copy of an
// axis's vocabulary. That copy drifts silently — SUE-570 added the
// `child-upper-elementary` audience profile and
// reference-evaluation.schema.json's `applicable_to.audiences` enum was not
// updated, so five valid corpus records failed schema validation months
// later with a message that read like the records were wrong.
//
// Rule: if a schema enum contains ANY id from an axis, it must contain ALL
// of them. An enum that overlaps an axis is a copy of it; a partial copy is
// drift, not a deliberate subset. (A genuinely intended subset would need a
// different justification than this test allows — say so here and exempt it
// explicitly rather than letting it look like drift.)
console.log('\naxis vocabulary copies in schemas/');
{
  const axisIds = (dir) => new Set(
    readdirSync(resolve(ROOT, `editorial/profiles/${dir}`))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, '')));

  const axes = { audience: axisIds('audience'), content: axisIds('content'), surface: axisIds('surface') };

  // Known, deliberately-unfixed drift. Listed by exact path so it stays
  // visible instead of being silently tolerated, and so a NEW drift in the
  // same file still fails.
  //
  // article.schema.json predates the `academic` and `promotional` content
  // profiles (added with V2's axis registry). Widening V1's article contract
  // enum is a change to a certified V1 authority whose per-type required
  // fields live in scripts/lib/article-contract-core.mjs — it needs its own
  // issue and its own evidence, not a drive-by edit inside SUE-607/604.
  // Consequence while it stands: an `academic` or `promotional` content
  // profile cannot be carried by an Article, so those two profiles are
  // reachable from L1 and corpus records but not from the article contract.
  const KNOWN_DRIFT = new Set([
    'schemas/article.schema.json/properties/content_type::content',
  ]);

  const enums = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) { node.forEach((n) => walk(n, path)); return; }
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.enum)) enums.push({ path, values: node.enum.filter((v) => typeof v === 'string') });
    for (const [k, v] of Object.entries(node)) walk(v, `${path}/${k}`);
  };

  for (const file of readdirSync(resolve(ROOT, 'schemas')).filter((f) => f.endsWith('.json')).sort()) {
    enums.length = 0;
    walk(load(`schemas/${file}`), '');
    for (const { path, values } of enums) {
      const present = new Set(values);
      for (const [axis, ids] of Object.entries(axes)) {
        const overlap = [...present].filter((v) => ids.has(v));
        if (overlap.length === 0) continue;
        const missing = [...ids].filter((v) => !present.has(v)).sort();
        if (KNOWN_DRIFT.has(`schemas/${file}${path}::${axis}`)) {
          console.log(`  KNOWN  schemas/${file}${path}: missing ${JSON.stringify(missing)} from the ${axis} axis — recorded gap, see KNOWN_DRIFT`);
          continue;
        }
        check(`schemas/${file}${path}: covers every ${axis}-axis id`, missing.length === 0,
          `enum copies the ${axis} axis but is missing ${JSON.stringify(missing)} — add them, or the axis profile exists and nothing can reference it`);
      }
    }
  }
}

// --- authority_class / application_mode parity (AMENDMENT 1 item F) --------
// polish-decision.schema.json hand-copies these two enums from
// language-pack.schema.json ($defs.authority_class and rules[].application_mode)
// because json-schema-lite forbids cross-file $ref. Nothing previously
// checked the copies stayed identical, and application_mode is the single
// most load-bearing vocabulary in this issue: it is exactly the field guard B
// (scripts/lib/delta-core.mjs) cross-checks between a polish edit and the
// pack rule it cites, so a silently-drifted copy here would make an edit's
// self-asserted mode unverifiable against a pack that spells the value
// slightly differently.
console.log('\nauthority_class / application_mode enum parity (polish-decision.schema.json copies language-pack.schema.json)');
{
  const languagePack = load('schemas/language-pack.schema.json');
  const polishDecision = load('schemas/polish-decision.schema.json');

  const languagePackAuthorityClass = languagePack.$defs?.authority_class?.enum;
  const polishAuthorityClass = polishDecision.$defs?.authority_class?.enum;
  check('polish-decision.schema.json $defs.authority_class present', Boolean(polishAuthorityClass));
  check('language-pack.schema.json $defs.authority_class present', Boolean(languagePackAuthorityClass));
  if (languagePackAuthorityClass && polishAuthorityClass) {
    check('polish-decision.schema.json $defs.authority_class matches language-pack.schema.json $defs.authority_class (8 values)',
      same(languagePackAuthorityClass, polishAuthorityClass),
      `language-pack: ${JSON.stringify(languagePackAuthorityClass)}, polish-decision: ${JSON.stringify(polishAuthorityClass)}`);
  }

  const languagePackApplicationMode = languagePack.$defs?.rule?.properties?.application_mode?.enum;
  const polishApplicationMode = polishDecision.$defs?.application_mode?.enum;
  check('language-pack.schema.json rules[].application_mode enum present', Boolean(languagePackApplicationMode));
  check('polish-decision.schema.json $defs.application_mode present', Boolean(polishApplicationMode));
  if (languagePackApplicationMode && polishApplicationMode) {
    check('polish-decision.schema.json $defs.application_mode matches language-pack.schema.json rules[].application_mode (5 values)',
      same(languagePackApplicationMode, polishApplicationMode),
      `language-pack: ${JSON.stringify(languagePackApplicationMode)}, polish-decision: ${JSON.stringify(polishApplicationMode)}`);
  }
}

console.log(failures === 0 ? '\nschema parity: PASS' : `\nschema parity: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
