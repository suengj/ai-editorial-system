# Video Plan Contract (SUE-1309 / AES-VIDEO-PLAN)

## Status and authority

This is an **editorial planning contract and fixture set**, not a video
runtime. It defines machine-checkable records for a later implementation. No
video, TTS, BGM mix, upload, or FFmpeg render is performed by this work.

AES owns the verified meaning, canonical spoken script, audience adaptation,
scene intent, captions, and edit-plan decisions. `VideoPlan` carries that
editorial plan and references its package, RenderSpec, approved assets, and
audio records. A future `shorts_gen` adapter may execute an approved plan and
return renderer evidence. It owns media execution mechanics such as FFmpeg,
frame assembly, encoding, and output verification; it does not become the
authority for claims or rewrite the script. The adapter boundary is a proposed
handoff, not an integration that exists today.

## Evidence audit

### AES audio and roadmap (SUE-566 / SUE-456)

SUE-566 already defines audience-aware `audio/monologue`, `audio/dialogue`,
and `audio/timed-narration` profiles, a provider-neutral spoken script,
pronunciation and delivery intent, segments, timing, script-L1 review, render
lineage, QA, attempts, and cost. Its existing examples are
`schemas/examples/audio-plan-*.example.json`; `scripts/test-audio-plan.mjs`
contains explicit allow and deny cases. The audio contract says this is a
planning/script path and that TTS rendering has not been exercised end to end.
Those examples and validator checks are fixtures and contract execution, not
evidence that an audio file was generated or heard.

SUE-456 (`docs/architecture/AUDIO-VIDEO-ROADMAP.md`) records audio as deferred
and video as **reject for now**, with video reconsidered only after audio has
working provenance (AV-4) and a specific argument is better shown moving than
still (AV-5). This SUE-1309 work adds a bounded planning contract; it does not
claim those roadmap gates have been met or silently change the roadmap's
decision.

### `shorts_gen` audit (read-only sibling checkout)

The sibling README and plan distinguish documentation from implementation:
the v1 media stages are planned; the v1 runtime is not implemented; the active
work reported by `plan/NOW.md` is P2 intake. The current v1 `src/` contains
domain models, transitions, codec, and CLI, while the current tests cover
domain round trips, transitions, and an architecture guard. They do not call
the legacy media renderer.

The frozen v0 tree contains actual rendering code: the notebooks include
calls to `VideoEditor.create_titled_video`, optional dynamic subtitles, and
`write_videofile(..., fps=30, codec="libx264", audio_codec="aac")`; the
legacy `func_videoEdit.py` contains MoviePy clip assembly, subtitle/audio
mixing, and an FFmpeg re-encode helper. A checked-in img2img notebook has
saved output for a resumed job, text and embedding API calls, downloaded
image assets, music-match results, and MoviePy reporting both `Writing video
...mp4` and `video ready ...mp4` for a legacy output. This is persisted
evidence that at least one v0 video-render run completed. The cell's
`execution_count` is null, so its run ordinal is not preserved, and the output
file is not independently read back here. The same saved output also records
a YouTube download error (`expected string or bytes-like object, got 'float'`)
before later processing continued. This is evidence of a partial historical
run, not proof of a clean end-to-end publish. An older notebook also has a
saved image-download output. The legacy code is frozen and must not be treated
as a tested v1 implementation.

One concrete untested legacy hazard is in
`shorts_gen/legacy/v0/src/func_videoEdit.py::match_video_to_length`: its outer loop relies
on increasing `current_duration`, but a non-empty list of zero-duration clips
cannot increase it; the later `not valid_clips` escape cannot fire because the
list was already checked as non-empty. That input can loop forever. This is a
static code finding, not a reproduced runtime failure. No tests in the current
v1 test tree cover it. Legacy source and notebook records were inspected
read-only; they were not executed for this task.

## Existing / missing / reuse matrix

| Concern | Existing AES / sibling record | SUE-1309 treatment |
|---|---|---|
| Verified editorial meaning and audience | EditorialPackage, article/claim lineage, audience profiles | Reuse EditorialPackage by `$ref`; AES retains semantic authority |
| Visual composition | RenderSpec and visual profiles | Reuse RenderSpec by `$ref`; keep crop-safe zone on each timed scene |
| Audio script and pronunciation | AudioPlan, three audio profiles, audience-aware glossary and delivery | Reuse AudioPlan by `$ref`; NarrationScript extends its audience, synthetic-role and pronunciation definitions |
| Video duration and scene timeline | No current AES video plan schema; storyboard document is prose | Add VideoPlan with short/long format, target duration, scene order, timing, text and asset refs |
| Captions and watermark | Caption/display rules exist in visual/editorial guidance; SUE-1303 defines the watermark in `schemas/render-spec.schema.json#/$defs/watermark` and provides `schemas/examples/watermark-suengj-com-sample.example.json` | Add style and watermark **references only**; `watermark_ref` identifies the RenderSpec watermark contract, and the sample gives a concrete default-OFF watermark configuration |
| TTS provider capabilities/cost/timing | Audio render fields record lineage, but no provider account entitlement is established | Add provider-neutral adapter record; support stays unknown until evidenced, cost may be unknown, and returned timing granularity is explicit |
| BGM catalog and rights | `shorts_gen` has a v1 BGM design direction (B-B), legacy music search code, but no v1 media runtime | Add a minimal catalog record with file/source/license and audio properties; OFF is a valid state |
| Video rendering / upload | Legacy v0 code only; v1 runtime absent | Out of scope. Future `shorts_gen` executes; no FFmpeg or upload work here |

## Schema delta and reuse

`schemas/video-plan.schema.json` references the existing full
`render-spec.schema.json`, `editorial-package.schema.json`, and
`audio-plan.schema.json` for render spec, package, and audio records.
`schemas/narration-script.schema.json` references the existing audio schema's
`audience`, `speaker_role`, and `pronunciation_entry` definitions. The new
`scripts/lib/video-plan-core.mjs` bundles those source schemas at validation
time because `json-schema-lite` supports local `$defs` references only; the
source schemas remain unchanged and authoritative.

The additive fields are:

- **VideoPlan:** short or long format; aspect ratio, size, fps, target length;
  ordered scenes with timing, visible text, asset ref, and crop-safe zone;
  language/surface, caption style, watermark ref to
  `schemas/render-spec.schema.json#/$defs/watermark`, audio refs, output location,
  and audio reconciliation state.
- **NarrationScript:** speaker turns/roles, claim IDs and source refs, rate,
  pauses, intonation, audience-aware pronunciation list, and an explicit
  `draft_correct → pronunciation_plan → TTS` order. Only verified source
  claims may be used; quotation claims must link to verified source claims;
  dialogue roles use the reused `synthetic_non_source` disclosure.
- **TTS contract:** provider/voice/locale, support state and evidence, cost
  basis, and whether timing metadata is returned and at what granularity.
  `unknown` is a valid, honest value; no account or feature is presumed.
- **BGM catalog:** file ref, license, source, mood, tempo, energy, vocal flag,
  loop points, duration, and narration ducking. `status: off` requires an empty
  track list.

The JSON Schema subset does not express every cross-field invariant. The
validator therefore also checks short durations are 6/15/30, long durations
are explicit values above 30 seconds, scene IDs/timing/order fit the target,
and measured narration longer than the target blocks the plan. A longer
measured narration requires changing the plan duration/timeline or revising
the script; audio is never time-compressed to meet six seconds. `audio_refs`
reuse the SUE-566 record shape but do not imply that audio exists yet.

## Phased follow-up scope

These are separate future gates, not work authorized by this contract:

1. **Silent 15s, assets only:** create and review a 15-second, 9:16 plan;
   assemble approved still assets with captions/watermark refs; no TTS, BGM,
   upload, or generative motion. Verify the rendered duration, crop safety,
   caption placement, and asset lineage in the execution repository.
2. **TTS:** after the script and pronunciation plan pass review, select and
   verify an actual provider/voice/locale configuration and account support;
   record cost and returned timings. Reconcile scene timing to measured audio.
3. **BGM:** only after source/license review, enable catalog selection and
   validate loop and narration-ducking behavior. BGM remains optional.
4. **Variants:** derive 6/15/30-second and long versions from approved
   semantic beats, with duration-specific script and visual edits. Do not
   squeeze a long script into a short target.

## Fixtures and commands

`schemas/examples/video/allow/` contains Korean explanatory narration for a
15-second 9:16 short with BGM OFF, schema-valid 6- and 30-second plans, a
dialogue script, and provider-neutral TTS metadata. Deny fixtures cover an
unverified fabricated quote, 15 seconds of measured narration forced into a
6-second plan, and a selected BGM track with no license.

Run `npm run validate:video` and `npm run test:video`. These validate contract
records only; they do not render media.
