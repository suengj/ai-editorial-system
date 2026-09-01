# SUE-417 calibration — pipeline PASS, editorial FAIL

The 2026-09-01 end-to-end smoke test produced a draft and a GitHub draft PR
from the Drive corpus. The transport worked. The article did not.

This document records that split, the diagnosis, and the measured improvement
of the calibrated contract against it.

## Classification

| | Result |
|---|---|
| E2E transport / orchestration / publication path | **PASS** |
| Article quality / editorial acceptance | **FAIL** |
| Live publication | **NOT APPROVED** |

The smoke-test artifact is retained as a **negative fixture** (`N-01`). It is
not, and must never be treated as, a good-article exemplar.

## Diagnosis — read from the draft, not inferred

| Observed | Why it happened |
|---|---|
| "Explain the key facts, implications, and limits … using evidence" appears as the dek *and* the first body line | The generator instruction was never separated from the output contract |
| One paragraph repeated seven times verbatim | No structural check on the produced body |
| `> **Note:** State the problem and the direct answer first` shipped as content | Planning scaffolding shared a channel with prose |
| Two identical citations to one disposable Google Doc, labelled "AUTO-BLOG SOURCE (disposable)" | Provenance pointed at a working document rather than a source |
| "does not automatically equate … as usage behaviors vary significantly" | A hedge standing in for a missing number |
| *Key takeaways / Core analysis / Implications and limits* | Section framing applied mechanically |
| Each citing paragraph on one source, in order | Sequential restatement rather than synthesis |

The common root: **there was no thesis and no framing step.** Every symptom
above is what a pipeline produces when it is asked to write about a topic
rather than to argue a claim. That is why `frame-article` exists, and why
`NO_ARTICLE` is a first-class outcome of it.

## What the calibrated contract requires

| Failure | Now prevented by |
|---|---|
| No thesis | `frame-article` — no prose before a frame; `NO_ARTICLE` is a valid result |
| Prompt echo | `prompt-echo` gate — reject |
| Repetition | `duplicate-paragraph` gate — reject |
| Scaffolding leak | `scaffolding-leak` gate — reject |
| Disposable-source provenance | `citation-integrity` gate — reject |
| Empty hedge | `empty-hedge` gate — fix |
| Formulaic sectioning | `formulaic-sectioning` gate — flag |
| Sequential summary | `sequential-summary` gate — flag |
| No stated uncertainty | `uncertainty-present` gate — reject; an empty `frame.uncertainty` is rejected outright |
| Publication without review | `final` maps to `status: draft`; `published` requires recorded human approval |

## Measured comparison

Run `npm run eval`:

```
calibration N-01 → G-01: MATERIALLY BETTER
  hard fail: true → false
  reject 3 → 0   fix 1 → 0   flag 2 → 0
```

Both fixtures are news-register pieces on the same subject. The baseline is
the smoke draft's failure shape; the calibrated fixture is what the contract
now requires.

**Material improvement is defined narrowly**: every blocking failure gone, not
merely fewer findings. A draft that still cannot be materialized has not
improved materially, however much tidier it reads. The suite fails if this
comparison stops holding.

## What this does not claim

- It does not claim the calibrated fixture is a *good article*. It claims the
  contract now rejects what it should reject. Article-worthiness, synthesis
  quality, and voice remain human judgements — the editorial dimensions of the
  rubric are `unscored` by the mechanical runner, deliberately.
- It does not claim the rerun was performed against the live P03 corpus. The
  measured comparison is fixture-based. A live rerun belongs to P5
  (SUE-458) and stays open.
- No live auto-publish authority was introduced anywhere in the calibration.

## Reused authorities

Rather than reviving the earlier pipeline's rules wholesale, the durable parts
were carried into layers that are now executable: quality gates
(`editorial/quality-gates.json`), content-type profiles
(`editorial/profiles/`), and the rubric (`evals/rubric.json`). Where an old
rule is now enforced mechanically, the mechanism is the authority; where it
needs judgement, it is a rubric dimension.
