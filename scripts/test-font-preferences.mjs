import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assertRegisteredDigest, fontInventory, fontPreferences, resolveFontPair, validateFontInventory, validateFontPreferences } from './lib/typography-core.mjs';

const data = fontPreferences();
assert.equal(data.schema_version, 'aes-font-preferences/1');
assert.equal(data.preference_authority, 'AES');
assert.equal(data.selection_policy.final_default, 'UNDECIDED');
assert.equal(data.selection_policy.silent_fallback, 'FORBIDDEN');
assert.equal(data.style_candidate_groups.selection_status, 'OWNER_SELECTED');
assert.equal(data.style_candidate_groups.provisional_defaults_are_not_final_choices, false);
for (const [group, numbers, pairIds] of [
  ['video', [1, 2], ['pretendard-pretendard', 'noto-sans-kr-noto-sans-kr']],
  ['R4_photo', [3, 4, 5], ['noto-serif-kr-pretendard', 'noto-serif-kr-suit', 'gowun-batang-suit']],
  ['R7_illustrated', [1, 2], ['pretendard-pretendard', 'noto-sans-kr-noto-sans-kr']],
]) {
  const entry = data.style_candidate_groups.groups[group];
  assert.deepEqual(entry.candidate_numbers, numbers, `${group} candidate numbers`);
  assert.deepEqual(entry.candidate_pair_ids, pairIds, `${group} candidate pairs`);
  assert.equal(entry.default_number, numbers[0], `${group} selected number`);
  assert.equal(entry.default_pair_id, pairIds[0], `${group} selected pair`);
  assert(entry.candidate_pair_ids.every((id) => data.candidate_pairs.some((pair) => pair.pair_id === id)));
}
assert.deepEqual(data.candidate_pairs.map((p) => p.pair_id), [
  'pretendard-pretendard', 'noto-sans-kr-noto-sans-kr',
  'noto-serif-kr-pretendard', 'noto-serif-kr-suit', 'gowun-batang-suit',
]);
for (const pair of data.candidate_pairs) {
  assert.equal(pair.status, 'CANDIDATE_ACCEPTED');
  const resolved = resolveFontPair(pair.pair_id);
  assert.equal(resolved.title.sha256, data.font_files[resolved.title.font_id].sha256);
  assert.equal(resolved.body.sha256, data.font_files[resolved.body.font_id].sha256);
  for (const role of ['title', 'body']) {
    const ref = pair[role], font = data.font_files[ref.font_id];
    assert.equal(font.required_sample_coverage, true);
    assert.ok(font.license.includes('OFL 1.1'));
    assert.equal(ref.variable_axes.wght ?? null, font.axes.wght ? ref.weight : null);
    assert.ok(ref.weight <= (font.axes.wght?.max ?? 900));
  }
}
assert.equal(resolveFontPair('noto-serif-kr-suit').body.font_id, 'suit');
assert.equal(resolveFontPair('gowun-batang-suit').body.font_id, 'suit');
assert.throws(() => resolveFontPair('suit-suit'), (e) => e.code === 'FONT_PAIR_UNRESOLVED');
assert.throws(() => resolveFontPair('ibm-plex-sans-kr-ibm-plex-sans-kr'), (e) => e.code === 'FONT_PAIR_UNRESOLVED');
assert.throws(() => resolveFontPair('missing'), (e) => e.code === 'FONT_PAIR_UNRESOLVED');
assert.equal(fontInventory().coverage_sample, '한글 타이포 2026 ₩→뷁');
const exposedInventory = fontInventory();
exposedInventory.source_records[0].missing_codepoints.push('한');
assert.deepEqual(fontInventory().source_records[0].missing_codepoints, []);
const badInventoryAxes = fontInventory();
badInventoryAxes.source_records[0].axes.wght.max = 5000;
assert.throws(() => assertRegisteredDigest(Buffer.from(JSON.stringify(badInventoryAxes)), JSON.parse(readFileSync(new URL('../editorial/entry-manifest.json', import.meta.url), 'utf8')).font_inventory), (e) => e.code === 'FONT_CONTRACT_INVALID');
const badInventoryLicense = fontInventory();
badInventoryLicense.source_records[0].license_contains_ofl_1_1 = false;
assert.throws(() => validateFontInventory(badInventoryLicense), (e) => e.code === 'FONT_CONTRACT_INVALID');
for (const mutate of [
  (record) => { record.family = 'Fake Family'; },
  (record) => { record.binary_file_name = 'wrong.ttf'; },
  (record) => { record.unicode_codepoints = 0; },
  (record) => { record.binary_sha256 = 'invalid'; },
  (record) => { record.license_sha256 = 'invalid'; },
  (record) => { record.license_contains_ofl_1_1 = 'false'; },
]) {
  const corrupted = fontInventory();
  mutate(corrupted.source_records[0]);
  assert.throws(() => validateFontInventory(corrupted), (e) => e.code === 'FONT_CONTRACT_INVALID');
}
const duplicateInventoryRecords = fontInventory();
duplicateInventoryRecords.source_records = Array(5).fill(duplicateInventoryRecords.source_records[0]);
assert.throws(() => validateFontInventory(duplicateInventoryRecords), (e) => e.code === 'FONT_CONTRACT_INVALID');
const corruptWeight = fontPreferences();
corruptWeight.candidate_pairs.find((p) => p.pair_id === 'gowun-batang-suit').title.weight = 100;
assert.throws(() => validateFontPreferences(corruptWeight), (e) => e.code === 'FONT_WEIGHT_UNAVAILABLE');
const corruptAxis = fontPreferences();
corruptAxis.candidate_pairs[0].title.variable_axes.wght = 'not-a-weight';
assert.throws(() => validateFontPreferences(corruptAxis), (e) => e.code === 'FONT_WEIGHT_UNAVAILABLE');
const corruptRole = fontPreferences();
corruptRole.candidate_pairs[0].title.family = 'Unrelated Family';
assert.throws(() => validateFontPreferences(corruptRole), (e) => e.code === 'FONT_CONTRACT_INVALID');
const selfConsistentTamper = fontPreferences();
selfConsistentTamper.font_files.pretendard.family = 'Fake Family';
for (const pair of selfConsistentTamper.candidate_pairs) for (const role of ['title', 'body']) if (pair[role].font_id === 'pretendard') pair[role].family = 'Fake Family';
assert.throws(() => validateFontPreferences(selfConsistentTamper), (e) => e.code === 'FONT_CONTRACT_INVALID');
const renamedFile = fontPreferences();
renamedFile.font_files.pretendard.file = 'wrong.ttf';
assert.throws(() => validateFontPreferences(renamedFile), (e) => e.code === 'FONT_CONTRACT_INVALID');
const corruptedCoverage = fontPreferences();
corruptedCoverage.font_files.pretendard.coverage_codepoints = 0;
assert.throws(() => validateFontPreferences(corruptedCoverage), (e) => e.code === 'FONT_CONTRACT_INVALID');
const expandedAxisTamper = fontPreferences();
expandedAxisTamper.font_files.pretendard.axes.wght.max = 5000;
expandedAxisTamper.candidate_pairs[0].title.weight = 4000;
expandedAxisTamper.candidate_pairs[0].title.variable_axes.wght = 4000;
assert.throws(() => validateFontPreferences(expandedAxisTamper), (e) => e.code === 'FONT_CONTRACT_INVALID');
const isolated = fontPreferences();
isolated.candidate_pairs[0].title.weight = 100;
assert.equal(resolveFontPair('pretendard-pretendard').title.weight, 800);
const bytes = readFileSync(new URL('../editorial/font-preferences.v1.json', import.meta.url));
const sha = createHash('sha256').update(bytes).digest('hex');
const entry = JSON.parse(readFileSync(new URL('../editorial/entry-manifest.json', import.meta.url), 'utf8'));
assert.equal(entry.font_preferences.sha256, sha);
const inventoryBytes = readFileSync(new URL('../editorial/font-inventory.v1.json', import.meta.url));
assert.equal(entry.font_inventory.sha256, createHash('sha256').update(inventoryBytes).digest('hex'));
assert.equal(JSON.parse(inventoryBytes).source_records.every((r) => r.license_contains_ofl_1_1 && r.missing_codepoints.length === 0), true);
for (const mutate of [
  (value) => { value.groups.video.default_pair_id = 'unknown'; },
  (value) => { value.groups.R4_photo.candidate_pair_ids.pop(); },
  (value) => { value.selection_status = 'OWNER_PENDING'; },
]) {
  const invalid = fontPreferences();
  mutate(invalid.style_candidate_groups);
  assert.throws(() => validateFontPreferences(invalid), (e) => e.code === 'FONT_CONTRACT_INVALID');
}
console.log('PASS font preference contract: owner-selected style defaults, five candidates, hashes/weights/license/coverage and negative fixtures');
