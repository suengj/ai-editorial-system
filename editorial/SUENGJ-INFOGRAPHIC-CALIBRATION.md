# Suengj.com Infographic Calibration

> Snapshot: 2026-09-03
>
> This is a publication-specific calibration derived from owner review of two infographic concept boards for the same article. It does not replace the durable infographic, visual-language, or information-gain contracts.

## 1. Owner preference signal

Two concept boards were reviewed.

The owner preferred:

- **Board 2 for visual design** — cleaner editorial finish, more whitespace, thinner rules, lower color density, stronger publication feel;
- **Board 1 for information composition** — richer argument structure, clearer module differentiation, more explicit comparison/progression/causal logic.

The resulting target is not a compromise average. It is a deliberate composition rule:

> **Preserve Board 1's information architecture while rendering it with Board 2's visual restraint.**

Or, more compactly:

> **Do not compress the argument merely to make the canvas look minimal. Compress the visual chrome instead.**

## 2. Semantic density and visual density are separate controls

A useful infographic may carry substantial information without looking busy.

```text
semantic density
= number and richness of meaningful relationships the graphic preserves

visual density
= number, weight, contrast, enclosure, and decorative prominence of visible elements
```

For suengj.com, the current preference is:

```text
semantic density   → medium to high when the article warrants it
visual density     → low to medium
```

This means:

- retain meaningful comparison dimensions;
- retain causal steps that change the argument;
- retain historical stages when they explain the thesis;
- retain consequences and risks when they are load-bearing;
- reduce boxes, fills, icons, borders, color blocks, repeated labels, and decorative modules instead of deleting the reasoning.

## 3. Information architecture comes first

Before styling, compile the infographic as an argument map.

A good semantic draft can look plain or even ugly. It should first answer:

```text
What are the major information modules?
What is the reading order?
Which relationships are causal, comparative, temporal, or hierarchical?
Which dimensions are necessary to preserve the article's thesis?
Which consequence or tension should remain visible at the end?
```

Only after that should the visual-compression pass begin.

### Preferred semantic structures

Current owner feedback supports structures such as:

#### Comparative matrix

```text
                  Spreadsheet        AI Agent
Representation    ...                ...
Optimization      ...                ...
End-user power    ...                ...
Risk              ...                ...
Org consequence   ...                ...
```

#### Historical progression

```text
Central IT
→ Spreadsheet
→ AI Agent
→ organizational consequence
```

with secondary rows for what becomes cheap, who gains power, and what risk persists.

#### Causal synthesis

```text
Tool capability
→ action becomes cheaper
→ representable/actionable scope expands
→ optimization scope expands
→ organization adapts
→ new control problem emerges
```

These are semantic skeletons, not fixed layouts.

## 4. Visual compression pass

After semantic structure is approved, reduce visual density without deleting load-bearing information.

Preferred transformations:

```text
many bordered cards
→ shared alignment + whitespace

heavy section fills
→ typography + spacing hierarchy

icon in every row
→ icons only where they materially improve scanning

strong grid everywhere
→ light rules only where alignment needs support

several accent colors
→ quiet green primary + restrained sand/camel consequence accent

large explanatory labels
→ short stable labels + concise supporting line

separate boxes for every idea
→ larger semantic groups with internal alignment
```

The result should feel closer to an editorial research spread than a marketing infographic.

## 5. Minimalism must not erase argument structure

A common failure is to simplify the canvas by deleting the very distinctions that make the infographic useful.

Reject this pattern:

```text
rich article argument
→ remove dimensions
→ remove exceptions
→ remove consequence
→ retain one decorative arrow
→ call it minimal
```

Minimal presentation is not minimal reasoning.

The graphic should be able to carry a richer information model while remaining visually calm.

## 6. Current aesthetic target

Use the existing suengj.com taste profile as the rendering layer:

```text
warm off-white field
large functional whitespace
thin charcoal / muted forest-green linework
low color density
restrained sand/camel accent
little or no heavy card chrome
small semantic iconography only when useful
soft hierarchy
subtle material depth allowed
clear typography hierarchy
```

Avoid:

- dashboard density;
- marketing-infographic saturation;
- icon-per-cell behavior;
- heavy rounded cards around every module;
- decorative arrows or connector webs;
- reducing information solely to create empty space;
- adding unsupported content merely to make the infographic feel richer.

## 7. A two-pass editorial workflow

For a material infographic, use two separate review passes.

### Pass A — Information Architecture Review

Review only:

- module coverage;
- argument fidelity;
- relationship correctness;
- reading order;
- information gain relative to the article;
- evidence and interpretation boundaries.

Do not judge polish yet.

### Pass B — Visual Restraint Review

After Pass A is approved, review:

- whitespace;
- line weight;
- enclosure count;
- typography hierarchy;
- color density;
- icon count;
- balance and rhythm;
- publication-native finish.

A visually beautiful infographic that lost the semantic structure fails Pass A. A complete but busy infographic fails Pass B.

## 8. Relationship to the information-gain gate

This calibration does not authorize more visuals merely because the infographic can hold more information.

The infographic still must pass `VISUAL-INFORMATION-GAIN.md`.

The key question is:

> Does this canvas synthesize relationships that the nearby prose does not already present in the same compact form?

If yes, a higher semantic-density infographic may be warranted.

If no, use `replace`, `reposition`, or `skip`.

## 9. Prompt / compiler implication

Do not ask a renderer simply for a `minimal infographic`. That often causes semantic deletion.

Instead compile in two layers:

```text
SEMANTIC SPEC
- preserve these modules
- preserve these dimensions
- preserve this reading order
- preserve this consequence / tension

VISUAL SPEC
- high whitespace
- thin rules
- low color density
- few enclosures
- restrained iconography
- editorial research spread feel
```

A reusable instruction is:

> **Keep the full approved information architecture. Simplify only the visual treatment: remove unnecessary containers, decorative icons, heavy fills, redundant labels, and high-contrast chrome while preserving every load-bearing comparison, stage, causal link, and consequence.**

## 10. Body-infographic role boundary — 2026-09-04

This calibration now applies specifically to the **body infographic / explanatory research graphic** family defined in `SUENGJ-ARTICLE-IMAGE-FAMILIES.md`.

It must not be used to justify dense thumbnail/cover images. Thumbnail assets remain thesis-first and sparse even when a body infographic for the same article carries richer semantic structure.

### Mobile gate

A body infographic must remain structurally understandable at roughly a 390px reading viewport without requiring zoom.

This does not mean enlarging every label indiscriminately. It means the semantic architecture itself must survive downscaling:

- use 2–4 strong modules rather than many tiny panels;
- keep one clear reading path;
- use line weights/contrast that survive mobile rendering;
- allow stable semantic labels only when they materially improve comprehension;
- reject pseudo-detail and ornamental micro-charts;
- avoid horizontal overflow.

### Plate split rule

Use **one plate per primary question**.

If a canvas starts carrying two different explanatory jobs, split it. Typical pattern:

```text
Plate A → mechanism / comparison / market structure
Plate B → rights / governance / control / recovery
```

Do not solve a dense semantic plan by shrinking modules or labels until the graphic becomes technically complete but practically unreadable.

### Denoiser benchmark interpretation

Treat Denoiser-style article visuals as a benchmark for **information placement inside the reading flow** and for the idea of a visual research spread. Do not copy its look mechanically. The target remains suengj.com in surface language, with clearer information hierarchy inside body infographics than inside thumbnails.

## 11. One-line rule

> **For suengj.com body infographics, preserve rich information architecture and reduce visual chrome; keep one plate to one primary question, and treat mobile readability as a hard editorial gate.**
