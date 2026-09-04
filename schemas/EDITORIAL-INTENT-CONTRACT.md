# Editorial Intent contract (AES-V2.1 / SUE-559)

The structured result of natural-language intake. A human writes a sentence;
`skills/intake-request/` writes this. Every downstream step — framing,
planning, generation, evaluation, feedback — reads an Editorial Intent, never
the raw utterance.

Machine contract: [`editorial-intent.schema.json`](editorial-intent.schema.json).
Enforcement: `node scripts/validate-intent.mjs`.
Axis registry: [`../editorial/profiles/axes.json`](../editorial/profiles/axes.json).
Spine authority: [`../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`](../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md)
§3 (the five axes), §4 (natural language as interface, resolution states, the
calibration firewall), §9 (context budget).

This document does not restate §3/§4 — it says what those sections leave
unresolved: how a single intake run decides state, how the schema's shape
maps to the materiality test, and what the validator checks that the schema
cannot.

## The five axes, and why none of them collapses into another

| Axis | Intent field | Profile dir | A request that looks like this axis but is not |
|---|---|---|---|
| Transformation | `axes.transformation` | `editorial/profiles/transformation/` | "make it a summary" is a transformation change, not a content-type change |
| Content type | `axes.content_type` | `editorial/profiles/content/` | "make it more like a report" is evidence burden and register, not audience |
| Audience | `axes.audience` | `editorial/profiles/audience/` | "explain it simply" is audience, not a transformation ("simplify" is not `compress`) |
| Surface | `axes.surface` | `editorial/profiles/surface/` | "post it" names a destination, not a content type |
| Artifact | `axes.artifacts[]` | `editorial/profiles/artifact/` | "make it a thumbnail" changes semantic density and renderer route — an artifact-axis change, not a style note |

Each axis answers a question none of the others can answer, which is the
mechanical test for whether a request belongs on this axis or another: *what
may change* (transformation), *what evidence and register this piece owes*
(content type), *who receives it* (audience), *where it lands and what that
constrains* (surface), *which medium and shape* (artifact). A request that
answers two of these at once ("make it a punchy summary for beginners on
suengj.com as a thumbnail") is not ambiguous — it is four axis values stated
in one sentence, and intake's job is to place each word on its own axis
rather than treat the sentence as one opaque style instruction.

Audience is the one axis every other artifact-producing Skill reads
regardless of modality (spine §3, "Audience is shared across modalities").
Intake resolves it once, as `axes.audience`, with optional `traits` for
task-specific deviations from the named preset — not once per modality.

## Three resolution states, and the calibration firewall

Every axis value, and every artifact request, source, and reference, carries
exactly one `state`: `confirmed`, `assumed`, or `missing_material`
(`$defs/resolution_state`). The schema defines the meaning; this section
defines how an intake run decides between them.

| State | Decision rule | Basis required |
|---|---|---|
| `confirmed` | the utterance names it directly, or an upstream contract already fixed it (e.g. the source's own content type, a surface stated by a prior package) | the utterance span or the contract that fixed it |
| `assumed` | nothing named it, but a safe default exists for this run and getting it wrong costs little to correct later | the inference and why it is safe for this task |
| `missing_material` | nothing named it, no safe default exists, and getting it wrong would materially change the result | not required — there is nothing to justify yet |

**Basis is not optional in practice.** The schema leaves `basis` structurally
optional so `missing_material` values need not fabricate one, but
`scripts/validate-intent.mjs` fails any `confirmed` or `assumed` value that
omits it (`missing-basis`). An axis value nobody can explain cannot later be
routed to the layer that produced it (spine §5) — an unexplained `assumed`
value is exactly the shape of a silent guess hardening into preference.

**The calibration firewall**, stated precisely: `assumed` is evidence that an
inference was *safe for one run*. It is never evidence that the inference is
*true of the owner*. V2.10 calibration, and any Skill that reads calibration,
may only ingest `confirmed` values, explicit feedback, or accepted evidence —
never `assumed`, and never `overrides` (which are task-scoped by the schema's
own description and carry no calibration authority regardless of who stated
them). An agent that lets a run of `assumed` audience or surface values
accumulate into a default is the exact failure §12.6 of the spine names.

## The materiality test for clarification

`missing_material` is not "the human didn't say it." Most fields the human
doesn't say are safely `assumed`. A field is `missing_material` only when its
absence would change one of six things spine §4 names: **thesis, audience
fit, transformation fidelity, artifact route, publication constraint, or
cost.** Concretely:

- Content type unstated, and the difference between `note` and `research`
  changes the evidence burden by more than one source → material.
- Content type unstated, and every plausible reading shares the same evidence
  burden and structure → assumed, not material.
- Audience unstated for a general request → assumed to the surface's usual
  reader. Audience unstated for a request that could plausibly be a child
  explainer or a domain-expert brief → material; the two audience profiles
  produce different vocabulary ceilings, label densities, and pacing (spine
  §3 table), not merely a tone difference.
- Artifact axis empty is *always* material — `editorial-intent.schema.json`
  states this directly (`artifacts` empty means the axis is unresolved), and
  `validate-intent.mjs` enforces it as a `missing_material` case even with no
  explicit `state` field to check.

Passing the materiality test produces **1–3 questions**, each with `options`
and a marked `default` (`$defs/question`) — a menu, not an open prompt.
Exceeding 3 is not automatically wrong, but it must be *justified*, in
`clarification.note`, or the record fails validation
(`clarification-gate-exceeded`). The gate exists because interrogation is a
failure mode independent of whether any individual question was reasonable:
a wizard that asks five well-chosen questions has still failed intake's job,
which is to write the JSON, not to conduct an interview.

## `default_authorized` — what it grants and what it does not

`알아서 해` / "use default" sets `clarification.resolution:
default_authorized`. This has one effect and one effect only: every axis
that would otherwise be `missing_material` may resolve to `assumed` *for this
run*. It does not:

- retroactively make any `assumed` value `confirmed`,
- authorize a durable calibration change (§ above — the firewall does not
  weaken because the human said "whatever you think"),
- excuse the basis requirement — an `assumed` value produced under
  `default_authorized` still states *why* that default was chosen,
- extend past this `intent_id`. The next request that omits the same field
  starts the materiality test over.

A record with `resolution: default_authorized` and a non-empty
`clarification.required` is contradictory: default authorization is what
*empties* `required` by converting `missing_material` into `assumed`. The
validator's `clarification-status-mismatch` check catches the shape of this
even though it cannot read intent — `status: blocked_on_clarification`
requires a non-empty `required`, so a `default_authorized` record that still
carries required fields has failed to actually apply the authorization it
claims.

## What the schema cannot express, and what the validator enforces instead

`json-schema-lite` (`scripts/lib/json-schema-lite.mjs`) supports a small,
declared keyword set with no conditional composition (`if`/`oneOf`/`allOf`).
The following rules are true statements about a valid intent that the schema
alone cannot check, so `scripts/validate-intent.mjs`
(`scripts/lib/intent-core.mjs`) checks them structurally after schema
validation passes:

| Check | Code |
|---|---|
| `clarification.required` non-empty ⟺ `status: blocked_on_clarification` | `clarification-status-mismatch` |
| every axis or artifact entry in state `missing_material` appears in `clarification.required` | `missing-material-unlisted` |
| a `confirmed`/`assumed` axis or artifact value resolves to a real profile under its axis directory (`profile-core.mjs#loadAxisProfiles`) — or names a declared `planned`/`deferred` id, reported as a **note**, never a silent pass and never a hard failure, matching `scripts/validate-profiles.mjs` | `unknown-profile` (fail) / note (planned or deferred) |
| an `axes.artifacts[]` value's modality prefix (`visual/…`, `audio/…`, …) matches its resolved profile's own `modality` field | `artifact-modality-mismatch` |
| `clarification.asked.length > 3` requires a non-empty `clarification.note` | `clarification-gate-exceeded` |
| every `confirmed`/`assumed` axis or artifact value carries a non-empty `basis` | `missing-basis` |

A source id placed in `inputs.references` is caught earlier, structurally:
`reference_input.ref_id` requires the `ref:` prefix
(`$defs/reference_input`), so a `src:`-prefixed value fails schema validation
directly rather than needing a dedicated cross-field rule — the Source ≠
Reference split (spine §2) is enforced by the two id vocabularies never
overlapping, not by a lookup.

## `intent_id` as the lineage anchor

`intent_id` (`intent:YYYY-MM-DD-<slug>`) is created once, at intake, and
never mutated. Every downstream record that exists because of this request —
an Article Frame, an Editorial Package, a visual job, a feedback record —
cites it. This is what makes a later question answerable without replaying
the conversation: "which calibration produced this axis choice," "which
utterance justified this audience," "was this artifact route confirmed or
assumed" all resolve by following `intent_id` back to one immutable record,
per the auditability requirement spine §7 places on every durable learning
input. `calibration_ref` performs the matching function for calibration:
it pins the version that was *active* at intake, so a later verdict is never
silently re-attributed to whichever calibration happens to be current when
someone reads the record.

## Source ≠ Reference, placed at intake

`inputs.sources` and `inputs.references` are separate arrays because they
answer separate questions (spine §2: *is this true?* vs. *is this good?*).
Intake is where the split first happens, because the human's utterance
usually names both in one breath: "이 자료로 글 써줘, 이 이미지 참고해서" names
a source (the material to write from) and a reference (the image to learn a
craft dimension from) in the same sentence. Intake's job is to place each
noun phrase in the array that matches the question it answers, never to let
one asset satisfy both — the spine is explicit that an asset registered as
both needs two separate records, never one doing double duty.

A reference additionally carries `dimensions` (`$defs/reference_input`) when
the human's utterance singles out *part* of what makes the reference good:
"정보 구조는 좋은데 색감은 싫어" (structure is good, color is not) names one
dimension to adopt (from the vocabulary in
`editorial/profiles/reference/<modality>.json`) and implicitly rejects
another. Intake records the adopted dimension in `dimensions` and the
rejected one as a same-request `overrides` entry — never as wholesale
imitation of the reference, and never as a factual claim, since a reference
carries craft evidence only.

## Context budget at intake (spine §9)

Intake loads exactly two things before it can resolve any axis: `axes.json`
(the registry, to know which directories exist) and the profile files the
*resolved* intent actually names — never every profile in a populated axis
directory, and never the reference or feedback corpus. A content-type
decision between `research` and `note` loads those two profiles, not all
seven under `editorial/profiles/content/`. This is mechanical, not
aspirational: `loadAxisProfiles` (`scripts/lib/profile-core.mjs`) can load a
whole axis directory, but intake calls it only for the axis id a resolved
value already names, and only to fetch `profile_ref` and confirm the id
exists — it does not read the reference or feedback corpus at all, those
being upstream of `evaluate-reference` (AES-V2.4) and downstream of feedback
routing (AES-V2.5), neither of which intake is.
