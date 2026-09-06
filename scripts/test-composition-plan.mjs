#!/usr/bin/env node
/**
 * Regression test for the composition plan contract — AES-V2.16b (SUE-628).
 *
 * Three directions, all required:
 *   allow fixtures (schemas/examples/composition-plan-*.example.json)  → PASS
 *   one deny fixture per cross-field rule R1-R15, asserted by code     → FAIL
 *   the rejected SUE-570 body infographic, re-expressed as a plan      → FAIL
 *
 * The last one is the point of the file. SUE-570 was rejected by an owner
 * looking at six SVGs; this suite asserts that the same plate is now rejected
 * by a program looking at a plan, before anything is rendered. Every negative
 * test asserts a CODE, never a message string — the message is prose that may
 * be improved, the code is the routing decision and must not drift.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, loadArtifactProfiles, loadSchema, validateCompositionPlan,
} from './lib/composition-plan-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXAMPLES_DIR = resolve(ROOT, 'schemas/examples');

const schema = loadSchema();
const profiles = loadArtifactProfiles();
const opts = { schema, profiles };

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const clone = (o) => JSON.parse(JSON.stringify(o));
const loadExample = (name) => JSON.parse(readFileSync(resolve(EXAMPLES_DIR, name), 'utf8'));
const codesOf = (plan) => validateCompositionPlan(plan, opts).map((i) => i.code);

/** Assert a mutation trips exactly the rule it is supposed to trip. */
const denies = (name, plan, code) => {
  const codes = codesOf(plan);
  check(name, codes.includes(code), `got [${codes.join(', ') || 'no issues'}]`);
};

// --- allow fixtures --------------------------------------------------------
console.log('allow fixtures (expect PASS)');

const fixtureFiles = readdirSync(EXAMPLES_DIR)
  .filter((f) => f.startsWith('composition-plan-') && f.endsWith('.example.json'))
  .sort();

check('at least 2 composition-plan example fixtures exist (a topological plate and a comparison plate)',
  fixtureFiles.length >= 2, fixtureFiles.join(', '));

for (const f of fixtureFiles) {
  const issues = validateCompositionPlan(loadExample(f), opts);
  check(f, issues.length === 0, issues.map((i) => `[${i.code}] ${i.message}`).join(' | '));
}

const mechanism = loadExample('composition-plan-mechanism.example.json');
const comparison = loadExample('composition-plan-comparison.example.json');

check('the mechanism plate is the honest topological case: position convention declared, both axes null',
  mechanism.composition.geometry.position_convention === 'topological' &&
  mechanism.composition.geometry.x_axis_encodes === null &&
  mechanism.composition.geometry.y_axis_encodes === null);

check('the comparison plate names an axis and reads by shared-axis alignment, not by arrows',
  typeof comparison.composition.geometry.x_axis_encodes === 'string' &&
  comparison.composition.reading_order_mechanism === 'shared_axis_alignment');

// --- deny fixtures: one per cross-field rule -------------------------------
console.log('\ndeny fixtures (expect FAIL, with the specific rule named)');

{
  // R1 (F1/T1) — a plate that claims position carries meaning and then names
  // neither axis. The routable test from the forensics: name the axes.
  const plan = clone(comparison);
  plan.composition.geometry.x_axis_encodes = null;
  plan.composition.geometry.y_axis_encodes = null;
  denies('R1 decorative-geometry: controlled_comparison with neither axis named', plan, CODES.DECORATIVE_GEOMETRY);
}

{
  // R1, other direction — a topological plate that names an axis anyway. The
  // declaration and the geometry have to agree in both directions or the
  // declaration is decoration too (C1).
  const plan = clone(mechanism);
  plan.composition.geometry.x_axis_encodes = 'time since the tool was adopted';
  denies('R1 decorative-geometry: topological plate with a named axis', plan, CODES.DECORATIVE_GEOMETRY);
}

{
  // R2 (F2/T10/C2) — chrome scaling with elements rather than with modules.
  const plan = clone(comparison);
  plan.composition.enclosure_budget.enclosures_planned = 6; // against 2 parallel boundaries
  denies('R2 enclosure-inflation: more enclosures than parallel-category boundaries', plan, CODES.ENCLOSURE_INFLATION);
}

{
  // R3 (F3) — a module whose content is a sentence and whose enclosure is the
  // only visual work done. Representable so that it is testable.
  const plan = clone(mechanism);
  plan.semantic_plan.modules[2].prose_only = true;
  denies('R3 prose-in-a-rectangle: a module declaring prose_only', plan, CODES.PROSE_IN_A_RECTANGLE);
}

{
  // R4 (F4) — a reading path that does not cover the modules is a forked path.
  const plan = clone(mechanism);
  plan.semantic_plan.reading_order = ['recorded-measure', 'optimisation-pressure'];
  denies('R4 reading-order-mismatch: reading_order omits a module', plan, CODES.READING_ORDER_MISMATCH);
}

{
  // R5 — a relation endpoint that names no module. Not a signature of its
  // own; it is the check that makes every other relation rule meaningful.
  const plan = clone(mechanism);
  plan.semantic_plan.relations[0].to = 'span-of-control';
  denies('R5 unresolved-relation-endpoint: relation.to names no module', plan, CODES.UNRESOLVED_ENDPOINT);
}

{
  // R5b (T4) — a comparison plate pairs the same two modules once per row, so
  // a repeated pairing is legitimate only when each names its dimension.
  const plan = clone(mechanism);
  const [a, b] = [plan.semantic_plan.modules[0].id, plan.semantic_plan.modules[1].id];
  plan.semantic_plan.relations = [
    { from: a, to: b, type: 'correspondence', load_bearing: true, basis: 'stated', dimension: 'interface' },
    { from: a, to: b, type: 'correspondence', load_bearing: true, basis: 'stated', dimension: 'interface' },
  ];
  denies('R5b duplicate-relation-pairing: the same pair repeated on the same dimension',
    plan, CODES.DUPLICATE_PAIRING);
}

{
  // R5b, the un-named case — two identical pairings with no dimension at all
  // cannot be told apart, so one of them cannot be drawn or checked.
  const plan = clone(mechanism);
  const [a, b] = [plan.semantic_plan.modules[0].id, plan.semantic_plan.modules[1].id];
  plan.semantic_plan.relations = [
    { from: a, to: b, type: 'correspondence', load_bearing: true, basis: 'stated' },
    { from: a, to: b, type: 'correspondence', load_bearing: true, basis: 'stated' },
  ];
  denies('R5b duplicate-relation-pairing: repeated pair with no dimension to distinguish it',
    plan, CODES.DUPLICATE_PAIRING);
}

{
  // R5b, the case that MUST stay legal. T5 requires containment, flow and
  // authority to be separate channels between the same two modules — two
  // relations sharing a pair but differing in type are the point of that
  // trait, not a duplicate. Keying the check on the pair alone would reject
  // every correctly-built governance plate.
  const plan = clone(mechanism);
  const [a2, b2] = [plan.semantic_plan.modules[0].id, plan.semantic_plan.modules[1].id];
  plan.semantic_plan.relations = [
    { from: a2, to: b2, type: 'causal-chain', load_bearing: true, basis: 'stated' },
    { from: a2, to: b2, type: 'containment', load_bearing: true, basis: 'stated' },
  ];
  plan.composition.connector_channels = {
    containment: 'a nesting boundary',
    flow: 'a solid directed arc',
  };
  check('R5b duplicate-relation-pairing: the same pair on DIFFERENT relation types is allowed (T5)',
    !codesOf(plan).includes(CODES.DUPLICATE_PAIRING));
}

{
  // R5b, the case the rule exists to permit — the same pair once per row,
  // each naming its dimension. This is what a comparison plate actually is.
  const plan = clone(mechanism);
  const [a, b] = [plan.semantic_plan.modules[0].id, plan.semantic_plan.modules[1].id];
  plan.semantic_plan.relations = [
    { from: a, to: b, type: 'correspondence', load_bearing: true, basis: 'stated', dimension: 'unit of programming' },
    { from: a, to: b, type: 'correspondence', load_bearing: true, basis: 'stated', dimension: 'interface' },
  ];
  check('R5b duplicate-relation-pairing: the same pair once per named dimension is allowed (T4)',
    !codesOf(plan).includes(CODES.DUPLICATE_PAIRING));
}

{
  // R6 (F5/T9) — the SUE-570 infographic rendered its labels at 5.2-6.5px.
  const plan = clone(mechanism);
  plan.composition.mobile_strategy.min_type_px = 8.4;
  denies('R6 mobile-type-floor: min_type_px below the 14px floor', plan, CODES.MOBILE_TYPE_FLOOR);
}

{
  // R6, boundary — 14 is the floor, not the first failing value.
  const plan = clone(mechanism);
  plan.composition.mobile_strategy.min_type_px = 14;
  check('R6 mobile-type-floor: exactly 14px passes (the floor is inclusive)',
    !codesOf(plan).includes(CODES.MOBILE_TYPE_FLOOR));
}

{
  // R7 (F7) — the ceiling visual-body-infographic.json has always stated, now
  // actually checked. The rejected plate carried 22 labels against 8.
  const plan = clone(mechanism);
  plan.composition.label_strategy.max_labels = 22;
  denies('R7 label-ceiling: max_labels 22 against the body-infographic ceiling of 8', plan, CODES.LABEL_CEILING);
}

{
  // R7, fail-closed — an unresolvable profile must FAIL rather than skip the
  // check, because a silently skipped ceiling is signature F7 itself.
  const plan = clone(mechanism);
  const issues = validateCompositionPlan(plan, { schema, profiles: {} });
  check('R7 label-ceiling: an unresolvable artifact profile fails closed rather than skipping the check',
    issues.some((i) => i.code === CODES.LABEL_CEILING), issues.map((i) => i.code).join(', '));
}

{
  // R8 (T5) — authority collapsed into flow is the specific collapse the
  // benchmark names; the caption is then forced to disambiguate.
  const plan = clone(mechanism);
  plan.composition.connector_channels = {
    containment: 'a solid enclosing outline',
    flow: 'a solid directed arc with an open arrowhead, one weight throughout',
    authority: 'a solid directed arc with an open arrowhead, one weight throughout',
  };
  denies('R8 channel-collision: flow and authority ride the same channel', plan, CODES.CHANNEL_COLLISION);
}

{
  // R8, requirement half — a containment relation with no channels declared.
  const plan = clone(mechanism);
  plan.semantic_plan.relations[0].type = 'containment';
  delete plan.composition.connector_channels;
  denies('R8 channel-collision: a containment relation with no connector_channels', plan, CODES.CHANNEL_COLLISION);
}

{
  // R9 (T8) — a temporal relation with no declared scale.
  const plan = clone(mechanism);
  plan.semantic_plan.relations[1].type = 'temporal-ordinal';
  denies('R9 undeclared-time-scale: a temporal relation with no time_scale', plan, CODES.UNDECLARED_TIME_SCALE);
}

{
  // R9, mismatch half — ordinal applied to duration-critical data fails
  // silently, which is why the declaration must agree with the relation.
  const plan = clone(mechanism);
  plan.semantic_plan.relations[1].type = 'temporal-proportional';
  plan.composition.geometry.time_scale = 'ordinal';
  denies('R9 undeclared-time-scale: temporal-proportional declared as an ordinal scale', plan, CODES.UNDECLARED_TIME_SCALE);
}

{
  // R10 (T12) — the 2x2 that borrows the appearance of a matrix while neither
  // axis means anything. This is the SUE-570 layout defect in one field.
  const plan = clone(mechanism);
  plan.semantic_plan.relations[0].type = 'matrix';
  denies('R10 matrix-requires-both-axes: a matrix relation on a topological plate with null axes', plan, CODES.MATRIX_BOTH_AXES);
}

{
  // R11 (C3) — a matrix that silently degrades into a list on mobile has
  // stopped being a matrix without telling anyone.
  const plan = clone(comparison);
  plan.semantic_plan.relations[0].type = 'matrix';
  delete plan.composition.mobile_strategy.downgrade_disclosed;
  denies('R11 matrix-mobile-downgrade: a matrix restacked on mobile with no disclosed downgrade', plan, CODES.MATRIX_MOBILE_DOWNGRADE);
}

{
  // R12 (T11) — the SUE-570 plate spent plate area marking a module
  // "(c2, 검증 안 됨)". That disclosure belongs to the caption layer.
  const plan = clone(mechanism);
  plan.semantic_plan.modules[2].label = '해석 · 미검증 개념';
  denies('R12 interpretation-boundary: an interpretation disclaimer inside a module label', plan, CODES.INTERPRETATION_BOUNDARY);
}

{
  // R13 — a route that admits a non-deterministic contributor without
  // enumerating what it may contribute.
  const plan = clone(mechanism);
  plan.renderer_route = 'hybrid';
  denies('R13 generative-support-missing: hybrid route with no generative_support block', plan, CODES.GENERATIVE_SUPPORT_MISSING);
}

{
  // R13, other direction — a deterministic route that carries one anyway.
  const plan = clone(mechanism);
  plan.generative_support = { permitted_elements: ['background_texture'], load_bearing: false };
  denies('R13 generative-support-missing: deterministic route carrying a generative_support block', plan, CODES.GENERATIVE_SUPPORT_MISSING);
}

{
  // R13, allowed shape — the hybrid route IS legal once the contribution is
  // enumerated and declared non-load-bearing.
  const plan = clone(mechanism);
  plan.renderer_route = 'hybrid';
  plan.generative_support = { permitted_elements: ['background_texture'], load_bearing: false };
  const codes = codesOf(plan);
  check('R13 generative-support-missing: hybrid + an enumerated, non-load-bearing contribution is accepted',
    codes.length === 0, `got [${codes.join(', ')}]`);
}

{
  // R14 — a plate that claims to be a split and names no sibling has not
  // split; it has dropped the rest of its question.
  const plan = clone(mechanism);
  plan.composition.plate_split = { is_split: true };
  denies('R14 split-requires-siblings: is_split true with no sibling_plates', plan, CODES.SPLIT_REQUIRES_SIBLINGS);
}

{
  // R14, self-reference half.
  const plan = clone(mechanism);
  plan.composition.plate_split = { is_split: true, sibling_plates: [plan.plan_id] };
  denies('R14 split-requires-siblings: sibling_plates lists the plate itself', plan, CODES.SPLIT_REQUIRES_SIBLINGS);
}

{
  // R15 (F6) — the article title and publication date rendered into the
  // artwork, which is exactly what both failed SUE-570 assets carried.
  const plan = clone(mechanism);
  plan.semantic_plan.modules[0].label = '도구를 닮아간다 (2026)';
  denies('R15 mutable-copy-in-artwork: a module label carrying a 4-digit year', plan, CODES.MUTABLE_COPY);
}

{
  // R15, credit-line half — "source: …" is the literal string the rejected
  // SVGs carried, merged into the same 10.5px line as a legitimate legend.
  const plan = clone(mechanism);
  plan.semantic_plan.modules[1].label = 'source: 출처 원문';
  denies('R15 mutable-copy-in-artwork: a module label carrying a source/credit line', plan, CODES.MUTABLE_COPY);
}

// --- the named regression: SUE-570 tools-report-infographic.svg ------------
console.log('\nSUE-570 regression — tools-report-infographic.svg re-expressed as a composition plan');

/**
 * The rejected body infographic, written as the plan that would have produced
 * it. Every number here is taken from
 * evals/negative-baselines/SUE-570-INFOGRAPHIC-FORENSICS.md: four hand-placed
 * modules on a 2x2 grid whose axes mean nothing (§1), 12 drawn enclosures
 * against 4 modules (§2), modules C and D containing no geometry at all (§3),
 * 22 <text> elements against a ceiling of 8 (§7), and a smallest effective
 * type size of 5.2px at a 358px reading width (§5).
 *
 * Two things this plan cannot say, and both are the contract working:
 *
 *   - The plate's fifth element (열린 질문, the open question in a dashed box)
 *     cannot be added: schemas/composition-plan.schema.json caps modules at 4.
 *     That cap IS signature F4 — the plate that grew a fifth module instead of
 *     splitting — and it is enforced by the schema rather than by a rule here,
 *     which is why there is no R-number for it. Adding a fifth module below
 *     produces a schema issue, not a cross-field one.
 *   - The asset's actual mobile behaviour, uniform downscaling, is deliberately
 *     not in the mobile_strategy enum (T9). "reflow" is the most generous claim
 *     the plan can make.
 *
 * What this suite does NOT show, and an earlier version of this comment wrongly
 * claimed it did: that the SUE-570 PLATE is unrepresentable. Every code below
 * fires on a value the plan's own author wrote. Independent review demonstrated
 * the consequence — changing six self-reported fields on this same object, and
 * nothing about the picture, makes it pass clean. A plan legitimately records
 * intent, so that is not a defect in the format; believing the plan is the
 * defect. scripts/test-plate-verify.mjs closes it by measuring the actual
 * rendered asset against the declaration.
 */
const sue570 = {
  schema_version: '1.0.0',
  plan_id: 'plate:sue570-tools-report-infographic',
  artifact_profile: 'visual/body-infographic',
  profile_ref: 'editorial/profiles/artifact/visual-body-infographic.json',
  article_ref: {
    slug: 'companies-become-like-the-tools-they-use',
    content_hash: null,
    surface: 'suengj.com',
  },
  semantic_plan: {
    primary_question: '스프레드시트의 경로가 AI에도 그대로 적용되는가?',
    modules: [
      {
        id: 'spreadsheet-mechanism',
        // §6: the article title and the publication date rendered into the artwork.
        label: '도구를 닮아간다 (2026)',
        role: 'observation',
        carries: 'top-left card at x=24 y=50; the coordinates encode nothing',
      },
      {
        id: 'authority-shift',
        label: '권한 이동의 반복',
        role: 'observation',
        carries: 'top-right card at x=368 y=50; "B is right of A" asserts no relation',
      },
      {
        id: 'core-reading',
        // §3: the module marked as an unverified concept inside the artwork.
        label: '핵심 해석 · 미검증 개념',
        role: 'interpretation',
        carries: 'three lines of prose set inside a rectangle',
        prose_only: true,
      },
      {
        id: 'divergence-point',
        label: '갈라지는 지점',
        role: 'open_question',
        carries: 'three more lines of prose set inside a rectangle',
        prose_only: true,
      },
    ],
    relations: [
      { from: 'spreadsheet-mechanism', to: 'authority-shift', type: 'causal-chain', load_bearing: true, basis: 'stated' },
      { from: 'authority-shift', to: 'core-reading', type: 'causal-chain', load_bearing: true, basis: 'interpreted' },
      { from: 'core-reading', to: 'divergence-point', type: 'correspondence', load_bearing: false, basis: 'interpreted' },
    ],
    reading_order: ['spreadsheet-mechanism', 'authority-shift', 'core-reading', 'divergence-point'],
    must_preserve: ['the analogy between the spreadsheet era and the AI era'],
    evidence_boundary: {
      in_plate: 'the four cards',
      in_caption: 'nothing — the caption layer was left empty and the disclosures were stamped into the artwork instead',
    },
    information_gain: {
      gain_kind: 'mechanism',
      adjacent_representation: 'the article section the four cards were transcribed from',
      what_prose_cannot_do: 'nothing — the first-read payload is identical to the sentences the cards were derived from',
    },
  },
  composition: {
    geometry: {
      // §1: a 2x2 arrangement borrowing the appearance of a matrix while
      // neither axis means anything.
      position_convention: 'scale',
      x_axis_encodes: null,
      y_axis_encodes: null,
    },
    // The modules were lettered A/B/C/D precisely because the geometry could
    // not say what the order was.
    reading_order_mechanism: 'explicit_connectors',
    enclosure_budget: {
      // §2: 4 module cards + 7 chips/accent bars + 1 dashed conclusion box.
      parallel_category_boundaries: 4,
      enclosures_planned: 12,
      justification: 'cards for the modules, chips inside the cards, and a dashed box for the conclusion',
    },
    typography_roles: [
      { role: 'card title', channel: ['weight'] },
      { role: 'card body', channel: ['size'] },
      { role: 'chip label', channel: ['size'] },
    ],
    label_strategy: {
      // §7: 22 <text> elements against visual-body-infographic.json's ceiling of 8.
      max_labels: 22,
      stable_only: true,
    },
    mobile_strategy: {
      strategy: 'reflow',
      viewport_px: 390,
      // §5: 10.5px authored type at a 0.497 scale factor.
      min_type_px: 5.7,
    },
    plate_split: { is_split: false },
  },
  renderer_route: 'deterministic',
};

{
  const issues = validateCompositionPlan(sue570, opts);
  const codes = issues.map((i) => i.code);

  check('the SUE-570 plate is expressible as a plan (it fails on rules, not on being unrepresentable)',
    !codes.includes(CODES.SCHEMA), issues.filter((i) => i.code === CODES.SCHEMA).map((i) => i.message).join(' | '));

  const required = [
    CODES.DECORATIVE_GEOMETRY,
    CODES.ENCLOSURE_INFLATION,
    CODES.PROSE_IN_A_RECTANGLE,
    CODES.MOBILE_TYPE_FLOOR,
    CODES.LABEL_CEILING,
    CODES.MUTABLE_COPY,
  ];
  for (const code of required) {
    check(`SUE-570 is rejected with [${code}]`, codes.includes(code), `got [${codes.join(', ')}]`);
  }

  // Also caught, and worth naming: the in-artwork "미검증" disclosure (T11).
  check('SUE-570 is additionally rejected for stamping an interpretation disclaimer into the artwork',
    codes.includes(CODES.INTERPRETATION_BOUNDARY), `got [${codes.join(', ')}]`);

  check('SUE-570 is rejected by more than one layer, so the verdict is routable rather than a single opinion',
    new Set(codes).size >= 6, `distinct codes: ${[...new Set(codes)].join(', ')}`);
}

{
  // Signature F4 is enforced by the schema's 2-4 module cap, not by a rule in
  // composition-plan-core.mjs: the plate's fifth element (열린 질문) cannot be
  // expressed at all.
  const overloaded = clone(sue570);
  overloaded.semantic_plan.modules.push({
    id: 'open-question',
    label: '열린 질문',
    role: 'open_question',
    carries: 'a dashed rectangle holding two more lines of prose',
    prose_only: true,
  });
  overloaded.semantic_plan.reading_order.push('open-question');
  const codes = codesOf(overloaded);
  check('F4 multi-question plate: a fifth module is not representable — the schema cap rejects it',
    codes.includes(CODES.SCHEMA), `got [${codes.join(', ')}]`);
}

console.log(failures === 0 ? '\ncomposition-plan: ALL PASS' : `\ncomposition-plan: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
