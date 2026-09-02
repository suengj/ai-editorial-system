---
name: compile-audio-script
version: 0.1.0
description: Compile a human-finalized canonical article into clean listener-first narration plus provider-neutral pronunciation, delivery, and segment/timing state before any TTS renderer is selected.
when_not_to_use: Do not use to render speech, choose a vendor, clone a voice, or create audio from an unfinalized article. Do not use when plan-artifacts has skipped audio.
inputs:
  - final or published article with article_ref and verified claim set
  - non-skipped audio decision from the artifact plan
  - content-type profile and editorial/AUDIO-SCRIPT.md
  - optional destination timing constraints when narration must synchronize to another surface
outputs:
  - canonical spoken-script package with narration_text, pronunciation_glossary, delivery_spec, and segment_plan
  - carried claim IDs and source references
  - script/version hashes suitable for downstream render lineage
  - verification findings when spoken reformulation exposes a new claim or unresolved pronunciation
requires:
  - article state is final or published
  - the audio artifact decision is not skip
  - every factual claim selected for audio is verified
  - the destination timing contract is known before writing when rendering_mode is timed
authority:
  may:
    - reorder explanation for listening while preserving thesis and verified meaning
    - omit secondary verified claims that the audio plan does not carry
    - create provider-neutral spoken forms and pronunciation intents
    - assign semantic segment boundaries, sparse delivery intents, and explicit timing budgets
    - return a new derived claim or calculation to verification instead of speaking it
  may_not:
    - render or synthesize audio
    - select or hardcode a TTS vendor, model, voice ID, SSML dialect, or provider tag
    - introduce an unverified factual claim, number, analogy, or calculation
    - alter the article thesis, stated uncertainty, or fact/interpretation boundary
    - set an article to status published
    - record human approval
governed_by:
  - editorial/constitution.md
  - editorial/voice.md
  - editorial/MEDIA-STRATEGY.md
  - editorial/AUDIO-SCRIPT.md
  - editorial/RIGHTS-AND-PROVENANCE.md
  - schemas/ARTICLE-ARTIFACT-CONTRACT.md
allowed_tools:
  - file_read
evidence:
  acceptance:
    - narration_text contains only text intended to be spoken and no provider markup or stage directions
    - every factual claim carried by the script resolves to a verified article claim
    - pronunciation, delivery, speaker, and timing state are separate from narration_text
    - segment boundaries are semantic and every segment has a stable identity suitable for local regeneration
    - timed mode carries explicit duration budgets rather than silently time-stretching speech
    - no provider, model, voice ID, SSML tag, or provider-specific audio tag appears in canonical script state
  fixtures:
    - schemas/examples/article-artifact.example.json
---

# compile-audio-script

## Purpose

Turn a finalized article into the **canonical textual package that an audio
renderer may consume**. This Skill owns the modality change from reading to
listening. It does not own synthesis.

The useful boundary is:

```text
article semantics
→ compile-audio-script
→ canonical spoken-script package
→ replaceable provider adapter
→ rendered audio
```

Keeping this step separate prevents two common failures: feeding eye-written
article prose directly into TTS, and letting a provider's prompt syntax become
the de facto editorial contract.

## Inputs

The Skill consumes the finalized article and verified claim set, the audio
decision from `plan-artifacts`, the relevant content-type register, and the
rules in `editorial/AUDIO-SCRIPT.md`.

When the destination imposes a real duration constraint — for example a fixed
video or dubbing slot — that timing contract is an input. The Skill must not
discover the duration after writing and then compensate by distorting the
render.

## Outputs

Exactly one canonical spoken-script package containing:

```text
narration_text
pronunciation_glossary
delivery_spec
segment_plan
carried_claims / source references
script version + hashes
```

`narration_text` is clean speech text. Everything the renderer needs that is
not meant to be spoken lives in one of the other layers.

The Skill may also return a verification finding when spoken adaptation exposes
a claim that the article never verified. That is a valid output; the finding is
not smoothed into narration.

## Preconditions

- Article state is `final` or `published`; audio is distribution media.
- `plan-artifacts` did not return `skip` for audio.
- The verified claim set is available and identifies which claims the planned
  audio may carry.
- If `rendering_mode: timed`, target duration and tolerance are known before
  compilation.

Missing any of these is a refusal, not an invitation to infer a substitute.

## Procedure

1. **Read the audio decision.** Record the artifact purpose, audience/listening
   context, carried claims, and whether the destination is free or timed.
2. **Map the listening argument.** Reorder explanation where necessary so a
   listener receives prerequisite context before a claim depends on it. Do not
   preserve article section order merely because it already exists.
3. **Write clean narration.** Produce language-native spoken prose with one
   listenably complete thought at a time. Do not embed headings, stage
   directions, SSML, audio tags, voice names, or renderer commands.
4. **Preserve the factual set.** Attach every retained factual statement to its
   verified claim. New calculations, comparisons, or factual analogies return
   to verification.
5. **Resolve spoken forms.** Build provider-neutral readings for risky numbers,
   dates, symbols, acronyms, proper nouns, and mixed-language terminology.
6. **Build a compact delivery spec.** Make only the delivery constraints already
   implied by the editorial register, audience, and script explicit. Do not
   invent a persona, accent, or emotion because a renderer supports it.
7. **Segment by meaning.** Assign stable segment IDs at completed reasoning
   beats or speaker turns. Record neighbour context for long-form continuity
   and optional target durations for timed mode.
8. **Check timed mode.** If the script misses a real duration budget, revise the
   narration within the verified semantics. Do not solve a writing mismatch by
   assuming downstream time stretching.
9. **Hash and hand off.** Record narration/package hashes and hand the package to
   a provider adapter. Rendering is a different authority.

## Invariants

- The article thesis and direction of argument survive the modality change.
- Retained facts, numbers, dates, quotations, entities, confidence, and stated
  uncertainty remain semantically identical.
- Clean narration and performance instructions remain separate artifacts.
- Provider syntax never enters canonical script state.
- Semantic chunking precedes provider length limits.
- A local render defect can be repaired from one stable segment plus neighbour
  context without recomputing the whole script.
- Time constraints change the script plan explicitly; they do not silently
  change factual content or authorize unnatural time stretching.

## Refusal conditions

This Skill stops rather than producing a script when:

- the article is below `final`;
- the artifact plan skipped audio;
- a material carried claim is unverified or contradictory and unresolved;
- the requested spoken simplification would change the meaning of a verified
  claim;
- timed narration is requested without a known duration contract;
- the only way to satisfy timing is to drop a load-bearing claim or
  qualification without revising the artifact plan;
- a requested speaker/voice role would impersonate or imply a real third party
  outside the rights policy.

## Evidence

A valid run leaves an inspectable text package before any external renderer is
called. Review should be able to verify:

- exact narration text;
- carried claim IDs and source references;
- spoken-form/pronunciation decisions;
- delivery and speaker intents;
- semantic segment IDs and neighbour context;
- timing budgets when present;
- version/hash lineage.

The downstream rendered audio is not accepted on this evidence alone. Actual
pronunciation, prosody, timing, and seam continuity require listening under
`editorial/AUDIO-SCRIPT.md`.

## Authority

This Skill compiles editorial semantics into a provider-neutral spoken form. It
does not choose a backend, synthesize a voice, approve a render, finalize an
article, or publish anything. A provider adapter may realize the package; it may
not reinterpret it.
