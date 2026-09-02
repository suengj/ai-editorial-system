# evals/

Fixture corpus, editorial rubric, and the regression method.

| | |
|---|---|
| Corpus | [`fixtures/manifest.json`](fixtures/manifest.json) — 4 golden, 6 negative (AES-P3.1 / SUE-449) |
| Rubric | [`RUBRIC.md`](RUBRIC.md) + [`rubric.json`](rubric.json) — 19 dimensions: 6 integrity + 13 editorial (AES-P3.2 / SUE-450) |
| Runner | `../scripts/run-eval.mjs` |
| SUE-417 calibration | [`SUE-417-CALIBRATION.md`](SUE-417-CALIBRATION.md) |

```bash
npm run eval        # deterministic scorecard over the corpus
npm run eval -- --verbose
npm run test:eval   # the method's own regression suite
```

## The corpus

| Fixture | Type | Tests |
|---|---|---|
| `G-01` | news | Synthesis across disagreeing sources; thesis first |
| `G-02` | view | Position visible, strongest objection conceded, falsifiable |
| `G-03` | note | One observation, judgment kept, brevity as correctness |
| `G-04` | research | Alternate Korean Research register; native rhythm without copying G-01 |
| `N-01` | news | The SUE-417 failure shape — prompt echo, repetition, scaffolding |
| `N-02` | news | Phantom citations: every citation resolves, none supports |
| `N-03` | news | **Smoother and factually worse** — paired against G-01 |
| `N-04` | research | Mechanically acceptable but translationese Korean |
| `N-05` | view | Mechanically acceptable but one house-style move repeated until formulaic |
| `N-06` | research | Mechanically acceptable but source/repository topology replaces the argument |

Bodies only, no front matter, so a fixture is a fixture and never an article.
All synthetic or owner-authored; no third-party article is reproduced.

`N-02`, `N-04`, `N-05`, and `N-06` deliberately demonstrate four different
limits of the mechanical layer.

- `N-02`: citations resolve mechanically but do not support their claims.
- `N-04`: grammar and structure are acceptable, but the Korean exposes an
  English discourse skeleton. `E-13 language-native-prose` is the relevant
  human/judge dimension.
- `N-05`: each sentence is defensible, but a corpus tendency (`A ≠ B`) has been
  over-applied until the voice becomes a template. `E-11 voice-fit` is the
  relevant dimension.
- `N-06`: the material is understood and the prose is clean, but the headings
  walk the source system component by component. `E-2 synthesis`, `E-4
  original-reasoning`, and `E-6 flow-density` are the relevant dimensions. The
  failure was exposed by the first published AI Editorial System introduction
  on 2026-09-02: accurate repository coverage produced documentation-shaped
  prose rather than an article-shaped argument.

These fixtures are expected **not** to hard-fail at L0. If a deterministic gate
starts claiming it can prove translationese, style overfit, or source-tour
quality from a keyword count, that is a regression in the evaluation design
rather than an improvement.

`N-03` remains the integrity calibration for the whole method. It reads better
than `G-01` and states a wrong number. If the comparison ever stops reporting
**REGRESSION**, the method has broken and the suite fails.

## Three evaluation layers

```text
L0 deterministic
   contracts · provenance · factual shape · mechanical gates

L1 advisory judgement
   reasoning · register · voice · language-native prose

L2 human acceptance
   final editorial worth and publication authority
```

The current runner is intentionally L0. It leaves judgement dimensions
`unscored` rather than inventing a rating. Judge-assisted L1 can be added later
without giving the judge publication authority.

## Two questions the runner answers

**Did this get worse?** — `compare()`, integrity dominates. `G-01 → N-03`.

**Is this materially better than where we started?** — `calibrate()`, against
the SUE-417 baseline. `N-01 → G-01`. Material improvement means every blocking
failure cleared, not merely fewer findings: a draft that still cannot be
materialized has not improved materially, however much tidier it reads.

## Golden fixtures are references, not templates

They show multiple valid registers and shapes. `G-04` exists partly to stop
`G-01` from becoming the implicit sentence template for all analytical writing.
A piece that copies a golden fixture mechanically has missed the point.

The same rule now applies to **source corpora themselves**. A repository, source
manifest, or research brief is evidence inventory, not a prose template. `N-06`
exists so a future Writer cannot claim successful synthesis merely because it
covered every component accurately.

## What the corpus already found

The first run flagged `evidence-density` on both the View and the Note golden
fixtures. The gate was right that they carry few numbers and wrong to treat
that as a fault: a View earns its keep by reasoning, not citation volume. The
floor is now per content type, calibrated against these fixtures rather than
picked a priori.

The later prose test exposed a different class of failure: a draft can satisfy
thesis, synthesis, uncertainty, evidence, and structural gates while still read
like translated AI prose. That failure now has an explicit rubric dimension
and negative fixtures instead of being hidden inside the vague label
`voice-fit`.

The 2026-09-02 project-introduction test exposed another: **correct reading can
still produce the wrong article shape**. When source coverage becomes the goal,
the Writer demonstrates what it read instead of deciding what the reader needs.
That failure is now owned by framing and editorial judgement rather than being
misclassified as a prose-polish problem.
