/** VQ-V2 owner style preference for default visual selection. */
export const VQ_V2_STYLE_PREFERENCE = Object.freeze({ primary: 'R4', fallback: 'R7' });

/**
 * Resolve the shared R4/R7 default from explicit source evidence.
 * Unknown inputs keep R4 primary; callers must not infer missing/weak photos.
 */
export function resolveDefaultVisualStyle(input = {}, { rollback = process.env.VQ_V2_CARD_STYLE_DEFAULT === 'legacy' } = {}) {
  if (rollback) return { style: 'legacy', recipe: 'editorial-minimal', reason: 'rollback_flag' };
  const requested = input.requested_style ?? 'AUTO';
  if (requested === 'R4' || requested === 'R7') return { style: requested, recipe: requested === 'R4' ? 'r4-photo-fullbleed' : 'r7-illustration-fallback', reason: 'explicit_style' };
  const contentKind = input.content_kind ?? 'unknown';
  const photoQuality = input.photo_asset_quality ?? 'unknown';
  if (contentKind === 'lifestyle_practical') return { style: 'R7', recipe: 'r7-illustration-fallback', reason: 'lifestyle_or_practical_information' };
  if (photoQuality === 'absent' || photoQuality === 'weak') return { style: 'R7', recipe: 'r7-illustration-fallback', reason: `photo_asset_${photoQuality}` };
  return { style: 'R4', recipe: 'r4-photo-fullbleed', reason: photoQuality === 'strong' ? 'strong_photo_asset' : 'primary_default' };
}
