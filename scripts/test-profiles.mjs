#!/usr/bin/env node
/**
 * Regression test for content-type profiles and media strategy —
 * AES-P1.4 (SUE-441) and AES-P1.5 (SUE-442).
 *
 * The point of profiles is that they differ. Most of these checks assert that
 * a rule which binds one type does not bind another.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODES, defaultArtifacts, loadProfiles, validateAgainstProfile } from './lib/profile-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const BUNDLE = resolve(ROOT, 'schemas/examples/article-artifact.example.json');
const PRIORITY = resolve(ROOT, 'editorial/artifact-priority.json');

const profiles = loadProfiles();
const base = JSON.parse(readFileSync(BUNDLE, 'utf8'));
const priority = JSON.parse(readFileSync(PRIORITY, 'utf8'));
const clone = () => JSON.parse(JSON.stringify(base));

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${name}`);
  else { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
};
const codes = (article, opts = {}) => validateAgainstProfile(article, { profiles, ...opts }).map((i) => i.code);

// --- profiles exist and differ -------------------------------------------
console.log('seven profiles, genuinely different');
{
  const types = Object.keys(profiles).sort();
  check('all seven content types have a profile (five V1 + academic + promotional, AES-V2.2)',
    types.join() === 'academic,news,note,project,promotional,research,view', types.join());

  const burden = (t) => profiles[t].evidence_burden;
  check('Research carries the heaviest evidence burden',
    burden('research').min_verified_claims > burden('news').min_verified_claims &&
    burden('news').min_verified_claims > burden('note').min_verified_claims);
  check('Note requires no verified claims', burden('note').min_verified_claims === 0);
  check('Research requires a contradicting source',
    burden('research').min_source_roles.includes('contradicting'));
  check('News requires a primary source', burden('news').min_source_roles.includes('primary'));
  check('View requires confidence and counterarguments',
    ['confidence', 'counterarguments'].every((f) => profiles.view.required_type_fields.includes(f)));
  check('Note is the only profile with a hard length limit',
    Object.values(profiles).filter((p) => p.limits?.max_words).length === 1 &&
    profiles.note.limits.max_words === 800);
  check('Project treats repository prose as a claim, not evidence',
    profiles.project.source_rules.repo_prose_is_not_evidence === true &&
    profiles.project.source_rules.requires_pinned_ref === true);
  check('every profile names its anti-patterns',
    Object.values(profiles).every((p) => (p.anti_patterns ?? []).length >= 3));
  check('every profile declares artifact fit',
    Object.values(profiles).every((p) => p.artifacts && 'default' in p.artifacts && 'inappropriate' in p.artifacts));
}

// --- the extension proof: a new content type is data, not a code change ---
console.log('academic and promotional extend the axis without touching the engine');
{
  check('Academic carries the heaviest citation burden of any content type',
    burdenOf('academic').min_verified_claims >= burdenOf('research').min_verified_claims &&
    burdenOf('academic').min_source_roles.includes('contradicting'));
  check('Academic names method transparency and hedging as load-bearing',
    /method/i.test(JSON.stringify(profiles.academic.required_type_fields)) &&
    profiles.academic.anti_patterns.some((a) => /hedge/i.test(a)));
  check('Promotional requires disclosure of persuasive intent',
    profiles.promotional.required_type_fields.includes('disclosure'));
  check('Promotional still verifies every factual claim (evidence burden not waived)',
    burdenOf('promotional').min_verified_claims >= 1);
  check('Promotional names unfalsifiable superlatives as its anti-pattern',
    profiles.promotional.anti_patterns.some((a) => /superlative/i.test(a)));
  check('Academic and Promotional are not thin copies of an existing profile',
    JSON.stringify(profiles.academic.anti_patterns) !== JSON.stringify(profiles.research.anti_patterns) &&
    JSON.stringify(profiles.promotional.anti_patterns) !== JSON.stringify(profiles.news.anti_patterns));
}

function burdenOf(t) { return profiles[t].evidence_burden; }

// --- the worked example conforms -----------------------------------------
console.log('worked example against the news profile');
{
  check('the news example conforms to its own profile',
    codes(base.article, { artifacts: base.artifacts }).length === 0,
    JSON.stringify(validateAgainstProfile(base.article, { profiles, artifacts: base.artifacts })));
}

// --- burden is enforced per type -----------------------------------------
console.log('evidence burden binds by type');
{
  const thin = clone();
  thin.article.verification.claims = thin.article.verification.claims.slice(0, 1);
  check('a News piece with one verified claim fails',
    codes(thin.article).includes(CODES.EVIDENCE_BURDEN));

  const asNote = clone();
  asNote.article.content_type = 'note';
  asNote.article.type_fields = { my_note: '내 판단은 이렇다.' };
  asNote.article.verification.claims = [];
  check('the same thin evidence is fine for a Note',
    !codes(asNote.article).includes(CODES.EVIDENCE_BURDEN),
    JSON.stringify(codes(asNote.article)));

  const asResearch = clone();
  asResearch.article.content_type = 'research';
  asResearch.article.type_fields = { research_question: '가격 하락은 마진에 어떻게 전달되는가?' };
  check('the news-level evidence is not enough for Research',
    codes(asResearch.article).includes(CODES.EVIDENCE_BURDEN));

  const noContradiction = clone();
  noContradiction.article.content_type = 'research';
  noContradiction.article.type_fields = { research_question: 'q' };
  noContradiction.article.source_set = noContradiction.article.source_set.filter((s) => s.role !== 'contradicting');
  check('Research without a contradicting source fails',
    codes(noContradiction.article).includes(CODES.SOURCE_ROLE));
}

// --- required type fields -------------------------------------------------
console.log('required type fields');
{
  const view = clone();
  view.article.content_type = 'view';
  view.article.type_fields = { confidence: 'medium' };
  check('a View without counterarguments fails',
    codes(view.article).includes(CODES.TYPE_FIELD));

  view.article.type_fields.counterarguments = ['협상 단가가 충분히 낮다면 계산은 성립하지 않는다.'];
  check('a View with confidence and counterarguments passes',
    !codes(view.article).includes(CODES.TYPE_FIELD), JSON.stringify(codes(view.article)));

  const news = clone();
  delete news.article.type_fields;
  check('News without an event_date fails', codes(news.article).includes(CODES.TYPE_FIELD));
}

// --- Note stays a Note ----------------------------------------------------
console.log('a Note cannot become a report');
{
  const note = clone();
  note.article.content_type = 'note';
  note.article.type_fields = { my_note: '한 줄 판단.' };
  note.article.verification.claims = [];
  const short = 'word '.repeat(200);
  const long = 'word '.repeat(1200);
  check('an 800-word note is fine', !codes(note.article, { body: short }).includes(CODES.LENGTH_LIMIT));
  check('a 1200-word note is not', codes(note.article, { body: long }).includes(CODES.LENGTH_LIMIT));
  check('no length limit applies to Research',
    !codes({ ...clone().article, content_type: 'research', type_fields: { research_question: 'q' } }, { body: long })
      .includes(CODES.LENGTH_LIMIT));
}

// --- freshness ------------------------------------------------------------
console.log('News freshness');
{
  const stale = clone();
  stale.article.type_fields = { event_date: '2026-01-01' };
  check('a News piece about a months-old event fails freshness',
    codes(stale.article).includes(CODES.FRESHNESS));
  check('a recent event passes', !codes(base.article).includes(CODES.FRESHNESS));

  const asView = clone();
  asView.article.content_type = 'view';
  asView.article.type_fields = { confidence: 'medium', counterarguments: ['x'], event_date: '2026-01-01' };
  check('freshness does not bind a View', !codes(asView.article).includes(CODES.FRESHNESS));
}

// --- Project: repo prose is a claim --------------------------------------
console.log('Project repository evidence');
{
  const project = clone();
  project.article.content_type = 'project';
  project.article.type_fields = { project_ref: 'suengj/p05_finance', period: '2026' };
  project.article.source_set = [
    { source_id: 'src:github:suengj/p05_finance', role: 'primary', content_hash_at_use: 'a'.repeat(64) },
  ];
  check('a GitHub source without a pinned ref fails',
    codes(project.article).includes(CODES.REPO_EVIDENCE));

  project.article.source_set[0].pinned_ref = 'a1b2c3d';
  check('a pinned GitHub source passes',
    !codes(project.article).includes(CODES.REPO_EVIDENCE));
}

// --- artifact fit ---------------------------------------------------------
console.log('artifact fit by content type');
{
  const note = clone();
  note.article.content_type = 'note';
  note.article.type_fields = { my_note: 'x' };
  note.article.verification.claims = [];
  const brief = base.artifacts.find((a) => a.kind === 'brief');
  check('a Note cannot carry a brief',
    codes(note.article, { artifacts: [brief] }).includes(CODES.ARTIFACT_FIT));
  check('News can', !codes(base.article, { artifacts: [brief] }).includes(CODES.ARTIFACT_FIT));

  check('News defaults to a brief', defaultArtifacts('news', profiles).includes('brief'));
  check('Research and Project default to an evidence visual',
    defaultArtifacts('research', profiles).includes('evidence_visual') &&
    defaultArtifacts('project', profiles).includes('evidence_visual'));
  check('no content type defaults to audio or video',
    Object.keys(profiles).every((t) => {
      const d = defaultArtifacts(t, profiles);
      return !d.includes('audio') && !d.includes('video');
    }));
  check('an unknown content type is not silently accepted',
    codes({ ...base.article, content_type: 'essay' }).includes(CODES.UNKNOWN_TYPE));
}

// --- media strategy -------------------------------------------------------
console.log('media strategy and priority order');
{
  check('evidence media may change the argument, distribution may not',
    priority.stages.evidence.may_change_the_argument === true &&
    priority.stages.distribution.may_change_the_argument === false);
  check('evidence media is built from a framed article',
    /framed/.test(priority.stages.evidence.created_when));
  check('distribution media requires final or published',
    /final/.test(priority.stages.distribution.created_when) &&
    /published/.test(priority.stages.distribution.published_when));
  check('evidence visuals rank first',
    priority.priority.find((p) => p.rank === 1).kind === 'evidence_visual');
  check('the order runs visual → brief → slides → infographic → audio → video',
    priority.priority.slice(0, 6).map((p) => p.kind).join() ===
    'evidence_visual,brief,slides,infographic,audio,video');
  check('the order is revisable by evidence, not preference',
    priority.reprioritisation_criteria.length >= 5 &&
    priority.reprioritisation_criteria.every((c) => c.trigger && c.effect));
  check('an unverified-claim artifact stops the roadmap rather than reordering it',
    priority.reprioritisation_criteria.some((c) => /never verified|unverified/.test(c.trigger) && /Stop adding/.test(c.effect)));
}

console.log(failures === 0 ? '\nprofiles regression: PASS' : `\nprofiles regression: FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
