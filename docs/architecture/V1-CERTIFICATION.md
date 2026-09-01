# V1 certification (AES-P6.4 / SUE-462)

```bash
npm run certify
```

The runner executes every gate and maps results onto the matrix below. Items it
cannot prove from this repository are reported **BLOCKED with a reason**, never
quietly passed.

## Result

**26/26 gates passing. 9 items pass, 0 fail, 1 blocked.**

| | Item | Status |
|---|---|---|
| 1 | Public repo boundary, license, public-safety | PASS |
| 2 | Source / Article / Artifact contracts with examples | PASS |
| 3 | Constitution, voice, profiles referenced by Skills | PASS |
| 4 | Frame / write / verify / polish / plan Skills exercised | PASS |
| 5 | Golden + negative fixtures, rubric, SUE-417 improved | PASS ¹ |
| 6 | Cross-source HITL matrix | PASS ¹ |
| 7 | Brief + visual + deck lineage and staleness | PASS ¹ |
| 8 | SUE-403 Drive + suengj.com final handoff | **BLOCKED** |
| 9 | suengj.com integration preserves canonical/AEO | PASS (contract side) ¹ |
| 10 | Media storage and audio/video roadmap | PASS |

¹ carries a caveat, printed by the runner and repeated below.

## The blocker

**Item 8 — SUE-403.** Finalizing a real article to Google Drive and opening a
`suengj-com` change are owner actions on private and live systems. The contract
and the receipt exist and are validated; the act has not been performed.

This is the one item that cannot be closed from here, and V1 is not fully
certified until it is.

## Caveats on the passing items

They are recorded because a certification that hides them is worth less than
one that does not.

| | What is not established |
|---|---|
| 5 | Fixture-based. A live P03 rerun, judged by the owner, is outstanding |
| 6 | Structurally faithful cases, not live corpora — real Drive content cannot enter a public repo |
| 7 | The brief and deck generators are deterministic compilers, not writers; the model-in-the-slot case is untested |
| 9 | The `suengj-com` change is on a branch, unmerged, undeployed, and has had no visual review |

Every one of these resolves with the same missing thing: **one live run against
real material, read by you.**

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
| SUE-403 — Drive + suengj.com final publication | **Still independently active** | Item 8 above. Requires owner action |

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
| B-1 | **Live run against real Drive corpora**, judged by the owner. Resolves the caveats on items 5, 6, 7, and 9 at once |
| B-2 | SUE-403 — final article to Drive and a `suengj-com` change (item 8) |
| B-3 | Review and merge `feature/aes-p62-semantic-surfaces`, after visual review |
| B-4 | A model-written brief tested against the claim-carry-through boundary — the trigger `AV-1` for reconsidering audio |
| B-5 | Phantom-citation detection beyond fixture `N-02`: verifying that a citation *supports* its claim, not merely that it resolves |
| B-6 | Judge-assisted scoring for the rubric's `unscored` dimensions |
| B-7 | Deck from real content, for Korean typography at length (SUE-454) |
| B-8 | Domain extension vocabulary, if and when a piece needs it (SUE-464) |

None of these is hidden incompletion. Each is either owner-gated or waiting on
evidence that does not exist yet.
