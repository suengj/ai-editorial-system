/**
 * Failure routing engine — AES-V2.5 (SUE-563).
 *
 * Validates editorial/feedback-routing.json for internal consistency and
 * checks feedback records (schemas/feedback-record.schema.json) against it:
 * every negative verdict must name a shared layer, name a modality layer, or
 * explicitly abstain — three distinct states that must never collapse into
 * each other — and no record may propose a mutation above the class its
 * scope can carry.
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
  ESCALATION_ABOVE_CEILING: 'escalation-above-ceiling',
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

/** Language that proposes a class-4-or-above change. No feedback record may express this. */
const CLASS4_PLUS_PATTERNS = [
  { re: /\bbrand[\s_-]?profile\b/i, label: 'a brand-profile change' },
  { re: /\bpublication profile\b/i, label: 'a publication-profile change' },
  { re: /\bcore rout(e|ing)\b/i, label: 'a core-routing change' },
  { re: /\b(register|content-type) profile\b/i, label: 'a content-type/register profile change' },
  { re: /\bconstitution\b/i, label: 'a Constitution change' },
  { re: /\bcore invariants?\b/i, label: 'a core-invariant change' },
  { re: /\bssot boundary\b/i, label: 'an SSOT-boundary change' },
  { re: /\bactivat(e|ing|ion of) (a )?new (durable )?calibration/i, label: 'a calibration activation' },
];

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

  // --- authority ceiling: no record may propose class 4+ on its own -------
  for (const p of CLASS4_PLUS_PATTERNS) {
    if (p.re.test(text)) {
      issues.push(issue(CODES.ESCALATION_ABOVE_CEILING, where,
        `statement proposes ${p.label}; a feedback record's scope tops out at class 3 (calibration_candidate) — class 4 and above require explicit human activation or evidence-backed review outside this record`));
    }
  }

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
