---
name: intake-request
version: 0.1.0
description: Turn one natural-language request into a validated Editorial Intent over the five independent axes, asking a bounded clarification only when a missing field is materially outcome-changing.
when_not_to_use: Do not use once an Editorial Intent already exists for this request — revising axis values on an existing intent is a new intake run over the same intent_id, not a fresh one. Do not use to frame, plan, draft, verify, or render anything; this Skill stops at a validated intent record and hands off.
inputs:
  - the human's utterance, verbatim, in whatever language it was written
  - editorial/profiles/axes.json (the axis registry)
  - only the profile files the resolved intent actually selects, per axis
  - the current date and calendar, for created_at and any freshness reading
  - the currently active calibration reference, if one exists (calibration_ref only — never calibration history)
outputs:
  - one Editorial Intent record (schemas/editorial-intent.schema.json)
  - when clarification is required, the bounded question set the record carries in clarification.asked, offered to the human before the record is finalized
requires:
  - editorial/profiles/axes.json, to know which axis directories exist
  - at least enough of the utterance to attempt transformation, content type, audience, surface, and artifact resolution — an utterance with no actionable request at all is refused, not guessed at
authority:
  may:
    - resolve each axis to confirmed, assumed, or missing_material
    - decide, per request, whether a missing field is material enough to ask about
    - place an input in inputs.sources or inputs.references, never both
    - record a reference's dimensions and an accompanying task override
    - set clarification.resolution to default_authorized when the human said so
    - proceed as ready on assumed values when nothing material is missing
  may_not:
    - publish, approve, or finalize anything — nothing this Skill produces is or implies human approval
    - let an assumed value inform durable calibration (V2.10); only confirmed values, explicit feedback, or accepted evidence may do that
    - ask more than 3 clarifying questions without recording why in clarification.note
    - treat default_authorized as authorizing anything beyond this one intent_id
    - load a full axis directory, the reference corpus, or the feedback corpus to resolve one request
    - invent a source_id, ref_id, or profile id that does not resolve
governed_by:
  - docs/architecture/V2-EDITORIAL-LEARNING-CORE.md
  - schemas/EDITORIAL-INTENT-CONTRACT.md
  - editorial/profiles/axes.json
allowed_tools:
  - file_read
  - file_write
references:
  - path: references/materiality-examples.md
    load_when: it is not obvious whether a missing field is material — this file gives worked resolve/ask calls for each axis, not a general introduction
evidence:
  acceptance:
    - the produced record validates against schemas/editorial-intent.schema.json
    - node scripts/validate-intent.mjs passes on the record
    - every confirmed/assumed axis and artifact value carries a basis
    - clarification.required is non-empty if and only if status is blocked_on_clarification
    - clarification.asked has 1-3 entries, or more with a clarification.note explaining why
    - no source_id appears in inputs.references and no ref_id appears in inputs.sources
  fixtures:
    - schemas/examples/intent-synthesize-research-suengj.example.json
    - schemas/examples/intent-child-explainer.example.json
    - schemas/examples/intent-blocked-clarification.example.json
    - schemas/examples/intent-default-authorized.example.json
    - schemas/examples/intent-reference-dimensions.example.json
---

# intake-request

## Purpose

The human writes sentences. The agent writes JSON. That is the whole job:
turn one ordinary utterance — a Slack message, a voice memo transcript, a
one-line Korean or English request — into a validated Editorial Intent that
`frame-article`, `plan-artifacts`, and every generation Skill downstream can
read without re-interpreting the human's words.

This Skill sits immediately upstream of `frame-article`
(`skills/frame-article/SKILL.md`). Where that Skill decides *whether an
article exists*, this one decides *what was actually asked for* — the five
axes, the inputs, and whether anything is missing enough to matter. See
`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §3–§4 for why the axes are
independent and why natural language is the interface at all, and
`schemas/EDITORIAL-INTENT-CONTRACT.md` for the resolution-state rules and the
materiality test this Skill applies mechanically.

**An intake that interrogates has failed even if every question was
individually reasonable.** Five well-chosen questions are not five small
wins; they are the wizard failure mode. Proceeding on a well-justified
`assumed` value and being wrong once is a cheaper failure than asking every
time, because it is correctable in one revision and it does not teach the
human to dread using the system in natural language.

## Inputs

The utterance, verbatim. `editorial/profiles/axes.json`. Nothing else is
loaded until an axis value is tentatively resolved — see Procedure step 2 and
the context budget in `schemas/EDITORIAL-INTENT-CONTRACT.md` (§ "Context
budget at intake").

## Outputs

Exactly one Editorial Intent record. `status` is one of:

- **`ready`** — nothing material is missing; framing/planning may proceed.
- **`blocked_on_clarification`** — `clarification.required` names the
  material gaps, and `clarification.asked` carries the bounded question set.
- **`declined`** — the utterance carries no actionable editorial request, or
  asks for something this Skill's `may_not` list forbids. `clarification.note`
  records why.

## Preconditions

- The utterance exists and is not empty.
- `editorial/profiles/axes.json` loads and lists at least the five populated
  axes this schema resolves over.
- The current date is known, for `created_at` and any freshness reading a
  content-type or transformation profile later depends on.

## Procedure

1. **Read the whole utterance before resolving any axis.** A single sentence
   routinely answers more than one axis at once ("펀치라인 있는 초보자용 요약을
   suengj.com에" names transformation, audience, and surface together). Do
   not process axes independently of each other; a later axis can change how
   an earlier one reads.

2. **Resolve each axis to `confirmed`, `assumed`, or `missing_material`,
   with a basis.** For each of transformation, content type, audience,
   surface, and the artifact list:
   - If the utterance names it, or an upstream contract already fixed it
     (a source's own type, a prior package's surface), record `confirmed`
     with the utterance span or contract as `basis`.
   - If nothing named it but a default is safe for this run, record
     `assumed` with the inference as `basis`. Load only the one profile file
     this tentative value points at, to confirm the id exists and to read
     `profile_ref` — never the whole axis directory.
   - If nothing named it and no default is safe, record `missing_material`
     with no `value` and no fabricated `basis`.
   The artifact list resolves the same way per requested artifact; an empty
   list is always `missing_material` for the whole axis — the schema's own
   description of `axes.artifacts` says so, and there is no safe default for
   "produce nothing in particular."

3. **Apply the materiality test to every `missing_material` field before
   deciding to ask.** A field is material only if getting it wrong would
   change thesis, audience fit, transformation fidelity, artifact route,
   publication constraint, or cost (spine §4). Worked examples of this
   judgement live in `references/materiality-examples.md`, loaded only when
   the call is not obvious from the axis descriptions alone.

4. **If nothing material is missing, set `status: ready` and stop asking.**
   `clarification.required` is empty, `clarification.asked` is empty,
   `clarification.resolution: proceeded`. This is the default path, not the
   exception — most requests reach this state.

5. **If something material is missing, ask 1–3 questions, each with options
   and a marked default.** Populate `clarification.required` with every
   `missing_material` path, `clarification.asked` with the question set,
   `status: blocked_on_clarification`, `resolution: unresolved` until the
   human answers. Never ask about a field the utterance or a loaded profile
   already answered — re-asking a resolved field is a defect, not caution.
   If a genuine case needs more than 3 questions, ask them but write why in
   `clarification.note`; do not silently exceed the gate.

6. **Recognize `default_authorized` for what it grants and nothing more.**
   "알아서 해" / "use default" (before or in answer to a question) converts
   every currently `missing_material` field this run needs to `assumed`,
   each still carrying a basis, sets `resolution: default_authorized`,
   empties `clarification.required`, and moves `status` to `ready`. It does
   not touch calibration and does not extend to the next request — see
   `schemas/EDITORIAL-INTENT-CONTRACT.md` §"`default_authorized`" for the
   exact boundary.

7. **Split Source from Reference as inputs are read, never after.** Material
   offered to establish a fact goes in `inputs.sources` as a `source_id`
   (never fabricated — an unresolvable pointer is recorded with its state
   rather than invented outright). Material offered as craft guidance goes in
   `inputs.references` as a `ref_id`. When the utterance singles out part of
   a reference ("정보 구조는 좋은데 색감은 싫어"), record the adopted part in
   `dimensions` (vocabulary from `editorial/profiles/reference/<modality>.json`)
   and the rejected part as an `overrides` entry — never as wholesale
   imitation, and never promoted into `inputs.sources`.

8. **Assign `intent_id` once, and never mutate it.** Format
   `intent:YYYY-MM-DD-<slug>`. Everything this request produces downstream
   cites it.

9. **Validate before handing off.** Run `node scripts/validate-intent.mjs`
   against the record (or the equivalent structural + cross-field check) and
   fix any reported issue before treating the intent as final. A record that
   fails its own contract is not an intake result.

10. **Hand off.** `status: ready` or `status: blocked_on_clarification` (with
    the human's answer merged back in once given) goes to `frame-article` or
    the equivalent downstream Skill for the requested artifact. `declined`
    goes back to the human with the reason.

## Invariants

- Every `confirmed` or `assumed` axis and artifact value carries a non-empty
  `basis`. An unexplained value cannot later be routed to the layer that
  produced it (spine §5).
- `clarification.required` is non-empty if and only if `status:
  blocked_on_clarification`.
- No `source_id` ever appears in `inputs.references`; no `ref_id` ever
  appears in `inputs.sources`. The two arrays answer different questions
  (spine §2) and neither may do the other's job.
- `assumed` values never appear in a calibration read. This Skill does not
  write to `calibration/`; it only records `calibration_ref` for lineage.
- Clarification is 1–3 questions unless `clarification.note` justifies more.
- `intent_id` is immutable once assigned.

## Refusal conditions

This Skill **stops and returns `status: declined`**, with the reason in
`clarification.note`, when:

- The utterance carries no actionable editorial request at all (e.g. pure
  small talk, or a request entirely outside this system's scope).
- The utterance asks this Skill to do something in its `authority.may_not`
  list — for example, asking the agent to "publish it" or "approve it"
  directly at intake. Refuse the forbidden part; if the rest of the request
  is otherwise resolvable, say so in the note rather than declining the
  whole intent.
- A required upstream file is missing — `editorial/profiles/axes.json` does
  not load, or a tentatively resolved profile file cannot be read. This
  Skill does not proceed on a guess about what a missing profile probably
  says.

## Evidence

- The record validates against `schemas/editorial-intent.schema.json` and
  passes `node scripts/validate-intent.mjs` (schema plus the cross-field
  rules in `schemas/EDITORIAL-INTENT-CONTRACT.md`).
- `node scripts/test-intent.mjs` proves the five worked examples in
  `evidence.fixtures` each resolve through a genuinely different path:
  zero-question proceed, confirmed child audience, blocked with two
  questions and defaults, `default_authorized` with several `assumed`
  values, and a reference carrying `dimensions` plus a task override.

## Authority

This Skill decides what was asked for. It does not decide whether the
resulting piece should exist (`frame-article`'s job), does not write or
verify anything, and nothing it produces is or implies human approval,
publication, or finalization. A human's "알아서 해" authorizes this run's
`assumed` values and nothing beyond them.
