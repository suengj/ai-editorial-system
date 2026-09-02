---
name: compile-visual-story
version: 0.1.0
description: Compile a human-finalized article and approved artifact plan into one provider-neutral argument-beat graph that can feed slides, infographics, audio compilation, and video without claim drift.
when_not_to_use: Do not use to decide what the article argues, verify new claims, write final spoken narration, render media, choose a vendor, or plan distribution artifacts that plan-artifacts has not approved.
inputs:
  - final or published canonical article
  - verified claim set
  - approved artifact plan
  - content-type profile
  - optional semantic presentation plan
  - optional visual-language contract
outputs:
  - provider-neutral Visual Story Plan with stable beat ids
  - surface mapping for each planned slide, infographic, audio, or video output
requires:
  - article_ref with version_number, content_hash, and claims_hash
  - verified claim set for every fact-bearing beat
  - artifact plan with at least one non-skipped visual-story surface
  - final or published article state for distribution surfaces
authority:
  may:
    - choose argument-beat boundaries and a surface-appropriate explanation order that preserves logical dependency
    - map verified claims and evidence references to beats
    - assign separate visual, text, narration-intent, transition, and accessibility responsibilities to a beat
    - omit secondary article material from a surface when the omission does not alter the thesis or retained claims
    - split or combine beats per surface while preserving the mapping
  may_not:
    - add or verify a claim, calculation, analogy, quotation, or factual comparison
    - change the article thesis, confidence, uncertainty, or source attribution
    - write the final canonical spoken script when audio is planned
    - render images, charts, slides, audio, video, captions, or publication UI
    - choose provider-specific models, APIs, slide themes, CSS, or design tokens
    - plan an artifact kind that the approved artifact plan skipped
    - publish, approve, or finalize an article or artifact
governed_by:
  - editorial/constitution.md
  - editorial/MEDIA-STRATEGY.md
  - editorial/VISUAL-STORY-COMPILATION.md
  - editorial/SLIDES-AND-CAROUSELS.md
  - editorial/INFOGRAPHIC-AND-POSTER.md
  - editorial/AUDIO-SCRIPT.md
  - editorial/VIDEO-STORYBOARD.md
  - editorial/RIGHTS-AND-PROVENANCE.md
allowed_tools:
  - file_read
evidence:
  acceptance:
    - every fact-bearing beat carries only claim_ids that are verified on the input article
    - every planned surface frame or module maps to one or more stable beat_ids
    - visual, text, narration-intent, transition, and accessibility responsibilities are explicit where applicable
    - logical dependencies and material uncertainty survive recompilation
    - the output names no provider-specific renderer and does not add an unplanned artifact kind
    - the plan carries the exact article_ref with version_number, content_hash, and claims_hash
---

# compile-visual-story

## Purpose

Compile one verified article into one reusable **argument-beat graph** before
separate slide, infographic, audio, or video workers touch it.

This Skill exists to prevent four independent prompts from creating four
independent interpretations of the same article.

```text
Canonical Article + verified claims
        ↓
plan-artifacts
        ↓
compile-visual-story
        ↓
Visual Story Plan
        ├→ slides / infographic
        ├→ compile-audio-script → spoken script
        └→ video storyboard after visual + audio assets exist
```

The Skill produces semantics and mappings. It never renders and it does not
replace `compile-audio-script`.

## Preconditions

Refuse unless:

1. the article is `final` or `published` when a distribution surface is
   requested;
2. the article has `version_number`, `content_hash`, and `claims_hash`;
3. the verified claim set is available;
4. `plan-artifacts` has explicitly recommended or allowed at least one relevant
   artifact;
5. the content-type profile is available.

If the artifact plan contains only `skip` decisions, this Skill is not needed.

## Procedure

### 1. Load the governing contracts

Read `VISUAL-STORY-COMPILATION.md` first. Load the surface-specific contract
only for the kinds actually planned.

Examples:

```text
slides/carousel → SLIDES-AND-CAROUSELS.md
infographic/poster → INFOGRAPHIC-AND-POSTER.md
audio → AUDIO-SCRIPT.md + downstream compile-audio-script Skill
video → VIDEO-STORYBOARD.md
```

Do not load every visual/style document by default.

### 2. Freeze the protected semantic set

Record:

- thesis;
- verified claims intended for distribution;
- uncertainty/qualification attached to those claims;
- evidence/source references;
- article version identity.

Nothing downstream in this Skill may strengthen or weaken that set.

### 3. Derive argument beats

Create the smallest useful set of cognitively coherent moves.

Typical functions include:

```text
orientation
assertion
mechanism
comparison
evidence
qualification
turn
consequence
decision_boundary
closing_inference
```

Do not split mechanically by paragraph or heading.

For each beat, record at minimum:

```yaml
beat_id:
function:
assertion:
carries_claims: []
source_references: []
depends_on: []
```

When applicable also record:

```yaml
visual_task:
text_task:
narration_task:
transition_role:
accessibility_task:
surface_fit:
```

`narration_task` describes what the spoken channel needs to accomplish. The
final spoken wording, pronunciation glossary, delivery spec, and semantic audio
segments are owned by `compile-audio-script`.

### 4. Validate dependencies

A beat may be reordered from the article only when its prerequisites still
appear first.

Examples:

- evidence cannot precede the definition needed to interpret it;
- a qualification must stay attached closely enough to constrain the claim;
- a consequence cannot be presented as a cause;
- a later comparison cannot silently introduce a new baseline.

### 5. Compile surface mappings

For each planned surface, map beats rather than rewriting the article again.

Example:

```yaml
surfaces:
  slides:
    - frame_id: slide-01
      beat_ids: [beat-01]
    - frame_id: slide-02
      beat_ids: [beat-02, beat-03]
  infographic:
    - module_id: module-A
      beat_ids: [beat-01, beat-02]
  audio:
    selected_beat_ids: [beat-01, beat-02, beat-03]
    handoff: compile-audio-script
  video:
    - segment_id: video-01
      beat_ids: [beat-01]
```

A surface may omit a secondary beat. Record the omission; do not silently
change its meaning.

### 6. Assign channel responsibility

For narrated surfaces, decide what is primarily:

```text
shown
written
selected/explained in speech
```

Avoid assigning the same full paragraph to both screen and narration unless the
surface explicitly requires a redundant accessibility/silent mode.

Do not write TTS-ready prose here. Hand the selected beats and dependency
constraints to `compile-audio-script`.

### 7. Preserve evidence authority

If a beat needs exact factual visual marks, point to the existing or planned
`evidence_visual`. Do not describe a generative substitute.

If the beat needs conceptual/identity imagery, record the semantic visual role;
the image-generation contract and selected visual language will handle
rendering later.

### 8. Attach accessibility needs

Identify, where applicable:

- semantic frame/module title;
- logical reading order;
- alt/alternative description;
- captions;
- integrated verbal description or other alternative path for visual-only
  information.

Do not wait until the video/deck is rendered to discover these requirements.

### 9. Run cross-surface drift checks

For every beat used on multiple surfaces, check:

- same claim direction;
- same material qualification;
- same evidence/provenance;
- same causal/temporal relation;
- no surface-specific new fact.

Different wording and density are allowed. Different meaning is not.

## Invariants

- `beat_id` is stable within a Visual Story Plan version.
- Every fact-bearing beat resolves only to verified claims.
- Surface mappings never create an artifact kind the artifact plan skipped.
- The article remains the canonical source of truth.
- Exact evidence remains traceable; generative imagery never becomes evidence
  authority by passing through this Skill.
- Visual language and renderer/provider remain replaceable downstream.
- Audio narration text remains owned by `compile-audio-script`.
- The plan records exact article version identity.

## Refusal conditions

Return a refusal rather than improvising when:

- distribution is requested before human finalization;
- article version/hashes are absent;
- a required claim is not verified;
- the artifact plan is missing or has skipped the requested kind;
- the requested surface requires a new factual comparison/calculation;
- the user asks the Skill to choose a vendor/model or render the asset;
- the user asks this Skill to replace the canonical audio-script compiler.

A new factual comparison goes back to verification. A new visual style goes to
the visual-language layer. A new renderer goes to the project adapter. Final
spoken narration goes to `compile-audio-script`.

## Evidence

A successful run can be audited without looking at rendered media:

```text
article_ref exact
+ every beat → verified claims
+ every frame/module/audio-selection → beat ids
+ dependencies preserved
+ uncertainty preserved
+ channel responsibilities explicit
+ no provider-specific output
```

Rendered slide/image/audio/video QA is separate and happens downstream.

## Authority

This Skill is a **cross-surface semantic compiler**. It may restructure an
already-approved argument into stable beats and surface mappings. It cannot
change what is true, write final narration, approve distribution, render media,
or publish.
