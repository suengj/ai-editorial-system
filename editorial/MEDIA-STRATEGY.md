# Media strategy — evidence vs distribution (AES-P1.5 / SUE-442)

"Multimedia" is not one feature. It is two activities with opposite
relationships to the argument, and the whole strategy follows from keeping
them apart.

Machine form: [`artifact-priority.json`](artifact-priority.json) and the
`artifacts` block in each [profile](profiles/). Enforced by
`../scripts/lib/article-contract-core.mjs` (stage gating) and
`../scripts/lib/profile-core.mjs` (fit by content type).

## The distinction

| | Evidence media | Distribution media |
|---|---|---|
| Kinds | `evidence_visual` (chart, table, timeline, diagram, framework visual), `sources` | `brief`, `full`, `slides`, `infographic`, `audio`, `video` |
| Built when | article state ≥ `framed` — during research and writing | article state ∈ `final`, `published` |
| Relationship to the argument | **May change it** | Consumes it |
| Published when | With the article | Only when the article is `published` |

**Evidence media can falsify the thesis.** That is its purpose. Plotting the
series is how you discover the trend does not hold; laying two sources side by
side in a table is how you find they disagree. Building the chart *after* the
argument is settled wastes the only thing it was good for.

This is why evidence media is gated at `framed` rather than at `final`. A
chart produced during research feeds back into the frame. A chart produced
after approval is decoration.

**Distribution media consumes one identified article version.** It never
precedes human finalization, it never adds a claim, and it carries
`article_ref` with both hashes so staleness is decidable. Enforced: an
artifact with `media_stage: distribution` on an article that is not `final` or
`published` fails validation.

## Generation method is not artifact kind

Image generation adds a renderer, not a new editorial authority or necessarily
a new schema kind.

A generated or edited image can realize an existing artifact/surface role, but
the artifact kind is still determined by what it **means** and where it sits in
the article lifecycle. The same applies to authored SVG, chart code, or other
renderers.

```text
artifact semantics
→ renderer choice
→ generated raster | authored SVG/CSS | chart/diagram code
```

Do not add a generic `generated_image` kind merely because a model produced the
pixels. Provider/model identity belongs in generator lineage. Editorial
semantics stay provider-neutral.

For image-specific briefing, prompt construction, reference-image consistency,
and visual QA, see [`IMAGE-GENERATION.md`](IMAGE-GENERATION.md).

A generated raster must not impersonate evidence. If exact values, labels,
relationships, chronology, or source-derived geometry are load-bearing, prefer
a deterministic/traceable renderer. Generative imagery is appropriate for
identity, navigation, illustration, distribution, or atmosphere when those
roles are explicitly planned.

### Audio is also compiled before it is rendered

`audio` is not the article body sent directly to a TTS API. It has an
intermediate editorial representation:

```text
Canonical Article
→ listener-first audio plan
→ compile-audio-script
→ Canonical Spoken Script
→ provider/model adapter
→ rendered audio
```

The spoken script may reorder explanation, compress secondary detail, make a
logical transition audible, or recur to a load-bearing idea while preserving
the article's verified claims, uncertainty, and provenance. Provider-specific
SSML, audio tags, voice IDs, pronunciation dictionaries, prompts, and endpoint
parameters belong only to the rendering adapter.

The provider-neutral script and audio QA contract live in
[`AUDIO-SCRIPT.md`](AUDIO-SCRIPT.md). Current Google, ElevenLabs, and OpenAI
TTS/model behavior is tracked separately in
[`../benchmarks/AUDIO-TTS-PROVIDERS.md`](../benchmarks/AUDIO-TTS-PROVIDERS.md).
A provider change therefore changes renderer lineage, not article semantics.

## Shared visual-story compilation comes before multi-surface rendering

When an article is approved for more than one visual/spoken derivative, do not
ask each generator to summarize the article independently.

Use one shared semantic compilation layer:

```text
Canonical Article + verified claims
        ↓
plan-artifacts
        ↓
Visual Story Plan / stable argument-beat graph
        ↓
┌────────────────┬──────────────────┬──────────────────┐
│ spatial        │ sequential       │ spoken           │
│ infographic    │ slides/carousel  │ audio beat map   │
│ poster         │ scrolly          │                  │
└────────────────┴──────────────────┴──────────────────┘
        ↓                               ↓
visual/image renderers        compile-audio-script
                                      ↓
                              Canonical Spoken Script
                                      ↓
                                  TTS adapter
        └───────────────────────┬─────┘
                                ↓
                         timed storyboard
                                ↓
                         assembled video
```

The Visual Story Plan is **not a new artifact kind**. It is an internal
compilation plan that maps verified claims and logical dependencies to stable
`beat_id`s, then records how each planned surface uses those beats.

This provides three guarantees:

1. slide, infographic, audio, and video do not invent separate summaries;
2. the same evidence/claim keeps one semantic identity across surfaces;
3. a stale or defective beat can be rebuilt locally instead of forcing an
   unrelated full-media reroll.

The cross-surface contract lives in
[`VISUAL-STORY-COMPILATION.md`](VISUAL-STORY-COMPILATION.md). Surface-specific
rules live in [`SLIDES-AND-CAROUSELS.md`](SLIDES-AND-CAROUSELS.md),
[`INFOGRAPHIC-AND-POSTER.md`](INFOGRAPHIC-AND-POSTER.md), and
[`VIDEO-STORYBOARD.md`](VIDEO-STORYBOARD.md).

`plan-artifacts` remains the authority for **whether** each artifact kind is
worth building. `compile-visual-story` only runs for kinds that plan approved;
it does not promote skipped media. `compile-audio-script` remains the authority
for the final provider-neutral spoken package; the visual-story layer supplies
shared beat/dependency constraints when audio participates in a multi-surface
story.

## Citation behaviour

| Artifact | Must carry |
|---|---|
| `evidence_visual` | `source_references` resolving to **verified** claims — a chart is our expression of someone else's facts |
| `brief`, `slides`, `infographic`, `audio`, `video` | Same. Any artifact that asserts a fact carries its provenance |
| `sources` | Derived from the manifest; provenance is its content |
| `full` | The article's own citations |

An artifact making a claim the article never verified is a contract
violation, not a stylistic choice. This is enforced, not advised.

## Fit by content type

Full table in [`profiles/README.md`](profiles/README.md). The rules that
matter:

- **Research and Project default to `evidence_visual`.** Both argue from
  material that is better shown than described.
- **News defaults to `brief`.** It is the type most likely to be read in a
  hurry.
- **Note takes no distribution artifact.** A piece capped at 800 words cannot
  carry a deck, and attaching one would be the note pretending to be a report.
- **View takes no audio or video.** A judgment should be readable and
  arguable, not narrated.
- **Nothing is required.** `default` means "expected when one is produced",
  never "must exist". No rule anywhere obliges a quiz, an audio track, a video,
  or a generated image for any content type.

## Build-out order

Provisional. Locked as an *input* to the P4 PoC, not as an assumption.

1. **Evidence visuals** — charts, diagrams, tables, timelines
2. **Brief**
3. **Slides / carousel**
4. **Infographic / selected generated editorial imagery**
5. **Audio**
6. **Video**
7. **Interactive / quiz**

Rank 1 is highest because evidence visuals improve the article itself, not
only its reach — the only artifact class with that property. Image generation
now makes high-quality raster rendering operationally easier, but that does not
promote decorative imagery above evidence. Audio/video backend capability may
also exist, yet their priority remains an editorial ROI and QA decision rather
than a capability checklist; video additionally carries materially higher
render cost and faster provider lifecycle risk.

Audio reaching rank 5 does not mean a TTS backend becomes an editorial
dependency. Before audio can move higher, the canonical spoken-script layer and
at least one Korean-certified rendering adapter must show that claim fidelity,
pronunciation, chunk continuity, and bounded regeneration work in practice.

The visual-story compiler does not change the priority order. It reduces drift
and duplicated reasoning **after** two or more approved surfaces need the same
argument.

## What would change the order

Recorded as `reprioritisation_criteria` so the order is revisable by evidence
rather than by preference:

| | Trigger | Effect |
|---|---|---|
| RP-1 | An evidence visual changes a thesis during the PoC | Confirms rank 1; raise the evidence-media budget |
| RP-2 | Brief regeneration after a *cosmetic* edit produces materially different text | The generator is under-constrained — fix the plan contract before adding kinds |
| RP-3 | Slides need hand-editing to be usable | Demote below infographic; the chain is not actually text-to-text |
| RP-4 | A distribution artifact asserts an unverified claim | Stop adding kinds; claim carry-through is the blocker, not throughput |
| RP-5 | A kind is consumed *instead of* the article rather than as a door to it | Demote it; the canonical article is the destination |
| RP-6 | Generated imagery repeatedly requires unbounded prompt/revision loops | Fix image acceptance and routing before increasing image volume |
| RP-7 | The same beat repeatedly drifts across slide/infographic/audio/video | Fix the Visual Story Plan / compiler boundary before increasing surface count |
| RP-8 | Beat-local repair cannot avoid full video rerender | Treat compositor/manifest modularity as the implementation bottleneck before adding motion complexity |

RP-4 and RP-5 are the two that would stop the roadmap rather than reorder it.
