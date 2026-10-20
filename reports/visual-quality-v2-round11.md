# VQ-V2 Round 11 — R10 layout defect repair

## Result

Rendered the R11 revision in portrait (1080×1920) and landscape (1920×1080), each 35.0 seconds. The final videos are in `after/round11-9x16.mp4` and `after/round11-16x9.mp4`.

- Subtitle backing now stays in a fixed lower safe band, is centered, and follows measured text width with horizontal padding. Backing geometry is checked against the declared scene content box.
- Captions are grouped into sentence/phrase pages, preserve narration text in sequence, and each page displays for at least 1.78 seconds.
- Photo scenes use full-bleed imagery with a lower gradient. Scene 5 no longer uses a translucent card; the floating short yellow accents were removed.
- The scene 3 chart card and labels remain clear of the subtitle band.
- Reused the exact R10 narration WAV and SRT. No speech synthesis ran. The R10/R11 AAC payload SHA-256 matches at `e00e33793712a2f871a4b98c625d173499b28bb080f3365c63a18c3033900dd8`.

## Visual and timing verification

- Directly inspected 12 R11 frames for each aspect and 24 paired R10/R11 frames per aspect. Sheets: `evidence/frames/comparison/inspection-9x16.jpg`, `inspection-16x9.jpg`, `comparison-9x16.jpg`, and `comparison-16x9.jpg`.
- Geometry check: all 8 subtitle pages per aspect checked against scene content bounds; 0 intersections, 0 issues; minimum display duration 1.78 seconds. See `evidence/frames/overlap-check.json`.
- R9-method audio sync remeasurement: R11 cue starts land exactly at the +50 ms policy (0/0 ms deviation); absolute ASR onset error is 50/50 ms, matching R10. Cue-end overhang and underhang are both 0 ms at 10 ms RMS-window resolution, matching R10.
- Full measurement table and hashes: `evidence/timing/measurement.md` and `.json`.

## Engineering verification

- `tests/engine/test_render_quality.py` and `tests/engine/test_ffmpeg_integration.py`: 109 passed, including R11 phrase-page render and QA in both aspects. QA/render cache invalidation tests: 3 passed.
- Ruff lint passed for the changed Python files. `git diff --check` passed.
- Ruff format check still reports formatting in pre-existing sections across the touched legacy files; no whole-file reformat was applied to avoid unrelated churn.

## Delivery

Engine change: [suengj/shorts_gen PR #29](https://github.com/suengj/shorts_gen/pull/29), Sol low review PASS, squash-merged as `55debaac478ebf480c1cd5115ac5635031778883` on 2026-10-20. No GitHub status checks were reported. Archive root: `/Volumes/OricoSSD/MacArchive/vq-v2-round11/`.
