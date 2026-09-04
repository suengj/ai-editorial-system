/**
 * L1 comparative review engine — AES-V2.6 (SUE-564).
 *
 * Enforces the rules a schema alone cannot: every one of the five required
 * dimensions is present, evidence is never missing, integrity failures
 * dominate stylistic wins regardless of dimension verdicts, cross-type
 * comparison is restricted to a declared cross-cutting dimension, the
 * anti-collapse rule is declared rather than silently true, and routes_to
 * always resolves against AES-V2.5's layer table.
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
  ROUTE_MISMATCH: 'route-outcome-mismatch',
  UNKNOWN_ROUTE: 'route-not-in-routing-table',
  HUMAN_AUTHORITY: 'final-authority-not-human',
});

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
  PROSE_REWORK: ['writing', 'polish'],
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
  const refs = comparison.references ?? [];
  const allGeneratedSameLineage = refs.length > 0
    && refs.every((r) => r.provenance_class === 'generated_output')
    && refs.every((r) => r.lineage_ref && r.lineage_ref === refs[0].lineage_ref);
  if (allGeneratedSameLineage && !comparison.anti_collapse?.triggered) {
    issues.push(issue(CODES.ANTI_COLLAPSE_UNDECLARED, where,
      'every selected GOOD reference is a generated_output from the same lineage; the review must say so rather than silently treating the system\'s own prior output as an independent standard'));
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
