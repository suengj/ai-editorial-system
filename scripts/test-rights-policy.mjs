#!/usr/bin/env node
/**
 * Regression test for the rights policy — AES-P0.4 (SUE-437).
 *
 * Covers the catalog invariants and the two rights records that live on the
 * Article and Artifact contracts: `transformation` and `visual`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES as RIGHTS, loadSchema, validateCatalog } from './lib/rights-core.mjs';
import {
  CODES as ART, loadSchemas, validateBundle,
} from './lib/article-contract-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOG = resolve(HERE, '../schemas/examples/reference-catalog.example.json');
const BUNDLE = resolve(HERE, '../schemas/examples/article-artifact.example.json');

const catalogSchema = loadSchema();
const bundleSchemas = loadSchemas();
const baseCatalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
const baseBundle = JSON.parse(readFileSync(BUNDLE, 'utf8'));
const cloneCatalog = () => JSON.parse(JSON.stringify(baseCatalog));
const cloneBundle = () => JSON.parse(JSON.stringify(baseBundle));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const catCodes = (c) => validateCatalog(c, catalogSchema).map((i) => i.code);
const bunCodes = (b) => validateBundle(b, bundleSchemas).map((i) => i.code);

// --- positives ------------------------------------------------------------
console.log('worked examples (expect 0 issues)');
{
  check('catalog example is valid', catCodes(baseCatalog).length === 0, JSON.stringify(validateCatalog(baseCatalog, catalogSchema)));
  check('bundle example is valid', bunCodes(baseBundle).length === 0, JSON.stringify(validateBundle(baseBundle, bundleSchemas)));
  check('catalog demonstrates fail-to-reference on unclear rights',
    baseCatalog.entries.some((e) => e.rights_status === 'unclear' && e.copy_status === 'linked' && !e.local_path));
  check('catalog demonstrates quotation of incompatible material without copying',
    baseCatalog.entries.some((e) => e.license_compatible === false && e.copy_status === 'quoted' && e.attribution));
}

// --- catalog negatives ----------------------------------------------------
console.log('catalog invariants');
const catalogCases = [
  ['unclear rights cannot be copied', RIGHTS.UNCLEAR_RIGHTS, (c) => { c.entries[1].copy_status = 'copied'; }],
  ['unclear rights cannot name a license', RIGHTS.UNCLEAR_RIGHTS, (c) => { c.entries[1].license = 'MIT'; }],
  ['unclear rights cannot assert compatibility', RIGHTS.UNCLEAR_RIGHTS, (c) => { c.entries[1].license_compatible = true; }],
  ['copying requires an identified license', RIGHTS.COPY_LICENSE, (c) => { c.entries[0].license = null; }],
  ['copying requires license_compatible: true', RIGHTS.COPY_LICENSE, (c) => { c.entries[0].license_compatible = false; }],
  ['copying requires attribution', RIGHTS.COPY_ATTRIBUTION, (c) => { delete c.entries[0].attribution; }],
  ['copying requires a local_path naming what was reproduced', RIGHTS.COPY_PATH, (c) => { delete c.entries[0].local_path; }],
  ['quoting requires attribution', RIGHTS.COPY_ATTRIBUTION, (c) => { delete c.entries[2].attribution; }],
  ['a link-only entry cannot carry a local copy', RIGHTS.LINKED_PATH, (c) => { c.entries[1].local_path = 'references/mirror/report.pdf'; }],
  ['duplicate ref_id is rejected', RIGHTS.DUPLICATE, (c) => { c.entries[1].ref_id = c.entries[0].ref_id; }],
  ['an entry without observations is rejected', RIGHTS.SCHEMA, (c) => { delete c.entries[0].observations; }],
  ['an unknown verdict is rejected', RIGHTS.SCHEMA, (c) => { c.entries[0].verdict = 'maybe'; }],
];
for (const [name, expected, mutate] of catalogCases) {
  const c = cloneCatalog(); mutate(c);
  const got = catCodes(c);
  check(name, got.includes(expected), `expected ${expected}, got [${[...new Set(got)].join(', ')}]`);
}

// --- transformation -------------------------------------------------------
console.log('transformation record');
const transformCases = [
  ['a materialized article requires a transformation record', ART.TRANSFORMATION, (b) => { delete b.article.transformation; }],
  ['transcript-shaped work cannot be materialized', ART.TRANSFORMATION, (b) => { b.article.transformation.transcript_shaped = true; }],
  ['original framing is required', ART.TRANSFORMATION, (b) => { b.article.transformation.original_framing = false; }],
  ['a synthesis note is required', ART.SCHEMA, (b) => { delete b.article.transformation.synthesis_note; }],
];
for (const [name, expected, mutate] of transformCases) {
  const b = cloneBundle(); mutate(b);
  const got = bunCodes(b);
  check(name, got.includes(expected), `expected ${expected}, got [${[...new Set(got)].join(', ')}]`);
}

// --- visual rights --------------------------------------------------------
console.log('visual rights record');
const visualIdx = baseBundle.artifacts.findIndex((a) => a.kind === 'evidence_visual');
const visualCases = [
  ['a visual artifact requires a rights record', ART.VISUAL_RIGHTS, (b) => { delete b.artifacts[visualIdx].visual; }],
  ['unclear rights cannot be embedded', ART.VISUAL_RIGHTS, (b) => {
    b.artifacts[visualIdx].visual.visual_class = 'source_image';
    b.artifacts[visualIdx].visual.rights_basis = 'unclear';
  }],
  ['a screenshot cannot claim own_work', ART.VISUAL_RIGHTS, (b) => {
    b.artifacts[visualIdx].visual.visual_class = 'screenshot';
  }],
  ['an embedded thumbnail requires attribution', ART.VISUAL_RIGHTS, (b) => {
    b.artifacts[visualIdx].visual.visual_class = 'thumbnail';
    b.artifacts[visualIdx].visual.rights_basis = 'quotation';
    delete b.artifacts[visualIdx].visual.attribution;
  }],
  ['an embedded licensed image requires a named license', ART.VISUAL_RIGHTS, (b) => {
    b.artifacts[visualIdx].visual.visual_class = 'source_image';
    b.artifacts[visualIdx].visual.rights_basis = 'licensed';
    b.artifacts[visualIdx].visual.license = null;
  }],
  ['a remix does not launder the underlying rights', ART.VISUAL_RIGHTS, (b) => {
    b.artifacts[visualIdx].visual.visual_class = 'remix';
  }],
  ['a generated chart still cites the facts it depicts', ART.CLAIM_LINK, (b) => {
    delete b.artifacts[visualIdx].source_references;
  }],
  ['an unknown visual class is rejected', ART.SCHEMA, (b) => {
    b.artifacts[visualIdx].visual.visual_class = 'photo';
  }],
];
for (const [name, expected, mutate] of visualCases) {
  const b = cloneBundle(); mutate(b);
  const got = bunCodes(b);
  check(name, got.includes(expected), `expected ${expected}, got [${[...new Set(got)].join(', ')}]`);
}

// --- fail-closed ----------------------------------------------------------
console.log('fail-closed behaviour');
{
  check('an empty catalog object is not a silent pass', catCodes({}).length > 0);
  check('a null catalog is not a silent pass', catCodes(null).length > 0);
  check('an empty entries list is legitimate',
    catCodes({ schema_version: '1.0.0', entries: [] }).length === 0);
}

console.log(failures === 0 ? '\nrights policy regression: PASS' : `\nrights policy regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
