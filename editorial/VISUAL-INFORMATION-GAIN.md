# Visual Information Gain — anti-redundancy gate for article visuals

This document governs a failure mode that occurs **before rendering quality matters**: a visual can be accurate, well styled, correctly placed, and still be editorially weak because it merely repeats what the surrounding article has already shown.

The governing question is not:

```text
Can this paragraph be turned into a diagram?
```

It is:

```text
What new structure, relationship, comparison, compression, spatial model,
or memorable abstraction becomes available to the reader because this visual exists?
```

If the answer is `none`, the correct action is `skip`, or replace an existing representation rather than stacking both.

Related contracts:

- [`ARTICLE-ILLUSTRATION-ROUTING.md`](ARTICLE-ILLUSTRATION-ROUTING.md) — thesis / reader need → visual family routing.
- [`IMAGE-GENERATION.md`](IMAGE-GENERATION.md) — image brief, renderer routing, generation QA.
- [`ARTICLE-VISUAL-PUBLICATION-HANDOFF.md`](ARTICLE-VISUAL-PUBLICATION-HANDOFF.md) — semantic placement and publication integration.
- [`VISUAL-STORY-COMPILATION.md`](VISUAL-STORY-COMPILATION.md) — cross-surface argument beats.

---

## 1. Core rule: visuals must have marginal information gain

A body visual earns space only when it adds **marginal information gain** beyond its adjacent representation.

Adjacent representation includes the nearby:

- prose paragraph;
- bullet list;
- code block;
- equation;
- table;
- quoted sequence;
- previously shown visual.

The local comparison window should normally include the semantic block immediately before and after the planned placement, and may expand to the full section when necessary.

A visual has sufficient marginal information gain when it materially does at least one of these:

| Gain type | What the visual adds |
|---|---|
| `structure` | reveals grouping, hierarchy, topology, or containment that prose does not expose efficiently |
| `relation` | makes interaction, dependency, feedback, authority, or causal direction inspectable |
| `comparison` | lets the reader compare several states, methods, or trade-offs simultaneously |
| `compression` | condenses a complex multi-part system into one reusable mental model |
| `spatialization` | converts abstract boundaries/layers/flows into a spatial model that carries meaning |
| `temporalization` | shows sequence, feedback, transition, or state change that is hard to hold linearly |
| `counterfactual` | contrasts what changes under different assumptions or interventions |
| `evidence` | exposes exact patterns, values, distributions, or exceptions from traceable data |
| `framing` | creates a durable conceptual metaphor for an abstract thesis without restating nearby copy |

Aesthetic polish, line breaks, icons, arrows, or re-typesetting are **not** information gain by themselves.

---

## 2. The redundancy test

Before approving a body visual, answer all four questions.

```text
Q1. What can the reader perceive from the visual that is not already explicit
    in the adjacent prose/code/table?

Q2. If the visual is removed, what meaningful understanding becomes harder?

Q3. If the adjacent prose/code/table is removed, does the visual merely recreate
    the same representation in another medium?

Q4. Is the new visual insight large enough to justify the reading interruption,
    page space, maintenance cost, and visual attention it consumes?
```

Interpretation:

```text
Q1 has no concrete answer
→ SKIP

Q2 = "nothing"
→ SKIP

Q3 = yes
→ choose one representation, or redesign the visual

Q4 = no
→ keep text-first rendering
```

The burden of proof is on the visual, not on the prose.

---

## 3. Duplicate representation is a failure even when accurate

The following pattern is normally a failure:

```text
prose explains sequence
        ↓
code/text block shows exact sequence
        ↓
diagram draws the same sequence
        ↓
prose explains the same sequence again
```

Examples of weak duplication:

```text
Reality → Metric → Target → Optimization → Reality changes
```

followed immediately by a diagram whose first-read content is the same five-node loop.

Likewise:

```text
Central IT          → End-user spreadsheet
Central AI platform → End-user agent / workflow
```

followed immediately by a diagram whose dominant first-read message is the same central-to-end-user transition, even if several governance labels are added around it.

The problem is not factual inaccuracy. The problem is that the visual's **primary semantic payload** has already been delivered.

Small elaboration does not automatically justify a second representation.

---

## 4. Replace, extend, reposition, or skip

When a candidate visual overlaps heavily with adjacent content, choose one of four actions.

### A. Replace

Use the visual **instead of** the redundant code block/table/list when the visual is clearly the better representation.

```text
weak:
text sequence
+ identical diagram

better:
brief prose setup
+ diagram as the primary representation
+ prose interpretation after it
```

The article must remain understandable with appropriate alt/caption fallback, but two equivalent first-read representations should not be stacked without reason.

### B. Extend

Redesign the visual so it exposes a dimension not present in the text.

Example:

```text
Text:
Reality → Metric → Target → Optimization → Reality changes

Potential additive visual:
- show where gaming enters;
- distinguish observed reality from measured proxy;
- show lag between optimization and reality change;
- show divergence between metric improvement and underlying business quality;
- compare healthy vs pathological feedback loops.
```

This is not a prettier version of the sentence. It is a deeper model.

### C. Reposition

A visual may be useful but redundant at the proposed location.

Move it to a section where it synthesizes several preceding arguments rather than repeating the nearest block.

A synthesis visual should normally integrate multiple claims or sections, not mirror one sentence.

### D. Skip

If neither replacement, extension, nor repositioning creates material gain, skip the visual.

`skip` is a quality decision, not a failed generation attempt.

---

## 5. First-read payload vs secondary detail

A visual can contain extra labels and still be redundant.

Judge the **first-read payload**:

```text
What does a reader understand in the first 2–5 seconds?
```

If the answer is functionally identical to the adjacent sentence/code block, the visual is redundant unless the secondary structure is itself the reason the image exists and is visually dominant enough to matter.

This prevents the failure mode:

```text
same basic diagram
+ several extra boxes
= claimed as "new insight"
```

Additional labels are not sufficient. The **mental model** must change or deepen.

---

## 6. Visual planning contract

For any non-trivial article-body visual, the illustration brief should record:

```yaml
visual_information_gain:
  adjacent_representation:
    type: prose | code_block | table | list | visual | mixed
    summary: what the nearby article already communicates
  proposed_visual_payload: what the visual would communicate on first read
  new_information:
    - the specific relation / comparison / structure added beyond adjacent content
  gain_type:
    - structure | relation | comparison | compression | spatialization | temporalization | counterfactual | evidence | framing
  redundancy_risk: low | medium | high
  integration_strategy: add | replace | reposition | skip
  replacement_target: optional semantic anchor when replacing an existing representation
```

A plan with:

```yaml
new_information: []
integration_strategy: add
```

is invalid for a body visual.

For hero/identity visuals, `framing` may be sufficient, but the metaphor must still add conceptual value rather than restating the article title.

---

## 7. Placement contract

Visual placement must be reviewed together with surrounding article blocks.

Do not evaluate only:

```text
Does this image fit this paragraph?
```

Also evaluate:

```text
Does this paragraph already do the image's job?
Does a code block immediately above already provide the same model?
Does the next paragraph explain every element the image contains?
Would replacing one representation improve rhythm and density?
```

Recommended local inspection window:

```text
previous semantic block
+ target block / anchor
+ planned visual
+ next semantic block
```

For synthesis visuals, inspect the whole section.

---

## 8. Evidence visual exception

Evidence visuals may appear beside prose that states the same conclusion because the visual provides **inspectable evidence**, not merely another wording of the claim.

Example:

```text
Prose:
"Volatility rose materially after the event."

Chart:
actual traceable time series showing when, how much, and with what exceptions
```

The claim overlaps, but the evidence payload is new.

This exception does not apply to diagrams invented from the same prose.

---

## 9. Accessibility does not justify duplication

Alt text, caption, and fallback prose are required where appropriate, but accessibility fallback is not a reason to keep a redundant visible representation.

The publication layer may preserve semantic equivalence for non-visual readers while still presenting only one dominant representation visually.

```text
visual primary
+ accessible alt/caption/fallback
!=
visual primary
+ duplicate visible code block
```

---

## 10. Regression signatures

Treat the following as review warnings or failures.

### R1 — Diagram-after-identical-sequence

A text/code sequence is immediately followed by the same nodes and arrows.

**Default:** FAIL / replace-or-skip.

### R2 — Architecture-after-identical-pairing

A paired transition or hierarchy already stated in a compact block is immediately redrawn with the same dominant structure.

**Default:** FAIL unless the architecture's additional boundaries/layers are the dominant new payload.

### R3 — Paragraph-to-icons transcription

One paragraph becomes boxes/icons with one label per noun but no new relation.

**Default:** FAIL.

### R4 — Decorative restatement

The image repeats the thesis through topic symbols, labels, or metaphor but adds no useful framing or structure.

**Default:** SKIP.

### R5 — Visual quota behavior

The planner generates `2–3 visuals` because a target count exists, even after the article has no remaining high-gain visual opportunity.

**Default:** FAIL. Counts are ceilings or heuristics, never quotas.

---

## 11. QA gate

A body visual passes the information-gain gate only when the reviewer can complete this sentence precisely:

> **Without this visual, the reader would have a harder time seeing ________, because the surrounding text does not already expose it as efficiently.**

If the blank can only be filled with the same sentence immediately above the image, the visual fails.

Acceptance checklist:

- [ ] adjacent content was inspected, not just the isolated image;
- [ ] one concrete `new_information` item is named;
- [ ] first-read payload is not equivalent to the adjacent code/list/prose;
- [ ] duplicate representations have an explicit reason or one is removed;
- [ ] the visual does not add unsupported claims merely to avoid redundancy;
- [ ] `skip` remains available after rendering review;
- [ ] the final article has no visual quota requirement.

---

## 12. Operational sequence

The preferred sequence for article visuals is now:

```text
READ ARTICLE
→ identify candidate reader need
→ inspect adjacent representation
→ run information-gain / redundancy test
→ SKIP / REPLACE / EXTEND / REPOSITION
→ route renderer and visual family
→ render
→ inspect actual visual
→ re-run information-gain test against final page context
→ publish only if both semantic gain and visual QA pass
```

Renderer quality cannot rescue a failed information-gain decision.

---

## One-line rule

> **Do not visualize a sentence merely because it is visualizable: an article visual must add a mental model the nearby article does not already provide, otherwise replace the existing representation or skip the image.**
