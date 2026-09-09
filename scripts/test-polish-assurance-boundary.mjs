/** Synthetic boundary regression. No model calls, publication or runtime changes. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assessPolish } from './lib/polish-invariants.mjs';

const fixtureURL = new URL('../evals/prompt-migration/polish-assurance-boundary.json', import.meta.url);
const moduleURL = new URL('./lib/polish-invariants.mjs', import.meta.url);
const fixtureBytes = readFileSync(fixtureURL);
const moduleBytes = readFileSync(moduleURL);
const fixture = JSON.parse(fixtureBytes.toString('utf8'));
const gitBlob = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
assert.equal(fixture.schema_version, 1);
assert.equal(fixture.cases.length, 5);
const ids = new Set();
const rows = fixture.cases.map((c) => {
  assert.equal(typeof c.id, 'string');
  assert.ok(!ids.has(c.id), `duplicate case: ${c.id}`);
  ids.add(c.id);
  assert.equal(typeof c.before, 'string');
  assert.equal(typeof c.after, 'string');
  assert.equal(typeof c.expected_mechanical_ok, 'boolean');
  assert.equal(typeof c.expected_changed, 'boolean');
  assert.ok(['KEEP', 'REJECT'].includes(c.semantic_fixture_disposition));
  assert.ok(typeof c.reason === 'string' && c.reason.length > 0);
  const actual = assessPolish(c.before, c.after);
  assert.equal(actual.ok, c.expected_mechanical_ok, `${c.id}: mechanical result changed; review the boundary deliberately`);
  assert.equal(actual.changed, c.expected_changed, `${c.id}: changed flag`);
  return { id: c.id, mechanical_ok: actual.ok, changed: actual.changed,
    semantic_fixture_disposition: c.semantic_fixture_disposition, violations: actual.violations };
});
console.log(JSON.stringify({
  result: 'PASS',
  meaning: 'Five expected mechanical boundary cases reproduced; NOT semantic approval',
  node_version: process.version,
  module_git_blob: gitBlob(moduleBytes),
  fixture_git_blob: gitBlob(fixtureBytes),
  baseline_module_git_blob: fixture.baseline_module_git_blob,
  semantic_verdict_source: 'explicit synthetic fixture labels, not a model evaluator',
  rows,
  limitations: ['Not a full repository test run', 'Not a Legacy/Thin/Hybrid model experiment',
    'Not a production defect rate', 'Does not replace the existing semantic polish review or human approval'],
}, null, 2));
