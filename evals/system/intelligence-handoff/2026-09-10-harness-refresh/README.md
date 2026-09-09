# Intelligence → Editorial refresh — Agent Harness View — 2026-09-10

Result: **READY_FOR_HUMAN_REVIEW**

This run applies the existing Learning → Writing lane to the real `the-agent-cost-curve` candidate after new primary evidence materially changed the article opportunity. It does not replace the 2026-09-09 SUE-737 certification and does not create a second writing path.

## 1. Lineage

### Owner-selected snapshot — preserved

| Field | Value |
| --- | --- |
| Repo | `suengj/reference-library` |
| Dossier | `intelligence/dossiers/the-agent-cost-curve.md` |
| Selection | explicit human `SELECT`, 2026-09-09 |
| Pinned commit | `0a50578bba368e42bac49bfa511a3d4c81e18e36` |
| Pinned SHA256 | `7a30fa319c97aabe95180bc04ef6e635221ff9c171a5bb4005aaed0ad6bd5d56` |
| Prior certification | `evals/system/intelligence-handoff/2026-09-09-dossier-intake-certification.md` |

The selected dossier is not rewritten to make the later article look inevitable.

### Freshness addendum — new evidence only

| Field | Value |
| --- | --- |
| Repo | `suengj/reference-library` |
| Addendum | `intelligence/dossiers/the-agent-cost-curve-refresh-2026-09-10.md` |
| Commit | `63e35283f04e1e18fe22b93689eae9ffa623ec5a` |
| Blob SHA | `41d7d35ab1531b38907ce8b3a3b533bfc1db8808` |
| Refresh date | 2026-09-10 |
| Material change | yes — ARC Prize within-model harness evidence |

The addendum records the post-selection evidence and the exact corrections it requires. The old snapshot plus this addendum are the input set for this re-framing run.

## 2. Fresh primary retrieval

Retrieved 2026-09-10:

- ARC Prize — `OpenAI's GPT-6 Astra on ARC-AGI-3`
- ARC Prize — `GPT-6 Astra - ARC-AGI Results`
- OpenAI — `Research acceleration: The view inside OpenAI`
- Anthropic — `Effective context engineering for AI agents`
- Anthropic — `Effective harnesses for long-running agents`
- Anthropic — `Harness design for long-running application development`
- OpenAI — `Harness engineering: leveraging Codex in an agent-first world`
- Simon Willison — `Research acceleration: The view inside OpenAI`

No P03/YouTube summary is used as factual authority in the refreshed Frame or Claim Set.

## 3. `frame-article` outcome

**Result: `Frame`, not `NO_ARTICLE`.**

Machine-shaped frame: [`frame.json`](frame.json).

### Working title

`AI 에이전트의 성능과 비용은 왜 모델만으로 설명되지 않는가`

### Dek

같은 GPT-6 Astra도 실행 하이 달라지자 ARC-AGI-3의 성능과 비용이 크게 달라졌다. 이 결과가 보여주는 것은 “하니스가 모델보다 중요하다”는 새 공식이 아니라, agent를 model-plus-execution-system으로 측정해야 한다는 필요성이다.

### Thesis

AI agent performance and cost are not properties of model weights alone. ARC-AGI-3 supplies a concrete within-model case in which harness/context/reasoning-state management materially changes both, but it does **not** establish the universal claim that harness is generally more important than model capability.

### Reader contract

- **Purpose:** 모델 선택만 최적화하던 관점에서 실행 시스템까지 별도 측정·설계하는 관점으로 이동한다.
- **Audience:** AI agent practitioner와 professional generalist. 모델/agent 기본 개념은 이미 안다고 가정한다.
- **Message:** agent의 현실적인 비교 단위는 model name 하나가 아니라 `Model × Harness × Context × Tools × Verification`에 가깝다.
- **Minimum argument path:** within-model ARC evidence → context/state mechanism → operational implication → generalization boundary → what to measure next.

### Why this is not `NO_ARTICLE`

The new evidence is not another summary of the OpenAI spend disclosure. ARC Prize provides a separate primary, within-model harness comparison with performance, cost, token, elapsed-time and mechanism observations. That makes a bounded system-level thesis independently supportable.

### Why the stronger article is refused

The source set still does **not** support:

- `harness > model` as a general ranking;
- the claim that higher agent spend causes higher productivity;
- a numeric claim that rework savings exceed a 20% model-price reduction;
- generalization of the ARC magnitude to open-ended software/research work.

Those are explicitly blocked or marked as interpretation.

## 4. `verify-claims` outcome

Machine-shaped verification block: [`claims.json`](claims.json).

Key dispositions:

| Claim | Result | Draft action |
| --- | --- | --- |
| Standard best observed = 62.7% / $26,098 at max | `verified` | retain |
| Provider Adapter best observed = 99.9% / $18,817 at high | `verified` | retain, label as best observed |
| Same-effort max = 62.7%/$26,098 vs 98.6%/$17,332 | `verified` | add as the cleaner controlled comparison |
| 167 paired solved cases; 49% fewer tokens; ~3.66x faster | `verified` | retain with paired-case scope |
| Provider Adapter preserves opaque reasoning state + uses compaction | `verified` | retain |
| OpenAI median researcher >$600/day | `verified` | retain as OpenAI-reported operating metric |
| OpenAI research org = 3.1 agent-workdays / human workday | `verified` | retain as OpenAI-reported operating metric |
| Experiments increased while available compute also grew | `verified` | retain as causality boundary |
| `harness is generally more important than model` | `unverified` | do not assert |
| `rework savings > 20% model-price saving` | `unverified` | remove numeric comparison |

Interpretive passages such as the organization analogy are retained only when marked as analogy/hypothesis, never as verified fact.

## 5. Review draft handoff

Publication repo: `suengj/suengj-com`

PR: `#43 — content: agent harness view draft with two approved visuals`

Draft branch after Frame/Verify correction and explicit lineage write-back:

`content/ai-agent-harness-over-model@2b14ad25394047c6acb826494ca997ec82ad21b6`

Article:

`content/views/ai-agent-harness-over-model.md`

State remains:

```yaml
status: draft
```

Material changes from the initial draft:

1. Working title narrowed from a model-vs-harness dominance implication to a model-only insufficiency claim.
2. `62.7% vs 99.9%` is explicitly identified as best-observed-per-harness, not same-effort.
3. Same-effort max comparison `62.7%/$26,098 vs 98.6%/$17,332` is added.
4. `$600+/day` and `3.1 agent-workdays` are retained only after official OpenAI retrieval.
5. Arbitrary `20% model-price vs rework saving` comparison is removed.
6. Organization analogy and structural-problem masking are explicitly marked as interpretation/hypothesis.
7. Existing owner-approved images are reused without regeneration or alteration.
8. The canonical Markdown carries a non-rendered editorial-lineage comment pointing to the selected dossier, freshness addendum, Frame, Claim Set, review state and publication-approval=false.

## 6. Visual lineage

No new visual was generated in this refresh.

Existing approved assets remain:

- `same-ai-different-system.634d17b9f62d.webp`
- `standard-vs-provider-adapter-harness.618367ea3e3c.webp`

The infographic's 62.7% / 99.9% values remain valid as each harness's best observed result. The adjacent article text now supplies the required reasoning-effort distinction and same-effort comparison.

Family-B owner approval and publication-text/mobile recalibration remain governed by SUE-546 and the current `ARTICLE-INLINE-VISUALS.md` / AI Editorial visual-family contracts.

## 7. Validation boundary

This ChatGPT run had fresh web retrieval and GitHub read/write access but no network-capable local checkout, so it does **not** claim a new `npm run validate` / `npm run build` PASS after the prose revision. The attempted clean checkout failed before repository download because the execution sandbox cannot resolve `github.com`.

The previous agent run on PR #43 had already validated the asset materialization and build path. Because the article body and title changed in this refresh, the publication-side validator/build must be rerun from a coding environment before merge or publication. This is an execution boundary, not a reason to skip the gate.

Required before merge/publish:

```text
coding environment fresh-read
→ npm run validate
→ npm run build
→ relevant visual validation
→ read-back article remains status:draft
```

No CI workflow should be enabled solely for this content validation; use the existing local/content-only validation path.

## 8. Next authority gate

Current result is **READY_FOR_HUMAN_REVIEW**, not approved and not published.

Human review should decide whether the revised title/thesis/prose is acceptable. Only after explicit approval may the publication path perform final validation and, if requested, change `status: draft` to `status: published`.

Neither this certification, the Frame, the Claim Set, nor the open PR records human publication approval.
