# AES video contracts to shorts_gen engine mapping

AES owns the source evidence, locked facts and rights, family profile, semantic
beat order, scene/layer meaning, narration and QA requirements. The
`shorts_gen` engine executes production stages from its version 1.0.0 request
and evidence contracts. This mapping is an adapter guide; it does not claim
that every AES field is already a first-class engine field.

## Versioning

Existing VideoPlan, NarrationScript, AudioPlan, and BGM 1.0.0 schemas and
fixtures remain valid. New source-evidence video work opts into the explicit
2.0.0 schemas. There is no implicit migration of a 1.0.0 article/package plan;
an adapter must preserve its original article/package lineage when it creates
a separate 2.0.0 video plan.

## Request and profile identity

| AES contract | shorts_gen field | Mapping rule |
|---|---|---|
| `video-plan-v2.profile_ref.profile_id` | `request.aes.profile_id` | Preserve the exact ID, including the `video/` prefix. |
| `video-plan-v2.profile_ref.sha256` | `request.aes.sha` | Pass the full lowercase SHA-256 digest unchanged. |
| Profile `revision` and `manifest_ref` | `request.aes.manifest_ref`; `request.provenance` | Keep the revision and manifest identity in provenance because `AESReference` has no separate revision field. The hash is the content pin. |
| `plan_id` and source-envelope identity | `job_id`, `content_id`, `request.provenance` | These are production identities. They do not create an article ID, claim, author, or quotation. |

## Evidence, rights, and scenes

Protected-value spans bind `source_sha256`, an extraction artifact
`extraction_sha256`, byte offsets, the exact-text `span_sha256`, and a
content-addressed `evidence_ref`. For repo-local text and Markdown, the
validator reads the source bytes and verifies both hashes and the exact byte
slice. External or non-text sources require a trusted extraction resolver;
without resolved bytes, protected values stay unverified and rendered audio or
QA `PASS` is blocked.

| AES contract | shorts_gen field | Mapping rule |
|---|---|---|
| `source_evidence.sources[]` | `request.source_refs[]` | Map `source_ref`, `kind`, and `sha256` to `SourceReference`. Retain the source ID and envelope version in provenance. |
| `source_evidence.sources[].rights` | `request.rights[]` | Map source reference, license, attribution, commercial use, and modification permission to `RightsRecord`. Unknown values stay unknown; the adapter must block execution when the engine requires an explicit right. |
| Silent/source-only plan | `video_family=educational_silent`, `script_ref=null`, `scenes[]` | A source-only scene is valid without an editorial package. Preserve source-only identity and source refs in provenance; do not manufacture article or claim records. The current engine requires nonempty `Scene.text`; an AES scene with no on-screen text cannot be sent directly until the engine accepts empty scene text. Do not insert a placeholder. |
| `target_duration_seconds`, `aspect_ratio`, `fps` | `duration_s`, `aspect`, render receipt fields | Convert duration without rounding away the AES target. The current engine accepts only 16:9 and 9:16; AES 1:1 and 4:5 plans remain valid in AES but need an engine/schema extension before execution. `RenderReceipt` records measured duration, frame rate, dimensions, codec, and audio presence. |
| `scene_id`, `beat_id`, timing, `source_only`, on-screen text | `scenes[]` plus `provenance` | The current `Scene` carries required nonempty text and optional duration, image ref, and background. Preserve stable IDs, exact timings, and source lineage in a versioned provenance payload. |
| Layer `source_ref`, `rights_ref`, `z`, timing, fit/crop/focal point, safe zone, motion intention | `scenes[].image_ref`, `output_profile`, `provenance` | The engine request has no first-class semantic layer model. Keep layer metadata in the adapter payload. AES uses normalized fractions and named intents; it does not send absolute pixel geometry or FFmpeg instructions. |
| AES source rights owner, platform, status, and evidence | `request.rights[]` plus `request.provenance` | Engine `RightsRecord` cannot represent all AES rights fields. Preserve the complete AES record in provenance and enforce its gate before execution; an engine rights record alone is not the AES rights proof. |
| Educational / interactive presentation semantics | `video_family`, `output_profile`, `provenance` | Map `educational-summary` with silent audio to `educational_silent`; map it with narration to `narrated_mixed`. Map `interactive-information` to `interactive_ab` and `narrated-explainer` to `narrated_mixed`. Keep the exact AES profile ID, narration mode, presentation mode, and educational order in provenance because the engine enum is coarser. |

## Narration, captions, and BGM

| AES contract | shorts_gen field | Mapping rule |
|---|---|---|
| Narration script reference and canonical spoken turns | `script_ref`, scene text passed to `tts_captions` | Preserve AES `beat_id` and `scene_id` beside each text span. The engine's current TTS stage joins scene text; it does not yet consume the full AES narration-script structure. |
| Pre-TTS canonical script check | `script` / `tts_captions` stage status | Do not start TTS until the AES check passes. A stage `DONE` alone is not proof of that editorial gate. |
| Measured audio duration and post-measurement reconciliation | TTS output duration and `StageResult` evidence | Record the measured duration, chosen reconciliation action, affected scene IDs, and evidence in the AES audio plan. Extend or retime scene timing locally; never compress long narration to fit. |
| Caption exact text, protected words, line count, safe zone, alignment | TTS caption artifact plus AES audio-plan/QA evidence | The engine currently creates SRT from scene text and proportional scene weights. The adapter must retain AES protected-word and alignment checks and report failures. |
| BGM track identity and file hash | `BgmTrack.track_id`, `file`, `version`, `sha256` | These identity fields align with the engine catalog. Convert AES `loop_points.start_seconds` and `loop_points.end_seconds` to engine `loop_start_s` and `loop_end_s`. Map each AES whitelist platform/evidence pair into the engine string list while retaining the pair in provenance. AES additionally carries explicit rights status/evidence and vocal state. Unknown owners, license, monetization, platform, Content ID, or self-claim state must not be promoted to safe. |
| BGM modes and narration ducking | `bgm` stage and match request | Preserve `off`, `owner_library`, `licensed_library`, `selected_track`, or `auto_match`. An automatic match is eligible only after explicit platform and monetization rights pass. Ducking defaults on with narration. |

For automatic matching, only explicit `clear`, `cleared`, `no_claim`, or
`not_registered` Content ID states with `self_claim=false` are eligible. An
active claim or unknown status blocks selection. AES whitelist entries carry a
platform and evidence reference, but they do not override an active claim or
unknown status. Account-specific whitelist interpretation remains an external
approval decision; AES does not infer account identity from the entry.

## QA, lineage, and authority boundaries

`video-qa.schema.json` records factual, rights, visual, audio, caption, BGM,
technical, provider, cost, and approval evidence. The engine's
`StageResult`, `ArtifactManifest`, and `RenderReceipt` provide execution status,
input/output digests, and render measurements, but they do not express all of
those editorial checks. Keep the AES QA result and its evidence alongside the
engine receipts; a generic `DONE` stage must not be translated into AES `PASS`.
Caption coverage must include every spoken scene, and each audio span hash is
checked against the exact canonical narration text. A catalog carries its
`video_plan_ref`, allowing the validator to apply the plan's narration-ducking
requirement even when the catalog is validated by itself.
Video QA also records `checks.source_evidence_resolution`; a `PASS` requires
that check and its evidence, in addition to the factual, rights, and approval
checks.

The three cost, rights, and approval gates remain required even if an engine
request omits publication intent. Engine publication/package fields are
execution metadata only; they do not confer AES approval or publication
authority. A local visual or audio defect is repaired at its affected scene
or narration segment and must retain both the old and replacement evidence.
