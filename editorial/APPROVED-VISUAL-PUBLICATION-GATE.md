# Approved visual publication gate

This is the editorial-side fail-closed gate for a visual that has already crossed `HUMAN_APPROVED_LOCKED`.

It supplements `APPROVED-VISUAL-ASSET-LIFECYCLE.md` and `ARTICLE-VISUAL-PUBLICATION-HANDOFF.md`. Those remain the contract authority. This document exists as a short operator-facing guardrail for publication agents.

## Core rule

Human approval freezes visual identity. Publication work may change transport, file format, deterministic compression, cache identity, and site placement; it may not silently change the approved artwork.

```text
approved master
→ deterministic derivative
→ binary integrity
→ publication integration
→ deployment
→ live equivalence
```

A delivery problem is never a creative prompt.

## Post-approval intent

The following remain `publication_only`, `fidelity_only`, or `format_only`:

- upload / attach / publish;
- make high-resolution / high-quality;
- convert PNG ↔ WebP/AVIF;
- reduce file size;
- repair broken binary transport, MIME, cache, or path;
- update the article to reference the approved visual.

For all of these, `regeneration_allowed = false`.

## Quality is part of preservation

Visual identity is not preserved merely because composition is similar. A derivative fails preservation when publication processing materially damages information visible in the approved master.

For text-heavy infographics, fidelity includes:

- native geometry unless an explicit responsive derivative is required;
- legibility of small Korean/English text;
- thin-line and icon clarity;
- photographic/illustrative detail where it carries meaning;
- no material crop or spatial rearrangement;
- no arbitrary low-byte target that destroys readability.

Downscaling an already-sufficient master simply to make upload easier is not `fidelity_only`; it is `QUALITY=FAIL` unless an owner explicitly accepts that limitation.

## Forbidden substitutions

After approval, never solve publication friction by:

- recreating the visual as SVG;
- embedding a low-resolution bitmap inside an SVG wrapper;
- generating “something equivalent” with an image model;
- using a screenshot/mockup as a replacement master;
- promoting a low-resolution test derivative to production;
- reusing the same public URL for materially different artwork without intentional cache/version handling.

If the publication environment cannot safely carry the master/derivative bytes, return a media-boundary failure and hand off to a binary-capable path.

## Completion gate

A successful publication requires evidence for both transport and perception:

```text
APPROVED_MASTER_IDENTITY=PASS
DERIVATIVE_LINEAGE=PASS
VISUAL_EQUIVALENCE=PASS
QUALITY=PASS
BINARY_INTEGRITY=PASS
PUBLICATION_HANDOFF=PASS
DEPLOYMENT=PASS
LIVE_ASSET_BYTES=PASS
LIVE_VISUAL_QA=PASS
```

`DEPLOYMENT=PASS` alone is insufficient. A CDN can successfully deploy the wrong file or an over-compressed derivative.

`LIVE_VISUAL_QA` means the real public rendering is compared against the approved master at intended reading size. Small labels, fine lines, hierarchy, and meaningful image detail must remain readable. If not, the correct response is a fidelity repair from the same master, never a redraw.

## One-line rule

> An approved image is an asset, not a prompt: preserve its pixels and information quality through deterministic derivatives, fail closed on media-boundary problems, and verify the actual live rendering before declaring publication complete.
