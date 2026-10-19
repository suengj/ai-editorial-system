# VISUAL-QUALITY-20261019-R1 execution slice

- Objective: add the AES-owned versioned candidate-pair typography contract, then consume it in `shorts_gen` without a duplicate preference database; verify Studio projection and render evidence incrementally.
- Ownership: AES owns pair and font binary metadata; shorts_gen owns role resolution and actual Pillow/ASS/FFmpeg use; editorial-studio owns request projection only.
- Source of truth: `editorial/font-preferences.v1.json`; `entry-manifest.json` registers it. Existing `typography-core.mjs` wrapping/contrast behavior remains the renderer helper.
- Scope sequence: official binary/license/weight/cmap inventory → contract fixtures → PR #21 adapter → Studio requested/resolved/applied projection → static Styleframe and local video slice → independent actual-output review.
- Risks: variable-font axes may not be supported by FFmpeg/Pillow identically; candidate pairs are not final defaults; bundled font size and scene cache invalidation; archived source photo is not available outside the thumbnail crop.
- Validation: focused Node contract tests, shorts_gen focused tests and real text renders using each resolved font, Studio contract tests. No live provider, Drive write, deploy, post, or user acceptance is implied.
- Rollback: revert the candidate contract and consumer adapters; preserve existing AES Sans KR path and existing produced media.
- No parallel writers on shared files. PR #21 remains draft until AES contract SHA is pinned and actual render/negative tests are complete.
