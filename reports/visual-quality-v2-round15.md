# VQ-V2 Round 15 — water infographic card corrections

Status: complete.

## Owner feedback and changes

- Scene 3 portrait placed `3.7L` against or past the right card border. Shorts Gen now measures the rendered glyph bounds, fits text to a measured content box, and applies equal horizontal padding within each value column. Regression tests cover the ink bounding box inside the card in both 9:16 and 16:9 layouts.
- Scene 4's `마시는 물 + 음식·음료` wording repeated “음료” and obscured the definition. The new card reads `마시는 물·음료 + 음식 속 수분 = 하루 총수분` in two lines. Round 14 narration and SRT are reused without edits; the existing narration says total water includes water, beverages, and moisture in food.
- Fact check: National Academies, *Dietary Reference Intakes for Water, Potassium, Sodium, Chloride, and Sulfate* (2005), Chapter 4 says total water includes drinking water, water in beverages, and water that is part of food: <https://www.nationalacademies.org/read/10925/chapter/6>. This is the reason for the on-screen wording change.

## Artifacts

Archive: `/Volumes/OricoSSD/MacArchive/vq-v2-round15/`.

The R14 originals are unchanged. R15 has separate portrait and landscape outputs plus per-scene before/after sheets in `evidence/frames/` and measured layout receipts in `evidence/round15-layout-receipts.json`.

- Portrait 1080×1920, 35.0 seconds: SHA-256 `2fc78d99dbbb7afacb06a0b095056db15d969ab5b0cb53260337def1c3bb1559`.
- Landscape 1920×1080, 35.0 seconds: SHA-256 `5414ff627ac855e3dd78ff506cf9382fe05e832ad18a0c625c964b292fbc176b`.
- Reused narration WAV SHA-256 `527b68b802497440cb677311e511758a06c57f4b3523595b028417ce049b6365`; reused SRT SHA-256 `f2db1068b5eafc433fc7cfd1c82cc0122144d19de3995124aad98dfaf936695a`.
- The renderer encoded the reused WAV as AAC; both output AAC payloads hash to `039e9f2956f260a42bb3f41c7ccf733af3b0c1b733cb700c7c600ef02c1621cd`, which differs from the Round 13 AAC source hash. WAV/SRT reuse is verified by byte hashes; AAC payload identity is not claimed.
- Portrait scene 3 `3.7L` measured at font size 156; glyph bbox `[640, 508, 955, 621]` is contained by its right-column card `[585, 450, 1010, 680]`, with equal 54 px horizontal inset in the permitted text box.
- Direct inspection covered R15 frames from both final videos and R14/R15 scene 3/4 comparisons for both aspect ratios. Subtitle overlap checks: 0 across 4 checked scenes.
- Paid provider calls: 0; renderer concurrency: 1. MacGuard before rendering: OK (`load1=2.31`, `swapfree=1054.06M`, `memfree=42%`); latest post-render sample was BUSY solely on swap headroom (`swapfree=944.88M`, `memfree=42%`), with no active renderer.

## Validation and delivery

Shorts Gen PR [#32](https://github.com/suengj/shorts_gen/pull/32) merged as `bbf762ac2615a1571e244f56f9bbefc37e4e1352`; local `main` matches `origin/main`. Sol low review of the cumulative PR diff: PASS, no actionable findings. Focused tests: 5 passed in the project virtual environment. `ruff check --select F,I` and `git diff --check` passed. GitHub reported no PR status checks. The AES report PR carries this evidence. No publication, deployment, or trading actions were performed.
