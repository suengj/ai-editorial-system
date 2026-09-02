# Image Text Rendering Profiles

This document makes text handling in generated imagery **modular rather than universal**.

It refines the embedded-text guidance in `IMAGE-GENERATION.md`: keeping important text outside the generated pixels is the safest **default profile**, not a permanent law for every future visual family.

The stable rule is narrower:

> Text treatment must be chosen explicitly for the artifact, and any semantically important text must remain verifiable, legible, and recoverable outside a brittle generative failure mode.

## 1. Why this is a profile

Different image families have different reasons to contain or exclude text.

A diagrammatic YouTube thumbnail benefits from a reusable illustration layer plus deterministic typography. A poster, comic panel, typographic artwork, period-game UI, sign, or intentionally text-native composition may need text to be generated or integrated into the visual itself.

Therefore do not encode:

```text
all production images must have no generated text
```

as a global invariant.

Encode instead:

```text
artifact
→ visual family
→ surface
→ text_rendering_profile
→ profile-specific QA
```

## 2. Available profiles

### `external_overlay`

The generated artwork contains no semantically important text. Headline, domain, labels, captions, or UI copy are typeset by a deterministic renderer afterwards.

Best for:

- reusable YouTube/social thumbnails;
- website heroes and cards;
- multilingual variants;
- assets that need responsive crops;
- repeated series with stable typography.

Advantages:

- exact spelling and typography;
- accessibility/searchability outside the pixels;
- easier localization;
- one visual can support multiple headlines;
- less regeneration when copy changes.

### `hybrid_template`

The generator creates the composition and explicit text-safe regions; deterministic text is then composited into those regions.

This is the current preferred profile for the diagrammatic character thumbnail direction because the image and the typography still behave as one composition without making the text itself generative.

### `integrated_generated_text`

The text is generated as part of the artwork.

Use when text is materially part of the visual object rather than merely metadata placed on top of it. Examples include stylized posters, signs, comic/game interfaces, typographic concepts, or art directions where letterform integration is load-bearing.

Required QA is stronger:

- exact spelling and intended wording inspected in the rendered pixels;
- legibility checked at the target size;
- no accidental extra text;
- important claims/numbers/citations independently preserved in metadata or canonical content when factual precision matters;
- regeneration or local edit if the text is wrong.

### `no_text`

The artifact intentionally carries no textual layer at all. Suitable for purely visual identity, atmosphere, abstract concepts, backgrounds, and illustrations where copy is unnecessary.

## 3. Global invariants vs replaceable defaults

### Global invariants

These survive every visual family:

1. The artifact declares its text profile before production acceptance.
2. Factual numbers, citations, evidence-bearing labels, and other exact claims must not become authoritative merely because an image model rendered plausible text.
3. Important text must be reviewable at the actual target scale.
4. Accessibility/metadata requirements are handled outside the image when the raster cannot provide them.
5. A profile change is allowed without changing the underlying editorial thesis.

### Replaceable defaults

These are **not** global:

- text must always be external;
- thumbnails must always reserve one specific safe area;
- generated typography is always a defect;
- the diagrammatic visual family must be used for every new image type.

A future visual-language module may legitimately select `integrated_generated_text` as its normal production mode.

## 4. Current diagrammatic profile

For `Diagrammatic Editorial Graphics`, the current defaults are:

```yaml
website_hero:
  text_rendering_profile: external_overlay

website_card:
  text_rendering_profile: external_overlay

character_thumbnail:
  text_rendering_profile: hybrid_template

schematic_concept_visual:
  text_rendering_profile: no_text
```

These are local defaults for this visual family and can be overridden by an artifact brief with an explicit reason.

The experimental thumbnail created on 2026-09-02 included generated typography during concept exploration. That remains valid as a directional mockup. Its production recommendation is `hybrid_template`, not because every production image must follow that rule, but because this specific reusable thumbnail system benefits from decoupling artwork from headline copy.

## 5. Prompt compilation

The text profile is a small module compiled into the image brief.

Example:

```yaml
visual_language: diagrammatic-editorial-graphics
surface: youtube-thumbnail
text_rendering_profile: hybrid_template
text_safe_area: left
headline_source: deterministic-overlay
```

A future poster family could instead declare:

```yaml
visual_language: typographic-editorial-poster
surface: campaign-poster
text_rendering_profile: integrated_generated_text
text_is_visual_subject: true
```

The rest of the generation workflow — thesis, provenance, bounded revision, and actual-pixel QA — remains the same.

## One-line rule

> **Keep the workflow stable and swap the text module: external overlay is the current diagrammatic-thumbnail default, not a universal constraint on future image generation.**
