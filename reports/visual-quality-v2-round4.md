# Visual Quality V2 — Round 4: R3 direction grammar

Date: 2026-10-20 (Asia/Seoul)

## 1. Current State

- Owner direction feedback (2026-10-20, verbatim): **"두번째꺼가 '훨씬' 낫네"**. Classification: `OWNER_DIRECTION_PREFERRED`. It records direction preference and is not final aesthetic approval or `OWNER_ACCEPTED`.
- A reusable, job-scoped opt-in HTML/CSS grammar is implemented inside AES. Existing compositor, registered profiles, and defaults are unchanged.
- Five M1 cards and the complete 27.5-second 9:16 water video are rendered locally. No publication or deployment occurred.
- PR #57 was already squash-merged in Round 3 (`2f1f00c76779d8c3405c51915fed8679b6026303`); no status repair was needed. PR #58 was squash-merged after Codex Sol low PASS on 2026-10-20 07:13 UTC as `4e4883aa3beb1bafb4821369d2f0b1a9fc71dfd7`.

## 2. Before vs After

**M1 cards.** The cover now uses the original driveway photo edge-to-edge with top/bottom scrims, large white type, a yellow highlight, and a protected series label with local shadow. The money card uses deterministic, unboxed diagram text and draws only the source-declared relationship. JustPark and YourParkingSpace use their original generated photos as full-bleed backgrounds with open factual rows. Opportunity uses deterministic parking geometry and keeps the original experiment wording. All five preserve the frozen frame text, source notes, and facts.

Round 1 B comparison images exist for cover, money, and JustPark and are used directly. Round 1 B did not render YourParkingSpace or opportunity. Those two rows use the archived AES source outputs and are labeled as such; they are not represented as B renders.

**Water video.** The before/after contact sheet samples 0.5, 2.7, 5.7, 8.8, 12.8, 16.9, 22.4, and 27.1 seconds from v56 and Round 4. The new version applies full-frame photography, open timed captions, and one highlighted word. The fact scene displays `총수분 참고값`, `19–30세`, `2.7L`, `여성`, `3.7L`, `남성`, and `개인별 목표가 아닌 참고값` over a photo; its support text is at least 44 CSS px on the 1080px frame. The image portion of v56 scene 4 was cropped from its preserved source asset to omit the embedded cream card; source bytes are unchanged.

## 3. Root Cause

`ART_DIRECTION`. Round 3 identified the preferred visual direction. This round made it reusable across cover, fact, flow, and list forms and applied it to all M1 cards and the full water short. The renderer remains an opt-in local adapter.

## 4. Quality Assessment (Technical vs Aesthetic)

**Technical:** All five cards rendered at 1080×1350 and 390×488. Exact source strings were checked. Browser overflow/clipping is false for every card. Every source string's actual occurrence count matches the frozen source count, including the single opportunity CTA; minimum visible mobile type is 16 CSS px. The video is H.264 1080×1920, 30fps, 27.500s, 825 frames, with eight v56 caption pages. Every caption line is reconstructed from the v56 plan's source word strings. All 825 frame states ran computed bounds, clipping, caption/support overlap, and font-floor checks: caption minimum 84 CSS px and visible support-label minimum 56 CSS px (44px floor), across 213 fact-scene frames. The exact source fact strings were checked in their respective DOM elements. The AAC audio track is bitstream-identical to v56. FFprobe and ebur128 passed: integrated loudness −14.3 LUFS, LRA 1.8 LU, true peak −1.7 dBFS. Final video SHA-256: `20ef0fe8dcf4800dd37e3223098c39b0af92df9e91a5208a89b9e7c19e89bc40`.

**Aesthetic:** Direct inspection of the five-card comparison, the actual 390px cards, the eight-frame before/after sheet, and individual data/food frames finds the Round 3 direction carried through consistently. This is an implementation review, not Owner's final aesthetic acceptance. `OWNER_ACCEPTED` remains false/unestablished.

## 5. Cost & Performance

- Round 4 provider calls: 0; paid spend: **USD 0.00**.
- Cumulative Round 2–4 estimate remains **USD 0.012790 / USD 2.00**.
- Final Playwright run rendered and checked 825 video frames in 74.08s; Python process CPU was 4.69s user + 1.08s system, peak RSS 175 MB. FFmpeg assembled the video and reused v56 AAC without re-encoding.

## 6. Implementation

- Opt-in tokens and cover/fact/flow/list/video grammar: `examples/vq-v2-round4/art-direction.css`.
- Repeatable offline renderer and focused browser checks: `examples/vq-v2-round4/render_round4.py`.
- Usage, limits, and comparison provenance: `examples/vq-v2-round4/README.md`.
- Design and rollback boundary: `docs/architecture/VQ-V2-R4.md`.
- Render receipt, original/derived inputs, five card pairs and mobile captures, 825 frames, video, and before/after contact sheets: `/Volumes/OricoSSD/MacArchive/vq-v2-round4-final4/`.
- The two Round 1 B gaps are explicit; no unsupported comparison is claimed.

## 7. Decision

**KEEP** the R3 grammar as an isolated, opt-in AES example. Do not promote it to a registered style or compositor default. PR #58 merged after Codex Sol low PASS.

## 8. HUMAN_REQUIRED

- Owner final aesthetic review of all five M1 outputs and the full water short; this round's direction preference does not count as acceptance.
- Any production/default promotion, publication, or deployment remains outside this work.
