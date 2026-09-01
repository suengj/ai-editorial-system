# Cross-source acceptance matrix (AES-P5.2 / SUE-458)

One representative case per source class, run through the whole control plane:

```text
source manifest → frame / NO_ARTICLE → verification → profile → HITL → finalization
```

```bash
npm run matrix
```

| Case | Source class | Content type | Outcome |
|---|---|---|---|
| **A** | `youtube_summary` — several daily summaries into one thesis | news | FINALIZED |
| **B** | `market_brief` — one brief, no disagreement | news | **NO_ARTICLE** |
| **C** | `project_repo` — repository as SSOT at a pinned commit | project | FINALIZED |

The point is not that articles exist. It is that three *different* source
classes enter the same system with **no one-off handling** — the same
manifest schema, the same frame contract, the same profiles, the same review
protocol — and that a legitimate refusal is carried through as a success.

## Case B is the important one

A single day's market brief supports no thesis. Every claim in it restates a
published series, nothing disagrees with anything, and any framing would say
what the brief already says.

`NO_ARTICLE` with a recorded reason, accepted at frame review. The runner
treats it as a passing outcome, not a failure to produce something.

> "Summarising it more briefly is not an article."

## Case C exercises the Project profile

The distinctive rule fires: **repository prose is a claim, not evidence.** The
GitHub source carries a `pinned_ref`, and the draft review sends a README
citation back to verification as material feedback —

> "README에 적힌 설계 의도를 사실처럼 인용했다. 커밋으로 확인할 것."

— which is then followed by a verification review, satisfying the
re-verification rule rather than being waved through.

This is also the *controlled revision* the acceptance asks for: the article
went from version 1 to version 2 through one routed feedback item. It did not
restart.

## Limits — read before treating this as done

**These are structurally faithful cases, not live runs.** The real YouTube
corpus, market briefs, and private project state live in Drive and private
repositories, and the charter forbids carrying them here. What the matrix
proves is that the *contracts* accept all three classes and route them
correctly.

What it does **not** prove:

- that a live Drive corpus produces a good article
- Korean prose quality at real length
- that fresh verification actually reaches the right sources under load

Those need a run against real material, outside the public repo, with the
owner reading the output. Until then the acceptance criteria about live
content quality stay open.
