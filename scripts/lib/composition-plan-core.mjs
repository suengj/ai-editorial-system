/**
 * Composition plan engine — AES-V2.16b (SUE-628).
 *
 * Validates one plate's renderer-neutral information design against
 * schemas/composition-plan.schema.json plus the cross-field rules a schema
 * cannot express. Every rule here is derived from a named trait in
 * benchmarks/EDITORIAL-INFOGRAPHIC-INFORMATION-DESIGN.md and enforces a named
 * failure signature in evals/negative-baselines/SUE-570-INFOGRAPHIC-FORENSICS.md,
 * so a rejected plate routes to a layer instead of triggering an untraceable
 * reroll.
 *
 * Modelled on scripts/lib/visual-job-core.mjs: pure functions, a frozen CODES
 * table, and an issue(code, where, message) shape. One code per rule, because
 * a code that covers two rules cannot be routed. Nothing in this file names a
 * renderer.
 *
 * The schema carries the rules it can carry — notably the 2-4 module cap
 * (signature F4) and `label_strategy.stable_only: true` (F6) — and this module
 * carries the rest. Schema issues short-circuit the cross-field pass: a
 * structurally unsound plan produces cross-field noise, not evidence.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { loadArtifactProfiles } from './visual-job-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export const COMPOSITION_PLAN_SCHEMA = resolve(ROOT, 'schemas/composition-plan.schema.json');

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

export const loadSchema = (p = COMPOSITION_PLAN_SCHEMA) => readJSON(p);

// The artifact axis is owned by editorial/profiles/artifact/, and
// visual-job-core already loads it keyed by profile id. Re-exported rather
// than re-implemented so the two contracts can never disagree about what a
// profile is.
export { loadArtifactProfiles };

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  // R1..R15, in the order they are evaluated.
  DECORATIVE_GEOMETRY: 'decorative-geometry',
  ENCLOSURE_INFLATION: 'enclosure-inflation',
  PROSE_IN_A_RECTANGLE: 'prose-in-a-rectangle',
  READING_ORDER_MISMATCH: 'reading-order-mismatch',
  UNRESOLVED_ENDPOINT: 'unresolved-relation-endpoint',
  DUPLICATE_PAIRING: 'duplicate-relation-pairing',
  MOBILE_TYPE_FLOOR: 'mobile-type-floor',
  LABEL_CEILING: 'label-ceiling',
  CHANNEL_COLLISION: 'channel-collision',
  UNDECLARED_TIME_SCALE: 'undeclared-time-scale',
  MATRIX_BOTH_AXES: 'matrix-requires-both-axes',
  MATRIX_MOBILE_DOWNGRADE: 'matrix-mobile-downgrade',
  INTERPRETATION_BOUNDARY: 'interpretation-boundary',
  GENERATIVE_SUPPORT_MISSING: 'generative-support-missing',
  SPLIT_REQUIRES_SIBLINGS: 'split-requires-siblings',
  MUTABLE_COPY: 'mutable-copy-in-artwork',
});

const issue = (code, where, message) => ({ code, where, message });

/** Trait T9 / signature F5: the SUE-570 set rendered module labels at 5.2-6.5px. */
export const MIN_TYPE_PX = 14;

/**
 * Signature F6 — mutable publication copy baked into artwork. A label is
 * artwork; a title, a date, a credit line and a citation all belong to the
 * caption layer, which owns text that can be revised without re-rendering.
 */
const MUTABLE_COPY_PATTERNS = Object.freeze([
  { name: 'a 4-digit year', re: /(?<!\d)\d{4}(?!\d)/ },
  { name: 'an ISO date', re: /\d{4}-\d{2}-\d{2}/ },
  { name: 'a source/credit line', re: /source\s*:|출처/i },
]);

/**
 * Trait T11 — the observed/asserted boundary is carried by medium. A plate
 * that stamps its own disclaimer has spent plate area on something the
 * caption layer already owns, and the SUE-570 plate did exactly this.
 */
const INTERPRETATION_DISCLAIMER = /미검증|unverified|검증\s*안|not verified/i;

const nonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/**
 * Validate a composition plan. Returns an array of issues; empty means PASS.
 *
 * Issue order is deterministic — schema issues first, then R1..R15 in order —
 * so a test can diff output rather than sort it.
 */
export function validateCompositionPlan(plan, { schema = loadSchema(), profiles = loadArtifactProfiles() } = {}) {
  const issues = [];
  const where = plan?.plan_id ?? '<plan>';

  for (const e of validate(plan, schema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }
  if (issues.length > 0) return issues; // structurally unsound; cross-field checks would be noise

  const sem = plan.semantic_plan;
  const comp = plan.composition;
  const geo = comp.geometry;
  const modules = sem.modules;
  const relations = sem.relations;
  const relationTypes = new Set(relations.map((r) => r.type));
  const channels = comp.connector_channels;

  // --- R1 · decorative-geometry (F1 / T1) ---------------------------------
  // The routable test from the forensics is literal: name the axes. Position
  // encoding nothing is legitimate for a topological plate and must be
  // declared as such; position encoding nothing while LOOKING like it encodes
  // something is the failure.
  const xNamed = nonEmptyString(geo.x_axis_encodes);
  const yNamed = nonEmptyString(geo.y_axis_encodes);
  if (geo.position_convention === 'scale' || geo.position_convention === 'controlled_comparison') {
    if (!xNamed && !yNamed) {
      issues.push(issue(CODES.DECORATIVE_GEOMETRY, `${where}#composition.geometry`,
        `position_convention "${geo.position_convention}" claims position carries meaning, but neither x_axis_encodes nor y_axis_encodes names anything — a plate whose dimensions cannot be given a semantic name is a list wearing a diagram's clothes (F1)`));
    }
  } else if (geo.position_convention === 'topological') {
    if (geo.x_axis_encodes !== null || geo.y_axis_encodes !== null) {
      issues.push(issue(CODES.DECORATIVE_GEOMETRY, `${where}#composition.geometry`,
        'position_convention "topological" declares that position carries nothing, so both x_axis_encodes and y_axis_encodes must be null — a named axis on a topological plate is an encoding the geometry does not actually perform (T1/C1)'));
    }
  } else if (geo.position_convention === 'containment') {
    if (!nonEmptyString(channels?.containment)) {
      issues.push(issue(CODES.DECORATIVE_GEOMETRY, `${where}#composition.geometry`,
        'position_convention "containment" makes nesting the thing position encodes, so composition.connector_channels.containment must name the channel that draws the boundary (T5)'));
    }
  }

  // --- R2 · enclosure-inflation (F2 / T10 / C2) ---------------------------
  // The budget is not "minimise boxes"; it is one enclosure per parallel-
  // category boundary that typography cannot encode, and none for anything
  // else. The SUE-570 plate drew 12 enclosures around 4 modules.
  const eb = comp.enclosure_budget;
  if (eb.enclosures_planned > eb.parallel_category_boundaries) {
    issues.push(issue(CODES.ENCLOSURE_INFLATION, `${where}#composition.enclosure_budget`,
      `${eb.enclosures_planned} enclosure(s) planned against ${eb.parallel_category_boundaries} parallel-category boundar(ies) — every enclosure past a boundary typography cannot encode is a tier that size, weight, case or whitespace could have carried (F2/C2)`));
  }

  // --- R3 · prose-in-a-rectangle (F3) -------------------------------------
  modules.forEach((m, i) => {
    if (m.prose_only === true) {
      issues.push(issue(CODES.PROSE_IN_A_RECTANGLE, `${where}#semantic_plan.modules[${i}]`,
        `module "${m.id}" declares prose_only — a module whose content is a sentence and whose enclosure is the only visual work done must be merged or given a geometry, not drawn (F3)`));
    }
  });

  // --- R4 · reading-order-mismatch (F4) -----------------------------------
  // A partial order means the reading path forks, which is a split trigger,
  // not a layout note.
  const moduleIds = modules.map((m) => m.id);
  const moduleIdSet = new Set(moduleIds);
  const order = sem.reading_order;
  const orderSet = new Set(order);
  const orderMatches = order.length === moduleIds.length &&
    orderSet.size === order.length &&
    moduleIds.every((id) => orderSet.has(id));
  if (!orderMatches) {
    issues.push(issue(CODES.READING_ORDER_MISMATCH, `${where}#semantic_plan.reading_order`,
      `reading_order [${order.join(', ')}] is not an exact permutation of modules [${moduleIds.join(', ')}] — a module with no place in the path, a duplicate, or a path step that is not a module means the plate has more than one reading path (F4)`));
  }

  // --- R5 · unresolved-relation-endpoint ----------------------------------
  relations.forEach((r, i) => {
    for (const end of ['from', 'to']) {
      if (!moduleIdSet.has(r[end])) {
        issues.push(issue(CODES.UNRESOLVED_ENDPOINT, `${where}#semantic_plan.relations[${i}].${end}`,
          `"${r[end]}" is not a declared module id — a relation pointing at nothing cannot be drawn, and cannot be checked`));
      }
    }
  });

  // --- R5b · duplicate-relation-pairing (T4) ------------------------------
  // A comparison plate carries several correspondences between the same two
  // modules, one per row, and each row's delta is load-bearing (T4). So a
  // repeated from/to pair is legitimate — but only when each instance names
  // the dimension it is about. Two identical pairings with no dimension are
  // indistinguishable, which means one of them cannot be drawn or checked.
  {
    const seen = new Map();
    (sem.relations ?? []).forEach((r, i) => {
      // Type is part of the identity: T5 requires containment, flow and
      // authority to be SEPARATE channels between the same two modules, so
      // two relations sharing a pair but differing in type are the point,
      // not a duplicate.
      const pair = `${r.from}→${r.to} (${r.type})`;
      const key = `${pair}|${r.dimension ?? ''}`;
      if (seen.has(key)) {
        issues.push(issue(CODES.DUPLICATE_PAIRING, `${where}#semantic_plan.relations[${i}]`,
          r.dimension === undefined
            ? `relation ${pair} repeats relations[${seen.get(key)}] with no "dimension" to tell them apart — a comparison plate may pair the same two modules once per row, but each row must name its dimension (T4)`
            : `relation ${pair} repeats relations[${seen.get(key)}] on the same dimension "${r.dimension}"`));
      } else {
        seen.set(key, i);
      }
    });
  }

  // --- R6 · mobile-type-floor (F5 / T9) -----------------------------------
  const mob = comp.mobile_strategy;
  if (!(mob.min_type_px >= MIN_TYPE_PX)) {
    issues.push(issue(CODES.MOBILE_TYPE_FLOOR, `${where}#composition.mobile_strategy`,
      `min_type_px ${mob.min_type_px} is below the ${MIN_TYPE_PX}px floor at viewport_px ${mob.viewport_px} — professional practice renegotiates height and holds type size; answering a narrow viewport by shrinking type is signature F5, and the SUE-570 set rendered 5.2-10.1px here`));
  }

  // --- R7 · label-ceiling (F7) --------------------------------------------
  // F7 is "a stated profile constraint with no mechanical check". The check
  // is therefore fail-closed on both halves: an unresolvable profile and a
  // profile with no ceiling both FAIL rather than skip, because a skip here
  // reproduces the exact gap the signature names.
  const profile = profiles[plan.artifact_profile];
  const ceiling = profile?.text_policy?.label_count_ceiling;
  if (!profile) {
    issues.push(issue(CODES.LABEL_CEILING, `${where}#composition.label_strategy`,
      `artifact_profile "${plan.artifact_profile}" does not resolve to a profile under editorial/profiles/artifact/, so max_labels cannot be checked against a ceiling — fail-closed, because an unchecked ceiling is signature F7`));
  } else if (typeof ceiling !== 'number') {
    issues.push(issue(CODES.LABEL_CEILING, `${where}#composition.label_strategy`,
      `profile "${plan.artifact_profile}" declares text_policy.label_count_ceiling ${JSON.stringify(ceiling)}, which is not a number — an information-design plate must be planned against a real ceiling, and an absent one fails closed rather than passing silently (F7)`));
  } else if (comp.label_strategy.max_labels > ceiling) {
    issues.push(issue(CODES.LABEL_CEILING, `${where}#composition.label_strategy`,
      `max_labels ${comp.label_strategy.max_labels} exceeds the "${plan.artifact_profile}" profile's text_policy.label_count_ceiling ${ceiling} — the ceiling existed before SUE-570 and nothing checked it (F7)`));
  }

  // --- R8 · channel-collision (T5) ----------------------------------------
  // Authority is the channel most often collapsed into flow, which forces the
  // caption to disambiguate what the geometry should have carried.
  const needsChannels = relationTypes.has('containment') || relationTypes.has('authority');
  if (needsChannels && !channels) {
    issues.push(issue(CODES.CHANNEL_COLLISION, `${where}#composition.connector_channels`,
      'the plate carries a containment or authority relation, so composition.connector_channels is required — containment, flow and authority need three separate visual channels (T5)'));
  }
  if (channels) {
    // Distinctness is checked whenever channels are declared at all, not only
    // when they are required: two channels sharing one visual treatment is a
    // collision regardless of which relation asked for them.
    const declared = ['containment', 'flow', 'authority']
      .filter((k) => nonEmptyString(channels[k]))
      .map((k) => [k, channels[k].trim()]);
    for (let i = 0; i < declared.length; i += 1) {
      for (let j = i + 1; j < declared.length; j += 1) {
        if (declared[i][1] === declared[j][1]) {
          issues.push(issue(CODES.CHANNEL_COLLISION, `${where}#composition.connector_channels`,
            `"${declared[i][0]}" and "${declared[j][0]}" both ride the channel "${declared[i][1]}" — collapsing two of containment/flow/authority into one treatment pushes the disambiguation into the caption (T5)`));
        }
      }
    }
  }

  // --- R9 · undeclared-time-scale (T8 / C4) -------------------------------
  // Ordinal applied to duration-critical data fails silently, which makes it
  // the more dangerous direction for an automated system — so the scale is
  // declared, and the declaration must agree with the relation.
  const hasProportional = relationTypes.has('temporal-proportional');
  const hasOrdinal = relationTypes.has('temporal-ordinal');
  if (hasProportional || hasOrdinal) {
    if (geo.time_scale === undefined) {
      issues.push(issue(CODES.UNDECLARED_TIME_SCALE, `${where}#composition.geometry`,
        'the plate carries a temporal relation, so composition.geometry.time_scale must be declared — proportional when the gaps carry meaning, ordinal when only order matters (T8)'));
    } else {
      if (hasProportional && geo.time_scale !== 'proportional') {
        issues.push(issue(CODES.UNDECLARED_TIME_SCALE, `${where}#composition.geometry`,
          `a temporal-proportional relation requires time_scale "proportional", got "${geo.time_scale}" — an ordinal axis under duration-critical data drops the measured gaps without saying so (T8)`));
      }
      if (hasOrdinal && geo.time_scale !== 'ordinal') {
        issues.push(issue(CODES.UNDECLARED_TIME_SCALE, `${where}#composition.geometry`,
          `a temporal-ordinal relation requires time_scale "ordinal", got "${geo.time_scale}" — a proportional axis invents durations the relation does not claim (T8/C4)`));
      }
    }
  }

  // --- R10 · matrix-requires-both-axes (T12) ------------------------------
  // A matrix is warranted only when two genuinely independent scales exist
  // and the task is "given A and B, what joint condition results?". A grid
  // whose axes mean nothing is the 2x2 the SUE-570 plate borrowed.
  if (relationTypes.has('matrix')) {
    if (!xNamed || !yNamed) {
      issues.push(issue(CODES.MATRIX_BOTH_AXES, `${where}#composition.geometry`,
        'a matrix relation needs both x_axis_encodes and y_axis_encodes named — if a sort on one variable answers the question it is not a matrix, however tempting the grid looks (T12)'));
    }
    if (geo.position_convention !== 'scale' && geo.position_convention !== 'controlled_comparison') {
      issues.push(issue(CODES.MATRIX_BOTH_AXES, `${where}#composition.geometry`,
        `a matrix relation requires position_convention "scale" or "controlled_comparison", got "${geo.position_convention}" — in a matrix, position is the joint condition (T12)`));
    }
  }

  // --- R11 · matrix-mobile-downgrade (C3) ---------------------------------
  // A true matrix does not serialise into a list without destroying the
  // joint-condition read. Collapsing an axis is permitted; hiding that it
  // happened is not.
  if (relationTypes.has('matrix') && (mob.strategy === 'reflow' || mob.strategy === 'restack')) {
    if (!nonEmptyString(mob.downgrade_disclosed)) {
      issues.push(issue(CODES.MATRIX_MOBILE_DOWNGRADE, `${where}#composition.mobile_strategy`,
        `mobile strategy "${mob.strategy}" on a matrix plate collapses the joint-condition read, so downgrade_disclosed must state what the mobile reader loses — a matrix that silently degrades into a list has stopped being a matrix without telling anyone (C3)`));
    }
  }

  // --- R12 · interpretation-boundary (T11) --------------------------------
  const carriesInterpretation = modules.some((m) => m.role === 'interpretation' || m.role === 'open_question') ||
    relations.some((r) => r.basis === 'interpreted');
  if (carriesInterpretation && !nonEmptyString(sem.evidence_boundary?.in_caption)) {
    issues.push(issue(CODES.INTERPRETATION_BOUNDARY, `${where}#semantic_plan.evidence_boundary`,
      'the plate carries an interpretation, an open question, or an interpreted relation, so evidence_boundary.in_caption must say what the caption asserts — the plate demonstrates, the caption claims (T11)'));
  }
  // Checked unconditionally: a disclaimer inside the artwork is misplaced
  // whichever module carries it. The SUE-570 plate spent plate area marking a
  // module `(c2, 검증 안 됨)` — that disclosure belongs to the caption layer.
  modules.forEach((m, i) => {
    if (INTERPRETATION_DISCLAIMER.test(m.label)) {
      issues.push(issue(CODES.INTERPRETATION_BOUNDARY, `${where}#semantic_plan.modules[${i}].label`,
        `label "${m.label}" carries an interpretation disclaimer inside the artwork — the observed/asserted boundary is made visible by medium, so this belongs in evidence_boundary.in_caption, not on the plate (T11)`));
    }
  });

  // --- R13 · generative-support-missing -----------------------------------
  // Plain `generative` is not representable for these families. What IS
  // representable must be enumerated, so "atmosphere only" is a declaration
  // rather than a hope.
  const route = plan.renderer_route;
  if ((route === 'hybrid' || route === 'generative_support') && plan.generative_support === undefined) {
    issues.push(issue(CODES.GENERATIVE_SUPPORT_MISSING, `${where}#generative_support`,
      `renderer_route "${route}" lets a non-deterministic step contribute, so generative_support must enumerate exactly what it may contribute — everything not listed stays deterministic`));
  }
  if (route === 'deterministic' && plan.generative_support !== undefined) {
    issues.push(issue(CODES.GENERATIVE_SUPPORT_MISSING, `${where}#generative_support`,
      'renderer_route "deterministic" means a program emits the whole plate, so a generative_support block is a contradiction — remove it or change the route'));
  }

  // --- R14 · split-requires-siblings --------------------------------------
  // A split is the prescribed response to a forking path or a fifth module.
  // A plate that claims to be a split and names no sibling has not split.
  const split = comp.plate_split;
  if (split?.is_split === true) {
    const siblings = split.sibling_plates ?? [];
    if (siblings.length === 0) {
      issues.push(issue(CODES.SPLIT_REQUIRES_SIBLINGS, `${where}#composition.plate_split`,
        'plate_split.is_split is true but sibling_plates is empty — a split that names no sibling is a plate that dropped the rest of its question rather than splitting it'));
    }
    if (siblings.includes(plan.plan_id)) {
      issues.push(issue(CODES.SPLIT_REQUIRES_SIBLINGS, `${where}#composition.plate_split`,
        `sibling_plates lists this plate's own plan_id "${plan.plan_id}" — a sibling is another plate, not this one`));
    }
  }

  // --- R15 · mutable-copy-in-artwork (F6) ---------------------------------
  modules.forEach((m, i) => {
    for (const { name, re } of MUTABLE_COPY_PATTERNS) {
      if (re.test(m.label)) {
        issues.push(issue(CODES.MUTABLE_COPY, `${where}#semantic_plan.modules[${i}].label`,
          `label "${m.label}" contains ${name} — mutable article/section titles, dates, captions and citations belong to the caption layer; the asset goes stale the moment the article is revised or re-dated (F6)`));
        break; // one report per label; the routing is identical for all three shapes
      }
    }
  });

  return issues;
}

export function validateCompositionPlanFile(path, options = {}) {
  let plan;
  try {
    plan = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable composition plan: ${err.message}`)];
  }
  return validateCompositionPlan(plan, options);
}
