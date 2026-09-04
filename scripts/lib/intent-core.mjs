/**
 * Editorial Intent core — AES-V2.1 (SUE-559).
 *
 * Structural conformance to schemas/editorial-intent.schema.json plus the
 * cross-field invariants the schema cannot express (see
 * schemas/EDITORIAL-INTENT-CONTRACT.md). Fail-closed: an unparseable or
 * absent intent record is a failure, never an empty pass.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { loadAxes, loadAxisProfiles, PROFILES_ROOT } from './profile-core.mjs';
import { evaluateContentTypeMateriality, evaluateReferenceMateriality } from './materiality-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = resolve(HERE, '../../schemas/editorial-intent.schema.json');

export function loadSchema(path = SCHEMA_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export const CODES = Object.freeze({
  SCHEMA: 'schema',
  PARSE: 'parse',
  CLARIFICATION_STATUS: 'clarification-status-mismatch',
  MISSING_MATERIAL_UNLISTED: 'missing-material-unlisted',
  UNKNOWN_PROFILE: 'unknown-profile',
  ARTIFACT_MODALITY: 'artifact-modality-mismatch',
  CLARIFICATION_GATE: 'clarification-gate-exceeded',
  MISSING_BASIS: 'missing-basis',
  MATERIALITY_UNLISTED: 'materiality-computed-unlisted',
});

// Scalar axis fields, mapped to the axis id in editorial/profiles/axes.json.
// The artifact axis is handled separately because it is array-valued and
// namespaced (`visual/thumbnail`, not `thumbnail`).
const SCALAR_AXES = {
  transformation: 'transformation',
  content_type: 'content',
  audience: 'audience',
  surface: 'surface',
};

function issue(code, where, message) {
  return { code, where, message };
}

/**
 * Resolve one axis value (or artifact_request) against the profiles an axis
 * actually has on disk, distinguishing three outcomes: known id, declared
 * `planned`/`deferred` id (a visible gap, reported as a note, never a
 * silent pass and never a hard failure — matching scripts/validate-profiles.mjs),
 * or an id that names nothing at all.
 */
function classifyProfileRef(value, axisId, { axes, cache }) {
  const axis = axes.find((a) => a.axis === axisId);
  if (!axis) return { kind: 'unknown-axis' };
  if (!cache.has(axisId)) {
    cache.set(axisId, axis.populated ? loadAxisProfiles(axisId, { axes, root: PROFILES_ROOT }) : {});
  }
  const known = cache.get(axisId);
  if (value in known) return { kind: 'known', profile: known[value] };
  if ((axis.planned ?? []).includes(value)) return { kind: 'planned' };
  if ((axis.deferred ?? []).includes(value)) return { kind: 'deferred' };
  return { kind: 'none' };
}

/**
 * Validate one Editorial Intent object. Returns `{ issues, notes }`:
 * `issues` fail the run, `notes` surface a known, declared gap (a reference
 * to a planned/deferred profile) without failing it.
 */
export function validateIntent(intent, schema = loadSchema(), { axes = loadAxes() } = {}) {
  const issues = [];
  const notes = [];
  const cache = new Map();

  if (intent === null || typeof intent !== 'object' || Array.isArray(intent)) {
    return { issues: [issue(CODES.PARSE, '$', 'intent is not an object')], notes };
  }

  for (const e of validate(intent, schema)) {
    issues.push(issue(CODES.SCHEMA, e.path, e.message));
  }
  // Structural checks failed hard enough that cross-field checks would only
  // produce noise (e.g. reading axes off a missing `axes` object).
  if (issues.length > 0) return { issues, notes };

  const { axes: axesValue, clarification, status } = intent;
  const required = new Set(clarification.required ?? []);

  // --- clarification.required <=> status: blocked_on_clarification --------
  const blocked = status === 'blocked_on_clarification';
  if (required.size > 0 && !blocked) {
    issues.push(issue(CODES.CLARIFICATION_STATUS, 'status',
      `clarification.required is non-empty (${[...required].join(', ')}) but status is "${status}", not "blocked_on_clarification"`));
  }
  if (required.size === 0 && blocked) {
    issues.push(issue(CODES.CLARIFICATION_STATUS, 'status',
      'status is "blocked_on_clarification" but clarification.required is empty'));
  }

  // --- missing_material axes must be listed in clarification.required -----
  const checkMissingMaterial = (path, state) => {
    if (state === 'missing_material' && !required.has(path)) {
      issues.push(issue(CODES.MISSING_MATERIAL_UNLISTED, path,
        `axis is in state "missing_material" but "${path}" does not appear in clarification.required`));
    }
  };

  // --- confirmed/assumed axis values must resolve, and must carry a basis -
  const checkResolvable = (path, axisId, value, state, basis) => {
    if (state === 'missing_material') return;
    if ((state === 'confirmed' || state === 'assumed') && (!basis || basis.trim() === '')) {
      issues.push(issue(CODES.MISSING_BASIS, path,
        `axis value is "${state}" but carries no basis — an ${state} value cannot be audited or routed without one`));
    }
    if (value === null || value === undefined) return;
    const cls = classifyProfileRef(value, axisId, { axes, cache });
    if (cls.kind === 'planned') {
      notes.push(issue(CODES.UNKNOWN_PROFILE, path,
        `"${value}" is declared planned in the ${axisId} axis (editorial/profiles/axes.json) — not yet built`));
    } else if (cls.kind === 'deferred') {
      notes.push(issue(CODES.UNKNOWN_PROFILE, path,
        `"${value}" is explicitly deferred in the ${axisId} axis (editorial/profiles/axes.json)`));
    } else if (cls.kind === 'none' || cls.kind === 'unknown-axis') {
      issues.push(issue(CODES.UNKNOWN_PROFILE, path,
        `"${value}" is not a known profile in editorial/profiles/${axisId}/, and is not declared planned or deferred`));
    }
    return cls;
  };

  for (const [field, axisId] of Object.entries(SCALAR_AXES)) {
    const axisValue = axesValue[field];
    const path = `axes.${field}`;
    checkMissingMaterial(path, axisValue.state);
    checkResolvable(path, axisId, axisValue.value, axisValue.state, axisValue.basis);
  }

  // --- artifacts[] --------------------------------------------------------
  const artifacts = axesValue.artifacts ?? [];
  if (artifacts.length === 0) {
    // The schema's own description of `artifacts`: empty means the axis is
    // still unresolved, which is exactly the missing_material shape.
    checkMissingMaterial('axes.artifacts', 'missing_material');
  }
  artifacts.forEach((a, i) => {
    const path = `axes.artifacts[${i}]`;
    checkMissingMaterial(path, a.state);
    const cls = checkResolvable(path, 'artifact', a.value, a.state, a.basis);
    if (cls && cls.kind === 'known' && a.value) {
      const declaredModality = a.value.split('/')[0];
      if (cls.profile.modality !== declaredModality) {
        issues.push(issue(CODES.ARTIFACT_MODALITY, path,
          `artifact value "${a.value}" declares modality "${declaredModality}" but its profile's modality is "${cls.profile.modality}"`));
      }
    }
  });

  // --- computed materiality must agree with clarification.required --------
  // AES-V2.11 (SUE-569), P2/P3: schemas/EDITORIAL-INTENT-CONTRACT.md states a
  // numeric materiality test; materiality-core.mjs makes it executable. A
  // field the repository's own data proves material may not be silently
  // `assumed` and left out of `clarification.required`. `confirmed` is
  // exempt — confirmation means the utterance or an upstream contract
  // already settled the question, so materiality is moot by then.
  // `default_authorized` is exempt too: per the contract, that resolution's
  // entire effect is converting a would-be-`missing_material` field into a
  // sanctioned `assumed` for this run, which is precisely the case this
  // check would otherwise flag.
  const defaultAuthorized = clarification.resolution === 'default_authorized';
  const checkComputedMaterial = (path, state, result) => {
    if (!result.material) return;
    if (state === 'confirmed') return;
    if (defaultAuthorized) return;
    if (required.has(path)) return;
    issues.push(issue(CODES.MATERIALITY_UNLISTED, path,
      `computed material (${result.reason}) but "${path}" does not appear in clarification.required`));
  };

  const contentTypeResult = evaluateContentTypeMateriality(intent, { axes });
  checkComputedMaterial('axes.content_type', axesValue.content_type.state, contentTypeResult);

  for (const [i, refResult] of evaluateReferenceMateriality(intent).entries()) {
    checkComputedMaterial(refResult.path, intent.inputs.references[i]?.state, refResult);
  }

  // --- clarification.asked gate -------------------------------------------
  const asked = clarification.asked ?? [];
  if (asked.length > 3 && !(clarification.note && clarification.note.trim() !== '')) {
    issues.push(issue(CODES.CLARIFICATION_GATE, 'clarification.asked',
      `${asked.length} questions were asked (the gate is 1-3) with no clarification.note explaining why it was exceeded`));
  }

  return { issues, notes };
}

export function validateIntentFile(path, schema = loadSchema(), opts) {
  let intent;
  try {
    intent = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return { issues: [issue(CODES.PARSE, path, e.message)], notes: [] };
  }
  return validateIntent(intent, schema, opts);
}
