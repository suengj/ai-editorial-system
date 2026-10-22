# SUE-1760 CRAFT-C — same-input evidence

**Comparison:** `721d9326f536846a5998a461d94e28e5b78d6aeb` (detached worktree `/tmp/aes-sue1760-before`) → `73ff9bbb3d89545512ecf7971a4afd9552b5154e` (`craft-b/sue-1759`). This is a deterministic local evaluation; no paid calls, image generation, TTS, or video renders were used.

## Results

| Case | Status | Finding |
|---|---|---|
| KO/EN copy | `OWNER_REVIEW_PENDING` | Machine observations preserve actor, forecast/hedge strength and meaning. Korean clause form and English collocation look more natural; human labels remain with SUE-1754. |
| Mixed KO/EN number card | `NO_PROMOTION` (`REAL_OUTPUT_COMPARED`) | Fixed assets/copy rendered at 1080×1350 and 390×488. Compared with baseline, the after layout gives only a modest photo-area gain and smaller body copy (38px→34px; source unchanged at 30px); units and figures stay intact. |
| Image-led cover | `OWNER_REVIEW_PENDING` (`REAL_OUTPUT_COMPARED`) | Pinned compositor rerender exposes the driveway photo in the upper 54%; before text does not cover the subject, but opaque bands hide most of the image. Owner taste is not decided. |
| Per-type samples | `REAL_OUTPUT_COMPARED` | Illustration and photo-real generated samples inspected. No 3D or anime representatives were accessible (`NOT_AVAILABLE`). |
| Visual captions | `REAL_OUTPUT_COMPARED` | Existing final-v4 scene copy and timing are accessible in the job/render-plan; numbers and the conditional survive. Face/chart overlap was not observed in the sampled frames. Narration is off. |
| Selective loading | `VERIFIED_DOCS` | Resolver receipts reproduced the prior counts. Each route remains at the same file count; loaded bytes/tokens increase on the changed routes. No savings are claimed. |

## Separate observations

- **Facts/meaning:** KO and EN core copy pairs keep the report/company actor and the possibility/expectation. `밝혀졌다` is left unchanged. Reused SUE-610 c1 rejects hedge removal; the synthetic strong hook remains; c6 is reused as `KEEP` with zero edits. The overcertain “Demand will recover” is rejected.
- **Language/profile:** Machine observations only. The EN pack is draft and uncalibrated; no cross-language calibration or human profile-fit label is claimed.
- **Legibility:** Case 2 has no observed number/unit split or line-edge punctuation defect. Its text-fit receipts pass; mobile source text remains small.
- **Aesthetics/comprehension:** Case 3 improves visible focal-image exposure in this sample. The money/number card does not show a decisive improvement. No aesthetic score offsets facts or meaning.
- **Video:** The accessible render plan contains six scene captions and exact timing; its canonical source script reference points to a missing original worktree, but the embedded scene copy and caption timing are present. The video has no narration audio.

## Artifacts and reruns

- Pixel outputs are under ignored `out/sue-1760/`. Case 2 includes full/mobile PNGs and a randomized A/B contact sheet at `out/sue-1760/blind/pair-af8c45986438/contact-sheet.png`; case 3 includes blind full/mobile A/B images under `out/sue-1760/blind/`. SHA-256s and source/font/profile identifiers are in `results.json`.
- Blind copy and visual pairs are in the requested `C-owner-review.json`; the A/B mapping is separate in `C-key.json`. No human labels are assigned.
- Selective-load input hashes and full per-file before/after hashes/counts are recorded in `results.json`; counts are Unicode characters and offline `tiktoken o200k_base` tokens. Skill-body activation and tool-result text are outside those receipts.
- The two local compositor outputs have matching bundled AES Sans KR font digest `1cb4369a005e1d34a0f1e9069d142a1db2b1f1994263c02a8e740cebb9f19348`; the three face hashes are recorded per case. Their renderer receipts are `GENERATED_COMPOSED_NEEDS_REVIEW`, not approval.

## Validation

- `PYTHONPATH=/tmp/aes-sue1726-pydeps npm test` — PASS (exit 0).

## Completion boundary

Real pixels and resolver runs were compared. Owner aesthetic adoption and SUE-1754 language calibration remain pending. The number card is `NO_PROMOTION`; no general quality claim is made.
