# V1 certification (AES-P6.4 / SUE-462)

```bash
npm run certify
```

The runner executes every gate and maps results onto the matrix below. Items it
cannot prove from this repository are reported **BLOCKED with a reason**, never
quietly passed.

## Result

**26/26 gates passing. 10 items pass, 0 fail, 0 blocked.**

| | Item | Status |
|---|---|---|
| 1 | Public repo boundary, license, public-safety | PASS |
| 2 | Source / Article / Artifact contracts with examples | PASS |
| 3 | Constitution, voice, profiles referenced by Skills | PASS |
| 4 | Frame / write / verify / polish / plan Skills exercised | PASS |
| 5 | Golden + negative fixtures, rubric, SUE-417 improved | PASS ¹ |
| 6 | Cross-source HITL matrix | PASS ¹ |
| 7 | Brief + visual + deck lineage and staleness | PASS ¹ |
| 8 | SUE-403 Drive + suengj.com final handoff | PASS ¹ |
| 9 | suengj.com integration preserves canonical/AEO | PASS ¹ |
| 10 | Media storage and audio/video roadmap | PASS |

¹ carries a caveat, printed by the runner and repeated below.

## The publication boundary, executed

**Item 8 — SUE-403** was executed on 2026-09-01 rather than deferred. One real
article traversed the whole path:

| Stage | Where |
|---|---|
| P03 seed source | Drive `PJT/YT_summary/source/` — 티타임즈 `T3hpzc0IGMw` |
| Review draft | Drive `PJT/YT_summary/drafts/Uploaded/` |
| Final | Drive `PJT/Article/` — 13,389 bytes |
| Site entry | `content/editorial/ai-agent-cost-governance.md`, suengj-com `8190fa4` |

Provenance survived every hop: the seed source, the Drive ref of the review
draft, the pipeline run id, and an explicit AI-assistance disclosure.

Nothing was published. `status` stayed `draft`, the build stayed at 51 pages,
and the entry is absent from `dist` — verified, not assumed. Setting
`status: published` remains a separate human act.

What this proves is the boundary, not the article. Its factual claims came from
the P03 run and were not re-verified here; editorial approval is still yours.

## Caveats on the passing items

They are recorded because a certification that hides them is worth less than
one that does not.

| | What is not established |
|---|---|
| 5 | Fixture-based — and on real P03 drafts the mechanical gates did **not** separate the first smoke draft from the calibrated ones. Both are clean. See below |
| 6 | Structurally faithful cases, not live corpora — real Drive content cannot enter a public repo |
| 7 | The brief and deck generators are deterministic compilers, not writers; the model-in-the-slot case is untested |
| 9 | Merged (`8cf2b0d`), but no article declares a sidecar yet, so the semantic path runs in tests and a probe rather than in live content |

### What the real comparison showed

Running the implemented gates over the actual P03 output was the most useful
negative result of this phase:

| Article | Verdict |
|---|---|
| Legacy Auto Blog artifact (`blog-post.md`) | REJECT — scaffolding leak, duplicate paragraph |
| First P03 smoke draft (`24d99a5`) | clean |
| Calibrated P03 draft A | clean |
| Calibrated P03 draft B | clean |

The gates catch shipped template debris. They do not distinguish a mediocre
argument from a good one, because nothing mechanical can — that is exactly why
twelve of the eighteen rubric dimensions are judgement dimensions left
deliberately unscored.

So the honest reading is not "the calibration worked". It is: **the mechanical
layer has nothing left to say here, and the remaining question is editorial.**

Every caveat above resolves with the same missing thing: **your reading of real
output.** The system can now put that output in front of you; it cannot grade it
for you.

## Legacy reconciliation

No competing SSOT remains for editorial style, quality, Skills, or artifact
rules.

| Legacy | Disposition | Replaced by |
|---|---|---|
| SUE-106 — article quality gate | **Superseded** | `editorial/quality-gates.json` (mechanical) + `evals/rubric.json` (judged). Its dimension list is preserved almost verbatim; what changed is that the checkable parts are now executed |
| SUE-133 — editorial style, profiles, source quality | **Superseded** (already Canceled) | `editorial/voice.md` + `editorial/profiles/` |
| SUE-102 — editorial taxonomy and newsroom voice | **Consumed as historical authority** | Content types survive unchanged in `suengj-com`; the voice is now derived from published writing rather than declared |
| SUE-93 — Editorial Candidate schema | **Superseded** | `schemas/source.schema.json` |
| SUE-234 — project-specific editorial-quality Skill | **Superseded** | `skills/` + `skills/SKILL-FORMAT.md` |
| SUE-358 / SUE-410 — publication and provenance contract | **Consumed as active authority** — *not* superseded | Still binding. This system maps onto it and may not re-implement it |
| SUE-361 — CanonicalPost → Markdown boundary | **Consumed as active authority** | The handoff contract references it rather than replacing it |
| SUE-27 — human approval before publication | **Consumed as active authority** | Reinforced: `final` → `draft`, no Skill may publish |
| SUE-417 — first E2E draft | **Consumed as evidence** | Negative fixture `N-01`; calibration recorded |
| SUE-403 — Drive + suengj.com final publication | **Executed 2026-09-01** | Item 8 above. Drive final + suengj-com `8190fa4`, status draft |

Nothing was reopened to preserve history.

## Fail-closed publication boundary — unchanged

Verified end to end, at four independent layers:

- No Skill may publish, approve, or finalize — both directions checked.
- `final` maps to `status: draft`; `published` requires a recorded approver.
- The HITL receipt's `target_status` is `const: "draft"`.
- The handoff receipt's `target.status` is `const: "draft"`, with no approver
  field anywhere in its schema.

`suengj-com`'s own gates confirm no regression: content contract, topic
registry, AEO build, publication regression, and the P03 fixture all pass on
the integration branch.

## Optional artifact failure cannot break canonical content

Proven from both sides. In `ai-editorial-system`, a handoff with zero artifacts
and no presentation sidecar is valid and produces byte-identical front matter
and body digest. In `suengj-com`, an article with no artifacts renders no
navigation at all, and every semantic-metadata failure — unresolved anchor,
ambiguous anchor, unknown role, incompatible version, malformed input —
degrades to plain prose without throwing.

## Public repo safety

`validate:boundary` scans clean: no secrets, no raw source corpus, no
private-research markers, no canonical article archive, no oversized binaries.
Secret-shaped test fixtures are synthesised at runtime rather than committed.

## V1+ backlog — explicit, not hidden

| | Item |
|---|---|
| B-1 | **Owner judgement of the calibrated P03 drafts.** The mechanical layer is exhausted; this is what closes SUE-417 |
| B-2 | ~~SUE-403 — final article to Drive and a `suengj-com` change~~ — done 2026-09-01, see item 8 |
| B-3 | Review and merge `feature/aes-p62-semantic-surfaces`, after visual review |
| B-4 | A model-written brief tested against the claim-carry-through boundary — the trigger `AV-1` for reconsidering audio |
| B-5 | Phantom-citation detection beyond fixture `N-02`: verifying that a citation *supports* its claim, not merely that it resolves |
| B-6 | Judge-assisted scoring for the rubric's `unscored` dimensions |
| B-7 | Deck from real content, for Korean typography at length (SUE-454) |
| B-8 | Domain extension vocabulary, if and when a piece needs it (SUE-464) |

None of these is hidden incompletion. Each is either owner-gated or waiting on
evidence that does not exist yet.
