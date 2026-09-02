# Diagrammatic Editorial Visual Language

This document defines a reusable **visual-language contract** for generated editorial illustrations that should feel native to a knowledge, research, and project publication rather than like generic AI artwork.

It is intentionally narrower than [`IMAGE-GENERATION.md`](IMAGE-GENERATION.md).

- `IMAGE-GENERATION.md` governs **when to generate, how to brief, route, inspect, revise, and record lineage**.
- This document governs **how a specific family of editorial visuals should look and behave**.
- `suengj-com` remains the authority for actual site rendering, production paths, typography, cropping, and publication wiring.

The working name for the family is:

> **Diagrammatic Editorial Graphics**

A useful descriptive variant is **Minimal Diagrammatic Editorial Illustration**.

## 1. What this style is — and is not

The visual language borrows the grammar of information design without pretending that every mark is data.

It combines:

- diagrammatic illustration;
- schematic abstraction;
- geometric editorial illustration;
- data-visualization-inspired composition;
- grid/block-based visual motifs;
- restrained International/Swiss information-design influence.

It is **not primarily pixel art**. Square modules and stepped geometry can create a pixel-adjacent impression, but the purpose is abstraction and structural readability, not retro game aesthetics.

It is also **not a data visualization by default**. A matrix, chart-like bar, node, connector, or document block may be used as a conceptual motif only when the artifact is clearly illustrative. Exact values, axes, labels, geographic positions, citations, and evidence-bearing structure remain under deterministic evidence-media rules.

## 2. Core visual grammar

The preferred grammar is built from a small set of primitives.

### Shape vocabulary

Primary:

```text
rectangles
small square modules
thin rules
sparse connector lines
nodes / anchor dots
simple document cards
matrix / grid fragments
minimal chart-like blocks
```

Secondary:

```text
circles used sparingly
soft corners when the surface calls for them
very simple organic forms such as a plant or hand-held object
```

Avoid visual vocabularies that immediately move the image into another genre:

```text
neon circuitry
holographic dashboards
robot heads
AI brains
3D glassmorphism
chrome objects
photorealistic offices
stock-photo business scenes
busy cyberpunk interfaces
```

### Abstraction level

The default abstraction level is high enough that a visual remains editorial rather than literal.

Prefer:

```text
concept → visual relationship
system → blocks and connectors
research → documents / matrices / analytical motifs
finance → restrained chart / sequence motifs
AI/data → modular network / pipeline motifs
```

Do not convert every noun into an icon. The image should feel composed, not like an icon library dumped onto a canvas.

### Line behavior

- thin and quiet;
- low visual weight relative to primary blocks;
- connectors should clarify hierarchy rather than create a dense network;
- dashed lines may indicate secondary or inferred relationships;
- avoid strong outlines around every object.

### Depth model

Default to flat or nearly flat 2D composition.

A small amount of tonal separation is acceptable, but dimensional realism is not the goal. Avoid dramatic shadows, glossy reflections, heavy gradients, and cinematic lighting unless a different artifact family is explicitly selected.

## 3. Palette behavior

The style should use a restrained, natural editorial palette.

Canonical **families**, not fixed hex values:

```text
background      → warm off-white / cream
primary         → muted sage / desaturated green
secondary       → deeper forest / moss green
neutral         → warm gray / stone / charcoal
accent          → muted camel / sand / brown
```

Rules:

- the background carries most of the area;
- green is the structural identity color, not a saturation effect;
- brown/camel is an accent, not a second dominant palette;
- charcoal is for hierarchy and contrast, not for filling the whole composition;
- no neon;
- no broad rainbow palette;
- color should never be the only carrier of semantic meaning.

For thumbnails, contrast may increase, but the palette family should not change genre.

## 4. Density and negative space

The style depends on restraint.

A useful default:

```text
few strong groups
+ large quiet regions
+ selective detail
```

Avoid filling every empty area with tiny nodes, lines, labels, decorative code, or mini charts.

Negative space is functional:

- it preserves editorial calm;
- it lets a focal subject read at small size;
- it provides crop tolerance;
- it creates a safe area for deterministic headline typography on distribution surfaces.

A visual can contain many small elements only when they form one readable macro-shape, such as a matrix or document skeleton.

## 5. Four preferred artifact families

### 5.1 Schematic concept visual

Best for:

- research topics;
- organizational/network concepts;
- system relationships;
- knowledge architecture;
- project cards.

Composition:

```text
one central structure
+ a small number of satellite modules
+ sparse connectors
+ little or no readable text
```

The structure should look *information-adjacent* without implying that the blocks are measured observations.

### 5.2 Document / interface abstraction

Best for:

- software projects;
- editorial systems;
- workflow / compiler / pipeline ideas.

Use simplified lines, segmented blocks, cards, and matrices to suggest documents or interfaces without reproducing real UI chrome.

The result should feel like a diagrammatic abstraction of an interface, not a fake screenshot.

### 5.3 Geometric editorial character

Best for:

- YouTube/video identity;
- recurring editorial series;
- project explainers;
- social thumbnails where a human focal point improves recognition.

The character should be simplified with the same geometry as the surrounding system:

- clear hair silhouette;
- simplified face;
- restrained facial detail;
- block-like garment shapes;
- a small set of recurring accessories or props;
- limited shading;
- strong figure/ground separation.

The character must look like it belongs to the diagrammatic system rather than being a conventional cartoon pasted on top of it.

### 5.4 Distribution thumbnail

A thumbnail is not merely a website illustration enlarged to 16:9.

It should use the same visual language with a stronger hierarchy:

```text
one dominant subject
+ one supporting visual metaphor
+ sparse background motifs
+ a clean text-safe region
```

The thumbnail must remain semantically readable at small mobile size.

## 6. Character consistency contract

For a recurring character, style consistency must be represented explicitly rather than left to conversation history.

Record an anchor character with the following invariants:

```yaml
character_contract:
  face_geometry: fixed
  hair_silhouette: fixed
  signature_accessory: fixed_when_used
  body_ratio: fixed_range
  illustration_abstraction: fixed
  line_block_grammar: fixed
  palette_relationship: fixed
  wardrobe_family: controlled
```

Allowed variation:

```text
pose
gesture
prop
facial expression within a narrow range
domain-specific supporting motifs
background composition
```

For a three-domain set, for example:

```text
AI / Data  → laptop, matrices, network or pipeline motifs
Finance    → restrained market/chart/document motifs
Research   → paper, book, network, evidence motifs
```

The character remains the same visual identity. The domain changes the context, not the person.

## 7. Prompt architecture

Do not place the full visual system into one undifferentiated adjective list. Compile prompts from four blocks.

```text
A. CONTENT
what this artifact is about

B. COMPOSITION
what dominates, what supports, where negative space sits

C. VISUAL LANGUAGE
the reusable diagrammatic style contract

D. CONSTRAINTS
what must not appear or drift
```

### Base style block

A reusable style block can be expressed as:

```text
Use a minimal diagrammatic editorial visual language: flat 2D geometric forms,
rectangular modules, sparse connector lines, matrix/grid fragments, generous
warm off-white negative space, muted sage and forest greens, warm gray and
charcoal neutrals, and a restrained camel accent. Keep detail selective and
information-design-adjacent rather than decorative. The image may feel slightly
pixel/grid-based, but it should not look like retro pixel art. Avoid glossy 3D,
neon, cyberpunk, stock-tech clichés, photorealism, and fabricated data labels.
```

This block can be reused while the subject/composition block changes.

### Schematic concept prompt template

```text
Create a [geometry] editorial illustration for [topic/purpose].
Represent [thesis] as [central structure/metaphor], with [supporting modules]
connected only where the relationship matters. Keep one clear macro-structure
and generous negative space.

[BASE STYLE BLOCK]

Do not include readable UI labels, numerical axes, citations, logos, or elements
that would make the illustration appear to be factual measured data.
```

### Character prompt template

```text
Create a [geometry] editorial character illustration for [surface].
The focal subject is [character contract], shown [pose/action]. Use [one or two
props] to communicate [topic]. Surround the character with sparse schematic
motifs that support the idea without competing with the silhouette.

[BASE STYLE BLOCK]

Preserve the anchor character's face geometry, hair silhouette, proportions,
and illustration grammar. Avoid conventional anime/cartoon rendering,
photorealism, neon AI imagery, and cluttered dashboards.
```

### Thumbnail prompt template

```text
Create a 16:9 editorial thumbnail using the established diagrammatic visual
language. Make [subject] the dominant silhouette and communicate [thesis] with
one supporting schematic metaphor. Reserve [left/right] negative space for a
headline that will be typeset outside the generated artwork. Increase focal
contrast relative to website illustrations while preserving the same palette
family and flat geometric grammar.

[BASE STYLE BLOCK]

No embedded headline, logo, fabricated labels, tiny dashboards, or decorative
noise. The main idea must remain readable at mobile thumbnail size.
```

## 8. Text policy

Production default: **do not generate important text inside the image**.

The publication layer should typeset:

- title;
- subtitle;
- logo/domain;
- labels that matter;
- captions;
- numerical values;
- citations.

This keeps typography accessible, editable, searchable, and responsive.

A concept-generation pass may temporarily include text to explore layout. That image should be treated as a **directional mockup**, not the final production contract. A successful exploratory image with generated typography can still lead to a production prompt that removes all embedded text and reserves a deterministic text-safe area instead.

## 9. Data-inspired, not data-claiming

One of the strongest features of this visual family is that it can visually suggest research, systems, and analysis without becoming a literal chart.

Use:

```text
matrix-like blocks
chart-like rhythm
network-like connectors
document skeletons
hierarchical modules
```

Do not use generative rendering for:

```text
exact values
real axes
real dates
geographic coordinates
source attribution
measured rankings
statistical uncertainty
```

If a visual must be true at the level of individual marks, use deterministic evidence media.

## 10. Website-to-thumbnail adaptation

The visual system has one identity but multiple density profiles.

### Website / article / project card

```text
contrast: low to medium
density: sparse to moderate
subject dominance: moderate
negative space: high
motion implication: subtle
```

### YouTube / video thumbnail

```text
contrast: medium to high within the same palette family
density: low
subject dominance: high
negative space: deliberately reserved
background detail: subordinate
```

The thumbnail should not become a different genre just to chase attention. The adaptation is hierarchy, not visual identity replacement.

## 11. Evaluation rubric

A candidate passes only if the actual rendered image satisfies the contract.

### Style fit

- does it read as diagrammatic/editorial rather than generic AI art?
- are geometry and connectors restrained?
- does the palette remain muted and coherent?
- is negative space doing real work?

### Semantic fit

- does the image communicate a relationship or idea, not merely a topic noun?
- does it avoid implying fabricated evidence?
- is the visual metaphor sufficiently specific to justify the image?

### Surface fit

- does it survive its target crop?
- is it legible at card/thumbnail scale?
- is the focal hierarchy obvious within a few seconds?
- is there enough safe space for deterministic text where required?

### Series fit

- does an anchor character remain recognizably the same?
- do recurring shape/palette rules persist?
- are domain variations subordinate to the shared visual identity?

## 12. Failure signatures

Reject or revise when the image shows any of the following:

| Failure | Why it fails |
|---|---|
| Generic network-node wallpaper | topic cliché without thesis |
| Retro pixel-art drift | grid/block motif becomes the entire genre |
| Faux dashboard overload | tiny UI fragments destroy hierarchy |
| Fabricated chart labels | illustration begins impersonating evidence |
| Excessive mutedness | thumbnail loses focal readability |
| Neon/3D/cyberpunk drift | breaks the editorial visual identity |
| Character pasted onto unrelated background | character and diagram language do not share one grammar |
| Every domain gets a different character | series identity is lost |
| Embedded headline dependency | typography becomes brittle and inaccessible |
| Prompt adjective accumulation | visual contract is replaced by ambiguous taste words |

## 13. Current suengj.com interpretation

For the current visual direction, the most accurate short description is:

> **Minimal diagrammatic editorial graphics with geometric abstraction, muted natural colors, sparse information-design motifs, and optional geometric characters.**

The useful visual impression may be “pixel-ish” because of square modules and stepped forms, but production prompts should describe the actual properties rather than request “8-bit” or “pixel art” unless a deliberately retro artifact is desired.

The current character extension follows the same rule: simplify the person into the existing visual grammar, then increase silhouette and contrast only when the surface is a thumbnail or video cover.

## One-line rule

> **Use information-design grammar to create an editorial illustration, not fake data: geometric blocks, sparse relationships, restrained natural color, deliberate negative space, and a surface-specific focal hierarchy should stay stable even when the subject changes from systems to characters to thumbnails.**
