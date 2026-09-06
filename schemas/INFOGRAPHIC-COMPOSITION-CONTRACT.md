# Infographic composition contract (AES-V2.16b / SUE-628)

A **composition plan** is one plate's information design, expressed so that no renderer is
named anywhere in it. It sits between the article and whatever eventually draws the picture.

Machine schema: [`composition-plan.schema.json`](composition-plan.schema.json).
Validator: `scripts/validate-composition-plan.mjs`. Regressions:
`scripts/test-composition-plan.mjs`.

Evidence this contract is derived from:
[`benchmarks/EDITORIAL-INFOGRAPHIC-INFORMATION-DESIGN.md`](../benchmarks/EDITORIAL-INFOGRAPHIC-INFORMATION-DESIGN.md)
(traits `T1`–`T14`) and
[`evals/negative-baselines/SUE-570-INFOGRAPHIC-FORENSICS.md`](../evals/negative-baselines/SUE-570-INFOGRAPHIC-FORENSICS.md)
(failure signatures `F1`–`F7`).

## Why this layer exists

Before SUE-628 the path from article to image was:

```text
article → semantic_spec { question, must_communicate[], must_not_include[] } → renderer
```

`semantic_spec` is three arrays of strings. It has no relation model, no reading order, no
geometry, no enclosure budget and no mobile strategy. Every SUE-570 failure signature except
one escaped through that gap, because there was nothing in the contract for them to violate.

The new path inserts one layer and nothing else:

```text
article
  → infographic question
  → semantic plan      what relationships must survive
  → composition plan   what geometry carries them
  → renderer route     who is allowed to draw what
  → asset
```

The plan is the versioned artifact. The rendered plate is a build product. This is the same
principle `skills/plan-artifacts/SKILL.md` already applies to artifact plans, extended one
level down: swapping the renderer changes a tool name and nothing in the editorial semantics.

## The three separations

### 1. Semantic plan — what must survive

`primary_question` (exactly one), `modules` (2–4), `relations`, `reading_order`,
`must_preserve`, `evidence_boundary`, `information_gain`.

The load-bearing new field is `relations[].type`, drawn from a fixed vocabulary:

```text
magnitude · ranking · comparison-delta · matrix
temporal-proportional · temporal-ordinal
causal-chain · causal-loop
containment · authority · correspondence
```

**Name the relationship before choosing the geometry** (`T2`). This is the layer the chart
lane inherited from mature practice and the infographic lane never had, which is why every
rejected plate re-invented its own layout. The first six entries have well-established
geometries; the last five are the qualitative-structural relations an explanatory editorial
graphic needs and for which no published vocabulary exists — supplying them is most of what
this contract does.

`information_gain.gain_kind` is the operational form of the existing anti-redundancy gate.
Three independent research passes converged on the same answer to *what can a plate do that a
list cannot* (`T14`): **simultaneity**, **topological closure**, **demonstrated mechanism**.
`VISUAL-INFORMATION-GAIN.md` asks whether new structure becomes available; this field makes
that question answerable rather than a matter of taste.

### 2. Composition plan — what geometry carries it

`geometry`, `reading_order_mechanism`, `enclosure_budget`, `typography_roles`,
`connector_channels`, `label_strategy`, `annotation_strategy`, `mobile_strategy`,
`plate_split`.

### 3. Renderer route — who may draw what

```text
deterministic       a program emits the whole plate
hybrid              a program owns all factual layout and text;
                    a non-deterministic step contributes bounded non-load-bearing material
generative_support  a generative renderer contributes atmosphere only
```

Plain `generative` is **not representable** for these three families. Not discouraged —
absent from the enum. A generative raster model may never own exact numbers, exact labels,
citations, factual relation geometry, load-bearing connectors or typography. When
`renderer_route` is `hybrid` or `generative_support`, `generative_support.load_bearing` is
`const: false`: a load-bearing generative contribution is a routing error, not a style choice.

## What position means — the rule that does the most work

`F1` was the discriminating failure. In the conditionally-accepted chart lane, coordinates are
arithmetic on values, so measuring the picture recovers the data. In the rejected infographic
the modules sat at hand-assigned coordinates in a 2×2 arrangement whose axes encoded nothing —
borrowing the appearance of a matrix without the encoding, which is worse than no grid because
it implies a comparison that does not exist.

So `geometry` requires a declared `position_convention` and forces both axes to be named:

```text
scale                 an axis carries a measured value
controlled_comparison position carries which variable was varied
containment           position carries nesting
topological           position carries nothing — and the plate says so
```

A causal-loop diagram whose position means nothing is **honest**, and `topological` exists so
that honesty is expressible (`C1`). The failure is not absent position; it is *undeclared*
position — a layout that reads as meaningful because it inherited a grid.

The acceptance test is literal, and a reviewer can run it without opening a rendering:

> **Name the axes.** If neither dimension of the plate can be given a semantic name, the plate
> is a list wearing a diagram's clothes.

## Enclosure is derived, not preferred

`SUENGJ-INFOGRAPHIC-CALIBRATION.md` §4 asks for `many bordered cards → shared alignment +
whitespace`. That is right but unfalsifiable: nothing decides how many boxes is too many.

Trait `T10` supplies the derivation. Typography carries structure through four independent
channels — **size, weight, case, and asymmetric whitespace** (more space above a heading than
below it is a load-bearing signal, not decoration) — for roughly three to four distinguishable
tiers. Past that, the practitioner prescription is to restructure the content, not to invent a
fifth tier and not to reach for boxes.

Enclosure therefore becomes genuinely *necessary* in exactly one case: **independent parallel
categories with no rank relation between them**, where size and weight have no "which is
bigger" answer to encode. That yields a checkable budget:

```text
enclosures_planned <= parallel_category_boundaries
```

The rejected plate scored 12 against 4.

The same derivation produces the module cap. At a ~14px mobile type floor, if each module needs
its own legible tier, more than three or four simultaneous modules either collapses the tiers
into ambiguity or demands a size differential too small to perceive. `modules` is capped at 4
**in the schema**, so a five-module plate is not merely discouraged — it cannot be expressed.
That is signature `F4` enforced structurally rather than by review.

## Mobile is a strategy, not a scale factor

Every asset in the SUE-570 set — including the two conditionally-accepted charts — is a
fixed-`viewBox` SVG whose only response to a narrow viewport is uniform scaling, producing
5.2–8.7px effective type at a ~358px figure width. This is `F5`, and it is systemic rather
than infographic-specific.

Professional practice documents four responses. The enum carries exactly those:

```text
reflow    renegotiate height, hold type size
restack   re-stack, drop or shorten now-redundant labels, annotate directly
replate   swap in a different plate built for the surface
split     sequential plates
```

Uniform downscaling is not among them and is **not representable**. `min_type_px` is the
*effective rendered* size at `viewport_px`, not the authored size, and the floor is 14.

The matrix relation is the documented exception (`C3`): a true matrix does not serialise into
a list without destroying the joint-condition read. A matrix plate that reflows or restacks
must fill `downgrade_disclosed` — if it silently degrades into a list on mobile it has stopped
being a matrix without telling anyone.

## Reading order comes from geometry

```text
shared_axis_alignment   proximity and alignment say "read this next"
controlled_repetition   identical frames in a fixed order say "compare me to my neighbour"
vertical_precedence     "above" means "causally prior"
explicit_connectors     the fallback, for relationships that are genuinely non-spatial
```

Arrows are the fallback, not the default (`T3`). Module lettering is not an option at all: the
rejected plate labelled its modules `A/B/C/D`, which is what a plate does when its geometry
cannot say what the order is. `reading_order` must be an exact permutation of the module ids —
a partial order means the path forks, which is a split trigger rather than a layout detail.

## Three channels for containment, flow and authority

Where a plate carries governance structure, `connector_channels` is required and its values
must be distinct (`T5`):

```text
containment  literal spatial nesting; this channel is never reused
flow         a solid, verb-labelled connector; the label states what moves
authority    a dedicated asymmetric channel, never shared with flow
```

Authority is the one that habitually collapses into flow. The documented negative case renders
delegation, accountability and coordination with visually similar arrows, so text captions are
forced to disambiguate what the geometry should have carried.

## The interpretation boundary lives in the caption

`evidence_boundary` has two halves: `in_plate` (what the plate demonstrates) and `in_caption`
(what the author asserts). The boundary between observation and claim is made visible **by
medium**, not by a device inside the artwork (`T11`).

The rejected plate spent plate area on in-frame disclosures like `(c2, 검증 안 됨)`. A module
label carrying an interpretation disclaimer is rejected, as is a label carrying a year, an ISO
date, or a `source:` / `출처` credit — that is `F6`, mutable publication copy baked into
artwork where the caption layer should own it.

## Relationship to the visual job

`visual-job.schema.json` gains one optional property, `composition_plan_ref`. It is required —
by cross-field rule, not by schema — whenever `artifact_profile` is one of the three
information-design families and the information-gain verdict is not `skip`. A `skip` verdict
still short-circuits before any planning, exactly as before.

Nothing else in the visual job changes. The two existing pre-render gates, the context
isolation allowlist, the brand priority order and the renderer lineage fields are untouched.

## What this contract deliberately does not do

- It does not touch `visual/thumbnail` or `visual/concept-illustration`. Concept and editorial
  illustration are out of SUE-605 scope and tracked by SUE-630.
- It does not change the brand profile, the palette, or any styling instruction.
- It does not change how charts are rendered, beyond the mobile strategy that turned out to be
  a shared defect.
- It does not activate anything as a production default. SUE-629's owner gate decides that, and
  a schema-valid plate that still looks bad is a FAIL.

## One-line rule

> **Name the relationship before the geometry, declare what position encodes, derive the
> enclosure budget instead of preferring one, and let the caption carry the claim the plate is
> not allowed to stamp on itself.**
