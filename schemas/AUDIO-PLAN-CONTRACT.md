# Audio plan contract (AES-V2.8 / SUE-566)

An **audio plan** is the compiled, machine-checkable pre-TTS record for one
spoken artifact. It exists so a bad audio result is routable to the layer that
produced it — audience, artifact profile, reference selection, script, or
render — instead of triggering a reroll nobody can trace back to a rule
(`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §5: `spoken_script ·
dialogue_structure · pronunciation · pacing · delivery · TTS render`).

Machine schema: [`audio-plan.schema.json`](audio-plan.schema.json). Validator:
`scripts/validate-audio-plan.mjs` / `scripts/lib/audio-plan-core.mjs`.
Fixtures: `scripts/test-audio-plan.mjs`,
`schemas/examples/audio-plan-*.example.json`. This contract deliberately
mirrors [`VISUAL-JOB-CONTRACT.md`](VISUAL-JOB-CONTRACT.md)'s lineage and gate
shape rather than inventing a parallel one for the sibling modality.

Editorial authority for every rule this contract encodes remains
[`../editorial/AUDIO-SCRIPT.md`](../editorial/AUDIO-SCRIPT.md). This document
does not restate that reasoning; it says which of it is now machine-checked
and how.

## Status: planning path built, rendering not yet exercised

Audio is **deferred from the SUE-570 pilot**
(`docs/architecture/AUDIO-VIDEO-ROADMAP.md` "Audio — defer"). What this
package certifies is the plan → canonical spoken script → script L1 review
path. `render`, `qa` (rendered-audio QA), and `cost` are real, required
fields — because skipping them must stay visible — but no artifact has been
rendered and certified end to end against them yet. Do not read a passing
`validate-audio-plan.mjs` run as evidence that any audio has actually been
heard and approved.

## The required path

```text
Editorial/Knowledge Package + Audience
+ audio artifact profile (editorial/profiles/artifact/audio-*.json)
+ selected audio reference traits (editorial/profiles/reference/audio.json)
        ↓
audio plan  (this contract)
        ↓
canonical spoken script                  — spoken_script.narration_text
        ↓
L1 spoken-naturalness review              — script_l1
        ↓
pronunciation / delivery plan             — pronunciation[], delivery_intent
        ↓
TTS / provider adapter                    — render (lineage only)
        ↓
rendered-audio QA                         — qa
        ↓
feedback routing
```

Each arrow is a required field on the plan, not a step a caller is trusted to
have performed off the record.

## Article prose is never the spoken script — the default failure this exists to prevent

`recompilation` records that the article was recompiled for listening
(`editorial/AUDIO-SCRIPT.md` §1), not read aloud as-is:

```json
"recompilation": {
  "performed": true,
  "identical_to_source_prose": false,
  "structural_changes": ["..."]
}
```

`identical_to_source_prose: true` (or `performed: false`) FAILS. As a second,
structural line of defence, the validator also rejects `narration_text` that
still carries article-only conventions — a markdown heading or an inline
citation marker (`[1]`, `[^1]`) — because those are never spoken conventions
(`editorial/AUDIO-SCRIPT.md` §1, §2). Two independent signals catch the same
failure so it cannot pass by only satisfying one of them.

## Three separate things, not one blob

`editorial/AUDIO-SCRIPT.md` §2 and §12 already draw this line; the schema
enforces it structurally:

```text
spoken_script.narration_text   — clean spoken text only, the SSOT
delivery_intent                — provider-neutral performance intent (register, pace, cues)
render                         — provider/model/version/voice lineage only
```

`narration_text` must never contain SSML-like tags, bracketed stage
directions (`[pause]`, `[whispers]`), or a `voice:`/`voice=` control string —
the validator scans for these patterns and FAILS a plan that leaks them
(`ARTICLE_PROSE_UNCOMPILED` / `DELIVERY_MARKUP_LEAK`). `delivery_intent` is a
compact, augmented intent (`editorial/AUDIO-SCRIPT.md` §12, §18) — it is
never SSML and never invents a persona the register/audience did not already
imply. `render` never appears inside `narration_text` or `delivery_intent`;
it is lineage, checked the same way `visual-job`'s `renderer` field is kept
out of `compiled_prompt`.

## Two QA passes, kept apart

`editorial/AUDIO-SCRIPT.md` §20 names two passes that certify different
things; a correct transcript certifies neither pronunciation nor performance:

| Field | What it certifies | Runs |
|---|---|---|
| `script_l1` | Spoken-naturalness / listening-structure review of the text | Before any render is attempted |
| `qa` | Pronunciation, pacing, continuity, performance, and directive-leak inspection of the actual rendered audio | After a render exists |

They are separate schema objects with separate `enum` outcomes. A plan cannot
satisfy the render gate (below) by pointing at `qa`, and `qa.performed: true`
with no `render` recorded FAILS (`QA_BEFORE_RENDER`) — rendered-audio QA
cannot certify a render that never happened.

## The gate: cheap before expensive

`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §9: "cheap semantic
preflight before expensive rendering. Script L1 before TTS." The validator
enforces this directly: whenever `status` is `rendering`, `rendered`,
`qa_pass`, `qa_fail`, or `accepted`, `script_l1.performed` must be `true` and
`script_l1.outcome` must be `pass`, and `render` must not be `null`
(`RENDER_BEFORE_SCRIPT_L1`). A plan can sit at `script_l1_fail` indefinitely —
that routes back to planning, not to rendering.

`attempts` must not exceed `max_attempts` (`ATTEMPTS_EXCEEDED`), so a bad
direction is a bounded reroll, never an unbounded one. `cost` records
`renders_attempted`, `renders_accepted`, and `cost_per_accepted_artifact` —
the tracked figure is cost **per accepted artifact**, not raw render count
(§9).

## Segment identity and beat linkage

`segments[]` carries a stable `segment_id` and a hash of its own narration
span (`editorial/AUDIO-SCRIPT.md` §17), so a local render defect is repaired
by regenerating one segment with its `previous_context`/`next_context`, not
the whole track (§21 "local audio defect"). For `audio/timed-narration`,
every segment must additionally carry a `beat_id` resolving to the shared
argument-beat graph (`editorial/VISUAL-STORY-COMPILATION.md` §3;
`editorial/VIDEO-STORYBOARD.md` §2) — the validator FAILS a timed-narration
segment with no `beat_id` (`TIMED_MISSING_BEAT`), and FAILS a
`timing.rendering_mode` other than `"timed"` for that profile
(`TIMED_MODE_MISMATCH`).

## Dialogue: knowledge asymmetry and the persona boundary

`audio/dialogue` plans require a `dialogue` block. Two checks are structural,
not advisory:

1. **Knowledge asymmetry.** `dialogue.speaker_roles` must list at least two
   roles with distinct `knowledge_position` values. A plan where every role
   already knows everything being said — the alternating-voices failure named
   in `editorial/profiles/artifact/audio-dialogue.json` — FAILS
   (`DIALOGUE_NO_ASYMMETRY`).
2. **Persona boundary.** Every `speaker_role.persona_disclosure` must equal
   `"synthetic_non_source"` — the schema `enum` accepts no other value, so a
   role presented as a real expert, witness, or interview subject fails
   **schema** validation, not merely a downstream editorial check
   (`editorial/AUDIO-SCRIPT.md` §15; `editorial/constitution.md` §8;
   `editorial/RIGHTS-AND-PROVENANCE.md` §4).

A segment's `speaker` must resolve to a declared `speaker_roles[].role_id`
(`DIALOGUE_UNKNOWN_SPEAKER`).

## Lineage fields

| Field | Answers |
|---|---|
| `article_ref` / `package_ref` | Which article or package this audio serves (exactly one required — checked in code, since this schema subset has no conditional keyword) |
| `artifact_profile` + `profile_ref` | Which of the three audio families, and where its rules live |
| `audience` + `traits_applied` | Which audience, and which concrete `modality_effects.audio` adjustments were actually used |
| `selected_reference_traits` | Which `editorial/profiles/reference/audio.json` traits were adopted/avoided — traits only, never a reference body |
| `render` (tool/provider/model/model_version/voice_id/voice_provenance_class/quality_tier) | Which exact runtime and voice provenance class rendered it (`editorial/RIGHTS-AND-PROVENANCE.md` §4 voice-provenance table); `null` before a render is attempted |
| `attempts` / `max_attempts` | Whether this is within its bounded-revision budget |
| `plan_id` | The plan's own identity, for QA and reroll tracking |

## Boundary

This repository owns why the plan exists, which audience and artifact
profile apply, the canonical spoken script, pronunciation/delivery intent,
and the script-L1 gate. A project repository owns the actual TTS backend,
binary audio storage, and publication delivery. `render` records that
backend's identity as lineage; it never becomes editorial authority over the
script.
