> **Status: research evidence, superseded as authority.** Written 2026-09-06 during the SUE-627/SUE-628 phase; salvaged onto main 2026-09-07 unedited.
>
> On 2026-09-07 the owner rejected the SVG/dashboard prototype this analysis informed ([Linear SUE-629](https://linear.app/suengj/issue/SUE-629/aes-v216c-build-real-article-infographic-prototypes-and-run-owner)).
> SUE-629 returned to In Progress and waits on the SUE-642..SUE-648 re-baseline.
>
> The composition-plan schema and contract, `scripts/validate-plate.mjs`, `scripts/lib/plate-verify-core.mjs`, the plate verifier, and the visual artifact profile changes described or reasoned from here were deliberately NOT carried onto main.
> Any path cited for them does not exist in this repository; it describes the rejected branch, not current state.
>
> Observations, trait extraction, and failure analysis remain reusable research. Any conclusion about production defaults, renderer choice, or lane usability must be re-derived under SUE-642..SUE-648.
> This document's judgement that the chart lane is usable and the infographic lane is not, and its treatment of SUE-570 SVGs as strongest evidence, are not current authority.
> SUE-570 outputs remain NEGATIVE evidence per Linear SUE-605 and must never be positive calibration references.
> Where this document and SUE-642..SUE-648 disagree, the Linear issues win.

# Benchmark — editorial infographic information design

> Researched 2026-09-06 for SUE-627 (parent SUE-605).
>
> This benchmark exists to answer one question: **why does a reader understand something
> faster from a well-made editorial graphic than from the equivalent prose?** It is not a
> collection of infographics that look good, and it does not propose a house style.
>
> Nothing here changes a profile, a Core default, or a renderer. SUE-627 produces evidence;
> SUE-628 decides what, if anything, the contract should say.

## 0. Access limitation — read this before trusting anything below

This session's network egress policy blocks direct page fetches. Every `WebFetch` to a
publisher, academy or research domain returned `EGRESS_BLOCKED`, and `curl` to the same
hosts returned `CONNECT tunnel failed, response 403` from the proxy. Verified directly:
`c4model.com`, `academy.datawrapper.de`, `en.wikipedia.org`, `mitcommlab.mit.edu`,
`practicaltypography.com`, `observablehq.com`, `flourish.studio`, `pudding.cool`,
`storytellingwithdata.com`, `developer.mozilla.org`, `theiia.org`,
`onlinelibrary.wiley.com`, `arxiv.org` — all refused.
`github.com` / `raw.githubusercontent.com` and `microsoft.com/en-us/research` are
reachable.

> **Correction, 2026-09-06.** An earlier version of this section said "only GitHub is
> reachable" and "exactly one external visual reference could be opened". Both
> overstated the constraint: the allowlist is selective rather than GitHub-only, and
> `microsoft.com/en-us/research` — which hosts `ref:timeline-design-space` — returns
> 200. Two external sources were therefore opened, not one. The correction makes the
> access picture *less* restrictive than first reported; every grade below is
> unchanged, because no grade was assigned on the strength of the blanket claim.

That has a real consequence for evidence quality, so every claim below carries a grade:

| grade | meaning |
|---|---|
| **A** | the artifact or its source was opened and read in this session |
| **B** | cross-checked across two or more independent secondary sources; the artifact itself was not opened |
| **C** | single thin snippet — **excluded**, not recorded |

Grade B is genuinely weaker. It is adequate for *mechanics that are documented in prose by
their own authors* (a notation's rules, a tool's responsive behaviour, an experimental
result) and inadequate for *judging a specific rendered graphic*. Two candidate references
were dropped for exactly this reason rather than padded in: a newsroom bridge-collapse
explainer and a canal-grounding explainer, both plausibly on-target, both unopenable —
recording a structural analysis of a graphic nobody in this session saw would have been
fabricated evidence, which is the failure this repository's `basis` /
`provenance_class` fields exist to prevent.

The strongest evidence in this phase is therefore not external at all. It is grade A and
local: the SUE-570 SVG sources
(`evals/negative-baselines/SUE-570-INFOGRAPHIC-FORENSICS.md`), the currently-live article
visuals in `suengj-com`, and the two external sources that were reachable — one
newsroom reference publishing its own source on GitHub, and one academic paper.

---

## 1. Reference set

Six rows below; five carry evaluation records. The sixth — the live article visuals —
is local evidence cited in §5 rather than a catalogued reference, because it is this
publication's own output rather than something selected as craft evidence. Four rows are
external, two are local negative evidence. They were
selected for analysable structural depth, not to fill a count.

| id | family | grade | what it is authoritative for |
|---|---|---|---|
| `ref:ft-visual-vocabulary` | relation→geometry taxonomy | **A** | which geometry a named quantitative relationship warrants |
| `ref:c4-model-containment` | hierarchy / system structure | B | separating containment, flow and authority into distinct channels |
| `ref:risk-matrix-comprehension` | matrix | B | when a matrix is warranted, and how ordinal cells mislead |
| `ref:timeline-design-space` | temporal | **A** | proportional vs ordinal time scales and what breaks |
| `ref:sue570-body-infographic` (local) | negative | **A** | seven named failure signatures, source-level |
| live `suengj-com` article visuals (local) | negative | **A** | the repository's own R1/R2 redundancy regressions, in production |

Supporting grade-B literature consulted but not promoted to reference cards: Datawrapper's
published responsive-embed mechanics; Butterick on hierarchical headings; MIT CommLab
figure-design pedagogy; causal-loop-diagram notation; Tufte's reading of Minard;
the IIA Three Lines Model and its published critique (used as a *negative* case);
Cox (2008) and Sutherland et al. (2022) on risk-matrix comprehension.

### 1.1 The reference whose shape is the finding

`ref:ft-visual-vocabulary` — the Financial Times Visual Journalism team's chart-selection
vocabulary, published with its source at
`github.com/Financial-Times/chart-doctor/visual-vocabulary`. Read in full this session.

One of the two external sources that could be opened this session. Its structure is the
finding. It is organised as **nine relationship families**, and the
geometries sit *underneath* them:

```text
Deviation · Correlation · Ranking · Distribution · Change over Time
Part-to-whole · Magnitude · Spatial · Flow
```

A designer using it does not browse shapes. They name the relationship in the data, and
the vocabulary hands back the geometries that can carry it. That inversion —
**relationship first, geometry second** — is the single most transferable thing in the
external set, and it is exactly the inversion the SUE-570 infographic did not perform: it
chose a 2×2 card layout and then poured relations into it.

---

## 2. Structural taxonomy

Editorial graphics in scope for this lane divide by **what the relationship is**, because
that is what decides the geometry. Consolidating the three research passes:

| relation | the reader's actual task | geometry that carries it | position encodes |
|---|---|---|---|
| `magnitude` / `ranking` | compare many items against one yardstick | aligned parallel columns; dot plot; ordered bar | one real scale + sort order |
| `comparison-delta` | how big is the gap between two states | slope; paired dots on a shared scale | value on a shared scale |
| `matrix` | classify one item by two independent variables at once | true grid, both axes meaningful | joint condition |
| `temporal-proportional` | how long, how close together | real time axis | measured duration |
| `temporal-ordinal` | what order, duration irrelevant | stage sequence, evenly spaced | rank only |
| `causal-chain` | what produces what, in which direction | directed path; signed connectors | topology only |
| `causal-loop` | does this close on itself | closed topological loop | topology only |
| `containment` | what is inside what | spatial nesting | enclosure boundary |
| `authority` | who may act on whom | dedicated asymmetric channel | not position |
| `correspondence` | is A to B as C is to D | matched parallel structures | alignment across rows |

Two observations about this table matter more than the table itself.

**The professional vocabulary that exists is quantitative.** All nine FT families concern
measured quantities. There is no comparable published, battle-tested vocabulary for the
qualitative-structural relations an explanatory editorial infographic actually needs —
`causal-chain`, `authority`, `containment`, `correspondence`. The last four rows above are
synthesised from scattered sources (C4 notation, causal-loop notation, the IIA critique),
not inherited from an established practice.

**Hypothesis, not finding:** this absence may be a substantial part of why the chart lane is
conditionally acceptable and the infographic lane failed. The chart lane inherited a mature
relation→geometry vocabulary; the infographic lane had none, so each plate re-invented its
layout. This is stated as a hypothesis because SUE-627 cannot test it. SUE-629 can:
if supplying the missing vocabulary produces materially better plates, the hypothesis gains
support; if the plates are still weak, the cause lies elsewhere and should be routed
elsewhere.

---

## 3. Repeated high-confidence traits

Traits appearing independently in two or more passes, or in one pass plus the negative
baseline. Each is stated so it survives a change of brand, subject and renderer.

### T1 — One declared position convention per plate
*(R1 Q1 · R2 Q5 · negative `F1`. Grade A+B.)*

Spatial position must encode exactly one thing across a whole plate, and which thing must be
a decision, not a residue. The legitimate options are: a real scale, a controlled comparison
variable, containment, or **explicitly nothing** (topology only). A causal-loop diagram whose
position means nothing is honest; the SUE-570 plate whose 2×2 arrangement *implied* a matrix
while encoding nothing is not. The failure is undeclared position, not absent position.

Operational test: *name the axes.* If neither dimension of a plate can be given a semantic
name, the plate is a list wearing a diagram's clothes.

### T2 — Name the relationship before choosing the geometry
*(Grade A, `ref:ft-visual-vocabulary` · corroborated R2 Q1.)*

R2 puts the consequence sharply: matrix, aligned columns and small multiples are *different
reader tasks*, not different aesthetic choices. Picking the wrong one for the task is what
produces "looks like a chart, reads like nothing."

### T3 — Reading order comes from geometry, not from arrows or letters
*(R1 Q2. Grade B, corroborated by negative `F1`.)*

Three documented mechanisms, none of which is an arrow: shared-axis alignment; repetition
with one controlled variable; vertical stacking as precedence. Arrows are the *fallback* for
relationships that are genuinely non-spatial, not the default tool.

The SUE-570 plate labelled its modules `A/B/C/D`. Lettering is a confession: it is what a
plate does when its geometry cannot say what the order is.

### T4 — The delta must be a rendered shape, not two numbers
*(R2 Q2. Grade B, well corroborated.)*

A slope's angle, a line's length, the gap between aligned dots — the comparison is performed
*for* the reader pre-attentively. A table hands over raw numbers and leaves the subtraction as
mental arithmetic; adding icons to that table changes the decoration, not the cognitive
operation. This is the concrete, checkable form of "don't build a table with icons."

### T5 — Containment, flow and authority need three separate channels
*(R2 Q3. Grade B, with a documented positive and a documented negative.)*

- **containment** — literal spatial nesting; this channel is never reused for anything else;
- **flow** — a solid, verb-labelled connector; the label carries what moves;
- **authority** — a *dedicated asymmetric* channel (distinct arrowhead, weight, or dash) that
  is never shared with flow.

The negative case is instructive: the IIA Three Lines Model renders delegation, accountability
and coordination with visually similar arrows, so text captions have to disambiguate what the
geometry should have carried. Collapsing authority into flow is the specific, named failure.

### T6 — Fuse the qualifier to the relationship, never to a legend
*(R1 Q3. Grade B.)*

A signed arrowhead; a band colour held along an entire path; direct labelling at the point of
relationship. Externalising the qualifier to a key forces a lookup the reader will not perform.

### T7 — Magnitude rides a continuously-scaling geometric attribute
*(R1 Q3. Grade B.)*

Width, length, height on a fixed scale — not `+++`/`−−` buckets and not a thick/thin line
sorted into categories. Continuous encoding lets magnitude be compared across the whole plate
without a printed number at every point.

### T8 — Declare the time scale: proportional or ordinal
*(R3 Q1. Grade A — the paper was fetched and read.)*

Proportional when the gaps carry meaning the reader needs; ordinal when only order matters.
The dangerous direction is ordinal applied to duration-critical data, because **it fails
silently** — evenly-spaced stages *look* like they took comparable time, an inference the
scale does not entitle the reader to make, and nothing about the plate looks broken. A mixed
scale inside one plate with no visible seam is the least recoverable failure of the three.

### T9 — Mobile renegotiates height and holds type size; it never uniform-scales
*(R3 Q2 · negative `F5`. Grade B mechanism, grade A negative.)*

Four legitimate strategies are documented in professional practice — reflow with height
renegotiation, re-stack with dropped/shortened labels, swap in a *different* plate built for
the surface, or split into sequential plates. Uniform downscaling is not among them.

Every asset in the SUE-570 set, including the two conditionally-accepted charts, is a
fixed-`viewBox` SVG whose only response to a narrow viewport is uniform scaling, producing
5.2–10.1px effective type at ~358px. This trait is therefore not an infographic-specific
repair.

### T10 — Four type-only channels, three-to-four tiers, then split
*(R3 Q3/Q4. Grade B.)*

Typography alone carries structure through **size, weight, case, and asymmetric whitespace**
(more space above a heading than below it is a load-bearing signal, not decoration). The
practitioner-stated ceiling is roughly three to four distinguishable tiers; past that the
prescription is to *restructure the content*, not to invent a fifth tier and not to reach for
boxes.

This is the most useful trait in the whole set, because it **derives the enclosure budget**
instead of asserting one. Enclosure becomes necessary exactly when the structure is *not*
hierarchical — independent parallel categories with no rank relation, where size and weight
have no "which is bigger" answer to encode. Everything else that is currently drawn as a box
is a tier that typography could have carried.

Combined with a ~14–16px mobile type floor, it also *derives* the plate-split rule: if each
module needs its own legible tier, more than three or four simultaneous modules at the mobile
floor either collapses the tiers into ambiguity or demands a size differential too small to
perceive. "2–4 modules" stops being a house preference and becomes a consequence.

### T11 — Interpretation lives in prose; the plate demonstrates
*(R1 Q4. Grade B, strongly argued.)*

The boundary between what is observed and what the author claims is made visible **by medium**,
not by a device inside the plate. The plate shows the mechanism; the caption or headline
asserts what it means. A graphic cannot certify causation by juxtaposition, and marking an
in-plate module `(c2, 검증 안 됨)` — as the SUE-570 plate did — spends plate area on a
disclosure that the caption layer should own.

### T12 — A matrix is only for intersection lookup
*(R2 Q1/Q4. Grade B — a formal critique and a later comprehension trial, both cited from secondary summaries rather than read.)*

Warranted only when two genuinely independent scales exist and the reader's task is "given A
and B, what joint condition results?" If a sort on one variable answers the question, it is not
a matrix however tempting the grid looks. Two documented hazards: ordinal category labels that
imply arithmetic (a 1×3 cell reading as equal to 3×1), and colour banding that biases readings
across cell boundaries.

### T13 — Position-as-abstract-property must be taught or it defaults to the obvious misreading
*(R2 Q3. Grade B.)*

When distance-from-centre encodes "independence" rather than rank, readers substitute the
obvious reading unless the plate actively teaches otherwise. Prefer conventions the reader
already holds.

### T14 — The gain over prose is simultaneity
*(R1 Q5 · R2 Q5 · R3 Q5 — three independent derivations. Highest confidence in this set.)*

All three passes arrived at the same answer without coordination. Prose and bullets are
inherently sequential: they force one-thing-at-a-time attention even when the underlying
relationship is not sequential. A plate earns its place when it produces something a linear
medium structurally cannot:

- **simultaneity** — several related quantities or states perceived at once, positionally aligned;
- **topological closure** — the eye detecting that a chain closes into a loop, far faster than a
  reader can trace bullets back to notice it;
- **mechanism** — the reader deriving the causal relation by watching it operate, rather than
  being told the conclusion.

This is the operational form of the existing information-gain gate. `VISUAL-INFORMATION-GAIN.md`
asks *what new structure becomes available*; T14 answers *what kind of thing a graphic can
provide that prose cannot*, which makes the gate answerable rather than a matter of taste.

---

## 4. Contradictory and context-dependent traits

Recorded rather than resolved by fiat, because a contract that hides these will produce
plates that are compliant and wrong.

### C1 — "Position is the meaning" vs "position may mean nothing"

R2 concludes that in good comparison and hierarchy graphics, position *is* the meaning. R1
finds that causal-loop diagrams encode nothing in position and are right to do so.

Both hold. The resolution is T1: the plate must **declare** whether position is semantic or
topological. What is forbidden is accidental position — a layout that reads as meaningful
because it inherited a grid.

### C2 — Enclosure: forbidden by house calibration, required by structure

`SUENGJ-INFOGRAPHIC-CALIBRATION.md` §4 asks for `many bordered cards → shared alignment +
whitespace`. T10 finds enclosure genuinely necessary for non-hierarchical parallel categories.

Both hold, at different targets. The budget is not "minimise boxes"; it is **one enclosure per
parallel-category boundary that typography cannot encode, and none for anything else.** That is
checkable, where "reduce visual chrome" is not.

### C3 — Matrices resist responsive reflow

T9 says reflow rather than scale. R2 finds a true matrix does not serialise into a list without
destroying the joint-condition read; the least-destructive options are a scrolling grid with
sticky headers, or collapsing one axis and *disclosing the downgrade*.

So the matrix relation is the documented exception to reflow-by-default. A matrix plate must
either declare a scroll strategy or split — and if it silently degrades into a list on mobile,
it has stopped being a matrix without telling anyone.

### C3b — The mobile rule reverses an owner-facing calibration document

`SUENGJ-INFOGRAPHIC-CALIBRATION.md` §10 prescribes that "the semantic architecture itself
must survive downscaling" and adds "this does not mean enlarging every label
indiscriminately." Trait `T9` says downscaling is not a legitimate strategy at all.

These do not reconcile, and this one matters more than the other contradictions here because
the document being contradicted is a record of owner review, not an inference of ours.

The reading that holds both: the calibration is right that the fix is not *enlarging every
label*, and right that semantic architecture is what must survive. What it assumed is that
surviving happens *under downscaling*, and the measurements say that assumption does not hold
on this publication — no asset in the SUE-570 set reaches a usable floor even at its largest
type. So the calibration's goal is kept and its mechanism is replaced: the architecture
survives by reflowing, re-stacking, re-plating or splitting, none of which enlarge labels
indiscriminately.

This is flagged rather than resolved silently, because replacing a mechanism inside an
owner-reviewed calibration is an owner's call, not a reviewer's.

### C4 — Proportional scales can crowd out small events

T8 prefers proportional time when gaps carry meaning, but a proportional axis lets a
long-duration event swallow the plate and renders sparse periods as "nothing happened."
Scale choice is a per-plate editorial decision with a stated reason, not a default.

---

## 5. Comparison with the SUE-570 failure pattern

Every named failure signature has a corresponding trait. This is the useful output of the
phase: the failures were not mysterious, and they were not stylistic.

| signature | trait it violates | would a different renderer have fixed it? |
|---|---|---|
| `F1` decorative-geometry | T1, T2 | **no** — pre-render planning defect |
| `F2` enclosure-inflation | T10, C2 | **no** |
| `F3` prose-in-a-rectangle | T4, T14 | **no** |
| `F4` multi-question plate | T10 | **no** |
| `F5` scale-only mobile | T9 | partly — needs renderer capability *and* a declared strategy |
| `F6` mutable copy in artwork | T11 | no — publication handoff |
| `F7` unenforced ceiling | — | no — contract/validator |

Five of seven are decisions taken before any rendering occurs. This is the evidence basis for
the SUE-605 boundary that the failure is not a palette, spacing, or prompt-polish problem.

The catalog entry `ref:sue570-body-infographic` records this as negative evidence with
`provenance_class: generated_output` and deliberately no `promotion` block, which is the
mechanism that keeps a rejected output out of the positive selection path.

One further pattern, from the live article visuals rather than the pilot: the repository's own
`VISUAL-INFORMATION-GAIN.md` gives both shapes as worked examples of weak duplication in
§3 and names them as regressions R1/R2 in §10. Two production visuals in
`companies-become-like-the-tools-they-use` match those shapes exactly — a diagram redrawing
the `Reality → Metric → Target → Optimization` chain that sits in the prose immediately above it,
and a diagram redrawing the `Central IT → End-user` pairing from the code block above it. The
contract identified them; nothing prevented them from shipping. That is `F7` again at a
different layer, and it is the reason SUE-629's prototypes must be measured against T14 rather
than against schema validity.

---

## 5b. What the enforcement layer does and does not prove

Recorded because the first version of this work implied more than it had built.

The composition contract is a **declaration format**. Independent review took the rejected
SUE-570 plate, changed only fields its own author writes — the declaration of what position
means, the count of boxes wanted, the claimed label count and rendered type — and the
identical picture passed the validator with zero issues.

So the contract makes the failures **nameable and routable**, and makes one of them
(a five-module plate) genuinely unrepresentable. It does not, by itself, make them
undeclarable.

`scripts/validate-plate.mjs` closes the measurable half: label count, enclosure count,
effective type size and scale-only behaviour are read off the rendered asset and compared to
the plan. Against the rejected plate with a plan written to sit inside every ceiling, it
returns five contradictions.

Two fields stay declarations by nature — whether a coordinate *means* something, and whether
a module carries geometry, are editorial judgements no parser recovers. For those, review is
the check, and saying so is more useful than implying otherwise.

`schema-valid` therefore carries no information about whether a plate is good. That is the
premise SUE-629's owner gate rests on.

## 6. Rejected hypotheses

Recorded so they are not re-proposed.

- **"A better image model, or more generative calls, will fix it."** Not supported. Five of seven
  failure signatures are planning defects that survive a renderer swap.
- **"It is a palette / spacing / prompt-wording problem."** Not supported by any signature.
- **"Denser infographics carry more information gain."** Contradicted by T14: gain is simultaneity,
  not element count. The failed plate carried 22 labels and 12 enclosures and delivered the
  first-read payload of the sentences it was derived from.
- **"Imitate a named publisher."** Out of scope by SUE-627's own boundary, and unnecessary — the one
  reference actually opened is valuable for its *taxonomy*, which is a method, not a look.
- **"Promote the SUE-570 charts as positive references because the owner called them acceptable."**
  Rejected: they fail T9 as badly as the rejected assets. "Conditionally acceptable on data
  accuracy" is not "good".

---

## 7. Minimum recommendation to SUE-628

SUE-627 does not amend a contract. It hands over the smallest set of things the evidence
actually justifies:

1. **A relation vocabulary.** The ten relations in §2 with their permitted geometries. This is the
   missing layer — the chart lane inherited one, the infographic lane never had one.
2. **A declared position convention per plate**, with the *name the axes* test as its
   acceptance check (T1, T2, `F1`).
3. **A derived enclosure budget** — one enclosure per parallel-category boundary typography cannot
   encode — rather than a subjective chrome instruction (T10, C2, `F2`).
4. **A declared mobile strategy per plate**, drawn from `reflow | restack | replate | split`, with
   uniform scaling explicitly invalid (T9, `F5`).
5. **Reading order carried by a named geometric mechanism**, not by arrows or module letters (T3).
6. **Separate channels for containment, flow and authority** wherever a plate carries governance
   structure (T5).
7. **An interpretation boundary that lives in the caption layer**, not inside the artwork (T11, `F6`).
8. **Mechanical enforcement of the ceilings the profile already states** (`F7`).

And one thing SUE-628 should deliberately *not* do: redesign the visual system. Nothing in this
evidence supports touching the thumbnail family, the concept-illustration family, the brand
profile, or the chart lane's rendering, beyond the mobile strategy that turned out to be shared.

## One-line rule

> **Name the relationship before the geometry, declare what position encodes, and let the plate
> earn its place by showing something simultaneously that prose can only say one item at a time.**
