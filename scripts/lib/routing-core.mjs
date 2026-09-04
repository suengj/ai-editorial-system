/**
 * Failure routing engine — AES-V2.5 (SUE-563).
 *
 * Validates editorial/feedback-routing.json for internal consistency and
 * checks feedback records (schemas/feedback-record.schema.json) against it:
 * every negative verdict must name a shared layer, name a modality layer, or
 * explicitly abstain — three distinct states that must never collapse into
 * each other — and the three named misroutes are caught mechanically.
 *
 * This module does NOT gate a record's write authority above class 3
 * (calibration_candidate) by pattern-matching its free text. That control
 * used to live here as an English keyword list and was deleted (AES-V2 B3):
 * it filtered vocabulary, not authority, so it missed the same intent in
 * Korean and flagged a legitimate abstention for naming a layer it could not
 * pin down. The authority ceiling is structural (the feedback-record schema's
 * `scope` enum has no value above calibration_candidate) and enforced at the
 * actual mutation points — scripts/lib/calibration-core.mjs and
 * scripts/lib/registry-core.mjs's promotion gates — never at the complaint.
 *
 * This module routes INTO the feedback-record contract. It does not redefine
 * routing.layer, scope, signal, verdict, or owner_verdict.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export const ROUTING_PATH = resolve(ROOT, 'editorial/feedback-routing.json');
export const FEEDBACK_SCHEMA_PATH = resolve(ROOT, 'schemas/feedback-record.schema.json');

export const loadRoutingTable = (p = ROUTING_PATH) => JSON.parse(readFileSync(p, 'utf8'));
export const loadFeedbackSchema = (p = FEEDBACK_SCHEMA_PATH) => JSON.parse(readFileSync(p, 'utf8'));

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  MISSING_KEY: 'layer-missing-key',
  UNKNOWN_ESCALATION: 'unresolved-escalation',
  LAYER_ID_MISMATCH: 'layer-id-mismatch',
  MATRIX_INCOMPLETE: 'authority-matrix-incomplete',
  ABSTENTION_REQUIRED: 'abstention-required',
  ABSTAIN_CONTRADICTION: 'abstained-but-named-a-cause',
  UNKNOWN_MODALITY_LAYER: 'unknown-modality-layer',
  MISROUTE: 'misroute',
});

/** The routing target vocabulary fixed by V2-EDITORIAL-LEARNING-CORE.md §5. */
export const CANONICAL_LAYERS = Object.freeze({
  shared: ['intake', 'reference', 'audience', 'frame', 'verification', 'surface', 'calibration'],
  text: ['writing', 'polish', 'register'],
  visual: ['artifact_route', 'semantic_spec', 'information_density', 'composition', 'brand_profile', 'renderer'],
  audio: ['spoken_script', 'dialogue_structure', 'pronunciation', 'pacing', 'delivery', 'tts_render'],
});

const REQUIRED_LAYER_KEYS = ['id', 'group', 'owns', 'symptoms', 'repair', 'do_not', 'authority_class', 'escalates_to'];
const ESCALATION_SENTINELS = new Set(['human_activation', 'human_review']);

const issue = (code, where, message) => ({ code, where, message });

export function allLayers(table) {
  return Object.values(table.layers).flat();
}

export function allLayerIds(table) {
  return allLayers(table).map((l) => l.id);
}

export function findLayer(table, id) {
  return allLayers(table).find((l) => l.id === id);
}

/** Internal consistency of the routing table itself. */
export function validateRoutingTable(table = loadRoutingTable()) {
  const issues = [];

  for (const [group, ids] of Object.entries(CANONICAL_LAYERS)) {
    const actual = (table.layers?.[group] ?? []).map((l) => l.id);
    if (JSON.stringify(actual) !== JSON.stringify(ids)) {
      issues.push(issue(CODES.LAYER_ID_MISMATCH, group,
        `expected [${ids.join(', ')}] per V2-EDITORIAL-LEARNING-CORE.md §5, got [${actual.join(', ')}]`));
    }
  }

  const known = new Set(allLayerIds(table));
  for (const [group, layers] of Object.entries(table.layers ?? {})) {
    for (const l of layers) {
      for (const k of REQUIRED_LAYER_KEYS) {
        if (!(k in l)) issues.push(issue(CODES.MISSING_KEY, l.id ?? group, `missing "${k}"`));
      }
      const esc = l.escalates_to;
      if (esc !== null && esc !== undefined && !known.has(esc) && !ESCALATION_SENTINELS.has(esc)) {
        issues.push(issue(CODES.UNKNOWN_ESCALATION, l.id, `escalates_to "${esc}" does not resolve to a known layer or sentinel`));
      }
    }
  }

  const classes = new Set((table.authority_matrix?.classes ?? []).map((c) => c.class));
  for (let i = 0; i <= 6; i += 1) {
    if (!classes.has(i)) issues.push(issue(CODES.MATRIX_INCOMPLETE, 'authority_matrix', `missing class ${i}`));
  }

  return issues;
}

/**
 * Cross-check the three independent copies of the SHARED layer vocabulary:
 * this module's CANONICAL_LAYERS.shared, editorial/feedback-routing.json's
 * `layers.shared` ids (via the table already checked above), and
 * schemas/feedback-record.schema.json's `routing.layer` enum. Nothing else
 * asserts these three agree — a schema edit that drops or renames a layer
 * id would otherwise drift silently from the other two. See I3 (V2 tuning
 * review): "competing routing vocabularies."
 */
export function validateLayerParity(table = loadRoutingTable(), schema = loadFeedbackSchema()) {
  const issues = [];
  const canonicalShared = CANONICAL_LAYERS.shared;
  const tableShared = (table.layers?.shared ?? []).map((l) => l.id);

  const schemaEnum = (schema.$defs?.routing?.properties?.layer?.enum ?? []).filter((v) => v !== null);
  const schemaSorted = [...schemaEnum].sort();
  const canonicalSorted = [...canonicalShared].sort();
  if (JSON.stringify(schemaSorted) !== JSON.stringify(canonicalSorted)) {
    issues.push(issue(CODES.LAYER_ID_MISMATCH, 'feedback-record.schema.json#/$defs/routing/properties/layer',
      `expected the same SHARED ids as CANONICAL_LAYERS.shared [${canonicalShared.join(', ')}], got [${schemaEnum.join(', ')}]`));
  }

  // table vs canonical is already asserted by validateRoutingTable, but
  // repeat it here so this function alone proves three-way parity even if
  // called on its own.
  if (JSON.stringify(tableShared) !== JSON.stringify(canonicalShared)) {
    issues.push(issue(CODES.LAYER_ID_MISMATCH, 'feedback-routing.json#/layers/shared',
      `expected [${canonicalShared.join(', ')}] per CANONICAL_LAYERS.shared, got [${tableShared.join(', ')}]`));
  }

  return issues;
}

export function validateFeedbackRecordAgainstSchema(record, schema = loadFeedbackSchema()) {
  return validate(record, schema).map((e) => issue(CODES.SCHEMA, record?.feedback_id ?? '<record>', `${e.path}: ${e.message}`));
}

/**
 * Route one feedback record against the table: abstention discipline,
 * misroute detection, and the authority-escalation ceiling.
 */
export function validateFeedbackRecordRouting(record, table = loadRoutingTable()) {
  const issues = [];
  const where = record?.feedback_id ?? '<record>';
  const routing = record?.routing ?? {};
  const text = `${record?.statement ?? ''} ${routing.rationale ?? ''}`;

  // --- three states, never collapsed: a shared layer named; modality-only
  // (layer: null, abstained: false, modality_layer names a declared modality
  // layer — "the answer is modality-specific," not "I cannot tell"); or a
  // genuine abstention (layer: null, modality_layer absent, abstained: true).
  const namesCause = Boolean(routing.layer) || Boolean(routing.modality_layer);

  if (record?.verdict === 'bad' && routing.abstained !== true && !namesCause) {
    issues.push(issue(CODES.ABSTENTION_REQUIRED, where,
      'negative verdict names no layer, no modality_layer, and does not abstain; a router that cannot tell must say so'));
  }
  if (routing.abstained === true && namesCause) {
    issues.push(issue(CODES.ABSTAIN_CONTRADICTION, where,
      'abstained is true but a layer or modality_layer is named; abstention means the record could not tell, which is a different state from "the answer is modality-specific"'));
  }
  if (!routing.layer && routing.modality_layer) {
    const modalityIds = new Set(allLayers(table).filter((l) => l.group !== 'shared').map((l) => l.id));
    if (!modalityIds.has(routing.modality_layer)) {
      issues.push(issue(CODES.UNKNOWN_MODALITY_LAYER, where,
        `modality_layer "${routing.modality_layer}" with no shared layer is not a declared modality layer in editorial/feedback-routing.json`));
    }
  }

  // --- misroute detection: do_not with machine-checkable trigger keywords --
  for (const layer of allLayers(table)) {
    for (const dn of layer.do_not ?? []) {
      if (!dn.trigger_keywords) continue;
      const targetNamed = routing.modality_layer === dn.target || routing.layer === dn.target;
      if (!targetNamed) continue;
      if (dn.trigger_keywords.some((kw) => new RegExp(kw, 'i').test(text))) {
        issues.push(issue(CODES.MISROUTE, where,
          `routed to "${dn.target}" but the statement matches ${layer.id}'s own symptoms — ${dn.note}`));
      }
    }
  }

  // --- authority ceiling: NOT enforced here. A feedback record's `scope`
  // enum structurally tops out at "calibration_candidate" (class 3) and a
  // record cannot itself perform a class-4+ mutation — see
  // scripts/lib/calibration-core.mjs (promotion requires a human authorizer
  // and repeated/owner-declared evidence) and scripts/lib/registry-core.mjs
  // (the same for reference promotion). Pattern-matching a record's own
  // free text for words like "brand profile" or "Constitution" used to live
  // here; it was deleted (AES-V2 B3) because it filtered English vocabulary,
  // not authority — it missed the same intent in Korean and flagged an
  // exemplary abstention for naming a layer it could not distinguish. The
  // control that actually matters is at the mutation, not the complaint.

  return issues;
}

export function validateFeedbackRecordFile(path, table = loadRoutingTable(), schema = loadFeedbackSchema()) {
  let record;
  try {
    record = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable feedback record: ${err.message}`)];
  }
  return [
    ...validateFeedbackRecordAgainstSchema(record, schema),
    ...validateFeedbackRecordRouting(record, table),
  ];
}
