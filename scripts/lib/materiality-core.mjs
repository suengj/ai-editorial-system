/**
 * Materiality core — AES-V2.11 (SUE-569), P2/P3 fix.
 *
 * The portability probe (evals/system/portability/2026-09-05-intra-family-capability.md)
 * found that "is this axis gap material?" was a judgement call — one Claude
 * route got it wrong (P2) and the three routes produced three different
 * clarification sets because nothing enumerated *which* fields were material
 * (P3). schemas/EDITORIAL-INTENT-CONTRACT.md already states the test in
 * words ("the materiality test for clarification"); this module makes it
 * executable so a router never has to infer it.
 *
 * Every rule below reads data the repository already holds — content
 * profiles' own `evidence_burden`, an artifact profile's own `artifacts.
 * inappropriate` list (read through the ARTICLE-ARTIFACT-CONTRACT.md `kind`
 * mapping, transcribed below because no profile file carries `kind` itself),
 * `references/catalog.json`, and audience profiles' own `modality_effects`.
 * Nothing here invents a new threshold; the 1-source spread comes directly
 * from schemas/EDITORIAL-INTENT-CONTRACT.md's own worked example.
 *
 * This module computes; it does not decide whether to ask, phrase the
 * question in prose, or resolve deictic references in the utterance
 * ("이 이미지") — that is still natural-language understanding and stays with
 * the intake Skill. What moves out of model judgement is strictly the
 * materiality test itself.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAxes, loadAxisProfiles, loadProfiles, PROFILES_ROOT } from './profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');
export const CATALOG_PATH = resolve(REPO_ROOT, 'references/catalog.json');

/**
 * editorial/profiles/artifact/*.json carry no `kind` field — `kind` is the
 * coarser, separate V1 vocabulary a content profile's `artifacts.
 * inappropriate` list speaks in (schemas/ARTICLE-ARTIFACT-CONTRACT.md,
 * "Artifact `kind` and artifact profile are different layers"). This is that
 * contract's own worked mapping table, transcribed rather than invented —
 * there is no JSON source of truth for it yet. Profiles absent here
 * (thumbnail, social-card, concept-illustration) are publication-surface
 * assets with no `kind` at all, per the same section.
 */
export const KIND_BY_ARTIFACT_PROFILE = Object.freeze({
  'visual/body-infographic': 'infographic',
  'visual/evidence-visual': 'evidence_visual',
  'visual/analytical-graphic': 'evidence_visual',
  'visual/explanatory-diagram': 'evidence_visual',
  'visual/slide-image': 'slides',
  'audio/monologue': 'audio',
  'audio/dialogue': 'audio',
  'audio/timed-narration': 'audio',
});

function loadCatalog(path = CATALOG_PATH) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { entries: [] };
  }
}

function requestedArtifactKinds(intent) {
  const kinds = new Set();
  for (const a of intent?.axes?.artifacts ?? []) {
    if (a?.value && KIND_BY_ARTIFACT_PROFILE[a.value]) kinds.add(KIND_BY_ARTIFACT_PROFILE[a.value]);
  }
  return kinds;
}

function requestedModalities(intent) {
  const mods = new Set();
  for (const a of intent?.axes?.artifacts ?? []) {
    if (a?.value) mods.add(a.value.split('/')[0]);
  }
  return mods;
}

function confirmedSourceCount(intent) {
  return (intent?.inputs?.sources ?? []).filter((s) => s?.state === 'confirmed').length;
}

const fmtBurden = (p) => `${p.content_type} (min_sources=${p.evidence_burden.min_sources}${
  (p.evidence_burden.min_source_roles ?? []).includes('contradicting') ? ', requires contradicting' : ''
})`;

/**
 * Content-type materiality (P2). Narrows the candidate set mechanically,
 * exactly as the probe's own Route C did, before comparing:
 *
 * 1. A content type is not plausible if a requested artifact's `kind` is
 *    listed in that content type's own `artifacts.inappropriate`
 *    (note.json excludes `infographic`, so `note` drops out the moment a
 *    `visual/body-infographic` is requested).
 * 2. A content type is not plausible if it demands more sources
 *    (`evidence_burden.min_sources`) than the intent currently has
 *    `confirmed` — the same source-count-vs-burden comparison
 *    `profile-core.mjs#validateAgainstProfile` already makes downstream, run
 *    here pre-emptively over every candidate rather than the one chosen
 *    value. This is what keeps a one-source adaptation of an existing piece
 *    (worked example: intent-child-explainer) from being flagged material
 *    merely because `academic` and `research` exist as content types in the
 *    abstract — they are not reachable with the sources actually on hand.
 *
 * Materiality is then the contract's own test: a spread of more than one
 * source in `min_sources` across what remains, or a split over whether a
 * `contradicting`-role source is required.
 */
export function evaluateContentTypeMateriality(intent, { axes = loadAxes(), profiles = loadProfiles() } = {}) {
  void axes; // kept for a uniform (intent, opts) signature across evaluators
  const all = Object.values(profiles);
  const kinds = requestedArtifactKinds(intent);
  const byArtifact = all.filter((p) => ![...kinds].some((k) => (p.artifacts?.inappropriate ?? []).includes(k)));
  const excludedByArtifact = all.filter((p) => !byArtifact.includes(p));

  const sourceCount = confirmedSourceCount(intent);
  const byBoth = byArtifact.filter((p) => p.evidence_burden.min_sources <= sourceCount);
  // A candidate set narrowed into emptiness is a modelling artifact (e.g. no
  // source is confirmed yet), not evidence of zero plausible readings —
  // fall back to the artifact-narrowed set rather than compare over nothing.
  const plausible = byBoth.length > 0 ? byBoth : byArtifact;

  const exclusionParts = [];
  if (excludedByArtifact.length) {
    exclusionParts.push(`excluding ${excludedByArtifact.map((p) => p.content_type).join(', ')} (requested artifact kind${kinds.size === 1 ? '' : 's'} [${[...kinds].join(', ')}] listed under its artifacts.inappropriate)`);
  }
  if (byBoth.length > 0 && byBoth.length < byArtifact.length) {
    const excludedBySource = byArtifact.filter((p) => !byBoth.includes(p));
    exclusionParts.push(`excluding ${excludedBySource.map((p) => p.content_type).join(', ')} (min_sources exceeds the ${sourceCount} confirmed source(s) on hand)`);
  }
  const exclusionNote = exclusionParts.length ? ` after ${exclusionParts.join(' and ')}` : '';

  if (plausible.length <= 1) {
    return {
      path: 'axes.content_type',
      material: false,
      reason: plausible.length === 1
        ? `only one plausible content type remains${exclusionNote}: ${fmtBurden(plausible[0])} — no residual ambiguity`
        : 'no content profiles loaded — nothing to compare',
      question: null,
    };
  }

  const minSources = plausible.map((p) => p.evidence_burden.min_sources);
  const spread = Math.max(...minSources) - Math.min(...minSources);
  const requiresContradicting = new Set(plausible.map((p) => (p.evidence_burden.min_source_roles ?? []).includes('contradicting')));
  const splitOnContradicting = requiresContradicting.size > 1;
  const material = spread > 1 || splitOnContradicting;
  const detail = plausible.map(fmtBurden).join(', ');

  const defaultType = plausible.slice().sort((a, b) => (
    a.evidence_burden.min_sources - b.evidence_burden.min_sources
  ) || a.content_type.localeCompare(b.content_type))[0].content_type;

  return {
    path: 'axes.content_type',
    material,
    reason: material
      ? `plausible content types${exclusionNote}: ${detail} — a spread of ${spread} source(s) in min_sources${splitOnContradicting ? ', and a split over requiring a contradicting-role source,' : ''} exceeds the contract's 1-source materiality threshold (schemas/EDITORIAL-INTENT-CONTRACT.md, "the materiality test for clarification")`
      : `plausible content types${exclusionNote}: ${detail} — a spread of ${spread} source(s) is within the contract's 1-source threshold`,
    question: material ? {
      field: 'axes.content_type',
      question: 'Which content type is this?',
      options: plausible.map((p) => p.content_type).sort(),
      default: defaultType,
    } : null,
  };
}

/**
 * Reference materiality: a `references[]` entry whose `ref_id` does not
 * resolve against `references/catalog.json` is material — intake may not
 * invent a `ref_id` and present it as settled. Scoped to entries that
 * actually exist in `inputs.references`; a reference named in the utterance
 * but never captured as an entry at all (the probe's deictic "이 이미지") is a
 * natural-language recognition problem, not a lookup, and is surfaced
 * instead through `clarification.required` naming the whole `inputs.
 * references` path (mirroring how `axes.artifacts` is checked as a whole
 * array — see intent-core.mjs).
 */
export function evaluateReferenceMateriality(intent, { catalog = loadCatalog() } = {}) {
  const known = new Set((catalog?.entries ?? []).map((e) => e.ref_id).filter(Boolean));
  const refs = intent?.inputs?.references ?? [];
  return refs.map((r, i) => {
    const resolved = known.has(r?.ref_id);
    return {
      path: `inputs.references[${i}]`,
      material: !resolved,
      reason: resolved
        ? `"${r.ref_id}" resolves against references/catalog.json (${known.size} entries)`
        : `"${r?.ref_id}" does not resolve against references/catalog.json (${known.size} entries checked) — intake may not invent a ref_id`,
      question: resolved ? null : {
        field: `inputs.references[${i}]`,
        question: `The reference "${r?.ref_id}" is not in references/catalog.json. What is this reference?`,
        options: [],
        default: undefined,
      },
    };
  });
}

/**
 * Audience materiality: material when the audience profiles' own
 * `modality_effects` for a requested modality are not all identical — the
 * contract's own example is a child explainer versus a domain-expert brief.
 * With no artifact/modality resolved yet there is nothing to compare a
 * delivery difference against, so this is not material until at least one
 * artifact is known (the contract's "assumed to the surface's usual reader"
 * carve-out for a general request).
 *
 * Exported per AES-V2.11 deliverable 1 for the intake Skill and for future
 * wiring, but NOT wired into scripts/lib/intent-core.mjs's hard-failing
 * check: unlike content type, no axis in this repository narrows the
 * *plausible* audience set the way `artifacts.inappropriate` and confirmed
 * source count narrow content type, so applying this unconditionally would
 * flag the repository's own "assumed to the surface's usual reader" worked
 * examples (e.g. intent-synthesize-research-suengj.example.json's
 * domain-practitioner default) as material every time, which is a false
 * positive, not a fix. See the Writer's report for the residual gap this
 * points at.
 */
export function evaluateAudienceMateriality(intent, { axes = loadAxes() } = {}) {
  const modalities = requestedModalities(intent);
  if (modalities.size === 0) {
    return {
      path: 'axes.audience',
      material: false,
      reason: 'no artifact/modality is resolved yet, so no modality-specific delivery difference can be tested — assumed to the surface\'s usual reader per the contract',
      question: null,
    };
  }

  const profiles = Object.values(loadAxisProfiles('audience', { axes, root: PROFILES_ROOT }));
  const diverging = [];
  for (const modality of modalities) {
    const effects = profiles
      .map((p) => ({ id: p.audience, effect: p.modality_effects?.[modality] }))
      .filter((e) => e.effect);
    const serialized = effects.map((e) => JSON.stringify(e.effect));
    const allSame = serialized.every((s) => s === serialized[0]);
    if (!allSame) diverging.push({ modality, effects });
  }

  const material = diverging.length > 0;
  return {
    path: 'axes.audience',
    material,
    reason: material
      ? `audience profiles diverge in modality_effects.${diverging[0].modality} across [${diverging[0].effects.map((e) => e.id).join(', ')}] for the requested ${diverging.map((d) => d.modality).join(', ')} modality — the contract's own example is a child explainer versus a domain-expert brief`
      : `all audience profiles agree on modality_effects for the requested modalit${modalities.size === 1 ? 'y' : 'ies'} (${[...modalities].join(', ')})`,
    question: null,
  };
}

/**
 * Artifact materiality: an empty `axes.artifacts` is always material —
 * `editorial-intent.schema.json` states this directly. Provided for
 * completeness; scripts/lib/intent-core.mjs already enforces this
 * independently (`checkMissingMaterial('axes.artifacts', ...)`), so this is
 * not re-wired as a second check on the same fact.
 */
export function evaluateArtifactMateriality(intent) {
  const artifacts = intent?.axes?.artifacts ?? [];
  return {
    path: 'axes.artifacts',
    material: artifacts.length === 0,
    reason: artifacts.length === 0
      ? 'axes.artifacts is empty — editorial-intent.schema.json states directly that an empty artifact axis means the axis is unresolved'
      : `${artifacts.length} artifact(s) requested`,
    question: null,
  };
}

/** Every computed-materiality result for one intent, in one call. */
export function evaluateMateriality(intent, opts = {}) {
  return [
    evaluateContentTypeMateriality(intent, opts),
    evaluateAudienceMateriality(intent, opts),
    evaluateArtifactMateriality(intent),
    ...evaluateReferenceMateriality(intent, opts),
  ];
}
