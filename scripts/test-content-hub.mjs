#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CODES, EXAMPLE_PATH, loadSchema, parseHub, producerAccess, resolveSelection,
  validateHub, validateHubFile, validateTopicScores,
} from './lib/content-hub-core.mjs';
import { validatePackage, loadSchema as loadPackageSchema } from './lib/editorial-package-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
const fixture = readJson('scripts/fixtures/content-hub/source-selection.json');
const hub = parseHub(readFileSync(EXAMPLE_PATH, 'utf8'));
const clone = () => JSON.parse(JSON.stringify(hub));
let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const codes = (value) => validateHub(value, loadSchema()).map((i) => i.code);

console.log('static hub contract');
check('public YAML example validates from disk', validateHubFile(EXAMPLE_PATH).length === 0);
check('all five taxonomy labels are registered', hub.taxonomy.topics.length === 5 && codes(hub).length === 0);
check('operational bootstrap needs only root folder id and relative path', hub.bootstrap.root_folder_id && hub.bootstrap.hub_path && !hub.bootstrap.hub_file_id);

console.log('\nalias and destination resolution');
{
  const result = resolveSelection(hub, {
    sourceAliases: fixture.source_aliases,
    optionalSourceAliases: fixture.optional_source_aliases,
    destinationAlias: fixture.destination_alias,
    destinationOverride: fixture.destination_override,
  });
  check('known source alias resolves to P03 folder', result.sources[0]?.alias === 'p03' && result.sources[0]?.drive_folder_id === '1777fpf3nO2-4ISKAt_3D1ipiwgJddYY-');
  check('missing required source alias is rejected', resolveSelection(hub, { sourceAliases: ['missing'] }).issues.some((i) => i.code === CODES.ALIAS_MISSING));
  check('unresolved optional source is tolerated', result.issues.length === 0 && result.sources.length === 1);
  check('explicit destination override wins over configured default', result.destination?.alias === 'article');
  const handoff = readJson(fixture.handoff_fixture);
  const packageIssues = validatePackage(handoff, loadPackageSchema());
  check('source selection fixture points to a valid existing AES EditorialPackage handoff', result.sources.length === 1 && packageIssues.length === 0, JSON.stringify(packageIssues));
}

console.log('\nregistry invariants');
{
  const duplicate = clone();
  duplicate.destinations[0].alias = duplicate.sources[0].alias;
  check('duplicate aliases across registry sections are rejected', codes(duplicate).includes(CODES.DUPLICATE_ALIAS));
  check('hub does not store operational files, publication history, or ready/approved status', !/"(?:files|publish_history|ready_status|approved_status)"/.test(JSON.stringify(hub)));
}

console.log('\nproducer authority and provenance');
{
  check('unknown producer cannot initiate a write', !producerAccess(hub, 'unknown-writer', 'write').allowed);
  check('unknown producer does not block explicit manifest read', producerAccess(hub, 'unknown-writer', 'read', true).allowed);
  check('unknown producer does not block explicit manifest preview', producerAccess(hub, 'unknown-writer', 'preview', true).allowed);
  check('split producer aliases retain the old producer_id on the hub registry entry', hub.producers.find((entry) => entry.alias === 'p03-summary')?.producer_id === 'p03');
  const provenance = readJson('scripts/fixtures/content-hub/producer-split-provenance.json');
  check('producer split retains the old producer_id as provenance', provenance.producer_id === 'p03' && provenance.producer_aliases.includes('p03-summary') && provenance.producer_aliases.includes('p03-transcript'));
}

console.log('\ntopic relevance scoring');
{
  const scores = { taxonomy_version: hub.taxonomy.taxonomy_version, scores: Object.fromEntries(hub.taxonomy.topics.map((t) => [t.id, 100])) };
  check('five independent high scores pass without a sum-to-100 constraint', validateTopicScores(scores, hub.taxonomy).length === 0);
  check('other/unknown score is allowed', validateTopicScores({ ...scores, scores: { ...scores.scores, other_unknown: 70 } }, hub.taxonomy).length === 0);
  check('out-of-range score is rejected', validateTopicScores({ ...scores, scores: { ...scores.scores, education: 101 } }, hub.taxonomy).some((i) => i.where === 'scores.education'));
  check('stale taxonomy version is rejected', validateTopicScores({ ...scores, taxonomy_version: '0.9.0' }, hub.taxonomy).length > 0);
}

console.log(failures === 0 ? '\ncontent-hub regression: PASS' : `\ncontent-hub regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
