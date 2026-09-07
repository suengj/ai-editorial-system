# AI Image Generation Guide — Editorial Quality Re-baseline

This guide supplements `IMAGE-GENERATION.md` with a production-oriented quality framework for generated editorial imagery.

It exists because factual correctness, restrained branding, and deterministic rendering can accidentally collapse a rich editorial visual into a flat SVG/dashboard aesthetic. The goal is to preserve editorial quality while keeping claims, provenance, and approval boundaries auditable.

## 0. Authority boundary

This guide owns art direction and the generated-image **quality** re-baseline only.
[`IMAGE-GENERATION.md`](IMAGE-GENERATION.md) remains the editorial brief and QA contract; [`IMAGE-TEXT-RENDERING-PROFILES.md`](IMAGE-TEXT-RENDERING-PROFILES.md) remains the authority on image text handling.
[`profiles/brand/suengj-com.v1.json`](profiles/brand/suengj-com.v1.json) remains the authority on palette, line, and materiality; [`ARTICLE-ILLUSTRATION-ROUTING.md`](ARTICLE-ILLUSTRATION-ROUTING.md) remains the authority on thesis → renderer routing.
[`HITL-PROTOCOL.md`](HITL-PROTOCOL.md) and the SUE-638/SUE-639 approved-asset lock remain the only approval authority; nothing here grants machine approval, lock, or publication rights.
Where this guide restates a rule from those documents, the other document wins.

## 1. Core principle

**Brand-compatible, not UI-mimetic.**

Website UI minimalism is not an art-direction constraint for editorial imagery.

`simple` means **cognitively simple** — clear hierarchy, fast comprehension, low ambiguity — not graphically sparse.

Editorial visuals may use depth, people, environments, perspective, atmosphere, layered objects, translucent process elements, and richer composition when those devices improve explanation.

Do not translate the site's minimal interface into generic cards, icon grids, thin-line SVGs, or dashboard geometry by default.

## 2. Preferred grammar for body infographics

Default body-infographic direction:

```text
article thesis
→ visual story / metaphor / causal scene
→ integrated editorial composition
→ structured evidence / mechanism / metrics layer
→ factual verification
```

Avoid the inverse pattern:

```text
data points
→ boxes / cards / generic icons
→ flat flowchart
→ template infographic
```

A strong plate should communicate the thesis before the reader parses every label.

The information layer should strengthen the visual argument rather than substitute for one.

## 3. Separate semantic rendering from factual rendering

Do not treat `deterministic = accurate` as `the whole image must be deterministic`.

Use a hybrid contract:

### Generative semantic layer

Appropriate for:

- people and human activity;
- environments and spatial context;
- editorial metaphor;
- atmosphere and lighting;
- depth, material, perspective, foreground/background separation;
- integrated narrative composition;
- visually expressive process or causal relationships that do not depend on exact geometry.

### Deterministic factual layer

Appropriate for:

- exact numbers;
- exact labels and citations;
- axes and scales;
- chronology;
- legally or editorially important wording;
- factual annotations whose correctness must be mechanically verified;
- provenance and output metadata.

Possible production patterns:

1. generate the editorial scene, then composite deterministic labels/data;
2. generate a mostly complete visual, then replace/repair exact text or values in post;
3. keep precise evidence as HTML/SVG adjacent to a richer generated scene;
4. split a dense concept into two plates rather than force all exact information into one generated image.

## 4. Prompt architecture

Provider guidance converges on a simple structure: **subject + action + context + composition + style**, with explicit constraints only where they matter.

Use this editorial expansion:

```yaml
purpose: what reader problem the image solves
thesis: the idea that must be understood at first glance
subject: people / objects / metaphor
activity: what is happening
context: environment or conceptual space
composition: focal hierarchy, spatial sequence, crop, foreground/background
visual_language: medium, depth, light, texture, palette
information_layer: evidence/mechanism/metrics that may appear
reference_authority: what each reference image controls
fixed_constraints: exact items that must not drift
avoid: known failure modes
```

Prompt example shape:

```text
Create an editorial information illustration for [article purpose].
Show [subject] [activity] in [context], so the viewer immediately understands [thesis].
Compose the scene with [spatial hierarchy / focal sequence / depth], then integrate a restrained information layer for [mechanism/evidence].
Use [visual language].
Preserve [fixed constraints]. Avoid [specific failure modes].
No article title baked into the image unless explicitly required.
```

Do not overload prompts with long adjective lists. Clear spatial and semantic instructions are more reliable than aesthetic buzzwords.

## 5. Reference-image authority

Reference images are first-class production state.

**Status:** The per-reference `authority` / `not_authority` record is a target contract for SUE-643, not current shipped behavior.

A reference must declare what it controls. Examples:

```yaml
reference_1:
  authority:
    - composition grammar
    - depth
    - editorial illustration quality
    - palette relationship
  not_authority:
    - literal people
    - literal objects
    - article-specific text

reference_2:
  authority:
    - information layering
    - workflow transparency
    - human/AI relationship
```

Use a small reference set. Too many competing references create style dilution and prompt conflict.

For suengj.com editorial body imagery, recovered owner-preferred AI-labor visuals establish only an integrated human scene, AI/workflow layer, spatial narrative, restrained evidence modules, high whitespace, and depth/information-layering richer than the site UI system. Palette remains governed by [`profiles/brand/suengj-com.v1.json`](profiles/brand/suengj-com.v1.json) until a reference-authority record supersedes it under SUE-643. The tension between the references' depth treatment and the brand profile's current `depth_model: flat or nearly flat 2D` is an **OPEN**, tracked conflict for SUE-644 to resolve; this guide does not resolve it.

## 6. Style consistency vs brand consistency

Keep these separate.

### Brand consistency

Can constrain:

- overall restraint;
- palette family;
- typography outside the artwork;
- whitespace discipline;
- intellectual / editorial tone;
- avoidance of loud commercial or generic sci-fi clichés.

### Visual style consistency

Can constrain:

- illustration medium;
- character treatment;
- depth and lighting;
- material/texture;
- spatial storytelling;
- line/shape language;
- information overlay behavior.

Do **not** derive the second automatically from the website UI system.

## 7. Exploration before production

A single first-generation candidate is often insufficient when art direction is not already established.

Use two modes:

### Direction discovery

Use when the visual metaphor or composition grammar is unresolved.

- generate 2–4 meaningfully different directions, not near-duplicates;
- vary the visual thesis treatment, not just color;
- select one direction using an explicit rubric;
- stop exploring once one direction is clearly preferred.

### Production refinement

After direction selection:

- preserve composition and style reference;
- make bounded local edits;
- change one major variable at a time;
- prefer targeted edit over full regeneration when the direction is correct.

The revision budget should apply to **production refinement**, not prematurely prevent art-direction discovery.

## 8. Quality rubric

A visual should be judged on more than geometry and correctness.

Score or explicitly review:

1. **Thesis clarity** — can the viewer state the article's central relationship?
2. **Narrative composition** — does the eye move through an intentional sequence?
3. **Editorial quality** — does it feel authored rather than template-generated?
4. **Spatial richness** — is depth/context used where useful without clutter?
5. **Information hierarchy** — are data and labels subordinate to the main visual idea?
6. **Article fit** — does the visual genuinely belong to this article?
7. **Brand compatibility** — restrained and coherent without copying site UI components.
8. **Factual integrity** — exact claims, values, labels and provenance are verified.
9. **Text integrity** — short, legible, correct; mutable article title is not baked in by default.
10. **Crop resilience** — survives desktop/mobile/body placement.

A technically valid render can still FAIL on 1–7.

## 9. Negative visual corpus

Keep rejected outputs as explicit negative evidence.

Tag failures such as:

- `dashboardization`
- `ui_mimicry`
- `flat_svg_aesthetic`
- `generic_icon_grid`
- `box_overload`
- `weak_visual_thesis`
- `style_dilution`
- `over-minimalization`
- `dense_text`
- `reference_drift`

Do not merely delete poor candidates. Use them to make future routing and review more discriminating.

## 10. Positive owner-reference corpus

Owner-approved visual references should be preserved as named assets with:

- file hash;
- article/context;
- why it was approved;
- authoritative traits;
- traits that must **not** be copied literally;
- intended artifact families;
- known limitations.

This becomes a visual preference corpus, not just a folder of examples.

## 11. Text and dense infographic handling

Current image generators can render text better than earlier systems, but exact text remains a risk surface.

Rules:

- keep embedded text short;
- specify exact wording when text is necessary;
- prefer deterministic post-composition for important numbers/labels;
- never trust generated citations, axes, or source values without verification;
- consider external design/post-processing for dense text-heavy plates;
- article titles remain outside the artwork by default because titles can change.

## 12. Provider-neutral, provider-aware

The editorial system remains provider-neutral, but rendering adapters may be provider-aware.

Different models have different strengths in:

- reference adherence;
- text rendering;
- local editing;
- photorealism vs illustration;
- composition stability;
- multi-image conditioning.

Therefore maintain a small provider/model observation layer describing what a backend is good at, without putting vendor assumptions into the editorial constitution.

## 13. Human gate

Human review is not only a correctness gate.

For production editorial visuals the owner must be able to reject an asset for:

- aesthetic quality;
- weak art direction;
- generic/template feel;
- insufficient depth or narrative composition;
- mismatch with the article;
- mismatch with established positive references.

`schema valid`, `geometry valid`, or `all labels correct` is never sufficient evidence of visual approval.

## 14. Research basis

The practical rules above align with current provider guidance:

- OpenAI recommends clear prompts grounded in purpose/subject/action/context/style, small targeted revisions, explicit constraints, and a small number of reference images.
- Google's image prompting guidance similarly emphasizes subject, context/background, and style; Google Cloud's current prompting framework expands this to subject + action + location/context + composition + style.
- Midjourney's current reference guidance separates image/content references from style references, recommends keeping text prompts simple when a style reference is strong, and uses references to carry colors, medium, texture and lighting rather than literal content.

These are implementation heuristics, not editorial authority. The owner-approved visual corpus remains the highest local aesthetic evidence.

## One-line rule

> **Use generative imagery to create the editorial scene and visual argument, deterministic methods to protect exact facts and typography, and human preference evidence to decide whether the result is actually good.**
