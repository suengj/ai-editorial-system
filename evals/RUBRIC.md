# Editorial rubric and regression method (AES-P3.2 / SUE-450)

Machine form: [`rubric.json`](rubric.json). Engine:
`../scripts/lib/eval-core.mjs`. Run: `npm run eval`.

Nineteen dimensions in two classes with **different authority**. Keeping them
apart is the whole design.

## Two classes

| Class | Scale | Authority |
|---|---|---|
| **Integrity** (6) | `pass` / `fail` | Hard gate. A fail blocks finalization regardless of any editorial rating. |
| **Editorial** (13) | 0–3 | Advisory. Human editorial judgment stays final for style and insight. |

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
| **I-6** presentation-portability | A semantic block loses information in plain Markdown, or Writer output leaks renderer/CSS/colour semantics | presentation validator |

## Editorial dimensions

thesis-clarity · synthesis · evidence-density · original-reasoning ·
fact-interpretation-separation · flow-density · headline-fidelity ·
overclaiming · ai-scaffolding · content-type-fit · voice-fit · presentation-fit ·
**language-native-prose**

Each requires **observable evidence** — a quoted sentence, a measured
fraction, a named paragraph, or a named structural finding. A rating without
evidence is not recorded.

Where a gate backs a dimension, a finding caps the rating at 0. Where no gate
backs it, the runner leaves the dimension `unscored` rather than inventing a
number. **An empty slot is honest; a fabricated rating is not.**

### Voice fit is not language fit

These are deliberately separate.

**E-11 `voice-fit`** asks whether the piece preserves the shared editorial core:
precision, restraint, factual honesty, and domain-appropriate terminology. It
also asks whether a Writer is mechanically imitating a corpus tendency — for
example building several paragraphs from the same `A ≠ B` contrast because
`voice.md` once described distinctions as characteristic.

**E-13 `language-native-prose`** asks a different question: does the prose read
as composed in the publication language? For Korean, grammatically correct text
can still fail because its discourse order, connectives, or noun choices expose
an English sentence underneath it. Repeated "이 구분은", "이 관점에서", "따라서",
"반대로", or English noun accumulation are evidence only when they reveal that
translated skeleton; none is a banned phrase by itself.

E-13 is **not an AI detector**. Human writing can be translationese; model
writing can be native. The object being evaluated is the prose, not its origin.

### Content register is separate again

`E-10 content-type-fit` includes the profile's `register`. Research, View,
News, Note, and Project share a voice identity but should not share one sentence
architecture. A Research piece can be analytical without sounding like a
translated paper; a Note can be loose without borrowing Research's evidence
cadence.

This split follows the LLM-as-judge findings in
[`../benchmarks/EDITORIAL-SYSTEMS-BENCHMARK.md`](../benchmarks/EDITORIAL-SYSTEMS-BENCHMARK.md)
(`ref:llm-judge-reliability`): decompose the rubric into discrete checks, and
never delegate a mechanically decidable question to a judge.

## Evaluation layers

The cheap runner remains deliberately incomplete. Prose judgement does not
become trustworthy by pretending it is deterministic.

```text
L0  deterministic validators / gates
    factual shape · contracts · provenance · mechanical failure

L1  advisory human or judge review
    reasoning · register · voice · language-native prose

L2  human editorial acceptance
    publish-worthiness and final authority
```

L1 may later be model-assisted, but it has no hard publication authority. A
judge finding is a signal for review, not a substitute for the editor.

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

The paired fixture `G-01 → N-03` is the built-in integrity calibration. If the
comparison of that pair ever stops reporting `REGRESSION`, the method has
broken and the suite fails.

`N-04` and `N-05` serve a different purpose: both are intended to remain
mechanically clean while failing editorial judgement. They prove that passing
L0 is not the same thing as good prose.

## Cost

The deterministic run has no model call, no multi-agent review, and no external
service. It is meant to be rerun after **every** meaningful rule or Skill
change.

Judge-assisted scoring of the `unscored` dimensions can be layered on later.
It is useful for E-11 and E-13 in particular, but it is not required for the
method to detect integrity regressions.

## Human authority

A human editorial acceptance is recorded separately and is never replaced by a
rating here. Model ratings inform; they do not accept.

Golden fixtures are references, **not templates**. They show what good looks
like for a register. A piece that imitates their structure mechanically has
missed the point. Negative fixtures now include not only broken factual or
transport shapes, but also prose that is factually sound and still editorially
bad.
