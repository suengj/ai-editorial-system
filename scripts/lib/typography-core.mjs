/** SUE-1614. Pure typography helpers: bundled font resolution, Korean balanced wrap, type-scale tokens, WCAG contrast. */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { isolatedEnv } from './svg-tools.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FONT_DIR = resolve(HERE, '../../assets/fonts/aes-sans-kr');
export const FONT_PREFERENCES_PATH = resolve(HERE, '../../editorial/font-preferences.v1.json');
export const FONT_INVENTORY_PATH = resolve(HERE, '../../editorial/font-inventory.v1.json');
export const ENTRY_MANIFEST_PATH = resolve(HERE, '../../editorial/entry-manifest.json');
export const BUNDLED_FAMILY = 'AES Sans KR';
export const typographyError = (code, message) => Object.assign(new Error(message), { code });

let manifestCache = null;
let preferencesCache = null;
let inventoryCache = null;
export const fontManifest = () => (manifestCache ??= JSON.parse(readFileSync(resolve(FONT_DIR, 'manifest.json'), 'utf8')));
/** AES-owned accepted candidates. The contract does not select a production default. */
const entryManifest = () => JSON.parse(readFileSync(ENTRY_MANIFEST_PATH, 'utf8'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function assertRegisteredDigest(bytes, registration, label = 'font data') {
  if (!/^[0-9a-f]{64}$/.test(registration?.sha256 ?? '') || sha256(bytes) !== registration.sha256) {
    throw typographyError('FONT_CONTRACT_INVALID', label + ' digest differs from the entry manifest');
  }
  return true;
}
function readRegisteredJson(path, registration, label) {
  const bytes = readFileSync(path);
  const relativePath = path.slice(resolve(HERE, '../../').length + 1);
  if (registration?.path !== relativePath) throw typographyError('FONT_CONTRACT_INVALID', label + ' path differs from the entry manifest');
  assertRegisteredDigest(bytes, registration, label);
  return JSON.parse(bytes.toString('utf8'));
}
const loadFontPreferences = () => (preferencesCache ??= readRegisteredJson(FONT_PREFERENCES_PATH, entryManifest().font_preferences, 'font preferences'));
export const fontPreferences = () => structuredClone(loadFontPreferences());
const loadFontInventory = () => (inventoryCache ??= readRegisteredJson(FONT_INVENTORY_PATH, entryManifest().font_inventory, 'font inventory'));
export const fontInventory = () => structuredClone(loadFontInventory());

/** Validate inspected metadata independently of the preference document's duplicated claims. */
export function validateFontInventory(inventory) {
  if (inventory?.inventory_schema !== 'aes-font-inventory/1' || inventory.coverage_sample !== '한글 타이포 2026 ₩→뷁') throw typographyError('FONT_CONTRACT_INVALID', 'font inventory or coverage sample is invalid');
  if (!Array.isArray(inventory.source_records) || inventory.source_records.length !== 5) throw typographyError('FONT_CONTRACT_INVALID', 'font inventory must contain five inspected source records');
  const expectedIds = new Set(['pretendard', 'suit', 'noto-sans-kr', 'noto-serif-kr', 'gowun-batang']);
  const seenIds = new Set();
  for (const record of inventory.source_records) {
    if (!expectedIds.has(record.font_id) || seenIds.has(record.font_id)
      || typeof record.license_contains_ofl_1_1 !== 'boolean' || record.license_contains_ofl_1_1 !== true || record.license_spdx !== 'OFL-1.1'
      || !/^[0-9a-f]{64}$/.test(record.binary_sha256 ?? '') || !/^[0-9a-f]{64}$/.test(record.license_sha256 ?? '')
      || !Number.isInteger(record.unicode_codepoints) || record.unicode_codepoints <= 0
      || typeof record.binary_file_name !== 'string' || typeof record.family !== 'string' || typeof record.face !== 'string' || typeof record.font_version !== 'string'
      || !Number.isInteger(record.os2_weight_class) || typeof record.axes !== 'object' || record.axes === null
      || record.inspection_sample !== inventory.coverage_sample || record.inspection_fonttools_version !== inventory.fonttools_version
      || record.required_sample_coverage !== true || record.missing_codepoints?.length !== 0) {
      throw typographyError('FONT_CONTRACT_INVALID', 'font inventory inspection or license failed for ' + record.font_id);
    }
    seenIds.add(record.font_id);
  }
  if (seenIds.size !== expectedIds.size || JSON.stringify(inventory) !== JSON.stringify(loadFontInventory())) throw typographyError('FONT_CONTRACT_INVALID', 'font inventory differs from its pinned canonical records');
  return true;
}

/** Validate duplicated role metadata against the AES-owned canonical font inventory. */
export function validateFontPreferences(data) {
  if (data?.schema_version !== 'aes-font-preferences/1' || data?.preference_authority !== 'AES') throw typographyError('FONT_CONTRACT_INVALID', 'unsupported AES font preference contract');
  if (data?.selection_policy?.final_default !== 'UNDECIDED' || data?.selection_policy?.silent_fallback !== 'FORBIDDEN') throw typographyError('FONT_CONTRACT_INVALID', 'font contract must preserve undecided defaults and reject silent fallback');
  const groupDefinitions = {
    video: { numbers: [1, 2], pairs: ['pretendard-pretendard', 'noto-sans-kr-noto-sans-kr'] },
    R4_photo: { numbers: [3, 4, 5], pairs: ['noto-serif-kr-pretendard', 'noto-serif-kr-suit', 'gowun-batang-suit'] },
    R7_illustrated: { numbers: [1, 2], pairs: ['pretendard-pretendard', 'noto-sans-kr-noto-sans-kr'] },
  };
  const groups = data.style_candidate_groups;
  if (groups?.selection_status !== 'OWNER_PENDING' || groups?.provisional_defaults_are_not_final_choices !== true
    || Object.keys(groups?.groups ?? {}).sort().join(',') !== Object.keys(groupDefinitions).sort().join(',')) {
    throw typographyError('FONT_CONTRACT_INVALID', 'style candidate groups must preserve OWNER_PENDING and the canonical group set');
  }
  for (const [name, expectedGroup] of Object.entries(groupDefinitions)) {
    const group = groups.groups[name];
    if (JSON.stringify(group?.candidate_numbers) !== JSON.stringify(expectedGroup.numbers)
      || JSON.stringify(group?.candidate_pair_ids) !== JSON.stringify(expectedGroup.pairs)
      || group?.provisional_default_number !== expectedGroup.numbers[0]
      || group?.provisional_default_pair_id !== expectedGroup.pairs[0]) {
      throw typographyError('FONT_CONTRACT_INVALID', `invalid ${name} font candidate group or provisional default`);
    }
  }
  const expected = {
    'pretendard-pretendard': ['pretendard', 'pretendard'],
    'noto-sans-kr-noto-sans-kr': ['noto-sans-kr', 'noto-sans-kr'],
    'noto-serif-kr-pretendard': ['noto-serif-kr', 'pretendard'],
    'noto-serif-kr-suit': ['noto-serif-kr', 'suit'],
    'gowun-batang-suit': ['gowun-batang', 'suit'],
  };
  if (!Array.isArray(data.candidate_pairs) || data.candidate_pairs.length !== Object.keys(expected).length) throw typographyError('FONT_CONTRACT_INVALID', 'candidate pair set differs from AES owner contract');
  const inventory = loadFontInventory();
  validateFontInventory(inventory);
  const inventoryDigest = sha256(readFileSync(FONT_INVENTORY_PATH));
  if (data.inventory_sha256 !== inventoryDigest || entryManifest().font_inventory.sha256 !== inventoryDigest) throw typographyError('FONT_CONTRACT_INVALID', 'preference inventory digest differs from the registered inventory');
  for (const [id, font] of Object.entries(data.font_files ?? {})) {
    const record = inventory.source_records.find((item) => item.font_id === id);
    if (!record || record.binary_sha256 !== font.sha256 || record.license_sha256 !== font.license_sha256 || record.unicode_codepoints !== font.coverage_codepoints || record.missing_codepoints.length !== 0 || font.inventory_sample !== inventory.coverage_sample
      || record.binary_file_name !== font.file || record.family !== font.family || record.face !== font.face || record.font_version !== font.font_version
      || record.os2_weight_class !== font.os2_weight_class || JSON.stringify(record.axes) !== JSON.stringify(font.axes)
      || record.required_sample_coverage !== font.required_sample_coverage) {
      throw typographyError('FONT_CONTRACT_INVALID', `inventory provenance or glyph coverage mismatch for ${id}`);
    }
  }
  for (const [pairId, roles] of Object.entries(expected)) {
    const pair = data.candidate_pairs.find((item) => item.pair_id === pairId);
    if (!pair || pair.status !== 'CANDIDATE_ACCEPTED') throw typographyError('FONT_CONTRACT_INVALID', `missing accepted pair ${pairId}`);
    for (const [i, role] of ['title', 'body'].entries()) {
      const ref = pair[role], id = roles[i], file = data.font_files?.[id];
      if (!file || ref?.font_id !== id) throw typographyError('FONT_CONTRACT_INVALID', `unexpected ${pairId}/${role} font id`);
      for (const field of ['family', 'face', 'font_version', 'sha256', 'license', 'official_source', 'coverage_codepoints']) {
        if (ref[field] !== file[field]) throw typographyError('FONT_CONTRACT_INVALID', `${pairId}/${role} ${field} does not match canonical font inventory`);
      }
      if (!Number.isFinite(ref.weight) || !Number.isInteger(ref.weight) || !Number.isFinite(file.os2_weight_class) || !/^[0-9a-f]{64}$/.test(file.sha256 ?? '') || !/^[0-9a-f]{64}$/.test(file.license_sha256 ?? '') || !file.license?.includes('OFL 1.1') || !file.official_source || !file.font_version) {
        throw typographyError('FONT_CONTRACT_INVALID', `incomplete or invalid metadata for ${pairId}/${role}`);
      }
      const axis = file.axes?.wght;
      if (axis) {
        const axes = ref.variable_axes;
        if (!axes || Object.keys(axes).length !== 1 || axes.wght !== ref.weight || !Number.isFinite(axis.min) || !Number.isFinite(axis.max) || ref.weight < axis.min || ref.weight > axis.max) {
          throw typographyError('FONT_WEIGHT_UNAVAILABLE', `${pairId}/${role} requests unsupported wght ${ref.weight}`);
        }
      } else if ((ref.variable_axes && Object.keys(ref.variable_axes).length) || ref.weight !== file.os2_weight_class) {
        throw typographyError('FONT_WEIGHT_UNAVAILABLE', `${pairId}/${role} does not match its static font face weight`);
      }
    }
  }
  if (data.selection_policy.excluded_pairs?.includes('suit-suit') !== true || data.selection_policy.excluded_pairs?.includes('ibm-plex-sans-kr-ibm-plex-sans-kr') !== true) throw typographyError('FONT_CONTRACT_INVALID', 'excluded candidate pairs must remain excluded');
  if (JSON.stringify(data) !== JSON.stringify(loadFontPreferences())) throw typographyError('FONT_CONTRACT_INVALID', 'font preference data differs from the immutable AES contract');
  return true;
}

/** Resolve a pair and its semantic text roles; mixed families are intentional and preserved. */
export function resolveFontPair(pairId) {
  const data = loadFontPreferences();
  validateFontPreferences(data);
  const pair = data.candidate_pairs.find((item) => item.pair_id === pairId);
  if (!pair || pair.status !== 'CANDIDATE_ACCEPTED') throw typographyError('FONT_PAIR_UNRESOLVED', `unknown or unaccepted AES font pair: ${pairId}`);
  return structuredClone(pair);
}

/** The bundled font is "requested" only when it is the FIRST family of a stack, so existing stacks are never re-interpreted. */
export const requestsBundledFont = (stack) => typeof stack === 'string' && stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '') === BUNDLED_FAMILY;

export function coversCodePoint(cp) {
  return fontManifest().ranges.some(([a, b]) => cp >= a && cp <= b);
}

/** FONT_FALLBACK when a requested weight or glyph is not in the bundle: never a silent substitution. */
export function assertFontCoverage(text, weight) {
  const m = fontManifest();
  if (!m.weights.includes(weight)) throw typographyError('FONT_FALLBACK', `${BUNDLED_FAMILY} has weights ${m.weights.join('/')}; requested ${weight} would be substituted`);
  const missing = [...new Set([...text].filter((ch) => !/\s/.test(ch) && !coversCodePoint(ch.codePointAt(0))))];
  if (missing.length) throw typographyError('FONT_FALLBACK', `glyphs not in ${BUNDLED_FAMILY} subset would be substituted: ${missing.slice(0, 8).join(' ')}`);
}

/** Digest of manifest.json + every bundled font file; part of render-reuse fingerprints. */
export function bundledFontDigest() {
  const h = createHash('sha256'), m = fontManifest();
  h.update(readFileSync(resolve(FONT_DIR, 'manifest.json')));
  for (const f of Object.values(m.files)) h.update(readFileSync(resolve(FONT_DIR, f)));
  return `sha256:${h.digest('hex')}`;
}

/** Environment that makes the rasterizer see ONLY the bundled fonts (no system fonts, same result on any machine). */
export function bundledFontEnv() {
  const tag = createHash('sha256').update(FONT_DIR).digest('hex').slice(0, 12);
  const dir = resolve(tmpdir(), `aes-fontconfig-${tag}`);
  const conf = resolve(dir, 'fonts.conf');
  if (!existsSync(conf)) {
    mkdirSync(resolve(dir, 'cache'), { recursive: true });
    writeFileSync(conf, `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${FONT_DIR}</dir><cachedir>${resolve(dir, 'cache')}</cachedir></fontconfig>\n`);
  }
  // PANGOCAIRO_BACKEND=fc: on macOS pango defaults to CoreText, which ignores FONTCONFIG_FILE and would silently use system fonts.
  return { FONTCONFIG_FILE: conf, FONTCONFIG_PATH: dir, PANGOCAIRO_BACKEND: 'fc' };
}

/** Ask fontconfig what it would actually use; FONT_FALLBACK unless it is the bundled file. Skipped (null) without fc-match. */
export function verifyBundledResolution(weight, env = bundledFontEnv()) {
  const r = spawnSync('fc-match', ['-f', '%{file}', `${BUNDLED_FAMILY}:weight=${fcWeight(weight)}`], { env: isolatedEnv(env), encoding: 'utf8', timeout: 5000 });
  if (r.error || r.status !== 0) return null;
  const want = fontManifest().files[String(weight)];
  if (!r.stdout.endsWith(want)) throw typographyError('FONT_FALLBACK', `fontconfig resolved ${BUNDLED_FAMILY} ${weight} to ${r.stdout || 'nothing'}, not ${want}`);
  return r.stdout;
}
const fcWeight = (w) => ({ 400: 80, 600: 180, 800: 205, 900: 210 }[w] ?? w);

/** Type-scale tokens per role. Opt-in: nothing reads these unless a layer/text_style asks via `scale`. */
export const TYPE_SCALE = Object.freeze({
  display:  { font_size: 132, weight: 900, letter_spacing: -0.03, line_height: 1.08, max_lines: 3 },
  headline: { font_size: 96,  weight: 800, letter_spacing: -0.025, line_height: 1.14, max_lines: 3 },
  dek:      { font_size: 44,  weight: 600, letter_spacing: -0.01, line_height: 1.35, max_lines: 3 },
  body:     { font_size: 36,  weight: 400, letter_spacing: 0, line_height: 1.5, max_lines: 6 },
  caption:  { font_size: 28,  weight: 400, letter_spacing: 0, line_height: 1.4, max_lines: 3 },
  source:   { font_size: 24,  weight: 400, letter_spacing: 0.005, line_height: 1.3, max_lines: 2 },
});
export function resolveScale(role, overrides = {}, scale = TYPE_SCALE) {
  if (!Object.hasOwn(scale, role)) throw typographyError('TYPE_SCALE_ROLE', `unknown type-scale role: ${role}`);
  return { ...scale[role], ...overrides };
}

/** Punctuation/number normalisation (opt-in per layer). Curly quotes, ellipsis, space after , . before a letter. */
export function normalizeKoreanText(text) {
  let t = String(text).replace(/\s+/g, ' ').trim();
  t = t.replace(/\.\.\./g, '…');
  let dq = 0; t = t.replace(/"/g, () => (dq++ % 2 === 0 ? '“' : '”'));
  t = t.replace(/(^|[\s(\[])'/g, '$1‘').replace(/'/g, '’');
  t = t.replace(/([가-힣A-Za-z]),(?=[가-힣A-Za-z])/g, '$1, ').replace(/([가-힣])\.(?=[가-힣A-Z])/g, '$1. ');
  return t;
}

const UNIT = /^(%|원|명|개|억|조|만|천|배|년|월|일|위|곳|건|회|kg|km|GB|MB|x)[,.)]?$/;
const NUM = /^[(“‘]?[+\-−]?[\d][\d,.]*$/;

/** Space-separated eojeol atoms with absolute offsets; "12 %"-style number+unit pairs stay together. */
export function atomize(text) {
  const atoms = []; const re = /\S+/g; let m;
  while ((m = re.exec(text))) atoms.push({ start: m.index, end: m.index + m[0].length, w: m[0] });
  const out = [];
  for (const a of atoms) {
    const prev = out.at(-1);
    if (prev && NUM.test(prev.w) && UNIT.test(a.w)) { prev.end = a.end; prev.w += ` ${a.w}`; } else out.push({ ...a });
  }
  return out;
}

/** Character runs with per-run weight so emphasised (heavier) spans are measured at their real width. */
export function weightRuns(text, start, end, baseWeight, emphasis = []) {
  const cuts = new Set([start, end]);
  for (const e of emphasis) for (const p of [e.start, e.end]) if (p > start && p < end) cuts.add(p);
  const pts = [...cuts].sort((a, b) => a - b), runs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const em = emphasis.find((e) => e.start <= pts[i] && e.end >= pts[i + 1]);
    runs.push({ text: text.slice(pts[i], pts[i + 1]), start: pts[i], end: pts[i + 1], weight: em?.weight ?? baseWeight, color: em?.color ?? null });
  }
  return runs;
}

export function locateEmphasis(text, spans = []) {
  return spans.map((s) => {
    const start = text.indexOf(s.match);
    if (!s.match || start < 0) throw typographyError('EMPHASIS_NOT_FOUND', `emphasis "${s.match}" is not in the text; the code prints text exactly, it never rewrites it`);
    return { start, end: start + s.match.length, weight: s.weight, color: s.color };
  });
}

/**
 * Balanced Korean wrap. Break only at spaces (eojeol); an over-wide eojeol is split by grapheme as a last resort.
 * Same line count as greedy, minimal raggedness, and a last line of 1-2 characters (orphan) is avoided
 * (by rebalancing, else by one extra line when maxLines allows).
 * `measure(text, size, weight)` is the real glyph measurer; `emphasis` is pre-located ({start,end,weight}).
 */
export function balancedWrap(text, { width, size, weight = 400, maxLines, emphasis = [] }, measure) {
  if (typeof text !== 'string' || text.length > 2000) throw typographyError('TEXT_OVERFLOW', 'expected text up to 2000 characters');
  const lines = [];
  let offset = 0;
  for (const para of text.split('\n')) {
    const paraEm = emphasis.map((e) => ({ ...e, start: e.start - offset, end: e.end - offset })).filter((e) => e.end > 0 && e.start < para.length);
    lines.push(...wrapParagraph(para, { width, size, weight, maxLines, emphasis: paraEm }, measure));
    offset += para.length + 1;
  }
  if (lines.length > maxLines) throw typographyError('TEXT_OVERFLOW', `${lines.length} lines do not fit in ${maxLines}; text was not truncated`);
  return lines;
}

function wrapParagraph(para, { width, size, weight, maxLines, emphasis }, measure) {
  let atoms = atomize(para);
  if (!atoms.length) return [''];
  const lineW = (i, j) => weightRuns(para, atoms[i].start, atoms[j].end, weight, emphasis).reduce((s, r) => s + measure(r.text, size, r.weight), 0);
  // split atoms that cannot fit alone
  const split = [];
  for (const a of atoms) {
    if (lineW0(a) <= width) { split.push(a); continue; }
    let s = a.start;
    for (const { segment, index } of new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(a.w)) {
      const e = a.start + index + segment.length;
      if (e > s && weightRuns(para, s, e, weight, emphasis).reduce((t, r) => t + measure(r.text, size, r.weight), 0) > width && e - 1 > s) { split.push({ start: s, end: e - 1, w: para.slice(s, e - 1), joined: true }); s = e - 1; }
    }
    split.push({ start: s, end: a.end, w: para.slice(s, a.end), joined: false });
  }
  function lineW0(a) { return weightRuns(para, a.start, a.end, weight, emphasis).reduce((t, r) => t + measure(r.text, size, r.weight), 0); }
  atoms = split;
  const N = atoms.length;
  const cache = new Map();
  const W = (i, j) => { const k = i * 1000 + j; if (!cache.has(k)) cache.set(k, lineW(i, j)); return cache.get(k); };
  // greedy line count
  let greedy = 0;
  for (let i = 0; i < N;) { let j = i; while (j + 1 < N && W(i, j + 1) <= width) j++; i = j + 1; greedy++; }
  const solve = (k) => {
    const INF = 1e9, dp = Array.from({ length: k + 1 }, () => Array(N + 1).fill(INF)), from = Array.from({ length: k + 1 }, () => Array(N + 1).fill(-1));
    dp[0][0] = 0;
    for (let l = 1; l <= k; l++) for (let j = l; j <= N; j++) for (let i = j - 1; i >= l - 1; i--) {
      const w = W(i, j - 1); if (w > width) break;
      if (dp[l - 1][i] >= INF) continue;
      const slack = (width - w) / width; let cost;
      if (j === N) { // last line
        const chars = [...para.slice(atoms[i].start, atoms[N - 1].end).replace(/\s/g, '')].length;
        cost = (chars <= 2 ? 1000 : 0) + (j - i === 1 && w < width * 0.25 ? 4 : 0) + slack * slack * 0.3;
      } else cost = slack * slack;
      if (dp[l - 1][i] + cost < dp[l][j]) { dp[l][j] = dp[l - 1][i] + cost; from[l][j] = i; }
    }
    if (dp[k][N] >= INF) return null;
    const out = []; let j = N;
    for (let l = k; l >= 1; l--) { const i = from[l][j]; out.unshift([i, j - 1]); j = i; }
    return { cost: dp[k][N], ranges: out };
  };
  let best = solve(greedy);
  if ((!best || best.cost >= 1000) && greedy + 1 <= maxLines && N > greedy) { const b2 = solve(greedy + 1); if (b2 && (!best || b2.cost < best.cost)) best = b2; }
  if (!best) throw typographyError('TEXT_OVERFLOW', 'balanced wrap found no layout');
  return best.ranges.map(([i, j]) => para.slice(atoms[i].start, atoms[j].end));
}

/** Last-line orphan test used by tests and evidence: true when the last line is 1-2 chars. */
export const hasOrphan = (lines) => lines.length > 1 && [...lines.at(-1).replace(/\s/g, '')].length <= 2;

// ---- WCAG contrast -------------------------------------------------------------------------------------------------
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrastRatio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
export const blend = (bg, fg, a) => bg.map((c, i) => c * (1 - a) + fg[i] * a);

/** Worst-case background pixel under text of a given luminance: p95 for light text, p5 for dark text. Returns [r,g,b]. */
export function worstBackground(img, rect, textRgb) {
  const ch = img.channels ?? 4, px = [];
  const x0 = Math.max(0, Math.floor(rect.x)), x1 = Math.min(img.width, Math.ceil(rect.x + rect.width));
  const y0 = Math.max(0, Math.floor(rect.y)), y1 = Math.min(img.height, Math.ceil(rect.y + rect.height));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * img.width + x) * ch; px.push([img.pixels[o], img.pixels[o + 1], img.pixels[o + 2]]); }
  if (!px.length) throw typographyError('CONTRAST_REGION', 'empty text region');
  px.sort((a, b) => luminance(a) - luminance(b));
  const light = luminance(textRgb) >= 0.18;
  return px[Math.min(px.length - 1, Math.max(0, Math.floor(px.length * (light ? 0.95 : 0.05))))];
}

/** Smallest scrim opacity (0..max) so text keeps `target` contrast over the worst background pixel; null if unreachable. */
export function autoScrimOpacity(bgRgb, textRgb, scrimRgb, target, max = 0.92) {
  const ok = (a) => contrastRatio(textRgb, blend(bgRgb, scrimRgb, a)) >= target + 0.05;
  if (ok(0)) return 0;
  if (!ok(max)) return null;
  let lo = 0, hi = max;
  for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; }
  return Math.ceil(hi * 100) / 100;
}
