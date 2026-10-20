# VQ-V2 Round 2 — Evidence Report

## 1. Current State

Round 2 delivered local reference candidates, repaired B layouts and B′ experiments for the three M1 cards, an OpenAI image sample, a partial Current/Improved 2×2, and a local FFmpeg/HyperFrames motion comparison. No production default changed, no asset was published, and SUE-1639 remains Done.

- SUE-1691: four public reference candidates captured. Owner choice is `HUMAN_REQUIRED`; none is selected.
- SUE-1700: cover, JustPark, and money B repairs plus B′ variants rendered; direct inspection complete. Aesthetic result remains `OWNER_REVIEW_PENDING`.
- SUE-1701: two OpenAI outputs generated with one exact prompt; source-art × renderer matrix rendered. Google image generation is `NOT_RUN / BLOCKED` after HTTP 402 on the existing Gemini key and HTTP 403 on the alternate existing Google key (API not enabled for that project). No billing or project configuration was changed.
- SUE-1702: two opening scenes of SUE-1639 rendered at 5.5s in FFmpeg and HyperFrames; sampled frames inspected. This does not reopen SUE-1639.
- Draft PR #57 remains open and unmerged. Focused local checks passed, but the third and final allowed Codex Sol review returned `FAIL` on API metadata label provenance. The renderer was then corrected to derive model, quality, prompt hash, response hash, and its local attempt ID from the matched response receipt; that last correction has not received a further Sol review, so the required `PASS` merge gate is not met.

## 2. Before vs After

- Cover B: the intended two-line title keeps “자리로” attached to the phrase using Korean keep-all and balanced wrapping; the hero photo is larger.
- JustPark B: fact text is larger, with an open fact list and a full-height photo occupying the formerly vacant upper-right and lower areas.
- Money B: a value/payment flow diagram and supporting facts use the lower area that was previously about 35% empty.
- B′: each card tests one or two candidate-derived composition/sequence traits. These are unapproved hypotheses, not a selected reference style.
- The 2×2 image matrix holds source text, font, palette, card size, and input plan fixed: existing generated art and one OpenAI API image, each through the current compositor and repaired HTML/CSS renderer. It is partial because no Google image was generated: the existing Gemini project returned HTTP 402 and the alternate existing Google project returned HTTP 403.
- The motion matrix uses the same first two water storyboard scenes, source image bytes, copy, scene durations, 9:16 output, and 30fps. HyperFrames reproduces the opening hook and word reveal timings from the FFmpeg render plan. The FFmpeg output includes a silent AAC track; HyperFrames is video-only.

## 3. Root Cause

The specified card defects trace to `ART_DIRECTION`: the prior layouts underused photographic area, relied on repeated boxes, and did not allocate hierarchy and space well. The B fixes change the art direction and hierarchy while keeping original copy, facts, and source assets intact. Model capability is not established as a cause; the Google sample is unavailable, and the two-image OpenAI sample is too small for provider generalization.

## 4. Quality Assessment (Technical vs Aesthetic)

**Technical:** local render checks passed for source text, asset and response metadata identity, 1080×1350 and 390×488 card output, and descendant bounds/internal clipped-content checks at both sizes. The API matrix records per-image hashes and usage. The motion clips are H.264 at 1080×1920, 30fps, 5.5s. HyperFrames lint has 0 errors and 2 nested-composition warnings. Sampled frames from both renderers were directly opened and inspected.

**Aesthetic:** `HUMAN_REQUIRED`. The repairs address the Manager’s concrete geometry/type defects, but no Owner verdict is inferred. The reference board is candidate-only.

## 5. Cost & Performance

**Paid API:** OpenAI GPT Image 2.5 Flare, low, 1024×1024, two images. Each response reported 103 text input and 196 image output tokens. At the official rates, each is estimated at $0.006395; cumulative actual estimate is **$0.012790**. Google Nano Banana 2.1 1K was priced before calls. The existing `GEMINI_API_KEY` project returned HTTP 402 because prepayment credits were depleted; a second existing `GOOGLE_API_KEY` returned HTTP 403 because the Gemini API is not enabled for its project. Neither request produced an image or generation charge. The first Gemini request was rejected at validation (HTTP 400, unsupported PNG response format); the corrected JPEG request returned 402. No billing or project configuration was changed. Combined API spend: **$0.012790 / $2.00 hard cap**. Existing keys only; no key values were printed, no new key issued.

Official provider sources: [OpenAI image generation and token pricing](https://developers.openai.com/api/docs/guides/image-generation), [Google image generation model selection](https://ai.google.dev/gemini-api/docs/image-generation), [Google API pricing](https://ai.google.dev/gemini-api/docs/pricing?hl=en).

**Local render observation:** FFmpeg 7.1.1 rendered portrait and landscape (two outputs) in 16.31s wall, 60.87s user CPU, 2.67s system CPU, reported max RSS 1,429,749,760 bytes. HyperFrames 0.8.114 rendered portrait in 11.21s wall, 21.75s user CPU, 2.05s system CPU, reported max RSS 580,108,288 bytes. These are single-run observations, not a throughput benchmark; FFmpeg produced two aspect ratios while HyperFrames produced one. HyperFrames upstream is [Apache-2.0](https://github.com/heygen-com/hyperframes); the installed FFmpeg reports GPL v3-or-later and was used locally only. HyperFrames CLI requires Node.js 22+ and FFmpeg; runtime used Node v22.23.0.

## 6. Implementation

Added a repeatable renderer matrix example and optional cover-photo input for B/B′ HTML generation:

- `examples/vq-v2-round2/render_b_variants.py`
- `examples/vq-v2-round2/render_provider_2x2.py`

API assets and video/board artifacts are kept under `/Volumes/OricoSSD/MacArchive/vq-v2-round2/`. Local code does not call providers during rendering. The `p04_shorts` checkout was read-only.

## 7. Decision

**HOLD** merge of PR #57. The last review verdict was `FAIL`; the final provenance correction is locally checked but unreviewed because the three allowed Sol reviews are exhausted. **NOT_VERIFIED** for Google model/output comparison, Owner aesthetic acceptance, and any production promotion. Do not change production defaults.

## 8. HUMAN_REQUIRED

- Owner chooses zero or one of the four reference candidates; no selection is presumed.
- Owner reviews the repaired B/B′ imagery and gives aesthetic verdict.
- Google generation remains blocked: the Gemini credential project has depleted prepayment credits (HTTP 402), and the alternate existing Google credential project has Gemini API disabled (HTTP 403). This run did not alter billing or project settings.
- A fresh Codex Sol review is required before PR #57 can merge; the three Round 2 review attempts were used and the last returned `FAIL`. The final correction is awaiting review.
- Production adoption remains outside this local PoC.

## Evidence Paths

- Reference candidates and comparison board: `/Volumes/OricoSSD/MacArchive/vq-v2-round2/reference-candidates/` (`reference-candidates-board.png`)
- B/B′ card renders and receipts: `/Volumes/OricoSSD/MacArchive/vq-v2-round2/sue-1700-round2-final8/`
- API spend ledger, prompt metadata, outputs, and Current/Improved matrix: `/Volumes/OricoSSD/MacArchive/vq-v2-round2/sue-1701/` (`current-improved-matrix-final11/`)
- FFmpeg/HyperFrames clips, contact sheet, and receipt: `/Volumes/OricoSSD/MacArchive/vq-v2-round2/sue-1702/`
- This report: `reports/visual-quality-v2-round2.md`
