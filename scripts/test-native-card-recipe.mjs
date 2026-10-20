import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, linkSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fonts = resolve(root, 'assets/fonts/aes-sans-kr');
const script = resolve(root, 'examples/native-card-recipe.py');
const temp = mkdtempSync(join(tmpdir(), 'aes-native-recipe-'));
const pythonEnv = { ...process.env };
const python = process.env.AES_PYTHON || 'python3';
const workspacePydeps = resolve(root, '../pydeps');
if (!process.env.PYTHONPATH && existsSync(workspacePydeps)) pythonEnv.PYTHONPATH = workspacePydeps;
const runPython = (args) => spawnSync(python, args, { encoding: 'utf8', env: pythonEnv });
const pillowCheck = runPython(['-c', 'import PIL']);
assert.equal(pillowCheck.status, 0, `Pillow is required for this test: ${pillowCheck.stderr || pillowCheck.stdout}`);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

function render(source, aspect, suffix, fit = 'cover') {
  const png = join(temp, `${suffix}.png`);
  const receipt = join(temp, `${suffix}.json`);
  const result = runPython([script,
    '--source', source, '--out', png, '--receipt', receipt, '--aspect', aspect, '--fit', fit,
    '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'),
    '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { png, receipt: JSON.parse(readFileSync(receipt, 'utf8')) };
}

function assertRasterPixels(png, spec, fit) {
  const pixels = runPython(['-c',
    'from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert("RGB"); title_y=int(sys.argv[2]); region=im.crop((72,title_y,1008,title_y+180)); dark=sum(1 for r,g,b in region.getdata() if r<70 and g<90 and b<120); print(im.getpixel((0,0)), im.getpixel((80,68)), dark)',
    png, String(spec.titleY)]);
  assert.equal(pixels.status, 0, pixels.stderr || pixels.stdout);
  assert.match(pixels.stdout, /^\(247, 245, 240\) \(46, 91, 255\) \d+\n$/);
  assert.ok(Number(pixels.stdout.trim().split(' ').at(-1)) > 500, `${spec.canvas.join('x')} ${fit} title pixels must exist`);
}

function assertPhotoGeometry(png, source, spec, fit) {
const code = `from PIL import Image, ImageDraw
import sys
source_path, output_path, fit = sys.argv[1:4]
x, y, width, height = map(int, sys.argv[4:8])
background = '#F7F5F0'
source = Image.open(source_path).convert('RGB')
if fit == 'cover':
    scale = max(width / source.width, height / source.height)
    resized = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)
    left, top = (resized.width - width) // 2, (resized.height - height) // 2
    expected = resized.crop((left, top, left + width, top + height))
else:
    scale = min(width / source.width, height / source.height)
    size = (round(source.width * scale), round(source.height * scale))
    fitted = source.resize(size, Image.Resampling.LANCZOS)
    expected = Image.new('RGB', (width, height), background)
    expected.paste(fitted, ((width - size[0]) // 2, (height - size[1]) // 2))
actual = Image.open(output_path).convert('RGB').crop((x, y, x + width, y + height))
ImageDraw.Draw(expected).rounded_rectangle((0, 0, width - 1, height - 1), radius=20, outline='#D8D6D0', width=2)
assert actual.tobytes() == expected.tobytes(), f'{fit} complete slot pixels differ from independent source-derived expectation'
print('PASS: complete photo slot raster including rounded outline')`;
  const result = runPython(['-c', code, source, png, fit,
    String(spec.slot.x), String(spec.slot.y), String(spec.slot.width), String(spec.slot.height)]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function assertRejected(result, message) {
  assert.notEqual(result.status, 0, message);
  assert.match(result.stderr || '', /output paths must not overwrite input files|--out and --receipt must use different paths/);
}

function assertExactTextPixels(png, aspect) {
  const code = `from PIL import Image, ImageDraw, ImageFont
import sys
path, aspect, regular, semibold, extrabold = sys.argv[1:6]
width, height = (1080, 1080) if aspect == '1:1' else (1080, 1350)
title_y, title_size, fact_y, value_size = (120, 72, 790, 68) if aspect == '1:1' else (130, 76, 930, 72)
ink, muted = '#14213D', '#536078'
image = Image.open(path).convert('RGB')
specs = [
 ('하루에 물은', semibold, title_size, (72, title_y), ink),
 ('얼마나 마실까?', semibold, title_size, (72, title_y + 90), ink),
 ('여성', semibold, 28, (72, fact_y), muted),
 ('2.7L', extrabold, value_size, (72, fact_y + 38), ink),
 ('남성', semibold, 28, (558, fact_y), muted),
 ('3.7L', extrabold, value_size, (558, fact_y + 38), ink),
 ('National Academies · DRI Water · 2005', regular, 23, (72, height - 154), muted),
 ('개인별 목표가 아닌 참고값', semibold, 27, (72, height - 104), ink),
]
for text, font_path, size, xy, color in specs:
    font = ImageFont.truetype(font_path, size)
    reference = Image.new('RGB', image.size, '#F7F5F0')
    drawer = ImageDraw.Draw(reference)
    drawer.text(xy, text, font=font, fill=color)
    left, top, right, bottom = drawer.textbbox(xy, text, font=font)
    box = (max(0, left - 2), max(0, top - 2), min(width, right + 2), min(height, bottom + 2))
    assert image.crop(box).tobytes() == reference.crop(box).tobytes(), f'{text!r} differs from its exact rendered region'
print('PASS: all eight exact text rasters')`;
  const result = runPython(['-c', code, png, aspect,
    join(fonts, 'AESSansKR-Regular.otf'), join(fonts, 'AESSansKR-SemiBold.otf'), join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

try {
  const source = join(temp, 'source.png');
  const sourceFixture = runPython(['-c',
    'from PIL import Image; import sys; im=Image.new("RGB", (496,496)); p=im.load();\nfor y in range(496):\n for x in range(496): p[x,y]=(x%256,y%256,(x*31+y*17)%256)\nim.save(sys.argv[1], format="PNG", optimize=False, compress_level=9)', source]);
  assert.equal(sourceFixture.status, 0, sourceFixture.stderr || sourceFixture.stdout);
  const sourceBefore = readFileSync(source);
  const expected = {
    '1:1': { canvas: [1080, 1080], titleY: 120, titleSize: 72, valueSize: 68, slot: { x: 196, y: 352, width: 688, height: 380 } },
    '4:5': { canvas: [1080, 1350], titleY: 130, titleSize: 76, valueSize: 72, slot: { x: 196, y: 390, width: 688, height: 480 } },
  };
  for (const aspect of ['1:1', '4:5']) {
    const first = render(source, aspect, `${aspect}-first`);
    const second = render(source, aspect, `${aspect}-second`);
    assert.equal(sha(readFileSync(first.png)), sha(readFileSync(second.png)), `${aspect} must be byte deterministic`);
    const receipt = first.receipt;
    const spec = expected[aspect];
    assert.deepEqual(receipt.canvas_px, { width: spec.canvas[0], height: spec.canvas[1] });
    assert.deepEqual(receipt.layout_px.photo_slot, spec.slot);
    assert.deepEqual(receipt.layout_px.title.line_y, [spec.titleY, spec.titleY + 90]);
    assert.equal(receipt.layout_px.title.font_px, spec.titleSize);
    assert.deepEqual(receipt.layout_px.fact_columns.map(({ x, label_y, value_y, width }) => ({ x, label_y, value_y, width })), [
      { x: 72, label_y: aspect === '1:1' ? 790 : 930, value_y: aspect === '1:1' ? 828 : 968, width: 450 },
      { x: 558, label_y: aspect === '1:1' ? 790 : 930, value_y: aspect === '1:1' ? 828 : 968, width: 450 },
    ]);
    assert.equal(receipt.layout_px.value_font_px, spec.valueSize);
    assert.equal(receipt.layout_px.source_font_px, 23);
    assert.equal(receipt.layout_px.source_y, spec.canvas[1] - 154);
    assert.equal(receipt.layout_px.caution_font_px, 27);
    assert.equal(receipt.layout_px.caution_y, spec.canvas[1] - 104);
    assert.deepEqual(receipt.exact_strings, ['하루에 물은', '얼마나 마실까?', '여성', '2.7L', '남성', '3.7L', 'National Academies · DRI Water · 2005', '개인별 목표가 아닌 참고값']);
    assert.equal(receipt.status, 'GENERATED_UNVERIFIED');
    assert.equal(receipt.image_model_generation, 'NOT_USED');
    assert.equal(receipt.text_render_owner, 'Pillow');
    assert.equal(receipt.photo.source_sha256, sha(sourceBefore));
    assert.deepEqual(receipt.photo.source_px, { width: 496, height: 496 });
    assert.equal(receipt.photo.operation, 'cover_center_crop');
    assert.deepEqual(receipt.photo.crop_box_source_px, aspect === '1:1' ? [0, 111, 496, 385] : [0, 75, 496, 421]);
    assert.equal(receipt.photo.resolution_status, 'UPSCALE_WARNING');
    assert.ok(receipt.photo.required_scale > 1);
    assert.ok(Array.isArray(receipt.photo.crop_box_source_px));
    assert.equal(receipt.output.sha256, sha(readFileSync(first.png)));
    assert.equal(receipt.recipe.sha256, sha(readFileSync(script)));
    assert.ok(receipt.recipe.python_version && receipt.recipe.pillow_version);
    assert.deepEqual(receipt.fonts, {
      regular: { path: join(fonts, 'AESSansKR-Regular.otf'), sha256: sha(readFileSync(join(fonts, 'AESSansKR-Regular.otf'))) },
      semibold: { path: join(fonts, 'AESSansKR-SemiBold.otf'), sha256: sha(readFileSync(join(fonts, 'AESSansKR-SemiBold.otf'))) },
      extrabold: { path: join(fonts, 'AESSansKR-ExtraBold.otf'), sha256: sha(readFileSync(join(fonts, 'AESSansKR-ExtraBold.otf'))) },
    });
    assertRasterPixels(first.png, spec, 'cover');
    assertPhotoGeometry(first.png, source, spec, 'cover');
    assertExactTextPixels(first.png, aspect);
  }
  assert.deepEqual(readFileSync(source), sourceBefore, 'rendering must preserve the source photo');

  const contained = render(source, '1:1', 'contained', 'contain');
  assert.equal(contained.receipt.photo.fit, 'contain');
  assert.equal(contained.receipt.photo.crop_box_source_px, null);
  assert.equal(contained.receipt.photo.operation, 'contain_centered_on_card_background');
  assert.equal(contained.receipt.photo.resolution_status, 'NATIVE_OR_DOWNSCALE');
  assert.deepEqual(contained.receipt.photo.contain_offset_slot_px, [154, 0]);
  assertRasterPixels(contained.png, expected['1:1'], 'contain');
  assertPhotoGeometry(contained.png, source, expected['1:1'], 'contain');
  assertExactTextPixels(contained.png, '1:1');
  const contained45 = render(source, '4:5', 'contained-4x5', 'contain');
  assert.deepEqual(contained45.receipt.canvas_px, { width: 1080, height: 1350 });
  assert.equal(contained45.receipt.photo.fit, 'contain');
  assert.equal(contained45.receipt.photo.crop_box_source_px, null);
  assert.deepEqual(contained45.receipt.photo.contain_offset_slot_px, [104, 0]);
  assertRasterPixels(contained45.png, expected['4:5'], 'contain');
  assertPhotoGeometry(contained45.png, source, expected['4:5'], 'contain');
  assertExactTextPixels(contained45.png, '4:5');

  const collision = runPython([script, '--source', source, '--out', source, '--receipt', join(temp, 'collision.json'),
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(collision, 'output must never overwrite source');
  assert.deepEqual(readFileSync(source), sourceBefore, 'collision rejection must preserve source bytes');
  const receiptCollision = runPython([script, '--source', source, '--out', join(temp, 'safe.png'), '--receipt', source,
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(receiptCollision, 'receipt must never overwrite source');
  const outputReceiptCollision = runPython([script, '--source', source, '--out', join(temp, 'same.png'), '--receipt', join(temp, 'same.png'),
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(outputReceiptCollision, 'output and receipt must not overwrite one another');
  const recipeCollision = runPython([script, '--source', source, '--out', script, '--receipt', join(temp, 'recipe-collision.json'),
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(recipeCollision, 'output must never overwrite the recipe implementation');
  const recipeReceiptCollision = runPython([script, '--source', source, '--out', join(temp, 'safe-recipe-receipt.png'), '--receipt', script,
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(recipeReceiptCollision, 'receipt must never overwrite the recipe implementation');
  const fontCollision = runPython([script, '--source', source, '--out', join(fonts, 'AESSansKR-Regular.otf'), '--receipt', join(temp, 'font-collision.json'),
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(fontCollision, 'output must never overwrite a font input');
  const symlinkAlias = join(temp, 'source-symlink.png');
  symlinkSync(source, symlinkAlias);
  const symlinkCollision = runPython([script, '--source', source, '--out', symlinkAlias, '--receipt', join(temp, 'symlink-collision.json'),
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(symlinkCollision, 'symlink alias must be rejected');
  const hardlinkAlias = join(temp, 'source-hardlink.png');
  linkSync(source, hardlinkAlias);
  const hardlinkCollision = runPython([script, '--source', source, '--out', hardlinkAlias, '--receipt', join(temp, 'hardlink-collision.json'),
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(hardlinkCollision, 'hardlink alias must be rejected');
  const symlinkReceiptCollision = runPython([script, '--source', source, '--out', join(temp, 'safe-symlink-receipt.png'), '--receipt', symlinkAlias,
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(symlinkReceiptCollision, 'receipt symlink alias must be rejected');
  const hardlinkReceiptCollision = runPython([script, '--source', source, '--out', join(temp, 'safe-hardlink-receipt.png'), '--receipt', hardlinkAlias,
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(hardlinkReceiptCollision, 'receipt hardlink alias must be rejected');
  const sharedOutput = join(temp, 'output-receipt-shared.png');
  const sharedReceipt = join(temp, 'output-receipt-shared-hardlink.png');
  copyFileSync(source, sharedOutput);
  linkSync(sharedOutput, sharedReceipt);
  const hardlinkedOutputReceipt = runPython([script, '--source', source, '--out', sharedOutput, '--receipt', sharedReceipt,
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(hardlinkedOutputReceipt, 'hardlinked output and receipt must be rejected');
  const sharedSymlinkOutput = join(temp, 'output-receipt-shared-target.png');
  const sharedSymlinkReceipt = join(temp, 'output-receipt-shared-link.png');
  symlinkSync(sharedSymlinkOutput, sharedSymlinkReceipt);
  const symlinkedOutputReceipt = runPython([script, '--source', source, '--out', sharedSymlinkOutput, '--receipt', sharedSymlinkReceipt,
    '--aspect', '1:1', '--font-regular', join(fonts, 'AESSansKR-Regular.otf'),
    '--font-semibold', join(fonts, 'AESSansKR-SemiBold.otf'), '--font-extrabold', join(fonts, 'AESSansKR-ExtraBold.otf')]);
  assertRejected(symlinkedOutputReceipt, 'symlinked output and receipt paths must be rejected');
  assert.deepEqual(readFileSync(source), sourceBefore, 'alias rejections must preserve source bytes');
  console.log('native card recipe determinism, geometry, provenance, source preservation, and fit modes: PASS');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
