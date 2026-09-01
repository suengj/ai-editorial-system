/**
 * Source contract core — AES-P0.2 (SUE-435).
 *
 * Structural conformance to schemas/source.schema.json plus the cross-field
 * invariants the schema cannot express. See schemas/SOURCE-CONTRACT.md.
 *
 * Fail-closed: an unparseable manifest is a failure, never an empty pass.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = resolve(HERE, '../../schemas/source.schema.json');

export function loadSchema(path = SCHEMA_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export const CODES = Object.freeze({
  SCHEMA: 'schema',
  PARSE: 'parse',
  ORIGIN_REF_SHAPE: 'origin-ref-shape',
  ID_PREFIX: 'source-id-prefix',
  ID_DUPLICATE: 'source-id-duplicate',
  IDENTITY_DRIFT: 'identity-drift',
  AUTHORITY: 'disposition-authority',
  PUBLICATION_VOCAB: 'publication-vocabulary',
  SUPERSEDE_LINK: 'supersede-link',
  DUPLICATE_LINK: 'duplicate-link',
  USED_BY_STATE: 'used-by-state',
  DATE_ORDER: 'date-order',
});

/** Required keys of `origin_ref`, keyed by `origin`. */
const ORIGIN_REF_SHAPE = {
  google_drive: { required: ['file_id'], optional: ['path_hint'] },
  github: { required: ['repo', 'ref'], optional: ['path'] },
  web: { required: ['url'], optional: [] },
  local: { required: ['path'], optional: [] },
};

const ORIGIN_PREFIX = {
  google_drive: 'drive',
  github: 'github',
  web: 'web',
  local: 'local',
};

/** Terms that belong to article publication and must never appear here. */
const FORBIDDEN_DISPOSITIONS = ['published', 'approved', 'draft', 'live'];

const HUMAN_ONLY_DISPOSITIONS = new Set(['archived', 'rejected']);
const USED_BY_ALLOWED = new Set(['used', 'superseded', 'archived']);

function issue(code, where, message) {
  return { code, where, message };
}

/** Validate a parsed manifest object. Returns an array of issues. */
export function validateManifest(manifest, schema = loadSchema()) {
  const issues = [];

  for (const e of validate(manifest, schema)) {
    issues.push(issue(CODES.SCHEMA, e.path, e.message));
  }

  const sources = Array.isArray(manifest?.sources) ? manifest.sources : [];
  const byId = new Map();
  const driveIdToSourceId = new Map();

  for (const [i, src] of sources.entries()) {
    const where = src?.source_id ?? `sources[${i}]`;

    // --- publication vocabulary must never leak into source lifecycle ---
    if (FORBIDDEN_DISPOSITIONS.includes(src?.disposition)) {
      issues.push(issue(
        CODES.PUBLICATION_VOCAB, where,
        `disposition "${src.disposition}" is publication vocabulary; source lifecycle must not imply approval or publication`,
      ));
    }

    // --- identity uniqueness ---
    if (typeof src?.source_id === 'string') {
      if (byId.has(src.source_id)) {
        issues.push(issue(CODES.ID_DUPLICATE, where, 'duplicate source_id in manifest'));
      } else {
        byId.set(src.source_id, src);
      }
    }

    // --- origin_ref shape and id prefix ---
    const shape = ORIGIN_REF_SHAPE[src?.origin];
    if (shape) {
      const ref = src.origin_ref ?? {};
      for (const key of shape.required) {
        if (!(key in ref)) {
          issues.push(issue(CODES.ORIGIN_REF_SHAPE, where, `origin "${src.origin}" requires origin_ref.${key}`));
        }
      }
      const allowed = new Set([...shape.required, ...shape.optional]);
      for (const key of Object.keys(ref)) {
        if (!allowed.has(key)) {
          issues.push(issue(CODES.ORIGIN_REF_SHAPE, where, `origin_ref.${key} is not valid for origin "${src.origin}"`));
        }
      }

      const prefix = `src:${ORIGIN_PREFIX[src.origin]}:`;
      if (typeof src.source_id === 'string' && !src.source_id.startsWith(prefix)) {
        issues.push(issue(CODES.ID_PREFIX, where, `source_id must start with "${prefix}" for origin "${src.origin}"`));
      }

      // Rename/move must not create a second identity for one Drive file.
      if (src.origin === 'google_drive' && ref.file_id) {
        const seen = driveIdToSourceId.get(ref.file_id);
        if (seen && seen !== src.source_id) {
          issues.push(issue(
            CODES.IDENTITY_DRIFT, where,
            `Drive file ${ref.file_id} already has identity ${seen}; identity must survive rename and move`,
          ));
        } else {
          driveIdToSourceId.set(ref.file_id, src.source_id);
        }
      }
    }

    // --- authority ---
    if (HUMAN_ONLY_DISPOSITIONS.has(src?.disposition) && src?.disposition_authority !== 'human') {
      issues.push(issue(
        CODES.AUTHORITY, where,
        `disposition "${src.disposition}" requires disposition_authority "human"; AI may recommend but not perform Drive housekeeping`,
      ));
    }

    // --- used_by consistency ---
    const usedBy = src?.used_by ?? [];
    if (usedBy.length > 0 && !USED_BY_ALLOWED.has(src?.disposition)) {
      issues.push(issue(
        CODES.USED_BY_STATE, where,
        `used_by is non-empty but disposition is "${src?.disposition}"; expected one of ${[...USED_BY_ALLOWED].join(', ')}`,
      ));
    }

    // --- date separation ---
    const created = src?.source_created_at;
    const ingested = src?.ingested_at;
    const observed = src?.content_observed_at;
    if (typeof created === 'string' && typeof ingested === 'string' && created > ingested.slice(0, 10)) {
      issues.push(issue(CODES.DATE_ORDER, where, 'source_created_at is after ingested_at'));
    }
    if (typeof ingested === 'string' && typeof observed === 'string' && Date.parse(observed) < Date.parse(ingested)) {
      issues.push(issue(CODES.DATE_ORDER, where, 'content_observed_at is before ingested_at'));
    }
  }

  // --- link resolution (second pass: needs the full index) ---
  for (const [i, src] of sources.entries()) {
    const where = src?.source_id ?? `sources[${i}]`;

    if (src?.disposition === 'superseded' && !src?.superseded_by) {
      issues.push(issue(CODES.SUPERSEDE_LINK, where, 'disposition "superseded" requires superseded_by'));
    }
    for (const key of ['superseded_by', 'supersedes']) {
      if (src?.[key] && !byId.has(src[key])) {
        issues.push(issue(CODES.SUPERSEDE_LINK, where, `${key} "${src[key]}" does not resolve in this manifest`));
      }
    }

    if (src?.duplicate_of) {
      const target = byId.get(src.duplicate_of);
      if (!target) {
        issues.push(issue(CODES.DUPLICATE_LINK, where, `duplicate_of "${src.duplicate_of}" does not resolve`));
      } else if (target.content_hash?.value !== src.content_hash?.value) {
        issues.push(issue(
          CODES.DUPLICATE_LINK, where,
          'duplicate_of target has a different content_hash; these are distinct sources, not duplicates',
        ));
      }
    }
  }

  return issues;
}

/** Read and validate a manifest file. Parse failure is a reported issue. */
export function validateManifestFile(path, schema = loadSchema()) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable manifest: ${err.message}`)];
  }
  return validateManifest(manifest, schema);
}
