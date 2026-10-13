#!/usr/bin/env node
/**
 * SUE-1426 fix round: regression tests for the review blockers (B1-B3) and should-fix items (S1-S6)
 * of the common editorial entry. Behaviour through the CLIs where the finding was through the CLI.
 * Documented commands are executed exactly as written in the docs (only /tmp and external inputs are mapped).
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadBusinessMagazineProfile } from './lib/business-magazine-core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
let pass = 0, fail = 0;
export const test = (name, fn) => { try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); } };
export const eq = (a, b, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
export const yes = (c, m) => { if (!c) throw new Error(m); };
const tmp = () => mkdtempSync(resolve(tmpdir(), 'aes-hard-'));
const run = (args, opts = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', ...opts });
const hasRasterizer = spawnSync('which', ['rsvg-convert'], { encoding: 'utf8' }).status === 0;

// --- documented commands, executed as written ---------------------------------------------------
/** Fenced shell blocks of a doc -> list of {line} commands (continuations joined), comments dropped. */
function docCommands(file, include) {
  const text = readFileSync(resolve(ROOT, file), 'utf8');
  const out = [];
  for (const block of text.matchAll(/```(?:bash|sh)\n([\s\S]*?)```/g)) {
    const joined = block[1].replace(/\\\n\s*/g, ' ');
    for (const raw of joined.split('\n')) {
      const line = raw.trim();
      if (!line.startsWith('node scripts/') || line.includes('/path/to') || line.includes('/path/')) continue;
      if (include(line)) out.push(line);
    }
  }
  return out;
}
/** Run one documented command: only /tmp/ and the stated external inputs are mapped to a scratch dir. */
function runDoc(line, scratch, map = {}) {
  let l = line.replaceAll('/tmp/', `${scratch}/`);
  for (const [a, b] of Object.entries(map)) l = l.replaceAll(a, b);
  const args = l.split(/\s+/).slice(1);
  return run(args);
}

console.log('B3a: documented render commands work end to end');
const profile = loadBusinessMagazineProfile(), day = '2026-10-08';
const evidence = { schema_version: '1.0.0', as_of: day,
  sources: [{ id: 's1', url: 'https://example.com/a', title: 'Synthetic source A', kind: 'official', published_at: null, checked_at: day }, { id: 's2', url: 'https://example.com/b', title: 'Synthetic source B', kind: 'official', published_at: day, checked_at: day }],
  claims: [{ id: 'a', kind: 'fact', text: 'Synthetic A offers a service.', source_ids: ['s1'] }, { id: 'b', kind: 'fact', text: 'Synthetic B offers an adjacent service.', source_ids: ['s2'] }, { id: 'h', kind: 'assumption', text: 'A small paid experiment is proposed.', source_ids: [] }],
  cases: [{ id: 'a', name: 'Synthetic A', match: 'same_model', claim_ids: ['a'] }, { id: 'b', name: 'Synthetic B', match: 'adjacent', claim_ids: ['b'] }] };
const packet = { schema_version: '1.0.0', series_id: 'bizmag-test', request: '가상 자료로 5장 계획을 검증한다.', series_label: 'BUSINESS IDEA / TEST', evidence_ref: 'evidence.json',
  idea: { problem: 'unused capacity', target: 'small shops', payer: 'buyer', mechanism: 'matching', revenue: 'proposed transaction fee' },
  money: { value_flow: 'shop to buyer', payment_flow: 'buyer to platform to shop', platform_revenue: 'fee, not gross transaction volume', main_cost: 'support and settlement' },
  frames: profile.frame_roles.map((role, i) => ({ role, headline: `가상 제목 ${i + 1}`, body: '가상 설명입니다.', takeaway: '가상 의미입니다.', alt_text: '가상 검증용 카드입니다.', claim_ids: [i === 2 ? 'a' : i === 3 ? 'b' : 'h'], ...(i === 2 ? { case_id: 'a' } : {}), ...(i === 3 ? { case_id: 'b', case_mode: 'compare' } : {}) })), caption: 'Synthetic fixture. Not a real company claim.' };

test('BUSINESS-IDEA-MAGAZINE.md: the Signalytics packet flow (compile -> resolve --plan -> render, then --previous revision) runs as written', () => {
  const scratch = tmp(); writeFileSync(resolve(scratch, 'evidence.json'), JSON.stringify(evidence)); writeFileSync(resolve(scratch, 'packet.json'), JSON.stringify(packet));
  const cmds = docCommands('editorial/BUSINESS-IDEA-MAGAZINE.md', (l) => /compile-business-magazine|resolve-editorial|render-carousel/.test(l));
  yes(cmds.length === 4, `expected compile, resolve, 2 renders in the doc; got ${cmds.length}: ${cmds.join(' | ')}`);
  yes(cmds.some((c) => c.includes('resolve-editorial.mjs --plan') && c.includes('--target signalytics-news')), 'doc has no resolve-editorial --plan --target step');
  for (const c of cmds) {
    if (c.includes('bizmag-revised')) { // the doc says "revised spec"; produce one headline edit
      const s = JSON.parse(readFileSync(resolve(scratch, 'bizmag-plan/series.json'), 'utf8')); s.frames[1].blocks = s.frames[1].blocks; s.frames[1].headline = '수정한 제목';
      mkdirSync(resolve(scratch, 'bizmag-revised'), { recursive: true }); writeFileSync(resolve(scratch, 'bizmag-revised/series.json'), JSON.stringify(s));
    }
    const r = runDoc(c, scratch, { '/content/packet.json': resolve(scratch, 'packet.json') });
    const rendering = /render-carousel/.test(c);
    yes(r.status === 0 || (rendering && !hasRasterizer && r.status === 2), `\`${c}\` exit ${r.status}: ${r.stderr.slice(0, 300)}`);
  }
  if (hasRasterizer) yes(existsSync(resolve(scratch, 'bizmag-second/series.json')), 'revised render wrote no manifest');
});
test('README.md and STRUCTURED-VISUAL-EXECUTION.md: card and series commands run as written (receipt step included)', () => {
  const scratch = tmp();
  for (const file of ['README.md', 'editorial/STRUCTURED-VISUAL-EXECUTION.md']) {
    const cmds = docCommands(file, (l) => /resolve-editorial|render-visual|render-carousel/.test(l) && /fixtures\/(visual-execution|carousel)/.test(l));
    yes(cmds.some((c) => c.includes('resolve-editorial.mjs --plan')) && cmds.some((c) => c.includes('--profile-receipt')), `${file}: receipt step missing`);
    for (const c of cmds) {
      const r = runDoc(c, scratch);
      const rendering = !/resolve-editorial/.test(c) && !/--compile-only/.test(c);
      yes(r.status === 0 || (rendering && !hasRasterizer && r.status === 2), `${file}: \`${c}\` exit ${r.status}: ${r.stderr.slice(0, 300)}`);
    }
  }
});
test('resolve-editorial --plan derives surface/artifact; the account is never inferred', () => {
  const r = run(['scripts/resolve-editorial.mjs', '--plan', 'scripts/fixtures/carousel/series.json']);
  eq(r.status, 2); yes(/TARGET_REQUIRED/.test(r.stderr + r.stdout), 'target required');
  const ok = run(['scripts/resolve-editorial.mjs', '--plan', 'scripts/fixtures/carousel/series.json', '--target', 'signalytics-news']);
  eq(ok.status, 0, ok.stderr);
});

console.log(`\nresolve-hardening: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
