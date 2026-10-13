#!/usr/bin/env node
/**
 * Library -> intake -> resolveEditorial -> brief (SUE-1572 / R3). The real program path:
 *
 *   node scripts/library-intake.mjs --intent intent.json --target <id> [--packet handoff.json --library-root ../intelligence-library]
 *        [--selections sel.json] [--allow-preview] [--fact-required] [--no-library] [--task-kind text|visual|both] --out-dir DIR
 *
 * Library search is OPTIONAL: without --packet the flow proceeds on the user's own sources and records why.
 * Exit 0 READY / READY_WITH_BLOCKED_USES, 2 resolution blocked, 1 usage or invalid packet/intent.
 * R4: --feedback-root/--format add this target+format's own active preference and open candidates; --example-reason selects approved examples (else NO_APPROVED_REFERENCE).
 * Produces DIR/{intent.merged.json, source-manifest.library.json?, receipt.json, brief.json}. No network, LLM, analytics, publication.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { RuleReader, resolveEditorial, loadManifest, REPO_ROOT, STATUS } from './lib/resolve-core.mjs';
import { FeedbackStore, qualityBlock } from './lib/quality-feedback-core.mjs';
import { validateIntent } from './lib/intent-core.mjs';
import { LibraryReader, adaptLibraryPacket, mergeIntoIntent, libraryDecision, buildEditorialBrief } from './lib/library-input-core.mjs';

export function runLibraryIntake({ intent, packet = null, target, libraryRoot = null, selections = {}, allowPreview = false, factRequired = false, noLibrary = false, taskKind = null, flow = null, feedbackRoot = null, format = null, exampleReason = null, approvals = null, corpus = null, reader = new RuleReader(), planCache = new Map(), libraryReader = new LibraryReader(libraryRoot) }) {
  const decision = libraryDecision(intent, { packet, noLibrary, factRequired });
  const adapted = packet ? adaptLibraryPacket(packet, { reader: libraryReader, selections, allowPreview }) : null;
  const merged = adapted ? mergeIntoIntent(intent, adapted) : intent;
  const { issues } = validateIntent(merged, undefined, { extraKnownRefs: adapted?.inputs.references.map((r) => r.ref_id) ?? [] });
  if (issues.length) { const e = new Error(`merged intent invalid: ${issues.map((i) => `[${i.code}] ${i.where} ${i.message}`).join('; ')}`); e.code = 'INTENT_INVALID'; throw e; }
  const receipt = resolveEditorial(merged, { targetId: target ?? null, flowId: flow, taskKind, reader, planCache });
  const brief = buildEditorialBrief({ intent: merged, receipt, adapted, decision, factRequired, taskKind });
  // R4: approved-example step (description by default) + this target/format's own scoped guidance. Never touches the profile.
  brief.quality = qualityBlock({ receipt, manifest: loadManifest(reader).manifest, repoRoot: REPO_ROOT, store: feedbackRoot ? new FeedbackStore(feedbackRoot) : null, format, exampleReason, approvals, corpus });
  return { merged, adapted, receipt, brief, decision };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { values: v } = parseArgs({ options: { intent: { type: 'string' }, target: { type: 'string' }, packet: { type: 'string' }, 'library-root': { type: 'string' }, selections: { type: 'string' }, 'allow-preview': { type: 'boolean', default: false }, 'fact-required': { type: 'boolean', default: false }, 'no-library': { type: 'boolean', default: false }, 'task-kind': { type: 'string' }, flow: { type: 'string' }, 'feedback-root': { type: 'string' }, format: { type: 'string' }, 'example-reason': { type: 'string' }, 'out-dir': { type: 'string' } }, strict: true });
    if (!v.intent || !v['out-dir']) throw new Error('usage: node scripts/library-intake.mjs --intent intent.json --target <id> --out-dir DIR [--packet handoff.json --library-root DIR] [--selections sel.json] [--allow-preview] [--fact-required] [--no-library] [--task-kind text|visual|both] [--flow blog|news|report] [--feedback-root DIR --format <artifact>] [--example-reason ambiguity|failure|quality_comparison]');
    const json = (p) => JSON.parse(readFileSync(resolve(p), 'utf8'));
    const r = runLibraryIntake({ intent: json(v.intent), packet: v.packet && !v['no-library'] ? json(v.packet) : null, target: v.target, libraryRoot: v['library-root'] ?? null, selections: v.selections ? json(v.selections) : {}, allowPreview: v['allow-preview'], factRequired: v['fact-required'], noLibrary: v['no-library'], taskKind: v['task-kind'] ?? null, flow: v.flow ?? null, feedbackRoot: v['feedback-root'] ?? null, format: v.format ?? null, exampleReason: v['example-reason'] ?? null });
    const dir = resolve(v['out-dir']); mkdirSync(dir, { recursive: true });
    const put = (n, o) => writeFileSync(resolve(dir, n), `${JSON.stringify(o, null, 2)}\n`);
    put('intent.merged.json', r.merged); put('receipt.json', r.receipt); put('brief.json', r.brief);
    if (r.adapted?.manifest) put('source-manifest.library.json', r.adapted.manifest);
    const b = r.brief;
    console.error(`library-intake: ${b.status} library=${b.library.searched ? 'used' : `skipped(${b.library.skip_reason})`} selected=${b.library.selected.map((s) => `${s.id}:${s.authority}`).join(',') || '-'} blocked_uses=${b.blocked_uses.length} fallbacks=${b.library.fallbacks.length}`);
    if (r.receipt.status !== STATUS.READY) process.exitCode = 2;
  } catch (e) { console.error(`[${e.code ?? 'ERROR'}] ${e.message}`); process.exitCode = 1; }
}
