# Quality gates

Explicit reject / fix / flag conditions. Machine form:
[`quality-gates.json`](quality-gates.json). Engine:
`../scripts/lib/quality-gates-core.mjs`. Run with `npm run check:gates`.

These gates encode the SUE-417 failure modes — the first end-to-end draft that
transported correctly and read badly. Every `reject` gate below fires on that
draft's shape.

## Severity

| Severity | Meaning |
|---|---|
| **reject** | Blocks materialization. The piece cannot reach `final`. |
| **fix** | Must be resolved before human review. Not a matter of taste. |
| **flag** | Human judgement required. The gate has noticed a shape, not proven a fault. |

A `flag` is never auto-resolved and never auto-fails. It exists because
pretending a judgement call is mechanical is how a rubric starts lying.

## Pattern gates vs. code-only gates

Most gates below are driven entirely by data in `quality-gates.json`: a list
of regex `patterns` (or, for G-09/G-10/G-12, a threshold) that the engine
reads and applies generically. Three gates — **G-02**, **G-04**, and
**G-11** — are structural checks that cannot be expressed as a regex against
body text, so they are hardcoded directly in
`scripts/lib/quality-gates-core.mjs` instead:

| Gate | Why it cannot be a pattern |
|---|---|
| G-02 `duplicate-paragraph` | Compares every normalised paragraph against every other paragraph in the document — a whole-document pairwise comparison, not something one paragraph either matches or does not. |
| G-04 `headline-thesis-fidelity` | Computes content-word set overlap between two structured fields (`frame.thesis`, `title`), not a match against rendered text. |
| G-11 `uncertainty-present` | A presence/length check on a structured field (`frame.uncertainty`) — there is no prose for a regex to run against. |

`quality-gates.json` still carries an entry for each of these three (marked
`"implementation": "code"`, with no `patterns` array) so the JSON remains a
complete registry of every gate id — but the engine does not read pattern
data for them, because none exists. Do not add a `patterns` array to one of
these three entries to "complete" the JSON; that would make the file claim
behavior the engine does not execute, which is the exact failure this note
exists to prevent.

## Mechanical gates

| ID | Gate | Severity | Fires when |
|---|---|---|---|
| G-01 | `prompt-echo` | reject | The instruction to the generator appears as prose ("Explain the key facts … using evidence", "What should readers know about …") |
| G-02 | `duplicate-paragraph` | reject | A paragraph of ≥40 normalised characters appears more than once |
| G-03 | `scaffolding-leak` | reject | `> **Note:**`, `TODO`, `{{…}}`, `[insert …]`, placeholder text |
| G-04 | `headline-thesis-fidelity` | fix | Title shares fewer than two content words with the thesis |
| G-05 | `citation-integrity` | reject | A citation URL repeats; a citation points at a working-document host; a citation is labelled disposable or internal |
| G-06 | `filler-phrase` | fix | A banned opening or closing from `voice.md` |
| G-07 | `overclaim` | flag | Absolutes: *guarantees*, *proves that*, *in all cases*, 항상, 반드시, 절대로 |
| G-08 | `empty-hedge` | fix | *may vary significantly*, *depends on many factors*, 경우에 따라 다를 수 있다 — a hedge carrying no number and no citation |
| G-09 | `evidence-density` | flag | Under 30% of paragraphs carry a number, a date, or a citation |
| G-10 | `formulaic-sectioning` | flag | Two or more generic headings (*Key takeaways*, *Core analysis*, *Implications and limits*, *Why it matters*, 핵심 요약 …) |
| G-11 | `uncertainty-present` | reject | The frame states no uncertainty |
| G-12 | `sequential-summary` | flag | ≥80% of citing paragraphs cite exactly one source, and the sources appear in order |

### Notes on the two most interesting gates

**G-12 `sequential-summary`** is the mechanical proxy for Constitution §4. A
synthesis interleaves sources; a restatement walks them in order. Checking the
citation sequence catches the shape without judging the content. It is a
`flag`: interleaving is not proof of synthesis, and a piece with one dominant
source is not automatically a summary.

**G-04 `headline-thesis-fidelity`** is deliberately narrow. It catches a title
written for a different piece. Whether a claim-shaped title *faithfully*
carries the argument is judgement and belongs to the rubric (AES-P3.2). A
predicate-detection heuristic was implemented and removed: it misread real
published titles across languages, and a gate that is wrong about good writing
is worse than no gate.

## Polish invariants

`../scripts/lib/polish-invariants.mjs`. This is what makes polish different
from rewrite.

A polish pass may change rhythm, connectives, ordering within a paragraph, and
word choice outside the protected set. Across a before/after pair, these must
be **identical multisets**:

| Class | Covers |
|---|---|
| `numbers` | Figures with their units — `30%` and `30배` are distinct spans |
| `dates` | ISO dates, years, 2026년 |
| `citation-markers` | `[^1]`, `[2]` |
| `quotations` | Anything inside `"…"`, `“…”`, `「…」` |
| `urls` | Every link |
| `technical-terms` | ASCII technical vocabulary carried in the prose |

Direction matters. A removed number is a lost fact; an **added** one is a
fabrication. Both are violations, and both are reject-severity.

If a polish pass wants to change a protected span, it has found a
verification problem. It must report it, not fix it.

## `no article` is a passing outcome

When the corpus does not support a thesis, `state: no_article` with a recorded
reason is correct and terminal. It is not a gate failure, it does not count
against quality, and no gate here can be satisfied by publishing a weaker
piece instead.

## What these gates are not

They are not the rubric. They decide whether a piece is *shaped* like an
article; whether it is *worth* one is AES-P3.2 (SUE-450). Keeping the
mechanical checks out of the judge is a deliberate design decision, taken from
the LLM-as-judge findings in
`../benchmarks/EDITORIAL-SYSTEMS-BENCHMARK.md` (`ref:llm-judge-reliability`):
anything decidable must be decided, not scored.

They also contain no rule aimed at defeating an AI detector. See Constitution
§7.
