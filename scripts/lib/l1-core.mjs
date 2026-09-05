/**
 * L1 comparative review engine — AES-V2.6 (SUE-564).
 *
 * Enforces the rules a schema alone cannot: every one of the five required
 * dimensions is present, evidence is never missing, integrity failures
 * dominate stylistic wins regardless of dimension verdicts, cross-type
 * comparison is restricted to a declared cross-cutting dimension, the
 * anti-collapse rule is declared rather than silently true, and routes_to
 * always resolves against AES-V2.5's layer table.
 *
 * schema_version 1.1.0 (AES-V2.17 / SUE-607) additionally enforces the
 * absolute (non-comparative) `language_quality` block: required at 1.1.0 and
 * forbidden at 1.0.0, all seven dimensions present exactly once, evidence
 * mandatory, semantic_integrity FAIL dominates a pass-shaped outcome, and
 * each dimension's FAIL routes to exactly the one feedback-routing layer
 * fixed by LANGUAGE_DIMENSION_ROUTES — never a different layer.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { allLayerIds, loadRoutingTable } from './routing-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export const SCHEMA_PATH = resolve(ROOT, 'schemas/l1-review.schema.json');
export const loadSchema = (p = SCHEMA_PATH) => JSON.parse(readFileSync(p, 'utf8'));

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  MISSING_DIMENSION: 'missing-required-dimension',
  MISSING_EVIDENCE: 'missing-evidence-span',
  INTEGRITY_OVERRIDDEN: 'integrity-overridden-by-style',
  CROSS_TYPE_VIOLATION: 'cross-type-comparison-not-declared',
  ANTI_COLLAPSE_UNDECLARED: 'anti-collapse-undeclared',
  MISSING_LINEAGE_REF: 'missing-lineage-ref-for-generated-output',
  ROUTE_MISMATCH: 'route-outcome-mismatch',
  UNKNOWN_ROUTE: 'route-not-in-routing-table',
  HUMAN_AUTHORITY: 'final-authority-not-human',
  LANGUAGE_QUALITY_REQUIRED: 'language-quality-required-at-1.1.0',
  LANGUAGE_QUALITY_NOT_ALLOWED: 'language-quality-not-allowed-at-1.0.0',
  LANGUAGE_DIMENSION_MISSING: 'language-dimension-missing',
  LANGUAGE_DIMENSION_DUPLICATED: 'language-dimension-duplicated',
  LANGUAGE_DIMENSION_MISSING_EVIDENCE: 'language-dimension-missing-evidence-span',
  LANGUAGE_INTEGRITY_OVERRIDDEN: 'language-integrity-overridden-by-outcome',
  LANGUAGE_FAIL_HIDDEN_BY_OUTCOME: 'language-fail-hidden-by-pass-shaped-outcome',
  LANGUAGE_DIMENSION_ROUTE_REQUIRED: 'language-dimension-fail-with-no-route',
  LANGUAGE_DIMENSION_UNKNOWN_ROUTE: 'language-dimension-route-not-in-routing-table',
  LANGUAGE_DIMENSION_MISROUTE: 'language-dimension-routed-to-wrong-layer',
  LANGUAGE_DIMENSION_ROUTE_NOT_ALLOWED: 'language-dimension-non-fail-with-route',
});

/** The seven dimensions SUE-607 requires, each exactly once, in language_quality. */
export const LANGUAGE_DIMENSIONS = Object.freeze([
  'semantic_integrity', 'normative_correctness', 'native_fluency', 'genre_fit',
  'audience_fit', 'domain_terminology_fit', 'owner_voice_fit',
]);

/**
 * The single legal feedback-routing layer for each language-quality
 * dimension's FAIL verdict (AES-V2.17 / SUE-607). A FAIL routed to any other
 * layer is the smallest-layer-routing violation this architecture exists to
 * prevent.
 */
export const LANGUAGE_DIMENSION_ROUTES = Object.freeze({
  semantic_integrity: 'verification',
  normative_correctness: 'normative',
  native_fluency: 'native_fluency',
  genre_fit: 'register',
  audience_fit: 'audience',
  domain_terminology_fit: 'domain_terminology',
  owner_voice_fit: 'owner_voice',
});

/** Outcomes that are "pass-shaped": no rework is implied. */
const PASS_SHAPED_OUTCOMES = new Set(['PASS', 'TIE', 'ABSTAIN']);

/** The five dimensions SUE-564 requires at minimum. */
export const REQUIRED_DIMENSIONS = Object.freeze([
  'thesis-worth', 'synthesis-independence', 'language-native-prose', 'formulaic-ai-shaped', 'audience-fit',
]);

/** Which AES-V2.5 layer(s) each outcome may legitimately route to. */
export const OUTCOME_ROUTES = Object.freeze({
  PASS: [null],
  TIE: [null],
  ABSTAIN: [null],
  ARGUMENT_REWORK: ['frame'],
  FACT_REWORK: ['verification'],
  // AES-V2.17 (SUE-607) widened this: the language layers are prose-layer
  // rework targets too. Without them a record could report a
  // normative/native_fluency/register/terminology FAIL per dimension and
  // have no legal record-level outcome to carry it, which is how the
  // finding used to disappear at the record boundary.
  PROSE_REWORK: ['writing', 'polish', 'register', 'normative', 'native_fluency', 'domain_terminology', 'owner_voice'],
  AUDIENCE_REWORK: ['audience', 'frame'],
});

const issue = (code, where, message) => ({ code, where, message });

export function validateL1RecordAgainstSchema(record, schema = loadSchema()) {
  return validate(record, schema).map((e) => issue(CODES.SCHEMA, record?.review_id ?? '<record>', `${e.path}: ${e.message}`));
}

export function validateL1Record(record, { schema = loadSchema(), routingTable = loadRoutingTable() } = {}) {
  const issues = validateL1RecordAgainstSchema(record, schema);
  const where = record?.review_id ?? '<record>';

  // --- every required dimension is present ---------------------------------
  const seen = new Set((record?.dimensions ?? []).map((d) => d.id));
  for (const req of REQUIRED_DIMENSIONS) {
    if (!seen.has(req)) issues.push(issue(CODES.MISSING_DIMENSION, where, `missing required dimension "${req}"`));
  }

  // --- evidence is mandatory for every dimension finding, including tie ----
  for (const d of record?.dimensions ?? []) {
    if (!d.evidence_span || d.evidence_span.trim().length === 0) {
      issues.push(issue(CODES.MISSING_EVIDENCE, where, `dimension "${d.id}" has verdict "${d.verdict}" with no evidence span`));
    }
  }
  if (record?.integrity && record.integrity.status !== 'clear' && !record.integrity.evidence_span) {
    issues.push(issue(CODES.MISSING_EVIDENCE, where, `integrity status "${record.integrity.status}" carries no evidence span`));
  }

  // --- integrity failures dominate stylistic wins, always -------------------
  if (record?.integrity?.status === 'fail' && record?.outcome === 'PASS') {
    issues.push(issue(CODES.INTEGRITY_OVERRIDDEN, where,
      'outcome is PASS but integrity.status is fail; a better-written piece that is less true always loses'));
  }
  if (record?.integrity?.status === 'fail' && record?.outcome !== 'FACT_REWORK') {
    issues.push(issue(CODES.INTEGRITY_OVERRIDDEN, where,
      `integrity.status is fail so outcome must be FACT_REWORK (routes to verification), not "${record?.outcome}"`));
  }

  // --- compare like with like -------------------------------------------
  const comparison = record?.comparison ?? {};
  if (comparison.same_content_type === false) {
    if (!comparison.cross_cutting_dimension) {
      issues.push(issue(CODES.CROSS_TYPE_VIOLATION, where,
        'same_content_type is false but no cross_cutting_dimension is declared'));
    } else {
      for (const d of record?.dimensions ?? []) {
        if (d.id !== comparison.cross_cutting_dimension && d.verdict !== 'abstain' && d.verdict !== 'tie') {
          issues.push(issue(CODES.CROSS_TYPE_VIOLATION, where,
            `cross-type comparison declared only for "${comparison.cross_cutting_dimension}", but dimension "${d.id}" carries a decided verdict "${d.verdict}"`));
        }
      }
    }
  }

  // --- anti-collapse: generated_output monoculture must be declared --------
  // Fires on "every selected reference is generated_output", full stop.
  // Lineage is no longer the trigger — it used to require every ref to
  // carry an identical, *present* lineage_ref, which an optional schema
  // field made trivial to disable: two generated_output refs with no
  // lineage_ref at all, or with two different lineages, both slipped past
  // silently (AES-V2 B5). A 100% self-generated comparison set is exactly
  // the failure mode this guard exists to catch, and it is the one case a
  // system already in that failure mode would not reliably produce matching
  // lineage_ref values for. Identical lineage is now a *stronger* signal
  // surfaced separately, never the condition for firing at all.
  const refs = comparison.references ?? [];
  const allGenerated = refs.length > 0 && refs.every((r) => r.provenance_class === 'generated_output');
  if (allGenerated && !comparison.anti_collapse?.triggered) {
    const sameLineage = refs.every((r) => r.lineage_ref && r.lineage_ref === refs[0].lineage_ref);
    issues.push(issue(CODES.ANTI_COLLAPSE_UNDECLARED, where,
      sameLineage
        ? 'every selected GOOD reference is a generated_output from the same lineage; the review must say so rather than silently treating the system\'s own prior output as an independent standard'
        : 'every selected GOOD reference is a generated_output (lineage not uniformly declared or not identical); the review must still declare anti_collapse.triggered rather than silently treating an all-self-generated comparison set as independent'));
  }

  // A generated_output reference with no lineage_ref cannot be checked for
  // repeated-lineage selection at all — the schema leaves the field
  // optional because json-schema-lite has no conditional keyword, so this
  // module is what actually requires it.
  for (const r of refs) {
    if (r.provenance_class === 'generated_output' && !r.lineage_ref) {
      issues.push(issue(CODES.MISSING_LINEAGE_REF, where,
        `reference "${r.ref}" is provenance_class "generated_output" but carries no lineage_ref`));
    }
  }

  // --- routes_to must match the outcome and resolve against AES-V2.5 -------
  const allowed = OUTCOME_ROUTES[record?.outcome] ?? [];
  if (!allowed.includes(record?.routes_to ?? null)) {
    issues.push(issue(CODES.ROUTE_MISMATCH, where,
      `outcome "${record?.outcome}" may only route to [${allowed.map(String).join(', ')}], got "${record?.routes_to}"`));
  }
  if (record?.routes_to && !allLayerIds(routingTable).includes(record.routes_to)) {
    issues.push(issue(CODES.UNKNOWN_ROUTE, where,
      `routes_to "${record.routes_to}" is not a layer id in editorial/feedback-routing.json`));
  }

  // --- language_quality: required at 1.1.0, forbidden at 1.0.0 -------------
  // (SUE-607 / AES-V2.17). json-schema-lite has no `if`, so the
  // version-conditional requirement lives here, not in the schema.
  if (record?.schema_version === '1.1.0' && !record?.language_quality) {
    issues.push(issue(CODES.LANGUAGE_QUALITY_REQUIRED, where,
      'schema_version is 1.1.0 but language_quality is absent'));
  }
  if (record?.schema_version === '1.0.0' && record?.language_quality) {
    issues.push(issue(CODES.LANGUAGE_QUALITY_NOT_ALLOWED, where,
      'schema_version is 1.0.0 but language_quality is present; this is a version defect, not an additive field'));
  }

  if (record?.language_quality) {
    const lqDims = record.language_quality.dimensions ?? [];

    // --- all seven dimensions present, exactly once ------------------------
    const counts = new Map();
    for (const d of lqDims) counts.set(d.id, (counts.get(d.id) ?? 0) + 1);
    for (const id of LANGUAGE_DIMENSIONS) {
      const count = counts.get(id) ?? 0;
      if (count === 0) {
        issues.push(issue(CODES.LANGUAGE_DIMENSION_MISSING, where,
          `language_quality is missing required dimension "${id}"`));
      } else if (count > 1) {
        issues.push(issue(CODES.LANGUAGE_DIMENSION_DUPLICATED, where,
          `language_quality carries dimension "${id}" ${count} times; each dimension must appear exactly once`));
      }
    }

    // --- evidence is mandatory, asserted here too as belt-and-braces -------
    for (const d of lqDims) {
      if (!d.evidence_span || d.evidence_span.trim().length === 0) {
        issues.push(issue(CODES.LANGUAGE_DIMENSION_MISSING_EVIDENCE, where,
          `language_quality dimension "${d.id}" has verdict "${d.verdict}" with no evidence span`));
      }
    }

    // --- integrity dominance: semantic_integrity FAIL rules out a pass-shaped
    // outcome, exactly the same "a stylistic win never offsets an integrity
    // failure" rule already enforced above for record.integrity.status.
    const semanticIntegrity = lqDims.find((d) => d.id === 'semantic_integrity');
    if (semanticIntegrity?.verdict === 'FAIL' && PASS_SHAPED_OUTCOMES.has(record?.outcome)) {
      issues.push(issue(CODES.LANGUAGE_INTEGRITY_OVERRIDDEN, where,
        `language_quality.semantic_integrity is FAIL but outcome is "${record?.outcome}"; a pass-shaped outcome may not stand alongside a semantic-integrity failure`));
    }

    // --- a language FAIL may not be hidden behind a pass-shaped record ------
    // LANGUAGE-QUALITY-ARCHITECTURE.md §8: "the review output *is* the
    // routing input". Downstream consumers read the record-level
    // outcome/routes_to; a record whose outcome is PASS while a language
    // dimension is FAIL reports "nothing to do" and loses the finding at
    // exactly the boundary where it was supposed to become an action. The
    // per-dimension routes_to keeps the detail; this rule keeps the record
    // from contradicting it. Reported once per record, listing every failing
    // dimension, so one bad outcome does not produce seven near-identical
    // issues.
    const failing = lqDims.filter((d) => d.verdict === 'FAIL' && d.id !== 'semantic_integrity');
    if (failing.length > 0 && PASS_SHAPED_OUTCOMES.has(record?.outcome)) {
      issues.push(issue(CODES.LANGUAGE_FAIL_HIDDEN_BY_OUTCOME, where,
        `outcome is "${record?.outcome}" but language_quality reports FAIL on ${failing.map((d) => d.id).join(', ')}; a pass-shaped outcome tells every downstream consumer there is nothing to route, which contradicts the dimension's own routes_to`));
    }

    // --- routing: a FAIL must route to its one legal layer; anything else
    // must not carry a route at all ------------------------------------------
    for (const d of lqDims) {
      if (d.verdict === 'FAIL') {
        if (!d.routes_to) {
          issues.push(issue(CODES.LANGUAGE_DIMENSION_ROUTE_REQUIRED, where,
            `language_quality dimension "${d.id}" is FAIL but carries no routes_to`));
          continue;
        }
        if (!allLayerIds(routingTable).includes(d.routes_to)) {
          issues.push(issue(CODES.LANGUAGE_DIMENSION_UNKNOWN_ROUTE, where,
            `language_quality dimension "${d.id}" routes_to "${d.routes_to}" is not a layer id in editorial/feedback-routing.json`));
        }
        const expected = LANGUAGE_DIMENSION_ROUTES[d.id];
        if (expected && d.routes_to !== expected) {
          issues.push(issue(CODES.LANGUAGE_DIMENSION_MISROUTE, where,
            `language_quality dimension "${d.id}" must route to "${expected}", not "${d.routes_to}" — the smallest-layer-routing violation this architecture exists to prevent`));
        }
      } else if (d.routes_to) {
        issues.push(issue(CODES.LANGUAGE_DIMENSION_ROUTE_NOT_ALLOWED, where,
          `language_quality dimension "${d.id}" has verdict "${d.verdict}" but carries routes_to "${d.routes_to}"; only a FAIL may route`));
      }
    }
  }

  // --- L1 is never human/L2 authority ---------------------------------------
  if (record?.final_authority !== 'human') {
    issues.push(issue(CODES.HUMAN_AUTHORITY, where, 'final_authority must always be "human"; L1 is advisory, never publication or preference authority'));
  }

  return issues;
}

export function validateL1RecordFile(path, opts = {}) {
  let record;
  try {
    record = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable L1 review record: ${err.message}`)];
  }
  return validateL1Record(record, opts);
}
