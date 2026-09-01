#!/usr/bin/env node
/**
 * Regression test for the Skill set as a pipeline — AES-P2.2 … P2.6.
 *
 * Individual Skill structure is covered by test-skill-format.mjs. This suite
 * asserts the properties that only hold across the set: the authority
 * boundary is closed, the handoffs line up, verification and polish stay
 * separate, and the artifact plan is enforceable.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSkillDirs } from './lib/skill-core.mjs';
import { parseFrontMatter } from './lib/yaml-lite.mjs';
import { CODES as PLAN, validatePlan } from './lib/plan-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const skills = {};
for (const dir of listSkillDirs()) {
  const { data, body } = parseFrontMatter(readFileSync(join(dir, 'SKILL.md'), 'utf8'));
  skills[data.name] = { data, body, dir };
}

const plan = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/artifact-plan.example.json'), 'utf8'));
const article = JSON.parse(readFileSync(resolve(ROOT, 'schemas/examples/article-artifact.example.json'), 'utf8')).article;

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};

const PIPELINE = ['frame-article', 'verify-claims', 'write-article', 'editorial-polish', 'plan-artifacts'];

// --- the set exists -------------------------------------------------------
console.log('the V0.1 Skill set');
{
  for (const name of PIPELINE) check(`${name} exists`, name in skills);
  check('every Skill declares a version', PIPELINE.every((n) => /^\d+\.\d+\.\d+$/.test(skills[n]?.data.version ?? '')));
}

// --- authority is closed across the whole set -----------------------------
console.log('authority boundary across the set');
{
  check('no Skill in the set may publish',
    PIPELINE.every((n) => skills[n].data.authority.may_not.some((c) => /publish/i.test(c))));
  check('no Skill in the set may record approval',
    PIPELINE.every((n) => skills[n].data.authority.may_not.some((c) => /approv/i.test(c))));
  check('no Skill claims finalization in what it may do',
    PIPELINE.every((n) => !skills[n].data.authority.may.some((c) => /finali[sz]e|publish|approve/i.test(c))));
  check('every Skill declares required context',
    PIPELINE.every((n) => (skills[n].data.requires ?? []).length > 0));
  check('every Skill names capability classes, not products',
    PIPELINE.every((n) => (skills[n].data.allowed_tools ?? [])
      .every((t) => !/claude|gpt|openai|gemini|notebooklm|cursor/i.test(t))));
}

// --- the division of labour holds ----------------------------------------
console.log('verification and polish stay separate');
{
  const polish = skills['editorial-polish'].data;
  check('polish may not alter facts, numbers, citations, or quotations',
    polish.authority.may_not.some((c) => /fact|number|citation|quotation/i.test(c)));
  check('polish may not alter the thesis',
    polish.authority.may_not.some((c) => /thesis|direction of the argument/i.test(c)));
  check('polish may not weaken stated uncertainty',
    polish.authority.may_not.some((c) => /uncertainty/i.test(c)));
  check('polish refuses rather than editing a protected span',
    /would change a protected span/i.test(skills['editorial-polish'].body));
  check('polish states it is not a humanizer',
    /not a humanizer/i.test(skills['editorial-polish'].body));

  const verify = skills['verify-claims'].data;
  check('verification may not judge whether the thesis is worth an article',
    verify.authority.may_not.some((c) => /worth an article/i.test(c)));
  check('verification may not resolve a contradiction by averaging',
    verify.authority.may_not.some((c) => /averag/i.test(c)));
  check('verification may block finalization',
    verify.authority.may.some((c) => /block finalization/i.test(c)));
}

// --- framing owns the no-article decision --------------------------------
console.log('framing owns the decision not to write');
{
  const frame = skills['frame-article'];
  check('framing may decide the corpus supports no article',
    frame.data.authority.may.some((c) => /does not support an article/i.test(c)));
  check('framing may not write prose',
    frame.data.authority.may_not.some((c) => /prose/i.test(c)));
  check('NO_ARTICLE is stated as a successful outcome',
    /successful outcome of this Skill/i.test(frame.body));
  check('a high source count is rejected as evidence of worth',
    /high source count is not\s+evidence/i.test(frame.body));
  check('a human angle does not bypass verification',
    frame.data.authority.may_not.some((c) => /angle as exempt from verification/i.test(c)));
}

// --- drafting cannot invent a thesis -------------------------------------
console.log('drafting follows the frame');
{
  const write = skills['write-article'].data;
  check('drafting may not introduce a thesis the frame lacks',
    write.authority.may_not.some((c) => /thesis the frame does not contain/i.test(c)));
  check('drafting may not assert a claim outside the verified set',
    write.authority.may_not.some((c) => /absent from the verified claim set/i.test(c)));
  check('drafting requires both the frame and the claim set',
    write.requires.some((r) => /frame/i.test(r)) && write.requires.some((r) => /claim set/i.test(r)));
}

// --- handoffs line up -----------------------------------------------------
console.log('handoffs line up');
{
  // Bodies are line-wrapped, so match across whitespace rather than assuming
  // a phrase sits on one line.
  const mentions = (name, text) => new RegExp(text, 'is').test(skills[name].body.replace(/\s+/g, ' '));
  check('framing hands off to verification', mentions('frame-article', 'hand off.*verify-claims'));
  check('drafting hands off to polish', mentions('write-article', 'hand off.*editorial-polish'));
  check('polish hands off to a human', mentions('editorial-polish', 'hand off.*human review'));
  check('drafting returns gaps to verification', mentions('write-article', 'back to.*verify-claims'));
  check('polish returns protected-span changes to verification',
    mentions('editorial-polish', 'hands it to .*verify-claims'));
}

// --- artifact plan is enforceable ----------------------------------------
console.log('artifact plan');
{
  check('the worked plan is valid against its article',
    validatePlan(plan, article).length === 0,
    JSON.stringify(validatePlan(plan, article)));

  check('skip is used as a real verdict',
    plan.decisions.filter((d) => d.verdict === 'skip').length >= 3);
  check('every skip carries a reason',
    plan.decisions.filter((d) => d.verdict === 'skip').every((d) => d.reason?.length > 0));
  check('every artifact kind is considered',
    new Set(plan.decisions.map((d) => d.kind)).size === 8);

  const mutate = (fn) => { const p = JSON.parse(JSON.stringify(plan)); fn(p); return validatePlan(p, article).map((i) => i.code); };

  check('carrying an unverified claim is rejected',
    mutate((p) => { p.decisions[2].carries_claims = ['c3']; }).includes(PLAN.UNVERIFIED_CLAIM));
  check('carrying a nonexistent claim is rejected',
    mutate((p) => { p.decisions[2].carries_claims = ['c99']; }).includes(PLAN.UNVERIFIED_CLAIM));
  check('an evidence visual without a question is rejected',
    mutate((p) => { delete p.decisions[0].spec.question; }).includes(PLAN.MISSING_QUESTION));
  check('a fact-bearing artifact with no claims is rejected',
    mutate((p) => { delete p.decisions[2].carries_claims; }).includes(PLAN.MISSING_CLAIMS));
  check('a silently omitted kind is rejected',
    mutate((p) => { p.decisions = p.decisions.slice(0, 3); }).includes(PLAN.SILENT_OMISSION));
  check('a mismatched article_ref is rejected',
    mutate((p) => { p.article_ref.claims_hash = 'f'.repeat(64); }).includes(PLAN.LINEAGE_MISMATCH));

  const draftArticle = { ...article, state: 'drafted' };
  check('a distribution artifact planned before final is rejected',
    validatePlan(plan, draftArticle).some((i) => i.code === PLAN.DISTRIBUTION_GATE));

  const noteArticle = { ...article, content_type: 'note' };
  check('a brief planned for a Note is rejected',
    validatePlan(plan, noteArticle).some((i) => i.code === PLAN.ARTIFACT_FIT));
}

console.log(failures === 0 ? '\nskills pipeline regression: PASS' : `\nskills pipeline regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
