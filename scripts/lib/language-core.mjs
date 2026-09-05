/**
 * Language pack engine — AES-V2.17 (SUE-607).
 *
 * Validates every pack under the `language` axis (editorial/profiles/language/,
 * loaded through the axis registry — scripts/lib/profile-core.mjs — never
 * hardcoded) against schemas/language-pack.schema.json plus the house rules a
 * schema alone cannot express: authority-class discipline, genre/audience
 * orthogonality, promotion evidence for empirical rules, and holdout
 * leakage. See docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md — this
 * module enforces that document; it never restates it.
 *
 * Dependency-free ESM, modelled on scripts/lib/corpus-core.mjs and
 * scripts/lib/registry-core.mjs.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { loadAxes, loadAxisProfiles, PROFILES_ROOT } from './profile-core.mjs';
import { checkPromotionSufficiency } from './promotion-core.mjs';
import { listEvaluationFiles, PATHS as REGISTRY_PATHS, resolveEvidenceRef } from './registry-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../..');

export const SCHEMA_PATH = resolve(ROOT, 'schemas/language-pack.schema.json');
export const ROUTING_PATH = resolve(ROOT, 'editorial/feedback-routing.json');
export const LANGUAGE_AXIS_ID = 'language';

export const loadSchema = (p = SCHEMA_PATH) => JSON.parse(readFileSync(p, 'utf8'));
export const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Authority classes whose durability is earned by cross-source, holdout-validated evidence (LANGUAGE-QUALITY-ARCHITECTURE.md §6), never by a standards body. */
const EMPIRICAL_AUTHORITY_CLASSES = new Set(['NATIVE_QUALITY', 'GENRE_CONVENTION', 'AUDIENCE_CONSTRAINT']);
const HOLDOUT_OK = new Set(['improved', 'neutral']);

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  FILENAME_MISMATCH: 'pack-id-filename-mismatch',
  ID_PATTERN: 'pack-id-pattern-mismatch',
  DOC_REF_MISSING: 'doc-ref-missing',
  UNKNOWN_LAYER: 'unknown-layer',
  NORMATIVE_NO_AUTHORITY: 'normative-no-authority',
  NORMATIVE_AUTHORITY_UNRESOLVED: 'normative-authority-unresolved',
  NORMATIVE_BACKED_BY_WEAKER_SOURCE: 'normative-backed-by-weaker-source',
  UNBACKED_MECHANICAL_CLAIM: 'unbacked-mechanical-empirical-claim',
  SHARED_PROMOTION_INSUFFICIENT: 'shared-promotion-insufficient',
  GENRE_CARRIES_AUDIENCE: 'genre-rule-carries-audience-scope',
  AUDIENCE_CARRIES_GENRE: 'audience-rule-carries-genre-scope',
  UNKNOWN_CONTENT_TYPE: 'unknown-content-type-scope',
  UNKNOWN_AUDIENCE: 'unknown-audience-scope',
  UNKNOWN_ALIAS_AUDIENCE: 'unknown-alias-audience',
  HOLDOUT_LEAKAGE: 'holdout-leakage',
  DANGLING_EVIDENCE_REF: 'dangling-evidence-ref',
  UNASSIGNED_CORPUS_ROLE: 'unassigned-corpus-role',
  POINTLESS_ALIAS: 'pointless-audience-alias',
});

const issue = (code, where, message) => ({ code, where, message });

// --- axis / registry loading -------------------------------------------

export function getLanguageAxis(axes = loadAxes()) {
  const axis = axes.find((a) => a.axis === LANGUAGE_AXIS_ID);
  if (!axis) throw new Error(`axis registry has no "${LANGUAGE_AXIS_ID}" axis — editorial/profiles/axes.json`);
  return axis;
}

export function listPackFiles(axis = getLanguageAxis(), root = PROFILES_ROOT) {
  const dir = resolve(root, axis.dir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => resolve(dir, f));
}

/** Every layer id declared in editorial/feedback-routing.json, flattened across groups. Never hardcoded. */
export function loadRoutingLayerIds(routingPath = ROUTING_PATH) {
  const table = loadJson(routingPath);
  const ids = new Set();
  for (const group of Object.values(table.layers ?? {})) {
    for (const entry of group) if (entry?.id) ids.add(entry.id);
  }
  return ids;
}

// --- per-check helpers ---------------------------------------------------

export function checkSchema(pack, schema, where) {
  return validate(pack, schema).map((e) => issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
}

export function checkFilenameAndId(pack, filePath, axis) {
  const issues = [];
  const stem = basename(filePath).replace(/\.json$/, '');
  if (typeof pack.pack_id === 'string' && pack.pack_id !== stem) {
    issues.push(issue(CODES.FILENAME_MISMATCH, filePath,
      `pack_id "${pack.pack_id}" does not match filename "${basename(filePath)}"`));
  }
  if (typeof pack.pack_id === 'string' && !new RegExp(axis.id_pattern).test(pack.pack_id)) {
    issues.push(issue(CODES.ID_PATTERN, filePath,
      `pack_id "${pack.pack_id}" does not match axis id_pattern ${axis.id_pattern}`));
  }
  return issues;
}

export function checkDocRef(pack, where, root = ROOT) {
  if (typeof pack.doc_ref !== 'string' || pack.doc_ref.length === 0) return [];
  if (!existsSync(resolve(root, pack.doc_ref))) {
    return [issue(CODES.DOC_REF_MISSING, where, `doc_ref "${pack.doc_ref}" does not exist on disk`)];
  }
  return [];
}

export function checkLayers(pack, where, routingLayerIds) {
  const issues = [];
  for (const rule of pack.rules ?? []) {
    if (rule.layer && !routingLayerIds.has(rule.layer)) {
      issues.push(issue(CODES.UNKNOWN_LAYER, `${where}:${rule.id}`,
        `layer "${rule.layer}" is not a known layer id in editorial/feedback-routing.json`));
    }
  }
  return issues;
}

/** authorities[].id -> authority record. */
function authorityMap(pack) {
  const map = new Map();
  for (const a of pack.authorities ?? []) if (a?.id) map.set(a.id, a);
  return map;
}

/**
 * §2/§6: a NORMATIVE rule's correctness comes from an issuing standards body,
 * never from a corpus. A NORMATIVE rule backed by an EMPIRICAL_REFERENCE or
 * STRONG_GUIDANCE authority is a corpus observation wearing a normative
 * label — the headline failure this validator exists to catch.
 */
export function checkNormativeAuthority(pack, where) {
  const issues = [];
  const authorities = authorityMap(pack);
  for (const rule of pack.rules ?? []) {
    if (rule.authority_class !== 'NORMATIVE') continue;
    const ruleWhere = `${where}:${rule.id}`;
    if (rule.authority_ref == null) {
      issues.push(issue(CODES.NORMATIVE_NO_AUTHORITY, ruleWhere,
        'authority_class NORMATIVE requires a non-null authority_ref — a normative rule with no standards body behind it is a corpus observation wearing a normative label'));
      continue;
    }
    const authority = authorities.get(rule.authority_ref);
    if (!authority) {
      issues.push(issue(CODES.NORMATIVE_AUTHORITY_UNRESOLVED, ruleWhere,
        `authority_ref "${rule.authority_ref}" does not resolve to an entry in this pack's authorities[]`));
      continue;
    }
    if (authority.source_class !== 'NORMATIVE_STANDARD') {
      issues.push(issue(CODES.NORMATIVE_BACKED_BY_WEAKER_SOURCE, ruleWhere,
        `authority_class NORMATIVE is backed by authority "${rule.authority_ref}" whose source_class is "${authority.source_class}", not NORMATIVE_STANDARD — codified correctness comes from an issuing standards body; an EMPIRICAL_REFERENCE or STRONG_GUIDANCE source may illustrate a normative rule but may never establish one (LANGUAGE-QUALITY-ARCHITECTURE.md §6)`));
    }
  }
  return issues;
}

/**
 * §6/§11: NATIVE_QUALITY / GENRE_CONVENTION / AUDIENCE_CONSTRAINT are
 * empirical. Declaring one "mechanical" without an authority_ref to point at
 * is an empirical claim dressed up as something a validator can decide —
 * the reverse of the normative failure above.
 */
export function checkUnbackedMechanicalClaim(pack, where) {
  const issues = [];
  for (const rule of pack.rules ?? []) {
    if (!EMPIRICAL_AUTHORITY_CLASSES.has(rule.authority_class)) continue;
    if (rule.checkability === 'mechanical' && rule.authority_ref == null) {
      issues.push(issue(CODES.UNBACKED_MECHANICAL_CLAIM, `${where}:${rule.id}`,
        `authority_class "${rule.authority_class}" is empirical and claims checkability "mechanical" with no authority_ref — an unbacked mechanical claim is exactly the confident-wrong-verdict failure mode LANGUAGE-QUALITY-ARCHITECTURE.md §11 warns against`));
    }
  }
  return issues;
}

/**
 * §6: promotion of an empirical trait to `generality: "shared"` requires
 * multi-source evidence (reused from scripts/lib/promotion-core.mjs, the one
 * place the repo's promotion-sufficiency rule lives) and a holdout result of
 * improved/neutral. While the pack is still `draft`, an insufficiently
 * proven shared rule is downgraded to a NOTE — a draft pack is explicitly
 * allowed to hold not-yet-validated rules (schemas/language-pack.schema.json
 * `status`); an `active` pack is not.
 */
export function checkSharedPromotion(pack, where) {
  const issues = [];
  const notes = [];
  const isDraft = pack.status === 'draft';
  for (const rule of pack.rules ?? []) {
    if (rule.generality !== 'shared' || !EMPIRICAL_AUTHORITY_CLASSES.has(rule.authority_class)) continue;
    const ruleWhere = `${where}:${rule.id}`;
    const { insufficientEvidence } = checkPromotionSufficiency({ evidenceRefs: rule.evidence_refs });
    const holdoutOk = HOLDOUT_OK.has(rule.holdout_result);
    if (insufficientEvidence || !holdoutOk) {
      const reasons = [];
      if (insufficientEvidence) reasons.push('fewer than two evidence_refs');
      if (!holdoutOk) reasons.push(`holdout_result is "${rule.holdout_result ?? 'undefined'}", not improved/neutral`);
      const message = `generality "shared" on empirical authority_class "${rule.authority_class}" requires at least two evidence_refs and a holdout_result of improved or neutral (${reasons.join('; ')}) — LANGUAGE-QUALITY-ARCHITECTURE.md §6/§7`;
      if (isDraft) notes.push(issue(CODES.SHARED_PROMOTION_INSUFFICIENT, ruleWhere, `${message} — reported as a NOTE because pack status is "draft"`));
      else issues.push(issue(CODES.SHARED_PROMOTION_INSUFFICIENT, ruleWhere, message));
    }
  }
  return { issues, notes };
}

/**
 * §3: genre and audience are orthogonal axes. Encoding an audience as a
 * genre (or a genre as an audience) is what makes "news for a 10-year-old"
 * inexpressible.
 */
export function checkGenreAudienceOrthogonality(pack, where) {
  const issues = [];
  for (const rule of pack.rules ?? []) {
    const ruleWhere = `${where}:${rule.id}`;
    const scope = rule.scope ?? {};
    if (rule.authority_class === 'GENRE_CONVENTION' && Array.isArray(scope.audiences) && scope.audiences.length > 0) {
      issues.push(issue(CODES.GENRE_CARRIES_AUDIENCE, ruleWhere,
        'authority_class GENRE_CONVENTION carries scope.audiences — genre and audience are independent axes (LANGUAGE-QUALITY-ARCHITECTURE.md §3); encoding an audience as a genre is what makes "news for a 10-year-old" inexpressible'));
    }
    if (rule.authority_class === 'AUDIENCE_CONSTRAINT' && Array.isArray(scope.content_types) && scope.content_types.length > 0) {
      issues.push(issue(CODES.AUDIENCE_CARRIES_GENRE, ruleWhere,
        'authority_class AUDIENCE_CONSTRAINT carries scope.content_types — genre and audience are independent axes (LANGUAGE-QUALITY-ARCHITECTURE.md §3); an audience constraint is not thereby a genre rule'));
    }
  }
  return issues;
}

/** scope.content_types / scope.audiences / terminology[].audience_aliases[].audience resolve against the content and audience axes — loaded through the axis registry, never hardcoded. */
export function checkScopeIdsResolve(pack, where, { contentIds, audienceIds }) {
  const issues = [];
  for (const rule of pack.rules ?? []) {
    const ruleWhere = `${where}:${rule.id}`;
    const scope = rule.scope ?? {};
    for (const ct of scope.content_types ?? []) {
      if (!contentIds.has(ct)) {
        issues.push(issue(CODES.UNKNOWN_CONTENT_TYPE, ruleWhere, `scope.content_types references "${ct}", which is not a known editorial/profiles/content id`));
      }
    }
    for (const a of scope.audiences ?? []) {
      if (!audienceIds.has(a)) {
        issues.push(issue(CODES.UNKNOWN_AUDIENCE, ruleWhere, `scope.audiences references "${a}", which is not a known editorial/profiles/audience id`));
      }
    }
  }
  for (const term of pack.terminology ?? []) {
    for (const alias of term.audience_aliases ?? []) {
      if (!audienceIds.has(alias.audience)) {
        issues.push(issue(CODES.UNKNOWN_ALIAS_AUDIENCE, `${where}:${term.id}`,
          `audience_aliases references audience "${alias.audience}", which is not a known editorial/profiles/audience id`));
      }
    }
  }
  return issues;
}

/**
 * §7: a trait derived from holdout material has destroyed the holdout. Every
 * evidence_ref that resolves to an actual reference-evaluation record on
 * disk is checked; a ref that resolves to nothing is dangling and is
 * reported, never silently passed. A record carrying no corpus_role at all
 * is "unassigned" (another agent is adding the field to
 * schemas/reference-evaluation.schema.json concurrently) — not a leak, but
 * reported as a NOTE so it does not go unnoticed once the field lands.
 */
export function checkHoldoutLeakage(pack, where, {
  evaluationsDir = REGISTRY_PATHS.evaluationsDir,
  feedbackDir = REGISTRY_PATHS.feedbackDir,
  evaluationFiles = listEvaluationFiles(evaluationsDir),
} = {}) {
  const issues = [];
  const notes = [];
  const evalByFilename = new Map(evaluationFiles.map((p) => [basename(p), p]));

  for (const rule of pack.rules ?? []) {
    const ruleWhere = `${where}:${rule.id}`;
    for (const ref of rule.evidence_refs ?? []) {
      if (typeof ref !== 'string') continue;
      const resolved = resolveEvidenceRef(ref, { evaluationsDir, feedbackDir });
      if (!resolved) {
        issues.push(issue(CODES.DANGLING_EVIDENCE_REF, ruleWhere, `evidence_refs "${ref}" does not resolve to a record on disk`));
        continue;
      }
      if (!ref.startsWith('eval:')) continue; // not a reference-evaluation record; no corpus_role to check
      const slug = ref.slice('eval:'.length);
      const path = evalByFilename.get(`${slug}.json`);
      if (!path) continue; // resolved via resolveEvidenceRef but not found by our own filename index — treated as already reported above
      let record;
      try {
        record = loadJson(path);
      } catch {
        continue; // unparseable evaluation file is reported by the registry validator, not here
      }
      if (record.corpus_role === 'holdout') {
        issues.push(issue(CODES.HOLDOUT_LEAKAGE, ruleWhere,
          `evidence_refs "${ref}" resolves to a reference-evaluation record with corpus_role "holdout" — a trait derived from holdout material has destroyed the holdout (LANGUAGE-QUALITY-ARCHITECTURE.md §7)`));
      } else if (record.corpus_role == null) {
        notes.push(issue(CODES.UNASSIGNED_CORPUS_ROLE, ruleWhere,
          `evidence_refs "${ref}" resolves to a reference-evaluation record with no corpus_role — not yet assigned, not a leak, but should be reported`));
      }
    }
  }
  return { issues, notes };
}

/**
 * §terminology: an alias whose surface_form is identical to canonical or
 * rendering is pointless (it changes nothing). The real defect — an alias
 * that quietly names a *different concept* — is not mechanically decidable
 * from the pack alone (it requires judging the meaning of prose), so this
 * function deliberately does not attempt it. Reported as a NOTE, not a
 * failure: a pointless alias is dead weight, not a correctness violation.
 */
export function checkPointlessAliases(pack, where) {
  const notes = [];
  for (const term of pack.terminology ?? []) {
    for (const alias of term.audience_aliases ?? []) {
      if (alias.surface_form === term.canonical || (term.rendering && alias.surface_form === term.rendering)) {
        notes.push(issue(CODES.POINTLESS_ALIAS, `${where}:${term.id}`,
          `audience_alias surface_form "${alias.surface_form}" for audience "${alias.audience}" is identical to ${alias.surface_form === term.canonical ? 'canonical' : 'rendering'} — the alias changes nothing`));
      }
    }
  }
  return notes;
}

// --- top-level ------------------------------------------------------------

/**
 * Validate one parsed pack. Returns { issues, notes } — issues fail the run,
 * notes are reported but do not (following scripts/validate-profiles.mjs's
 * distinction).
 */
export function validatePack(pack, filePath, opts = {}) {
  const {
    schema = loadSchema(),
    axis = getLanguageAxis(),
    routingLayerIds = loadRoutingLayerIds(),
    contentIds = new Set(Object.keys(loadAxisProfiles('content'))),
    audienceIds = new Set(Object.keys(loadAxisProfiles('audience'))),
    evaluationsDir = REGISTRY_PATHS.evaluationsDir,
    feedbackDir = REGISTRY_PATHS.feedbackDir,
    evaluationFiles = listEvaluationFiles(evaluationsDir),
  } = opts;

  const where = pack?.pack_id ?? basename(filePath);
  const issues = [];
  const notes = [];

  issues.push(...checkSchema(pack, schema, where));
  issues.push(...checkFilenameAndId(pack, filePath, axis));
  issues.push(...checkDocRef(pack, where));
  issues.push(...checkLayers(pack, where, routingLayerIds));
  issues.push(...checkNormativeAuthority(pack, where));
  issues.push(...checkUnbackedMechanicalClaim(pack, where));

  const promotion = checkSharedPromotion(pack, where);
  issues.push(...promotion.issues);
  notes.push(...promotion.notes);

  issues.push(...checkGenreAudienceOrthogonality(pack, where));
  issues.push(...checkScopeIdsResolve(pack, where, { contentIds, audienceIds }));

  const holdout = checkHoldoutLeakage(pack, where, { evaluationFiles, evaluationsDir, feedbackDir });
  issues.push(...holdout.issues);
  notes.push(...holdout.notes);

  notes.push(...checkPointlessAliases(pack, where));

  return { issues, notes };
}

export function validatePackFile(filePath, opts = {}) {
  let pack;
  try {
    pack = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { issues: [issue(CODES.PARSE, filePath, `unparseable language pack: ${err.message}`)], notes: [] };
  }
  return validatePack(pack, filePath, opts);
}

export function validateAll({ axis = getLanguageAxis() } = {}) {
  const routingLayerIds = loadRoutingLayerIds();
  const schema = loadSchema();
  const contentIds = new Set(Object.keys(loadAxisProfiles('content')));
  const audienceIds = new Set(Object.keys(loadAxisProfiles('audience')));
  const evaluationFiles = listEvaluationFiles();

  const files = listPackFiles(axis);
  const issues = [];
  const notes = [];
  let ruleCount = 0;

  for (const file of files) {
    const result = validatePackFile(file, { schema, axis, routingLayerIds, contentIds, audienceIds, evaluationFiles });
    issues.push(...result.issues.map((i) => ({ ...i, file })));
    notes.push(...result.notes.map((n) => ({ ...n, file })));
    try {
      const pack = JSON.parse(readFileSync(file, 'utf8'));
      ruleCount += Array.isArray(pack.rules) ? pack.rules.length : 0;
    } catch {
      // parse failure already reported above
    }
  }

  return { files, issues, notes, ruleCount };
}
