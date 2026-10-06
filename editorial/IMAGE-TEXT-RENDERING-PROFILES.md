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

## 6. Repeated-series typography and brand text

When two or more images belong to one infographic, card, slide, or carousel
series, recurring text is treated as **one deterministic typography system**.

The image generator may create text-safe regions or an integrated composition,
but it must not independently redraw exact recurring series text on every frame
when that text can be rendered deterministically.

Typical repeated series text includes:

- brand/domain or watermark text such as `suengj.com`;
- page or frame count;
- series label / eyebrow;
- source label;
- recurring footer metadata;
- recurring section-label roles.

### Lock once, reuse exactly

For each semantic typography role, resolve once per series and reuse the same
renderer token references for:

    font family
    font weight
    font size / scale
    line height
    letter spacing / tracking
    alignment / anchor

The generic editorial core does **not** hard-code the actual typeface, colour,
or pixel value. Exact typography and design tokens remain owned by the target
surface/brand renderer. The rule here is that once those tokens resolve for a
series, the same role must not silently resolve differently from frame to frame.

Exact repeated strings also remain exact. `suengj.com` on six cards is one
brand string rendered six times from the same overlay component, not six
generative interpretations of the string.

### Generative local edit is not a typography lock

A bounded image edit can repair an exploratory mockup, but it does not provide
a deterministic font guarantee. For production series assets, recurring brand
text and typography roles should therefore be composited after generation or
rendered through the publication layer whenever the selected text profile
permits it.

### Scope boundary

This rule governs **typographic identity and information hierarchy only**.

It must not force:

- one palette across otherwise valid visual-language variants;
- one illustration style;
- one lighting or material treatment;
- one background tone;
- one visual metaphor.

Those are art-direction decisions. Typography consistency prevents accidental
series drift without turning the typography contract into a colour/style
contract.

## 7. Optional watermark overlay (SUE-1303)

A watermark is the section 6 "brand/domain" overlay with an on/off switch. It
extends the existing RenderSpec/brand profile; it is not a service, an engine,
a DRM layer, or a security framework.

**Config.** `schemas/render-spec.schema.json#/$defs/watermark`; the first
sample is `schemas/examples/watermark-suengj-com-sample.example.json`. The
pinned brand profile is not edited here (a change to it needs a calibration
ledger record), so brand-level default wiring is a separate owner-gated step.
Fields: `enabled` (default **false**), `text`, `color`, `opacity`, `placement`,
`scale`, `safe_margins`, `exclusion_zones`. Every field is optional, so a profile
layer, a RenderSpec, and an account/channel override each set only what they
change; later layers win (`resolveWatermark(brand, renderSpec, channel)`).
First sample: text `suengj.com`, `#9CA3AF`, opacity `0.08`, `lower-center`,
horizontal. Placement is limited to horizontal lower-center/left/right.
Diagonal is not offered: it crosses content, which the exclusion rule forbids.
After sample review, adjust the profile values only.

**Compositing.** `scripts/lib/watermark-core.mjs` (CLI: `scripts/watermark.mjs`)
post-processes a flattened PNG. Exact glyphs come from the system SVG
rasteriser (`rsvg-convert`) with a Korean-first, Latin-fallback font stack, then
a plain alpha blend. No image model ever draws the text; 0 API/LLM calls.

**OFF is a no-op.** With `enabled: false` the master bytes are returned
unchanged and no file is written. The master is the publication asset.

**ON is a separate derivative.** The derivative is a new file, with lineage
(`master_sha256`, `derivative_sha256`, resolved config, glyph box, renderer,
`api_calls: 0`) in a `<derivative>.lineage.json` sidecar and in a PNG `tEXt`
chunk. The master is never overwritten. Every run starts from the clean master;
a file that already carries the lineage chunk is refused as input, so an overlay
can never be stacked twice. Same master + same config gives the same bytes on
the same rasteriser.

**Exclusion zones.** The watermark must never sit over numbers, charts, or
small text. The layout declares those regions as fractional `exclusion_zones`
(for example the chart plot, the source line). The measured glyph box is
checked against every zone and against the safe margins; on any overlap or
margin violation the run fails closed and no derivative is produced. Zones are
declared by the layout, not detected from pixels. For 9:16 surfaces use a larger
bottom margin (about 0.12) to clear platform UI.

**Limits.** A single flattened PNG has no layers, so this is a low-opacity
overlay on top of the image, not a placement "behind" the art. A renderer that
owns source layers may place it above the background and below primary text.
The watermark deters casual reuse and aids identification; it does not prevent
copying and is not a security control. Cropping or retouching can remove it.
Low opacity is deliberate: at 0.08 gray on a cream field it is barely visible,
so judge it on real samples before tuning.

**Not accidental-watermark detection.** `IMAGE-GENERATION.md` "Composition
checks" rejects accidental text, logos, and watermarks that a generator
hallucinated into the artwork. That check applies to the clean master and is
unchanged. This section governs the intentional, deterministic, user-requested
overlay added afterwards to a derivative. The two never share a code path: the
master must pass the accidental check before any overlay exists.

## One-line rule

> **Keep the workflow stable and swap the text module: external overlay is the current diagrammatic-thumbnail default, not a universal constraint on future image generation.**
