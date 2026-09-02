# Infographic and Poster — spatial compilation of a verified argument

This document governs **single-canvas visual narratives** compiled from a
[`Visual Story Plan`](VISUAL-STORY-COMPILATION.md): infographics, editorial
posters, framework maps, and large-format visual summaries.

An infographic is not an article squeezed into a canvas. A poster is not a
large slide. Both are **spatial arrangements of argument beats** with different
reading behavior from prose or a sequential deck.

Research basis:
[`../benchmarks/VISUAL-STORYTELLING-SLIDES-INFOGRAPHICS.md`](../benchmarks/VISUAL-STORYTELLING-SLIDES-INFOGRAPHICS.md).

## 1. Start with the dominant takeaway

Before choosing layout, illustrations, or chart types, state:

```text
What is the one thing a viewer should understand after the first scan?
```

That dominant takeaway may be:

- the thesis;
- a key result;
- a causal mechanism;
- a comparison;
- a framework;
- a decision boundary.

The rest of the canvas supports, qualifies, or explains it.

If the intended takeaway is merely a topic noun — `AI agents`, `Treasury`,
`ERGM vs SAOM` — the artifact has not been framed yet.

## 2. Four useful spatial profiles

### `single_claim_poster`

Purpose: identity + one forceful takeaway.

```text
one dominant assertion
+ one dominant visual/metaphor/evidence object
+ minimal support
+ optional source / CTA / metadata
```

Best for discovery, social distribution, project/research identity, or a
standalone statement.

### `narrative_infographic`

Purpose: guide a viewer through several dependent beats.

```text
entry point
→ ordered modules
→ consequence / close
```

Usually vertical or otherwise directionally explicit. The reading path should
not depend on guessing which box comes next.

### `analytical_infographic`

Purpose: make several related evidence modules comparable around one thesis.

```text
central takeaway
+ 2–5 analytical modules
+ explicit relationships
+ source/provenance layer
```

The modules can be scanned independently, but they still serve one argument.

### `framework_map`

Purpose: show a conceptual system, architecture, taxonomy, or relationship map.

```text
central model
+ semantic groups
+ labeled relationships
+ optional explanatory side notes
```

If individual marks encode real observed values or measured relationships, it
is no longer merely a framework map; route those parts through evidence-media
contracts.

## 3. Spatial hierarchy replaces sequence controls

Slides control order with time/page navigation. A poster/infographic controls
order with visual hierarchy.

Use:

- scale;
- position;
- grouping;
- alignment;
- whitespace;
- connectors;
- contrast;
- annotations;
- repeated visual grammar.

These are not decoration. They tell the viewer:

```text
what to see first
what belongs together
what is evidence for what
what is secondary
where to continue
```

A viewer should not need arrows everywhere merely because grouping failed.

## 4. Use a three-scale reading test

This is a local editorial QA heuristic, not a universal design law.

### Glance

At first glance:

- is the dominant takeaway visible?
- is there one obvious focal region?
- does the artifact look like one composition rather than a collage?

### Scan

During a short scan:

- can the viewer identify the major modules?
- is the reading path understandable?
- do module titles state takeaways rather than categories?

### Detail

On closer reading:

- are values, qualifiers, citations, and explanations legible?
- can the viewer distinguish fact, interpretation, and uncertainty?
- can the evidence be traced?

A poster that works only at the detail level is a document page. A poster that
works only at the glance level is advertising. Editorial infographics need all
three layers in proportions appropriate to their surface.

## 5. Treat modules as beat containers

Every material module maps to one or more `beat_id`s.

Preferred module grammar:

```text
message / takeaway
        ↓
visual evidence / explanation
        ↓
minimum support / qualification
```

Module headings such as `Background`, `Data`, `Results`, `Implications` are
allowed when functionally useful, but message-bearing titles are preferred when
the module makes a specific claim.

The canvas may spatially juxtapose beats that were sequential in the article,
but it may not imply a relationship the argument does not support.

## 6. Figures first when figures carry the message

For analytical/research artifacts, allocate visual dominance to the strongest
truthful explanatory object:

- evidence chart;
- diagram;
- annotated figure;
- comparison;
- map/timeline;
- central framework;
- generated conceptual illustration when the role is illustrative.

Do not fill leftover space with generic generated icons simply to increase
visual density.

The rule is not a fixed 80/10/10 ratio or any other permanent percentage. The
portable principle is **message-supporting visual hierarchy with sparing prose**.

## 7. Evidence and illustration may coexist, but their authority differs

Example:

```text
[generated conceptual hero / background]
        +
[deterministic chart]
        +
[deterministic headline and annotation]
```

This is valid when the roles are clear.

The generated portion may establish identity, atmosphere, or conceptual
metaphor. It may not invent:

- values;
- rankings;
- axes;
- dates;
- measured geography;
- statistical uncertainty;
- source labels;
- causal arrows presented as observed fact.

Exact evidence remains traceable to its source/spec.

## 8. Text rendering is selected per visual family

Use `IMAGE-TEXT-RENDERING-PROFILES.md` rather than one global image-text rule.

Examples:

```yaml
editorial_infographic:
  text_rendering_profile: external_overlay

illustrated_poster:
  text_rendering_profile: hybrid_template

typographic_art_poster:
  text_rendering_profile: integrated_generated_text
```

Important factual labels, numbers, citations, and sources remain independently
verifiable even when the visual family intentionally integrates generated text.

## 9. Annotations tell the viewer what to notice

A chart or evidence panel should not rely on the viewer discovering the
editorial point unaided when a small truthful cue can reduce ambiguity.

Useful annotation roles:

```text
highlight the relevant series / period
name an inflection point
mark the comparison being made
state a qualification
connect the evidence to the takeaway
```

Annotations must not exaggerate evidence by hiding scale, context, or
countervailing values.

## 10. Poster and infographic can become reusable asset systems

A strong spatial artifact should be decomposable without semantic loss:

```text
poster module A → carousel frame 2
poster module B → slide 4
central illustration → article card / thumbnail
chart module → video beat 03
```

Reuse is allowed only when the crop still preserves the module's meaning and
provenance.

Do not mechanically crop arbitrary regions. Reuse follows `beat_id` and module
boundaries.

## 11. Accessibility and alternate consumption

Plan for:

- logical reading order independent of absolute placement;
- alternative description that communicates the structure and main takeaway;
- color-independent meaning;
- adequate contrast;
- readable source/citation text;
- accessible canonical article as the full-detail destination.

The infographic may be a discovery/summary surface; it must not become the only
place where material evidence or qualifications exist.

## 12. Infographic / poster QA

### Dominant message

- Is one takeaway visually dominant?
- Does every major module support or qualify it?

### Flow

- Is the first entry point obvious?
- Can the viewer tell which modules are related?
- Does the reading order work without excessive arrows/instructions?

### Evidence integrity

- Are exact marks deterministic/traceable?
- Do annotations match verified claims?
- Is uncertainty visible where material?

### Density

- Is the canvas trying to preserve article completeness?
- Are long paragraphs replacing visual explanation?
- Is whitespace functioning as hierarchy rather than leftover space?

### Reuse

- Can modules map back to stable beats?
- Can a module be reused in slides/video without changing its claim?

## 13. Failure signatures

| Failure | Why it fails |
|---|---|
| Wall-of-text poster | Spatial surface behaves like a paper page |
| Equal-weight tile grid | No editorial hierarchy |
| Topic headings everywhere | Viewer sees categories, not conclusions |
| Generated faux-data | Illustration impersonates evidence |
| Decorative icon carpet | Visual density rises while meaning does not |
| Arbitrary arrows | Layout fails to express grouping/sequence |
| Tiny citations removed for cleanliness | Provenance lost during compression |
| Every module different style | One artifact becomes a collage |
| Poster-first truth | A claim exists only in the graphic, not the article |
| Screenshot reuse | Cropped visual loses beat/provenance context |

## 14. Stop rule

The spatial plan is ready when:

```text
one dominant takeaway is explicit
+ every major module maps to beat ids
+ reading hierarchy is unambiguous
+ evidence/illustration authority is separated
+ text-rendering profile is explicit
+ provenance/accessibility are planned
+ glance / scan / detail QA has no known semantic failure
```

## One-line rule

> **Compile infographics and posters as spatial argument systems: one dominant takeaway, beat-level modules, strong truthful visuals, explicit reading hierarchy, and a hard boundary between illustrative generation and evidence-bearing marks.**
