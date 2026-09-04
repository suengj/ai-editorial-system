#!/usr/bin/env node
/**
 * Regression test for the Editorial Intent contract — AES-V2.1 (SUE-559).
 *
 * Allow/deny fixture pair per the repo's evidence rule. Allow cases are the
 * five worked examples in schemas/examples/; deny cases are targeted
 * single-field mutations, so a failure names exactly one broken rule.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, loadSchema, validateIntent } from './lib/intent-core.mjs';
import { loadAxes } from './lib/profile-core.mjs';
import { evaluateContentTypeMateriality } from './lib/materiality-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = resolve(HERE, '../schemas/examples');
const FIXTURES = resolve(HERE, 'fixtures/intent');

const schema = loadSchema();
const load = (name) => JSON.parse(readFileSync(resolve(EXAMPLES, name), 'utf8'));
const clone = (o) => JSON.parse(JSON.stringify(o));
const codesOf = (intent, opts) => validateIntent(intent, schema, opts).issues.map((i) => i.code);

// A fixture axis registry that points the artifact axis at a fixture profile
// deliberately inconsistent between its own id ("visual/mismatch") and its
// modality field ("audio"), so the ARTIFACT_MODALITY check can be proved
// without depending on any real editorial/profiles/artifact file drifting.
const mismatchAxes = loadAxes().map((a) => (a.axis === 'artifact' ? { ...a, dir: resolve(FIXTURES, 'artifact'), planned: [], deferred: [] } : a));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

// --- allow: every worked example is a clean pass ---------------------------
console.log('worked examples (expect 0 issues each)');
const exampleFiles = readdirSync(EXAMPLES).filter((f) => f.startsWith('intent-') && f.endsWith('.example.json'));
check('at least 5 worked examples exist', exampleFiles.length >= 5, `found ${exampleFiles.length}`);
for (const file of exampleFiles) {
  const intent = load(file);
  const { issues } = validateIntent(intent, schema);
  check(file, issues.length === 0, JSON.stringify(issues));
}

const ready = load('intent-synthesize-research-suengj.example.json');
const blocked = load('intent-blocked-clarification.example.json');
const defaultAuthorized = load('intent-default-authorized.example.json');
const withReference = load('intent-reference-dimensions.example.json');

// --- deny: targeted single-field mutations ----------------------------------
console.log('single-field mutations (expect the named code)');

const cases = [
  ['a missing_material axis absent from clarification.required fails', CODES.MISSING_MATERIAL_UNLISTED, () => {
    const m = clone(blocked);
    m.clarification.required = m.clarification.required.filter((r) => r !== 'axes.content_type');
    return m;
  }],
  ['status: ready while clarification is required fails', CODES.CLARIFICATION_STATUS, () => {
    const m = clone(blocked);
    m.status = 'ready';
    return m;
  }],
  ['non-empty clarification.required with a status other than blocked_on_clarification fails', CODES.CLARIFICATION_STATUS, () => {
    const m = clone(blocked);
    m.status = 'declined';
    m.clarification.note = 'declined anyway';
    return m;
  }],
  ['an axis naming a nonexistent profile fails', CODES.UNKNOWN_PROFILE, () => {
    const m = clone(ready);
    m.axes.audience.value = 'domain-alien-overlord';
    m.axes.audience.profile_ref = undefined;
    delete m.axes.audience.profile_ref;
    return m;
  }],
  ['a source id placed in references is rejected by the ref_id pattern', CODES.SCHEMA, () => {
    const m = clone(ready);
    m.inputs.references.push({ ref_id: m.inputs.sources[0].source_id, state: 'confirmed' });
    return m;
  }],
  ['four questions asked with no note fails the clarification gate', CODES.CLARIFICATION_GATE, () => {
    const m = clone(blocked);
    delete m.clarification.note;
    m.clarification.asked.push(
      { field: 'axes.surface', question: 'which surface?', options: ['suengj-com'], default: 'suengj-com', answer: null },
      { field: 'axes.audience', question: 'which audience?', options: ['domain-practitioner'], default: 'domain-practitioner', answer: null },
    );
    return m;
  }],
  ['four questions asked WITH a note passes the gate', null, () => {
    const m = clone(blocked);
    m.clarification.note = 'the source material mixed two genuinely distinct framings, so two extra questions were asked beyond the normal 1-3 gate.';
    m.clarification.asked.push(
      { field: 'axes.surface', question: 'which surface?', options: ['suengj-com'], default: 'suengj-com', answer: null },
      { field: 'axes.audience', question: 'which audience?', options: ['domain-practitioner'], default: 'domain-practitioner', answer: null },
    );
    return m;
  }],
  ['an artifact value whose modality prefix does not match its profile fails', CODES.ARTIFACT_MODALITY, () => {
    const m = clone(withReference);
    m.axes.artifacts[0].value = 'visual/mismatch';
    delete m.axes.artifacts[0].profile_ref;
    return m;
  }, { axes: mismatchAxes }],
  ['a confirmed axis value with no basis fails', CODES.MISSING_BASIS, () => {
    const m = clone(ready);
    delete m.axes.surface.basis;
    return m;
  }],
  ['an assumed axis value with no basis fails', CODES.MISSING_BASIS, () => {
    const m = clone(defaultAuthorized);
    delete m.axes.transformation.basis;
    return m;
  }],
  ['additionalProperties: false is enforced', CODES.SCHEMA, () => {
    const m = clone(ready);
    m.unexpected_top_level_field = true;
    return m;
  }],
  ['a status outside the enum is rejected', CODES.SCHEMA, () => {
    const m = clone(ready);
    m.status = 'published';
    return m;
  }],

  // AES-V2.11 (SUE-569), P2 — portability probe 2026-09-05
  // (evals/system/portability/2026-09-05-intra-family-capability.md). On
  // this exact utterance, one Claude route (Haiku 4.5) marked content type
  // `assumed`, cited the contract, and supplied a justification appearing
  // nowhere in it. `ready` already requests visual/body-infographic with 3
  // confirmed sources, so note.json is excluded (its artifacts.inappropriate
  // lists "infographic") and the remaining plausible types spread by 2
  // sources in min_sources — material by the contract's own numeric test.
  // Reproduced here as `assumed` with no clarification entry: it must now
  // fail closed rather than pass as Route A's response did.
  ['P2 — Route A\'s content-type-assumed failure now fails closed', CODES.MATERIALITY_UNLISTED, () => {
    const m = clone(ready);
    m.axes.content_type = {
      value: 'research',
      state: 'assumed',
      profile_ref: 'editorial/profiles/content/research.json',
      basis: 'getting it wrong costs little to correct later; the risk direction is acceptable.',
    };
    return m;
  }],
];

for (const [name, expected, build, opts] of cases) {
  const intent = build();
  const got = codesOf(intent, opts);
  if (expected === null) {
    check(name, got.length === 0, `expected 0 issues, got [${[...new Set(got)].join(', ')}]`);
  } else {
    check(name, got.includes(expected), `expected ${expected}, got [${[...new Set(got)].join(', ')}]`);
  }
}

// --- fail-closed -------------------------------------------------------------
console.log('fail-closed behaviour');
{
  check('an empty object is not a silent pass', codesOf({}).length > 0);
  check('a null intent is not a silent pass', codesOf(null).length > 0);
  check('an unparseable file is not a silent pass', validateIntent(undefined, schema).issues.length > 0);
}

// --- notes, not failures, for planned/deferred profiles ---------------------
console.log('planned/deferred profile references are notes, not failures');
{
  const { issues, notes } = validateIntent(ready, schema);
  check('text/article (planned) does not fail the run', issues.length === 0, JSON.stringify(issues));
  check('text/article (planned) is surfaced as a note', notes.some((n) => n.message.includes('text/article')));
}

// --- demonstration: the probe's own case, computed rather than judged -----
console.log('\nportability probe 2026-09-05 — computed content-type materiality');
{
  const routeA = clone(ready);
  routeA.axes.content_type = { value: 'research', state: 'assumed', profile_ref: 'editorial/profiles/content/research.json', basis: 'x' };
  const p2p3 = load('intent-portability-p2-p3-agent-materials.example.json');
  console.log(`  Route A shape (content_type assumed): material=${evaluateContentTypeMateriality(routeA).material}`);
  console.log(`  reason: ${evaluateContentTypeMateriality(routeA).reason}`);
  console.log(`  Route C shape (content_type missing_material, listed): material=${evaluateContentTypeMateriality(p2p3).material}, listed=${p2p3.clarification.required.includes('axes.content_type')}`);
}

console.log(failures === 0 ? '\nintent contract regression: PASS' : `\nintent contract regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
