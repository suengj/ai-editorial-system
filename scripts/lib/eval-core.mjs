/**
 * Evaluation engine — AES-P3.2 (SUE-450).
 *
 * Runs the mechanically decidable part of the rubric over the fixture corpus
 * and produces a scorecard. Judgement dimensions are left explicitly
 * unscored: an empty slot is honest, an invented rating is not.
 *
 * The rule this exists for: a run is a regression when any integrity
 * dimension moves pass → fail, regardless of how many editorial dimensions
 * improved. A piece that reads better and states a wrong number is worse.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks, loadGates, paragraphs, runGates } from './quality-gates-core.mjs';
import { checkPolish } from './polish-invariants.mjs';
import { loadProfiles } from './profile-core.mjs';
import { validatePresentationPlan } from './presentation-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
export const RUBRIC_PATH = resolve(ROOT, 'evals/rubric.json');
export const MANIFEST_PATH = resolve(ROOT, 'evals/fixtures/manifest.json');

export const loadRubric = (p = RUBRIC_PATH) => JSON.parse(readFileSync(p, 'utf8'));
export const loadManifest = (p = MANIFEST_PATH) => JSON.parse(readFileSync(p, 'utf8'));

export const UNSCORED = 'unscored';

/** Gate names that decide each mechanically-backed dimension. */
const GATE_MAP = {
  'I-1': ['citation-integrity'],
  'E-2': ['sequential-summary'],
  'E-3': ['evidence-density'],
  'E-7': ['headline-thesis-fidelity'],
  'E-8': ['overclaim', 'empty-hedge'],
  'E-9': ['prompt-echo', 'duplicate-paragraph', 'scaffolding-leak', 'formulaic-sectioning', 'filler-phrase'],
};

/**
 * Evaluate one fixture body.
 * `baseline` enables the polish-preservation dimension by supplying the text
 * the body is claimed to be a polished version of.
 */
export function evaluate(body, { article = null, contentType = null, baseline = null,
  presentationPlan = null,
  rubric = loadRubric(), gates = loadGates(), profiles = loadProfiles() } = {}) {
  const profile = contentType ? profiles[contentType] : null;
  const findings = runGates(body, article, gates, profile);
  const byGate = new Map();
  for (const f of findings) byGate.set(f.gate, f);

  // Presentation dimensions are decidable only when a plan exists. An article
  // with no semantic blocks is not thereby deficient — plain prose is the
  // default — so absence yields `unscored`, not a fail.
  const presentationIssues = presentationPlan
    ? validatePresentationPlan(presentationPlan, { contentType, paragraphCount: paragraphs(body).length, profiles })
    : null;
  const portabilityCodes = new Set(['renderer-leak', 'lossy-fallback', 'meaning-carried-by-colour']);

  const dimensions = {};
  for (const dim of rubric.dimensions) {
    const gateNames = GATE_MAP[dim.id] ?? [];
    const hits = gateNames.map((g) => byGate.get(g)).filter(Boolean);

    if (dim.id === 'I-2') {
      // Polish preservation is only decidable against a baseline.
      if (!baseline) {
        dimensions[dim.id] = { class: dim.class, name: dim.name, result: UNSCORED,
          evidence: 'no baseline supplied; polish preservation is undecidable without one' };
        continue;
      }
      const violations = checkPolish(baseline, body);
      dimensions[dim.id] = {
        class: dim.class, name: dim.name,
        result: violations.length === 0 ? 'pass' : 'fail',
        evidence: violations.length === 0
          ? 'protected spans identical'
          : violations.slice(0, 4).map((v) => `${v.kind} ${v.class}: ${v.value}`).join('; '),
      };
      continue;
    }

    if (dim.id === 'I-6' || dim.id === 'E-12') {
      if (!presentationIssues) {
        dimensions[dim.id] = { class: dim.class, name: dim.name, result: UNSCORED,
          evidence: 'no presentation plan supplied; plain prose is the default and is not a deficiency' };
        continue;
      }
      const relevant = dim.id === 'I-6'
        ? presentationIssues.filter((i) => portabilityCodes.has(i.code))
        : presentationIssues.filter((i) => !portabilityCodes.has(i.code));
      dimensions[dim.id] = dim.class === 'integrity'
        ? { class: dim.class, name: dim.name, result: relevant.length === 0 ? 'pass' : 'fail',
            evidence: relevant.length === 0 ? 'fallbacks lossless, no renderer leak' : relevant.map((i) => `${i.code}: ${i.message}`).join('; ') }
        : { class: dim.class, name: dim.name, result: relevant.length === 0 ? UNSCORED : 0,
            evidence: relevant.length === 0 ? 'no structural finding; rating requires human assessment' : relevant.map((i) => `${i.code}: ${i.message}`).join('; ') };
      continue;
    }

    if (dim.mechanical === 'none' || (gateNames.length === 0 && dim.class === 'editorial')) {
      dimensions[dim.id] = { class: dim.class, name: dim.name, result: UNSCORED,
        evidence: dim.evidence ?? 'requires human or judge assessment' };
      continue;
    }

    if (dim.class === 'integrity') {
      dimensions[dim.id] = {
        class: dim.class, name: dim.name,
        result: hits.length === 0 ? 'pass' : 'fail',
        evidence: hits.length === 0 ? 'no mechanical finding' : hits.map((h) => `${h.gate}: ${h.detail}`).join('; '),
        partial: dim.mechanical === 'partial',
      };
      continue;
    }

    // Editorial dimensions with mechanical backing: a finding caps the rating.
    dimensions[dim.id] = {
      class: dim.class, name: dim.name,
      result: hits.length === 0 ? UNSCORED : 0,
      evidence: hits.length === 0
        ? 'no mechanical finding; rating requires human or judge assessment'
        : hits.map((h) => `${h.gate}: ${h.detail}`).join('; '),
    };
  }

  return {
    dimensions,
    findings,
    hard_fail: blocks(findings) || Object.values(dimensions).some((d) => d.class === 'integrity' && d.result === 'fail'),
  };
}

/**
 * Compare two scorecards for the same fixture.
 * Integrity regressions dominate: any pass → fail is a regression, however
 * many editorial dimensions improved.
 */
export function compare(before, after) {
  const integrityRegressions = [];
  const integrityFixes = [];
  const editorialChanges = [];

  for (const [id, a] of Object.entries(after.dimensions)) {
    const b = before.dimensions[id];
    if (!b) continue;

    if (a.class === 'integrity') {
      // Anything that is not a fail becoming a fail is a regression. This
      // includes unscored → fail: the baseline may have been undecidable, but
      // the new run is decidably wrong.
      if (b.result !== 'fail' && a.result === 'fail') {
        integrityRegressions.push({
          id, name: a.name, evidence: a.evidence,
          baseline_was: b.result,
        });
      }
      if (b.result === 'fail' && a.result === 'pass') integrityFixes.push({ id, name: a.name });
      continue;
    }

    if (typeof b.result === 'number' && typeof a.result === 'number' && a.result !== b.result) {
      editorialChanges.push({ id, name: a.name, from: b.result, to: a.result });
    } else if (b.result !== UNSCORED && a.result === UNSCORED) {
      editorialChanges.push({ id, name: a.name, from: b.result, to: UNSCORED });
    } else if (b.result === UNSCORED && a.result !== UNSCORED) {
      editorialChanges.push({ id, name: a.name, from: UNSCORED, to: a.result });
    }
  }

  const improved = editorialChanges.filter((c) => typeof c.to === 'number' && typeof c.from === 'number' && c.to > c.from);

  return {
    verdict: integrityRegressions.length > 0 ? 'regression'
      : integrityFixes.length > 0 ? 'improvement'
        : 'no integrity change',
    integrityRegressions,
    integrityFixes,
    editorialChanges,
    // Recorded so the report can state the trap plainly rather than hide it.
    improvedDespiteRegression: integrityRegressions.length > 0 && improved.length > 0,
  };
}
