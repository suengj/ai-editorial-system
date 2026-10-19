import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fontInventory, fontPreferences, resolveFontPair, validateFontPreferences } from './lib/typography-core.mjs';

const data = fontPreferences();
assert.equal(data.schema_version, 'aes-font-preferences/1');
assert.equal(data.preference_authority, 'AES');
assert.equal(data.selection_policy.final_default, 'UNDECIDED');
assert.equal(data.selection_policy.silent_fallback, 'FORBIDDEN');
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
console.log('PASS font preference contract: five candidates, two mixed SUIT pairs, no default, hashes/weights/license/coverage and negative fixtures');
