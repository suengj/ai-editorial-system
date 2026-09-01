/**
 * Polish invariants — AES-P1.3 (SUE-440).
 *
 * A polish pass may change rhythm, connectives, ordering within a paragraph,
 * and word choice outside the protected set. It may not change what is true.
 *
 * This module extracts the protected spans from a body and compares a
 * before/after pair. It is the mechanism behind Constitution §6
 * (verification is not editing) and the reason voice.md contains no rule of
 * the form "vary sentence length to sound more natural".
 *
 * Direction matters: dropping a number is a loss of fact, and *adding* one is
 * a fabrication. Both are violations.
 */

const RE = Object.freeze({
  // Numbers with their units attached, so "3배" and "3%" are distinct spans.
  numbers: /(?<![\w.-])\d+(?:[.,]\d+)*\s*(?:%|배|퍼센트|원|달러|USD|KRW|bp|x)?/g,
  dates: /\b\d{4}-\d{2}-\d{2}\b|\b\d{4}년\s?\d{0,2}월?\b|\b(?:19|20)\d{2}\b/g,
  'citation-markers': /\[\^[^\]]+\]|\[\d+\]/g,
  quotations: /"[^"\n]{4,}"|“[^”\n]{4,}”|「[^」\n]{4,}」/g,
  urls: /https?:\/\/[^\s)<>\]]+/g,
});

/** Terms treated as technical vocabulary: ASCII words kept inside Korean prose. */
const TECHNICAL_TERM_RE = /\b[A-Za-z][A-Za-z0-9+#.-]{2,}(?:\s+[A-Z][A-Za-z0-9+#.-]{2,})*\b/g;

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'than', 'then',
  'when', 'what', 'which', 'have', 'has', 'not', 'but', 'are', 'was', 'were',
  'its', 'their', 'they', 'them', 'per', 'via', 'also', 'more', 'most', 'such',
]);

/** Multiset of protected spans, keyed by class. */
export function extractSpans(body) {
  const text = String(body ?? '');
  const out = {};
  for (const [cls, re] of Object.entries(RE)) {
    out[cls] = tally((text.match(re) ?? []).map((s) => s.trim()));
  }
  out['technical-terms'] = tally(
    (text.match(TECHNICAL_TERM_RE) ?? [])
      .map((s) => s.trim())
      .filter((s) => !STOPWORDS.has(s.toLowerCase())),
  );
  return out;
}

function tally(items) {
  const m = new Map();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

/**
 * Compare protected spans before and after a polish pass.
 * Returns violations: { class, kind: 'removed' | 'added' | 'count-changed', value, before, after }.
 */
export function checkPolish(before, after, { classes = null } = {}) {
  const a = extractSpans(before);
  const b = extractSpans(after);
  const violations = [];

  for (const cls of classes ?? Object.keys(a)) {
    const from = a[cls] ?? new Map();
    const to = b[cls] ?? new Map();

    for (const [value, n] of from) {
      const m = to.get(value) ?? 0;
      if (m === 0) {
        violations.push({ class: cls, kind: 'removed', value, before: n, after: 0 });
      } else if (m !== n) {
        violations.push({ class: cls, kind: 'count-changed', value, before: n, after: m });
      }
    }
    for (const [value, m] of to) {
      if (!from.has(value)) {
        violations.push({ class: cls, kind: 'added', value, before: 0, after: m });
      }
    }
  }

  return violations;
}

/**
 * A polish pass is acceptable when it changed the prose but none of the
 * protected spans. Unchanged text is reported separately: a polish that
 * changed nothing is not a violation, but it is not a polish either.
 */
export function assessPolish(before, after, options = {}) {
  const violations = checkPolish(before, after, options);
  return {
    ok: violations.length === 0,
    changed: String(before) !== String(after),
    violations,
  };
}
