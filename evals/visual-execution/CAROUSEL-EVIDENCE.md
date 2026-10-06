# SUE-1345 carousel execution evidence — 2026-10-06

Base: `5cf7329cf5cc75c5ff67ab945b6255c91cd269e1` (PR #37).
Scope: task-selected recipes, reserved regions, series-to-existing-single-image
binding, frame-local replay, and a review worklist. User Phase 4 is not run here.

## Actual local checks

- `node scripts/test-carousel.mjs`: **49 planning assertions PASS**.
- `node scripts/test-carousel.mjs --render`: **69 total assertions PASS**
  (the same 49 plus 20 real rendering/replay assertions, not 118 independent tests).
- `node --check` on the new core, CLI and test file: PASS.
- Three 1080×1350 PNGs, 390px phone previews, and a 1170px-wide contact sheet.
- Source-derived illustrative bar labels 125건 / 180건 / 240건 preserved.
- Replaying unchanged inputs reused all three frames. Editing the middle
  headline rerendered that frame; the other two image hashes were unchanged.
- An authored PNG plus chart and watermark was rendered; pixels outside the
  PNG's declared slot stayed identical to the corresponding clean frame.
  The source PNG was not rewritten. This is not a licensed-person-photo test.
- Explicit geometry/palette overrides reached the existing executor. Overlong
  Korean text failed actual glyph fit without shrinking or silent truncation.
- Missing source bytes, missing generated art, duplicate/unknown frame/beat,
  reversed dependencies, overlapping/unknown regions, role drift via unknown
  per-frame options, and tampered previous image bytes were rejected or left
  explicitly incomplete. Changing an unselected recipe did not change the
  selected recipe identity.
- The existing single-image executor produced the same first-frame image
  independently; its source code was not modified.

Runtime: Node.js 22.16.0, ImageMagick 7.1.2-1 Q16-HDRI with RSVG delegate,
installed Korean/Latin fonts and Fontconfig. The rsvg-convert executable was
unavailable; its alternate path was not exercised. Font metadata is a local
cache invalidation boundary, not a cross-host byte-identity guarantee.
No new npm package, service, image-model call or publishing step was used.

## Technical pixel inspection

The final contact sheet was inspected: headlines, footer roles, pagination and
mixed content order are stable; exact labels match the illustrative fixture.
This is a sparse technical sample, not a polished production-style reference.
Some chart labels are small at phone scale; full/mobile aesthetic/readability
acceptance must still be evaluated on real content, rather than inferred from
`text_fit` or the existence of a 390px preview.
`review-worklist.json` remains NOT_REVIEWED and is not a visual-review receipt.

## Selected local output identities

Paths below are relative to the transient test output root, not repository files.
The test deliberately corrupts run `a` at the end to test reuse rejection;
run `b` is the intact replay and run `c` is the one-frame revision.
No output binaries or fonts are committed.

| Local case | PNG SHA-256 |
| --- | --- |
| `b/opening/image.png` | `sha256:fe61992de266d767322919a923d770f54ecb92d0790b71d1dd2a798e0c632543` |
| `b/evidence/image.png` | `sha256:ac96feecda1a3a6a23a544d09f7e22626dda61c6143d14bceefbab8c39aeaced` |
| `b/closing/image.png` | `sha256:4fbed88237fa4911361b811213b90c8e469a45be6a66d10db041187d95e53096` |
| `b/contact-sheet.png` | `sha256:cfe4084ed8e7218c84676bc172aaeec98947114cff2f730463390005d7208e9e` |
| `c/evidence/image.png` | `sha256:0ff15020089db4e9b8a749fcfbccd513b6d4a9ba508e2f971f9388c5eb57d9a3` |

## Reuse and limits

Existing `visual-execution-core.mjs`, `svg-tools.mjs`, `chart-renderer.mjs`,
`watermark-core.mjs`, `profile-core.mjs`, profile axis registry and the selected
Instagram/slide-image profiles were fetched through the connector and checked
against their Git blob SHAs. They are unchanged by this work. The original
execution guide was hash-checked before appending the carousel section.
This was a **targeted local source subset, not a full repository checkout**.

Full `npm test`, repository-wide boundary/legacy article job regression,
actual PMC bundle semantics, user photo rights/fidelity, generative art quality,
ChatGPT-native generation/byte handoff and Drive/publisher delivery: **NOT_RUN**.
The previous whole-image mockups' 62%, 3.1× and +212% claims are not input data
or evidence. No empirical success percentage has been established.

CI: **NOT_RUN**, continuing the user's no-CI request; workflow configuration is
unchanged and no workflow is dispatched. Phase 4 and human visual/publication
approval remain separate. Existing SUE-646/647 reviews receive the worklist;
this implementation does not replace them with a new taste oracle.
