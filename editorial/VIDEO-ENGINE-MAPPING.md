# AES video contracts to shorts_gen engine mapping

AES owns source evidence, locked facts and rights, family profile, semantic
beat order, scene/layer meaning, narration and QA requirements. AES validators
enforce contract structure, lifecycle rules, and evidence binding. The
`shorts_gen` engine executes production and runtime QA stages from its version
1.0.0 request and evidence contracts. Runtime audio/alignment measurements
belong to engine QA; AES does not reproduce them. This mapping is an adapter
guide and does not claim that every AES field is already a first-class engine
field.

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

Protected-value and evidence spans bind `source_sha256`, an extraction
artifact `extraction_sha256`, byte offsets, the exact-text `span_sha256`, and a
content-addressed `evidence_ref`. Resolver receipts are keyed by the full
source ID/ref and SHA, span ID, source SHA, extraction SHA, span SHA, byte range,
and exact text. Duplicate source or span IDs are rejected; changing any bound
value makes a prior receipt stale. For repo-local text and Markdown, the
validator reads source bytes and verifies both hashes and the exact byte
slice. External or non-text sources require a trusted extraction resolver;
without a matching receipt, protected values stay unverified and rendered
audio or QA `PASS` is blocked.

Narrated v2 turns also carry `evidence_span_ids`. Each ID must resolve to a
separate byte-verified `source_evidence.sources[].evidence_spans[]` excerpt,
and the canonical spoken turn must exactly equal its ordered cited excerpts.
Scene overlays and narration overlays carry the same evidence citations and
must exactly equal a cited excerpt. This factual coverage is independent of
the optional protected number/date/name/quote list. Unsupported additions
cannot be justified by a broad source reference.

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
| Measured audio duration and post-measurement reconciliation | TTS output duration and `StageResult` evidence | Before rendering, the audio plan may be `planned` with an unconfigured provider and null measurements. After render, engine QA measures duration; record the measurement, chosen reconciliation action, affected scene IDs, and evidence in the AES audio plan. Extend or retime affected scene timing locally, or revise the canonical script within verified evidence; never compress long narration to fit. |
| Caption exact text, protected words, line count, safe zone, measured start/end, alignment evidence | TTS caption artifact plus `qa_repair` `StageResult` | Captions default on with narration, use one or two semantic lines, and preserve protected exact words in the declared safe zone. A planned document may omit measured boundaries. `alignment_status: pass` requires a completed shorts_gen QA `StageResult`, its output evidence ref, the rendered audio ref and SHA-256, and per-segment scene/segment IDs, spoken-text SHA-256, and measured boundaries. AES binds those fields to the plan and verifies IDs, hashes, and duration bounds; the engine QA stage performs ffprobe/ebur128/SRT runtime checks. A self-asserted status or arbitrary URI is not alignment evidence. |
| BGM catalog track → `shorts_gen.bgm.stage.BgmTrack` | `track_id`, `title`, `artist`, `master_rights_owner`, `composition_rights_owner`, `file`, `version`, `sha256`, `license`, `attribution`, `platforms`, `monetization_allowed`, `isrc`, `content_id_status`, `self_claim`, `whitelist`, `mood`, `tempo_bpm`, `energy`, `loop_start_s`, `loop_end_s` | Construct the engine dataclass with exactly these names; its constructor rejects extra keys. Copy identity, ownership, file, hash, license, attribution, platform, monetization, ISRC, Content ID, self-claim, mood, tempo, and energy values unchanged. Convert `loop_points.start_seconds` → `loop_start_s` and `loop_points.end_seconds` → `loop_end_s`. Convert AES whitelist entries `{platform, evidence_ref}` into the engine's `tuple[str, ...]` platform strings; preserve the full original platform/evidence pairs in request provenance because the engine field cannot retain their evidence refs. AES-only `rights_status`, `rights_evidence_ref`, and `vocal` are deliberately omitted from the constructor and retained in AES provenance/QA evidence. No other AES catalog keys are passed through. Unknown owners, license, monetization, platform, Content ID, or self-claim state must not be promoted to safe. |
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
checks. Measured render duration must match the plan within one second; BGM
mode evidence must match the plan and loudness, ducking, and clipping values
must use finite values and their declared units.

The pre-TTS canonical script check is a separate lifecycle gate from rendered
audio QA. A pre-TTS pass verifies canonical script structure and source-bound
text; it does not measure duration or caption alignment. Post-render timing
reconciliation is a separate decision that may adjust affected scene timing
locally. The AES validator checks the engine `StageResult` schema and binds its
alignment evidence to the audio and canonical segment hashes; it does not run
audio measurement or independently certify the physical media file. The
engine's QA stage owns those runtime checks and emits the evidence receipt.

The three cost, rights, and approval gates remain required even if an engine
request omits publication intent. Engine publication/package fields are
execution metadata only; they do not confer AES approval or publication
authority. A local visual or audio defect is repaired at its affected scene
or narration segment and must retain both the old and replacement evidence.

## Versioned style, motion, typography, and critique contracts

The manifest video route also pins each family profile and its additive genre
presets by ID, revision, and SHA-256. Family profiles define visual style,
motion, typography, quality gates, and audio targets; genre presets declare a
base family and scoped overrides. VideoPlan v2 may include a matching
`genre_preset_ref`. The validator checks pin integrity and the planned
render-requirements contract. These plan declarations are not measured render
proof; rendered contrast, margins, loudness, timing, and SFX still require
renderer evidence.

`schemas/video-critique.schema.json` carries frame samples and per-sample
checklist findings (`pass` or `fail`, scene ID, evidence reference) beside a
`shorts_gen` `critique` StageResult-shaped record. Findings cover hook,
readability, hierarchy, motion, information density, palette, interactive
sequence, chart integrity, audio contract, and ending. The evidence reference
must identify the sampled frame or other supporting artifact; a critique result
is not an approval or publication signal.
