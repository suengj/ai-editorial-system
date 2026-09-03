# Suengj.com Visual Taste Calibration

> Snapshot: 2026-09-03
>
> This is a **publication-specific taste calibration**, not a global editorial constitution. It records current suengj.com preference evidence so future image/diagram prompts do not have to reconstruct aesthetic intent from chat memory.

## 1. Preference evidence

Four variants of the same article concept were reviewed with the owner. Preference order:

```text
2 > 4 > 3 > 1
```

The ranking is treated as evidence about **visual character**, not as authority for the exact composition or subject matter of those images.

### What the ranking implies

Preferred qualities:

- very generous negative space;
- thin, quiet linework;
- low-contrast warm off-white field;
- muted forest/sage green with a restrained sand/camel accent;
- a small amount of physical depth or material presence without glossy 3D;
- fewer, larger compositional groups rather than many small icons;
- asymmetry that still feels balanced;
- soft hierarchy and editorial calm rather than obvious infographic loudness;
- structure that feels designed, not merely diagrammed;
- a subtle sense of refinement through restraint rather than through decoration.

Less preferred qualities:

- dense icon-library composition;
- many tiny UI fragments or mini charts competing at once;
- every object enclosed in a heavy card or container;
- dashboard-like visual density;
- diagram elements that look generic or quickly assembled;
- flat vector sterility with no tonal/material nuance;
- literal repetition of the article's nearby text structure.

## 2. Current visual target

The working target for suengj.com is best described as:

> **Airy editorial systems illustration — nearly flat, softly dimensional, highly restrained, with architectural spacing and information-design discipline.**

This is a refinement of the existing `Diagrammatic Editorial Graphics` profile, not a replacement.

A practical visual grammar:

```text
canvas
→ mostly quiet warm off-white

primary structure
→ thin charcoal / forest linework
→ one or two large semantic groups

secondary structure
→ pale guides / dotted paths / faint grid fragments

accent
→ sparse sand/camel markers

materiality
→ optional faint ground plane, paper/card edge, soft tonal separation
→ never glossy glass, heavy shadow, cinematic 3D
```

## 3. Variant interpretation

### Variant 2 — preferred anchor

Why it leads:

- the composition breathes;
- thin connectors and pale secondary geometry create depth without noise;
- a subtle ground/material presence makes the image feel finished rather than mechanically vectorized;
- the main transformation remains easy to read even though the canvas is not dense;
- individual objects feel subordinate to the overall composition.

Use this as the strongest current taste anchor.

### Variant 4 — secondary anchor

Why it works:

- even more restrained and open;
- strong first-read hierarchy;
- nearly no decorative enclosure;
- good example of how much can be removed while preserving the concept.

Risk:

- can become too sparse or generic if the article-specific mechanism is weak.

### Variant 3 — acceptable but more conventional

Strength:

- clear grouping and easy scanning.

Weakness:

- larger framing rectangles and several small modules make it read more like a polished explainer graphic than a distinctive publication illustration.

Use when grouping materially helps comprehension, not as the default shell.

### Variant 1 — least preferred

Weaknesses:

- denser icon/mini-chart population;
- more visible 'diagram assembly' feeling;
- higher risk of looking generic or quickly produced;
- less negative space and weaker editorial calm.

Avoid using this density as the default article-body profile.

## 4. Prompt implications

Do not rely on vague adjectives such as `premium`, `beautiful`, or `modern` alone. Compile the preferred character into observable properties.

Recommended style block:

```text
Use an airy editorial systems-illustration language: a warm off-white field,
very thin charcoal and muted forest-green linework, sparse sand/camel accents,
large functional negative space, and only a few semantic groups. Keep the
composition nearly flat but allow very subtle material depth through pale ground
planes, faint card edges, or soft tonal separation. Secondary guides, dotted
paths, and grid fragments should be quiet and partially recede. Avoid icon-grid
density, dashboard-like mini charts, heavy cards, glossy 3D, dark shadows,
neon, and generic startup illustration. The result should feel deliberately
composed and publication-native rather than quickly diagrammed.
```

### Density rule

Default article-body target:

```text
1 dominant idea
+ 1–2 supporting structures
+ sparse connectors
+ high negative space
```

Do not fill empty space simply to make the visual feel complete.

## 5. Infographic is a separate information geometry

The preferred visual style does **not** mean every visual is an infographic.

The four calibration images are primarily:

```text
conceptual editorial illustration
+
schematic explanatory diagram
```

They are **infographic-adjacent**, but not full infographics in the stricter editorial sense.

### What counts as an infographic here

An infographic should synthesize several distinct information units into one spatial argument, for example:

```text
one canvas
├─ progression / stages
├─ comparison / categories
├─ mechanism / relation
└─ evidence or consequence module
```

A true infographic does not require numeric data, but it should do more than redraw one nearby paragraph or one five-node sequence.

Qualitative infographic examples are valid when they compress cross-section reasoning such as:

```text
Tool
→ what becomes cheap
→ what becomes representable
→ what becomes optimizable
→ organizational consequence
```

or:

```text
Central IT       → spreadsheet       → AI agent
representation      optimization        action
local autonomy       metric gaming      authority risk
```

The exact structure must be supported by the article and must pass `VISUAL-INFORMATION-GAIN.md`.

## 6. Infographic placement rule

Infographics should usually sit where they **synthesize several sections**, not immediately below text that already states the same structure.

Preferred locations:

- after several related sections as a synthesis;
- before a major transition when the reader needs a mental model;
- near the end as a compact argument map;
- as a standalone distribution artifact derived from the canonical article.

Avoid:

```text
paragraph states sequence
→ identical infographic directly below
```

If the infographic would only repeat adjacent prose, use `replace`, `reposition`, or `skip`.

## 7. Infographic style profile for suengj.com

When an infographic is warranted, keep the same taste calibration:

- warm off-white background;
- thin structural rules;
- no poster-like saturation;
- 2–4 major modules rather than many tiles;
- one clear reading path;
- sparse annotation;
- stable semantic labels only when necessary;
- publication title/caption/date remain outside artwork;
- quantitative evidence remains deterministic;
- subtle depth is allowed, but the graphic should still read as information design first.

Think:

```text
editorial research spread
+ architectural information design
+ restrained infographic hierarchy
```

not:

```text
marketing infographic
+ icon grid
+ dashboard collage
```

## 8. Relationship to other contracts

Use this calibration together with:

- `DIAGRAMMATIC-VISUAL-LANGUAGE.md` — durable visual grammar;
- `ARTICLE-ILLUSTRATION-ROUTING.md` — information type → visual family;
- `VISUAL-INFORMATION-GAIN.md` — whether the visual adds enough new information;
- `INFOGRAPHIC-AND-POSTER.md` — infographic / poster spatial compilation;
- `ARTICLE-VISUAL-PUBLICATION-HANDOFF.md` — placement, text boundary, accessibility, lineage.

If a future owner review produces a materially different preference ranking, update this calibration document rather than rewriting the durable editorial constitution.

## One-line rule

> **For suengj.com, refinement comes from space, thin structure, muted natural color, and subtle material depth; use fewer, stronger groups, and treat infographic as a synthesis geometry that must add cross-section information rather than a denser version of the same diagram.**
