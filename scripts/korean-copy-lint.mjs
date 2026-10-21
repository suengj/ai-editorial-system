#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pack = JSON.parse(readFileSync(resolve(ROOT, 'editorial/profiles/language/ko-KR.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'editorial/entry-manifest.json'), 'utf8'));

export function resolveCopyProfile(profileId) {
  const family = pack.copy_lint.profile_targets[profileId];
  if (!family) throw new Error(`unknown Korean copy profile: ${profileId}`);
  if (family !== 'economics-desk') return family;
  if (profileId === 'economics-desk') return family;
  const target = manifest.sns_targets?.[profileId];
  if (!target || target.voice_family !== 'business') throw new Error(`profile ${profileId} does not resolve to a business voice`);
  return family;
}

export function lintKoreanCopy({ text, profileId = 'general', heroNumbers = [] } = {}) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const family = resolveCopyProfile(profileId);
  const findings = [];
  for (const rule of pack.copy_lint.rules) {
    if (!rule.profiles.includes(family)) continue;
    const match = new RegExp(rule.pattern, 'u').exec(text);
    if (match) findings.push({ id: rule.id, severity: 'warn', match: match[0], message: rule.message });
  }
  for (const number of heroNumbers) {
    if (typeof number !== 'string' || number.trim() === '') continue;
    const escaped = number.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Keep decimal and thousands separators attached to the numeric token,
    // while allowing sentence punctuation after a complete value like 35%.
    const count = [...text.matchAll(new RegExp(`(?<![\\p{N}.,])${escaped}(?![\\p{N}]|[.,][\\p{N}])`, 'gu'))].length;
    if (count > 1) findings.push({ id: 'repeated-hero-number', severity: 'warn', match: number.trim(), count, message: '히어로 수치가 본문에서 반복됩니다. 반복이 독자 이해에 필요한지 확인하세요.' });
  }
  return { profile_id: profileId, profile_family: family, findings, hard_blocks: 0 };
}

function parseArgs(argv) {
  const out = { heroNumbers: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--profile') out.profileId = argv[++i];
    else if (arg === '--text') out.text = argv[++i];
    else if (arg === '--hero-number') out.heroNumbers.push(argv[++i]);
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!out.profileId || typeof out.text !== 'string') throw new Error('usage: node scripts/korean-copy-lint.mjs --profile <target-or-profile> --text <copy> [--hero-number <value>]');
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(lintKoreanCopy(parseArgs(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 2; }
}
