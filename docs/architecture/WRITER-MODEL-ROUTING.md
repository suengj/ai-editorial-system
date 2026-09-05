# Writer capability and model routing

Status: operating contract

This document defines how model capability is assigned to editorial roles. It is deliberately provider-neutral. `Manager`, `Writer`, and `Reviewer` are authority roles; they are **not** a ranking that says the Writer should use a cheaper or weaker model than the Manager.

## 1. Why this contract exists

A Manager can specify the thesis, evidence burden, audience, transformation, prohibited moves, and acceptance criteria. It still does not choose every Korean collocation, particle, omission, sentence boundary, connective, rhythm decision, or paragraph transition that appears in the final prose.

Those are realised by the Writer. A weaker Writer can therefore produce structurally correct but visibly inferior prose while following a strong Manager's instructions accurately.

A stronger Reviewer does not remove this ceiling. It can identify that the prose is weak, but unless the finding is routed back to a capable Writer, the accepted artifact is still weak.

The operating rule is:

> **Authority may be hierarchical. Capability is task-shaped. Final prose is a load-bearing capability surface.**

Cost optimisation must happen around that fact, not by assuming `Writer < Manager` in model capability.

## 2. Role separation

### Manager

Owns decisions about:

- editorial intent and source→target delta;
- thesis, frame, evidence burden, and transformation scope;
- which layer owns a failure;
- whether a task is P0/P1/P2/P3;
- write ownership and stop/escalation decisions;
- integration of independent review findings.

The Manager is not expected to rewrite every paragraph. If it does, it has silently become the Writer and must be treated as such for provenance and capability routing.

### Writer

Owns the actual realization of the target artifact:

- word and collocation choice;
- clause and sentence construction;
- information pacing;
- omission and repetition;
- paragraph rhythm;
- register realization;
- preserving good incumbent prose while making justified changes.

For final or owner-facing prose, these are not clerical operations. They are quality-critical judgments.

### Reviewer

Owns independent judgment, not authorship by default:

- detect semantic drift and unsupported claims;
- detect source→target misclassification;
- detect native-language, genre, audience, domain, and owner-fit failures;
- detect churn and over-editing;
- return evidence to the Manager.

A Reviewer finding is not an instruction to apply a specific rewrite. If the Reviewer writes the replacement itself and that replacement is accepted, it has temporarily taken Writer authority and the provenance should say so.

## 3. Capability classes

The orchestration layer may map these classes to any provider/model configuration available at runtime. The Core does not bind them to vendor names.

### SUPPORT

Suitable for bounded, low-ambiguity work such as:

- metadata extraction;
- deterministic formatting;
- fixture creation from an already-fixed contract;
- file/index maintenance;
- simple classification where a guard can fully validate the answer.

SUPPORT is **not** the default for final prose.

### REASONING_HIGH

Required when the task owns consequential planning or judgment, including:

- framing and thesis selection;
- source→target delta assessment;
- evidence conflict resolution;
- routing a failure to the correct layer;
- independent editorial review.

### PROSE_HIGH

Required for owner-facing or publication-intent prose where native realization is load-bearing. It must be able to preserve semantic precision while making natural language decisions across long context.

Examples:

- a Korean News/Report/View article;
- an audience transformation whose surface language is materially different from the source;
- a final language-polish candidate;
- a translation or adaptation whose value depends on native phrasing rather than literal fidelity.

`PROSE_HIGH` can be the same runtime model as `REASONING_HIGH`, but that is an implementation choice, not an architectural assumption.

## 4. Routing rules

### R1 — final prose has a capability floor

Do not downgrade a final prose Writer merely because a stronger Manager or Reviewer exists around it. A Manager prompt is a constraint surface, not a substitute for the Writer's language model capability.

### R2 — context is part of capability

A nominally strong Writer without the relevant frame, source truth, target profile, and prior owner evidence may perform worse than a context-rich Writer. Route both **model capability and context**.

For final prose, the Writer should receive the smallest complete context that includes:

- approved frame;
- verified claim set / canonical source truth;
- target genre and audience;
- source→target delta plan;
- relevant language/domain profile;
- current owner feedback that is actually durable or task-local.

Do not make the Writer reconstruct these from a long conversation transcript.

### R3 — single Writer per coherent prose pass

One coherent draft/pass should have one Writer authority. Parallel Writers may create alternatives, but their paragraphs are not stitched together mechanically. A Manager chooses one base or explicitly commissions a new synthesis pass.

This prevents register seams and paragraph-level style averaging.

### R4 — P0/P1 are not 'easy model' work

SUE-610 established `P0 PRESERVE` and `P1 LOCAL_POLISH` as small-intervention modes. Small edit surface does **not** mean low judgment.

Deciding that a good sentence should remain untouched, or that `…신호로 읽힌다` must not become `…신호다`, can require more language and semantic sensitivity than broad rewriting.

Therefore P0/P1 polish may require `PROSE_HIGH` even when the output changes only a few words.

### R5 — P2/P3 require upstream reasoning before prose

`P2 CONTROLLED_ADAPT` and `P3 RECOMPOSE` require `REASONING_HIGH` planning at the owning upstream layer. Once the target structure is fixed, the resulting prose is still realised by a `PROSE_HIGH` Writer.

For example:

```text
professional Report → 10–12-year-old explainer

REASONING_HIGH
  Audience / Transformation reconstruction
        ↓
PROSE_HIGH
  coherent child-facing draft
        ↓
PROSE_HIGH or equivalent judgment
  conservative polish / KEEP
```

The polish layer must not redo the upstream transformation.

### R6 — Reviewer strength cannot compensate for Writer weakness

When a strong Reviewer returns repeated `native_fluency`, `continuous_readability`, `register`, or paragraph-rhythm failures, do not create an endless reviewer→same-weak-writer loop.

The Manager must choose one of:

1. targeted repair by the same Writer when the defect is genuinely bounded;
2. regenerate the affected section/draft with a higher prose-capability Writer;
3. replan upstream if the problem is structural;
4. KEEP the incumbent when the proposed repair is not clearly better.

### R7 — escalation is evidence-based

Escalate Writer capability when one or more of these occur:

- two review cycles identify the same prose-quality class;
- the Writer repeatedly follows a soft rule while making the prose less natural;
- pairwise review frequently reverts candidates because they are stiff, over-explicit, or semantically lossy;
- the target requires deep audience reconstruction and the draft remains source-shaped;
- owner review identifies a clear capability gap rather than a missing rule or preference.

Do not escalate merely because an artifact is important. Route the capability to the failure mode.

## 5. Relation to conservative language polish

The Source→Target Delta contract remains upstream:

```text
Actual source / incumbent draft
→ SourceProfile / TargetProfile
→ per-axis delta
→ P0 / P1 / P2 / P3
→ target draft
→ conservative language polish
```

Language polish then returns:

```text
KEEP
LOCAL_POLISH
UPSTREAM_REPLAN_REQUIRED
```

A `PROSE_HIGH` model does not receive permission to rewrite broadly. Higher capability increases the quality of judgment; it does not widen authority.

This distinction is central:

> **Use a strong Writer inside a narrow contract, not a weak Writer inside a detailed prompt.**

## 6. Owner evidence — 2026-09-05

This routing rule is supported by owner-facing operating evidence, but it is **not a controlled model benchmark**.

Sequence:

1. SUE-570 produced readable multi-audience drafts but the owner identified non-native Korean at the margin.
2. SUE-604 applied a broad rule-driven rewrite and regressed readability and, in one child case, semantic integrity. The owner rejected the AFTER set.
3. SUE-610 introduced source→target delta planning, KEEP as success, bounded polish, and pairwise revert. The owner confirmed the surviving local edits were materially better.
4. A subsequent six-article regeneration was written by one context-rich strong prose model from the two canonical sources using the corrected architecture. News and Report preserved compatible register while changing depth/structure; child variants were reconstructed upstream and then left largely alone. The owner judged the set **materially improved** over the earlier automated outputs.

What this evidence supports:

- Writer capability is an independent quality variable and should be routed explicitly.
- A strong Manager/Reviewer does not justify automatically downgrading the Writer.
- context-rich single-writer realization plus the corrected architecture is a promising operating configuration.

What it does **not** prove:

- that one named vendor/model is universally superior;
- that model capability alone caused the improvement, because architecture, context, and authorship configuration also changed;
- that every draft needs the most expensive model.

The evidence record is stored under `evals/dogfood/2026-09-05-strong-writer-routing/` and the owner-facing draft bodies remain in `suengj-com`, not this control-plane repository.

## 7. MWR operating template

A default editorial MWR configuration is:

```text
Manager — REASONING_HIGH
  intent / frame / delta / ownership / integration

Writer — PROSE_HIGH for final prose
  draft realization / bounded revision
  SUPPORT may handle non-prose helper work

Reviewer — REASONING_HIGH, independent of Writer
  evidence-backed critique / no automatic rewrite authority
```

Provider-specific choices are deployment configuration. The durable rule is the capability/authority separation above.

## 8. Anti-patterns

Reject these routing patterns:

- `Manager is strongest, therefore Writer can be cheap`;
- `Reviewer will fix whatever the Writer misses`;
- paragraph-by-paragraph multi-writer assembly without a synthesis Writer;
- sending a low-capability Writer more rules instead of escalating capability;
- treating a tiny edit surface as evidence that the task is low judgment;
- letting a stronger model widen its authority from local polish to re-authoring;
- using model cost as a quality score or model size as proof of fitness.

## 9. Portability

This is a generic Editorial Learning Core contract. A future model/provider change should require only routing configuration and regression evidence, not a rewrite of the editorial methodology.

When a model changes on a load-bearing prose lane, treat it as a calibration event: compare accepted outputs, native-language quality, edit/revert behavior, semantic integrity, and cost per accepted result before declaring the new route equivalent.