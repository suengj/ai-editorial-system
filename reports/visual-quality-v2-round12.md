# VQ-V2 Round 12 — Trends.moa native typography/layout

Date: 2026-10-20 Asia/Seoul
Worktree: `/private/tmp/vq-v2`
Status: AES local reference-path fix implemented; PR and independent review pending.

## Owner report and evidence

Linear SUE-1438 records the owner's verbatim report:

> 이거 이미지나 배치나 내용은 괜찮은데 폰트 오와열이 깨짐 왜 그럴까
> Trends.moa에서 나온거고 chatgpt registry로 돌린거야

Screenshot supplied at `scratchpad/r12in/trendsmoa-owner.png`. It is an iOS screenshot of `image.png`, not a direct readback of the original PNG, execution receipt, selected font files, or native image-generation/composition call.

## Route and cause

Read-only registry inspection found `trends-moa` maps to AES target `trends-moa`, task `both`, with ChatGPT native selected as image provider. The batch allows deterministic text composition, forbids new paid image APIs, and explicitly says a Pillow-only image is not a successful generated image. No registry file, batch prompt, schedule, or runtime was changed.

AES `editorial/STRUCTURED-VISUAL-EXECUTION.md` points native users to `examples/native-card-recipe.py` as the Pillow layout reference (SUE-1337 R5 / PR #56, commit `0d986d0`). That recipe strictly loads caller-provided font files, but the card text uses raw `draw.text((x, y), ...)` coordinates; it has no `textbbox`-based pill measurement, vertical centering, common left-grid assertion, or post-render container/padding self-check. This permits font ascent/bearing differences and guessed widths to show as baseline drift, inconsistent gutters, pill overflow, and uneven internal spacing.

This is the confirmed defect in the AES reference path and a plausible explanation for the screenshot. The exact renderer and font used for the supplied PNG remain unverified because neither the original PNG bytes/receipt nor production call details were supplied.

## Change

- Added `examples/trends-moa-native-layout.py` as a deterministic, no-network fixture using the screenshot's visible copy and a local solid background. `before` recreates the observed failure class; it is not claimed to be the original image.
- Corrected `examples/native-card-recipe.py` to place actual measured glyph bounds with an explicit `lm` anchor and emit/fail its own text-container and left-grid self-check receipt.
- The corrected path measures with the exact loaded font/weight/size, uses `textbbox` and `anchor="lm"/"mm"`, derives pill width/height from measured glyph bounds plus padding, and uses `GRID_X=64` for shared left-side elements.
- Explicit font file load errors fail before output creation; there is no Pillow default/system fallback. Output/receipt collisions with font inputs, script, or each other also fail before writing.
- The renderer prints and writes a geometry table. All text bboxes must stay inside their declared containers, pill padding asymmetry must be ≤2 px, and shared left-grid deviations must be ≤2 px.
- Added `npm run test:trends-moa-native-layout`; it checks before/after distinction, deterministic byte-identical repeated PNGs, bbox containment, symmetric padding, grid alignment, missing-font failure, and input/output path collision rejection. The existing `npm run test:native-card-recipe` now also asserts the corrected recipe geometry checks.
- Updated the native Pillow execution contract in `editorial/STRUCTURED-VISUAL-EXECUTION.md`.

## Local comparison evidence

Generated with Pillow 11.3.0 and repository AES Sans KR fonts. No image-generation API, paid service, or external source image was used.

| Artifact | Path | SHA-256 | Result |
|---|---|---|---|
| Before failure-class fixture | `evidence/round12-native-layout/before.png` | `7911bf5a94ca1862a3bb0eeadb9bbf779c061b10e783ef2c42df4d304d5a1db9` | Raw top-left placement/guessed dimensions; visual reproduction only |
| Corrected fixture | `evidence/round12-native-layout/after.png` | `0e874aa1dfb790239605f3ad9280bdb16c683d710340543447b3342f2997d705` | Self-check PASS; all 18 geometry rows PASS |
| Corrected geometry receipt | `evidence/round12-native-layout/geometry-receipt.json` | — | Includes actual bboxes, container extents, padding, grid deltas, font and output hashes |

Observed self-check: six shared-grid deltas were 0 px; four pill checks passed with maximum padding asymmetry 2 px; eight text/container bbox checks passed. These establish fixture geometry, not owner visual acceptance or a production Registry run.

## Scope and remaining proof

Registry/batch deployment is not needed for this AES reference-path change and was not attempted. Runtime behavior of the separate ChatGPT native registry job remains unverified; the test does not claim that runtime imports or calls this script. No content was published, no Trading or owner-accepted state was set, and no billing data was queried.
