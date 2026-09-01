# Editorial rubric and regression method (AES-P3.2 / SUE-450)

Machine form: [`rubric.json`](rubric.json). Engine:
`../scripts/lib/eval-core.mjs`. Run: `npm run eval`.

Sixteen dimensions in two classes with **different authority**. Keeping them
apart is the whole design.

## Two classes

| Class | Scale | Authority |
|---|---|---|
| **Integrity** (5) | `pass` / `fail` | Hard gate. A fail blocks finalization regardless of any editorial rating. |
| **Editorial** (11) | 0–3 | Advisory. Human editorial judgment stays final for style and insight. |

**There is deliberately no total score.** A single number would hide the one
thing this rubric exists to reveal: a piece can improve on every editorial
dimension while failing on integrity.

That is not hypothetical. It is fixture `N-03`, and the suite fails if the
method reports it as anything but a regression.

## Integrity dimensions

| | Fails when | Decided by |
|---|---|---|
| **I-1** citation-integrity | A citation does not resolve, repeats to inflate the evidence base, points at a working document, or does not support the claim beside it | gate + `verify-claims` |
| **I-2** polish-preservation | A protected span changed across a polish pass | `polish-invariants` (fully mechanical) |
| **I-3** claim-support | A material claim is unsupported, or an interpretation is presented as a verified fact | `verify-claims` (not mechanical) |
| **I-4** publication-state | An article reaches `published` without recorded approval, or a Skill claims publication authority | contract validators |
| **I-5** provenance-lineage | An artifact cannot identify its article version, carries an unverified claim, or asserts a staleness level its hashes contradict | contract validators |

## Editorial dimensions

thesis-clarity · synthesis · evidence-density · original-reasoning ·
fact-interpretation-separation · flow-density · headline-fidelity ·
overclaiming · ai-scaffolding · content-type-fit · voice-fit

Each requires **observable evidence** — a quoted sentence, a measured
fraction, a named paragraph. A rating without evidence is not recorded.

Where a gate backs a dimension, a finding caps the rating at 0. Where no gate
backs it, the runner leaves the dimension `unscored` rather than inventing a
number. **An empty slot is honest; a fabricated rating is not.**

This split follows the LLM-as-judge findings in
[`../benchmarks/EDITORIAL-SYSTEMS-BENCHMARK.md`](../benchmarks/EDITORIAL-SYSTEMS-BENCHMARK.md)
(`ref:llm-judge-reliability`): decompose the rubric into discrete checks, and
never delegate a mechanically decidable question to a judge.

## The regression rule

> A run is a regression if **any integrity dimension moves to `fail`**,
> regardless of how many editorial dimensions improved.

Including `unscored → fail`: the baseline may have been undecidable, but the
new run is decidably wrong.

The rationale is stated in the machine form so it cannot be quietly relaxed: a
piece that reads better and states a wrong number is worse, and a method that
reports it as an improvement is measuring the wrong thing.

## Comparison procedure

To compare two versions of a rule set, a Skill, or a prompt:

1. Run `npm run eval` on the corpus before the change; keep the scorecards.
2. Make the change.
3. Run again.
4. Compare per fixture. Integrity regressions dominate; editorial changes are
   reported but never override.

The paired fixture `G-01 → N-03` is the built-in calibration for step 4. If
the comparison of that pair ever stops reporting `REGRESSION`, the method has
broken and the suite fails.

## Cost

No model call, no multi-agent review, no external service. Six fixtures,
sixteen dimensions, under a second. It is meant to be rerun after **every**
meaningful rule or Skill change, which is only possible because it is cheap.

Judge-assisted scoring of the `unscored` dimensions can be layered on later.
It is not required for the method to detect the regressions that matter.

## Human authority

A human editorial acceptance is recorded separately and is never replaced by a
rating here. Model ratings inform; they do not accept.

Golden fixtures are references, **not templates**. They show what good looks
like for a register. A piece that imitates their structure mechanically has
missed the point and will read as formulaic — which the `formulaic-sectioning`
gate exists to catch.
