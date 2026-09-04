# Reference evaluation protocol (AES-V2.3 / SUE-561)

How an agent turns a chat utterance about a reference into a validated,
append-only record — with **no manual JSON editing by the human**, ever. Any
agent runtime (ChatGPT, Claude, Codex-style) follows the same protocol,
because the protocol is this document plus the schemas, not a runtime's
memory of a conversation.

Machine contracts: [`../schemas/reference-evaluation.schema.json`](../schemas/reference-evaluation.schema.json),
[`../schemas/feedback-record.schema.json`](../schemas/feedback-record.schema.json).
Enforcement: `node scripts/registry.mjs --validate|--rebuild|--check`.
Governing model: [`../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`](../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md)
§2 (Source is not Reference), §5 (routing layers), §9 (Agent auto-application —
the change-scope ladder this protocol implements for rungs 0–2).

## 1. The owner never names a file

Nothing below ever requires the human to say a schema name, a file path, a
`ref_id`, a routing layer, or a Skill. The owner says what they think; the
agent decides which record type, if any, that becomes, and where it lives.
An agent that asks "which schema should I use?" or "what should the
`ref_id` be?" has failed this protocol.

## 2. Not every utterance writes a file — the change-scope ladder

§9's change-scope ladder is the only authority for how far an agent may go
without asking. This protocol only ever produces rungs 0–2; profile edits,
calibration versions, and constitutional change are out of scope here and are
never triggered by a reference evaluation or feedback record — they are only
ever *evidenced* by one, later, by a human or by AES-V2.10.

| Rung | Trigger here | Repository effect |
|---|---|---|
| 0 | A one-off note about this run only ("이번 글만 색을 좀 줄여줘") | **none** — stays in the task's Editorial Intent / conversation, expires with the task |
| 1 | Feedback on something the system produced | append one `feedback/records/*.json`, rebuild `feedback/index.json` |
| 2 | "이걸 reference로 추가해" / "이 스타일 참고해" — asked or plainly implied craft evidence about third-party material | append one `references/evaluations/**/*.json`, rebuild `references/index.json` |

**Rung 0 is the default and by far the most common outcome.** A complaint
about one piece is evidence about that piece, not a standing instruction. Do
not create a record merely because feedback occurred; create one when the
feedback is about something durable enough to be worth finding again
(a reference worth reusing, or a failure worth routing).

Rungs 1 and 2 are automatic — no confirmation step, no dry run — precisely
because they are cheap and reversible: an append-only record, then a
deterministic index rebuild, then validation. There is nothing to "undo" that
isn't already an immutable, superseded-not-deleted history.

## 3. The one clarification this protocol authorizes

"이번 글만" (this piece only) and "앞으로" (from now on) are different
instructions and route to different rungs — a one-off stays at rung 0; a
standing statement is still only ever evidence *toward* rung 3+ (§9), never a
direct edit to a profile or calibration.

When an utterance is genuinely ambiguous between the two — not merely
unspecified, but plausibly either — ask exactly **one** question, offer the
two readings, and default to task-local (rung 0) if the human doesn't answer
or authorizes "알아서 해" / "use default" (per §4 of the V2 core doc). Do not
ask about anything else at this step: not which dimension, not which file,
not which ref_id. Those are the agent's job to derive from the utterance and
from `references/catalog.json` / the subject the feedback is about.

## 4. Reference evaluation (rung 2) — from utterance to record

Example utterance: *"이걸 reference로 추가해 — 정보 구조는 좋은데 색감은
싫어"* (add this as a reference — the information structure is good, the
color is not).

1. **Resolve or create the catalog pointer.** If the material already has a
   `ref_id` in `references/catalog.json`, reuse it. If not, this is first a
   `references/catalog.json` entry (governed by
   [`../editorial/RIGHTS-AND-PROVENANCE.md`](../editorial/RIGHTS-AND-PROVENANCE.md)
   and `npm run validate:rights`) — rights and pointer metadata, never a copy
   of the body — and only then an evaluation. **A new catalog entry is needed
   when the material has never been pointed at before; only a new evaluation
   is needed when it already has a `ref_id` and someone has a new opinion
   about it.**
2. **Pick the modality profile.** `editorial/profiles/reference/{text,visual,audio}.json`
   by the reference's modality. This selects the dimension vocabulary — the
   agent does not invent dimension names.
3. **Map the utterance onto dimensions.** "정보 구조는 좋은데" → the
   structural/hierarchy dimension gets `verdict: adopt`. "색감은 싫어" → the
   palette dimension gets `verdict: avoid`. A trait that is admired but not
   safe to transfer (a house style, a proprietary aesthetic) gets
   `verdict: do_not_copy`, not `avoid` — see §5.
4. **Fill `applicable_to`** from the task's Editorial Intent axes when one
   exists (content type, audience, artifact, surface already resolved there);
   otherwise from what the utterance plainly implies. Leave an axis's array
   empty rather than guessing.
5. **Write the record**, append-only, under
   `references/evaluations/<ref-id-without-"ref:">/<evaluation-id-slug>.json`.
   Never edit or delete an existing evaluation file. A changed opinion is a
   new record with `supersedes` pointing at the earlier one.
6. **Rebuild the index**: `node scripts/registry.mjs --rebuild`.
7. **Validate**: `node scripts/registry.mjs --validate`.

## 5. `do_not_copy` vs `avoid`

`avoid` means the trait itself is a weakness — don't reproduce it because it
is not good.

`do_not_copy` means the trait is genuinely good — and copying it anyway would
be imitation with no craft justification, because it belongs to someone
else's house style, institutional structure, or protected expression (see
`editorial/RIGHTS-AND-PROVENANCE.md` §5 on vendoring another project's work).
`imitation_risk` in the modality profile is what lets `evaluate-reference`
tell these apart without asking the human each time.

## 6. Provenance class and the self-reinforcement guard

As this system generates more, its own outputs become the most plentiful and
the most semantically relevant references available to it. A selection policy
that ranks by relevance alone will, over time, feed generation mostly on its
own prior generations — the system starts imitating itself and quietly
converges on its own tics. `provenance_class` exists to make that risk
visible and interruptible, not to gate it mechanically.

Every evaluation records where the reference actually came from:

- `external` — third-party or public work, independently created;
- `owner_created` — the owner's own work, made outside the current generation
  loop (a hand-written note, a manually composed image, an existing
  suengj-com article written before this system generated anything);
- `generated_output` — produced by this Editorial Learning Core or an agent
  using it.

**A `generated_output` record may sit in the registry indefinitely as
real-output evidence — useful to AES-V2.6's corpus and to owner-specific
calibration — without ever becoming a positive Reference.** These are
different roles and must not be conflated: evidence that a past generation
happened and what it looked like is not the same claim as "reuse this trait."

### Promotion is not publication and is not an L1 pass

A `generated_output` record earns the right to carry an `adopt` verdict — to
be selected later as a positive craft example — only through an explicit
`promotion` block: `authorized_by`, `basis`, `evidence_refs`, `promoted_at`.
The block is absent on every record that has not been promoted; its presence
is the promotion.

Publication is not promotion. An L1 pass is not promotion. Both are necessary
conditions for an artifact to exist in public at all, and neither is evidence
that the artifact's craft traits should now seed future generation — that
requires the owner's explicit approval, or evidence strong enough that
AES-V2.10's evaluation contract accepts it, always cited via non-empty
`evidence_refs`. `scripts/registry.mjs --validate` rejects a `generated_output`
record with an `adopt` verdict and no promotion block, and rejects a promotion
whose only stated basis is "published" or "L1 pass" or whose `evidence_refs`
is empty.

### Selection must not silently collapse, and must not fake diversity

`evaluate-reference`'s selection half (`skills/evaluate-reference/SKILL.md`,
"Select" under Procedure) considers
provenance class alongside relevance for exactly one reason: to detect when
every positive reference it is about to hand back descends from the same
generation lineage, and say so. This is a surfaced signal, not a hard block —
relevance stays the primary criterion. The Skill does not enforce a fixed
external-vs-internal ratio; dragging in an irrelevant `external` reference
purely to satisfy a quota is exactly as much a failure as silent collapse
onto one lineage, and both are named explicitly in the Skill body.

## 7. Feedback (rung 1) — from utterance to record

Example utterance: *"이 결과 별로야, 문단이 소스 순서대로야"* (this result
is bad, the paragraphs follow the source's order).

1. **Identify the subject** — the artifact, article, or package this is about
   — from the task context, not from the human naming an id.
2. **Pick exactly one signal** (§6 of the V2 core doc): objective quality,
   audience fit, publication fit, or owner preference. Never blend two into
   one record; write two records if the utterance genuinely carries two
   separate judgements.
3. **Name a layer, or say you can't.** Use the shared routing vocabulary
   (§5 of the V2 core doc). "Paragraphs follow the source order" is a
   `frame` failure (the argument's structure), not a `text` polish note —
   repairing it as polish is routing error #1 that §5 names explicitly. When
   the record cannot attribute a layer with real confidence, set
   `routing.layer: null` and `routing.abstained: true` with a rationale.
   Guessing a layer to fill the field is worse than admitting it isn't known.
4. **Set `owner_verdict`, separately from `verdict`.** `verdict` is this
   evaluator's read of the output's quality; `owner_verdict` is whether the
   owner actually accepted it — `accepted`, `rejected`, `needs_rework`, or
   `unknown`. `unknown` is the default and must be written explicitly, never
   omitted and never inferred as `accepted`. **Silence is not acceptance**:
   publication, an L1 PASS, the absence of complaint, and time passing are
   never grounds for `accepted`. Only set a value other than `unknown` when
   `evaluator.type` is `human`, or `basis` is `explicit_human_feedback` — an
   agent may record what the owner said; it may never conclude acceptance
   (or rejection) on the owner's behalf. `scripts/registry.mjs --validate`
   rejects an ungrounded `owner_verdict`.
5. **Set `scope: task_local`** — the default. Only set
   `calibration_candidate` when the human explicitly declares a durable
   preference change ("앞으로 항상...") or when this record is one of
   several independent ones about the same trait, and even then it must
   carry `evidence_links` naming the corroborating records — see §9's rung
   3+ boundary and `evidence_links` in the schema. A single record, human-
   or agent-authored, never promotes itself; a `calibration_candidate` with
   no `evidence_links` is rejected by `scripts/registry.mjs --validate`, and
   so is any `model_inference`-basis record claiming it at all — agent
   consensus may never silently replace human preference.
6. **Write the record**, append-only, under
   `feedback/records/<feedback-id-slug>.json`. Rebuild and validate as above.

## 8. What is never copied

Raw third-party bodies, screenshots, transcripts, or large media are never
embedded in an evaluation or feedback record. Point at the source via the
existing `references/catalog.json` pointer (URI, license, attribution) and
describe what was observed in `note`/`evidence` text. `scripts/registry.mjs
--validate` fail-closes on anything that looks like an embedded body — a data
URI, a long base64 run, or an implausibly long string field.

## 9. Size and lifecycle

Many small records, one derived index per collection, no database, no vector
store. `references/index.json` carries a `counts.by_provenance_class` and
`counts.promoted_generated_output` summary alongside the flat evaluation list
specifically so self-referential concentration is measurable later without
scanning every record — see §6. `references/index.json` and `feedback/index.json`
carry
`generated: true` and are rebuilt byte-identically by
`node scripts/registry.mjs --rebuild`; `--check` fails when the file on disk
is not exactly a fresh rebuild, which is what makes "reconstructable from
records" enforced rather than claimed.

Compaction (e.g. archiving very old task-local feedback) is not implemented
here and should not be, absent measured growth that justifies it — see
V2-EDITORIAL-LEARNING-CORE.md §10, "What V2 must not become" #7: no database
or framework introduced for convenience.
