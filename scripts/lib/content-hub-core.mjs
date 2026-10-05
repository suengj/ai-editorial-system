/** Static content-hub registry validation and alias lookup (SUE-1300). */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from './yaml-lite.mjs';
import { validate } from './json-schema-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = resolve(HERE, '../../schemas/content-hub.schema.json');
export const EXAMPLE_PATH = resolve(HERE, '../../schemas/content-hub.example.yaml');
export const loadSchema = (path = SCHEMA_PATH) => JSON.parse(readFileSync(path, 'utf8'));

export const CODES = Object.freeze({
  PARSE: 'parse', SCHEMA: 'schema', DUPLICATE_ALIAS: 'duplicate-alias',
  TAXONOMY: 'taxonomy', ALIAS_MISSING: 'alias-missing', PRODUCER_UNKNOWN: 'producer-unknown',
  DESTINATION_MISSING: 'destination-missing',
});

const TOPIC_IDS = [
  'ai_tech', 'science_technology', 'investment_real_estate', 'education',
  'humanities_society_philosophy',
];
const issue = (code, where, message) => ({ code, where, message });

export function validateHub(hub, schema = loadSchema()) {
  const issues = validate(hub, schema).map((e) => issue(CODES.SCHEMA, e.path, e.message));
  const aliases = new Set();
  for (const category of ['sources', 'producers', 'destinations']) {
    for (const [index, entry] of (Array.isArray(hub?.[category]) ? hub[category] : []).entries()) {
      if (typeof entry?.alias !== 'string') continue;
      if (aliases.has(entry.alias)) issues.push(issue(CODES.DUPLICATE_ALIAS, `${category}[${index}].alias`, `alias "${entry.alias}" is already registered`));
      aliases.add(entry.alias);
    }
  }
  const topics = Array.isArray(hub?.taxonomy?.topics) ? hub.taxonomy.topics : [];
  const ids = topics.map((topic) => topic?.id);
  if (TOPIC_IDS.some((id) => !ids.includes(id)) || new Set(ids).size !== TOPIC_IDS.length || ids.length !== TOPIC_IDS.length) {
    issues.push(issue(CODES.TAXONOMY, 'taxonomy.topics', `taxonomy must contain each of the five topic ids exactly once: ${TOPIC_IDS.join(', ')}`));
  }
  if (hub?.taxonomy?.score_contract && /(?:must|should|require[sd]?|constrain(?:ed|s)?)\s+(?:to\s+)?sum\s*(?:to|=)\s*100/i.test(hub.taxonomy.score_contract)) {
    issues.push(issue(CODES.TAXONOMY, 'taxonomy.score_contract', 'topic relevance scores are independent and must not be constrained to sum to 100'));
  }
  return issues;
}

export function parseHub(text) { return parseYaml(text); }

export function validateHubFile(path, schema = loadSchema()) {
  try { return validateHub(parseHub(readFileSync(path, 'utf8')), schema); }
  catch (err) { return [issue(CODES.PARSE, path, `unparseable YAML: ${err.message}`)]; }
}

/** Resolve configured aliases; an explicitly marked optional source may be absent. */
export function resolveSelection(hub, { sourceAliases = [], optionalSourceAliases = [], destinationAlias, destinationOverride } = {}) {
  const issues = [];
  const sources = [];
  const sourceIndex = new Map((hub?.sources ?? []).map((entry) => [entry.alias, entry]));
  const optional = new Set(optionalSourceAliases);
  for (const alias of sourceAliases) {
    const entry = sourceIndex.get(alias);
    if (entry) sources.push(entry);
    else if (!optional.has(alias)) issues.push(issue(CODES.ALIAS_MISSING, alias, `source alias "${alias}" does not resolve`));
  }
  const selectedDestination = destinationOverride ?? destinationAlias;
  const destination = (hub?.destinations ?? []).find((entry) => entry.alias === selectedDestination);
  if (selectedDestination && !destination) issues.push(issue(CODES.DESTINATION_MISSING, selectedDestination, `destination alias "${selectedDestination}" does not resolve`));
  return { sources, destination: destination ?? null, issues };
}

/** Unknown producers cannot initiate writes; explicit-manifest read/preview remains available. */
export function producerAccess(hub, producerAlias, mode, explicitManifest = false) {
  const known = (hub?.producers ?? []).some((entry) => entry.alias === producerAlias);
  if (mode === 'write') return { allowed: known, code: known ? null : CODES.PRODUCER_UNKNOWN };
  if ((mode === 'read' || mode === 'preview') && explicitManifest) return { allowed: true, code: null };
  return { allowed: known, code: known ? null : CODES.PRODUCER_UNKNOWN };
}

/** Check a topic-score record independently of the hub registry. */
export function validateTopicScores(value, taxonomy = { taxonomy_version: '1.0.0' }) {
  const issues = [];
  if (!value || typeof value !== 'object' || value.taxonomy_version !== taxonomy.taxonomy_version || !value.scores || typeof value.scores !== 'object') {
    return [issue(CODES.TAXONOMY, 'scores', 'scores require the active taxonomy_version and a scores object')];
  }
  for (const id of TOPIC_IDS) {
    const score = value.scores[id];
    if (!Number.isInteger(score) || score < 0 || score > 100) issues.push(issue(CODES.TAXONOMY, `scores.${id}`, 'score must be an independent integer from 0 through 100'));
  }
  for (const key of Object.keys(value.scores)) {
    if (![...TOPIC_IDS, 'other_unknown'].includes(key)) issues.push(issue(CODES.TAXONOMY, `scores.${key}`, 'unknown taxonomy score key'));
    const score = value.scores[key];
    if (!Number.isInteger(score) || score < 0 || score > 100) issues.push(issue(CODES.TAXONOMY, `scores.${key}`, 'score must be an independent integer from 0 through 100'));
  }
  return issues;
}
