# Content-type profiles

Five profiles. All share `../constitution.md` and `../voice.md`; they differ in
**evidence burden, required fields, and which derived artifacts make sense**.

Machine form: the JSON files in this directory. Engine:
`../../scripts/lib/profile-core.mjs`. Run with `npm run check:profile`.

A profile is not a template. `typical_structure` is a default the argument may
override; `evidence_burden` is not.

## At a glance

| | Research | View | News | Note | Project |
|---|---|---|---|---|---|
| Min sources | 3 | 1 | 2 | 1 | 1 |
| Min verified claims | 4 | 1 | 3 | 0 | 2 |
| Required source role | primary + **contradicting** | — | primary | — | primary |
| Required type fields | `research_question` | `confidence`, `counterarguments` | `event_date` | `my_note` | `project_ref`, `period` |
| Hard limit | — | — | source age ≤ 30d | **800 words** | pinned repo ref |
| Structure burden | high | low | medium | lowest | medium |

The spread is the point. A Note and a Research piece are not the same article
with different word counts.

## Research

Evidence-first synthesis answering a stated question. The heaviest burden, and
the only profile that **requires a contradicting source**: a research piece
that never met a source disagreeing with it has not finished its research.

Scenarios and historical analogues are optional and, when used, are examined
rather than invoked. A scenario is never presented with the confidence of a
finding.

## View

A judgment, argued honestly. Low citation burden by design — a view earns its
keep by reasoning, not citation volume — but any fact it asserts is still
verified.

Requires `confidence` and `counterarguments`, matching the existing
`suengj-com` view front matter. The counterargument is stated at full
strength; `what_would_change_my_mind` is the optional field that makes the
position falsifiable.

The named anti-pattern is opinion written in the register of neutral research.

## News / Analysis

Current facts, marked apart from our reading of them. Requires a **primary**
source: a claim about what is happening now needs a source that observed it,
not one that repeated it.

`event_date` is a required type field and is distinct from both the source's
publication date and ours. Freshness is enforced — an event more than 30 days
before verification fails the profile. A month-old primary source is fine; a
month-old claim about "now" is not.

Default artifact: `brief`.

## Note

A concise observation with the personal judgment kept. Zero verified claims
required — a note points at something and says what the author made of it.

**Capped at 800 words**, enforced. A note that grows past this has become a
research piece wearing a note's structure; the correct response is to
reclassify it, not to pad it. Distribution artifacts are inappropriate: a
piece this small cannot carry one.

## Project

Context, problem, decision, implementation evidence, lessons.

The distinctive rule: **repository prose is a claim, not evidence.** A README
states an intention. A claim about what the code does is verified against
commits, tests, and behaviour — so every GitHub source needs a `pinned_ref`,
and the validator enforces it. Invented project history is the first-listed
anti-pattern.

## Artifact fit by type

Derived from each profile's `artifacts` block and enforced: an artifact whose
kind is listed `inappropriate` for the article's content type fails.

| Artifact | Research | View | News | Note | Project |
|---|---|---|---|---|---|
| `evidence_visual` | **default** | optional | optional | — | **default** |
| `sources` | **default** | — | optional | optional | optional |
| `brief` | optional | optional | **default** | ✗ | optional |
| `slides` | optional | optional | optional | ✗ | optional |
| `infographic` | — | — | optional | ✗ | — |
| `audio` | — | ✗ | — | ✗ | ✗ |
| `video` | ✗ | ✗ | — | ✗ | ✗ |

**No artifact is required of any content type.** `default` means "expected
when one is produced", not "must exist". Nothing here obliges a quiz, an
audio track, or a video for any type — see `../MEDIA-STRATEGY.md`.
