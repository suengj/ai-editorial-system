# Math lecture narration handoff (Korean)

Load only when the selected video genre is `video-genre/math-lecture` and the
output language is Korean. The story skill owns formula/display synchronization;
this reference covers spoken notation and the downstream TTS handoff.

- Preserve every protected symbol and derivation step. Convert notation to a
  listener-tested Korean reading without changing signs, scope, or conditions.
- House readings: `x^2` → `엑스 제곱`; `a_1` → `에이 아래 첨자 일`;
  `1/2` → `이분의 일`; `a/b` → `비 분의 에이`. Clarify grouping and nested
  fractions in words. These readings are local conventions, not a standardized
  Korean mathematics speech rule.
- For Korean math lectures, downstream TTS defaults to Gemini Charon. Send the
  canonical narration script only; do not include instruction text in the TTS
  request because the provider will speak it. This default does not assert
  provider availability or validated pronunciation quality.
- Check actual audio and captions against the canonical script, including signs,
  exponent/subscript scope, fraction order, conditions, and segment boundaries.
