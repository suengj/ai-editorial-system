/**
 * Editorial Package core — AES-V2.9 (SUE-567).
 *
 * Structural conformance to editorial-package.schema.json plus the
 * cross-field invariants json-schema-lite cannot express. See
 * schemas/EDITORIAL-PACKAGE-CONTRACT.md.
 *
 * Fail-closed, in the house style of article-contract-core.mjs: nothing here
 * can pass a package that duplicates the Article claim model, carries a
 * source body, or asserts synthesis with no recorded uncertainty.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '../..');
export const SCHEMA_PATH = resolve(REPO_ROOT, 'schemas/editorial-package.schema.json');

export const loadSchema = (p = SCHEMA_PATH) => JSON.parse(readFileSync(p, 'utf8'));

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  UNCERTAINTY_EMPTY: 'uncertainty-empty',
  ARTICLE_VS_INLINE: 'article-vs-inline',
  NO_CONTENT: 'no-article-no-content',
  CLAIMS_HASH_MISMATCH: 'claims-hash-mismatch',
  PACKAGE_HASH_MISMATCH: 'package-hash-mismatch',
  NO_TARGET_SURFACE: 'no-target-surface',
  PROFILE_MISSING: 'transformation-profile-missing',
});

/** Transformations that assert a new argument and therefore must record what remains unknown. */
export const SYNTHESIS_TRANSFORMATIONS = new Set(['synthesize', 'original']);

const issue = (code, where, message) => ({ code, where, message });

export const digest = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/**
 * sha256 over the ordered verified-claim set (id, text, status) — the same
 * convention documented in ARTICLE-ARTIFACT-CONTRACT.md for claims_hash.
 */
export function computeClaimsHash(claims) {
  if (!claims || claims.length === 0) return null;
  const ordered = claims
    .map((c) => ({ claim_id: c.claim_id, text: c.text, status: c.status }))
    .sort((a, b) => (a.claim_id < b.claim_id ? -1 : a.claim_id > b.claim_id ? 1 : 0));
  return digest(JSON.stringify(ordered));
}

/**
 * sha256 over this package's own normalised content, excluding the lineage
 * block itself (a hash cannot include its own container).
 */
export function computePackageHash(pkg) {
  const { lineage: _omitted, ...rest } = pkg ?? {};
  return digest(JSON.stringify(rest, Object.keys(rest).sort()));
}

/** Structural validation only. */
export function validatePackage(pkg, schema = loadSchema()) {
  if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) {
    return [issue(CODES.SCHEMA, '$', 'package must be a JSON object')];
  }
  return validate(pkg, schema).map((e) => issue(CODES.SCHEMA, e.path, e.message));
}

/**
 * Structural validation plus the invariants the schema cannot express.
 * `opts.checkProfileRefs` (default true) resolves transformation.profile_ref
 * against the filesystem; missing files are reported as SKIP-worthy, not
 * FAIL, by the caller (see validate-editorial-package.mjs) — this function
 * returns them tagged PROFILE_MISSING so the caller can decide.
 */
export function validatePackageBundle(pkg, schema = loadSchema(), opts = {}) {
  const { checkProfileRefs = true } = opts;
  const issues = validatePackage(pkg, schema);
  if (issues.some((i) => i.code === CODES.SCHEMA && i.path === '$')) return issues;
  if (typeof pkg !== 'object' || pkg === null) return issues;

  const where = pkg.package_id ?? '(unknown package)';

  // --- uncertainty must be non-empty for synthesize/original -------------
  if (SYNTHESIS_TRANSFORMATIONS.has(pkg.transformation?.value) && (pkg.uncertainty ?? []).length === 0) {
    issues.push(issue(
      CODES.UNCERTAINTY_EMPTY, where,
      `transformation "${pkg.transformation?.value}" asserts a new argument; uncertainty may not be empty`,
    ));
  }

  // --- article_ref vs inline content: cite, don't copy --------------------
  if (pkg.article_ref) {
    if (pkg.thesis !== null) {
      issues.push(issue(CODES.ARTICLE_VS_INLINE, where,
        'article_ref is set; thesis belongs to the article frame and must be null on the package'));
    }
    if ((pkg.key_concepts ?? []).length > 0) {
      issues.push(issue(CODES.ARTICLE_VS_INLINE, where,
        'article_ref is set; key_concepts duplicate article framing and must be empty'));
    }
    if ((pkg.verified_claims ?? []).length > 0) {
      issues.push(issue(CODES.ARTICLE_VS_INLINE, where,
        'article_ref is set; verified_claims duplicate the article\'s claim set and must be empty — cite the article instead'));
    }
    if (pkg.lineage?.claims_hash !== null && pkg.lineage?.claims_hash !== pkg.article_ref.claims_hash) {
      issues.push(issue(CODES.CLAIMS_HASH_MISMATCH, where,
        'lineage.claims_hash must equal article_ref.claims_hash when article_ref is set — the package does not compute a second claims_hash for claims it does not hold'));
    }
  } else {
    // No article to cite: synthesize/original must carry their own content.
    if (SYNTHESIS_TRANSFORMATIONS.has(pkg.transformation?.value)) {
      if (pkg.thesis === null || pkg.summary === null) {
        issues.push(issue(CODES.NO_CONTENT, where,
          `transformation "${pkg.transformation?.value}" with no article_ref must carry its own thesis and summary`));
      }
    }
    const computedClaimsHash = computeClaimsHash(pkg.verified_claims);
    if (pkg.lineage?.claims_hash !== computedClaimsHash) {
      issues.push(issue(CODES.CLAIMS_HASH_MISMATCH, where,
        `lineage.claims_hash does not match the recomputed hash of verified_claims (expected ${computedClaimsHash})`));
    }
  }

  // --- package_hash is computed, never asserted by hand -------------------
  const computedPackageHash = computePackageHash(pkg);
  if (pkg.lineage?.package_hash !== computedPackageHash) {
    issues.push(issue(CODES.PACKAGE_HASH_MISMATCH, where,
      `lineage.package_hash does not match the recomputed hash of the package content (expected ${computedPackageHash})`));
  }

  // --- at least one target surface ----------------------------------------
  if ((pkg.target_surfaces ?? []).length === 0) {
    issues.push(issue(CODES.NO_TARGET_SURFACE, where, 'target_surfaces must name at least one surface'));
  }

  // --- transformation profile resolves ------------------------------------
  if (checkProfileRefs && pkg.transformation?.profile_ref) {
    const abs = resolve(REPO_ROOT, pkg.transformation.profile_ref);
    if (!existsSync(abs)) {
      issues.push(issue(CODES.PROFILE_MISSING, where,
        `transformation.profile_ref "${pkg.transformation.profile_ref}" does not resolve to a file on disk`));
    }
  }

  return issues;
}

export function validatePackageFile(path, schema = loadSchema(), opts = {}) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    return [issue(CODES.PARSE, path, `cannot read file: ${err.message}`)];
  }
  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch (err) {
    return [issue(CODES.PARSE, path, `invalid JSON: ${err.message}`)];
  }
  return validatePackageBundle(pkg, schema, opts);
}
