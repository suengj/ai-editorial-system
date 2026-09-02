# Image generation — editorial intent, prompting, and visual QA

This document governs **generated and edited images as editorial artifacts**. It
sits below the durable editorial constitution and beside
[`MEDIA-STRATEGY.md`](MEDIA-STRATEGY.md): the media strategy decides *why and
when* an artifact class belongs; this contract decides *how an image is briefed,
generated, inspected, and revised* without coupling editorial semantics to one
provider.

It does not define site rendering. `suengj-com` owns publication surfaces and
its own visual system.

## 1. An image is an editorial decision, not decoration

A generated image must have a named role before a prompt exists.

Allowed roles:

| Role | What the image does | Typical examples |
|---|---|---|
| `identity` | Gives an article/project a recognisable visual identity | hero, project cover |
| `navigation` | Helps a reader choose or recognize a destination | content card, selected feature |
| `explanation` | Makes a relationship easier to understand | conceptual illustration |
| `distribution` | Repackages a canonical article for another surface | social cover, carousel image |
| `atmosphere` | Establishes tone when that tone is itself useful | restrained editorial backdrop |

`evidence` is different. A generated raster image must **not impersonate
computed evidence**. Charts, tables, timelines, maps, or diagrams whose truth
depends on exact source values should be produced from traceable data or authored
code under the evidence-media contract. Generative imagery may support or frame
that evidence, but must not fabricate axes, labels, values, citations, or
observations.

If the requested image has no role beyond “make the page look less empty,” the
correct decision can be `skip`.

## 2. Route before generating

Before planning a prompt, ask whether generation is the best renderer.

Prefer deterministic/code-native output when the visual is primarily:

- a chart or data graphic;
- a process, architecture, or relationship diagram;
- a timeline or map with factual positions;
- a semantic UI motif already expressible by the publication system;
- an interactive or state-dependent visual.

Prefer image generation when the artifact is primarily:

- an editorial hero or cover;
- an illustration or visual metaphor;
- a background/texture whose job is atmosphere rather than evidence;
- a sprite, pixel-art scene, or other raster-native art direction;
- an edit or transformation of a supplied image/reference.

The generator is a rendering backend. It does not become editorial authority.

## 3. Required image brief

Every non-trivial generated image should be reducible to this brief before
rendering:

```yaml
purpose: why this image exists
surface: where it will appear
article_ref: canonical article/version when applicable
editorial_thesis: the idea the image must support
semantic_role: identity | navigation | explanation | distribution | atmosphere
subject_or_metaphor: what is actually shown
composition: framing, focal hierarchy, negative space, crop needs
visual_language: style/material/palette constraints that matter
preserve: invariants for edits or series work
avoid: forbidden content or visual clichés
output_geometry: target aspect ratio / dimensions / crop behavior
provenance: source/reference-image information when used
acceptance: observable conditions for approval
```

Do not begin with adjectives such as “cinematic,” “beautiful,” or “premium.”
Begin with purpose and thesis.

## 4. Prompt construction

A good editorial image prompt is usually short enough to remain internally
consistent. Compose it in this order:

1. **Purpose and surface** — what the image is for.
2. **Thesis** — what idea the image should visually support.
3. **Subject/action/metaphor** — what is actually present.
4. **Composition** — crop, focal point, negative space, camera/framing when relevant.
5. **Visual language** — style, material, lighting, palette only when load-bearing.
6. **Constraints** — what must not appear.

### Default prompt shape

```text
Create a [surface] image for [article/project purpose]. The image should express
[editorial thesis] through [subject/metaphor]. Compose it with [framing and crop
requirements], using [only the visual-language constraints that matter]. Avoid
[forbidden motifs, embedded text, logos, fabricated evidence, or other specific
failures].
```

### Example — research hero

```text
Create an editorial hero for a research article about how network structure
changes over time. Express the idea through a restrained abstract composition
based on layered matrices and temporal movement, with one clear focal region and
generous negative space for responsive cropping. Keep it information-adjacent
rather than decorative; no embedded text, logos, stock-photo clichés, or
fabricated data labels.
```

### Example — project identity image

```text
Create a project cover for an AI orchestration toolkit. Show the idea of layered
operating contracts converging into a controlled execution path using sparse
flat geometry, strong figure/ground separation, and a restrained editorial
composition. It must still read at card size; no robot imagery, glowing AI
brains, dashboards, text labels, or generic network-node clichés.
```

Prompt length is not a quality target. Add detail only when it changes an
acceptance condition.

## 5. Embedded text policy

Default: **do not ask the image model to typeset article titles, captions,
legends, citations, UI labels, or logos inside the artwork**.

Text that matters semantically should normally be rendered by the publication
layer, where it remains accessible, searchable, editable, and typographically
controlled.

Embedded text is allowed only when text is itself the visual subject and the
artifact has an explicit inspection step for spelling and legibility.

## 6. Reference images and series consistency

Style consistency must be explicit state, not conversational memory.

For a series, define:

```text
committed visual contract
+ anchor/reference asset
+ current article/project brief
+ local delta
```

A reference image can establish composition, palette relationship, material,
character identity, or motif. Record what the reference is authoritative for;
do not ask the generator to copy every incidental detail.

For image edits, separate:

```text
KEEP
- composition
- subject identity
- camera/framing
- established visual language

CHANGE
- the precise defect or requested delta

DO NOT CHANGE
- explicit protected invariants
```

When the first image is close, targeted editing is preferred to full
regeneration.

## 7. Draft and production modes

Image generation has two editorial modes independent of provider-specific
quality names.

### Draft / exploration

Use to test metaphor, composition, or visual direction.

- low/medium-cost lane first;
- one or a small bounded number of candidates;
- selection criteria defined before generating more;
- no repeated premium reasoning pass for nearly identical prompt variants.

### Production

Use only after the direction is selected.

- request the required production geometry;
- increase fidelity only for the selected direction;
- inspect the actual rendered image;
- allow a bounded targeted correction pass.

The optimization target is `cost per accepted asset`, not generation count.

## 8. Visual QA

A generated image is not accepted because the tool returned a file.

### Editorial checks

- Does the image support the thesis rather than merely echo the topic noun?
- Is its semantic role clear?
- Does it avoid introducing a claim the article did not verify?
- Would the article still be truthful if the image were removed?
- Is the visual metaphor non-cliché enough to justify generation?

### Composition checks

- Is there one readable focal hierarchy?
- Does it survive the intended desktop and mobile crops?
- Does it remain legible at card/thumbnail scale where applicable?
- Is necessary negative space preserved?
- Are accidental text, logos, watermarks, malformed anatomy/objects, or visual
  artifacts absent?

### Publication checks

- output dimensions and file format are correct;
- file size is within the surface budget;
- alt/caption metadata is authored separately when required;
- rights and reference provenance follow
  [`RIGHTS-AND-PROVENANCE.md`](RIGHTS-AND-PROVENANCE.md);
- generator/provider/version and prompt lineage are recorded when the artifact
  contract requires reproducibility.

## 9. Revision stop rule

Classify the failure before revising.

### Concept failure

The metaphor, composition, or role is wrong. Rewrite the brief or regenerate.

### Local defect

The direction is correct but a bounded element is wrong. Preserve the image and
request only the delta.

Routine editorial work should default to:

```text
1 initial generation
+ at most 1 targeted revision
→ accept / skip / escalate to human visual judgement
```

More iterations require a stated reason. Repeated “make it better” loops are a
failure of acceptance criteria, not evidence that more prompting is needed.

## 10. Generator neutrality

Editorial contracts name **capabilities**, not preferred vendors.

The article/artifact plan should describe:

- what the image must communicate;
- what claims or references constrain it;
- what geometry and surface constraints apply;
- how it will be evaluated.

The rendering adapter records the actual generator/provider/model/version in
lineage. Changing the backend should not require changing the article thesis or
artifact semantics.

Current product integrations can differ: an agent environment may expose image
generation as a built-in Skill/tool, while another agent may need an approved
external image API. That difference belongs in the project execution adapter,
not here.

## 11. Relationship to other media

The same editorial hierarchy governs audio and can later govern video:

```text
Canonical Article
→ generator-neutral artifact plan
→ modality-specific semantic representation
→ modality-specific rendering backend
→ modality-specific QA
→ lineage
```

Audio now has its own contract:
[`AUDIO-SCRIPT.md`](AUDIO-SCRIPT.md). It defines the listener-first spoken
script, pronunciation/performance intents, semantic chunking, and audio QA
before a TTS backend is selected. Provider/model observations remain in
[`../benchmarks/AUDIO-TTS-PROVIDERS.md`](../benchmarks/AUDIO-TTS-PROVIDERS.md).

Image, audio, and video keep separate acceptance criteria. Audio fails on
listening structure, pronunciation, pacing, and voice continuity; video fails
on temporal continuity, motion, synchronization, and duration/cost; image fails
on composition, crop, local visual defects, and identity consistency.

Share provenance and planning rules. Do not reduce them to one vague
“multimedia generation” prompt.

## 12. Handoff to suengj-com

This repository owns the editorial image brief and planning semantics.
`suengj-com` owns:

- whether its existing SVG/CSS/site motif is the better renderer;
- repository-local Codex/Claude image-generation Skills;
- actual output paths and publication wiring;
- responsive cropping, performance, and page-level visual certification.

The handoff is therefore:

```text
AI Editorial System
= why / what / prompt contract / editorial QA
        ↓
suengj-com
= how to render inside this site / provider adapter / publication verification
```

## One-line rule

> **Generate an image only after its editorial role is explicit; route factual structure to deterministic visuals, route genuinely illustrative work to a replaceable image backend, and judge the rendered asset against thesis, crop, provenance, and bounded revision criteria rather than prompt sophistication.**
