#!/usr/bin/env node
/**
 * Common editorial entry (SUE-1426 R1/R2). Intake step that follows
 * skills/intake-request: builds the selective load plan, resolves per-field
 * precedence, maps the SNS target to its copy/visual profile, and writes ONE
 * resolved-profile receipt that generate, polish, review and render consume.
 *
 *   node scripts/resolve-editorial.mjs (--intent intent.json | --plan series.json|request.json) --target signalytics-news [--overrides o.json] [--task-kind text|visual|both] [--library-merged library-verified-refs.json] [--out receipt.json]
 *   node scripts/resolve-editorial.mjs --check-package <delivery-dir> --target signalytics-news   (PNG count / caption.md / benchmark-brief.md / no Drive paths)
 *   node scripts/resolve-editorial.mjs --list-targets
 *   node scripts/resolve-editorial.mjs --receipt receipt.json --stamp generate|polish|review --stamps stamps.json   (append/update that stage's stamp)
 *   node scripts/resolve-editorial.mjs --receipt receipt.json --stages stamps.json     (stage consistency check)
 *   stamps.json shape: { "generate": {stage, profile_id, profile_version, resolved_hash}, "polish": {...}, "review": {...} }
 * Exit 0 READY, 2 BLOCKED/inconsistent, 1 usage error. No network, LLM or publication.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { validateIntent, loadSchema } from './lib/intent-core.mjs';
import { RuleReader, loadManifest, resolveEditorial, verifyStages, stageStamp, checkDeliveryPackage, DRIVE_TEXT_RE, intentFromPlan, STATUS } from './lib/resolve-core.mjs';
import { loadAndValidateCardNewsBrief } from './lib/card-news-brief-core.mjs';

try {
  const { values: v } = parseArgs({ options: { 'check-package': { type: 'string' }, stamp: { type: 'string' }, stamps: { type: 'string' }, intent: { type: 'string' }, plan: { type: 'string' }, 'library-merged': { type: 'string' }, target: { type: 'string' }, flow: { type: 'string' }, overrides: { type: 'string' }, 'task-kind': { type: 'string' }, out: { type: 'string' }, 'list-targets': { type: 'boolean', default: false }, flows: { type: 'boolean', default: false }, receipt: { type: 'string' }, stages: { type: 'string' } }, strict: true });
  const reader = new RuleReader();
  const json = (p) => JSON.parse(readFileSync(resolve(p), 'utf8'));
  if (v['list-targets']) {
    const { manifest } = loadManifest(reader);
    if (process.argv.includes('--flows')) { console.log(JSON.stringify(Object.entries(manifest.existing_flows).map(([id, f]) => ({ flow: id, surface: f.surface, status: f.status })), null, 2)); } else
    console.log(JSON.stringify(Object.entries(manifest.sns_targets).map(([id, t]) => ({ target: id, account: t.account, surface: t.surface, voice_family: t.voice_family, copy_files: t.copy_files, visual_artifacts: t.visual?.artifacts ?? null, status: t.status })), null, 2));
  } else if (v['check-package']) { // delivery package check: node scripts/resolve-editorial.mjs --check-package <dir> --target signalytics-news
    if (!v.target) throw new Error('usage: --check-package <dir> --target <id>');
    const dir = resolve(v['check-package']);
    const { manifest } = loadManifest(reader);
    if (!Object.hasOwn(manifest.sns_targets, v.target)) throw Object.assign(new Error(`unknown target "${v.target}"`), { code: 'UNKNOWN_TARGET' });
    const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const notPng = [], driveIn = [];
    const names = readdirSync(dir).filter((n) => {
      if (/\.png$/i.test(n)) { const b = readFileSync(resolve(dir, n)); if (!b.subarray(0, 8).equals(PNG)) { notPng.push(n); return false; } }
      else if (/\.(md|json|txt|csv|url|html?)$/i.test(n) && DRIVE_TEXT_RE.test(readFileSync(resolve(dir, n), 'utf8'))) driveIn.push(n);
      return true;
    });
    const out = checkDeliveryPackage(v.target, names, manifest);
    for (const n of notPng) out.issues.push(`${n} is named .png but is not a PNG (magic bytes)`);
    for (const n of driveIn) out.issues.push(`${n} contains a Drive URL/path (drive.google.com / docs.google.com / drive:)`);
    out.ok = out.issues.length === 0;
    console.log(JSON.stringify(out, null, 2));
    if (!out.ok) process.exitCode = 2;
  } else if (v.receipt) {
    if (v.stamp) { // append/update this stage's stamp: --receipt R --stamp generate|polish|review --stamps stamps.json
      if (!['generate', 'polish', 'review'].includes(v.stamp)) throw new Error('--stamp must be generate|polish|review');
      if (!v.stamps) throw new Error('usage: --receipt receipt.json --stamp generate|polish|review --stamps stamps.json');
      const rc = json(v.receipt);
      if (rc.status !== STATUS.READY || !rc.profile) { console.error(`[NOT_READY] receipt status is ${rc.status}; only a READY receipt can be stamped`); process.exitCode = 2; }
      else {
        let cur = {}; try { cur = json(v.stamps); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        cur[v.stamp] = stageStamp(rc, v.stamp);
        writeFileSync(resolve(v.stamps), `${JSON.stringify(cur, null, 2)}\n`);
        console.log(JSON.stringify({ stamped: v.stamp, stages_present: Object.keys(cur), resolved_hash: rc.profile.resolved_hash }));
      }
    } else {
    if (!v.stages) throw new Error('usage: --receipt receipt.json --stages stamps.json  |  --receipt receipt.json --stamp <stage> --stamps stamps.json');
    const issues = verifyStages(json(v.receipt), json(v.stages));
    console.log(JSON.stringify({ consistent: issues.length === 0, issues }, null, 2));
    if (issues.length) process.exitCode = 2;
    }
  } else {
    if (v.intent && v.plan) throw new Error('--intent and --plan are mutually exclusive');
    if (!v.intent && !v.plan) throw new Error('usage: node scripts/resolve-editorial.mjs (--intent intent.json | --plan series.json|request.json) --target <id>|--flow blog|news|report [--overrides o.json] [--task-kind text|visual|both] [--library-merged library-verified-refs.json] [--out receipt.json] | --list-targets');
    if (v.intent) { // the intent contract is enforced here too, not only by validate-intent
      // --library-merged <library-verified-refs.json>: the sidecar library-intake.mjs wrote in THIS run next to intent.merged.json.
      // It lists only the ref ids the adapter verified (path+hash), and is bound to the intent bytes by sha256, so ids written
      // into an arbitrary intent cannot vouch for themselves.
      const raw = json(v.intent);
      let extra = [];
      if (v['library-merged']) {
        const side = json(v['library-merged']);
        const got = createHash('sha256').update(readFileSync(resolve(v.intent))).digest('hex');
        if (side?.merged_intent_sha256 !== got || !Array.isArray(side.verified_ref_ids)) throw Object.assign(new Error('--library-merged sidecar does not belong to this intent (sha256 mismatch) or is malformed'), { code: 'LIBRARY_SIDECAR_MISMATCH' });
        extra = side.verified_ref_ids.filter((x) => typeof x === 'string');
      }
      const { issues } = validateIntent(raw, loadSchema(), { extraKnownRefs: extra });
      if (issues.length) throw Object.assign(new Error(`intent invalid (${issues.length}): ${issues.slice(0, 3).map((i) => `[${i.code}] ${i.where} ${i.message}`).join('; ')}`), { code: 'INTENT_INVALID' });
    }
    // A plan (series.json / request.json) is what gets rendered, so its receipt defaults to the visual task kind.
    const plan = v.plan ? json(v.plan) : null;
    if (plan && (plan.requires_brief === true || plan.profiles?.artifact === 'visual/prediction-market-carousel')) {
      const check = loadAndValidateCardNewsBrief(plan, resolve(v.plan));
      if (!check.ok) {
        console.log(JSON.stringify({ status: 'BLOCKED_CARD_NEWS_BRIEF', issues: check.issues }, null, 2));
        process.exitCode = 2;
        process.exit();
      }
    }
    const receipt = resolveEditorial(plan ? intentFromPlan(plan) : json(v.intent), { targetId: v.target ?? null, flowId: v.flow ?? null, overrides: v.overrides ? json(v.overrides) : {}, taskKind: v['task-kind'] ?? (v.plan ? 'visual' : null), reader });
    const body = `${JSON.stringify(receipt, null, 2)}\n`;
    if (v.out) writeFileSync(resolve(v.out), body); else process.stdout.write(body);
    console.error(`resolve: ${receipt.status}${receipt.profile ? ` profile=${receipt.profile.id} hash=${receipt.profile.resolved_hash.slice(0, 19)}` : ''}${receipt.integrity?.integrity === 'UNVERIFIED' ? ` integrity=UNVERIFIED(${receipt.integrity.unverified_required.length} required rule file(s) not git-verified)` : ''}${receipt.conflicts.length ? ` conflicts=${receipt.conflicts.map((c) => c.code).join(',')}` : ''}`);
    if (receipt.status !== STATUS.READY) process.exitCode = 2;
  }
} catch (e) { console.error(`[${e.code ?? 'ERROR'}] ${e.message}`); process.exitCode = e.code === 'CARD_NEWS_BRIEF_INVALID' || e.code === 'CARD_NEWS_BRIEF_REQUIRED' ? 2 : 1; }
