/** SUE-1616: deterministic prompt, native-card intake, and post-session chrome. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { dirname, resolve as resolvePath } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validate } from './json-schema-lite.mjs';
import { decodePng, encodePng, FONT_STACK } from './watermark-core.mjs';
import { esc, findRasterizer, rasterize, svgDocument, textMeasurer } from './svg-tools.mjs';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const REVIEW_SCHEMA = JSON.parse(readFileSync(resolve(ROOT, 'schemas/native-card-review.schema.json'), 'utf8'));
const FEEDBACK_SCHEMA = JSON.parse(readFileSync(resolve(ROOT, 'schemas/feedback-record.schema.json'), 'utf8'));

export const NATIVE_CARD_GEOMETRY = Object.freeze({ width: 1080, height: 1350, aspect_ratio: '4:5' });
export const NATIVE_CHROME_BANDS = Object.freeze([{ y: 0, height: 140 }, { y: 1240, height: 110 }]);

/** Pure deterministic prompt text. Exact copy is JSON-quoted and never paraphrased. */
export function buildNativeCardPrompt(frame, { palette, fontFamily = FONT_STACK } = {}) {
  const direction = frame?.art_direction;
  if (direction?.render_method !== 'native_card') fail('NATIVE_PROMPT_METHOD', 'frame render_method must be native_card');
  if (!Array.isArray(direction.native_prompt_strings) || !direction.native_prompt_strings.length
    || direction.native_prompt_strings.some((value) => !text(value))) fail('NATIVE_PROMPT_STRINGS', 'exact native_prompt_strings are required');
  if (!object(palette) || !['background', 'foreground', 'accent'].every((key) => /^#[0-9a-f]{6}$/i.test(palette[key] ?? ''))) {
    fail('NATIVE_PROMPT_TOKENS', 'resolved background, foreground, and accent palette tokens are required');
  }
  const strings = direction.native_prompt_strings.map((value, index) => `${index + 1}. ${JSON.stringify(value)}`).join('\n');
  return [
    'Create one complete editorial carousel card as a portrait 4:5 image at 1080x1350 pixels.',
    `Frame purpose: ${direction.message}`,
    `Focal subject: ${direction.focal_subject}`,
    `Resolved palette tokens: ${JSON.stringify({ background: palette.background, foreground: palette.foreground, accent: palette.accent })}`,
    `Font family guidance: ${fontFamily}`,
    'Render each quoted string exactly once, in this order. Preserve every character, punctuation mark, and line break; do not translate, rewrite, omit, or add text:',
    strings,
    'No logos, brand marks, plates, signage, watermark, or text other than the quoted strings.',
    'Leave the top chrome band at y=0..139 and bottom chrome band at y=1240..1349 completely empty for deterministic post-render composition.',
  ].join('\n');
}

/** Return the newest PNG by modification time; filename breaks ties deterministically. */
export function findNewestNativePng(directory, { listFiles = (dir) => readdirSync(dir, { withFileTypes: true }).map((entry) => {
  const path = resolve(dir, entry.name);
  return { path, isFile: entry.isFile(), mtimeMs: entry.isFile() ? statSync(path).mtimeMs : -1 };
}) } = {}) {
  const candidates = listFiles(directory).filter((entry) => entry?.isFile && extname(entry.path).toLowerCase() === '.png' && Number.isFinite(entry.mtimeMs));
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || basename(a.path).localeCompare(basename(b.path)));
  if (!candidates.length) fail('NATIVE_INPUT_MISSING', `no PNG in native source directory: ${directory}`);
  return candidates[0].path;
}

function resizeToCard(bytes, image, rasterizer) {
  const data = bytes.toString('base64');
  const svg = svgDocument(NATIVE_CARD_GEOMETRY.width, NATIVE_CARD_GEOMETRY.height,
    `<image width="1080" height="1350" preserveAspectRatio="none" xlink:href="data:image/png;base64,${data}"/>`);
  const resized = rasterize(svg, rasterizer);
  const checked = decodePng(resized);
  if (checked.width !== 1080 || checked.height !== 1350) fail('NATIVE_CARD_GEOMETRY', 'normalizer did not produce 1080x1350 PNG');
  return resized;
}

/** Validate a native_session receipt and normalize only aspect-correct PNGs to the fixed 4:5 canvas. */
export function intakeNativeCard({ pngPath, sourceDir, receipt, baseDir = process.cwd(), findNewestFile = findNewestNativePng, rasterizer = null } = {}) {
  if (!object(receipt) || Object.keys(receipt).some((key) => !['route', 'sha256'].includes(key)) || receipt.route !== 'native_session'
    || !/^sha256:[a-f0-9]{64}$/.test(receipt.sha256 ?? '')) fail('NATIVE_RECEIPT_INVALID', 'receipt must contain route native_session and a sha256 digest');
  let selectedBy = 'png_path', ref = pngPath;
  if (!text(ref)) {
    if (!text(sourceDir)) fail('NATIVE_INPUT_MISSING', 'provide pngPath or sourceDir');
    const dir = resolve(baseDir, sourceDir);
    ref = findNewestFile(dir);
    selectedBy = 'source_dir_newest';
  }
  const path = resolve(baseDir, ref);
  const bytes = readFileSync(path);
  const sourceSha = sha256(bytes);
  if (sourceSha !== receipt.sha256) fail('NATIVE_RECEIPT_HASH_MISMATCH', 'native_session receipt sha256 does not match the selected PNG');
  const image = decodePng(bytes);
  const ratio = image.width / image.height;
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 64 || image.height < 64 || image.width > 8192 || image.height > 8192
    || image.width * image.height > 25000000) fail('NATIVE_CARD_SIZE', 'native PNG dimensions must be 64–8192px and at most 25MP');
  if (Math.abs(ratio - 4 / 5) > 0.001) fail('NATIVE_CARD_ASPECT', `native PNG must be 4:5 (received ${image.width}:${image.height})`);
  const normalizedBytes = image.width === 1080 && image.height === 1350 ? bytes : resizeToCard(bytes, image, rasterizer ?? findRasterizer());
  const normalized = decodePng(normalizedBytes);
  const record = {
    schema_version: '1.0.0', route: 'native_session', selected_by: selectedBy,
    source_ref: ref, source_sha256: sourceSha,
    source_geometry: { width: image.width, height: image.height },
    geometry: { width: normalized.width, height: normalized.height, aspect_ratio: '4:5' },
    normalized_sha256: sha256(normalizedBytes), normalization: image.width === 1080 && image.height === 1350 ? 'identity' : 'rsvg_resize',
  };
  return { bytes: normalizedBytes, sourceBytes: bytes, path, receipt: record };
}

/** Resolve a kicker exclusively from the target entry in the supplied public catalog. */
export function resolveTargetDisplayLabel(targetId, catalog) {
  const target = catalog?.targets?.find((entry) => entry?.id === targetId);
  if (!target || !text(target.label)) fail('UNRESOLVED_LABEL', `target display label is unavailable for ${targetId ?? '<no target>'}`);
  return target.label;
}

function pixelAt(image, x, y) { return (y * image.width + x) * image.channels; }
function pixelEqual(a, ai, b, bi) {
  for (let channel = 0; channel < a.channels; channel++) if (a.pixels[ai + channel] !== b.pixels[bi + channel]) return false;
  return true;
}
function inChromeBand(y) { return NATIVE_CHROME_BANDS.some(({ y: top, height }) => y >= top && y < top + height); }
function countOutsideChanges(before, after) {
  let count = 0;
  for (let y = 0; y < before.height; y++) if (!inChromeBand(y)) for (let x = 0; x < before.width; x++) {
    if (!pixelEqual(before, pixelAt(before, x, y), after, pixelAt(after, x, y))) count++;
  }
  return count;
}

/** Draw only the top/bottom chrome bands and prove every body pixel is unchanged. */
export function renderNativeChrome(cardBytes, { label, sourceLine, pageMark, tokens, rasterizer = null } = {}) {
  if (!text(label)) fail('UNRESOLVED_LABEL', 'native card chrome needs a catalog-resolved target display label');
  if (!text(sourceLine) || !text(pageMark)) fail('NATIVE_CHROME_TEXT', 'source line and page mark are required');
  if (!object(tokens) || !/^#[0-9a-f]{6}$/i.test(tokens.background ?? '') || !/^#[0-9a-f]{6}$/i.test(tokens.foreground ?? '')) {
    fail('NATIVE_CHROME_TOKENS', 'resolved background and foreground palette tokens are required');
  }
  const original = decodePng(cardBytes);
  if (original.width !== 1080 || original.height !== 1350) fail('NATIVE_CARD_GEOMETRY', 'chrome overlay requires a normalized 1080x1350 card');
  const adapter = rasterizer ?? findRasterizer();
  const fontFamily = tokens.font_family ?? FONT_STACK;
  const measure = textMeasurer(adapter, fontFamily);
  const labelWidth = measure(label, 28, 700) + [...label].length * 3;
  const sourceWidth = measure(sourceLine, 24, 400);
  const pageWidth = measure(pageMark, 26, 400);
  if (labelWidth > 936) fail('NATIVE_CHROME_OVERFLOW', 'catalog target display label does not fit its chrome band');
  if (sourceWidth + pageWidth + 36 > 936) fail('NATIVE_CHROME_OVERFLOW', 'source line and page mark do not fit on the fixed footer line');
  const svg = svgDocument(1080, 1350, [
    `<rect x="0" y="0" width="1080" height="140" fill="${tokens.background}"/>`,
    `<rect x="0" y="1240" width="1080" height="110" fill="${tokens.background}"/>`,
    `<text x="72" y="86" font-family="${esc(fontFamily)}" font-size="28" font-weight="700" letter-spacing="3" fill="${tokens.foreground}">${esc(label)}</text>`,
    `<rect x="72" y="104" width="936" height="2" fill="${tokens.foreground}"/>`,
    `<text x="72" y="1296" font-family="${esc(fontFamily)}" font-size="24" font-weight="400" fill="${tokens.foreground}">${esc(sourceLine)}</text>`,
    `<text x="1008" y="1296" text-anchor="end" font-family="${esc(fontFamily)}" font-size="26" font-weight="400" fill="${tokens.foreground}">${esc(pageMark)}</text>`,
  ].join(''));
  const overlay = decodePng(rasterize(svg, adapter));
  if (overlay.width !== original.width || overlay.height !== original.height || overlay.channels !== 4) fail('NATIVE_CHROME_OVERLAY', 'chrome raster must be a same-size RGBA PNG');
  const output = { ...original, pixels: Buffer.from(original.pixels) };
  for (let y = 0; y < output.height; y++) if (inChromeBand(y)) for (let x = 0; x < output.width; x++) {
    const oi = pixelAt(overlay, x, y), di = pixelAt(output, x, y), sourceAlpha = overlay.pixels[oi + 3] / 255;
    if (!sourceAlpha) continue;
    const destAlpha = output.channels === 4 ? output.pixels[di + 3] / 255 : 1;
    const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
    for (let c = 0; c < 3; c++) output.pixels[di + c] = Math.round((overlay.pixels[oi + c] * sourceAlpha + output.pixels[di + c] * destAlpha * (1 - sourceAlpha)) / outAlpha);
    if (output.channels === 4) output.pixels[di + 3] = Math.round(outAlpha * 255);
  }
  const bytes = encodePng(output);
  const decoded = decodePng(bytes);
  const outsideChangedPixels = countOutsideChanges(original, decoded);
  if (outsideChangedPixels !== 0) fail('NATIVE_CHROME_OUTSIDE_BANDS', `${outsideChangedPixels} pixels changed outside chrome bands`);
  return {
    bytes,
    proof: {
      schema_version: '1.0.0', label, source_line: sourceLine, page_mark: pageMark,
      bands: NATIVE_CHROME_BANDS.map((band) => ({ ...band })),
      tokens: { background: tokens.background, foreground: tokens.foreground, font_family: fontFamily },
      source_sha256: sha256(cardBytes), output_sha256: sha256(bytes), outside_changed_pixels: outsideChangedPixels,
    },
  };
}

function expectedStatus(review) {
  if (review.logo_detected) return 'LOGO_DETECTED';
  if (!review.chrome_match) return 'CHROME_MISMATCH';
  if (JSON.stringify(review.expected_strings) !== JSON.stringify(review.observed_strings)) return 'TEXT_MISMATCH';
  return 'PASS';
}

/** Validate the independent reviewer record, its exact text arrays, and the post-chrome card hash. */
export function validateNativeCardReview(review, { expectedStrings, cardSha256 } = {}) {
  const issues = validate(review, REVIEW_SCHEMA).map((issue) => `${issue.path}: ${issue.message}`);
  if (!object(review)) return { ok: false, issues };
  if (review.card_sha256 !== cardSha256) issues.push('$.card_sha256: does not match the final chrome-composited card');
  if (JSON.stringify(review.expected_strings) !== JSON.stringify(expectedStrings)) issues.push('$.expected_strings: does not match native_prompt_strings');
  const derived = expectedStatus(review);
  if (review.status !== derived) issues.push(`$.status: expected ${derived} from observed strings, logo_detected, and chrome_match`);
  return { ok: issues.length === 0, issues, derived_status: derived };
}

/** Route structured review findings through the existing task-local feedback contract. */
export function nativeReviewToFeedbackRecord(review, { frameId, seriesId } = {}) {
  const status = expectedStatus(review);
  const cardSha = review.card_sha256;
  const evaluator = review.reviewer.type === 'agent'
    ? { type: 'agent', agent: { runtime: review.reviewer.id } }
    : { type: 'human' };
  const record = {
    schema_version: '1.0.0',
    feedback_id: `feedback:native-card-${frameId}-${cardSha.slice(7, 19)}`,
    created_at: review.reviewed_at,
    subject: { kind: 'artifact', ref: `series:${seriesId}/${frameId}@${cardSha}` },
    evaluator,
    basis: review.reviewer.type === 'human' ? 'explicit_human_feedback' : 'model_inference',
    signal: 'objective_quality',
    verdict: status === 'PASS' ? 'good' : 'bad',
    owner_verdict: 'unknown',
    statement: JSON.stringify({ status, expected_strings: review.expected_strings, observed_strings: review.observed_strings, logo_detected: review.logo_detected, chrome_match: review.chrome_match }),
    routing: { layer: 'verification', modality_layer: 'native_card_text_and_chrome', confidence: 'high', abstained: false, rationale: `Independent native-card review result: ${status}.` },
    scope: 'task_local',
  };
  const issues = validate(record, FEEDBACK_SCHEMA);
  if (issues.length) fail('NATIVE_FEEDBACK_INVALID', issues.map((issue) => `${issue.path}: ${issue.message}`).join('; '));
  return record;
}
