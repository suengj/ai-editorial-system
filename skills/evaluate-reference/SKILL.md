---
name: evaluate-reference
version: 0.1.0
description: Turn a reference into a compact, validated craft-evidence record, and select a bounded set of relevant evaluations for an Editorial Intent as explicit adopt/avoid/do_not_copy constraints.
when_not_to_use: Do not use to check whether a claim is true — that is verify-claims, and a reference evaluation may never be read by it. Do not use to write or generate the article, image, or audio itself; this Skill produces constraints for that step, not the output.
inputs:
  - a reference pointer from references/catalog.json, or material plainly implying a new one
  - the matching modality profile under editorial/profiles/reference/
  - for selection, an Editorial Intent (schemas/editorial-intent.schema.json)
outputs:
  - one append-only reference-evaluation record (schemas/reference-evaluation.schema.json), carrying a provenance_class
  - for selection, a bounded set (normally 1-3) of relevant evaluations, each tagged with its provenance_class, reduced to the dimensions relevant to the requesting intent, expressed as adopt/avoid/do_not_copy constraints, plus an explicit flag when every selected positive reference shares one generation lineage
requires:
  - the reference's modality, to select the correct profile
  - a resolvable ref_id in references/catalog.json (or the material to add one, per RIGHTS-AND-PROVENANCE.md)
  - the reference's provenance_class (external, owner_created, or generated_output)
authority:
  may:
    - assign adopt, avoid, do_not_copy, or neutral verdicts per dimension
    - decide a bounded selection of evaluations relevant to one Editorial Intent
    - decide that no reference is relevant, and select none
    - refuse to select a reference whose evidence does not cover the requested artifact family or modality
    - flag when a selection's positive references all descend from one generation lineage
    - prefer a genuinely relevant external or owner_created reference over a generated_output one when both fit equally well
  may_not:
    - set an article, artifact, or package to status published
    - record human approval
    - emit or imply a factual claim — a reference evaluation grants craft evidence only
    - be read by verify-claims, or read verify-claims output, as if it were factual authority
    - copy a reference's body into a generated artifact — selection emits traits and constraints, never the reference itself
    - load the full corpus of any reference by default
    - treat publication or an L1 pass as promotion for a generated_output reference
    - apply a fixed external-vs-internal diversity quota that overrides relevance
governed_by:
  - editorial/constitution.md
  - editorial/RIGHTS-AND-PROVENANCE.md
  - references/REFERENCE-EVALUATION-PROTOCOL.md
  - docs/architecture/V2-EDITORIAL-LEARNING-CORE.md
allowed_tools:
  - file_read
  - file_write
evidence:
  acceptance:
    - every produced evaluation validates against schemas/reference-evaluation.schema.json
    - every produced evaluation's authority_boundary is craft_evidence_only and asserts no fact
    - a selection for one intent returns a bounded set (normally 1-3), never the full corpus
    - a selection never emits a reference body, only dimensions and verdicts
    - a generated_output evaluation carries an adopt verdict only when it also carries a promotion block whose basis is more than "published" or "L1 pass"
    - a selection whose positive references are all generated_output from one lineage is flagged in the output, not silently returned
    - no selection drags in an irrelevant external reference solely to satisfy a diversity ratio
  fixtures:
    - references/evaluations/ap-ai-newsroom-standards/ap-ai-newsroom-standards-2026-09-05-01.json
    - references/evaluations/denoiser-consumption-architecture/denoiser-consumption-architecture-2026-09-05-01.json
---

# evaluate-reference

## Purpose

Two bounded jobs, both about craft evidence and neither about fact: turn a
reference into a validated evaluation record, and, later, select a small set
of those records relevant to one Editorial Intent. This is the only Skill
permitted to write under `references/evaluations/`.

## Inputs

**Evaluate:** a reference — already pointed at in `references/catalog.json`,
or material that plainly needs a new pointer first per
`references/REFERENCE-EVALUATION-PROTOCOL.md` §4 step 1 — plus the modality
profile that matches it (`editorial/profiles/reference/{text,visual,audio}.json`).

**Select:** an Editorial Intent
([`schemas/editorial-intent.schema.json`](../../schemas/editorial-intent.schema.json))
carrying resolved content-type, audience, artifact, and surface axes, plus
`inputs.references` when the human named specific material.

## Outputs

**Evaluate:** one new record conforming to
[`schemas/reference-evaluation.schema.json`](../../schemas/reference-evaluation.schema.json),
written append-only under `references/evaluations/<ref-id-slug>/`, followed by
`node scripts/registry.mjs --rebuild` and `--validate`.

**Select:** a short list — normally 1-3 evaluations — each reduced to only the
dimensions relevant to the requesting intent's audience/artifact/content-type,
phrased as `adopt` / `avoid` / `do_not_copy` constraints, and each tagged with
its `provenance_class`. If every positive (non-`avoid`/`do_not_copy`)
reference in the selection shares one generation lineage, the output says so
explicitly. Never the evaluation record verbatim, and never the reference's
own body.

## Preconditions

- The reference's modality is known, so the correct profile can be loaded.
- The `ref_id` resolves in `references/catalog.json`. If it does not yet
  exist, that pointer is created first (rights and provenance are that
  document's job, not this Skill's).
- For selection, the Editorial Intent's relevant axes are `confirmed` or
  `assumed` — not `missing_material` — or the selection is scoped to what is
  actually resolved.

## Procedure

### Evaluate

1. Resolve `ref_id` and `modality`; load the matching profile.
2. Score each dimension the profile lists: `adopt`, `avoid`, `do_not_copy`, or
   `neutral`, with a short `note` and, where available, `evidence`. Use the
   profile's `imitation_risk` per dimension to decide `adopt` vs
   `do_not_copy` — a trait can be good and still not transferable (see
   `references/REFERENCE-EVALUATION-PROTOCOL.md` §5).
3. Fill `applicable_to` (content types, audiences, artifacts, surfaces) from
   what the evaluation actually supports — leave an axis empty rather than
   guessing it applies everywhere.
4. Set `basis`: `explicit_human_feedback` when a human stated the verdict,
   `model_inference` when this Skill inferred it unaided. Never claim the
   stronger basis to make a record look more authoritative.
5. Set `provenance_class`: `external` for independently created third-party
   or public work, `owner_created` for the owner's own work made outside the
   current generation loop, `generated_output` for anything this system or an
   agent using it produced. A `generated_output` reference is legitimate and
   useful as evidence on its own — see step 6.
6. Set `authority_boundary: craft_evidence_only` — always. This record may
   inform a generation or selection step; it may never be cited as
   established fact anywhere downstream.
7. If `provenance_class` is `generated_output` and a dimension is scored
   `adopt` — i.e. this evaluation is asserting the output as a reusable
   positive trait, not merely retaining it as real-output evidence — attach a
   `promotion` block (`authorized_by`, `basis`, `evidence_refs`,
   `promoted_at`). Publication and an L1 pass are never sufficient `basis` on
   their own (`references/REFERENCE-EVALUATION-PROTOCOL.md` §6); without a
   qualifying promotion, score the dimension `neutral` instead and let the
   record stand as evidence rather than as a positive reference.
8. Write the record, rebuild the index, validate. If this evaluation follows
   up on an earlier one about the same reference, set `supersedes` — never
   edit or remove the earlier record.

### Select

1. Filter evaluations whose `applicable_to` overlaps the intent's resolved
   axes, preferring an artifact-family match over a general modality match
   (a body-infographic evaluation is weak evidence for a thumbnail request —
   see each profile's `selection_hints`). Relevance is the primary criterion
   throughout this procedure — provenance never overrides a genuine fit.
2. Among the relevant candidates, when two or more fit comparably well and at
   least one is `external` or `owner_created`, prefer that one over a
   `generated_output` candidate — this is a tie-break, not a quota, and does
   not apply when the `generated_output` candidate is simply the better fit.
3. Stop at a small bounded set — normally 1-3. More candidates than that means
   narrowing the filter further, not returning more evaluations, and never
   means padding the set with an irrelevant reference to hit a diversity
   target.
4. Check the selected set's positive references (`adopt` verdicts, or a
   selected evaluation with no `avoid`/`do_not_copy` dimension in play) for
   shared lineage: if every one of them is `generated_output` and traces to
   the same generation lineage, state that explicitly in the output rather
   than returning it as if it were independent corroboration. This is a
   detectable-and-disclosed signal, not a block — a genuinely relevant,
   well-evidenced `generated_output` selection may still be the right answer
   when no independent reference fits as well.
5. From each selected evaluation, emit only the dimensions relevant to this
   intent, as `adopt` / `avoid` / `do_not_copy` constraints, tagged with the
   evaluation's `provenance_class`. Drop dimensions the profile marks
   `not_authoritative_for` this artifact/modality.
6. Load a reference's full body only when the compact evaluation is
   demonstrably insufficient for the task at hand, and state why in the
   handoff. This is the exception, not the default path — see
   `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §8.
7. Hand the constraint set to the generation/review step. Do not hand back
   the evaluation record's full JSON or the reference body.

## Invariants

- A reference is evaluation context, never a template. Nothing this Skill
  produces is a body to copy from.
- The full reference corpus is never loaded by default; only compact
  evaluations are, until one is shown insufficient.
- `do_not_copy` is a distinct verdict from `avoid`: it marks a trait admired
  but not safe to transfer, and it must never collapse into `adopt` merely
  because the trait is good.
- Records are append-only. A changed judgement is a new record with
  `supersedes` set, never an edit to an existing file.
- `evaluate-reference` never emits a factual claim, and its output is never
  read by `verify-claims` as evidence of fact. The Source/Reference boundary
  is enforced in both directions.
- A `generated_output` reference may be retained as real-output evidence
  without ever being promoted; it is never treated as an `adopt`-able
  positive reference on the strength of publication or an L1 pass alone.
- Two failure modes are equally unacceptable and neither is fixed by
  reaching for the other: **silent collapse** (every positive reference in a
  selection descends from the same generation lineage, and nothing says so)
  and **arbitrary diversity** (an irrelevant external reference is added
  purely to satisfy a ratio). Provenance breaks ties and raises a flag; it
  never overrides relevance and never sets a quota.

## Refusal conditions

This Skill stops and reports rather than producing a record or a selection
when:

- the reference's modality cannot be determined, so no profile can be
  matched;
- the material has no resolvable `ref_id` and adding one is out of scope for
  this step (it defers to the catalog/rights protocol first);
- for selection, no evaluation's `applicable_to` overlaps the intent at hand
  — the correct output is an empty selection with that stated, not a forced
  match.

## Evidence

Every produced record is checked by `node scripts/registry.mjs --validate`:
schema conformance, `ref_id` resolution against `references/catalog.json`, no
embedded reference body or blob, and no factual-claim language in a
craft-evidence record. Index freshness is checked by
`node scripts/registry.mjs --check`.

## Authority

This Skill decides craft evidence and its bounded selection. It does not
decide what is true, does not write or render the artifact, does not publish,
and nothing it produces constitutes human approval. A future modality
(video, etc.) adds a fourth profile file under
`editorial/profiles/reference/`; it does not require rewriting this Skill.
