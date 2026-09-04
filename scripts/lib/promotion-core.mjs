/**
 * Promotion sufficiency — shared helper (AES-V2 B4).
 *
 * "Promote a generated_output to positive-reference/reusable-craft-example
 * authority" is the same semantic act wherever it happens: a calibration
 * candidate becoming active (scripts/lib/calibration-core.mjs), a
 * generated_output reference evaluation earning an `adopt` verdict
 * (scripts/lib/registry-core.mjs), or a generated_output real-output-corpus
 * entry declaring `reference_eligible: true` (scripts/lib/corpus-core.mjs).
 * Before this module existed, the first of those enforced a human
 * authorizer and repeated (or owner-declared) evidence; the other two did
 * not. The weaker of the two gates governed the reference pool. This module
 * is the one place that rule now lives.
 *
 * Deliberately has no opinion about which schema field carries which value,
 * which lets three different record shapes share it without a shared
 * schema. It also has no opinion about *which* CODES constant a caller
 * reports — callers keep their own existing codes/messages so this
 * refactor does not silently rename an error code a test or a human already
 * depends on.
 */

/** Basis text that, alone, is not promotion evidence — publication and an L1 pass are not promotion. */
export const INSUFFICIENT_PROMOTION_BASIS_RE = /^(published|publication|l1[\s-]*pass(ed)?)$/i;

/** Basis text naming an explicit owner declaration — the one path to promotion on a single evidence ref. */
export const OWNER_DECLARATION_BASIS_RE = /owner declaration|owner stated|explicit owner/i;

/**
 * Evaluate a promotion block's sufficiency.
 *
 * @param {{authorizedBy: unknown, basis: unknown, evidenceRefs: unknown}} promotion
 * @param {{resolveRef?: (ref: string) => boolean}} [opts] resolveRef, when
 *   given, is called once per evidence ref; a ref for which it returns false
 *   is reported as dangling. Omit it when the caller has no way to resolve
 *   refs against disk (a dangling ref is then not checked, not assumed ok).
 * @returns {{
 *   isHuman: boolean,
 *   insufficientEvidence: boolean,
 *   dangling: string[],
 *   refs: string[],
 * }}
 */
export function checkPromotionSufficiency({ authorizedBy, basis, evidenceRefs } = {}, { resolveRef } = {}) {
  const refs = Array.isArray(evidenceRefs) ? evidenceRefs.filter((r) => typeof r === 'string') : [];
  const isHuman = typeof authorizedBy === 'string' && authorizedBy.startsWith('human:');
  const basisAlone = typeof basis === 'string' && INSUFFICIENT_PROMOTION_BASIS_RE.test(basis.trim());
  const isOwnerDeclaration = typeof basis === 'string' && OWNER_DECLARATION_BASIS_RE.test(basis);
  const insufficientEvidence = refs.length === 0 || basisAlone || (refs.length < 2 && !isOwnerDeclaration);
  const dangling = resolveRef ? refs.filter((r) => !resolveRef(r)) : [];
  return { isHuman, insufficientEvidence, dangling, refs };
}
