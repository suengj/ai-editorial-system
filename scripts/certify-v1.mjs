#!/usr/bin/env node
/**
 * certify-v1 — AES-P6.4 (SUE-462).
 *
 * Runs every gate and maps the results onto the V1 certification matrix.
 *
 * Items that cannot be certified from this repository are reported BLOCKED
 * with the reason, never quietly passed. A certification that reports only
 * what it can prove is worth more than one that reports ten green rows.
 *
 * Exit code reflects the checkable items only; blocked items are surfaced for
 * a human to resolve.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const run = (script) => {
  try {
    execFileSync('npm', ['run', '--silent', script], { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

const has = (...paths) => paths.every((p) => existsSync(resolve(ROOT, p)));
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

/** Every gate, run once. */
const gates = {
  'validate:boundary': run('validate:boundary'),
  'validate:source': run('validate:source'),
  'validate:article': run('validate:article'),
  'validate:rights': run('validate:rights'),
  'validate:skills': run('validate:skills'),
  'validate:plan': run('validate:plan'),
  'validate:presentation': run('validate:presentation'),
  'validate:hitl': run('validate:hitl'),
  'poc:check': run('poc:check'),
  'handoff:check': run('handoff:check'),
  eval: run('eval'),
  matrix: run('matrix'),
  'test:boundary': run('test:boundary'),
  'test:source': run('test:source'),
  'test:article': run('test:article'),
  'test:rights': run('test:rights'),
  'test:gates': run('test:gates'),
  'test:profiles': run('test:profiles'),
  'test:skills': run('test:skills'),
  'test:pipeline': run('test:pipeline'),
  'test:eval': run('test:eval'),
  'test:poc': run('test:poc'),
  'test:hitl': run('test:hitl'),
  'test:matrix': run('test:matrix'),
  'test:handoff': run('test:handoff'),
  'test:presentation': run('test:presentation'),
};

const all = (...names) => names.every((n) => gates[n]);

const MATRIX = [
  {
    id: 1,
    name: 'Public repo boundary, license, and public-safety checks',
    status: () => (all('validate:boundary', 'test:boundary') && has('LICENSE', 'LICENSE-DOCS', 'NOTICE', 'SECURITY.md') ? 'PASS' : 'FAIL'),
    evidence: 'validate:boundary, test:boundary, LICENSE + LICENSE-DOCS + NOTICE + SECURITY.md',
  },
  {
    id: 2,
    name: 'Source, Article, and Artifact contracts validated with examples',
    status: () => (all('validate:source', 'validate:article', 'validate:plan', 'test:source', 'test:article') ? 'PASS' : 'FAIL'),
    evidence: 'validate:source, validate:article, validate:plan + mutation regressions',
  },
  {
    id: 3,
    name: 'Constitution, voice, and content profiles present and referenced by Skills',
    status: () => {
      if (!has('editorial/constitution.md', 'editorial/voice.md', 'editorial/profiles')) return 'FAIL';
      // A Skill that does not defer to the constitution is not governed by it.
      const skills = ['frame-article', 'write-article', 'verify-claims', 'editorial-polish', 'plan-artifacts'];
      const governed = skills.every((s) => /editorial\/constitution\.md/.test(read(`skills/${s}/SKILL.md`)));
      return governed && all('validate:skills', 'test:profiles') ? 'PASS' : 'FAIL';
    },
    evidence: 'editorial/, all five Skills declare governed_by: editorial/constitution.md',
  },
  {
    id: 4,
    name: 'Frame / write / verify / polish / artifact-planning Skills exercised',
    status: () => (all('validate:skills', 'test:skills', 'test:pipeline') ? 'PASS' : 'FAIL'),
    evidence: 'test:pipeline — closed authority across the set, aligned handoffs',
  },
  {
    id: 5,
    name: 'Golden + negative fixtures and regression rubric exercised; SUE-417 improved',
    status: () => (all('eval', 'test:eval') ? 'PASS' : 'FAIL'),
    evidence: 'eval — calibration N-01 → G-01 MATERIALLY BETTER; regression G-01 → N-03 caught',
    caveat: 'Fixture-based. A live P03 rerun judged by the owner is still outstanding (SUE-417, SUE-458).',
  },
  {
    id: 6,
    name: 'Cross-source HITL matrix: YouTube, market/research, GitHub project',
    status: () => (all('matrix', 'test:matrix', 'validate:hitl', 'test:hitl') ? 'PASS' : 'FAIL'),
    evidence: 'matrix — 3 source classes, 2 content-type profiles, one NO_ARTICLE',
    caveat: 'Structurally faithful cases, not live corpora. Real Drive content cannot enter a public repo.',
  },
  {
    id: 7,
    name: 'Brief + evidence visual + deck PoCs have valid lineage and stale behaviour',
    status: () => (all('poc:check', 'test:poc') ? 'PASS' : 'FAIL'),
    evidence: 'poc:check — all artifacts regenerate byte-identically; lineage and staleness tested',
    caveat: 'Generators are deterministic compilers, not writers. The model-in-the-slot case is untested.',
  },
  {
    id: 8,
    name: 'SUE-403 final Markdown handoff preserves Drive provenance and draft safety',
    status: () => 'BLOCKED',
    evidence: 'Handoff contract and receipt exist and are validated (validate:handoff).',
    blocker: 'SUE-403 requires writing a final article to Drive and opening a suengj-com change. Both are owner actions on private/live systems and were not performed.',
  },
  {
    id: 9,
    name: 'suengj.com artifact integration preserves canonical and AEO behaviour',
    status: () => (all('handoff:check', 'test:handoff') ? 'PASS (contract side)' : 'FAIL'),
    evidence: 'handoff:check; suengj-com branch feature/aes-p62-semantic-surfaces passes content contract, topics, AEO build, publication regression, and P03 fixture with byte-identical article markup',
    caveat: 'The suengj-com change is on a branch, unmerged and undeployed, and has had no visual review.',
  },
  {
    id: 10,
    name: 'Media storage and audio/video roadmap decisions are explicit',
    status: () => (has('docs/architecture/MEDIA-STORAGE.md', 'docs/architecture/AUDIO-VIDEO-ROADMAP.md') ? 'PASS' : 'FAIL'),
    evidence: 'MEDIA-STORAGE.md (measured, 10,104 bytes/article → Git); AUDIO-VIDEO-ROADMAP.md (audio defer, video reject-for-now)',
  },
];

console.log('AI Editorial System — V1 certification\n');

const failedGates = Object.entries(gates).filter(([, ok]) => !ok).map(([n]) => n);
console.log(`gates: ${Object.keys(gates).length - failedGates.length}/${Object.keys(gates).length} passing`);
if (failedGates.length > 0) console.log(`failing: ${failedGates.join(', ')}`);
console.log('');

let failed = 0;
let blocked = 0;
for (const item of MATRIX) {
  const status = item.status();
  if (status === 'FAIL') failed += 1;
  if (status === 'BLOCKED') blocked += 1;
  console.log(`${String(item.id).padStart(2)}. ${status.padEnd(18)} ${item.name}`);
  console.log(`    evidence: ${item.evidence}`);
  if (item.caveat) console.log(`    caveat:   ${item.caveat}`);
  if (item.blocker) console.log(`    blocker:  ${item.blocker}`);
}

console.log('');
console.log(`certifiable items: ${MATRIX.length - blocked - failed} pass, ${failed} fail, ${blocked} blocked`);
console.log(failed === 0
  ? '\ncertification: PASS on every checkable item'
  : `\ncertification: FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
