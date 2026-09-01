#!/usr/bin/env node
/**
 * Regression test for the semantic article grammar — AES-P1.6 (SUE-464).
 *
 * The boundary being defended: this repository decides what a block means,
 * suengj-com decides how it looks. Most of these checks are attempts to cross
 * that boundary, each of which must fail.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, loadSchema, validatePresentationPlan } from './lib/presentation-core.mjs';
import { loadProfiles } from './lib/profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const EXAMPLE = resolve(ROOT, 'schemas/examples/presentation-plan.example.json');

const schema = loadSchema();
const profiles = loadProfiles();
const base = JSON.parse(readFileSync(EXAMPLE, 'utf8'));
const clone = () => JSON.parse(JSON.stringify(base));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const codes = (plan, opts = {}) =>
  validatePresentationPlan(plan, { contentType: 'news', paragraphCount: 9, schema, profiles, ...opts })
    .map((i) => i.code);
const mutate = (fn, opts) => { const p = clone(); fn(p); return codes(p, opts); };

// --- positive -------------------------------------------------------------
console.log('worked example');
{
  check('the example plan is valid', codes(base).length === 0, JSON.stringify(validatePresentationPlan(base, { contentType: 'news', paragraphCount: 9 })));
  check('every block explains why it deserves separation',
    base.blocks.every((b) => b.why && b.why.length >= 10));
  check('every block has a plain-Markdown fallback',
    base.blocks.every((b) => b.fallback && b.fallback.length > 0));
}

// --- the schema cannot express appearance --------------------------------
console.log('the schema cannot express appearance');
{
  const props = schema.$defs.block.properties;
  check('no colour field exists', !('color' in props) && !('colour' in props));
  check('no style or class field exists', !('style' in props) && !('class' in props));
  check('no component field exists', !('component' in props) && !('render_as' in props));
  check('unknown properties are rejected', schema.$defs.block.additionalProperties === false);
  check('adding a colour field to a block is rejected',
    mutate((p) => { p.blocks[0].color = 'red'; }).includes(CODES.SCHEMA));
  check('the role vocabulary is a closed allowlist',
    mutate((p) => { p.blocks[0].role = 'highlight'; }).includes(CODES.SCHEMA));
  check('the V0.1 vocabulary is small', schema.$defs.role.enum.length <= 12);
}

// --- renderer leaks -------------------------------------------------------
console.log('renderer leaks');
{
  const leaks = [
    ['raw HTML', '<div>중요</div>'],
    ['a component name', '<Callout>중요</Callout>'],
    ['a hex colour', '강조 색은 #ff0000 이다'],
    ['an inline style attribute', '<span style="color:red">x</span>'],
    ['a CSS property', 'margin: 0 auto 로 배치한다'],
    ['a colour directive', 'color: red 로 표시한다'],
  ];
  for (const [label, text] of leaks) {
    check(`${label} in content is rejected`,
      mutate((p) => { p.blocks[0].content = text; }).includes(CODES.RENDERER_LEAK));
  }
  check('a leak in the fallback is caught too',
    mutate((p) => { p.blocks[0].fallback = '<div>x</div>'; }).includes(CODES.RENDERER_LEAK));
  check('ordinary Markdown emphasis is not a leak',
    !mutate((p) => { p.blocks[0].content = '이것은 **강조**된 문장이다.'; }).includes(CODES.RENDERER_LEAK));
}

// --- meaning must not depend on colour -----------------------------------
console.log('colour never carries meaning alone');
{
  check('"the red box" is rejected',
    mutate((p) => { p.blocks[0].content = '자세한 내용은 the red box 를 참고. see the red one.'; })
      .includes(CODES.MEANING_BY_COLOUR));
  check('"highlighted in yellow" is rejected',
    mutate((p) => { p.blocks[0].content = 'highlighted in yellow 부분을 보라.'; })
      .includes(CODES.MEANING_BY_COLOUR));
}

// --- lossless fallback ----------------------------------------------------
console.log('the fallback is lossless');
{
  check('a fallback dropping a number is rejected',
    mutate((p) => {
      p.blocks[0].content = '가격은 30% 하락했다.';
      p.blocks[0].fallback = '가격은 크게 하락했다.';
    }).includes(CODES.LOSSY_FALLBACK));

  check('a fallback dropping a citation is rejected',
    mutate((p) => { p.blocks[1].fallback = p.blocks[1].fallback.replace(' [^2]', ''); })
      .includes(CODES.LOSSY_FALLBACK));

  check('a fallback dropping a URL is rejected',
    mutate((p) => {
      p.blocks[0].content = '출처는 https://example.com/pricing 이다.';
      p.blocks[0].fallback = '출처는 공급자 페이지다.';
    }).includes(CODES.LOSSY_FALLBACK));

  check('a caution whose fallback drops the qualification is rejected',
    mutate((p) => {
      p.blocks[2].content = '이 격차가 30%를 넘으면 계산은 성립하지 않는다.';
      p.blocks[2].fallback = '한계가 있다.';
    }).includes(CODES.LOSSY_FALLBACK));

  check('rewording the fallback is permitted when nothing is lost',
    !mutate((p) => { p.blocks[0].fallback = '즉, 하락한 것은 list price이고 마진을 결정하는 것은 seat당 실제 소비량이다.'; })
      .includes(CODES.LOSSY_FALLBACK));
}

// --- role obligations -----------------------------------------------------
console.log('role obligations');
{
  check('an evidence block must name its claims',
    mutate((p) => { delete p.blocks[1].claims; }).includes(CODES.MISSING_CLAIMS));
  check('a visual_ref must name its artifact',
    mutate((p) => { delete p.blocks[3].artifact_ref; }).includes(CODES.MISSING_ARTIFACT));
  check('duplicate block ids are rejected',
    mutate((p) => { p.blocks[1].id = p.blocks[0].id; }).includes(CODES.DUPLICATE_ID));
}

// --- profile guidance, not templates -------------------------------------
console.log('profiles guide without templating');
{
  check('a procedure block in a News piece is flagged',
    mutate((p) => { p.blocks[0].role = 'procedure'; }).includes(CODES.ROLE_AVOIDED));
  check('the same block is fine in a Project',
    !mutate((p) => { p.blocks[0].role = 'procedure'; }, { contentType: 'project' }).includes(CODES.ROLE_AVOIDED));
  check('a View avoids most block roles',
    profiles.view.semantic_roles.usually_avoid.length >= 4);
  check('a Note recommends no roles at all',
    profiles.note.semantic_roles.recommended.length === 0);
  check('no profile requires any block',
    Object.values(profiles).every((p) => Array.isArray(p.semantic_roles.recommended)));
  check('an empty plan is valid — plain prose is always sufficient',
    codes({ schema_version: '1.0.0', article_id: 'art:x', blocks: [] }).length === 0);
}

// --- callout spam ---------------------------------------------------------
console.log('callout density');
{
  check('blocks outnumbering prose is rejected',
    mutate(() => {}, { paragraphCount: 2 }).includes(CODES.BLOCK_DENSITY));
  check('a normal ratio is fine',
    !codes(base, { paragraphCount: 9 }).includes(CODES.BLOCK_DENSITY));
}

// --- fail-closed ----------------------------------------------------------
console.log('fail-closed behaviour');
{
  check('an empty object is not a silent pass', codes({}).length > 0);
  check('a null plan is not a silent pass', codes(null).length > 0);
}

// --- the rubric records the presentation split ---------------------------
console.log('rubric integration');
{
  const rubric = JSON.parse(readFileSync(resolve(ROOT, 'evals/rubric.json'), 'utf8'));
  const i6 = rubric.dimensions.find((d) => d.id === 'I-6');
  const e12 = rubric.dimensions.find((d) => d.id === 'E-12');
  check('portability is an integrity dimension', i6?.class === 'integrity' && i6.mechanical === 'full');
  check('whether structure clarifies is an editorial dimension', e12?.class === 'editorial');
  check('the regression statement is recorded',
    /less clear, less portable, less accessible, or factually more ambiguous/i.test(rubric.presentation_note ?? ''));
}

console.log(failures === 0 ? '\npresentation regression: PASS' : `\npresentation regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
