/**
 * Rights core — AES-P0.4 (SUE-437).
 *
 * Validates the reference/benchmark catalog against
 * schemas/reference-catalog.schema.json plus the rights invariants in
 * editorial/RIGHTS-AND-PROVENANCE.md.
 *
 * The governing rule is fail-to-reference: when rights are unclear, the entry
 * must be link-only. Nothing is copied on an assumption.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = resolve(HERE, '../../schemas/reference-catalog.schema.json');

export const loadSchema = (path = SCHEMA_PATH) => JSON.parse(readFileSync(path, 'utf8'));

export const CODES = Object.freeze({
  SCHEMA: 'schema',
  PARSE: 'parse',
  UNCLEAR_RIGHTS: 'unclear-rights',
  COPY_LICENSE: 'copy-requires-license',
  COPY_ATTRIBUTION: 'copy-requires-attribution',
  COPY_PATH: 'copy-requires-path',
  LINKED_PATH: 'linked-has-local-copy',
  DUPLICATE: 'duplicate-ref-id',
});

const issue = (code, where, message) => ({ code, where, message });

export function validateCatalog(catalog, schema = loadSchema()) {
  const issues = [];

  for (const e of validate(catalog, schema)) {
    issues.push(issue(CODES.SCHEMA, e.path, e.message));
  }

  const seen = new Set();
  for (const [i, entry] of (catalog?.entries ?? []).entries()) {
    const where = entry?.ref_id ?? `entries[${i}]`;

    if (entry?.ref_id) {
      if (seen.has(entry.ref_id)) issues.push(issue(CODES.DUPLICATE, where, 'duplicate ref_id'));
      seen.add(entry.ref_id);
    }

    // Fail-to-reference: unclear rights means link-only, no license claim.
    if (entry?.rights_status === 'unclear') {
      if (entry.copy_status !== 'linked') {
        issues.push(issue(
          CODES.UNCLEAR_RIGHTS, where,
          `rights_status "unclear" forces copy_status "linked", got "${entry.copy_status}"`,
        ));
      }
      if (entry.license !== null && entry.license !== undefined) {
        issues.push(issue(CODES.UNCLEAR_RIGHTS, where, 'rights_status "unclear" cannot name a license'));
      }
      if (entry.license_compatible === true) {
        issues.push(issue(CODES.UNCLEAR_RIGHTS, where, 'rights_status "unclear" cannot assert license_compatible'));
      }
    }

    // Copying requires an identified, compatible license and attribution.
    if (entry?.copy_status === 'copied') {
      if (!entry.license) {
        issues.push(issue(CODES.COPY_LICENSE, where, 'copy_status "copied" requires an identified license'));
      }
      if (entry.license_compatible !== true) {
        issues.push(issue(CODES.COPY_LICENSE, where, 'copy_status "copied" requires license_compatible: true'));
      }
      if (!entry.attribution) {
        issues.push(issue(CODES.COPY_ATTRIBUTION, where, 'copy_status "copied" requires attribution'));
      }
      if (!entry.local_path) {
        issues.push(issue(CODES.COPY_PATH, where, 'copy_status "copied" requires local_path naming what was reproduced'));
      }
    }

    // Quoting still requires attribution.
    if (entry?.copy_status === 'quoted' && !entry.attribution) {
      issues.push(issue(CODES.COPY_ATTRIBUTION, where, 'copy_status "quoted" requires attribution'));
    }

    // A link-only entry must not have a local copy on disk.
    if (entry?.copy_status === 'linked' && entry.local_path) {
      issues.push(issue(CODES.LINKED_PATH, where, 'copy_status "linked" must not carry a local_path; the repository is not a mirror'));
    }
  }

  return issues;
}

export function validateCatalogFile(path, schema = loadSchema()) {
  let catalog;
  try {
    catalog = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable catalog: ${err.message}`)];
  }
  return validateCatalog(catalog, schema);
}
