# Slides and Carousels — message, evidence, sequence, and surface density

This document governs **sequential visual surfaces** compiled from a
[`Visual Story Plan`](VISUAL-STORY-COMPILATION.md): presentation slides, social
carousels, scrollytelling steps, and frames intended to be assembled into a
narrated video.

It governs information structure, not a slide vendor, theme, animation engine,
or typography implementation.

Research basis:
[`../benchmarks/VISUAL-STORYTELLING-SLIDES-INFOGRAPHICS.md`](../benchmarks/VISUAL-STORYTELLING-SLIDES-INFOGRAPHICS.md).

## 1. A frame exists to advance one primary information function

The default frame should make one main cognitive move.

Common functions:

```text
orient
assert
show evidence
explain mechanism
compare
qualify
turn / reverse
show consequence
state a decision boundary
close
```

A slide may contain several visual elements when they jointly support one
function. The rule is not `one object per slide`; it is **one dominant reason
for the slide to exist**.

If the slide headline says one thing, the chart says another, and narration
introduces a third point, the frame is not dense — it is incoherent.

## 2. Assertion–Evidence is the preferred analytical profile

For analytical/research frames, prefer:

```text
sentence-like assertion / takeaway
        ↓
visual evidence or explanatory visual
        ↓
only the text needed to interpret it
```

This differs from:

```text
topic label
        ↓
5–8 bullets copied from the article
```

A useful headline states what the audience should understand, not merely the
category of information underneath it.

Good functional shape:

```text
"Wave count narrows the feasible model set; it does not choose the model."
[comparison / evidence]
```

Weak shape:

```text
"Model Selection"
• wave count
• ERGM
• SAOM
• dependence
```

### Not universal

Do not force assertion–evidence onto frames whose role is different:

- title / opening frame;
- quotation;
- transition with no independent claim;
- process build where the message emerges through steps;
- full-bleed concept image;
- explicit definition;
- closing identity / call-to-action frame.

Those frames still declare one primary function.

## 3. Slides follow argument beats, not section headings

Compile from `beat_id`, not from `##` headings.

Typical sequence may resemble:

```text
orientation
→ thesis
→ mechanism
→ evidence
→ complication
→ consequence
→ closing inference
```

This is a reasoning pattern, not a mandatory slide template.

A single article section may become several slides when it contains several
beats. Several article sections may collapse into one slide when they serve the
same visual function.

## 4. Four density profiles

The same beat may need different visible text depending on how the surface is
consumed.

### `live_narrated`

Presenter or voiceover supplies explanation.

```text
visible text: low
visual evidence: high
narration dependency: allowed
self-contained when muted: not required
```

Use for live decks and narrated video frames.

### `video_frame`

Narration is canonical and timing is explicit.

```text
visible text: very low to low
focal hierarchy: very strong
motion/reveal: only when it helps explanation
timing: synchronized to spoken beat
```

The screen should not normally reproduce the full narration.

### `silent_carousel`

No voice can be assumed.

```text
visible text: medium
self-contained: required
frame-to-frame continuity: explicit
mobile legibility: critical
```

A carousel may need a short supporting sentence that would be spoken in a
video.

### `reference_deck`

Audience may return to the file without a speaker.

```text
visible text: medium to higher
provenance detail: stronger
speaker dependency: low
```

Do not use this profile for projected live delivery merely because it feels
safer to include every detail.

## 5. Visual evidence should dominate analytical frames

When a beat is evidence-bearing, prefer the strongest truthful representation:

```text
chart
diagram
comparison
annotated figure
process schematic
map / timeline when exact and traceable
```

Text is used to:

- state the takeaway;
- label what must be recognized;
- identify a condition/qualification;
- provide source/provenance as needed.

Do not make a decorative generated image compete with load-bearing evidence.

If the visual is illustrative rather than evidentiary, route through
`IMAGE-GENERATION.md` and the selected visual-language module.

## 6. Progressive reveal is a pacing tool

Reveal/build/animation is justified when it helps the audience understand a
change or relation:

- add one causal step;
- isolate one series in a chart;
- move from whole → part;
- compare before/after;
- expose a contradiction;
- synchronize a visual change with the narration that explains it.

Do not animate:

- because the tool makes it easy;
- every bullet or decorative icon;
- logos/backgrounds;
- elements whose motion carries no explanatory value.

A static frame is the default when motion adds no information.

## 7. Text and narration are complementary

For narrated profiles:

```text
visible assertion
+ visual evidence
+ spoken mechanism/qualification
```

is usually stronger than:

```text
full visible paragraph
+ identical paragraph spoken aloud
```

This is a surface-density rule, not an accessibility exception. Captions may
reproduce spoken words, and silent surfaces may carry more text.

For generated artwork inside a slide, select a text-rendering profile from
`IMAGE-TEXT-RENDERING-PROFILES.md`. Slide titles/citations that must be exact
should normally remain deterministic typography even when an illustration is
generated.

## 8. Citations and provenance survive compression

A slide or carousel that asserts a factual claim carries its provenance under
`MEDIA-STRATEGY.md`.

At minimum, the source can be represented through:

- compact footer/source line;
- slide metadata / notes;
- attached artifact manifest;
- linked sources panel on a digital surface.

Visual tidiness is not a reason to detach a claim from its source.

A slide may cite the evidence object rather than reproduce a long article
citation when lineage resolves back to the verified source.

## 9. Accessibility contract

Every production slide/frame should have enough semantic structure to support:

- a unique descriptive title, visible or metadata-only as appropriate;
- logical reading order;
- alternative description for meaningful visuals;
- sufficient contrast;
- meaning that does not depend on color alone;
- source/citation text that remains accessible;
- captions when the surface includes narration/video.

Do not encode semantic information only in generated pixels.

## 10. Layout is a renderer concern; hierarchy is editorial

Editorial may specify:

```text
primary assertion
primary evidence
secondary qualification
source / metadata
visual relation
```

It should not specify:

```text
CSS class
exact component name
vendor theme
hex palette
absolute coordinates
```

The renderer owns layout tokens and responsive behavior.

An exception is a surface constraint that changes meaning — e.g. `reserve
text-safe region` for a generated illustration or `comparison must remain
side-by-side at presentation size`. That belongs in the artifact specification.

## 11. Slide QA

### Message

- Can the frame's main point be stated in one sentence?
- Does the title/assertion match the evidence?
- Does the frame advance the beat sequence?

### Evidence

- Are exact values rendered from traceable evidence?
- Are annotations faithful to the underlying claim?
- Has a qualification been visually hidden?

### Cognitive load

- Is unrelated material removed?
- Is the audience forced to read dense prose while also listening?
- Could one frame be split into two beats without breaking the relation?

### Surface

- Does it work at the target projected/mobile/video size?
- Does the carousel remain understandable without narration?
- Does the narrated frame leave enough time to inspect the visual?

### Consistency

- Does every frame map to one or more `beat_id`s?
- Do repeated evidence assets keep the same semantic meaning?
- Does the selected visual-language module remain coherent across the set?

## 12. Failure signatures

| Failure | Why it fails |
|---|---|
| Section-heading deck | Article structure copied instead of argument compiled |
| Bullet transcription | Surface adds words but not understanding |
| Headline/evidence mismatch | Two different claims compete in one frame |
| Tiny-dashboard slide | Several independent visual questions presented at once |
| Decorative animation | Motion consumes attention without explanation |
| Faux chart illustration | Generated marks impersonate evidence |
| Voiceover transcript on screen | Redundant processing in narrated profile |
| Uncited compressed claim | Distribution lost provenance |
| Same density everywhere | Live, silent, reference, and video surfaces treated as identical |
| Brand drift per slide | Visual novelty outranks series coherence |

## 13. Stop rule

A slide sequence is ready for rendering when:

```text
every frame has a primary function
+ every factual assertion maps to verified claims
+ evidence and assertion agree
+ frame order follows beat dependencies
+ density profile is explicit
+ narration dependency is explicit
+ accessibility/provenance needs are planned
```

Do not keep redesigning after these conditions are met unless actual render QA
shows a concrete readability or visual-system defect.

## One-line rule

> **Build slides and carousels as a sequence of message-bearing argument beats: prefer assertion plus truthful visual support, vary text density by consumption mode, and use progressive reveal only when it clarifies reasoning rather than decorating it.**
