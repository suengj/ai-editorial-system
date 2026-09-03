# Visual Story Compilation — article to multi-surface argument beats

This document defines the **semantic intermediate layer** between a verified
canonical article and visual/spoken distribution surfaces such as slides,
carousels, infographics, posters, scrollytelling, and assembled video.

It sits below the Editorial Constitution and `MEDIA-STRATEGY.md`, and above the
surface-specific contracts:

- [`SLIDES-AND-CAROUSELS.md`](SLIDES-AND-CAROUSELS.md)
- [`INFOGRAPHIC-AND-POSTER.md`](INFOGRAPHIC-AND-POSTER.md)
- [`AUDIO-SCRIPT.md`](AUDIO-SCRIPT.md)
- [`VIDEO-STORYBOARD.md`](VIDEO-STORYBOARD.md)
- [`IMAGE-GENERATION.md`](IMAGE-GENERATION.md)

The research basis is recorded in
[`../benchmarks/VISUAL-STORYTELLING-SLIDES-INFOGRAPHICS.md`](../benchmarks/VISUAL-STORYTELLING-SLIDES-INFOGRAPHICS.md).

## 1. Why another layer exists

The wrong pipeline is:

```text
article
→ prompt: "make slides"
→ prompt: "make infographic"
→ prompt: "make video script"
```

Each prompt independently compresses and reorders the article. The result may
look coherent while silently creating three different interpretations of the
same source.

The preferred pipeline is:

```text
Canonical Article
+ verified claim set
+ uncertainty / provenance
        ↓
Artifact Plan
        ↓
Visual Story Plan
        ↓
┌────────────────┬──────────────────┬──────────────────┐
│ spatial        │ sequential       │ spoken           │
│ infographic    │ slides/carousel  │ audio beat map   │
│ poster         │ scrolly          │                  │
└────────────────┴──────────────────┴──────────────────┘
        ↓                               ↓
visual renderers             compile-audio-script
                                      ↓
                              Canonical Spoken Script
                                      ↓
                                  TTS adapter
        └───────────────────────┬─────┘
                                ↓
                         timed storyboard
                                ↓
                         assembled video
```

The **Visual Story Plan** is not a new published artifact. It is a compilation
plan that lets multiple surfaces share argument identity without sharing the
same layout or word count. It does not replace `compile-audio-script`; it gives
that Skill a stable beat/dependency map when audio is one of several surfaces.

## 2. Levels of authority

### Level 0 — Canonical truth

Owned by the article + verified claim set.

Contains:

- thesis;
- verified claims;
- fact / interpretation / hypothesis boundaries;
- uncertainty;
- citations / sources;
- article version identity and hashes.

No distribution compiler may change this level.

### Level 1 — Argument beats

The Visual Story Plan decomposes the article into **argument beats**.

A beat is one cognitively coherent move, such as:

```text
orientation
assertion
mechanism
comparison
evidence
qualification
turn / reversal
consequence
decision boundary
closing inference
```

A beat is not a fixed paragraph, sentence, slide, or number of seconds. It is a
semantic unit that can be rendered differently by each surface.

### Level 2 — Surface compilation

Each surface decides how beats are spatially or sequentially realized.

```text
poster        → several beats arranged in one spatial hierarchy
infographic   → beats arranged as one spatial/vertical reading path
slides        → usually one dominant beat per frame
carousel      → compact self-contained sequential frames
scrolly       → progressive reveal over beats
audio         → selected beat/dependency map handed to compile-audio-script
```

A surface may omit a non-load-bearing beat or split a complex beat, but must
record the mapping.

### Level 3 — Media realization

The surface plan is compiled into actual assets:

- deterministic charts / diagrams / SVG;
- generated or edited imagery;
- deterministic typography;
- Canonical Spoken Script via `skills/compile-audio-script`;
- TTS render;
- captions / accessibility metadata.

Renderer choice belongs here, not in the Visual Story Plan.

### Level 4 — Temporal assembly

Video adds time and synchronization:

```text
visual frames / assets
+ Canonical Spoken Script
+ rendered audio
+ captions
        ↓
timed storyboard
        ↓
video compositor
```

The video is therefore an assembly of already-governed layers, not a new free
text generation pass.

## 3. Canonical beat shape

A non-trivial beat should be representable in this provider-neutral form:

```yaml
beat_id: beat-03
function: evidence
assertion: "The finding this beat must leave behind."
carries_claims:
  - claim-17
source_references:
  - source-04
uncertainty_refs:
  - uncertainty-02
visual_task:
  role: evidence_visual
  question: "What should the viewer notice?"
  preferred_form: chart
text_task:
  role: assertion
  density: compact
narration_task:
  include: true
  role: explanation
transition_role: consequence
depends_on:
  - beat-02
surface_fit:
  slides: primary
  infographic: primary
  poster: supporting
  audio: primary
  video: primary
```

Not every field is required for every beat. The important properties are:

1. stable `beat_id`;
2. explicit function;
3. traceable carried claims;
4. separate visual/text/narration responsibilities;
5. explicit dependency/sequence where it matters.

`narration_task` is intent and selection, not finished spoken prose. The actual
listener-first wording, pronunciation state, delivery spec, and semantic audio
segments belong to `compile-audio-script` / `AUDIO-SCRIPT.md`.

## 4. Story follows the argument, not the article headings

An article is optimized for reading. A visual sequence is optimized for
progressive comprehension. A spoken script is optimized for listening.

Therefore article heading order is **not protected**.

Protected:

```text
claim meaning
logical dependency
uncertainty
causal direction
source attribution
```

Mutable by the compiler:

```text
surface order when logic permits
amount of secondary detail
whether a relation is shown or selected for speech
whether one article section becomes several beats
whether several small sections collapse into one beat
```

The compiler may reorder explanation only when prerequisite information still
arrives before a beat depends on it.

## 5. One cognitive move per beat is a default, not a quota

Research on segmenting, signaling, and coherent multimedia motivates a strong
default: the audience should not be asked to decode several independent moves
at once.

Do not convert this into a mechanical rule such as one sentence, one visual, or
one chart per beat. A causal comparison may require two panels; a qualification
may need to remain attached to the assertion it limits.

The test is functional:

> Can the audience say what changed in their understanding after this beat?

If the answer contains several unrelated moves, split the beat.

## 6. Complementary channels, not duplicated channels

For narrated surfaces, on-screen text and narration should normally perform
different but coordinated jobs.

Example:

```text
screen:     claim + visual evidence + small labels
narration:  mechanism + qualification + transition
```

Avoid:

```text
screen:     full paragraph
narration:  exact same paragraph read aloud
```

Exceptions are explicit profiles, not mistakes:

- silent carousel / muted autoplay needs more self-contained text;
- captions reproduce spoken content for accessibility;
- quotation or definition may intentionally align visual and spoken wording;
- reference deck may carry more detail than a live presentation.

This is why visual text density belongs to the surface profile, not the global
article contract.

## 7. Evidence remains evidence across surfaces

A distribution surface may **reuse** evidence; it may not fabricate it.

If exact marks carry truth — values, axes, dates, geography, rankings,
statistical uncertainty, measured relationships — the source remains the
traceable `evidence_visual` or its deterministic spec.

Allowed transformations:

- crop to the relevant region;
- change surrounding layout;
- add editorial annotation/highlight that is traceable to the same claim;
- reveal the same chart progressively;
- render at a different size.

Not allowed:

- ask an image model to recreate the chart from memory;
- modify a value for legibility;
- remove a qualification that changes interpretation;
- invent a visual relationship because it makes the frame cleaner.

## 8. Visual language is modular

The Visual Story Plan does not hardcode Diagrammatic Editorial Graphics or any
future style.

It may request semantic roles such as:

```text
identity illustration
concept visual
evidence chart
comparison diagram
character focal subject
background atmosphere
```

Then a selected visual-language module and image text profile compile those
roles. See:

- `DIAGRAMMATIC-VISUAL-LANGUAGE.md`
- `IMAGE-TEXT-RENDERING-PROFILES.md`

A future photographic, typographic-poster, pixel/game, or motion-first family
can replace the style module without rewriting the article or beat graph.

## 9. A single plan can feed several artifacts

The intended reuse pattern is:

```text
beat-01 → slide 1 → poster headline region → audio segment A → video 00:00–00:12
beat-02 → slide 2 → infographic module A → audio segment B → video 00:12–00:28
beat-03 → slide 3–4 → infographic module B → audio segment C → video 00:28–00:55
```

This does **not** mean all surfaces must contain every beat. It means when they
share a beat, they share its semantic identity and provenance.

That enables:

- consistent claims;
- incremental rebuilds;
- shared visual assets;
- selective staleness;
- easier QA of cross-surface drift.

## 10. Staleness is beat-aware

The artifact still carries the canonical article version and hashes required by
`MEDIA-STRATEGY.md`.

The Visual Story Plan additionally records claim-to-beat mapping. When the
article changes:

```text
cosmetic article edit with same carried claims
→ visual story may remain semantically fresh

claim used by beat-04 changes
→ beat-04 and every dependent surface segment become stale

thesis / dependency graph changes
→ recompile the Visual Story Plan
```

Do not rebuild a ten-minute video merely because one unrelated paragraph in the
article changed. Do rebuild any segment whose meaning/provenance changed.

## 11. Accessibility is planned before rendering

The compiler should identify where the surface will need:

- semantic titles;
- logical reading order;
- alt/alternative descriptions;
- source/citation representation;
- captions;
- audio-description or integrated verbal description when a visual carries
  information not otherwise available in narration.

Accessibility is not a post-export patch. Video-specific rules live in
`VIDEO-STORYBOARD.md`; slide-specific rules live in
`SLIDES-AND-CAROUSELS.md`.

## 12. Visual Story QA

Before any renderer is selected, inspect the plan for:

### Truth

- every fact-bearing beat resolves only to verified claims;
- uncertainty remains attached to the claim it constrains;
- no new analogy/calculation/comparison has slipped in unverified.

### Logic

- dependencies are ordered correctly;
- the sequence has a visible reason to progress;
- a transition describes a relationship rather than presenter scaffolding.

### Compression

- the plan does not preserve article detail merely because it exists;
- omission does not distort the thesis;
- important qualifications have not been optimized away.

### Cross-surface consistency

- the same beat does not assert different meanings on different surfaces;
- visual, text, and narration roles complement rather than contradict;
- an evidence object is reused from a traceable source;
- `compile-audio-script` receives the same beat/claim constraints used by the
  visual surfaces.

## 13. Stop rule

Do not keep splitting beats to chase a theoretically perfect storyboard.
Compilation is complete when:

```text
all carried claims are traceable
+ logical dependencies are preserved
+ each planned surface can map its frames/modules/chunks to beat ids
+ visual/text/narration responsibilities are explicit
+ no known cross-surface semantic conflict remains
```

Later surface QA may cause a **bounded beat amendment**. It should not reopen the
article's editorial argument without a concrete claim/logic defect.

## One-line rule

> **Compile one verified article into one versioned argument-beat graph, then let slides, infographics, the audio-script compiler, and video choose their own density and renderer while preserving the same claim identity, dependency, uncertainty, and provenance.**
