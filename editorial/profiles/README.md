# Content-type profiles

Five profiles. All share `../constitution.md` and the invariant core in
`../voice.md`; they differ in **evidence burden, required fields, register, and
which derived artifacts make sense**.

Machine form: the JSON files in this directory. Engine:
`../../scripts/lib/profile-core.mjs`. Run with `npm run check:profile`.

A profile is not a template. `typical_structure` is a default the argument may
override; `register` describes the prose posture for that content type; the
evidence burden is the part that may not be relaxed.

## Voice core vs register

The shared voice should make the publication recognisable without making every
piece sound structurally identical.

```text
voice.md invariants
precision · restraint · terminology discipline · factual honesty
        ↓
content-type register
Research  → evidence-led / analytical
View      → judgment visible / personally owned
News      → compressed / event-led
Note      → observational / loose
Project   → decision- and implementation-oriented
```

A register is not a house sentence pattern. Research does not require repeated
"A is not B" distinctions; View does not require a token counterargument
paragraph; News does not require "What happened / Why it matters" headings;
Note does not require "Summary / Key points / My note"; Project does not need
to turn every decision into a polished retrospective lesson.

## At a glance

| | Research | View | News | Note | Project |
|---|---|---|---|---|---|
| Min sources | 3 | 1 | 2 | 1 | 1 |
| Min verified claims | 4 | 1 | 3 | 0 | 2 |
| Required source role | primary + **contradicting**¹ | — | primary | — | primary |
| Required type fields | `research_question` | `confidence`, `counterarguments` | `event_date` | `my_note` | `project_ref`, `period` |
| Hard limit | — | — | source age ≤ 30d | **800 words** | pinned repo ref |
| Structure burden | high | low | medium | lowest | medium |

¹ `contradicting` is a lineage role, not a requirement to manufacture a
binary debate. It includes material evidence that directly contradicts the
thesis **or narrows, weakens, or bounds its scope**. A Research piece must meet
evidence capable of changing the thesis; it does not need an artificial
"other side".

The spread is the point. A Note and a Research piece are not the same article
with different word counts, and they should not be the same prose rhythm with
different citation counts.

## Research

Evidence-first synthesis answering a stated question. The heaviest burden, and
the only profile that requires explicit challenge evidence. The
`contradicting` role is satisfied by a source that materially tests the thesis:
direct disagreement, a boundary condition, a measurement mismatch, or evidence
that forces the claim to become narrower.

Research **discovery may precede the Article Frame**. The constitutional thesis
requirement applies at the drafting boundary, not at the first search query. A
research process may start with a question and competing explanations; an early
thesis is provisional until it has met the strongest challenge evidence.

Scenarios and historical analogues are optional and, when used, are examined
rather than invoked. A scenario is never presented with the confidence of a
finding. The register is analytical but need not resemble an academic paper or
a translated literature review.

## View

A judgment, argued honestly. Low citation burden by design — a view earns its
keep by reasoning, not citation volume — but any fact it asserts is still
verified.

Requires `confidence` and `counterarguments`, matching the existing
`suengj-com` view front matter. The counterargument is stated at full strength
when it genuinely tests the position; it does not need to appear as a fixed
section. `what_would_change_my_mind` is optional and makes the position
falsifiable when that condition can be stated precisely.

The named anti-pattern is opinion written in the register of neutral research.

## News / Analysis

Current facts, marked apart from our reading of them. Requires a **primary**
source: a claim about what is happening now needs a source that observed it,
not one that repeated it.

`event_date` is a required type field and is distinct from both the source's
publication date and ours. Freshness is enforced — an event more than 30 days
before verification fails the profile. A month-old primary source is fine; a
month-old claim about "now" is not.

The register is compressed and event-led. Fact and interpretation remain
separate, but they do not need symmetrical headings or a mechanically repeated
"What happened / Why it matters" shell.

Default artifact: `brief`.

## Note

A concise observation with the personal judgment kept. Zero verified claims
required — a note points at something and says what the author made of it.

**Capped at 800 words**, enforced. A note that grows past this has become a
research piece wearing a note's structure; the correct response is to
reclassify it, not to pad it. A Note may be one paragraph and usually needs no
headings. `Summary / Key points / My note` is explicitly not an output
template.

Distribution artifacts are inappropriate: a piece this small cannot carry one.

## Project

Context, problem, decision, implementation evidence, lessons.

The distinctive rule: **repository prose is a claim, not evidence.** A README
states an intention. A claim about what the code does is verified against
commits, tests, and behaviour — so every GitHub source needs a `pinned_ref`,
and the validator enforces it. Invented project history is the first-listed
anti-pattern.

The register is decision- and implementation-oriented. Chronology is allowed
when chronology explains a decision; a polished retrospective narrative is not
required.

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
