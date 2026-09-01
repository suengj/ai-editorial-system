# evals/

Fixture corpus, editorial rubric, and the regression method.

| | |
|---|---|
| Corpus | [`fixtures/manifest.json`](fixtures/manifest.json) — 3 golden, 3 negative (AES-P3.1 / SUE-449) |
| Rubric | [`RUBRIC.md`](RUBRIC.md) + [`rubric.json`](rubric.json) — 16 dimensions (AES-P3.2 / SUE-450) |
| Runner | `../scripts/run-eval.mjs` |

```bash
npm run eval        # scorecard over the corpus
npm run eval -- --verbose
npm run test:eval   # the method's own regression suite
```

## The corpus

| Fixture | Type | Tests |
|---|---|---|
| `G-01` | news | Synthesis across disagreeing sources; thesis first |
| `G-02` | view | Position first, strongest objection conceded, falsifiable |
| `G-03` | note | One observation, judgment kept, brevity as correctness |
| `N-01` | news | The SUE-417 failure shape — prompt echo, repetition, scaffolding |
| `N-02` | news | Phantom citations: every citation resolves, none supports |
| `N-03` | news | **Smoother and factually worse** — paired against G-01 |

Bodies only, no front matter, so a fixture is a fixture and never an article.
All synthetic or owner-authored; no third-party article is reproduced.

`N-02` is deliberately clean to every mechanical gate. It exists to prove the
mechanical layer is insufficient on its own — only `verify-claims` catches it.

`N-03` is the calibration for the whole method. It reads better than `G-01`
and states a wrong number. If the comparison ever stops reporting
**REGRESSION**, the method has broken and the suite fails.

## Golden fixtures are references, not templates

They show what good looks like for a register. A piece that imitates their
structure mechanically has missed the point — and the `formulaic-sectioning`
gate exists to catch exactly that.

## What the corpus already found

The first run flagged `evidence-density` on both the View and the Note golden
fixtures. The gate was right that they carry few numbers and wrong to treat
that as a fault: a View earns its keep by reasoning, not citation volume. The
floor is now per content type, calibrated against these fixtures rather than
picked a priori.
