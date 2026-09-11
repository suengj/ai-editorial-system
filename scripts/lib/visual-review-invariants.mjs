/** Shared semantic invariants for asset-bound visual review consumers. */

export const VISUAL_REVIEW_INVARIANT_CODES = Object.freeze({
  OBSERVED_TEXT_REQUIRED: 'visual-review-observed-text-required',
  OBSERVED_TEXT_BINDING: 'visual-review-observed-text-binding',
  OBSERVED_TEXT_MISMATCH: 'visual-review-observed-text-mismatch',
  WRONG_NUMBER: 'visual-review-wrong-number',
  MISSING_QUALIFIER: 'visual-review-missing-qualifier',
  HALLUCINATED_LABEL: 'visual-review-hallucinated-label',
  MOBILE_LEGIBILITY_REQUIRED: 'visual-review-mobile-legibility-required',
  UNREADABLE_DISPLAY_SIZE: 'visual-review-unreadable-publication-display-size',
});

const issue = (code, message) => ({ code, message });

function declaredTextItems(job) {
  const ownership = job?.visual_brief?.text_ownership;
  if (!ownership?.verified_generative_fact) return [];
  return [
    ...(ownership.verified_generative_fact.canonical_payload?.items ?? []),
    ...(ownership.deterministic_external_text?.items ?? []),
  ];
}

function numbers(value) {
  return String(value ?? '').match(/[-+]?\d[\d,.]*%?/g) ?? [];
}

/**
 * Compare the structured transcription with the bound job's authoritative text.
 * A correctly routed failing review remains valid; only a pass claim over a
 * mismatch is a contract violation. Missing/bogus authority bindings always fail.
 */
export function validateObservedTextAgainstJob(record, job) {
  const expectedItems = declaredTextItems(job);
  if (expectedItems.length === 0) return [];
  const factual = record?.post_render_checks?.checks?.find((entry) => entry.check === 'factual');
  const observations = factual?.observed_text_items;
  if (!Array.isArray(observations) || observations.length === 0) {
    return [issue(VISUAL_REVIEW_INVARIANT_CODES.OBSERVED_TEXT_REQUIRED,
      'verified-fact review must transcribe every declared verified and deterministic-external text item as structured observed_text_items')];
  }

  const out = [];
  const expectedBySource = new Map(expectedItems.map((item) => [item.source_ref, item]));
  const observedBySource = new Map();
  for (const observation of observations) {
    if (observedBySource.has(observation.source_ref)) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.OBSERVED_TEXT_BINDING,
        `observed text source_ref ${observation.source_ref} appears more than once`));
    }
    observedBySource.set(observation.source_ref, observation);
    const expected = expectedBySource.get(observation.source_ref);
    if (expected && observation.declared_text !== expected.exact_text) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.OBSERVED_TEXT_BINDING,
        `declared_text for ${observation.source_ref} does not equal the bound job payload`));
    }
  }
  for (const expected of expectedItems) {
    if (!observedBySource.has(expected.source_ref)) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.OBSERVED_TEXT_REQUIRED,
        `observed_text_items does not represent declared item ${expected.source_ref}`));
    }
  }

  const passClaimed = factual?.verdict === 'pass' || record?.verdict === 'PASS_TO_HUMAN_REVIEW';
  if (!passClaimed) return out;

  for (const observation of observations) {
    const expected = expectedBySource.get(observation.source_ref);
    if (!expected) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.HALLUCINATED_LABEL,
        `observed text ${JSON.stringify(observation.observed_text)} has no declared payload/source item`));
      continue;
    }
    if (observation.observed_text === expected.exact_text) continue;
    const expectedNumbers = numbers(expected.exact_text);
    const observedNumbers = numbers(observation.observed_text);
    if (expectedNumbers.length > 0 && JSON.stringify(expectedNumbers) !== JSON.stringify(observedNumbers)) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.WRONG_NUMBER,
        `observed ${JSON.stringify(observation.observed_text)} for ${observation.source_ref}; declared payload requires ${JSON.stringify(expected.exact_text)}`));
    } else if (/qualifier/i.test(expected.source_ref)) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.MISSING_QUALIFIER,
        `material qualifier ${JSON.stringify(expected.exact_text)} was not observed for ${expected.source_ref}`));
    } else {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.OBSERVED_TEXT_MISMATCH,
        `observed ${JSON.stringify(observation.observed_text)} for ${observation.source_ref}; declared payload requires ${JSON.stringify(expected.exact_text)}`));
    }
  }
  return out;
}

/** Apply the SUE-546 progressive-mobile rule to a claimed passing review. */
export function validateMobileLegibility(record) {
  const mobile = record?.post_render_checks?.checks?.find((entry) => entry.check === 'mobile');
  if (!mobile) return [];
  const evidence = mobile.mobile_legibility;
  if (!evidence) {
    return [issue(VISUAL_REVIEW_INVARIANT_CODES.MOBILE_LEGIBILITY_REQUIRED,
      'mobile check must distinguish first-read structure, detail role, load-bearing status, display-size legibility, and detail-access path')];
  }
  const passClaimed = mobile.verdict === 'pass' || record?.verdict === 'PASS_TO_HUMAN_REVIEW';
  if (!passClaimed) return [];
  const firstRead = evidence.first_read ?? {};
  const missingFirstRead = ['topic', 'dominant_relation', 'major_module_boundaries', 'main_conclusion']
    .filter((field) => firstRead[field] !== true);
  if (missingFirstRead.length > 0) {
    return [issue(VISUAL_REVIEW_INVARIANT_CODES.UNREADABLE_DISPLAY_SIZE,
      `mobile first read does not preserve ${missingFirstRead.join(', ')} at publication display size`)];
  }
  if (evidence.detail_role === 'first_read_structure' && evidence.legible_at_display_size !== true) {
    return [issue(VISUAL_REVIEW_INVARIANT_CODES.UNREADABLE_DISPLAY_SIZE,
      'first-read structure cannot rely on progressive disclosure')];
  }
  if (evidence.load_bearing === true && evidence.legible_at_display_size !== true && evidence.detail_access_path === 'none') {
    return [issue(VISUAL_REVIEW_INVARIANT_CODES.UNREADABLE_DISPLAY_SIZE,
      'unreadable load-bearing mobile detail requires a full-size, open, or expand path')];
  }
  return [];
}
