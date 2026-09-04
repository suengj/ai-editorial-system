# V2 certification (AES-V2.11 / SUE-569)

```bash
node scripts/certify-v2.mjs
```

`scripts/certify-v2.mjs` is not wired into `npm run validate`, `npm test`, or
`npm run certify` — it is a separate, on-demand runner, the same way
`evals/system/`'s scorecard is on-demand rather than a per-commit gate. It
runs every V2 gate once and maps the results onto the matrix below.

## The governing rule

`docs/architecture/REPOSITORY-CONTRACT.md`: **"Absence of a finding is a PASS
only when the check demonstrably ran."** This certification applies that rule
to V2 itself, not only to the articles V2 produces. `evals/system/current.json`
already reads `INSUFFICIENT_EVIDENCE` on all ten SUE-573 dimensions, for the
same reason: there is essentially no real operating history yet. A
certification that reported clean `PASS` rows here would contradict that
surface, and a contradiction between two certifications this repository
publishes is worse than either being honestly incomplete. This document is
consistent with `evals/system/current.json`, not more optimistic than it.

## Result

**24/24 mechanical gates passing. 0 pass, 6 partial, 1 deferred, 1 not_run —
of 8 certification areas.**

| | Area | Status |
|---|---|---|
| 1 | Text path — contracts, Skills, L0/L1, routing | PARTIAL |
| 2 | Visual path — profiles, brand, lineage, pre-render gates | PARTIAL |
| 3 | Audio — planning and script contract | DEFERRED |
| 4 | P03 → transformation → Editorial/Knowledge Package → adapter | PARTIAL |
| 5 | Non-suengj.com profile / genuinely generic capability | PARTIAL |
| 6 | Feedback persisted and routed without manual JSON editing | PARTIAL |
| 7 | Calibration/tuning record — real keep-or-change decision | PARTIAL |
| 8 | Cross-agent portability / interpretation regression | **NOT_RUN** |

**No PASS is recorded on any of the eight areas.** Every mechanical gate that
exists (validators, unit/regression tests, the fixture eval, `npm run
certify` for V1, the system scorecard, the calibration validator) runs clean —
that is what makes the underlying claims checkable at all — but "the gate
passes on fixtures" and "this has been proven in real operation" are two
different claims, and V2 has not yet earned the second one anywhere. That is
the honest state of a Core whose last construction issue (this one) closes
before the adoption milestone (SUE-570/571/572) has even started.

## Status legend

| Status | Meaning |
|---|---|
| `PASS` | The check demonstrably ran and succeeded, on real operating evidence. |
| `PARTIAL` | The mechanism exists and is exercised by fixtures/worked examples, but not by real operating evidence. |
| `DEFERRED` | Intentionally out of V2 scope, with the boundary stated. |
| `NOT_RUN` | Cannot be established from this repository, with the reason. |

## 1. Text path

**PARTIAL.** `schemas/editorial-intent.schema.json`, the five V1 Skills
(`frame-article`, `write-article`, `verify-claims`, `editorial-polish`,
`plan-artifacts`), the L0 fixture corpus, `skills/review-l1/`, and
`editorial/feedback-routing.json` all exist, validate, and pass their
regression suites (`validate:intent`, `test:intent`, `validate:routing`,
`test:routing`, `npm run eval`, `npm test`). The routing table's five worked
examples in `schemas/examples/feedback-record-routing.example.json` cover
frame-worth, abstain-on-unclear, reference-repeated, renderer-glitch, and
verification-material cases.

What is missing: a real, owner-reviewed piece of writing that actually
traversed intake → Editorial Intent → frame/write → L0/L1 → a feedback record
with a real routing decision. `feedback/records/` holds two records; both are
synthetic seed examples, not output of a real session (confirmed by
`evals/system/current.json`'s `quality_lift` dimension). Every
`schemas/examples/intent-*.example.json` file is an illustrative shape, not a
captured intake record — three of the five carry a `NOTE` from
`validate-intent.mjs` that `text/article` in the artifact axis is declared
planned but not yet built (see §"Open items" below).

## 2. Visual path

**PARTIAL.** `editorial/profiles/artifact/` (seven visual artifact classes),
`editorial/profiles/brand/suengj-com.v1.json`, and
`schemas/visual-job.schema.json` form a real, schema-enforced lineage chain:
semantic spec → information-gain gate → density check → compiled prompt →
renderer → context isolation → post-render QA. Both pre-render gates named in
the brief are real, not aspirational:

- **Context isolation (SUE-531).** `schemas/visual-job.schema.json`'s
  `context_isolation` is a *required* allowlist, explicitly documented as
  "Models the fix for SUE-531 (built-in generative image attempts leaked
  unrelated recent project/conversation context into dashboard artwork)."
- **Information gain (SUE-534).** `editorial/VISUAL-INFORMATION-GAIN.md` plus
  `visual-job.schema.json#information_gain` gate whether a visual should
  exist at all before compilation is attempted; `scripts/compile-visual-prompt.mjs`
  short-circuits cleanly when the verdict is `skip`.

`validate:visual` and `test:visual` pass against four worked visual-job
examples (body-infographic, evidence-visual, skip, thumbnail-concept).

What is missing, stated plainly because SUE-569 asks for it directly: **no
actual image has been rendered or inspected anywhere in this repository or
its history.** `renderer` lineage fields, `context_isolation`, and
`information_gain` are all exercised as schema/fixture logic; none of them
has been exercised against a real rendering call or a real rendered asset.
Actual asset QA — looking at a picture and judging it — has not happened.

## 3. Audio

**DEFERRED**, with the boundary stated rather than implied. The planning and
script contract is real: `schemas/audio-plan.schema.json`, the three worked
examples (monologue, dialogue, timed-narration), and a script-L1-before-TTS
gate enforced by fourteen deny fixtures in `scripts/test-audio-plan.mjs` —
covering render-before-script-L1, SSML/stage-direction leaks into narration
text, invalid persona disclosure, dialogue collapsing to one voice, and
cost-block violations (`renders_attempted`/`max_attempts`).

**TTS rendering has never been exercised.** No audio file has been generated,
played, or reviewed. This is the correct outcome per
`docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §13: *"Audio is explicitly
deferred from the pilot and must be described as deferred — not as working —
wherever V2 capability is summarised."* This certification follows that
instruction literally: audio planning is real and gated; audio rendering does
not exist yet and is not implied to.

## 4. P03 → transformation → Editorial/Knowledge Package → adapter

**PARTIAL.** `schemas/editorial-package.schema.json` and
`schemas/EDITORIAL-PACKAGE-CONTRACT.md` define a destination-neutral handoff
record, exercised by `validate:package`/`test:package` against five worked
examples spanning the transformation axis
(`editorial/profiles/transformation/`: summarize, synthesize, adapt, recreate,
etc.).

What is missing: the five examples are synthetic constructions written to
exercise the schema's edges, not the output of a real P03 ingestion carried
through a real transformation decision into a package and out through a real
adapter (`suengj-com` or otherwise). No live run of this chain exists in the
repository.

## 5. Non-suengj.com profile / genuinely generic capability

**PARTIAL**, and worth reading carefully rather than at face value. Six
surface profiles exist: `suengj-com`, `academic-paper`, `newsletter`,
`notebooklm`, `youtube-script` under `editorial/profiles/surface/`, plus
`academic` and `promotional` content-type profiles under
`editorial/profiles/content/`. All validate (`validate:profiles`,
`test:profiles`) and are structurally sound — e.g. `academic-paper.json`
states an honest authority split (`core_decides: evidence burden,
verification, and voice fit up to the point of hand-off`; `surface_decides:
citation formatting, submission format, acceptance`), and `notebooklm.json`
correctly declares itself replaceable and holding no editorial authority.

This proves the **axis architecture accepts non-suengj.com data without a
core rewrite** — a real and checkable claim (see question 4 below). It does
**not** prove the Core is "genuinely generic" in the sense SUE-569 asks about.
No Editorial Intent has ever actually resolved against `academic-paper` or
`notebooklm`; no text or visual has been produced under any of these
profiles; no human has judged whether the result was actually good for that
audience/surface. A profile file existing is evidence that the axis can hold
new data. It is not evidence that the system serves that audience well. This
certification does not conflate the two.

## 6. Feedback persisted and routed without manual JSON editing

**PARTIAL.** The mechanism is real and mechanically checked at two levels:
`registry:check` proves `feedback/index.json` is a deterministic, fresh
rebuild rather than a hand-maintained file, and `validate:routing`/
`test:routing` prove `editorial/feedback-routing.json`'s authority matrix
resolves real record shapes correctly — including a legitimate abstention
(`feedback:routing-unclear-2026-09-05`, `routing.abstained: true`, an
honestly-recorded "cannot attribute renderer vs. brand-profile without the
rendered asset" case, which is itself evidence that the visual path in item 2
has not been exercised against a real render).

What is missing: whether an agent has actually taken a natural-language
utterance from the owner ("this paragraph reads out of order") and, without
the owner touching a JSON file, classified it, persisted a feedback record,
and routed it — end to end, in one real session. No such session exists on
record. Both feedback records in the repository were authored directly as
seed data to exercise the schema and validators, not produced by an agent
interpreting spoken/written feedback. The write-authority mechanism (class 0
vs. class 1 in the §10 ladder) is proven capable; it has not been exercised
against a real natural-language trigger.

## 7. Calibration/tuning record — real keep-or-change decision

**PARTIAL**, and this is the item where overstating is easiest, so it is
stated as plainly as possible.
`calibration/ledger/reference-selection-2026-09-05.json` is a real,
schema-valid experiment record — but its own `notes` field says exactly what
it is: *"SHAPE DEMONSTRATION (AES-V2.10 / SUE-568 seed) of an honest
insufficient_evidence decision ... this record exists to prove that 'we
looked and could not yet justify a change' is a legitimate, first-class
ledger entry, not a gap."* Its `decision` field is literally
`"insufficient_evidence"`. That is a real and useful thing to have proven —
the ledger can hold a null result honestly instead of being forced toward
"we changed something." It is explicitly **not** a real keep-or-change
decision: `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §6 requires
*"repeated independent evidence or an explicit owner declaration"* for a
durable calibration change, and no calibration version currently active
(`calibration/versions/audience-beginner-learner.v1.json`,
`audience-domain-expert.v1.json`) has been through a real keep, revert, or
contradiction cycle. `calibration:validate` and `test:calibration` pass; both
prove the ledger/version schema and its invariants are enforced, not that a
real preference decision has been made.

## 8. Cross-agent portability / interpretation regression

**NOT_RUN.** No task in this repository has ever been run through a
non-Claude model/agent route. Per SUE-569's explicit instruction — *"A
portability failure cannot be hidden by certifying only the manager's
preferred model"* — this is reported as `NOT_RUN`, not softened into
`PARTIAL` or omitted.

**An intra-family probe has been run, and it does not change this status.**
[`evals/system/portability/2026-09-05-intra-family-capability.md`](../../evals/system/portability/2026-09-05-intra-family-capability.md)
records one Korean utterance resolved by three Claude capability tiers
(Haiku 4.5, Sonnet 5, Opus 5) against a frozen repository state, compared on
the six semantic contracts below. Its result: the axes, the Source/Reference
boundary, and the calibration firewall agreed unanimously; the clarification
gate produced three different question sets, and the weakest route violated
an explicit contract rule by substituting a plausibility judgement for the
contract's numeric evidence-burden test.

That finding was routed to the contract rather than to a prompt — the
materiality test is now computed by `scripts/lib/materiality-core.mjs`, and
the failing resolution is a named regression fixture.

The probe is real operating evidence and is the first in this repository.
It is **not** the cross-vendor comparison this area requires, and it is
recorded as intra-family evidence only. Area 8 stays `NOT_RUN` until a
genuinely different vendor's agent route resolves the same task. The method a future reviewer should execute is written
out in full in `scripts/certify-v2.mjs`'s matrix item 8 (reproduced here for
readers of this document who are not reading the script):

**Task.** Resolve one small, representative Editorial Intent from a
natural-language request with a materially ambiguous transformation/audience/
surface read — for example the §3 "make it a thumbnail" case (an artifact-axis
change easily mistaken for a style request), or a request ambiguous between
task-local and durable feedback (§4, "이번 글만" vs. "앞으로"). Then route one
piece of natural-language feedback against a fixture output.

**Repository state.** Pin the exact commit SHA both routes read. Both routes
see the identical repository state; neither gets route-specific scaffolding
beyond a thin adapter, per §8's "Generic Core, replaceable edges."

**Routes.** (a) a Claude-family agent (e.g. Claude Code) and (b) a materially
different model family with comparable agentic tool access (e.g. an
OpenAI/ChatGPT or Codex-style route).

**Compare these six semantic contracts** — not prose or image style:

1. **Editorial Intent** — do both routes resolve the same five axes to the
   same `confirmed`/`assumed`/`missing_material` states from the same
   utterance?
2. **Clarification decision** — do both ask (or correctly not ask) on the
   same `missing_material` fields, offering equivalent choices with a
   default?
3. **Source vs Reference** — do both correctly refuse to let a reference
   establish a fact, and refuse to let a source dictate composition?
4. **Audience/profile selection** — do both select the same audience/surface
   profile file for the same request, not merely a similar-sounding one?
5. **Calibration interpretation** — do both read `calibration/current.json`
   the same way, and both refuse to promote an `assumed` value into durable
   preference (the calibration firewall, §4)?
6. **Feedback routing** — do both route the same complaint to the same layer
   in `editorial/feedback-routing.json`, or both correctly abstain when the
   evidence is genuinely insufficient?

**Distinguishing a style difference from a contract-interpretation failure.**
A style difference is any variation in prose wording, image composition
detail, or phrasing that does not change which axis value, which profile
file, which routing layer, or which write-authority class was selected. A
contract-interpretation failure is any case where the two routes select a
*different* axis state, profile file, routing layer, or authority class for
the same input against the same repository state. Variation in generation is
expected and is not evidence of anything; divergence in the six contracts
above is.

**Where the record belongs.** Record the comparison as a system-eval
evidence entry under `evals/system/` (feeding the `portability` dimension
directly — see `evals/system/current.json`'s `portability` dimension, already
keyed to this issue) or a dedicated portability record — not folded into
`feedback/records`, which is scoped to output judgement, not agent
comparison.

**If it fails.** Per SUE-569, route the failure to ambiguous contracts or
profile loading before adding agent-specific prompt hacks. Agent-specific
adapters must stay thin; shared editorial semantics stay in
`ai-editorial-system`, never forked per model.

## Three known evidence gaps (from `evals/system/README.md`)

Carried here rather than restated with different wording, because a second,
drifted description of the same gap is exactly the "two schemas that mean the
same thing" failure §12 of the V2 spine warns against:

1. **No revision/replan/rerender lineage.** `feedback-record.schema.json`
   records a routing decision at the moment of feedback; nothing links it
   forward to whether the repair actually worked or how many attempts it
   took. Limits `routing_effectiveness` and `cost_per_accepted`. Owner
   contract: job/package lineage, most likely AES-V2.10 or a later job-record
   contract — not this certification.
2. **No cost/context proxy on most records.** Only
   `schemas/audio-plan.schema.json#cost` carries
   `renders_attempted`/`renders_accepted`/`cost_per_accepted_artifact`.
   `feedback-record`, `editorial-intent`, and `visual-job` carry none. Limits
   `cost_per_accepted` and `context_efficiency`.
3. **No context-size field anywhere.** No schema records a token/context-size
   proxy at all, so `context_efficiency` has no quantitative evidence source,
   only `visual-job.schema.json#context_isolation`'s qualitative boundary.

## Open item: `text/*` artifact profiles

`editorial/profiles/axes.json` declares `text/article`, `text/brief`,
`text/knowledge-note`, and `text/sources` in the artifact axis with an
explicit `planned_note`: *"Declared but not yet built ... A cross-reference
to a planned id is reported, never silently accepted, and never treated as a
typo."* `validate-intent.mjs` surfaces this as a `NOTE` (not a failure) on
three of the five intent examples. This is by design — the note mechanism
exists precisely so a planned-but-unbuilt reference is visible rather than
silently passing — but it means the text artifact axis is incomplete as
shipped, and any claim about the "text path" (item 1 above) inherits that
incompleteness. Owner contract: extend `schemas/artifact.schema.json` /
`schemas/ARTICLE-ARTIFACT-CONTRACT.md` layering, per the note's own
instruction not to duplicate it.

## What Post-V2 will supply that V2 cannot supply for itself

Per `docs/architecture/V2-EDITORIAL-LEARNING-CORE.md` §13, certification
closes the Core; adoption is a separate, later milestone. V2 cannot certify
its own use — only that it is ready to be used:

- **SUE-570** (real multi-audience text + visual pilot on canonical
  `suengj.com` articles, delivered as a non-published review branch) supplies
  the first real owner-reviewed text and visual output this certification
  cannot manufacture — items 1, 2, and 5 above stay `PARTIAL` until it runs.
- **SUE-571** (owner playbook, written from pilot evidence) supplies the
  natural-language operating guide that would make item 6's "without manual
  JSON editing" claim checkable against real owner behavior rather than
  fixture behavior.
- **SUE-572** (real audience comprehension evidence, non-blocking,
  activated only once enough comparable outputs exist) supplies reader
  evidence distinct from a model's own audience-fit judgement — relevant to
  item 5's "genuinely generic" claim, and explicitly not required before V2
  closes.

None of these are implied to already exist. `evals/system/current.json`'s
`activation.overall: "not_yet_sufficient"` and its seven unmet
`sufficiency_conditions` say the same thing from the evaluation side.

## Spine §14 — the ten questions, answered honestly

| # | Question | Answer | Reason |
|---|---|---|---|
| 1 | Can a person operate this with natural language alone? | **insufficient-evidence** | The intent schema, clarification gate, and write-authority ladder are designed for exactly this and are fixture-tested; no real natural-language session has exercised them end to end (item 1, item 6). |
| 2 | Are Source and Reference separated in contract, not just in prose? | **yes** | Enforced structurally: `verify-claims` may not read reference evaluations, `evaluate-reference` may not emit claims (§2), and `schemas/source.schema.json` / `references/` are separate schemas with separate validators, exercised by `validate:source`, `validate:corpus`. |
| 3 | Does Audience actually change text, image, and audio output? | **insufficient-evidence** | The audience profile schema and its per-modality trait table (§3) are real and referenced by artifact/reference profiles, but no actual text, image, or audio output has been produced under two different audience profiles to compare (items 1–3). |
| 4 | Can a new content type / transformation / surface be added without a core rewrite? | **yes** | Demonstrated directly: `academic`/`promotional` content types and `academic-paper`/`newsletter`/`notebooklm`/`youtube-script` surfaces already exist as pure data additions under `editorial/profiles/`, none touching the router, evaluator, or a Skill — the extension rule (§8) is exercised, not merely stated. This answers a narrower, structural question than item 5; it does not claim those additions are proven to work well (that is item 5, insufficient-evidence). |
| 5 | When output is bad, is the layer to repair identifiable? | **insufficient-evidence** | The routing vocabulary (§5) and its misroute detection (`scripts/lib/routing-core.mjs`, `validate:routing`) are implemented and tested against worked examples and one real abstention case — but no feedback record in the repository traces a routing decision to an actual repair outcome (known gap 1), so "identifiable" is proven at intake time only, not over a real repair cycle. |
| 6 | Do references and feedback improve results without unbounded growth in context or rules? | **insufficient-evidence** | `context_isolation`'s allowlist and the progressive-disclosure design (§9) are enforced structurally, but no context/token-size field exists on any record (known gap 3), so growth cannot actually be measured yet — a structural evidence gap, not an observed problem. |
| 7 | Are the known `suengj.com` visual failures blocked by the new control path? | **insufficient-evidence** | SUE-531 (context leak) and SUE-534 (information gain) both have real, fixture-tested schema gates (item 2) — but since no image has actually been rendered under them, "blocked in production" cannot yet be distinguished from "blocked in the fixture suite." |
| 8 | Is preference change handled as versioned calibration? | **yes, structurally; not yet exercised** | `calibration/versions` + `calibration/ledger` implement exactly the versioned-snapshot-with-lineage model §6 requires, and `calibration:validate`/`test:calibration` enforce its invariants (no in-place rewrite, no unauthorized activation). But per item 7, no version has been through a real keep-or-change decision yet — the mechanism is correct; it has not been asked to hold real preference pressure. |
| 9 | Are P03 → Editorial → suengj.com / NotebookLM connected by contracts rather than coupling? | **yes, structurally; not yet exercised** | `schemas/editorial-package.schema.json` is destination-neutral by construction — `notebooklm.json` and `suengj-com.json` are peer surface profiles, no adapter-specific code lives in Core logic — but per item 4, the chain has only been exercised through synthetic worked examples, never a live P03 run. |
| 10 | Is this an Editorial Learning Core rather than a larger prompt collection? | **insufficient-evidence** | Every mechanism the Core claims (axes, routing, calibration, learning boundary) is a real, schema-enforced, fixture-tested contract rather than prose alone — that much is checkable and true. Whether it actually *functions* as a learning system, i.e. whether real feedback measurably changes real future output through the loop in §1, cannot be answered until the loop has real evidence flowing through it (SUE-570+). Calling it a Core today describes its shape, not yet its operating history. |

## Legacy reconciliation

SUE-569 asks that related Linear work be reconciled before V2 closes and that
completed V1 evidence not be reopened under V2 names. This certification does
not reopen any V1 item: `docs/architecture/V1-CERTIFICATION.md` remains the
authority for V1's ten items, unchanged, with a status note added at its top
(see that file). No V1 backlog item (B-1 through B-8) is restated here as a
V2 gap — those remain V1's own open items, owner-gated or evidence-gated as
V1 already describes them.

## Running it yourself

```bash
node scripts/certify-v2.mjs   # this certification's matrix, freshly computed
npm run certify                # V1 certification — still 10/10, unaffected by V2
npm run validate                # every V1 + V2 gate
npm test                        # every V1 + V2 regression suite
npm run eval                    # L0 fixture scorecard
node scripts/system-scorecard.mjs --validate   # evals/system/ surface (all ten dimensions INSUFFICIENT_EVIDENCE, honestly)
```

`scripts/certify-v2.mjs`'s own exit code is 0 whenever every mechanical gate
it can run passes — `PARTIAL`/`DEFERRED`/`NOT_RUN` are not failures of the
runner, they are the honest state of a Core that has not yet been operated.
