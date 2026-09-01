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
  never "must exist". No rule anywhere obliges a quiz, an audio track, or a
  video for any content type.

## Build-out order

Provisional. Locked as an *input* to the P4 PoC, not as an assumption.

1. **Evidence visuals** — charts, diagrams, tables, timelines
2. **Brief**
3. **Slides / carousel**
4. **Infographic**
5. **Audio**
6. **Video**
7. **Interactive / quiz**

Rank 1 is highest because evidence visuals improve the article itself, not
only its reach — the only artifact class with that property. Ranks 5–7 are
low for reasons already established in
[`../benchmarks/MULTIMEDIA-GENERATORS-BENCHMARK.md`](../benchmarks/MULTIMEDIA-GENERATORS-BENCHMARK.md):
no automation surface for product-grade audio, per-second cost for video, and
no contract at all yet for an interactive surface.

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

RP-4 and RP-5 are the two that would stop the roadmap rather than reorder it.
