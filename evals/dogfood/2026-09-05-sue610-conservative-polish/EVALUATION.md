# SUE-610 — conservative polish re-test evaluation

Evaluator: the same agent that authored the twelve delta-plan/polish-decision
records this document evaluates. That is a limitation, not a disclosure of no
consequence — see §3. Nothing in `evals/dogfood/2026-09-05-sue604-recalibration/**`
is touched, modified, or reinterpreted by this document; it sits beside that
evidence, not on top of it.

---

## 1. Method

**What ran.** Six delta-plan records and six polish-decision records, one pair
per case fixed in the Manager's case plan (`C1`–`C6`, not substituted), built
by hand against `docs/architecture/SOURCE-TARGET-DELTA-PLANNING.md` and
`docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md` §11–§15, validated against
`schemas/delta-plan.schema.json` and `schemas/polish-decision.schema.json`, and
checked against every mechanical guard in `scripts/lib/delta-core.mjs`
(G1–G6, P1–P6, the accept rule A1–A3, the no-aggregate field-name scan, and the
ceiling-equals-maximum check). All twelve records return zero issues from
`validateDeltaPlan` / `validatePolishDecision`. `node scripts/validate-delta.mjs`
and `node scripts/test-delta.mjs` pass against the repo's existing examples and
fixtures — neither script yet discovers this run's own files, so the explicit
per-file check above is the actual verification of this evidence, not the
example-file pass.

**Source drafts, at their actual refs.**

| Case | Source | Ref | Content type |
|---|---|---|---|
| C1 | `content/editorial/sue570-pilot-bonds-news.md` | `origin/sue-570-pilot-review` | news brief |
| C2 | `content/editorial/sue570-pilot-tools-report.md` | `origin/sue-570-pilot-review` | practitioner analysis |
| C3 | same bonds-news source as C1; target is a hypothetical Report | `origin/sue-570-pilot-review` | news brief → research |
| C4 | `content/editorial/sue570-pilot-bonds-child.md` | `origin/sue-570-pilot-review` | child explainer |
| C5 | fresh draft, generated for this run, pack **not** applied at generation time | `content/editorial/sue610-c5-before.md` (suengj-com, branch `sue-610-conservative-polish-review`) | news brief |
| C6 | `content/views/japan-us-global-bond-selloff.md` | current tree (published `2026-09-02`) | published View |

C5's canonical source is `content/views/tokenized-stocks-instant-payments-liquidity-rights.md`
(current tree, dated 2026-09-03, updated 2026-09-04) — a topic in neither the
SUE-604 discovery corpus nor its housing holdout.

**Pack state.** `editorial/profiles/language/ko-KR.json` — `schema_version
"1.1.0"`, `status: "draft"`, 35 rules, `application_mode` on every rule as
reclassified under AES-V2.18/SUE-610 (`hard_local_correction` /
`soft_detector` / `upstream_guidance` / `local_observation` /
`deprecated_as_instruction`). **No rule was activated by this run.** The pack's
`status` remains `draft`, `calibration_ref` is untouched, and none of the 35
rule bodies were edited. What changed between this run and SUE-604 is not the
pack's content — it is whether a rule matching a span of text is treated as
license to edit it. Every accepted edit in this run passed the eleven-criterion
pairwise gate and the accept rule (A1–A3); no edit was applied because a
`soft_detector` rule merely fired.

---

## 2. Per-case results

Across the six cases, **7 candidate edits were proposed, 3 were accepted, and
4 were reverted.** One revert (C1) shows a demonstrated regression; the other
three (C2 edit-02, C4 edit-01, C5 edit-03) show a candidate that could not be
shown to be an improvement at all — see §3 for why that distinction matters
and should not be blurred into a single "reverts caught defects" claim.

| Case | Proposed | Accepted | Reverted | Plan ceiling | Action |
|---|---|---|---|---|---|
| C1 — bonds-news | 1 | 0 | 1 | P0_PRESERVE | KEEP |
| C2 — tools-report | 2 | 1 | 1 | P1_LOCAL_POLISH | LOCAL_POLISH |
| C3 — bonds-news→Report | 0 | 0 | 0 | P2_CONTROLLED_ADAPT | UPSTREAM_REPLAN_REQUIRED |
| C4 — bonds-child | 1 | 0 | 1 | P1_LOCAL_POLISH | KEEP |
| C5 — tokenized-stocks | 3 | 2 | 1 | P1_LOCAL_POLISH | LOCAL_POLISH |
| C6 — japan-us View | 0 | 0 | 0 | P0_PRESERVE | KEEP |
| **Total** | **7** | **3** | **4** | — | — |

### C1 — `bonds-news`, churn control

**SourceProfile / TargetProfile.** Source and target are the same: a news
brief for a general reader, already published-quality Korean
("일본은 되돌렸고, 미국은 버티고 있다" — active parallel construction, no
particle or spacing errors in the sampled paragraphs).

| Axis | Delta | Intervention |
|---|---|---|
| language_quality | LOW | P0_PRESERVE |
| genre | LOW | P0_PRESERVE |
| audience | LOW | P0_PRESERVE |
| knowledge_depth | LOW | P0_PRESERVE |
| register | LOW | P0_PRESERVE |
| information_structure | LOW | P0_PRESERVE |
| terminology | LOW | P0_PRESERVE |

**Plan ceiling: `P0_PRESERVE`.** **Edit surface: 0/2578 characters (0%).**
**Action: `KEEP`.**

One candidate edit was generated and reverted.

> **ORIGINAL:** 이 조합은 보통 "돈을 빌려주는 사람들이 기업 부도 위험을 새로
> 걱정하기 시작했다"는 신호가 아니라, "장기 자금을 오래 묶어두는 대가로 더
> 높은 보상을 요구하고 있다"는 신호로 **읽힌다**.
>
> **CANDIDATE:** 이 조합은 "돈을 빌려주는 사람들이 기업 부도 위험을 새로
> 걱정하기 시작했다"는 신호가 아니라, "장기 자금을 오래 묶어두는 대가로 더
> 높은 보상을 요구하고 있다"는 신호**다**.

`nq-passive-causative-overuse` (soft_detector) flagged the 히다-피동 predicate
읽힌다. Dropping it to a flat 신호다 does remove the passive, but it also
removes the interpretive hedge that 읽힌다 carries ("this is usually *read
as*..."), collapsing an interpretation into an assertion. `information_loss`
and `semantic_integrity` both scored **worse**; the other nine criteria scored
`same`. **Revert on A2** — none of `semantic_integrity`, `information_loss`,
`genre_preservation`, `audience_preservation`, `domain_terminology_preservation`
may be `worse` for an accept, and two of them were. A local rule-compliance
gain (fewer passives) does not offset a holistic regression (a claim that reads
more confident than the source intended), and the burden of proof sits with
the edit, not the incumbent text.

### C2 — `tools-report`, bounded polish

**SourceProfile / TargetProfile.** Same: practitioner analysis, already
carrying the four-step spreadsheet→AI mechanism and both counterarguments the
source raises, with practitioner English (`span of control`, `shadow
workflow`) retained throughout.

| Axis | Delta | Intervention |
|---|---|---|
| language_quality | MATERIAL | P1_LOCAL_POLISH |
| genre | LOW | P0_PRESERVE |
| audience | LOW | P0_PRESERVE |
| knowledge_depth | LOW | P0_PRESERVE |
| register | LOW | P0_PRESERVE |
| information_structure | LOW | P0_PRESERVE |
| terminology | LOW | P0_PRESERVE |

**Plan ceiling: `P1_LOCAL_POLISH`.** **Edit surface: 80/4560 characters
(1.8%).** **Action: `LOCAL_POLISH`.**

**Edit 1 — accepted.**

> **ORIGINAL:** 이 구분 — 원인이 아니라 촉매/실행 비용 인하 — 은 이
> 리포트의 나머지 논증 전체가 기대는 지지대이므로, 다음 절에서 반드시 다시
> 등장한다.
>
> **CANDIDATE:** 원인이 아니라 촉매였다는 이 구분에 이 리포트의 나머지
> 논증 전체가 기대고 있으므로, 다음 절에서 다시 등장한다.

`nq-translationese-connective-scaffolding` (soft_detector). The original's
"이 구분 — X — 은 ... 지지대이므로" shape is the same mechanical-translation
pattern `editorial/voice.md` §5 names for *This distinction …*: a topicalised
demonstrative carrying a parenthetical, then a long predicate. `continuous_
readability`, `native_naturalness`, and `stiffness` all scored **better**; the
remaining eight scored `same`. A1 satisfied (native_naturalness better), A2 and
A3 clean. **Accepted.**

**Edit 2 — reverted.**

> **ORIGINAL:** 이 부분은 원문에도 정량적 근거가 없는, 논리적 추론에 그친
> 지점이다.
>
> **CANDIDATE:** 이 부분은 원문에도 수치로 뒷받침된 근거가 없는, 논리만으로
> 추론한 지점이다.

`nq-jeok-suffix-pileup` (soft_detector) flagged 정량적 and 논리적 sitting close
together. `continuous_readability` and `native_naturalness` both scored
`same` — the candidate is not demonstrably more natural than the original, it
is only different. **Revert on A1** — neither of the two required criteria is
`better`. Two `~적`-suffixed adjectives four words apart is not, on its own,
a defect; the detector's match was not backed by an actual readability or
naturalness gain, and ambiguity reverts.

### C3 — `bonds-news` → Report, the delta-independence proof

**SourceProfile / TargetProfile.** Source is the same news brief as C1: sober,
already-hedged prose, a rate-vs-worry distinction stated in one interpretive
sentence, evidence for it limited to one OAS figure. Target is a
domain-practitioner Report on the same event.

| Axis | Delta | Intervention | Owning layer |
|---|---|---|---|
| language_quality | LOW | P0_PRESERVE | — |
| genre | MATERIAL | P2_CONTROLLED_ADAPT | `register` |
| audience | MATERIAL | P2_CONTROLLED_ADAPT | `audience` |
| knowledge_depth | MATERIAL | P2_CONTROLLED_ADAPT | `frame` |
| register | LOW | P0_PRESERVE | — |
| information_structure | LARGE | P2_CONTROLLED_ADAPT | `frame` |
| terminology | LOW | P0_PRESERVE | — |

**Plan ceiling: `P2_CONTROLLED_ADAPT`.** **Edit surface: 0/2578 characters
(0%).** **Action: `UPSTREAM_REPLAN_REQUIRED`.** **Zero candidate edits
proposed.**

This is the case that argues the label pair ("News" → "Report") does not
determine the intervention on its own. `register` and `language_quality` read
LOW — the source's sentence "국채금리는 높은 채 그대로인데 신용스프레드는
벌어지지 않았다는 뜻이다" is already the kind of sober, hedged register a
Report wants, and nothing about moving to Report requires rewriting it.
`genre`, `audience`, `knowledge_depth`, and `information_structure` read
MATERIAL/LARGE for concrete reasons: the news brief explains OAS to a
first-time reader ("이 조합은 보통 '...기업 부도 위험을 새로 걱정하기
시작했다'는 신호가 아니라..."), where a practitioner Report would use the term
directly; it summarizes the term-premium mechanism in one quoted sentence
("원문 분석(2026-09-02)은 이 상황을 ... 재가격으로 해석했다.") rather than
developing it; and its only uncertainty section is one paragraph, where the
canonical View this brief was built from carries a full Scenario map and
Watchlist the brief does not reproduce.

Because the ceiling on four of seven axes is P2, and none of those axes is
polish-owned, the polish decision records `UPSTREAM_REPLAN_REQUIRED` and stops.
**No Report draft was generated for this case, by design** — the polish layer
has no text to judge, because Frame/Transformation and Audience have not yet
done the depth-and-structure work those four axes require. `upstream_route.layer
= "frame"`.

### C4 — `bonds-child`, the no-double-authoring proof

**SourceProfile / TargetProfile.** Same: a child-upper-elementary explainer
that already opens concrete-first ("나라도 가끔 돈이 모자랄 때가 있어"), glosses
every term on introduction, and keeps 해체 register throughout.

| Axis | Delta | Intervention | Owning layer |
|---|---|---|---|
| language_quality | LOW | P1_LOCAL_POLISH | — |
| genre | LOW | P0_PRESERVE | — |
| audience | LOW | P0_PRESERVE | `audience` |
| knowledge_depth | LOW | P0_PRESERVE | — |
| register | LOW | P0_PRESERVE | — |
| information_structure | LOW | P0_PRESERVE | — |
| terminology | LOW | P0_PRESERVE | — |

**Plan ceiling: `P1_LOCAL_POLISH`.** **Edit surface: 0/2953 characters
(0%).** **Action: `KEEP`.**

The record states explicitly why `audience` reads LOW rather than something
requiring intervention: not because no adaptation was needed, but because
Audience/Transformation already performed it correctly when this draft was
generated — concrete-before-abstract sequencing, term glossing, 해체 register
— and none of that work is repeated here.

One candidate edit was generated and reverted.

> **ORIGINAL:** **그리고** 일본이 이자율을 올린 것도 영향을 줬어.
>
> **CANDIDATE:** 일본이 이자율을 올린 것도 영향을 줬어.

`nq-connective-adverb-overuse` (soft_detector) flagged the sentence-initial
그리고. `continuous_readability` and `native_naturalness` both scored `same`;
`rhythm` scored **worse**. **Revert on A1** — the required improvement never
showed up. The sentence is the fourth cause offered after a numbered 1-2-3
list; 그리고 is doing transition work for a child reader crossing from a closed
list to an additional factor, and removing it costs rhythm rather than gaining
anything. This is not the connective the detector is built to catch; it is an
ordinary connective in this register.

### C5 — tokenized-stocks, unseen-topic generation

**SourceProfile / TargetProfile.** The source is not owner-authored: it is a
BEFORE news brief generated fresh for this run from
`content/views/tokenized-stocks-instant-payments-liquidity-rights.md`, with
the ko-KR pack deliberately **not** applied during generation. It is
structurally sound (fact-first lead, background, uncertainty section) but
carries the kind of stacked passive/nominalization Korean unpacked generation
tends to produce.

| Axis | Delta | Intervention |
|---|---|---|
| language_quality | MATERIAL | P1_LOCAL_POLISH |
| genre | LOW | P0_PRESERVE |
| audience | LOW | P0_PRESERVE |
| knowledge_depth | LOW | P0_PRESERVE |
| register | LOW | P0_PRESERVE |
| information_structure | LOW | P0_PRESERVE |
| terminology | LOW | P0_PRESERVE |

**Plan ceiling: `P1_LOCAL_POLISH`.** **Edit surface: 153/954 characters
(16.0%, within the 20% advisory band; no `large_edit_justification`
required).** **Action: `LOCAL_POLISH`.**

**Edit 1 — accepted.**

> **ORIGINAL:** 또한 토큰을 가진 사람이 실제 주주와 동일한 권리 — 배당,
> 의결권, 상환 등 — 를 가지고 있는지도 상품마다 **다르게 되어 있어서**,
> 세계거래소연맹(WFE)은 규제당국에 주식 토큰화를 서두르지 말라고
> **요청한 바 있다**.
>
> **CANDIDATE:** 또한 토큰을 가진 사람이 실제 주주와 동일한 권리 — 배당,
> 의결권, 상환 등 — 를 갖는지는 상품마다 다르다. 그래서 세계거래소연맹(WFE)은
> 규제당국에 주식 토큰화를 서두르지 말라고 요청했다.

`nq-passive-causative-overuse` (soft_detector) flagged the causative-plus-
passive 다르게 되어 있어서 stacked with the formal completive 요청한 바 있다 in
one run-on sentence. `continuous_readability`, `native_naturalness`, and
`stiffness` scored **better**; the rest `same`. **Accepted.**

**Edit 2 — accepted.**

> **ORIGINAL:** 결제가 빨라지는 것**에 대해서도** 비슷한 우려가
> **제기되고 있다**.
>
> **CANDIDATE:** 결제가 빨라지는 것도 비슷한 우려를 낳는다.

`nq-excessive-nominalization` (soft_detector) flagged the ~에 대해서도 ...
제기되고 있다 nominalized-passive frame. Same three criteria **better**, rest
`same`. **Accepted.**

**Edit 3 — reverted.**

> **ORIGINAL:** 이 흐름은 결제와 거래의 속도를 높이려는 오랜 시도의
> 연장선에 있는 것으로, 미국 연준이 올해 잭슨홀 심포지엄의 주제를
> 금융혁신과 결제정책으로 정한 것도 **이와 무관하지 않다**.
>
> **CANDIDATE:** 이 흐름은 결제와 거래 속도를 높이려는 오랜 시도의
> 연장선에 있다. 미국 연준이 올해 잭슨홀 심포지엄의 주제를 금융혁신과
> 결제정책으로 정한 것도 같은 맥락이다.

`nq-redundant-expression` (soft_detector) flagged the double negative 이와
무관하지 않다 as a suspected translationese hedge. On the pairwise gate,
`native_naturalness` and `continuous_readability` both came back `same`: 이와
무관하지 않다 is in fact a normal editorial-Korean hedge, not a calque, and the
candidate is not more natural than the original — only different. **Revert on
A1.** The detector's initial flag was an over-detection, and the record says so
plainly rather than smoothing it into an accept.

### C6 — `japan-us-global-bond-selloff.md`, incumbent already excellent

**SourceProfile / TargetProfile.** Same: the owner's own published View,
target is to publish it as-is. Analytical register throughout ("현재는
credit crisis로 보기 어렵다. 신용스프레드가 장기금리 상승만큼 급격히 벌어지지
않았기 때문이다."), a complete 핵심 판단 → numbered sections → Scenario map →
Watchlist → Bottom line structure, `term premium`/`OAS`/`carry trade` kept
in stable form throughout.

| Axis | Delta | Intervention |
|---|---|---|
| language_quality | LOW | P0_PRESERVE |
| genre | LOW | P0_PRESERVE |
| audience | LOW | P0_PRESERVE |
| knowledge_depth | LOW | P0_PRESERVE |
| register | LOW | P0_PRESERVE |
| information_structure | LOW | P0_PRESERVE |
| terminology | LOW | P0_PRESERVE |

**Plan ceiling: `P0_PRESERVE`.** **Edit surface: 0/6398 characters (0%).**
**Action: `KEEP`. Zero candidate edits proposed.**

Sampled 핵심 판단, §1–3, and Bottom line. No candidate edit was generated at
all — not tested and reverted, simply not found. This is the strongest form of
KEEP in the run, and also, per §3 below, the least falsifiable one.

---

## 3. What this run does not establish

**Six cases, one language, one evaluator, no holdout on the polish decisions
themselves.** SUE-604's own recalibration used a three-draft topic holdout to
test whether a rule's effect transferred beyond the tuning topics. This run has
no equivalent holdout for the delta-gate/polish contract: C5 is unseen-topic,
which tests whether the *language-quality* improvements generalize, but no
second evaluator and no second language pack exist to test whether the
*decision procedure* itself — the axis judgments, the pairwise verdicts, the
accept rule as applied — generalizes beyond this one agent's readings.

**Three of the four reverts hinge on A1 ("no clear improvement"), not on
demonstrated harm.** C2 edit-02, C4 edit-01, and C5 edit-03 were all reverted
because `continuous_readability`/`native_naturalness` came back `same`, not
because any criterion scored `worse`. Only C1's revert shows an actual
regression (`semantic_integrity`/`information_loss` worse). This is not a
weak result — it is the preservation-first doctrine (SOURCE-TARGET-DELTA-
PLANNING.md §7) working exactly as designed: the burden of proof sits with the
edit, and "I cannot show this is better" is sufficient grounds to leave the
original standing, without needing to also show the candidate is actively
worse. But it should be named precisely rather than folded into "the gate
caught defects" — most of what the gate caught here was *unconvincing
candidates*, not *harmful* ones.

**C3 routes the News→Report transformation upstream; it does not demonstrate
that the prose survives that transformation.** The claim actually supported by
C3 is narrower than "prose is preserved through a genre change": it is that
the delta gate correctly identifies which axes need upstream work and refuses
to let polish either do that work or write around it. No Report draft exists.
Whether the news brief's sentences would in fact survive Frame/Transformation's
depth-and-structure expansion intact is not tested here and should not be
read as established by this record.

**C6's zero candidates is the desired outcome and also the least falsifiable
one.** A system that proposes nothing on an already-excellent draft cannot be
distinguished, from the outside, between "correctly found nothing" and
"failed to look." C1 and C4 are stronger evidence in this respect — each
generated a real candidate and then reverted it through the pairwise gate,
which is at least evidence the gate was exercised. C6's KEEP rests on the
absence of a detector firing, which this run has no independent way to audit.

**The evaluator proposing and then reverting its own candidates is not an
independent check.** Every candidate edit in this run, its pairwise judgment,
and its accept/revert verdict were produced by the same agent in the same
pass. The four reverts show the gate is not a rubber stamp for a
same-agent's own candidates — three of them (C2 edit-02, C4 edit-01, C5
edit-03) explicitly reverse the initial defect flag on later inspection ("결함이
아니었다" / "최초 탐지가 과잉이었다"), and the fourth (C1) shows a genuine
defect whose proposed fix caused new harm — but a reviewer with no stake in the
candidate having been proposed is a different and stronger test than this run
performs.

---

## 4. Comparison to SUE-604

**`bonds-news`: rewritten regression → `KEEP`.** SUE-604's AFTER deleted 돈을
빌려주는 사람들이 (the sentence's only named agent) under
`nq-subject-topic-omission`, and separately stiffened 그대로이다 into the
agentless 유지됐다 under `nq-passive-causative-overuse`. Both rules existed and
matched; neither improvement was real (`evals/dogfood/2026-09-05-sue604-
recalibration/EVALUATION.md` §2.4). This run's C1 reads all seven axes LOW —
because the delta gate reads the actual source text before authorizing
anything, and the source was already close to the target, there is no
MATERIAL/LARGE delta anywhere to license an intervention above P0/P1. The one
candidate this run did generate (a different span, the OAS-signal sentence)
was independently reverted by the pairwise gate on A2. What changed
mechanically is not that the rules got better at detecting defects — it is
that a detected match is now a *candidate*, tested against ORIGINAL on eleven
criteria and an explicit accept rule, rather than an instruction executed on
sight.

**`bonds-child`: semantic_integrity regression → tested-and-reverted no-op.**
SUE-604's AFTER replaced "**이자율이 오르는 것**과 **은행이나 회사가 망할
위험이 커지는 것**은 서로 다른 이야기야" with a flat, unhedged "이자율이
오른다고 해서 은행이나 회사가 망할 위험이 커지는 건 아니야" — a general causal
denial the canonical source does not make, delivered to a ten-year-old, with
the "제일 조심해야 하는 부분" warning that framed it deleted (SUE-604
EVALUATION.md §2.6). That regression came from re-running audience-adaptation
work under polish authority. Under the reclassification this issue performs
(`editorial/profiles/language/ko-KR.json` §12, guard L3), every `layer:
audience` rule — `aud-vocab-tier-basic`, `aud-sentence-length-short`,
`aud-uncertainty-child-register`, `aud-concrete-before-abstract`, `aud-child-
label-is-not-adaptation` — is now `application_mode: upstream_guidance`.
Guard P5 makes `verdict: accept` structurally unavailable for that mode: a
polish edit executing an audience rule cannot be accepted no matter how it
scores on the pairwise gate. C4's delta plan separately records `audience` as
LOW because that adaptation work already happened correctly when the draft
was generated, so the plan ceiling never rises above P1 on `language_quality`.
The one candidate this run generated targets a connective, not an audience
concern, and it reverted on A1. Two independent mechanisms are doing the work
here: the axis reading (audience is LOW, so there is no gap to close) and the
mode guard (even if it read otherwise, `upstream_guidance` could not authorize
an accept). Either alone would have stopped SUE-604's regression; this run
exercises both.

---

## 5. Readable Korean pairs

The Korean-language BEFORE vs CONSERVATIVE comparison for all six cases, and
the two resulting drafts where an edit was actually accepted, live in the
`suengj-com` repository on branch `sue-610-conservative-polish-review`,
commit `fce343e` (`review(SUE-610): conservative polish re-test — six-case
BEFORE vs CONSERVATIVE comparison`):

- `content/editorial/sue610-conservative-polish-comparison.md` — all six cases
- `content/editorial/sue610-c2.md` — C2's accepted edit applied
- `content/editorial/sue610-c5.md` — C5's two accepted edits applied

That branch does not touch `sue570-pilot-*` or `content/views/`
(`git diff origin/sue-570-pilot-review -- content/editorial/sue570-pilot-*
content/views/` is empty), is committed locally only, and is not pushed, not
opened as a PR, and not merged.

---

*Verdicts in this document are per case and per criterion and are not summed,
averaged, or otherwise combined into a single number — the same discipline
`SOURCE-TARGET-DELTA-PLANNING.md` §3 requires of the records themselves. The
absence of an accepted edit in four of six cases (C1, C3, C4, C6) is reported
as a result, not as an incomplete run.*
