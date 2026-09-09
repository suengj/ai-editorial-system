# Intelligence → Editorial handoff certification — 2026-09-09 (SUE-737)

Certifies that a selected `reference-library` Topic Dossier can enter the existing
Editorial flow without creating a second writing path or weakening claim verification.

Governing contracts: [`../../../docs/architecture/INTELLIGENCE-HANDOFF.md`](../../../docs/architecture/INTELLIGENCE-HANDOFF.md),
[`../../../schemas/SOURCE-CONTRACT.md`](../../../schemas/SOURCE-CONTRACT.md).

## Input

| Field | Value |
| --- | --- |
| Dossier | `intelligence/dossiers/the-agent-cost-curve.md` |
| Repo | `suengj/reference-library` |
| Commit | `0a50578bba368e42bac49bfa511a3d4c81e18e36` |
| Content hash | `sha256:7a30fa319c97aabe95180bc04ef6e635221ff9c171a5bb4005aaed0ad6bd5d56` |
| Selected by | `suengj`, 2026-09-09 (explicit SELECT; weekly `PROMOTE` alone was refused by the upstream gate) |
| Source class | `intelligence_dossier`, `disposition: candidate`, `disposition_authority: human` |

The body is not copied into this repository. The manifest entry pins an immutable commit,
so the evidence set the frame was built against remains reconstructable.

### Provenance reconciliation after the upstream merge (2026-09-09)

`reference-library` PR #1 has since merged as `786dc2ff9514c50619209833a9f70b982015874f`.
The pin above was re-verified against merged `main` rather than assumed:

| Check | Result |
| --- | --- |
| `0a50578` reachable from merged `main` | yes (`git merge-base --is-ancestor` passes) |
| Dossier hash at `0a50578` | `7a30fa31…d6bd5d56` |
| Dossier hash on merged `main` | `7a30fa31…d6bd5d56` — identical |

The pin therefore stays canonical and is deliberately **not** repointed at the merge
commit: `0a50578` is the commit the frame was actually built against, it is an ancestor of
`main`, and the dossier blob is byte-identical at both. Repointing would trade a precise
reference for a vaguer one.

This required the upstream PR to merge with a **merge commit**. A squash would have
rewritten `0a50578` out of `main` and silently reduced this certification to a branch-only
reference — the exact stale provenance this section exists to rule out.

Note that the upstream Knowledge Topic `ai-agent-compute-cost-curve.md` was corrected in the
same merge (an inadmissible thesis reframe was retracted). That artifact is not part of this
pin: the dossier is, and its hash is unchanged. The dossier had already recorded the same
evidence honestly — `role: P03`, confidence `low`, "the underlying paper is not yet
resolved" — which is why no re-certification of the frame is required.

## Reuse-before-build finding

No new intake path was required. The dossier enters as an ordinary source manifest entry
and proceeds through the existing `intake-request` → `frame-article` sequence.

One genuine gap was found and closed with the smallest possible delta:

1. The finite `kind` vocabulary had no class for a Learning Intelligence artifact. Filing a
   dossier as `research_draft` or `project_repo` would have misdescribed it and, more
   importantly, would have left it indistinguishable from admissible evidence.
2. Nothing *enforced* the handoff document's central rule. It was stated in prose only.

Added: the `intelligence_dossier` class, and the `derived-evidence-role` invariant — a
dossier cited with `used_by[].role: primary` fails `npm run validate:source`. It remains
citable as `supporting`, `background`, or `contradicting`.

`youtube_summary` was deliberately left exempt: a video can be the primary event under
analysis, and the existing example manifest legitimately relies on that. Collapsing both
into one rule would have been wrong.

## Adaptive freshness

- **Window applied:** 7–14 days for the trigger claim; deliberately widened to 2025–2026
  for the productivity-measurement literature.
- **Why:** the trigger is a three-day-old frontier-lab disclosure on a news cadence, while
  the evidence that tests it moves on a research cadence. A fixed 7–14d window would have
  excluded the METR studies — the single most important counter-evidence in the file.
  This is exactly the case the handoff document's "widen or narrow when the claim horizon
  requires it" clause exists for.
- **Material change since candidate creation:** yes, and adverse. The refresh surfaced
  counter-evidence stronger than the original signal.
- **Near-publication re-check:** required, 24–48h, recorded in the dossier's editorial
  handoff block.

## Framing outcome

**Result: `Frame`, materially narrowed from the candidate.**

The candidate as promoted — "frontier-lab agent spend is rising, here is what it means" —
does **not** survive framing. The refresh established that spend is not a productivity
measure and that the measurement literature does not converge. Framing that piece would
have required treating an unaudited, denominator-free figure as evidence of capability.

The frame that does survive is narrower and is *about* that gap:

- **Working thesis:** A frontier lab's disclosed agent spend tells a small team something
  real, but not what it appears to. It is evidence about allocation, not about
  productivity — and the productivity literature actively contradicts the naive reading.
- **Content type:** analysis / synthesis, not news.
- **Uncertainty (non-empty, as required):** the $600/day figure is unaudited with no
  denominator; effect sizes in the literature span roughly −20% to +100%; the code-churn
  series is only secondarily sourced; the Microsoft CLI-agent adoption paper has not been
  read in full.
- **Verification needs:** every one of the above before it may appear as an asserted fact.
  The three P03/YouTube items in the dossier are framing input only and support no claim.
- **Source weighting:** the two METR studies outweigh the trigger disclosure, which
  inverts the candidate's own emphasis. Upstream enthusiasm did not survive weighting.

## NO_ARTICLE path

`NO_ARTICLE` is reachable and was not bypassed. Had the refresh found only the trigger
disclosure and its restatements — the case as the candidate was originally promoted — the
correct outcome would have been `NO_ARTICLE: insufficient evidence`, because every
supporting item traces to one unaudited self-published figure, and the P03 items are
derived summaries that cannot corroborate it.

The upstream `HOLD` candidate, `datacenter-power-retail-politics`, is the live example of
this: its two carrying magnitudes are unverified and mutually inconsistent, and the
upstream weekly review declined to promote it for exactly that reason.

## Boundary evidence

- Human SELECT is the entry authority. `candidates dossier-check` exits non-zero for a
  merely `promoted` candidate and zero only after an explicit SELECT.
- No publication capability was added. Nothing here can set `status: published`; that
  authority remains solely with `suengj-com`.
- Editorial research that changes durable understanding is routed back as a feedback
  candidate, not written into upstream Knowledge files. The METR counter-evidence found
  during this refresh is such a candidate and is recorded here rather than silently
  applied to `intelligence/knowledge/ai-agent-compute-cost-curve.md`.

## Upstream contract changes requested

None. The dossier template already carried everything this intake needed — selection date,
evidence roles, counter-evidence, freshness window and rationale, and unresolved factual
risks. No coupling was introduced in either direction.

## Commands

```bash
node scripts/validate-source-manifest.mjs   # source-manifest: PASS
node scripts/test-source-contract.mjs       # source contract regression: PASS
npm test                                     # PASS — 0 failing assertion(s)
npm run validate                             # all validators PASS
```
