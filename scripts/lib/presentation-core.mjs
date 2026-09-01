/**
 * Presentation grammar engine — AES-P1.6 (SUE-464).
 *
 * Enforces the boundary between what a block MEANS and how it LOOKS.
 * This repository decides meaning; suengj-com decides appearance.
 *
 * Two rules carry the weight:
 *   - Writer output may contain no HTML, CSS, colour, or component name.
 *   - Every block's plain-Markdown fallback must be lossless: removing all
 *     presentation may not delete a fact, figure, citation, or link.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { extractSpans } from './polish-invariants.mjs';
import { loadProfiles } from './profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
export const SCHEMA_PATH = resolve(ROOT, 'schemas/presentation-plan.schema.json');

export const loadSchema = (p = SCHEMA_PATH) => JSON.parse(readFileSync(p, 'utf8'));

export const CODES = Object.freeze({
  PARSE: 'parse',
  SCHEMA: 'schema',
  RENDERER_LEAK: 'renderer-leak',
  LOSSY_FALLBACK: 'lossy-fallback',
  ROLE_AVOIDED: 'role-usually-avoided',
  BLOCK_DENSITY: 'block-density',
  MISSING_CLAIMS: 'evidence-without-claims',
  MISSING_ARTIFACT: 'visual-ref-without-artifact',
  DUPLICATE_ID: 'duplicate-block-id',
  MEANING_BY_COLOUR: 'meaning-carried-by-colour',
});

/** Things that must never appear in Writer output. */
const RENDERER_LEAKS = [
  { id: 'html-tag', re: /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i },
  { id: 'component-name', re: /<\/?[A-Z][A-Za-z0-9]*(\s[^>]*)?\/?>/ },
  { id: 'hex-colour', re: /#[0-9a-fA-F]{3,8}\b(?![^\s]*\))/ },
  { id: 'css-declaration', re: /\b(style\s*=|class\s*=|className\s*=)/i },
  { id: 'css-property', re: /\b(margin|padding|font-size|background-color|border-radius)\s*:/i },
  { id: 'named-colour-directive', re: /\b(color|colour)\s*[:=]\s*["']?(red|blue|green|yellow|orange|purple|gray|grey)\b/i },
];

/** Phrases whose meaning depends on the reader seeing a colour. */
const COLOUR_DEPENDENT = /\b(the (red|green|blue|yellow|orange) (box|block|section|text|one)|highlighted in (red|green|blue|yellow)|see the (red|green|blue) )/i;

/** A plan where most of the article is a callout has stopped separating anything. */
const MAX_BLOCK_SHARE = 0.5;

const issue = (code, where, message) => ({ code, where, message });

export function validatePresentationPlan(plan, {
  contentType = null, paragraphCount = null,
  schema = loadSchema(), profiles = loadProfiles(),
} = {}) {
  const issues = [];
  const where = plan?.article_id ?? '<plan>';

  for (const e of validate(plan, schema)) {
    issues.push(issue(CODES.SCHEMA, where, `${e.path}: ${e.message}`));
  }

  const blocks = plan?.blocks ?? [];
  const seen = new Set();
  const profile = contentType ? profiles[contentType] : null;

  for (const b of blocks) {
    const at = b?.id ?? '<block>';

    if (b?.id) {
      if (seen.has(b.id)) issues.push(issue(CODES.DUPLICATE_ID, at, 'duplicate block id'));
      seen.add(b.id);
    }

    // --- renderer neutrality ---
    for (const field of ['content', 'fallback', 'why']) {
      const text = b?.[field] ?? '';
      for (const leak of RENDERER_LEAKS) {
        if (leak.re.test(text)) {
          issues.push(issue(CODES.RENDERER_LEAK, at,
            `${field} contains ${leak.id}; the Writer declares meaning, suengj-com decides appearance`));
          break;
        }
      }
    }

    // --- meaning must not depend on colour ---
    if (COLOUR_DEPENDENT.test(`${b?.content ?? ''} ${b?.fallback ?? ''}`)) {
      issues.push(issue(CODES.MEANING_BY_COLOUR, at,
        'the text refers to a colour to identify information; colour may enhance hierarchy but never carry meaning alone'));
    }

    // --- lossless fallback ---
    if (b?.content && b?.fallback) {
      const from = extractSpans(b.content);
      const to = extractSpans(b.fallback);
      for (const cls of ['numbers', 'dates', 'citation-markers', 'urls', 'quotations']) {
        for (const [value] of from[cls] ?? []) {
          if (!(to[cls] ?? new Map()).has(value)) {
            issues.push(issue(CODES.LOSSY_FALLBACK, at,
              `fallback drops ${cls.replace(/-/g, ' ')} "${value}"; removing presentation must never remove information`));
          }
        }
      }
    }

    // --- role obligations ---
    if (b?.role === 'evidence' && !(b.claims?.length > 0)) {
      issues.push(issue(CODES.MISSING_CLAIMS, at, 'role "evidence" must name the claims it rests on'));
    }
    if (b?.role === 'visual_ref' && !b.artifact_ref) {
      issues.push(issue(CODES.MISSING_ARTIFACT, at, 'role "visual_ref" must name the artifact it refers to'));
    }

    // --- profile guidance ---
    if (profile && (profile.semantic_roles?.usually_avoid ?? []).includes(b?.role)) {
      issues.push(issue(CODES.ROLE_AVOIDED, at,
        `role "${b.role}" is usually avoided for ${contentType} — ${profile.semantic_roles.rationale}`));
    }
  }

  // --- density ---
  if (paragraphCount !== null && paragraphCount > 0) {
    const share = blocks.length / (blocks.length + paragraphCount);
    if (share > MAX_BLOCK_SHARE) {
      issues.push(issue(CODES.BLOCK_DENSITY, where,
        `${blocks.length} blocks against ${paragraphCount} paragraphs; when most of the article is a callout, nothing is separated`));
    }
  }

  return issues;
}

export function validatePresentationPlanFile(path, options = {}) {
  let plan;
  try {
    plan = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return [issue(CODES.PARSE, path, `unparseable plan: ${err.message}`)];
  }
  return validatePresentationPlan(plan, options);
}
