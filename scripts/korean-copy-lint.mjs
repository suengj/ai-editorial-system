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

function canonicalNumber(value) {
  const [integerPart, fractionPart] = value.replaceAll(',', '').split('.');
  const integer = integerPart.replace(/^0+(?=\d)/u, '');
  const fraction = fractionPart?.replace(/0+$/u, '') ?? '';
  return fraction ? `${integer}.${fraction}` : integer;
}

function canonicalSign(sign) {
  return sign === '−' ? '-' : sign;
}

function canonicalUnit(unit) {
  // Korean particles and sentence endings may follow a unit without spacing:
  // e.g. 35%다, 35명은. Keep the unit itself intact and exclude that suffix.
  const suffix = /(?:에서|으로|까지|부터|보다|은|는|이|가|을|를|의|에|로|와|과|도|다)$/u;
  const match = suffix.exec(unit);
  if (match && match.index > 0) unit = unit.slice(0, match.index);
  return unit.toLowerCase().replaceAll(/\s/gu, '');
}

export function tokenizeNumericTokens(text) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const tokens = [];
  for (let index = 0; index < text.length;) {
    const signStart = /[+\-−±]/u.test(text[index] ?? '') && /[0-9]/u.test(text[index + 1] ?? '');
    const digitStart = /[0-9]/u.test(text[index] ?? '');
    if (!signStart && !digitStart) {
      index += 1;
      continue;
    }

    const start = index;
    const previous = text[index - 1] ?? '';
    const previousPrevious = text[index - 2] ?? '';
    if (/[0-9.]/u.test(previous) || (previous === ',' && /[0-9]/u.test(previousPrevious)) || (/[+\-−±]/u.test(previous) && digitStart) || (signStart && /[\p{L}\p{N}_]/u.test(previous))) {
      index += 1;
      continue;
    }
    const sign = signStart ? canonicalSign(text[index++]) : '';
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
    const numberEnd = index;
    while (/\s/u.test(text[index] ?? '')) index += 1;
    const unitStart = index;
    while (/[\p{L}\p{S}%]/u.test(text[index] ?? '')) index += 1;
    const rawUnit = text.slice(unitStart, index);
    const unit = canonicalUnit(rawUnit);
    const canonicalValue = canonicalNumber(value);
    tokens.push({ sign, value: canonicalValue, unit, normalized: `${sign}${canonicalValue}${unit}`, start, end: rawUnit ? index : numberEnd });
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
