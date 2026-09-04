# Feedback routing and targeted tuning (AES-V2.5 / SUE-563)

When output is bad, the question this document exists to answer is never
"what rule should I add?" It is **"which layer produced this?"** — and,
failing that, an honest "I cannot tell."

Machine contract: [`feedback-routing.json`](feedback-routing.json). Engine:
[`../scripts/lib/routing-core.mjs`](../scripts/lib/routing-core.mjs). Run:
`npm run validate:routing` / `npm run test:routing` (see `package.json`).

This document routes **into** the fields already defined by
[`../schemas/feedback-record.schema.json`](../schemas/feedback-record.schema.json)
— `routing.layer`, `routing.modality_layer`, `scope`, `signal`, `verdict`,
`owner_verdict`. It does not redefine any of them.

---

## 1. The layer vocabulary

The only legal routing targets are the ones fixed by
[`../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`](../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md)
§5:

```text
SHARED       intake · reference · audience · frame · verification · surface · calibration
TEXT         writing · polish · register
VISUAL       artifact_route · semantic_spec · information_density · composition · brand_profile · renderer
AUDIO        spoken_script · dialogue_structure · pronunciation · pacing · delivery · tts_render
```

`schemas/feedback-record.schema.json`'s `routing.layer` enum carries only the
seven SHARED ids (plus `null`) — that enum is upstream and fixed. A
modality-specific layer (`polish`, `renderer`, `tts_render`, …) is not the
same failure as any SHARED layer, and asserting otherwise is itself a
misroute — a `polish` defect is not a `frame` failure merely because `frame`
is the nearest available shared box. So a record names exactly one of three
states, and they must never collapse into each other:

| State | `routing.layer` | `routing.modality_layer` | `routing.abstained` |
|---|---|---|---|
| Shared-layer cause | one of the seven SHARED ids | optional free-text detail | `false` |
| Modality-only cause | `null` | a declared TEXT/VISUAL/AUDIO layer id | `false` |
| Abstention | `null` | absent | `true` |

`layer: null` with `abstained: false` is **not** abstention — it says "the
answer is modality-specific," which is a decided, confident routing, not "I
cannot tell." A new modality adds its own TEXT/VISUAL/AUDIO layer ids to this
same three-state scheme; it does not get a new framework, and it does not get
a false identity mapping onto a SHARED layer either.

For each layer, `feedback-routing.json` encodes:

| Field | Meaning |
|---|---|
| `owns` | What failure actually belongs here |
| `symptoms` | Observable signatures a router matches on |
| `repair` | The smallest change that fixes this layer |
| `do_not` | The misroute this layer is most often confused with |
| `authority_class` | The write-authority class (§4 below) this layer's default automatic repair sits in |
| `escalates_to` | The next layer, or a human-authorization sentinel, when evidence accumulates beyond a single-task fix |

## 2. The three misroutes this vocabulary exists to prevent

Encoded as explicit `do_not` entries with machine-checkable trigger keywords
where the spine names them directly:

1. **A frame failure repaired in polish** (`frame.do_not → polish`). The
   article stays wrong and reads better.
2. **A renderer defect promoted to a brand-profile change**
   (`renderer.do_not → brand_profile`). One bad render rewrites the house
   style.
3. **A reference-selection failure promoted to a content rule**
   (`reference.do_not → writing`). The system accumulates prose rules for a
   lookup bug.

`scripts/lib/routing-core.mjs` detects these mechanically: when a record names
a `do_not` target layer while its statement matches the *problem* layer's own
symptom keywords, the record is flagged. This is deliberately the same
keyword-gate style as `editorial/quality-gates.json` — mechanical where
mechanical is honest, and never claimed to be a complete classifier.

## 3. The tuning procedure

```text
failure evidence
  → root-cause layer (or explicit abstention)
  → smallest justified change
  → rerun L0 fixtures + relevant real corpus (evals/real-output-corpus/)
  → keep | revert | insufficient evidence
  → experiment ledger record (AES-V2.10)
```

A frame problem is never hidden by a polish fix. A renderer defect never
rewrites the global visual style. A reference-selection failure never becomes
a content rule. These are not aspirations — they are the three `do_not`
entries above, enforced.

## 4. The write-authority matrix

`feedback-routing.json`'s `authority_matrix` is the executable form of the
seven-class ladder in
[`../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md`](../docs/architecture/V2-EDITORIAL-LEARNING-CORE.md)
§10. The ladder itself is cited, not restated here:

```text
0  task-local override                          automatic
1  feedback/evaluation record append             automatic
2  reference evaluation metadata                 automatic under the protocol
3  calibration candidate / DRIFT_CANDIDATE       automatic
4  calibration activation                        explicit human intent
5  profile / core routing change                 evidence-backed review
6  Constitution / core invariants / SSOT         human authorization + independent Reviewer
```

Authority is semantic, never path-based: a file can be renamed and the class
it belongs to does not change.

### What this makes impossible

A `feedback-record` can only ever declare `scope: task_local` or
`scope: calibration_candidate` — that enum structurally tops out at class 3.
**There is no field on a feedback record that can express class 4, 5, or 6.**
Those classes require an act the record cannot itself contain: explicit human
activation, evidence-backed review, or human authorization plus an
independent Reviewer.

`routing-core.mjs` adds one more check on top of that structural limit: a
record whose `statement` or `routing.rationale` *proposes* a class-4-or-above
change in words — "update the brand profile," "this should become a
Constitution rule," "change the core router" — is rejected regardless of
`scope` or how many `evidence_links` it cites. A single complaint, however
well corroborated, cannot author its own promotion past class 3. This is the
control that makes "one complaint becomes a Constitution change" impossible
by construction rather than by discipline.

## 5. Anti-overfitting policy

One disliked output is evidence. It is not a rule.

Durable calibration change (class 4 and above) requires either:

- **repeated independent evidence** — multiple `evidence_links` from separate
  tasks or evaluators pointing at the same layer and the same failure shape;
  or
- an **explicit owner declaration** that the preference itself has changed,
  not merely that one output missed it.

Anything less is a task-local override (class 0) and expires with the task.
A record with `scope: calibration_candidate` and a single, self-referential
`evidence_links` entry is not sufficient on its own — see
`schemas/feedback-record.schema.json`'s own note that "a single record, human-
or agent-authored, never promotes itself."

## 6. Four signals, never averaged

Kept separate everywhere a verdict is recorded (`feedback-record.schema.json`
`signal` enum):

```text
1. objective_quality      dominates; may not be traded
2. audience_fit
3. publication_fit
4. owner_preference       changes over time; versioned, never rewritten
```

A stylistically better output that is less true always loses. A record that
resolves a conflict between these by averaging them into one number has
already failed, regardless of what layer it names.

## 7. Abstention is a valid routing outcome

A router that cannot name a layer says so. `routing.layer: null` with
`routing.abstained: true` is not a defect in the record — it is the honest
result when a complaint is genuinely underspecified ("this doesn't feel
right," with no follow-up).

What is a defect: a **negative** verdict (`verdict: "bad"`) that names no
layer and does not abstain either. That is a router guessing silently, and
`routing-core.mjs` rejects it — see the `abstention-required` check.

## 8. Precedence this document does not override

`editorial/HITL-PROTOCOL.md` and `evals/RUBRIC.md` remain the stronger
authority wherever they already govern the same ground: integrity dimensions
still dominate editorial ones, polish still cannot approve, and human
finalization is still not automatable. This document routes *feedback about*
those layers; it does not relitigate what they already decide.
