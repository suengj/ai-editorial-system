# VQ-V2 Round 1 — Phase 0 baseline

Observed 2026-10-20 KST. This report separates owner findings, recorded technical checks, and this agent's direct review of the actual image bytes. It does not claim new owner approval.

## 1. Signalytics / M1 rejected baseline

- Authority: Linear SUE-1612 records owner `FAIL` on 2026-10-15 (“quality very serious”, unusable); 5/5 cards were not a visual pass. The former automated checks passing did not establish aesthetic quality.
- Frozen originals: `/Volumes/OricoSSD/MacArchive/editorial-m1-pilot-20261015/out-base-r0/`. Copy of the five exact 1080×1350 PNGs: `/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline/m1-before/`. Exact generated source art copies and base manifest/series/profile receipt/brief/review are in `.../baseline/m1-source/`.
- Direct pixel review: all five output PNGs and three generated source images were opened. Source photographs are compositionally relevant and have usable detail. For the cover source, 1122×1402 is near the 1080×1350 output size (1.025× linear scale); the rejected output hides nearly all of that photograph under large opaque cream regions. This makes compositor/art direction the primary cover failure, not missing image quality.
- 02-money: four outline boxes imply a 2×2 matrix without meaningful axes; the directional relationship is too small and secondary. 03/04: the subject photo is a narrow slot; copy is a dense specification list instead of showing the difference in fee direction. 05: long text list with weak hierarchy and no useful diagram. M1 review also records undefined YPS/MSE, inaccurate subscription wording, missing qualification and dropped test detail.
- Taxonomy: `COMPOSITOR` and `ART_DIRECTION` primary; `TYPOGRAPHY` and `SOURCE`/copy evidence secondary; `REVIEW` contributed because early technical checks were mistaken for readiness. `MODEL` is not supported as the primary cause by the source photos or owner assessment. Exact per-frame hashes are in the archived `out-base-r0/manifest.json` and also match the preserved copies.

## 2. Reusable same-series reference

The owner accepted the M1 hybrid direction in SUE-1616 (“혼합 방식으로 가자. 괜찮아…”). We directly opened `/Volumes/OricoSSD/MacArchive/editorial-m1-pilot-20261015/hybrid/final/01-cover.png` and preserved a byte-identical copy in `baseline/m1-source/owner-approved-hybrid-reference-01-cover.png` (SHA-256: `69bdfd9ccdebf6b9bd98b400bd82c50a6c8d04f6e43439095c59099733be32f7`). Limited authority for this M1 cover comparison: the photo remains the main visual; typography sits over a darkened photo area; clear title/subtitle/source hierarchy; little ornamental framing. It does not authorize copying the exact image, copy, or source labels to unrelated work.

## 3. Existing blog / information image

- Existing repository master: `p02_com/assets/visual-masters/articles/ai-ad-creative-review-gates/ai-ad-review-00-overview.png`; exact copy and asset receipt: `baseline/blog-info/`.
- Directly opened at 1122×1402, SHA-256 `99320afcc66b021c907242106e5b78b1f94cb7bb2bbdecc1a3a421456b040082`. It uses strong large headline hierarchy, a relevant hero image, numbered concepts and a sequence; it also has dense multi-panel information and many repeated rounded containers. This is descriptive evidence for an information visual, not a positive Signalytics cover reference or evidence of user preference.
- Classifications: `ART_DIRECTION` (high density/repeated containers) and `TYPOGRAPHY` (small labels at native scale) are review hypotheses. The source-side asset receipt exists, but article factual-source and rights review was not repeated in this baseline task: `NOT_REVIEWED`.

## 4. Existing video

- Source: `/Volumes/OricoSSD/MacArchive/shorts-gen-renders/final-v4-sue1646-20261017/daily-water-korean-001/revision-1/9x16/video.mp4`, 50 seconds, 1080×1920, 30fps, H.264; SHA-256 `04460cbb0d697b29c71c30176903f3e219dbc1b8cf53fcfd69492fed555b173a`.
- Existing render manifest and QA receipt were reused from `/private/tmp/visual-quality-20261019-r1/evidence/sue-1691/before/` and copied under `baseline/video-frames/`; the archived QA receipt records technical `passed`. This does not establish aesthetic acceptance.
- Extracted and directly opened 1s / 28s / 48s frames are in `baseline/video-frames/`; hashes match the earlier evidence frame bytes. Still review: the opening's large opaque title and subtitle boxes occupy picture area; the explanation's bar graphic is small relative to dark negative space; the ending subtitle crosses the subject's torso. `COMPOSITOR` / `ART_DIRECTION` are still-frame observations. Motion, transitions, audio quality, temporal continuity and current delivery acceptance: `NOT_REVIEWED` here.

## 5. Design criteria and hypotheses for Phase 1

Use the accepted M1 hybrid card only as a bounded same-series reference. Keep the photo visible and meaningful; establish headline, supporting sentence and source/page hierarchy; avoid empty 2×2 box grammar. Fix identical original photo bytes, copy, source label, canvas, brand profile, palette and font in A and B. The test is whether content-driven CSS flow makes the Korean title and support text reflow with stronger image use and balance at both 1080×1350 and 390px width, while preserving exact strings and source attribution. No second/third type until the first card shows clear actual-pixel improvement.

## Evidence index

- M1 source manifest / base manifest: `/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline/m1-source/base-manifest.json`
- Owner review text: `/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline/m1-source/owner-review-source.md`
- Baseline PNG copies and all source hashes: `/Volumes/OricoSSD/MacArchive/vq-v2-round1/phase0/baseline/`
- Existing MP4 and inherited receipts: paths above; the 24MB MP4 was not duplicated.
