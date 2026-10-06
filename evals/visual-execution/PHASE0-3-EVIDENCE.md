# SUE-1332 Phase 0–3 implementation evidence — 2026-10-06

Base: `a0f598ccf0b842006862841d6020dc69bbd3e43f`. Scope: common entry guide,
existing-profile resolution, local source-layer composition and line/bar binding.
The owner explicitly requested no CI and main merge; Phase 4 remains owner-run.

## What actually ran

`node scripts/test-visual-execution.mjs`: **45 assertions passed**, including real
PNG rendering, actual Korean glyph measurement/wrapping, exact unscaled source
pixels, alpha cutout, theme/preset and geometry overrides, watermark OFF/ON,
duplicate prevention, background ordering, source-digest checks, line/bar output,
null gaps, units beyond probability bounds, and failure paths. `node --check`
was run on changed JavaScript modules. No network or model calls were needed.

Runtime: Node.js 22.16.0; ImageMagick 7.1.2-1 Q16-HDRI using its RSVG delegate;
installed Korean/Latin font stack. rsvg-convert itself was unavailable. The
watermark engine's original default rsvg path was not exercised here; the new
optional adapter path called the same glyph-mask/blend code with actual SVG
rasterization. No new npm dependencies or service were installed.

The original `renderChart` output for the line fixture is byte-identical to the
pinned baseline, SHA-256
`053617f360c6f7d269db1e8324252aba439b79b4b7c9a22081c501b578ceb3a3`.
Original profile/renderer/README snapshots used locally were verified against
Git blob SHA values. This was a targeted local source subset obtained through
the connector, **not a full repository checkout**. Full `npm test`, the full
repository boundary suite, and existing article/claim compiler E2E were **not
run**. Do not substitute this targeted result for them.

## Corrections found during the local run

The first replay test found ImageMagick wall-clock date chunks changing the
clean-master hash even when pixels were unchanged. The local SVG adapter now
removes only generated date metadata and encodes a stable PNG; source files
are not rewritten. A second run from the same inputs then produced identical
watermarked bytes. Explicit-height precedence was also checked so an inherited
ratio cannot silently discard a task-specified dimension.

## Actual output identities

These are local synthetic test artifacts, not approved editorial production
assets. The source image is an authored pixel pattern, **not a real person or
photograph**. No generated binary is committed to this repository.

| Case | Output geometry | PNG SHA-256 |
| --- | --- | --- |
| card | 1080×1080 | `sha256:5acf90fac00fd7d1a67d122df5de539bed53502ce71e0b25421c4a5790360d95` |
| photo | 1080×1080 | `sha256:c27fe350a8435f7d7993ae8c5043705a325a30892c19855a68b43d5b01899bd1` |
| marked | 1080×1080 | `sha256:2dd314ca18299d3c2269479a2bfadb97142c67ec9dd297be628071ec357ab959` |
| marked-repeat | 1080×1080 | `sha256:2dd314ca18299d3c2269479a2bfadb97142c67ec9dd297be628071ec357ab959` |
| behind | 1080×1080 | `sha256:c87fcbb8c07ee7cf49d4d166e642d6aa9a39c0f62698f485425976f7d5de3a10` |
| line | 1080×1350 | `sha256:64103c3d6b9727d3446df46a98e822939ef00f09c1f8c51e2de51dd308440f89` |
| bar | 1080×1350 | `sha256:cd6e8b8a5d404030a62a2e12bd186dcd42336451fd8dfd5571fa4763ab4be422` |
| mixed | 1080×1350 | `sha256:7d94b7fb54b9375a7b0ca06422b35b4a5039699b371bcf5c9570bde5324af058` |
| cutout | 1080×1080 | `sha256:25977ff378f4c6195781dd0401c9d70f295041376c0be38432058211864c6573` |

Card, line/mixed and bar pixels were inspected for actual text/render binding;
this is a technical smoke, not owner aesthetic approval. The numeric fixture
is explicitly illustrative and does not establish actual market observations.

## Remaining Phase 4 / deployment boundary

- New ChatGPT session using the guide, native image generation and byte handoff.
- Real licensed photo/screenshot and actual PMC bundle integration/UAT.
- Article-bound VisualBrief/RenderSpec/claims end-to-end validation.
- Blog infographic/report art-direction quality, carousel consistency, account
  presets, actual display-size acceptance and requested Drive/publisher handoff.
- Generative local edits/inpainting and automatic background removal are not
  implemented by the local compositor. Supplied cutout/master PNGs are supported.
- Local images require normalized non-interlaced 8-bit RGB/RGBA PNG input.

CI: **NOT_RUN by owner request**. Existing workflow configuration is unchanged.
Publication/production approval: **NOT_GRANTED**. These tests do not complete
SUE-1337 or the overall SUE-1332 program.
