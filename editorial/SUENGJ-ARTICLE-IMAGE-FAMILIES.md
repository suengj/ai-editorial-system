# Suengj.com Article Image Families

> Snapshot: 2026-09-04 · family-aware text/mobile calibration updated 2026-09-09
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

Parent-publication text must remain outside:

- article title;
- section title;
- publication/update date;
- site UI label;
- caption;
- citation/source note;
- CTA/status/badge.

Stable semantic symbols or extremely small intrinsic labels are allowed only when the concept becomes materially less legible without them.

The richer artifact-local text allowance for Family B does **not** apply to thumbnails merely because the same asset might later be shared socially.

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

### 4.3 Artifact-local text is allowed

Unlike thumbnails, a body infographic may be a **self-contained knowledge artifact** that is reused outside the parent article. Its text boundary is therefore family-aware.

Allowed when intrinsic to the visual and verified:

- a separately authored **visual title** naming the plate's own question/thesis rather than copying mutable parent-article metadata;
- a short visual subtitle/thesis line when required for self-contained comprehension;
- stable semantic labels and module headings;
- axes, units, chronology, verified values, comparison rows, and bounded factual payload;
- short source attribution when the infographic carries evidence and may circulate independently;
- an optional restrained publisher signature such as `suengj.com` for a distribution-capable artifact.

Keep outside the artwork:

- parent article title or section title used merely as publication chrome;
- publication/update date;
- content type, status, CTA, badge, or UI copy;
- long citations, dense qualifiers, definitions, legal/editorially sensitive wording, or anything better represented accessibly in HTML/Markdown.

A short in-art source attribution never replaces canonical page-level citation/provenance. The artifact can be self-contained without becoming its own citation authority.

Examples of intrinsic labels remain valid:

- `TOKEN MARKET`
- `UNDERLYING MARKET`
- `MINT / REDEEM`
- `CUSTODIAN`
- `VOTING`
- `PAUSE`

### 4.4 Renderer preference

Body infographics default toward a **deterministic or strongly structured renderer** when labels, topology, arrows, evidence, comparison rows, chronology, or exact relationships must remain stable and auditable.

However, integrated multimodal generation may own short structural text or bounded factual payload when the upstream text-ownership contract explicitly allows it and post-render verification checks the actual pixels/text. The deterministic lane remains the fallback and the authority for evidence that cannot tolerate generative variance.

Practical default:

```text
thumbnail / cover
→ generative conceptual illustration is often appropriate

body infographic with labels / process / rights / exact structure
→ deterministic / hybrid / verified integrated generation selected by evidence burden
```

Both may share the same suengj.com surface language.

### 4.5 Evidence boundary

Exact values, axes, chronology, or empirical comparisons must remain deterministic, declared-and-verified, or otherwise traceable.

A generated infographic may explain structure, but it must not silently invent evidence authority.

## 5. Mobile readability is a progressive gate for body infographics

A body infographic that looks refined at desktop width but loses its **primary structure** on a ~390px reading surface fails the publication contract. The gate does not require every secondary label or source footer to be readable at 390px.

At inline mobile width, require first-read comprehension of:

- what the infographic is about;
- the dominant comparison / mechanism / reading direction;
- the boundaries of the 2–4 major modules;
- the principal conclusion or tension when the visual carries one;
- no horizontal page overflow.

Fine-grained labels, source attribution, secondary annotation, or dense evidence values may require a larger view when they are not the sole carrier of a load-bearing claim **and** the publication provides a suitable full-size/open/expand path.

If load-bearing detail cannot be read inline and no detail-access path exists, split or redesign the plate. Do not use browser zoom as the intended default interaction for newly designed dense graphics.

The principle is:

```text
390px inline
→ understand the plate and its main structure

full-size / open / expand when needed
→ inspect fine labels, source attribution, and secondary evidence detail
```

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
- more than 4 major modules compete for attention;
- the visual requires dashboard-like micro-panels;
- the **primary semantic structure** becomes legible only after expansion;
- load-bearing detail is unreadable inline and no appropriate full-size/open/expand path exists.

Secondary fine detail requiring a larger view is not by itself a split trigger when the first-read structure survives and the detail is accessible elsewhere.

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
Which text is parent-publication copy vs artifact-local information?
Does the artifact need a visual-local title or source attribution to survive independent reuse?
Does the primary structure remain clear at mobile inline width?
If secondary detail is dense, what full-size/open/expand path makes it inspectable?
Should this be split into two plates instead?
Which factual payload must be deterministic or post-render verified?
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

Prefer deterministic/structured rendering because topology and semantic labels are load-bearing. If B's primary structure becomes unreadable at mobile size, split it again rather than compressing it.

## 10. Owner-approved calibration case — 2026-09-09

The `standard-vs-provider-adapter-harness` body infographic for `ai-agent-harness-over-model` is accepted as-is by the owner and becomes a bounded calibration case for this family-aware rule.

Its visual-local title/subtitle, short source attribution, verified comparison values, and restrained `suengj.com` signature are valid artifact-local information rather than parent-publication metadata. The approved raster does not need regeneration. Secondary fine print is difficult at ~390px, but the dominant Standard-vs-Provider comparison remains a first-read structure; this owner approval is not permission to waive progressive readability for future infographics.

## 11. Relationship to other contracts

Use this document together with:

- `SUENGJ-VISUAL-TASTE-CALIBRATION.md` — shared publication surface language;
- `SUENGJ-INFOGRAPHIC-CALIBRATION.md` — semantic density vs visual density for infographics;
- `ARTICLE-ILLUSTRATION-ROUTING.md` — information type → renderer family;
- `VISUAL-INFORMATION-GAIN.md` — whether the visual should exist at all;
- `INFOGRAPHIC-AND-POSTER.md` — infographic spatial compilation;
- `ARTICLE-VISUAL-PUBLICATION-HANDOFF.md` — placement, accessibility, and publication handoff.

## One-line rule

> **Use one publication identity but two visual functions: thumbnails remain thesis-first and sparse; body infographics are information-first, may carry verified artifact-local text for self-contained reuse, and must preserve mobile first-read structure with an appropriate detail-access path when fine information is dense.**
