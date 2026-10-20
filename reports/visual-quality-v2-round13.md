# VQ-V2 Round 13 — R11 visual regressions

## Result

Re-rendered portrait (1080×1920) and landscape (1920×1080) at 35 seconds, addressing the three defects found in R11:

- Scene 1 now uses the R5 photo-only approved crop as a cover image, with a lower gradient. The lower-band check measures horizontal edge-column luma variance, so a vertical gradient does not hide a solid blank band.
- Caption wrapping now balances measured line widths and avoids a single-word final line when two words fit. Phrase text and source word order remain intact.
- The R5 scene 4 photo was the same meal photo used in scene 5, so scene 4 now uses a locally authored card that explains drink + food → total water. No image-generation call ran. The renderer reports adjacent image SHA-256 comparisons in the render plan without blocking intentional repeated scenes.

## Render and media evidence

- [Portrait video](</Volumes/OricoSSD/MacArchive/vq-v2-round13/after/round13-9x16.mp4>) · [Landscape video](</Volumes/OricoSSD/MacArchive/vq-v2-round13/after/round13-16x9.mp4>)
- Direct inspection: [portrait R11/R13 comparison sheet](</Volumes/OricoSSD/MacArchive/vq-v2-round13/evidence/frames/comparison/comparison-9x16.jpg>) · [landscape R11/R13 comparison sheet](</Volumes/OricoSSD/MacArchive/vq-v2-round13/evidence/frames/comparison/comparison-16x9.jpg>)
- 12 sampled frames per aspect were directly inspected. At the lower-band threshold of 10, the R11 opening measured 0.00 (portrait) and 0.12 (landscape); R13 measured 394.15 and 45.96. Scene 4 and scene 5 source hashes differ in both aspects. Values and output hashes: [visual check receipt](</Volumes/OricoSSD/MacArchive/vq-v2-round13/evidence/round13-visual-checks.json>).
- The exact R11 narration WAV and SRT were reused. WAV SHA-256: `527b68b802497440cb677311e511758a06c57f4b3523595b028417ce049b6365`; SRT SHA-256: `f2db1068b5eafc433fc7cfd1c82cc0122144d19de3995124aad98dfaf936695a`.
- AAC payloads match the R11 reference byte-for-byte for both outputs: `e00e33793712a2f871a4b98c625d173499b28bb080f3365c63a18c3033900dd8`. The final MP4s use the original AAC stream copied from R11 after rendering.

## Engineering

Shorts Gen PR [#30](https://github.com/suengj/shorts_gen/pull/30) was squash-merged as `577cf37`. Sol low review of `bd79360` returned PASS. An initial review found that rejecting repeated images would block valid intentional scene reuse; the final change records SHA-256 results instead and permits rendering. GitHub reported no status checks.

Local validation on the final engine change:

- `tests/engine/test_render_quality.py` + `tests/engine/test_ffmpeg_integration.py`: 112 passed.
- Focused caption/hash/band regression selection: 5 passed.
- Ruff lint and `git diff --check`: passed.

The visual inspection, FFprobe dimensions/duration, WAV/SRT hashes, AAC hashes, and band/hash measurements were performed locally. The orchestrator `qa_repair` stage was not run on the remuxed final MP4s.

MacGuard was requested but no `macguard` executable was available in the shell (`macguard not found`). Render concurrency stayed at one. No paid provider ran.

Archive root: `/Volumes/OricoSSD/MacArchive/vq-v2-round13/`.
