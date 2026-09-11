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
  const itemKey = (sourceRef, declaredText) => JSON.stringify([sourceRef, declaredText]);
  const expectedByKey = new Map();
  const expectedTextsBySource = new Map();
  for (const item of expectedItems) {
    const key = itemKey(item.source_ref, item.exact_text);
    const entry = expectedByKey.get(key) ?? { item, count: 0 };
    entry.count += 1;
    expectedByKey.set(key, entry);
    const texts = expectedTextsBySource.get(item.source_ref) ?? new Set();
    texts.add(item.exact_text);
    expectedTextsBySource.set(item.source_ref, texts);
  }
  const observedCounts = new Map();
  for (const observation of observations) {
    const key = itemKey(observation.source_ref, observation.declared_text);
    const observedCount = (observedCounts.get(key) ?? 0) + 1;
    observedCounts.set(key, observedCount);
    const expected = expectedByKey.get(key);
    if (expected && observedCount > expected.count) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.OBSERVED_TEXT_BINDING,
        `declared item ${observation.source_ref} / ${JSON.stringify(observation.declared_text)} is transcribed more times than it appears in the bound payload`));
    }
    if (expectedTextsBySource.has(observation.source_ref) && !expected) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.OBSERVED_TEXT_BINDING,
        `declared_text ${JSON.stringify(observation.declared_text)} for ${observation.source_ref} is not an item in the bound job payload`));
    }
  }
  for (const [key, expected] of expectedByKey) {
    const missingCount = expected.count - (observedCounts.get(key) ?? 0);
    if (missingCount > 0) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.OBSERVED_TEXT_REQUIRED,
        `observed_text_items omits ${missingCount} occurrence(s) of declared item ${expected.item.source_ref} / ${JSON.stringify(expected.item.exact_text)}`));
    }
  }

  const passClaimed = factual?.verdict === 'pass' || record?.verdict === 'PASS_TO_HUMAN_REVIEW';
  if (!passClaimed) return out;

  for (const observation of observations) {
    const expected = expectedByKey.get(itemKey(observation.source_ref, observation.declared_text))?.item;
    if (!expected) {
      out.push(issue(VISUAL_REVIEW_INVARIANT_CODES.HALLUCINATED_LABEL,
        `observed text ${JSON.stringify(observation.observed_text)} has no matching declared payload item`));
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
