import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const recipes = JSON.parse(readFileSync(new URL('../editorial/visual-recipes.v1.json', import.meta.url), 'utf8'));
const expected = ['photo-editorial', 'flat-editorial', 'isometric', 'clay-3d', 'glass-3d', 'risograph', 'paper-collage', 'line-accent'];
for (const id of expected) {
  const recipe = recipes.recipes[id];
  assert.ok(recipe, `${id} is registered in the existing recipe registry`);
  assert.equal(recipe.kind, 'supporting_art');
  assert.ok(recipe.prompt_style_tokens.length > 0);
  assert.ok(recipe.negative_constraints.some((c) => /text|words|letters|numerals/i.test(c)));
  assert.ok(recipe.negative_constraints.some((c) => /32%|quiet|low-detail/i.test(c)));
  assert.equal(recipe.palette_binding.background, 'profile.palette.background');
  assert.equal(recipe.palette_binding.accent, 'profile.palette.accent');
  assert.ok(recipe.when_to_use.length > 0 && recipe.avoid.length > 0);
  assert.equal(recipe.model.default, 'gpt-image-2.5-flare');
  assert.equal(recipe.model.status, 'provisional_single_model');
  assert.equal(recipe.model.cross_model_comparison, 'pending_fal_403');
}
assert.match(recipes.supporting_art_contract.model_evidence, /one sample per style/i);
assert.match(recipes.supporting_art_contract.model_evidence, /403/);
assert.match(recipes.supporting_art_contract.prompt_template, /code-native/);
console.log('supporting-art-recipes: PASS — 8 registered styles, profile token binding, text-safe constraints, provisional model evidence');
