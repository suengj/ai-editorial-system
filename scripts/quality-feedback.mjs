#!/usr/bin/env node
/**
 * Light output-quality feedback (SUE-1426 R4). Store: feedback/ (subfolders outcomes, task-feedback, candidates, preferences).
 *   node scripts/quality-feedback.mjs outcome  --task T --target ID --format ART [--adopted yes|no] [--errors a,b] [--revisions N] [--profile-hash H]
 *   node scripts/quality-feedback.mjs implicit --task T --target ID --format ART --kind K [--statement "..."]
 *   node scripts/quality-feedback.mjs explicit --target ID --format ART --instruction "..." --statement "앞으로 ..."
 *   node scripts/quality-feedback.mjs rollback --target ID --format ART
 *   node scripts/quality-feedback.mjs show     --target ID --format ART
 * --root DIR overrides the store (default feedback/). Never edits a profile; no analytics. Exit 1 on usage/validation error.
 */
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { REPO_ROOT } from './lib/resolve-core.mjs';
import { FeedbackStore, recordOutcome, recordImplicitFeedback, applyExplicitPreference, rollbackPreference, scopedGuidance } from './lib/quality-feedback-core.mjs';

try {
  const { values: v, positionals: [cmd] } = parseArgs({ allowPositionals: true, strict: true, options: { root: { type: 'string' }, task: { type: 'string' }, target: { type: 'string' }, format: { type: 'string' }, adopted: { type: 'string' }, errors: { type: 'string' }, revisions: { type: 'string' }, 'profile-hash': { type: 'string' }, kind: { type: 'string' }, statement: { type: 'string' }, instruction: { type: 'string' } } });
  const store = new FeedbackStore(resolve(v.root ?? `${REPO_ROOT}/feedback`));
  const scope = { target: v.target, format: v.format };
  let out;
  if (cmd === 'outcome') out = recordOutcome(store, { task_id: v.task, ...scope, first_result_adopted: v.adopted === undefined ? 'UNKNOWN' : v.adopted === 'yes', repeated_errors: v.errors ? v.errors.split(',') : [], revision_count: v.revisions === undefined ? null : Number(v.revisions), profile_hash: v['profile-hash'] ?? null });
  else if (cmd === 'implicit') out = recordImplicitFeedback(store, { task_id: v.task, ...scope, kind: v.kind, statement: v.statement ?? '' });
  else if (cmd === 'explicit') out = applyExplicitPreference(store, { ...scope, instruction: v.instruction, statement: v.statement, task_id: v.task ?? null });
  else if (cmd === 'rollback') out = rollbackPreference(store, scope);
  else if (cmd === 'show') out = scopedGuidance(store, scope);
  else throw new Error('usage: quality-feedback.mjs outcome|implicit|explicit|rollback|show (see header)');
  console.log(JSON.stringify(out, null, 2));
} catch (e) { console.error(`[${e.code ?? 'ERROR'}] ${e.message}`); process.exitCode = 1; }
