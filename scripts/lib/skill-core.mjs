/**
 * Skill format engine — AES-P2.1 (SUE-443).
 *
 * Validates SKILL.md front matter against schemas/skill.schema.json and the
 * structural rules in skills/SKILL-FORMAT.md.
 *
 * Two rules carry most of the weight:
 *   - a Skill may never claim publication or human-approval authority;
 *   - missing required context is a refusal, never an invitation to improvise.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { parseFrontMatter } from './yaml-lite.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
export const SKILLS_DIR = resolve(ROOT, 'skills');
export const SKILL_SCHEMA = resolve(ROOT, 'schemas/skill.schema.json');

export const loadSchema = (p = SKILL_SCHEMA) => JSON.parse(readFileSync(p, 'utf8'));

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  NAME_MISMATCH: 'name-directory-mismatch',
  MISSING_SECTION: 'missing-section',
  AUTHORITY_ESCALATION: 'authority-escalation',
  MISSING_REFUSAL: 'missing-refusal-boundary',
  DUPLICATED_AUTHORITY: 'duplicated-governing-text',
  SIZE: 'entry-point-too-large',
  DANGLING_REFERENCE: 'dangling-reference',
  VENDOR_COUPLING: 'vendor-coupling',
});

export const REQUIRED_SECTIONS = Object.freeze([
  'Purpose', 'Inputs', 'Outputs', 'Preconditions', 'Procedure',
  'Invariants', 'Refusal conditions', 'Evidence', 'Authority',
]);

/** Authority a Skill may never claim, however phrased. */
const FORBIDDEN_AUTHORITY = [
  { id: 'publish', re: /\b(publish(es|ing)?|status:\s*published|go live)\b/i },
  { id: 'approve', re: /\b(approve[sd]?|approval|sign[- ]off)\b/i },
  { id: 'finalize', re: /\b(finali[sz]e[sd]?|mark (as )?final)\b/i },
];

/** Named products that would bind the contract to one runtime. */
const VENDOR_NAMES = /\b(claude|chatgpt|gpt-?[0-9]|openai|anthropic|gemini|notebooklm|codex|cursor|copilot)\b/i;

const MAX_LINES = 500;

const issue = (code, where, message) => ({ code, where, message });

/** Every Skill directory: any subdirectory of skills/ holding a SKILL.md. */
export function listSkillDirs(dir = SKILLS_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'SKILL.md')))
    .map((e) => join(dir, e.name))
    .sort();
}

export function validateSkillDir(skillDir, schema = loadSchema()) {
  const file = join(skillDir, 'SKILL.md');
  const where = basename(skillDir);

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    return [issue(CODES.PARSE, where, `unreadable SKILL.md: ${err.message}`)];
  }

  let data;
  let body;
  try {
    ({ data, body } = parseFrontMatter(text));
  } catch (err) {
    return [issue(CODES.PARSE, where, `front matter: ${err.message}`)];
  }

  const issues = [];
  for (const e of validate(data, schema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }

  // --- identity ------------------------------------------------------------
  if (data.name !== where) {
    issues.push(issue(CODES.NAME_MISMATCH, where, `front matter name "${data.name}" does not match directory "${where}"`));
  }

  // --- size discipline -----------------------------------------------------
  const lines = text.split('\n').length;
  if (lines > MAX_LINES) {
    issues.push(issue(CODES.SIZE, where,
      `${lines} lines exceeds the ${MAX_LINES}-line entry-point budget; move detail into references/ with a load_when condition`));
  }

  // --- required sections ---------------------------------------------------
  const present = new Set(
    [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim().toLowerCase()),
  );
  for (const section of REQUIRED_SECTIONS) {
    if (!present.has(section.toLowerCase())) {
      issues.push(issue(CODES.MISSING_SECTION, where, `missing "## ${section}"`));
    }
  }

  // --- authority -----------------------------------------------------------
  const may = data.authority?.may ?? [];
  const mayNot = data.authority?.may_not ?? [];

  for (const claim of may) {
    for (const f of FORBIDDEN_AUTHORITY) {
      if (f.re.test(claim)) {
        issues.push(issue(CODES.AUTHORITY_ESCALATION, where,
          `authority.may claims "${claim}" — no Skill may ${f.id}; that authority is human and lives in suengj-com`));
      }
    }
  }
  for (const f of ['publish', 'approv']) {
    if (!mayNot.some((c) => c.toLowerCase().includes(f))) {
      issues.push(issue(CODES.AUTHORITY_ESCALATION, where,
        `authority.may_not must state that this Skill cannot ${f === 'publish' ? 'publish' : 'record approval'}`));
    }
  }

  // --- refusal boundary ----------------------------------------------------
  if ((data.requires ?? []).length > 0) {
    const refusal = sectionBody(body, 'Refusal conditions');
    if (!/refus|stop|halt|decline/i.test(refusal ?? '')) {
      issues.push(issue(CODES.MISSING_REFUSAL, where,
        'declares required context but its Refusal conditions do not say it stops when that context is absent'));
    }
  }

  // --- reference by path, never by copy ------------------------------------
  for (const g of data.governed_by ?? []) {
    if (!existsSync(resolve(ROOT, g))) {
      issues.push(issue(CODES.DANGLING_REFERENCE, where, `governed_by "${g}" does not exist`));
    }
  }
  for (const r of data.references ?? []) {
    if (!existsSync(resolve(skillDir, r.path))) {
      issues.push(issue(CODES.DANGLING_REFERENCE, where, `references "${r.path}" does not exist`));
    }
  }
  issues.push(...checkNoDuplication(where, body));

  // --- vendor neutrality ---------------------------------------------------
  for (const tool of data.allowed_tools ?? []) {
    if (VENDOR_NAMES.test(tool)) {
      issues.push(issue(CODES.VENDOR_COUPLING, where,
        `allowed_tools names a product ("${tool}"); declare a capability class instead — the generator is replaceable`));
    }
  }

  return issues;
}

/**
 * A Skill references the governing documents; it does not restate them.
 * Copied paragraphs drift, and a drifted copy silently overrides the original.
 */
function checkNoDuplication(where, body) {
  const issues = [];
  const governing = ['editorial/constitution.md', 'editorial/voice.md'];
  const bodyNorm = body.replace(/\s+/g, ' ').toLowerCase();

  for (const g of governing) {
    const path = resolve(ROOT, g);
    if (!existsSync(path)) continue;
    for (const para of readFileSync(path, 'utf8').split(/\n\s*\n/)) {
      const norm = para.replace(/\s+/g, ' ').trim().toLowerCase();
      if (norm.length >= 120 && bodyNorm.includes(norm)) {
        issues.push(issue(CODES.DUPLICATED_AUTHORITY, where,
          `restates a paragraph from ${g}; reference it instead — a copy drifts and then silently overrides the original`));
        break;
      }
    }
  }
  return issues;
}

function sectionBody(body, heading) {
  const re = new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s|\\Z)`, 'im');
  return re.exec(body)?.[1] ?? null;
}

/** Validate every Skill in the directory. */
export function validateAllSkills(dir = SKILLS_DIR, schema = loadSchema()) {
  const results = [];
  for (const skillDir of listSkillDirs(dir)) {
    results.push({ skill: basename(skillDir), issues: validateSkillDir(skillDir, schema) });
  }
  return results;
}
