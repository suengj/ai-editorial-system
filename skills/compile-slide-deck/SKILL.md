---
name: compile-slide-deck
version: 0.1.0
description: Compile an approved Visual Story Plan slide mapping into a provider-neutral SlideDeckPlan for slides, carousels, and working report decks without choosing brand-specific design or a renderer.
when_not_to_use: Do not use for single-canvas infographics/posters, for deciding what the article argues, for verifying new claims, for selecting Samsung or other brand-specific reference slides, or for rendering media.
inputs:
  - finalized Visual Story Plan with slide/carousel surface mapping
  - verified claim set referenced by the plan
  - target sequential-surface density profile
  - optional semantic presentation plan
outputs:
  - provider-neutral SlideDeckPlan conforming to schemas/slide-deck-plan.schema.json
requires:
  - exact article_ref inherited from the Visual Story Plan
  - stable beat_ids for every candidate slide
  - verified claim lineage for every fact-bearing beat
  - an approved slide/carousel artifact from plan-artifacts
authority:
  may:
    - decide whether candidate material remains one slide, splits, merges with an adjacent slide, or belongs in an appendix
    - assign slide function and information topology
    - compile slide-level primary messages and content roles from approved beats without changing their meaning
    - run a renderer-neutral semantic fit and density preflight
    - classify evidence authority as metric, fact, interpretation, hypothesis, or concept
    - declare what dimensions a downstream craft reference may and may not control
  may_not:
    - add, verify, strengthen, weaken, or reclassify an article claim
    - change thesis, uncertainty, qualification, source attribution, or beat dependency
    - choose a brand-specific reference id, slide family, template, theme, font, colour, or exact coordinate
    - choose a rendering provider, image model, slide engine, or generation strategy
    - apply slide/report-deck rules to infographic or poster compilation
    - render, publish, approve, or finalize an artifact
governed_by:
  - editorial/constitution.md
  - editorial/VISUAL-STORY-COMPILATION.md
  - editorial/SLIDES-AND-CAROUSELS.md
  - editorial/MEDIA-STRATEGY.md
  - editorial/RIGHTS-AND-PROVENANCE.md
allowed_tools:
  - file_read
evidence:
  acceptance:
    - every slide maps to one or more stable beat_ids
    - every fact-bearing content role resolves to verified claim and source lineage
    - every slide has an explicit necessity decision, function, topology, and semantic-fit result
    - a FAIL semantic-fit result never proceeds as render-ready
    - reference requirements name craft authority and exclusions without selecting a brand-specific source
    - no infographic/poster plan is rewritten through slide-specific rules
    - the output carries the exact article_ref from the Visual Story Plan
---

# compile-slide-deck

## Purpose

Convert the slide/carousel portion of a finalized Visual Story Plan into a
provider-neutral **SlideDeckPlan** before any brand-specific design system or
renderer takes control.

```text
Canonical Article + verified claims
        ↓
Visual Story Plan
        ↓
compile-slide-deck
        ↓
SlideDeckPlan
        ↓
project adapter / style system / renderer
```

This Skill owns the missing sequential-surface decision layer. It does not
render slides and it does not absorb the infographic lane.

## Inputs

A finalized Visual Story Plan with stable beat ids, exact article lineage,
verified claims for every fact-bearing beat, the approved slide/carousel
artifact decision, and the target sequential-surface density profile.

## Outputs

One provider-neutral `SlideDeckPlan` conforming to
`schemas/slide-deck-plan.schema.json`. It contains slide partition decisions,
function, topology, slide-level content roles, semantic fit, evidence authority,
and bounded craft-reference requirements.

## Preconditions

Refuse unless:

1. the Visual Story Plan carries the exact article version/content/claims
   identity;
2. every fact-bearing candidate resolves to verified claim lineage;
3. `plan-artifacts` approved or allowed the requested slide/carousel artifact;
4. the requested surface is sequential rather than a single-canvas
   infographic/poster.

## Boundary with infographics

Slides and infographics share verified claims and argument beats, but they do
not share information geometry.

```text
Visual Story Plan
   ├─ slide/report-deck mapping → compile-slide-deck
   └─ infographic/poster mapping → existing spatial compiler
```

Never force an infographic through split/merge, working-report density, or
slide-layout assumptions merely because both outputs are visual.

## Procedure

### 1. Freeze semantic authority

Carry forward the exact:

- article reference and hashes;
- thesis;
- beat ids and dependencies;
- verified claims;
- uncertainty and qualifications;
- evidence/source references.

Nothing in this Skill may change that set.

### 2. Decide slide necessity

For every candidate slide, choose one:

- `KEEP_ONE`
- `SPLIT`
- `MERGE_PREVIOUS`
- `MERGE_NEXT`
- `APPENDIX_ONLY`

Use the smallest number of slides that preserves one dominant reason for each
frame to exist. Two independent conclusions normally require two slides.

Do not fix overload by silently dropping material facts or by assuming smaller
typography will rescue the frame.

### 3. Assign slide function

Choose the primary cognitive job, for example:

```text
orient
assert
diagnose
show_evidence
compare
framework
explain_mechanism
qualify
before_after
recommend
prioritize
roadmap
decision
turn
show_consequence
close
```

The function answers **what the slide must accomplish**, not how it looks.

### 4. Assign information topology

Choose the relation the audience must perceive, for example:

```text
single focus
sequential flow
parallel paths
evidence → implication
comparison
matrix
hierarchy
cycle
before → after
workstream × time
```

Topology is editorial structure. A downstream renderer may realize the same
topology with different layouts.

### 5. Compile content roles

Assign visible or supporting material to roles such as:

- topic;
- headline / primary message;
- primary evidence;
- secondary evidence;
- annotation;
- implication;
- action;
- source / caveat.

Compression removes redundancy, not material meaning. A headline may become
more concise, but it may not become more certain or causal than the source beat.

### 6. Run semantic fit / density preflight

Before style selection, ask whether the planned information is plausible at the
target consumption density while keeping:

- the primary message readable;
- evidence inspectable;
- qualifications visible;
- source/caveat space available;
- unrelated conclusions out.

A failure routes:

```text
REWRITE
→ SPLIT
→ ALTERNATE_STRUCTURE
```

A `FAIL` plan is not render-ready.

This is a renderer-neutral preflight. After a downstream project selects an
actual layout family, it must perform its own layout-specific fit check. The
editorial preflight must never be presented as proof that a specific template
fits.

### 7. Preserve evidence authority

Classify each load-bearing item as:

- `METRIC`
- `FACT`
- `INTERPRETATION`
- `HYPOTHESIS`
- `CONCEPT`

The classification constrains the visual claim:

- verified metrics may control exact evidence geometry;
- facts may be shown as factual annotations;
- interpretations remain interpretations;
- hypotheses remain visibly qualified;
- concepts may use explanatory diagrams or illustration but never impersonate
  measured evidence.

This Skill does not choose whether the downstream renderer is generative,
deterministic, or hybrid.

### 8. Declare reference requirements, not references

When a craft reference would help, state the dimensions it may govern, such as:

- hierarchy;
- information grouping;
- spatial relation;
- density;
- wording structure.

Also record explicit exclusions such as:

- factual content;
- metrics;
- source wording;
- proprietary expression;
- logos.

Do not select `R03:p04`, a Samsung layout family, a McKinsey page, a template
id, or any equivalent project-specific reference here. That selection belongs
to the downstream adapter that owns the relevant corpus.

### 9. Emit SlideDeckPlan

Write the machine handoff using
`schemas/slide-deck-plan.schema.json`.

The output is render-ready only when all retained slides have semantic-fit
`PASS`.

## Working-report profile

When the target surface is `working_report`, higher information density is
allowed because the deck is a decision-support document that can be read
without a presenter. This does not waive the one-dominant-reason rule.

The surface profile is
`editorial/profiles/surface/report-deck.json`.

Do not export this density default to:

- live narrated presentations;
- video frames;
- mobile carousels;
- infographics/posters.

## Invariants

- Slide boundaries are downstream views of stable beats, not new argument
  authority.
- A slide may become denser; it may not become semantically broader.
- Reference craft authority never becomes factual authority.
- Brand/style knowledge remains replaceable downstream.
- Renderer choice remains replaceable downstream.
- Infographic/poster compilation remains independent.

## Refusal conditions

Return a refusal instead of improvising when:

- the Visual Story Plan is missing or stale;
- a fact-bearing beat lacks verified claim lineage;
- the requested artifact was skipped by plan-artifacts;
- a slide requires a new factual comparison or calculation;
- the user asks this Skill to copy a proprietary reference literally;
- the user asks this Skill to choose a brand-specific template or renderer;
- the requested output is actually a single-canvas infographic/poster.

## Evidence

A successful plan is auditable without rendering:

```text
article_ref exact
+ every slide → beat_ids
+ every fact-bearing role → verified claims
+ necessity/function/topology explicit
+ semantic fit explicit
+ reference authority bounded
+ no brand-specific implementation
+ infographic lane untouched
```

## Authority

This Skill is a **sequential-surface editorial compiler**. It may decide how a
verified argument is partitioned into slides and what information relationship
each slide must communicate. It may not decide what is true, what a brand looks
like, which proprietary reference to use, how a slide is rendered, or whether
it is published.
