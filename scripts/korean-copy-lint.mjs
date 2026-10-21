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

const NUMERIC_UNITS = [
  '%p', '%', '퍼센트포인트', '퍼센트', 'bps', 'bp', 'GB', 'MB', 'TB', 'km', 'cm', 'mm', 'kg', 'g',
  '개월', '시간', '분', '초', '년', '월', '일', '주', '명', '원', '배', '개', '건', '회', '곳', '대', '점', '위', '층', '세', '살', '차', '건', '억', '만',
];

function canonicalNumber(value) {
  const [integerPart, fractionPart] = value.replaceAll(',', '').split('.');
  const integer = integerPart.replace(/^0+(?=\d)/u, '');
  const fraction = fractionPart?.replace(/0+$/u, '') ?? '';
  return fraction ? `${integer}.${fraction}` : integer;
}

function unitAt(text, index) {
  return NUMERIC_UNITS.find((unit) => text.startsWith(unit, index)) ?? '';
}

export function tokenizeNumericTokens(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const tokens = [];
  for (let index = 0; index < text.length;) {
    if (!/[0-9]/u.test(text[index]) || (index > 0 && /[0-9.]/u.test(text[index - 1]))) {
      index += 1;
      continue;
    }

    const start = index;
    let integer = '';
    while (/[0-9]/u.test(text[index] ?? '')) integer += text[index++];
    while (text[index] === ',') {
      const group = text.slice(index + 1, index + 4);
      const next = text[index + 4];
      if (!/^[0-9]{3}$/u.test(group) || (/[0-9]/u.test(next ?? ''))) break;
      integer += group;
      index += 4;
    }

    let value = integer;
    if (text[index] === '.' && /[0-9]/u.test(text[index + 1] ?? '')) {
      value += '.';
      index += 1;
      while (/[0-9]/u.test(text[index] ?? '')) value += text[index++];
    }
    const unit = unitAt(text, index);
    index += unit.length;
    tokens.push({ value: canonicalNumber(value), unit, normalized: `${canonicalNumber(value)}${unit}`, start, end: index });
  }
  return tokens;
}

export function countHeroNumericTokens(text, heroNumber) {
  const trimmedHero = heroNumber.trim();
  const heroTokens = tokenizeNumericTokens(trimmedHero);
  if (heroTokens.length !== 1 || heroTokens[0].start !== 0 || heroTokens[0].end !== trimmedHero.length) return 0;
  const hero = heroTokens[0].normalized;
  return tokenizeNumericTokens(text).filter((token) => token.normalized === hero).length;
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
    const count = countHeroNumericTokens(text, number);
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
