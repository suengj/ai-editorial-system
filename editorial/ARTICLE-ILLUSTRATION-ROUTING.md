# Article Illustration Routing — from article thesis to visual form

This document governs **how a finished or sufficiently stable article is translated into an in-article visual concept before rendering begins**.

It sits between the article and the existing visual contracts:

```text
Canonical / stable article
        ↓
Article Illustration Routing  ← this document
        ↓
Illustration brief + visual family
        ↓
DIAGRAMMATIC-VISUAL-LANGUAGE.md
        +
IMAGE-GENERATION.md / deterministic evidence renderer
        ↓
Rendered asset
        ↓
Surface-specific QA / publication
```

Related contracts:

- [`IMAGE-GENERATION.md`](IMAGE-GENERATION.md) — whether generation is appropriate, prompt construction, lineage, revision, visual QA.
- [`DIAGRAMMATIC-VISUAL-LANGUAGE.md`](DIAGRAMMATIC-VISUAL-LANGUAGE.md) — the reusable geometric/editorial house language.
- [`INFOGRAPHIC-AND-POSTER.md`](INFOGRAPHIC-AND-POSTER.md) — single-canvas argument systems and evidence/illustration separation.
- [`VISUAL-STORY-COMPILATION.md`](VISUAL-STORY-COMPILATION.md) — cross-surface argument-beat compilation when the article expands into slides, infographic, audio, or video.

The current publication-profile name used in this document is:

> **Editorial Research Graphic**

It describes a family of visuals that behave like part of a research publication rather than like generic blog decoration.

---

## 1. The image must carry an information function

Do not start with:

```text
"What image would look good here?"
```

Start with:

```text
What does the reader need to understand faster, remember longer,
or perceive structurally that prose alone does not show as efficiently?
```

An article illustration should normally do one of four jobs:

| Function | Reader benefit | Typical visual |
|---|---|---|
| `explain` | Understand a process, boundary, mechanism, or relationship | explanatory diagram |
| `compare` | See differences, trade-offs, or categories at once | structured analytical graphic |
| `compress` | Hold a complex system in one mental model | architectural / layered system visual |
| `frame` | Grasp an abstract thesis or tone before reading detail | conceptual editorial illustration |

If none of these functions is material, the correct decision can be `skip`.

The system does not use generated imagery merely to break up text.

---

## 2. Route by information type before selecting style

The first routing decision is semantic, not aesthetic.

```text
DATA / EXACT VALUES
→ deterministic chart / table / evidence graphic

RELATIONSHIP / PROCESS / BOUNDARY
→ explanatory editorial diagram

SYSTEM / ARCHITECTURE / LAYERS
→ architectural or layered conceptual diagram

COMPARISON / FRAMEWORK
→ structured analytical graphic

ABSTRACT THESIS / IDENTITY
→ conceptual editorial illustration
```

### 2.1 Data and exact evidence

Use a deterministic renderer when individual marks need to be true.

Examples:

- time series;
- exact percentages;
- rankings;
- statistical comparisons;
- axes;
- measured geography;
- dates/timelines where position carries factual meaning.

The visual may still inherit the publication palette and typography, but the generator must not invent the evidence.

### 2.2 Relationships, processes, and authority boundaries

Prefer an **explanatory editorial diagram**.

Good subjects include:

- workflow;
- market plumbing;
- custody / rights chains;
- editorial authority boundaries;
- agent handoff;
- source → verification → artifact flow;
- causal mechanisms when the causal claim is actually supported.

The diagram should make a relationship easier to inspect, not add ornamental nodes.

### 2.3 Systems and architectures

Prefer an **architectural / layered conceptual diagram** when several layers must be held in one mental model.

Useful visual metaphors:

```text
rooms / compartments
gates
stacked planes
controlled paths
modular blocks
nested systems
```

A restrained isometric or near-isometric view is allowed when spatial depth materially improves comprehension. It should not drift into glossy 3D illustration.

### 2.4 Comparisons and frameworks

Prefer a **structured analytical graphic**.

Use aligned regions, matrices, scales, or paired structures when the article asks the reader to compare:

- methods;
- models;
- strategies;
- system states;
- decision criteria;
- trade-offs.

If the comparison contains exact observed values, those marks remain deterministic.

### 2.5 Abstract thesis and identity

Prefer a **conceptual editorial illustration** only when the visual metaphor adds explanatory or identity value.

It is appropriate for:

- a hero image;
- a section opener;
- a strong View/Essay thesis;
- a project identity image.

It is not appropriate when the only instruction is the topic noun itself.

---

## 3. Current suengj.com publication profile

For the current suengj.com direction, the house style should be interpreted as:

> **Swiss/editorial grid + scientific/architectural diagram + restrained data-visualization grammar + occasional conceptual abstraction.**

This extends the geometric language already defined in
[`DIAGRAMMATIC-VISUAL-LANGUAGE.md`](DIAGRAMMATIC-VISUAL-LANGUAGE.md).

### Stable visual properties

```text
background      → warm off-white / soft neutral
primary marks   → charcoal / dark warm gray
accent          → one restrained accent family; at most two when semantically useful
geometry        → flat or nearly flat, modular, clean
layout          → editorial grid, clear alignment, strong grouping
lines           → thin, quiet, purposeful
whitespace      → generous and functional
text            → deterministic outside generated artwork when load-bearing
```

### Desired impression

The asset should feel closer to:

```text
research publication
editorial information design
scientific concept figure
architectural explanatory graphic
```

than to:

```text
startup landing-page illustration
stock technology art
cinematic AI concept art
generic blog hero
```

The goal is **visual argument**, not visual spectacle.

---

## 4. Preferred visual families

The following mix is a **current publication default**, not a universal law or hard quota.

### 4.1 Explanatory / structured editorial graphics — primary lane

Use most often for article-body visuals.

A practical target for the current publication is roughly **70% of visual use** across explanatory diagrams and structured analytical graphics.

Characteristics:

- one claim or mechanism per image;
- grid-led composition;
- sparse connectors;
- compact groups;
- clear first-read hierarchy;
- low decorative density;
- deterministic text when labels are necessary.

This family is the default for Finance, Markets, Research, AI systems, and methodology writing.

### 4.2 Architectural / isometric conceptual systems — secondary lane

A practical target is roughly **20%**.

Use when a flat flowchart is semantically correct but cognitively weak because the reader must understand containment, separation, layers, gates, or controlled movement.

Examples:

```text
control plane
agent authority boundary
editorial pipeline
market infrastructure
project architecture
```

Keep depth shallow and diagrammatic. No photorealistic rooms, glossy blocks, neon, or cinematic lighting.

### 4.3 Abstract analytical composition — accent lane

A practical target is roughly **10%**.

Use for:

- hero visuals;
- section transitions;
- thesis-first essays;
- publication identity.

Possible motifs:

```text
grid fragments
chart rhythms
circles / rules
layered document forms
matrix pieces
controlled geometric tension
```

This lane should provide rhythm without replacing explanation.

---

## 5. Content-type routing

These are defaults that can be overridden by the actual thesis.

| Content / subject | Preferred first choice | Secondary choice |
|---|---|---|
| Finance / Markets | explanatory system diagram; structured analytical graphic | abstract thesis visual |
| AI / Agents / Editorial systems | layered architecture / authority diagram | document-interface abstraction |
| Research / Methodology | comparison/framework graphic | schematic concept visual |
| Project | architecture / system map | restrained project identity visual |
| View / Essay | conceptual editorial illustration | simple explanatory graphic when a mechanism exists |
| News | deterministic evidence or timeline when useful | illustration only if it adds genuine context |
| Note | usually skip unless a visual object is central | lightweight conceptual visual |

Do not force every content type into a permanent aesthetic slot. The **article's information structure outranks its category label**.

---

## 6. Article-to-illustration planning pass

Before asking an image model or renderer to make anything, compile the following object.

```yaml
article_illustration_brief:
  article_ref: canonical or stable article/version
  placement: hero | body | section_opener | summary
  thesis: one or two sentences
  reader_need: what should become easier to understand or remember
  information_type: data | relationship | process | system | comparison | abstract_thesis
  visual_function: explain | compare | compress | frame
  visual_family: explanatory_diagram | analytical_graphic | architectural_system | conceptual_illustration
  renderer: deterministic | generative | hybrid
  dominant_structure: the one macro composition to perceive first
  supporting_elements: bounded list
  house_style: editorial_research_graphic
  text_policy: external_overlay | hybrid_template | none
  evidence_boundary: what must remain exact / deterministic
  avoid: topic-specific clichés and global visual failures
  acceptance: observable pass conditions
```

The brief is the important artifact. The prompt is a renderer-specific compilation of this brief.

---

## 7. Three-concept exploration rule

For a new article where the visual direction is not obvious, a planning agent may propose up to three **meaningfully different** concepts before rendering.

Recommended concept spread:

```text
A — explanatory / canonical
B — more architectural or spatial
C — more abstract / thesis-first
```

The concepts must differ in the way they explain the thesis, not merely in camera angle or color.

Example planning output:

```text
Concept A: rights-chain diagram
- emphasizes legal/operational layers

Concept B: liquidity rooms with gated transfer
- emphasizes boundaries and bottlenecks

Concept C: fragmented 24-hour clock intersecting settlement layers
- emphasizes the thesis that time extension does not remove structural constraints
```

Select the concept **before** expensive production rendering when possible.

---

## 8. Prompt compilation

Once the brief is approved, compile the prompt in this order:

```text
1. artifact role / placement
2. article thesis
3. visual function
4. dominant structure / metaphor
5. composition and hierarchy
6. house visual language
7. evidence and text boundary
8. forbidden motifs
9. geometry / crop requirements
```

### Reusable prompt skeleton

```text
Create a [placement] editorial research graphic for an article whose central
thesis is: [THESIS]. The image's job is to [EXPLAIN / COMPARE / COMPRESS / FRAME]
that idea by showing [DOMINANT STRUCTURE]. Keep supporting elements limited to
[SUPPORTING ELEMENTS] and make the first-read hierarchy obvious.

Use the established suengj.com editorial research visual language: warm off-white
background, charcoal or dark neutral structure, one restrained accent family,
clean editorial grid, flat or nearly flat geometry, thin purposeful lines, and
generous negative space. The result should feel like a research-publication or
architectural explanatory graphic rather than generic AI artwork.

Keep [EVIDENCE / LABELS / VALUES] outside the generated image or reserve clean
space for deterministic rendering. Avoid [TOPIC CLICHÉS], glossy 3D, neon,
cyberpunk interfaces, stock-tech motifs, fake dashboards, fabricated chart
labels, and decorative clutter. Target [GEOMETRY / CROP].
```

The style block is stable. Thesis, information function, structure, and prohibited topic clichés change per article.

---

## 9. Topic-cliché rejection

Generated visuals often choose the most statistically obvious noun representation. Reject that shortcut when it weakens the article.

### Finance / blockchain

Avoid by default:

```text
floating coins
golden crypto tokens
candlestick wallpaper
bull/bear mascots
neon blockchain cubes
exchange-building stock imagery
```

### AI / agents

Avoid by default:

```text
robot faces
human brain + circuitry
glowing neural networks
holographic dashboards
hands touching digital brains
```

### Research / data

Avoid by default:

```text
random charts with invented values
magnifying glass over generic documents
floating formulas with no semantic role
icon carpets
```

The correct visual should usually encode the **article's mechanism or distinction**, not its keyword.

---

## 10. Body illustration vs hero image

Do not apply the same density to every placement.

### Body illustration

Purpose: explanation.

```text
self-contained relation
low decorative load
close connection to surrounding paragraph
labels only when necessary and deterministic
```

A body visual should answer a specific question raised by the nearby prose.

### Hero image

Purpose: framing / identity.

```text
stronger silhouette or macro-composition
fewer explanatory parts
more crop tolerance
more negative space
```

A hero may be more abstract, but it still needs a thesis relationship.

### Section opener

Purpose: orientation.

Use sparingly. Prefer a small conceptual system or visual motif that prepares the next section rather than a second unrelated hero.

---

## 11. Hybrid artifact rule

A strong article visual can combine generated and deterministic layers.

```text
generated conceptual structure / background
        +
deterministic labels / typography
        +
deterministic evidence chart or values
```

This is often preferable to asking one model to produce the entire artifact.

For current suengj.com production, exact text and evidence should normally remain outside the generated raster layer.

---

## 12. Visual QA for article fit

In addition to the checks in `IMAGE-GENERATION.md`, ask:

### Thesis fit

- Can the reviewer state which article claim the image supports?
- Does the image reveal the mechanism, comparison, system, or thesis rather than merely echo a noun?
- Did the image introduce an unverified causal relationship?

### Publication fit

- Does it feel native to the surrounding typography and whitespace?
- Is the palette restrained enough to sit inside the page rather than behave like an advertisement?
- Can multiple article visuals coexist without becoming a collage of unrelated styles?

### Information density

- Is there one dominant reason for the image to exist?
- Can a major element be removed without losing meaning? If yes, remove it.
- Does the reader need to zoom in to discover the point? If yes, simplify.

### Renderer integrity

- Are exact facts deterministic?
- Are generated elements clearly illustrative?
- Is important text rendered outside the image unless an explicit profile allows otherwise?

---

## 13. Handoff for future article chats / agents

When another ChatGPT/agent session receives an article and is asked to add illustrations, the preferred planning sequence is:

```text
READ ARTICLE
→ extract thesis / mechanism / comparison
→ identify candidate placement(s)
→ classify information type
→ select renderer
→ choose visual family
→ produce up to 3 concept directions when needed
→ select one direction
→ compile production prompt/spec
→ render
→ visual QA against article + house style
→ hand off asset + brief + lineage to publication layer
```

The next session should not need to rediscover the visual language from conversational memory. It should read this contract plus `DIAGRAMMATIC-VISUAL-LANGUAGE.md` and work from the article itself.

---

## 14. Boundary with the publication repository

This repository owns:

```text
why the article needs an image
what information function it serves
which visual family is appropriate
how the current publication visual profile is described
what evidence/text must remain deterministic
how the result is editorially evaluated
```

`suengj-com` owns:

```text
actual image files
responsive placement and crop
site typography and deterministic overlays
format / compression / performance
provider-specific generation adapter when implemented there
page-level visual QA and publication wiring
```

The visual profile may evolve. A site redesign updates the publication profile; it should not rewrite the durable rule that **semantic routing precedes aesthetic prompting**.

---

## One-line rule

> **Read the article first, classify what the reader needs to see, then route data to deterministic evidence, relationships to explanatory diagrams, systems to layered architecture, comparisons to analytical graphics, and abstract theses to restrained conceptual illustration — all within one editorial research visual language rather than a new style for every post.**
