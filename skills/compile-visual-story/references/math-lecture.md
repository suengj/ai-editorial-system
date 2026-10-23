# Math lecture craft (Korean first)

Load only for the `video-genre/math-lecture` route. These are production rules,
not a claim that one teaching sequence or Korean oral notation is universally
effective. Preserve source truth, rights, approval, and existing artifact gates.

## Protected symbolic spans

- Mark each source formula and each derivation step as protected: variables,
  numbers, operators, signs, exponents, subscripts, parentheses, equality/inequality,
  units, domain restrictions, and stated conditions all carry meaning.
- Compare the original expression, spoken rendering, and every on-screen/caption
  rendering side by side. Confirm operators, signs, scope, order, and conditions;
  never silently simplify, reorder, repair, or infer a missing step.
- Every transformation must preserve equivalence over the stated domain. Name the
  rule or condition that licenses it; flag an unverified derivation instead of
  making it look complete.

## Korean formula-to-speech convention

Use a consistent, listener-tested reading in the canonical narration script.
This is an AES house convention, not a national or platform standard:

| Notation | Korean spoken form |
|---|---|
| `x^2` | `엑스 제곱` |
| `x^n` | `엑스의 엔 제곱` (state the exponent meaning explicitly) |
| `a_1` | `에이 아래 첨자 일` |
| `x_1^2` | `엑스 아래 첨자 일의 제곱` |
| `1/2` | `이분의 일` |
| `a/b` | `비 분의 에이` |
| `x = 2` | `엑스는 이와 같다` or, in a derivation, `엑스는 이` |

Resolve ambiguity in grouping, negative signs, and nested fractions in words;
do not rely on TTS to infer mathematical scope. Listen to the actual Korean
render before accepting unfamiliar terms or notation readings.

## Teaching sequence and synchronization

- For a novice-facing explanation, start with one complete worked example,
  explain why each transition is valid, then fade selected steps on a near-transfer
  example and end with a short independent retrieval question. Adjust scaffolding
  to the intended learner; do not apply the sequence mechanically to experts.
- Treat a candidate wrong step as a specific diagnostic example, not a universal
  learner error. Show the first invalid transition and its valid alternative.
- Keep one derivation state visible at a time. Reveal one justified change per
  beat; align narration to that exact state and keep the prior state available
  for comparison when needed. Do not animate decorative changes over symbols.
- Keep the formula adjacent to its explanation. Captions reproduce the spoken
  words for accessibility, stay within the caption-safe area, and never cover
  symbols, signs, conditions, or the active derivation. Time the caption and
  highlight to the same beat; check readability at target size and pace.
- Check symbolic source → canonical spoken script → TTS transcript/audio →
  caption text → rendered formula as one comparison chain. A caption or timing
  pass cannot substitute for mathematical correctness review.

## Korean TTS handoff

For Korean math lectures, the downstream TTS default is **Gemini Charon**.
Transmit the canonical narration script only. Do not prepend production
instructions to the TTS input: instruction text is spoken as part of the audio.
This is a routing default, not evidence of availability, pronunciation quality,
or a completed listening evaluation. Regenerate only the incorrect narration
segment after a localized pronunciation defect is confirmed.

## Acceptance cases

Use the paired cases in `evals/fixtures/video/math-lecture-cases.json`. Reject
outputs that alter a protected symbol, omit a stated condition, change the
meaning of a fraction/subscript/exponent in speech, reveal a step out of order,
or let captions obscure the formula. Pass only after a listener can match the
spoken and displayed steps to the same derivation.
