# Visual Quality V2 — Round 3: card references and art-direction redesign

Date: 2026-10-20 (Asia/Seoul)

## 1. Current State

- Ten local candidates are collected as individual card images. The candidate board contains no webpage screenshots, multi-card mockups, or social-feed frames. Images remain local review material; redistribution is not authorized.
- The five highest rubric totals are manager/agent shortlist candidates only. No reference has Owner authority or approval; selection remains `HUMAN_REQUIRED`.
- One free HTML/CSS + Playwright redesign produced an M1 cover and a 5.0-second, 9:16 water opening. Both are local PoC artifacts; Owner aesthetic review remains pending.
- The Round 3 scripts and this report are in the existing PR #57 branch. The new Codex Sol low review and PR status are recorded after the §10 report content below is finalized.

## 2. Before vs After

**M1 cover — same source image and copy.** Round 1 B places the photo in the upper part of the canvas, then reserves most of the lower area for a cream text panel. Round 3 uses the original parking photo edge-to-edge and moves the same two-line headline and unchanged body into the photo with strong white/yellow contrast. The title, body, series label, source label, and pagination are preserved.

**Water opening — same source photo, on-screen copy, and chart facts.** The Round 2 FFmpeg opening shows dark caption boxes over the photo, including an incomplete second-scene reveal in the inspected sample, and leaves a large empty lower field. Round 3 crops only the source image's blank tail, uses the photo across the full frame, and lays out the original headline plus the chart's exact 19–30 age band, total-water label, 2.7L/3.7L values, sex labels, and reference-value caveat in a clear text hierarchy. No new facts were added.

Reference traits applied as an experiment: large question/number typography and strong contrast from R3-06 (Scienceall), data-first type scale from R3-07 (K-Club), and one-message emphasis with open space from R3-03 (FSC). These are extracted traits, not copied layouts, marks, characters, or art. The shortlist is not a selected reference.

Comparison boards: `/Volumes/OricoSSD/MacArchive/vq-v2-round3/art-direction-poc/cover-round1b-vs-round3.png` and `water-opening-round2-vs-round3.png`.

## 3. Root Cause

`ART_DIRECTION`. The same photos, text, and facts produce a stronger result when photo occupancy, type scale, contrast, and information order change. This experiment does not identify the renderer or image model as the cause, and it does not change either renderer.

## 4. Quality Assessment (Technical vs Aesthetic)

**Technical:** Local rendered cover is 1080×1350; the video is H.264, 1080×1920, 30 fps, 5.000 seconds. Source and derivative hashes are recorded in `receipt.json`; copied source bytes were retained. Copy/facts are recorded and checked. Candidate image dimensions, URLs, original image hashes, rubric ratings, and score order are in `candidate-receipt-v2.json`. The candidate board and final output frames were opened and inspected directly. Technical checks do not establish aesthetic acceptance.

**Aesthetic:** Manager inspection finds a clear improvement over Round 1 B for the cover and over the Round 2 opening for the sampled water frames: more of the actual photo is visible, the main message reads first, and the lower canvas carries deliberate content. The second scene retains its data context and caveat. Owner judgment remains `HUMAN_REQUIRED`; no `OWNER_ACCEPTED` status is inferred.

## 5. Cost & Performance

- Round 3 provider calls: 0; new paid spend: $0.00.
- Round 2 cumulative estimate: $0.012790 of the combined USD 2.00 cap. Round 3 does not increase it.
- Playwright rendered the cover and 150 opening frames in 13.9 seconds on this workstation; FFmpeg assembled a silent 5-second H.264 preview. CPU/RAM were not measured.

## 6. Implementation

- Repeatable candidate-board builder: `examples/vq-v2-round3/build_reference_board.py`.
- Repeatable local cover/video renderer: `examples/vq-v2-round3/render_art_direction_poc.py`.
- Candidate images, card-only boards, score receipt, original input assets, rendered PNG/MP4, frame samples, and hashes: `/Volumes/OricoSSD/MacArchive/vq-v2-round3/`.
- No paid image generation, publishing, deployment, operational default change, or SUE-1639 edit.

## 7. Decision

**KEEP** the art-direction hypothesis as a local, isolated PoC for review. The comparison is materially stronger in the inspected samples. Do not promote it to a renderer default or apply its style outside this experiment without Owner selection and review. Broader video-renderer adoption remains unverified.

## 8. HUMAN_REQUIRED

- Owner selects zero or one of the top-five candidate references. No choice is presumed.
- Owner reviews the Round 3 M1 cover and water opening for aesthetic acceptance.
- Production promotion remains outside this task.

## Evidence

- Ten candidates and source URLs/traits: `candidate-receipt-v2.json`; card-only board: `reference-candidates-board-v2.png`; top-five board: `reference-top5-board-v2.png`.
- M1 comparison: `cover-round1b-vs-round3.png`.
- Water frame comparison: `water-opening-round2-vs-round3.png`.
- Final PoC outputs and input/output hashes: `receipt.json`, `m1-cover-r3-1080x1350.png`, `water-opening-r3-5s.mp4`.
