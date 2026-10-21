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

const MAGNITUDES = '천백십만억조';
const COMMON_UNITS = '(?:달러|명|원|개|건|배|년|월|일|시간|분|초|위|점|회|표)';
const BARE_NUMBER_MAN_PARTICLES = '(?:큼|에|의|이|은|을|도|으로)';
const CURRENCY_PREFIXES = ['US$', 'KRW', 'USD', '$', '₩', '€', '¥', '£'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function spacedCharacters(value) {
  return [...value].map(escapeRegExp).join('\\s*');
}

function parseHero(heroNumber) {
  const hero = heroNumber.replaceAll(/\s+/gu, '');
  const prefixPattern = CURRENCY_PREFIXES.map(escapeRegExp).join('|');
  const numericGroup = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)';
  const match = new RegExp(`^(?:(${prefixPattern})([+\\-−±]?)|([+\\-−±])(${prefixPattern})?|([+\\-−±]))?(${numericGroup}(?:\\.\\d+)?(?:[${MAGNITUDES}]${numericGroup}?)*)\\s*(.*)$`, 'iu').exec(hero);
  if (!match) return null;
  const [, prefixFirst = '', signAfterPrefix = '', signBeforePrefix = '', prefixAfterSign = '', bareSign = '', numericCore, rawUnit = ''] = match;
  const rawPrefix = prefixFirst || prefixAfterSign;
  const rawSign = signAfterPrefix || signBeforePrefix || bareSign;
  const unit = rawUnit.trim().replaceAll(/\s+/gu, ' ');
  const magnitude = [...numericCore].filter((char) => MAGNITUDES.includes(char)).join('');
  return {
    prefix: rawPrefix.toUpperCase(),
    sign: rawSign === '−' ? '-' : rawSign,
    numericCore,
    magnitude,
    unit,
  };
}

export function countHeroNumericTokens(text, heroNumber) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (typeof heroNumber !== 'string') return 0;
  const hero = parseHero(heroNumber);
  if (!hero) return 0;

  const sign = hero.sign ? (hero.sign === '-' ? '[-−]' : escapeRegExp(hero.sign)) : '';
  const boundary = '(?<![\\d.+\\-−±])(?<!\\d,)';
  const signed = sign ? `${sign}\\s*` : '';
  let lead = '';
  if (hero.prefix && sign) {
    const prefix = `(?<![\\p{L}\\d])${spacedCharacters(hero.prefix)}\\s*`;
    lead = `(?:${prefix}${signed}|${boundary}${signed}${spacedCharacters(hero.prefix)}\\s*)`;
  } else if (hero.prefix) {
    lead = `(?<![\\p{L}\\d])${spacedCharacters(hero.prefix)}\\s*`;
  } else if (sign) {
    lead = `${boundary}${signed}`;
  } else {
    lead = boundary;
  }
  const number = spacedCharacters(hero.numericCore);
  const unit = hero.unit ? `\\s*${spacedCharacters(hero.unit)}` : '';

  // Units terminate the numeric token: only a numeric/decimal continuation is
  // reserved (plus p/P for percent). Bare numbers and magnitudes instead reject
  // magnitude, percent, and the closed common-unit vocabulary. A bare number
  // may end before 만 when it is clearly particle-like (만큼, 만에, etc.).
  let continuation = '(?!\\d|\\.\\d)';
  if (hero.unit === '%') continuation += '(?![pP])';
  else if (!hero.unit) {
    const manParticle = hero.magnitude ? '(?!)' : `\\s*만${BARE_NUMBER_MAN_PARTICLES}`;
    continuation += `(?!(?:(?!${manParticle})\\s*[${MAGNITUDES}%]|,\\d|\\s*${COMMON_UNITS}))`;
  }

  const pattern = new RegExp(`${lead}${number}${unit}${continuation}`, 'giu');
  return [...text.matchAll(pattern)].length;
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
