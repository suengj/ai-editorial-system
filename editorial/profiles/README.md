# Profile axes

`editorial/profiles/` is an **axis registry**, not a single flat list of
content types. Editorial Intent (`schemas/editorial-intent.schema.json`)
resolves over independent axes; each axis has its own directory here, and the
registry itself lives in [`axes.json`](axes.json).

```text
editorial/profiles/
  axes.json          the registry: every axis, its dir, id shape, and status
  content/           evidence burden, register, structure — per content type
  transformation/     what a transformation may change, what it must preserve
  audience/          who is on the other end, across text/visual/audio
  surface/           where it lands and what that constrains
  artifact/          which medium and which shape of it (visual/audio profiles; AES-V2.7 / V2.8)
  brand/             visual/voice brand tokens applied by artifact profiles (AES-V2.7)
  reference/         modality-aware craft-reference evaluation rules (AES-V2.4)
```

Machine engine: [`../../scripts/lib/profile-core.mjs`](../../scripts/lib/profile-core.mjs)
(`loadProfiles` for the content axis, `loadAxes` / `loadAxisProfiles` for any
axis). Registry validator: `node scripts/validate-profiles.mjs`. Content-type
regression: `npm run check:profile` / `npm run test:profiles`.

See [`../../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`](../../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md)
§3 for why these axes exist and why they must not collapse into one another.

## Axes do not collapse into each other

`summarize` is not a content type. `suengj-com` is not an audience. `body
infographic` is not a transformation. Each axis answers a different question,
and a profile belongs in exactly one axis directory:

| Axis | Answers | Directory |
|---|---|---|
| Content type | Evidence burden, required fields, register, structure | `content/` |
| Transformation | What may change, what must survive | `transformation/` |
| Audience | Who is on the other end, across every modality | `audience/` |
| Surface | Where it lands, who owns that destination | `surface/` |
| Artifact | Which medium and which shape of it | `artifact/` (AES-V2.7/V2.8) |
| Brand | Visual/voice tokens an artifact profile applies | `brand/` (AES-V2.7) |
| Reference | Modality-aware craft-reference evaluation | `reference/` (AES-V2.4) |

## The extension rule

Adding a transformation, content type, audience, surface, artifact class, or
brand profile means adding a JSON file to the matching directory. It does not
modify `scripts/lib/profile-core.mjs`, any router, or any Skill — the loader
reads whichever axis a caller asks for via `axes.json`, so no axis id is
hardcoded in the engine. `content/academic.json` and `content/promotional.json`
exist specifically to prove this: two new content types, added as data, with
no change to the validation code path that content types already ran through.

Populating a new axis means flipping that axis's `populated` field to `true`
in `axes.json` — a one-line data change, not a code change. `artifact`,
`brand`, and `reference` are populated this way; their `axes.json` entries
still carry `planned`/`deferred` sub-lists for ids that are declared but not
yet built (see `artifact.planned` for `text/*` profiles).

## Audience is a default, overridable per task

An audience profile is a **preset**, not a rigid bucket. `axes.audience.traits`
in an Editorial Intent overrides the preset's `expertise`,
`attention_context`, `jargon_tolerance`, and related fields for that task only
— the field names and enum values there are the authority, and every audience
profile's top-level fields are written to match them exactly
(`schemas/editorial-intent.schema.json`, `$defs.audience_axis.properties.traits`).
A profile is the answer when nothing task-specific was said; an override is
what the human actually said this time.

## Voice core vs content register

The shared voice should make the publication recognisable without making every
piece sound structurally identical.

```text
voice.md invariants
precision · restraint · terminology discipline · factual honesty
        ↓
content-type register
Research    → evidence-led / analytical
View        → judgment visible / personally owned
News        → compressed / event-led
Note        → observational / loose
Project     → decision- and implementation-oriented
Academic    → formal, method-transparent, hedged precisely
Promotional → persuasive, disclosed as such, still fully verified
```

A register is not a house sentence pattern. Research does not require repeated
"A is not B" distinctions; View does not require a token counterargument
paragraph; News does not require "What happened / Why it matters" headings;
Note does not require "Summary / Key points / My note"; Project does not need
to turn every decision into a polished retrospective lesson; Academic's hedges
are not weak prose to be edited toward confidence; Promotional's enthusiasm is
never a substitute for a verified number.

## Content types at a glance

| | Research | View | News | Note | Project | Academic | Promotional |
|---|---|---|---|---|---|---|---|
| Min sources | 3 | 1 | 2 | 1 | 1 | 5 | 1 |
| Min verified claims | 4 | 1 | 3 | 0 | 2 | 6 | 1 |
| Required source role | primary + **contradicting**¹ | — | primary | — | primary | primary + contradicting | — |
| Required type fields | `research_question` | `confidence`, `counterarguments` | `event_date` | `my_note` | `project_ref`, `period` | `research_question`, `method_note` | `disclosure`, `call_to_action` |
| Hard limit | — | — | source age ≤ 30d | **800 words** | pinned repo ref | — | — |
| Structure burden | high | low | medium | lowest | medium | high (method + limitations) | low |

¹ `contradicting` is a lineage role, not a requirement to manufacture a
binary debate. It includes material evidence that directly contradicts the
thesis **or narrows, weakens, or bounds its scope**. A Research piece must meet
evidence capable of changing the thesis; it does not need an artificial
"other side".

The spread is the point. A Note and a Research piece are not the same article
with different word counts, and Academic is not Research with a stricter
citation count bolted on — its distinctive rule is that a correctly hedged
claim is a stronger claim, not a weaker one. Adding further content types
(e.g. a tutorial or a reference/glossary type) follows the same rule: a new
file in `content/` with the same shape as the seven above, differentiated on
evidence burden, register, and anti-patterns — no change to
`scripts/lib/profile-core.mjs` or `scripts/check-profile.mjs`.

## Research

Evidence-first synthesis answering a stated question. The heaviest V1 burden,
and the only profile that requires explicit challenge evidence. The
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
a translated literature review — that register belongs to `academic` instead.

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

## Academic

Formal scholarly treatment, added in AES-V2.2 to prove the extension rule.
Highest citation burden of any content type (`min_sources: 5`,
`min_verified_claims: 6`, requiring both a primary and a contradicting source),
and its structure burden is high because the `method_note` type field and a
limitations section are load-bearing: they are what makes a hedge checkable
rather than decorative.

The distinctive rule: **a correctly hedged claim is a stronger claim, not a
weaker one.** Editing a hedge toward confidence to make the prose read better
is the profile's first-listed anti-pattern, not a stylistic improvement.

## Promotional

Persuasive material for a product, service, or project, added alongside
`academic` to prove the extension rule from the opposite direction: a register
that is allowed to be enthusiastic still carries a full verification
obligation on every factual claim it makes.

Requires `disclosure` — the persuasive intent must be stated, not left for the
reader to infer — and `call_to_action`. The named anti-pattern is the
unfalsifiable superlative ("the best", "revolutionary"): a claim with no
measurable content behind it. Evidence burden is intentionally low
(`min_verified_claims: 1`) but not zero; a promotional piece is not exempt from
verification, only from Research's citation volume.

## Artifact fit by content type

Derived from each profile's `artifacts` block and enforced: an artifact whose
kind is listed `inappropriate` for the article's content type fails.

| Artifact | Research | View | News | Note | Project | Academic | Promotional |
|---|---|---|---|---|---|---|---|
| `evidence_visual` | **default** | optional | optional | — | **default** | optional | optional |
| `sources` | **default** | — | optional | optional | optional | **default** | — |
| `brief` | optional | optional | **default** | ✗ | optional | — | **default** |
| `slides` | optional | optional | optional | ✗ | optional | — | optional |
| `infographic` | — | — | optional | ✗ | — | — | optional |
| `full` | — | — | — | — | — | optional | — |
| `audio` | — | ✗ | — | ✗ | ✗ | ✗ | — |
| `video` | ✗ | ✗ | — | ✗ | ✗ | ✗ | — |

**No artifact is required of any content type.** `default` means "expected
when one is produced", not "must exist". Nothing here obliges a quiz, an
audio track, or a video for any type — see `../MEDIA-STRATEGY.md`.
