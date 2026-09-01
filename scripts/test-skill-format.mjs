#!/usr/bin/env node
/**
 * Regression test for the Skill format — AES-P2.1 (SUE-443).
 *
 * The canonical template is the positive fixture. Negatives are written to a
 * temp directory so the repository never carries a deliberately broken Skill.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, REQUIRED_SECTIONS, loadSchema, validateAllSkills, validateSkillDir } from './lib/skill-core.mjs';
import { parseFrontMatter, parseYaml } from './lib/yaml-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TEMPLATE = resolve(ROOT, 'skills/template');

const schema = loadSchema();
let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

/** Copy the template into a temp dir, mutate its SKILL.md, and validate. */
function mutated(name, edit) {
  const root = mkdtempSync(join(tmpdir(), 'aes-skill-'));
  const dir = join(root, name);
  cpSync(TEMPLATE, dir, { recursive: true });
  const file = join(dir, 'SKILL.md');
  writeFileSync(file, edit(readFileSync(file, 'utf8'), dir));
  try {
    return validateSkillDir(dir, schema).map((i) => i.code);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// --- yaml-lite ------------------------------------------------------------
console.log('front matter parsing');
{
  const y = parseYaml('a: 1\nb: [x, y]\nc:\n  d: two words\n  e:\n    - one\nf:\n  - path: p\n    load_when: w\n');
  check('scalars, inline lists, nesting, and lists of maps parse',
    y.a === 1 && y.b.length === 2 && y.c.d === 'two words' && y.c.e[0] === 'one' && y.f[0].load_when === 'w',
    JSON.stringify(y));

  let threw = false;
  try { parseYaml('a: 1\n\tb: 2\n'); } catch { threw = true; }
  check('malformed input throws rather than half-parsing', threw);

  let noFm = false;
  try { parseFrontMatter('# just a heading\n'); } catch { noFm = true; }
  check('a file with no front matter is an error, not an empty object', noFm);
}

// --- positive -------------------------------------------------------------
console.log('canonical template');
{
  const results = validateAllSkills(resolve(ROOT, 'skills'), schema);
  check('at least one Skill exists', results.length >= 1);
  check('every Skill in the repository validates',
    results.every((r) => r.issues.length === 0),
    JSON.stringify(results.filter((r) => r.issues.length)));

  const { data, body } = parseFrontMatter(readFileSync(join(TEMPLATE, 'SKILL.md'), 'utf8'));
  check('the template declares all nine required sections',
    REQUIRED_SECTIONS.every((s) => new RegExp(`^##\\s+${s}$`, 'im').test(body)));
  check('the template denies publication and approval authority',
    data.authority.may_not.some((c) => /publish/i.test(c)) &&
    data.authority.may_not.some((c) => /approv/i.test(c)));
  check('the template defers to the constitution rather than restating it',
    (data.governed_by ?? []).includes('editorial/constitution.md'));
  check('the template demonstrates a conditional reference',
    (data.references ?? []).every((r) => r.path && r.load_when));
}

// --- negatives ------------------------------------------------------------
console.log('structural rules');
{
  check('name must match the directory',
    mutated('other-name', (t) => t).includes(CODES.NAME_MISMATCH));

  check('a missing required section is caught',
    mutated('template', (t) => t.replace('## Invariants', '## Notes')).includes(CODES.MISSING_SECTION));

  check('missing when_not_to_use is caught',
    mutated('template', (t) => t.replace(/^when_not_to_use:.*$/m, '')).includes(CODES.SCHEMA));

  check('a non-semver version is caught',
    mutated('template', (t) => t.replace(/^version: .*$/m, 'version: v1')).includes(CODES.SCHEMA));

  check('an entry point over the line budget is caught',
    mutated('template', (t) => t + '\n\nfiller.'.repeat(600)).includes(CODES.SIZE));

  check('a dangling governed_by path is caught',
    mutated('template', (t) => t.replace('editorial/constitution.md', 'editorial/nope.md'))
      .includes(CODES.DANGLING_REFERENCE));
}

// --- authority ------------------------------------------------------------
console.log('authority boundary');
{
  for (const [claim, label] of [
    ['publish the finished article', 'publishing'],
    ['approve the draft for release', 'approval'],
    ['finalize the article', 'finalization'],
  ]) {
    check(`a Skill claiming ${label} authority is rejected`,
      mutated('template', (t) => t.replace('    - what this Skill is allowed to decide', `    - ${claim}`))
        .includes(CODES.AUTHORITY_ESCALATION));
  }

  check('omitting the publication denial is rejected',
    mutated('template', (t) => t.replace('    - set an article to status published\n', ''))
      .includes(CODES.AUTHORITY_ESCALATION));
  check('omitting the approval denial is rejected',
    mutated('template', (t) => t.replace('    - record human approval\n', ''))
      .includes(CODES.AUTHORITY_ESCALATION));
}

// --- refusal --------------------------------------------------------------
console.log('missing context is a refusal');
{
  check('declaring required context without a refusal boundary is rejected',
    mutated('template', (t) => t.replace(
      /## Refusal conditions[\s\S]*?(?=## Evidence)/,
      '## Refusal conditions\n\nProceed with a reasonable assumption when input is absent.\n\n',
    )).includes(CODES.MISSING_REFUSAL));
}

// --- no duplication of governing text ------------------------------------
console.log('governing documents are referenced, not copied');
{
  const constitution = readFileSync(resolve(ROOT, 'editorial/constitution.md'), 'utf8');
  const longPara = constitution.split(/\n\s*\n/).find((p) => p.replace(/\s+/g, ' ').trim().length >= 200);
  check('a paragraph copied from the constitution is caught',
    mutated('template', (t) => t + '\n\n' + longPara + '\n').includes(CODES.DUPLICATED_AUTHORITY),
    'no sufficiently long paragraph found');
}

// --- vendor neutrality ----------------------------------------------------
console.log('vendor neutrality');
{
  for (const product of ['claude', 'gpt-5', 'NotebookLM']) {
    check(`allowed_tools naming "${product}" is rejected`,
      mutated('template', (t) => t.replace('  - capability-class-not-a-vendor-product', `  - ${product}`))
        .includes(CODES.VENDOR_COUPLING));
  }
  check('a capability class is accepted',
    !mutated('template', (t) => t.replace('  - capability-class-not-a-vendor-product', '  - web_search'))
      .includes(CODES.VENDOR_COUPLING));
}

// --- fail-closed ----------------------------------------------------------
console.log('fail-closed behaviour');
{
  const root = mkdtempSync(join(tmpdir(), 'aes-skill-empty-'));
  try {
    mkdirSync(join(root, 'broken'));
    writeFileSync(join(root, 'broken', 'SKILL.md'), 'no front matter here\n');
    const issues = validateSkillDir(join(root, 'broken'), schema);
    check('a SKILL.md without front matter is a parse failure, not an empty pass',
      issues.some((i) => i.code === CODES.PARSE));
    check('an empty skills directory yields no false positives',
      validateAllSkills(root, schema).length === 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log(failures === 0 ? '\nskill format regression: PASS' : `\nskill format regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
