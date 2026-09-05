/**
 * Delta plan / polish decision engine — AES-V2.18 (SUE-610).
 *
 * Two record kinds, one module, because the guards on the second (P1-P6,
 * the accept rule) only make sense in terms of the ceiling the first sets.
 * Full contract and rationale for every guard:
 *   - docs/architecture/SOURCE-TARGET-DELTA-PLANNING.md (delta plan, G1-G6)
 *   - docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md §11-§14 (polish
 *     decision, P1-P6, the pairwise gate, the accept rule A1-A3, edit
 *     surface)
 *
 * Modelled on scripts/lib/language-core.mjs and scripts/lib/l1-core.mjs: a
 * named export per check, an issue(code, where, message) shape, and a
 * validate* / validateAll aggregator. json-schema-lite has no minItems,
 * uniqueItems, or conditional (if/then) keywords, so completeness checks
 * (exactly seven axes, no duplicates) and every cross-field rule below live
 * here, not in the schemas.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { loadRoutingLayerIds, loadJson as loadPackJson } from './language-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');

export const DELTA_SCHEMA_PATH = resolve(ROOT, 'schemas/delta-plan.schema.json');
export const POLISH_SCHEMA_PATH = resolve(ROOT, 'schemas/polish-decision.schema.json');

export const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const loadDeltaSchema = (p = DELTA_SCHEMA_PATH) => loadJson(p);
export const loadPolishSchema = (p = POLISH_SCHEMA_PATH) => loadJson(p);

/** The seven delta axes, fixed order, fixed ids — SOURCE-TARGET-DELTA-PLANNING.md §2. */
export const DELTA_AXES = Object.freeze([
  'language_quality', 'genre', 'audience', 'knowledge_depth',
  'register', 'information_structure', 'terminology',
]);

/** Axes that are upstream-owned: a MATERIAL/LARGE delta on any of these may never be discharged as P1_LOCAL_POLISH — guard G1. */
const UPSTREAM_AXES = new Set(['audience', 'knowledge_depth', 'information_structure', 'genre']);

export const DELTA_STATES = Object.freeze(['LOW', 'MATERIAL', 'LARGE', 'UNKNOWN']);
export const INTERVENTION_LEVELS = Object.freeze(['P0_PRESERVE', 'P1_LOCAL_POLISH', 'P2_CONTROLLED_ADAPT', 'P3_RECOMPOSE']);

/** Ranking used ONLY to compute/verify the ceiling (a maximum, never a sum or average — the one arithmetic-shaped operation this module performs). */
const INTERVENTION_RANK = Object.freeze({ P0_PRESERVE: 0, P1_LOCAL_POLISH: 1, P2_CONTROLLED_ADAPT: 2, P3_RECOMPOSE: 3 });

/** Layers Language Polish already owns. An axis at P2/P3 naming one of these as owning_layer has not actually left polish's hands — guard G5. */
export const POLISH_OWNED_LAYERS = Object.freeze(['normative', 'native_fluency', 'domain_terminology']);

/** The eleven fixed pairwise criteria — LANGUAGE-QUALITY-ARCHITECTURE.md §13. */
export const PAIRWISE_CRITERIA = Object.freeze([
  'continuous_readability', 'native_naturalness', 'rhythm', 'repetition',
  'over_explication', 'stiffness', 'information_loss', 'semantic_integrity',
  'genre_preservation', 'audience_preservation', 'domain_terminology_preservation',
]);

/** repetition/over_explication/stiffness/information_loss are named after defects: "better" means LESS of it, not more of it. Documented here once so the polarity note is never re-derived per call site. */
export const INVERTED_POLARITY_CRITERIA = Object.freeze(['repetition', 'over_explication', 'stiffness', 'information_loss']);

/** A1 criteria: at least one must be "better". */
const A1_CRITERIA = ['continuous_readability', 'native_naturalness'];
/** A2 criteria: none may be "worse". */
const A2_CRITERIA = ['semantic_integrity', 'information_loss', 'genre_preservation', 'audience_preservation', 'domain_terminology_preservation'];
/** A3 criteria: none may be "worse". */
const A3_CRITERIA = ['repetition', 'over_explication', 'stiffness'];

/** Application modes that may never authorize an accepted polish edit — guard P5. */
const NON_AUTHORIZING_MODES = new Set(['upstream_guidance', 'local_observation', 'deprecated_as_instruction']);

/** The single source of truth for the advisory edit-surface band — LANGUAGE-QUALITY-ARCHITECTURE.md §14. Exceeding it never fails the draft; it requires large_edit_justification. */
export const ADVISORY_EDIT_SURFACE_BAND = 0.20;

/**
 * Field names forbidden anywhere in a delta or polish record —
 * SOURCE-TARGET-DELTA-PLANNING.md §3 / LANGUAGE-QUALITY-ARCHITECTURE.md's
 * no-aggregate rule. `edit_surface.original_total` and
 * `edit_surface.changed_total` are the one deliberate exception: they are
 * counts of a measurement unit (characters or sentences), not a quality
 * figure, and the record needs them to compute the advisory ratio at all.
 */
const FORBIDDEN_FIELD_NAME_RE = /(score|total|average|weight|distance|rating)/i;
const NO_AGGREGATE_EXEMPT_PATHS = new Set(['$.edit_surface.original_total', '$.edit_surface.changed_total']);

export const CODES = Object.freeze({
  PARSE: 'parse',
  DELTA_SCHEMA: 'delta-schema',
  POLISH_SCHEMA: 'polish-schema',
  AXIS_MISSING: 'delta-axis-missing',
  AXIS_DUPLICATED: 'delta-axis-duplicated',
  NO_AGGREGATE_FIELD: 'no-aggregate-forbidden-field-name',
  CEILING_MISMATCH: 'plan-intervention-ceiling-mismatch',
  G1_UPSTREAM_AXIS_LOCAL_POLISH: 'g1-upstream-axis-assigned-local-polish',
  G2_LANGUAGE_QUALITY_LARGE_LOCAL_POLISH: 'g2-language-quality-large-local-polish-alone',
  G3_LOW_DELTA_OVERREACH: 'g3-low-delta-overreach',
  G4_UNKNOWN_DELTA_OVERREACH: 'g4-unknown-delta-overreach',
  G4_UNKNOWN_MISSING_RESOLUTION: 'g4-unknown-missing-what-would-resolve-it',
  B_PACK_REF_MISSING: 'b-pack-ref-missing-for-mode-verification',
  B_PACK_UNRESOLVABLE: 'b-pack-ref-unresolvable',
  B_RULE_REF_UNRESOLVED: 'b-rule-ref-unresolved-in-pack',
  B_MODE_MISMATCH: 'b-application-mode-pack-mismatch',
  C_REVERT_REASON_MISSING: 'c-revert-reason-missing',
  D_CEILING_KEEP_REQUIRED: 'd-p0-preserve-ceiling-requires-keep',
  G5_MISSING_OWNING_LAYER: 'g5-missing-owning-layer',
  G5_OWNING_LAYER_IS_POLISH_OWNED: 'g5-owning-layer-is-polish-owned',
  G5_OWNING_LAYER_UNKNOWN: 'g5-owning-layer-not-in-routing-table',
  G6_RESTATEMENT: 'g6-source-observation-restates-target-requirement',
  P1_KEEP_HAS_ACCEPTED_EDIT: 'p1-keep-action-has-accepted-edit',
  P2_LOCAL_POLISH_NO_ACCEPTED_EDIT: 'p2-local-polish-no-accepted-edit',
  P3_UPSTREAM_MISSING_ROUTE: 'p3-upstream-replan-missing-route',
  P3_UPSTREAM_HAS_ACCEPTED_EDIT: 'p3-upstream-replan-has-accepted-edit',
  P4_SOFT_DETECTOR_MISSING_PAIRWISE: 'p4-soft-detector-missing-full-pairwise',
  P5_MODE_MAY_NOT_ACCEPT: 'p5-application-mode-may-not-accept',
  P6_HARD_LOCAL_MISSING_SEMANTIC_INTEGRITY: 'p6-hard-local-correction-missing-semantic-integrity',
  P6_HARD_LOCAL_WORSE_SEMANTIC_INTEGRITY: 'p6-hard-local-correction-semantic-integrity-worse',
  A1_FAIL: 'a1-no-readability-or-naturalness-improvement',
  A2_FAIL: 'a2-holistic-regression',
  A3_FAIL: 'a3-defect-regression',
  UPSTREAM_ROUTE_UNKNOWN_LAYER: 'upstream-route-unknown-layer',
  ADVISORY_BAND_JUSTIFICATION_MISSING: 'advisory-edit-surface-band-justification-missing',
});

const issue = (code, where, message) => ({ code, where, message });

// --- shared: no-aggregate ---------------------------------------------------

/**
 * Walks the whole record looking for a property name matching
 * /(score|total|average|weight|distance|rating)/i. The two legitimate counts
 * under edit_surface are exempted by exact path, not by name — so a NEW
 * field that happens to also be named `..._total` elsewhere in the record
 * still fires.
 */
export function checkNoAggregateFields(record, where) {
  const issues = [];
  const walk = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, v] of Object.entries(value)) {
        const path2 = `${path}.${key}`;
        if (FORBIDDEN_FIELD_NAME_RE.test(key) && !NO_AGGREGATE_EXEMPT_PATHS.has(path2)) {
          issues.push(issue(CODES.NO_AGGREGATE_FIELD, where,
            `property "${key}" at ${path2} matches the forbidden aggregate-name pattern /(score|total|average|weight|distance|rating)/i — no total, average, weighted distance, or rating may appear anywhere in a delta or polish record except edit_surface.original_total/changed_total, which are unit counts, not quality figures`));
        }
        walk(v, path2);
      }
    }
  };
  walk(record, '$');
  return issues;
}

// --- delta plan --------------------------------------------------------------

export function checkDeltaSchema(record, schema, where) {
  return validate(record, schema).map((e) => issue(CODES.DELTA_SCHEMA, where, `${e.path}: ${e.message}`));
}

/** Exactly seven axes, one per axis, no duplicates — json-schema-lite cannot enforce this. */
export function checkAxisCompleteness(record, where) {
  const issues = [];
  const counts = new Map();
  for (const d of record?.axis_deltas ?? []) counts.set(d.axis, (counts.get(d.axis) ?? 0) + 1);
  for (const axis of DELTA_AXES) {
    const count = counts.get(axis) ?? 0;
    if (count === 0) issues.push(issue(CODES.AXIS_MISSING, where, `axis_deltas is missing required axis "${axis}"`));
    else if (count > 1) issues.push(issue(CODES.AXIS_DUPLICATED, where, `axis_deltas carries axis "${axis}" ${count} times; each axis must appear exactly once`));
  }
  return issues;
}

/** G1-G6 — SOURCE-TARGET-DELTA-PLANNING.md §5. */
export function checkAxisGuards(record, where, { routingLayerIds = loadRoutingLayerIds() } = {}) {
  const issues = [];
  for (const d of record?.axis_deltas ?? []) {
    const axisWhere = `${where}:${d.axis}`;

    // G1 — upstream axes cannot be discharged as polish.
    if (UPSTREAM_AXES.has(d.axis) && (d.delta === 'MATERIAL' || d.delta === 'LARGE') && d.intervention === 'P1_LOCAL_POLISH') {
      issues.push(issue(CODES.G1_UPSTREAM_AXIS_LOCAL_POLISH, axisWhere,
        `axis "${d.axis}" has delta "${d.delta}" and intervention "P1_LOCAL_POLISH" — audience/knowledge_depth/information_structure/genre are upstream-owned axes and a MATERIAL or LARGE delta on one of them may never be assigned P1_LOCAL_POLISH (SOURCE-TARGET-DELTA-PLANNING.md §5 G1); route to P2_CONTROLLED_ADAPT or P3_RECOMPOSE`));
    }

    // G2 — pervasive translationese is not a polish-scale defect.
    if (d.axis === 'language_quality' && d.delta === 'LARGE' && d.intervention === 'P1_LOCAL_POLISH') {
      issues.push(issue(CODES.G2_LANGUAGE_QUALITY_LARGE_LOCAL_POLISH, axisWhere,
        'axis "language_quality" has delta "LARGE" and intervention "P1_LOCAL_POLISH" — pervasive translationese is not a polish-scale defect and routes to the translation/adaptation stage (SOURCE-TARGET-DELTA-PLANNING.md §5 G2, the "Translation boundary"); route to P2_CONTROLLED_ADAPT or P3_RECOMPOSE'));
    }

    // G3 — a small gap cannot justify a large intervention.
    if (d.delta === 'LOW' && d.intervention !== 'P0_PRESERVE' && d.intervention !== 'P1_LOCAL_POLISH') {
      issues.push(issue(CODES.G3_LOW_DELTA_OVERREACH, axisWhere,
        `axis "${d.axis}" has delta "LOW" and intervention "${d.intervention}" — a LOW delta must resolve to P0_PRESERVE or P1_LOCAL_POLISH and may never justify P2_CONTROLLED_ADAPT or P3_RECOMPOSE (SOURCE-TARGET-DELTA-PLANNING.md §5 G3)`));
    }

    // G4 — not knowing is not evidence of distance (AMENDMENT 1 item A: an
    // UNKNOWN axis MUST be P0_PRESERVE; no other intervention is legal on
    // it, including P1_LOCAL_POLISH. The original G4 closed only the P2/P3
    // direction, leaving P1 open — a record with all seven axes UNKNOWN and
    // the whole draft routed to Language Polish validated clean under it.
    // You may not edit on an axis you did not assess.
    if (d.delta === 'UNKNOWN') {
      if (d.intervention !== 'P0_PRESERVE') {
        issues.push(issue(CODES.G4_UNKNOWN_DELTA_OVERREACH, axisWhere,
          `axis "${d.axis}" has delta "UNKNOWN" and intervention "${d.intervention}" — an UNKNOWN delta MUST be P0_PRESERVE; no other intervention (including P1_LOCAL_POLISH) is legal on an axis you did not assess. Unknown distance is not evidence of distance (SOURCE-TARGET-DELTA-PLANNING.md §5 G4, AMENDMENT 1 item A)`));
      }
      if (!d.what_would_resolve_it || d.what_would_resolve_it.trim().length === 0) {
        issues.push(issue(CODES.G4_UNKNOWN_MISSING_RESOLUTION, axisWhere,
          `axis "${d.axis}" has delta "UNKNOWN" but carries no non-empty what_would_resolve_it — an unknown must record what would resolve it, not paper over it with an intervention (SOURCE-TARGET-DELTA-PLANNING.md §5 G4)`));
      }
    }

    // G5 — every non-trivial axis names who owns it.
    if (d.intervention === 'P2_CONTROLLED_ADAPT' || d.intervention === 'P3_RECOMPOSE') {
      if (d.owning_layer == null) {
        issues.push(issue(CODES.G5_MISSING_OWNING_LAYER, axisWhere,
          `axis "${d.axis}" has intervention "${d.intervention}" but owning_layer is null — every axis assigned P2/P3 must name a non-null owning_layer (SOURCE-TARGET-DELTA-PLANNING.md §5 G5)`));
      } else if (POLISH_OWNED_LAYERS.includes(d.owning_layer)) {
        issues.push(issue(CODES.G5_OWNING_LAYER_IS_POLISH_OWNED, axisWhere,
          `axis "${d.axis}" has intervention "${d.intervention}" but owning_layer "${d.owning_layer}" is a polish-owned layer (${POLISH_OWNED_LAYERS.join(', ')}) — if Language Polish shows up as the owner of a P2/P3 axis, the routing has already failed (SOURCE-TARGET-DELTA-PLANNING.md §5 G5)`));
      } else if (!routingLayerIds.has(d.owning_layer)) {
        issues.push(issue(CODES.G5_OWNING_LAYER_UNKNOWN, axisWhere,
          `axis "${d.axis}" owning_layer "${d.owning_layer}" is not a known layer id in editorial/feedback-routing.json`));
      }
    }

    // G6 — the axis record has to be about the actual text. json-schema-lite
    // already forces source_observation/target_requirement non-empty; the
    // one thing it cannot catch is the two fields being identical, which is
    // the label-driven-inference failure this guard exists to name ("Target
    // is a Report, so genre delta is LARGE" restated as if it were an
    // observation of the source).
    if (typeof d.source_observation === 'string' && typeof d.target_requirement === 'string'
      && d.source_observation.trim().length > 0
      && d.source_observation.trim().toLowerCase() === d.target_requirement.trim().toLowerCase()) {
      issues.push(issue(CODES.G6_RESTATEMENT, axisWhere,
        `axis "${d.axis}" source_observation and target_requirement are identical — both must be non-empty observations of the ACTUAL source text and the ACTUAL request, not a restatement of the target label in both fields (SOURCE-TARGET-DELTA-PLANNING.md §5 G6)`));
    }
  }
  return issues;
}

/**
 * plan_intervention.value must equal the CEILING — the maximum rank among
 * axis_deltas' intervention levels. This is the one arithmetic-shaped
 * operation this module performs, and it is a maximum, never a sum or
 * average (SOURCE-TARGET-DELTA-PLANNING.md §3).
 */
export function checkCeiling(record, where) {
  const axisDeltas = record?.axis_deltas ?? [];
  if (axisDeltas.length === 0 || !record?.plan_intervention?.value) return [];
  const ranks = axisDeltas.map((d) => INTERVENTION_RANK[d.intervention]).filter((r) => r !== undefined);
  if (ranks.length === 0) return [];
  const maxRank = Math.max(...ranks);
  const expected = INTERVENTION_LEVELS[maxRank];
  if (record.plan_intervention.value !== expected) {
    return [issue(CODES.CEILING_MISMATCH, where,
      `plan_intervention.value is "${record.plan_intervention.value}" but the highest intervention actually appearing on any axis is "${expected}" — plan_intervention is the CEILING (a maximum), never a value chosen independently of the axes it summarizes`)];
  }
  return [];
}

export function validateDeltaPlan(record, opts = {}) {
  const { schema = loadDeltaSchema(), routingLayerIds = loadRoutingLayerIds() } = opts;
  const where = record?.delta_plan_id ?? '<delta-plan>';
  const issues = [];
  issues.push(...checkDeltaSchema(record, schema, where));
  issues.push(...checkAxisCompleteness(record, where));
  issues.push(...checkAxisGuards(record, where, { routingLayerIds }));
  issues.push(...checkCeiling(record, where));
  issues.push(...checkNoAggregateFields(record, where));
  return issues;
}

export function validateDeltaPlanFile(filePath, opts = {}) {
  let record;
  try {
    record = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, filePath, `unparseable delta plan: ${err.message}`)];
  }
  return validateDeltaPlan(record, opts);
}

// --- polish decision -----------------------------------------------------

export function checkPolishSchema(record, schema, where) {
  return validate(record, schema).map((e) => issue(CODES.POLISH_SCHEMA, where, `${e.path}: ${e.message}`));
}

/** Whether `pairwise` carries every one of the eleven fixed criteria. */
function hasFullPairwise(pairwise) {
  if (!pairwise || typeof pairwise !== 'object') return false;
  return PAIRWISE_CRITERIA.every((c) => pairwise[c] !== undefined);
}

// --- B: pack/record mode cross-check (AMENDMENT 1 item B) -------------------

/**
 * Resolves `ruleId` inside the pack named by `packRef`. Reuses
 * language-core.mjs's `loadJson` (aliased `loadPackJson` above) rather than
 * maintaining a second pack loader in this module — language-core.mjs is
 * already the one place that reads a language-pack JSON file off disk.
 *
 * Returns `{ rule }` on success, or `{ error }` naming exactly which of the
 * three ways this can fail to resolve: no pack_ref at all, a pack_ref that
 * does not resolve to a file on disk, or a rule_ref the pack does not
 * declare.
 */
export function resolvePackRule(packRef, ruleId, { root = ROOT } = {}) {
  if (packRef == null) return { error: 'no-pack-ref' };
  let pack;
  try {
    pack = loadPackJson(resolve(root, packRef));
  } catch (err) {
    return { error: 'pack-unresolvable', detail: err.message };
  }
  const rule = (pack.rules ?? []).find((r) => r.id === ruleId);
  if (!rule) return { error: 'rule-not-found' };
  return { rule };
}

/**
 * The single guard the CRITICAL finding depends on: `application_mode` is
 * self-asserted on the record, so an edit could cite an `upstream_guidance`
 * audience rule while declaring itself `hard_local_correction`, and P5 (which
 * only ever looks at the mode the edit itself claims) never fired. This
 * cross-checks the claim against what the pack the record names actually
 * declares for the rule it cites — the check L3 (pack side) and P5 (record
 * side) each individually pass but never actually meet without.
 *
 * A null/unresolvable `pack_ref`, or a `rule_ref` the named pack does not
 * declare, is treated as an ERROR rather than a skip: an edit that cites a
 * rule with no pack available to check it against has an application_mode
 * that cannot be verified at all, which is exactly the unverifiable
 * self-assertion this guard exists to close, not a reason to wave it through.
 */
export function checkPackModeCrossCheck(record, where, { root = ROOT } = {}) {
  const issues = [];
  const packRef = record?.pack_ref;
  for (const edit of record?.edits ?? []) {
    if (edit?.rule_ref == null) continue; // no rule cited — nothing to cross-check
    const editWhere = `${where}:${edit.edit_id ?? '<edit>'}`;
    const resolved = resolvePackRule(packRef, edit.rule_ref, { root });
    if (resolved.error === 'no-pack-ref') {
      issues.push(issue(CODES.B_PACK_REF_MISSING, editWhere,
        `edit "${edit.edit_id}" cites rule_ref "${edit.rule_ref}" but pack_ref is null — application_mode "${edit.application_mode}" cannot be verified against any pack and is treated as an ERROR, not a skip: an edit citing a rule with no pack to check it against is exactly the unverifiable self-assertion this guard exists to close (AMENDMENT 1 item B)`));
      continue;
    }
    if (resolved.error === 'pack-unresolvable') {
      issues.push(issue(CODES.B_PACK_UNRESOLVABLE, editWhere,
        `edit "${edit.edit_id}" cites rule_ref "${edit.rule_ref}" but pack_ref "${packRef}" does not resolve to a readable file on disk (${resolved.detail}) — application_mode cannot be verified and is treated as an ERROR, not a skip (AMENDMENT 1 item B)`));
      continue;
    }
    if (resolved.error === 'rule-not-found') {
      issues.push(issue(CODES.B_RULE_REF_UNRESOLVED, editWhere,
        `edit "${edit.edit_id}" cites rule_ref "${edit.rule_ref}", which does not resolve to any rule in pack "${packRef}" (AMENDMENT 1 item B)`));
      continue;
    }
    if (resolved.rule.application_mode !== edit.application_mode) {
      issues.push(issue(CODES.B_MODE_MISMATCH, editWhere,
        `edit "${edit.edit_id}" asserts application_mode "${edit.application_mode}" but pack "${packRef}" declares rule "${edit.rule_ref}" as application_mode "${resolved.rule.application_mode}" — application_mode on the edit must match what the pack actually declares for the rule it cites; a self-asserted mode that disagrees with the pack is exactly how an upstream_guidance audience rule gets laundered into an accepted hard_local_correction edit (AMENDMENT 1 item B, the CRITICAL finding this guard closes; LANGUAGE-QUALITY-ARCHITECTURE.md §12 L3, §13 P5)`));
    }
  }
  return issues;
}

// --- C: revert_reason enforcement (AMENDMENT 1 item C) ----------------------

/**
 * schemas/polish-decision.schema.json's `edit.revert_reason` already claims
 * "Required when verdict is revert (enforced by scripts/lib/delta-core.mjs)".
 * Nothing previously enforced it — a schema asserting an untrue fact about
 * its own repository is itself the defect this closes. Reverts are the audit
 * trail the conservative contract rests on.
 */
export function checkRevertReason(edit, where) {
  if (edit?.verdict !== 'revert') return [];
  if (typeof edit.revert_reason === 'string' && edit.revert_reason.trim().length > 0) return [];
  return [issue(CODES.C_REVERT_REASON_MISSING, where,
    `edit "${edit?.edit_id}" has verdict "revert" but no non-empty revert_reason — revert_reason is the audit trail the conservative contract rests on and is required whenever verdict is revert (AMENDMENT 1 item C; schemas/polish-decision.schema.json edit.revert_reason)`)];
}

// --- D: delta_plan_ref binding (AMENDMENT 1 item D) --------------------------

const DELTA_PLAN_SEARCH_ROOTS = Object.freeze([
  resolve(ROOT, 'evals/fixtures/delta'),
  resolve(ROOT, 'evals/dogfood'),
]);

function walkJsonFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const p = resolve(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJsonFiles(p));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(p);
  }
  return out;
}

/**
 * Minimal binding of `delta_plan_ref` to an actual delta-plan record on disk
 * — deliberately not a general cross-record resolution framework. Looks for
 * a record (top-level, or inside a `{ description, records: [...] }`
 * wrapper, the shape the dogfood evidence under evals/dogfood/ uses) whose
 * `delta_plan_id` matches, under the known delta-plan directories. Returns
 * `null`, not an error, when nothing on disk names that id: a ref that does
 * not resolve to a file this repo happens to have is not this guard's
 * concern — there is no referential-integrity requirement that every
 * delta_plan_ref be dereferenceable, only that WHEN it is, the ceiling it
 * names is respected.
 */
export function resolveDeltaPlanByRef(deltaPlanRef, { roots = DELTA_PLAN_SEARCH_ROOTS } = {}) {
  if (!deltaPlanRef) return null;
  for (const root of roots) {
    for (const file of walkJsonFiles(root)) {
      let data;
      try {
        data = loadJson(file);
      } catch {
        continue;
      }
      const candidates = Array.isArray(data?.records) ? data.records : [data];
      for (const rec of candidates) {
        if (rec?.delta_plan_id === deltaPlanRef) return rec;
      }
    }
  }
  return null;
}

/**
 * Both the schema and LANGUAGE-QUALITY-ARCHITECTURE.md §15 already claim a
 * polish decision "executes INSIDE the ceiling a delta-plan record already
 * set". This binds exactly that claim, at minimum: when `delta_plan_ref`
 * resolves to a plan on disk whose ceiling is P0_PRESERVE (the source
 * already satisfies the target on every axis), the polish action must be
 * KEEP. Nothing wider is implemented — no general ceiling-vs-action mapping,
 * no cross-checking of individual axes against individual edits.
 */
export function checkDeltaPlanBinding(record, where, { resolveDeltaPlan = resolveDeltaPlanByRef } = {}) {
  const ref = record?.delta_plan_ref;
  if (!ref) return [];
  const plan = resolveDeltaPlan(ref);
  if (!plan) return []; // does not resolve to a file on disk — nothing to bind against
  if (plan?.plan_intervention?.value === 'P0_PRESERVE' && record?.action !== 'KEEP') {
    return [issue(CODES.D_CEILING_KEEP_REQUIRED, where,
      `delta_plan_ref "${ref}" resolves to a delta plan whose plan_intervention ceiling is P0_PRESERVE, but this polish decision's action is "${record.action}", not KEEP — a P0_PRESERVE ceiling means the source already satisfies the target on every axis, and a polish decision executes INSIDE the ceiling the delta plan already set (AMENDMENT 1 item D; LANGUAGE-QUALITY-ARCHITECTURE.md §15)`)];
  }
  return [];
}

/**
 * Accept rule A1-A3 — LANGUAGE-QUALITY-ARCHITECTURE.md §13. Applied against
 * whatever pairwise data the edit actually carries.
 *
 * P6 lets a hard_local_correction edit omit the full pairwise block and
 * record only semantic_integrity. The accept rule as written in the
 * contract has no explicit carve-out for that case, and applying A1
 * (continuous_readability/native_naturalness) literally to an edit that was
 * never asked to supply those fields would make every hard_local_correction
 * edit un-acceptable by construction — which would contradict P2 (LOCAL_POLISH
 * requires at least one accepted edit) whenever the only edits present are
 * deterministic corrections. Resolution adopted here, documented rather than
 * silently decided: for a hard_local_correction edit, A1 is treated as
 * satisfied when continuous_readability/native_naturalness are both absent
 * (the correction's justification is correctness, not a readability gain);
 * A2/A3 are still evaluated against whatever criteria ARE present (an absent
 * criterion never counts as "worse"). A soft_detector edit is held to the
 * full, literal rule: P4 already requires it to carry all eleven criteria,
 * so no criterion is ever absent for it.
 */
export function checkAcceptRule(edit, where) {
  const issues = [];
  if (edit?.verdict !== 'accept') return issues;
  const pairwise = edit.pairwise ?? {};
  const isHardLocalWithoutFullPairwise = edit.application_mode === 'hard_local_correction' && !hasFullPairwise(pairwise);

  // A1 — at least one of continuous_readability/native_naturalness is better.
  const a1Exempt = isHardLocalWithoutFullPairwise
    && pairwise.continuous_readability === undefined
    && pairwise.native_naturalness === undefined;
  if (!a1Exempt) {
    const a1Holds = A1_CRITERIA.some((c) => pairwise[c] === 'better');
    if (!a1Holds) {
      issues.push(issue(CODES.A1_FAIL, where,
        `edit "${edit.edit_id}" has verdict "accept" but neither continuous_readability nor native_naturalness is "better" — accept requires at least one (LANGUAGE-QUALITY-ARCHITECTURE.md §13 A1); this must be revert`));
    }
  }

  // A2 — none of the five holistic-integrity criteria is worse.
  const a2Violations = A2_CRITERIA.filter((c) => pairwise[c] === 'worse');
  if (a2Violations.length > 0) {
    issues.push(issue(CODES.A2_FAIL, where,
      `edit "${edit.edit_id}" has verdict "accept" but ${a2Violations.join(', ')} ${a2Violations.length > 1 ? 'are' : 'is'} "worse" — a local rule-compliance gain never outweighs a holistic regression (LANGUAGE-QUALITY-ARCHITECTURE.md §13 A2); this must be revert`));
  }

  // A3 — none of the three defect criteria is worse.
  const a3Violations = A3_CRITERIA.filter((c) => pairwise[c] === 'worse');
  if (a3Violations.length > 0) {
    issues.push(issue(CODES.A3_FAIL, where,
      `edit "${edit.edit_id}" has verdict "accept" but ${a3Violations.join(', ')} ${a3Violations.length > 1 ? 'are' : 'is'} "worse" — accept requires none of repetition/over_explication/stiffness to regress (LANGUAGE-QUALITY-ARCHITECTURE.md §13 A3); this must be revert`));
  }

  return issues;
}

/** P4-P6 — application_mode discipline on each edit. */
export function checkEditModeGuards(edit, where) {
  const issues = [];

  // P4 — soft_detector requires the full eleven-criterion pairwise block.
  if (edit.application_mode === 'soft_detector' && !hasFullPairwise(edit.pairwise)) {
    issues.push(issue(CODES.P4_SOFT_DETECTOR_MISSING_PAIRWISE, where,
      `edit "${edit.edit_id}" has application_mode "soft_detector" but pairwise is missing one or more of the eleven fixed criteria — a soft_detector candidate must survive the full pairwise gate (LANGUAGE-QUALITY-ARCHITECTURE.md §13 P4); no pairwise block means the edit is invalid, not accepted`));
  }

  // P5 — these three modes never authorize a polish edit at all.
  if (NON_AUTHORIZING_MODES.has(edit.application_mode) && edit.verdict === 'accept') {
    issues.push(issue(CODES.P5_MODE_MAY_NOT_ACCEPT, where,
      `edit "${edit.edit_id}" has application_mode "${edit.application_mode}" and verdict "accept" — ${edit.application_mode} does not authorize a polish edit at all (LANGUAGE-QUALITY-ARCHITECTURE.md §12 P5); this must be revert`));
  }

  // P6 — hard_local_correction may omit the full block but must record
  // semantic_integrity, and "worse" there is rejected outright (not merely
  // blocked from accept).
  if (edit.application_mode === 'hard_local_correction') {
    const si = edit.pairwise?.semantic_integrity;
    if (si === undefined || si === null) {
      issues.push(issue(CODES.P6_HARD_LOCAL_MISSING_SEMANTIC_INTEGRITY, where,
        `edit "${edit.edit_id}" has application_mode "hard_local_correction" but records no pairwise.semantic_integrity — a hard_local_correction edit may omit the full pairwise block but must always record semantic_integrity (LANGUAGE-QUALITY-ARCHITECTURE.md §13 P6)`));
    } else if (si === 'worse') {
      issues.push(issue(CODES.P6_HARD_LOCAL_WORSE_SEMANTIC_INTEGRITY, where,
        `edit "${edit.edit_id}" has application_mode "hard_local_correction" and pairwise.semantic_integrity "worse" — worse semantic_integrity is rejected outright for a hard_local_correction edit (LANGUAGE-QUALITY-ARCHITECTURE.md §13 P6)`));
    }
  }

  return issues;
}

/** P1-P3 — action/edits/upstream_route consistency. */
export function checkActionGuards(record, where, { routingLayerIds = loadRoutingLayerIds() } = {}) {
  const issues = [];
  const edits = record?.edits ?? [];
  const acceptedCount = edits.filter((e) => e.verdict === 'accept').length;

  if (record?.action === 'KEEP' && acceptedCount > 0) {
    issues.push(issue(CODES.P1_KEEP_HAS_ACCEPTED_EDIT, where,
      `action is "KEEP" but ${acceptedCount} edit(s) carry verdict "accept" — KEEP requires zero accepted edits (LANGUAGE-QUALITY-ARCHITECTURE.md §11 P1)`));
  }

  if (record?.action === 'LOCAL_POLISH' && acceptedCount === 0) {
    issues.push(issue(CODES.P2_LOCAL_POLISH_NO_ACCEPTED_EDIT, where,
      'action is "LOCAL_POLISH" but no edit carries verdict "accept" — LOCAL_POLISH requires at least one accepted edit (LANGUAGE-QUALITY-ARCHITECTURE.md §11 P2)'));
  }

  if (record?.action === 'UPSTREAM_REPLAN_REQUIRED') {
    if (!record.upstream_route || !record.upstream_route.layer || !record.upstream_route.reason) {
      issues.push(issue(CODES.P3_UPSTREAM_MISSING_ROUTE, where,
        'action is "UPSTREAM_REPLAN_REQUIRED" but upstream_route is null or incomplete — this action requires upstream_route naming the owning layer and a reason (LANGUAGE-QUALITY-ARCHITECTURE.md §11 P3)'));
    } else if (!routingLayerIds.has(record.upstream_route.layer)) {
      issues.push(issue(CODES.UPSTREAM_ROUTE_UNKNOWN_LAYER, where,
        `upstream_route.layer "${record.upstream_route.layer}" is not a known layer id in editorial/feedback-routing.json`));
    }
    if (acceptedCount > 0) {
      issues.push(issue(CODES.P3_UPSTREAM_HAS_ACCEPTED_EDIT, where,
        `action is "UPSTREAM_REPLAN_REQUIRED" but ${acceptedCount} edit(s) carry verdict "accept" — this action requires zero accepted edits (LANGUAGE-QUALITY-ARCHITECTURE.md §11 P3)`));
    }
  }

  return issues;
}

/** The advisory edit-surface band. Exceeding it never fails the draft; it requires large_edit_justification. */
export function checkEditSurfaceBand(record, where) {
  const surface = record?.edit_surface;
  if (!surface || typeof surface.original_total !== 'number' || typeof surface.changed_total !== 'number') return [];
  const ratio = surface.original_total > 0 ? surface.changed_total / surface.original_total : (surface.changed_total > 0 ? Infinity : 0);
  if (ratio <= ADVISORY_EDIT_SURFACE_BAND) return [];
  if (surface.large_edit_justification && surface.large_edit_justification.trim().length > 0) return [];
  return [issue(CODES.ADVISORY_BAND_JUSTIFICATION_MISSING, where,
    `edit_surface changed ${surface.changed_total}/${surface.original_total} ${surface.unit} (${(ratio * 100).toFixed(1)}%), past the ADVISORY_EDIT_SURFACE_BAND of ${ADVISORY_EDIT_SURFACE_BAND * 100}%, with no large_edit_justification — crossing the band never fails the draft, it is not a gate, but it does require a non-empty justification naming the concrete defect that justified editing that much of the text and stating whether UPSTREAM_REPLAN_REQUIRED was considered (LANGUAGE-QUALITY-ARCHITECTURE.md §14)`)];
}

export function validatePolishDecision(record, opts = {}) {
  const {
    schema = loadPolishSchema(),
    routingLayerIds = loadRoutingLayerIds(),
    root = ROOT,
    resolveDeltaPlan = resolveDeltaPlanByRef,
  } = opts;
  const where = record?.decision_id ?? '<polish-decision>';
  const issues = [];
  issues.push(...checkPolishSchema(record, schema, where));

  for (const edit of record?.edits ?? []) {
    const editWhere = `${where}:${edit.edit_id ?? '<edit>'}`;
    issues.push(...checkEditModeGuards(edit, editWhere));
    issues.push(...checkAcceptRule(edit, editWhere));
    issues.push(...checkRevertReason(edit, editWhere));
  }

  issues.push(...checkActionGuards(record, where, { routingLayerIds }));
  issues.push(...checkEditSurfaceBand(record, where));
  issues.push(...checkNoAggregateFields(record, where));
  issues.push(...checkPackModeCrossCheck(record, where, { root }));
  issues.push(...checkDeltaPlanBinding(record, where, { resolveDeltaPlan }));
  return issues;
}

export function validatePolishDecisionFile(filePath, opts = {}) {
  let record;
  try {
    record = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, filePath, `unparseable polish decision: ${err.message}`)];
  }
  return validatePolishDecision(record, opts);
}
