# HITL protocol (AES-P5.1 / SUE-457)

Human authority, made explicit enough that "AI finished a draft" can never be
mistaken for "the owner approved a canonical article".

Machine contract:
[`../schemas/review-record.schema.json`](../schemas/review-record.schema.json).
Engine: `../scripts/lib/hitl-core.mjs`. Run: `npm run validate:hitl`.

Designed for an ordinary chat conversation. Every field is something a person
says in a sentence; there is no bespoke UI, no review database, and no Google
Docs workflow.

## Five stages

```text
frame → draft → verification → polish → final
```

| Stage | The human is asked | Required |
|---|---|---|
| **frame** | Is this worth writing, and is that the thesis? | **Yes** |
| **draft** | Does the argument hold, and is the value-add real? | Optional |
| **verification** | Are the material claims supported, current, and not contradicted? | **Yes** |
| **polish** | Does it read as ours, without a fact having moved? | Optional |
| **final** | Is this the canonical article? | **Yes** |

Two are optional because a short piece may not need them. Three are not: a
finalization without an accepted `frame`, `verification`, and `final` review is
rejected.

Stages move forward. A revision restarts the sequence rather than reordering
it — going back to `draft` after `polish` means the later stages happen again.

## Feedback is routed, not just recorded

Every feedback item names the artifact it actually changes:

| `changes` | Example |
|---|---|
| `frame` | "The thesis is really about X" |
| `draft` | "Move the mechanism before the consequence" |
| `verification` | "That causal claim needs checking" |
| `final_article` | "The last paragraph summarises; end on the consequence" |
| `presentation` | "This caution deserves separation" |
| `nothing` | An observation for next time |

Routing matters because a thesis complaint that gets applied to the prose
produces a better-written piece with the same wrong argument. The most common
review failure is fixing the sentence instead of the frame.

## Material changes force re-verification

A feedback item is `material` when it touches a fact, number, date, citation,
quotation, or the claim set.

**A material change after verification is unverified until verification runs
again.** Enforced: material feedback at any stage that is not followed by a
later `verification` review is rejected.

Two routing rules follow from it, both enforced:

- Feedback that changes verification must be marked material.
- A material change raised during **polish** belongs to verification, not to
  the article text. Polish reports it; polish does not fix it.

## Polish cannot approve

Accepting a polish pass means the prose reads well. It does not mean the
article is final, and finalization requires a separate accepted `final`
review — never a polish acceptance standing in for one.

This is the same shape as the Skill authority boundary: `editorial-polish`
cannot record approval, and neither can its review stage.

## Approval applies to the version that was read

Every review records `against_version`. The finalization records
`article_version`, and the two must match.

If the article moved between the human reading it and the record being
written, the approval is for a version nobody saw — rejected. Where a review
covers claims, `against_claims_hash` pins them too.

## Final ≠ Published

| | Meaning | `suengj-com` |
|---|---|---|
| **Final** | The owner accepts this as the canonical article | `status: draft` |
| **Published** | The owner separately decides it goes live | `status: published` |

The finalization receipt's `target_status` is `const: "draft"` in the schema —
not a default, a constant. The field exists so that an attempt to finalize
straight to published is *visible* rather than possible.

Publication requires a recorded `approved_by` and `approved_at` on the
article, and nothing in this protocol can supply them.

## The finalization receipt

```yaml
finalization:
  at: 2026-08-31T18:00:00Z
  finalized_by: Suengjae Hong      # a person
  article_version: 3
  content_hash: <sha256>
  claims_hash: <sha256>
  frame_version: 1                 # traces back to the frame
  verification_at: 2026-08-31T15:00:00Z
  source_ids: [src:drive:..., src:web:...]
  target_status: draft             # always
```

Traceability is enforced: a receipt without `frame_version`,
`verification_at`, and a non-empty `source_ids` is rejected. A final article
that cannot be traced to the frame, the verification, and the sources is not
finalized — it is merely finished.

## Running it in chat

The protocol needs five sentences, not a tool:

1. *"Frame accepted, version 1. Add the negotiated-rate limit to uncertainty."*
2. *"Draft needs revision, version 2. The seat-pricing claim is unsupported —
   check the billing docs."* → material, routes to verification
3. *"Verification accepted, version 3. c3 stays flagged."*
4. *"Polish accepted, version 3. Last paragraph should end on the
   consequence."*
5. *"Final accepted, version 3. Publication decided separately."*

The record is a transcription of those five sentences. That is the whole
protocol — the schema exists so the transcription can be checked, not so the
conversation becomes a form.
