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
| G-13 | `translationese-scaffold` | flag | The same scaffold — one of `라는 점에서`, `다는 점에서`, `의 관점에서`, `이러한 맥락에서`, `결국 중요한 것은` — repeated at least twice, with a length-scaled total floor (4 for a short piece); several different ones each used once does not fire |

### Notes on the two most interesting gates

**G-12 `sequential-summary`** is the mechanical proxy for Constitution §4. A
synthesis interleaves sources; a restatement walks them in order. Checking the
citation sequence catches the shape without judging the content. It is a
`flag`: interleaving is not proof of synthesis, and a piece with one dominant
source is not automatically a summary.

**G-13 `translationese-scaffold`** is counted, not first-match, unlike every
other pattern gate above: one occurrence of any listed string is ordinary
Korean — attributing a viewpoint to a third party, naming a cause, framing a
stake, all once, is unremarkable writing, not translationese. This gate keys
on repetition of the *same* scaffold, which is narrower than `voice.md`'s
own test: `voice.md` ("Native Korean, not translated Korean") flags
repetition **or** an English-shaped discourse order running underneath
correct Korean grammar. Several different scaffolds used once each, and
English-shaped discourse order generally, are deliberately outside what this
gate can see — that is a documented gap, not a claim to implement the full
rule. It fires only when (a) a single string repeats at least twice, and (b)
the summed total clears a threshold that scales with paragraph count, so a
handful of legitimate one-off uses spread across a long piece cannot sum to
a false positive the way a flat count would.

Two false positives were measured during review at the original floor of 3:
a short passage using three *different* scaffold strings once each; and,
separately, two idiomatic three-paragraph passages at that same floor —
contrastive viewpoint attribution to two named parties (`의 관점에서` ×2),
and an ordinary causal connective used twice (`다는 점에서` ×2) — both core
View/Research moves, not translationese. The per-pattern repeat requirement
fixed the first; the floor was raised from 3 to 4 to fix the second two,
verified against floors 3–6, without loosening the requirement for genuine
repetition (`N-04`'s seven-occurrence body still fires at 4). The trade has
a cost, also measured: this gate is now silent on five distinct scaffolds
used once each in a single dense, English-shaped paragraph, and on `N-04`'s
own case-7 paragraph standing alone (it only contributes to the whole
piece's count). That is accepted at `flag` severity — genuine but
unrepeated English-shaped discourse order is exactly the kind of judgement
call `evals/rubric.json` dimension E-13 exists to carry, not this gate.

It covers five of the SUE-523 failure signatures — the most countable, not
the least ambiguous; `~을 통해`, `~에 대한`, and `~에 있어` are named in
`voice.md` but deliberately excluded here, because they occur too often in
legitimate technical Korean (e.g. "AI Agent를 통해") to gate on without
judgement. It does not attempt subject-omission, verb-forward rewriting, or
"does this read as formed in Korean," because those are not mechanically
decidable; they stay editorial judgement (`evals/rubric.json`, dimension
E-13). It also cannot fire inside a protected quotation — those spans are
stripped before counting, same as a fixture's own HTML-comment header,
because a hit there would ask the polish pass to change a span
`polish-invariants` forbids changing at reject severity; the paragraph count
used to scale the threshold is taken from that same comment-stripped text,
so a fixture's own documentation cannot inflate its own effective threshold.
A gate that is wrong about good writing is worse than no gate, so this one
stays narrow on purpose, and a synonym-substitution rewrite of the scaffold
strings is a known, bounded gap in this gate specifically — the actual
defense against a manufactured replacement formula is `voice.md`'s and
`editorial-polish`'s explicit anti-formula guidance plus human editorial
judgement (E-13), not this pattern list.

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
