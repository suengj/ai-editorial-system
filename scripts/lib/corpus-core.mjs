/**
 * Real-output corpus engine — AES-V2.6 (SUE-564).
 *
 * Validates corpus entries against schemas/corpus-entry.schema.json. Canonical
 * content stays in its own SSOT (suengj-com, Drive, GitHub); an entry carries
 * refs, a hash, and evaluation metadata, never a body.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export const SCHEMA_PATH = resolve(ROOT, 'schemas/corpus-entry.schema.json');
export const ENTRIES_DIR = resolve(ROOT, 'evals/real-output-corpus/entries');

export const loadSchema = (p = SCHEMA_PATH) => JSON.parse(readFileSync(p, 'utf8'));

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  ARTICLE_BODY_SUSPECTED: 'article-body-suspected',
  MISSING_ELIGIBILITY_RATIONALE: 'missing-eligibility-rationale',
  ELIGIBILITY_FROM_VERDICT: 'eligibility-implies-inferred-from-verdict',
});

const issue = (code, where, message) => ({ code, where, message });

/**
 * Belt-and-suspenders backstop against a canonical article body slipping in
 * as a string field. additionalProperties: false already rejects an
 * unexpected "body" key outright; this catches a body pasted into a field
 * that does exist, such as `notes`.
 */
const BODY_LENGTH_CEILING = 600;

export function checkNoArticleBody(entry) {
  const issues = [];
  for (const [key, value] of Object.entries(entry)) {
    if (typeof value === 'string' && value.length > BODY_LENGTH_CEILING) {
      issues.push(issue(CODES.ARTICLE_BODY_SUSPECTED, entry.entry_id ?? '<entry>',
        `field "${key}" is ${value.length} characters — long enough to be an article or artifact body rather than evaluation metadata`));
    }
  }
  return issues;
}

export function validateEntry(entry, schema = loadSchema()) {
  const issues = [];
  for (const e of validate(entry, schema)) {
    issues.push(issue(CODES.SCHEMA, entry?.entry_id ?? '<entry>', `${e.path}: ${e.message}`));
  }
  issues.push(...checkNoArticleBody(entry));

  if (entry?.reference_eligible === true && !entry?.reference_eligible_rationale) {
    issues.push(issue(CODES.MISSING_ELIGIBILITY_RATIONALE, entry?.entry_id ?? '<entry>',
      'reference_eligible is true but carries no rationale — published or accepted does not by itself make an output reference-quality'));
  }

  return issues;
}

export function validateEntryFile(path, schema = loadSchema()) {
  let entry;
  try {
    entry = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable corpus entry: ${err.message}`)];
  }
  return validateEntry(entry, schema);
}

export function listEntryFiles(dir = ENTRIES_DIR) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => join(dir, f));
}

export function loadEntries(dir = ENTRIES_DIR) {
  return listEntryFiles(dir).map((p) => JSON.parse(readFileSync(p, 'utf8')));
}
