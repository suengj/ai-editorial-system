# Suengj.com Article Image Families

> Snapshot: 2026-09-04
>
> Publication-specific contract for routing article visuals into two distinct families: **thumbnail / cover / intro visuals** and **body infographic / explanatory research graphics**. Both inherit the same suengj.com taste calibration, but they must not share the same internal information geometry.

## 1. Why this split exists

Owner review of the live `tokenized-stocks-instant-payments-liquidity-rights` article exposed a real failure mode: an illustration can match the publication's tone yet still be too symbolic, too thin, or too low-information to function as an article-body infographic on mobile.

The opposite failure also occurs: a hero/thumbnail can become a miniature report, packed with modules, labels, charts, and explanatory detail that destroy first-read clarity.

Therefore suengj.com uses two visual families:

```text
THUMBNAIL / COVER / INTRO
→ thesis-first
→ sparse
→ first-read identity

BODY INFOGRAPHIC / EXPLANATORY RESEARCH GRAPHIC
→ information-first
→ modular
→ mechanism / comparison / governance / synthesis
```

The shared publication tone is a rendering layer, not a shared information architecture.

## 2. Shared suengj.com surface language

Both families inherit the publication-specific taste profile:

- warm off-white / neutral field;
- muted forest / sage structural color;
- restrained sand / camel accent;
- quiet charcoal typography and linework;
- generous negative space;
- subtle material depth only when useful;
- no glossy glass, cinematic 3D, dark drop shadows, neon, or generic startup illustration;
- editorial/research-publication finish rather than marketing art;
- structure should feel designed, not assembled from an icon library.

This common layer should make thumbnail and infographic assets feel like they belong to the same publication even though their internal functions differ.

## 3. Family A — Thumbnail / cover / intro visual

### 3.1 Primary job

Communicate the article's **thesis, tension, or framing** at first glance.

The thumbnail is not responsible for explaining the entire article. It should make the reader understand what kind of problem or relationship the article is about before reading the prose.

### 3.2 Internal geometry

Preferred structure:

```text
1 dominant idea
+ 1–2 supporting visual structures
+ high negative space
+ low textual density
```

Typical forms:

- one system tension;
- one transformation;
- one contrast;
- one bounded metaphor;
- one large relationship between two domains;
- a restrained architectural/system composition.

### 3.3 Text rule

Prefer no text inside artwork.

Mutable publication text must remain outside:

- article title;
- section title;
- publication/update date;
- site label;
- caption;
- citation/source note;
- CTA/status/badge.

Stable semantic symbols or extremely small intrinsic labels are allowed only when the concept becomes materially less legible without them.

### 3.4 Readability target

The visual must still work when seen as:

- a Home Featured image;
- a Content-card image;
- a social/OG preview;
- an article intro/hero visual.

Its information should survive aggressive downscaling.

### 3.5 Renderer preference

Thumbnail/cover assets usually favor a **generative conceptual illustration or restrained explanatory illustration** because their job is thesis framing rather than exact evidence delivery.

Use deterministic rendering when the concept itself depends on exact geometry, but do not force a data-chart or diagram renderer merely because it is easier to automate.

### 3.6 Reject

Reject thumbnail concepts that become:

- mini dashboards;
- multi-panel reports;
- dense infographic collages;
- tiny chart collections;
- icon-per-concept grids;
- title cards with baked-in article copy;
- decorative stock-art metaphors unrelated to the article's thesis.

## 4. Family B — Body infographic / explanatory research graphic

### 4.1 Primary job

Explain a **mechanism, comparison, process, governance structure, boundary, sequence, or cross-section synthesis** more efficiently than prose alone.

A body infographic is not simply a prettier illustration inserted between paragraphs. It should produce information gain.

### 4.2 Internal geometry

Preferred structure:

```text
one primary question
→ 2–4 strong semantic modules
→ one explicit reading path
→ consequence / tension / output when needed
```

Semantic density may be medium or high when the article warrants it. Visual chrome should remain low or medium.

Good body-infographic structures include:

- comparison matrix;
- temporal progression;
- mechanism chain;
- rights / authority mapping;
- system boundary map;
- cause → effect → control loop;
- layered architecture;
- market or operational flow;
- evidence + consequence synthesis.

### 4.3 Stable labels are allowed

Unlike thumbnails, body infographics may use stable semantic labels when they materially improve comprehension.

Examples:

- `TOKEN MARKET`
- `UNDERLYING MARKET`
- `MINT / REDEEM`
- `CUSTODIAN`
- `VOTING`
- `PAUSE`

Do not bake in mutable article/section titles, dates, captions, citations, or promotional copy.

### 4.4 Renderer preference

Body infographics default toward a **deterministic or strongly structured renderer** when labels, topology, arrows, evidence, comparison rows, chronology, or exact relationships must remain stable and auditable.

Use generative rendering only when the body visual is primarily qualitative and can tolerate image-model variance without weakening meaning. Do not ask an image model to reproduce dense text, exact numeric axes, or complex compliance/rights structures that are better authored deterministically.

Practical default:

```text
thumbnail / cover
→ generative conceptual illustration is often appropriate

body infographic with labels / process / rights / exact structure
→ deterministic SVG / chart / diagram preferred
```

Both may share the same suengj.com surface language.

### 4.5 Evidence boundary

Exact values, axes, chronology, or empirical comparisons must remain deterministic or traceable.

A generated infographic may explain structure, but it must not silently invent evidence authority.

## 5. Mobile readability is a hard gate for body infographics

A body infographic that looks refined at desktop width but collapses into faint lines, tiny labels, or unreadable micro-panels on a ~390px reading surface fails the publication contract.

Require:

- module boundaries readable after downscaling;
- enough line weight and contrast to survive mobile rendering;
- large semantic grouping;
- labels only where they improve comprehension;
- no pseudo-detail or ornamental micro-charts;
- no horizontal page overflow;
- no reliance on hover or desktop-only interaction.

A reader should be able to understand the structure before zooming.

## 6. Split rule — one plate, one primary question

If one infographic starts answering multiple distinct questions, split it.

Preferred:

```text
Plate A
→ mechanism / market structure / comparison

Plate B
→ rights / governance / control / recovery
```

Not preferred:

```text
one canvas
→ mechanism
→ evidence
→ legal rights
→ operations
→ recovery
→ several tiny charts
→ several tiny icons
```

Do not solve information overload by shrinking modules, fonts, or labels.

### Split trigger

Split when any of these become true:

- more than one primary question is being answered;
- the reading path forks repeatedly;
- important labels become too small on mobile;
- more than 4 major modules compete for attention;
- the visual requires dashboard-like micro-panels;
- semantic structure remains valid only after zooming.

## 7. Denoiser benchmark interpretation

Denoiser-style article visuals are a useful benchmark for **placement and information role inside the reading flow**.

The lesson is not to copy a particular illustration style. The useful principle is:

> body visuals should behave like editorial research spreads that carry an argument, not decorative interludes.

For suengj.com this means:

```text
Denoiser-like information placement
+
suengj.com color / spacing / restraint
+
mobile-safe semantic hierarchy
```

not:

```text
copy another site's aesthetic
or
turn every article section into a poster
```

## 8. Routing questions

Before generating a visual, ask:

### Thumbnail routing

```text
What is the article's dominant thesis or tension?
What single relation should a reader recognize immediately?
Can the image work with little or no text?
Will it remain legible at card/social size?
```

### Body infographic routing

```text
What one question should this plate answer?
Which 2–4 modules are load-bearing?
What is the reading order?
What information gain does the plate add over adjacent prose?
Can it remain legible on mobile without zooming?
Should this be split into two plates instead?
Does the structure require deterministic rendering?
```

## 9. Example — tokenized stocks / 24-hour finance

For `tokenized-stocks-instant-payments-liquidity-rights`:

### Thumbnail

Primary thesis:

> Removing trading hours exposes three harder bottlenecks: liquidity, rights, and incident control.

Use one large system tension rather than a multi-panel report. A low-text generative conceptual illustration is appropriate if it preserves this thesis clearly.

### Body infographic A

Primary question:

> Why does removing market hours reveal liquidity risk?

Semantic modules:

- token market 24/7;
- underlying market closed windows;
- mint/redeem availability;
- weaker arbitrage;
- wider spread / thinner depth / persistent price gap.

Prefer deterministic SVG/diagram composition so labels, timelines, and relationships remain crisp on mobile.

### Body infographic B

Primary question:

> What must remain legally and operationally connected when trading becomes continuous?

Semantic modules:

- token holder → platform/issuer → custodian → underlying share;
- dividend / voting / redemption / corporate actions;
- wallet / oracle / custody / venue dependencies;
- pre-trade checks;
- pause authority;
- recovery / resume path.

Prefer deterministic/structured rendering because topology and semantic labels are load-bearing. If B becomes unreadable at mobile size, split it again rather than compressing it.

## 10. Relationship to other contracts

Use this document together with:

- `SUENGJ-VISUAL-TASTE-CALIBRATION.md` — shared publication surface language;
- `SUENGJ-INFOGRAPHIC-CALIBRATION.md` — semantic density vs visual density for infographics;
- `ARTICLE-ILLUSTRATION-ROUTING.md` — information type → renderer family;
- `VISUAL-INFORMATION-GAIN.md` — whether the visual should exist at all;
- `INFOGRAPHIC-AND-POSTER.md` — infographic spatial compilation;
- `ARTICLE-VISUAL-PUBLICATION-HANDOFF.md` — placement, accessibility, and publication handoff.

## One-line rule

> **Use one publication identity but two visual functions: thumbnails are thesis-first and often generative; body infographics are information-first and usually deterministic when structure or labels are load-bearing, with mobile readability and plate splitting treated as hard constraints.**
