# Capture note — Jev System One use cases and model-selection heuristic

- **Captured from:** user-provided social-media screenshots
- **Captured date:** 2026-09-27
- **Editorial role:** discovery / architecture-pattern / model-routing intake
- **Factual authority:** none unless independently verified. Claims below are normalized from the screenshots and must not be treated as benchmark truth, product capability truth, or provider policy without primary evidence.
- **Rights:** raw screenshots are not reproduced in-repo; this note stores normalized observations only.

## 1. Jev — 'System One' classifier / decision layer

**Screenshot claim:** ByteByteGo describes Jev as TypeSafe AI's first 'System One Model' and shows 'Top 9 places to Use Jev.'

Visible use cases:

1. **Model routing** — route a prompt to small / medium / large LLMs.
2. **Guardrails** — classify or block injection, abuse, or off-policy inputs before they reach an LLM.
3. **Tool-call gating** — classify tool calls into allow / ask / deny.
4. **Inbox triage** — classify messages into actions such as reply now / later / archive.
5. **Reranking** — score or reorder retrieved passages by relevance.
6. **LLM evals** — cheaply score or judge model outputs.
7. **Bulk labeling** — map-reduce style classification over very large tables.
8. **Real-time control** — repeatedly map state to action in low-latency loops such as games, bots, robots, or trading loops.
9. **Confidence gate** — act automatically above a high-confidence threshold, request confirmation in a middle band, and route low-confidence cases to a human.

**Observed concept:** use a small/fast classification or decision model as a pre/post-LLM control layer instead of sending every decision to a full reasoning model.

**Editorial / system relevance**
- Strong architecture reference for cheap triage, routing, gating, reranking, and confidence-aware escalation.
- The most reusable pattern is not the Jev product name but the **System One / System Two split**: fast bounded classifiers for repetitive decisions; larger reasoning models for ambiguous or consequential work.
- Tool-call gating and confidence bands are directly relevant to agent safety and approval-line design.
- Bulk labeling and inbox triage illustrate where deterministic-ish classification may be more economical than general-purpose generation.
- Real-time control is a separate risk class: latency may improve, but safety and control requirements become stricter when actions affect external systems.

**Important boundary**
- The screenshot does not establish Jev's benchmark quality, latency, cost, calibration, or production suitability.
- The confidence thresholds shown (for example high-confidence auto-act, middle-band confirm, low-confidence human) are an illustrative policy shape, not a universal threshold.
- 'System One Model' is treated as the source's framing, not as a generally accepted technical category.

**Verification needed:** canonical Jev/TypeSafe AI source, model architecture, API/runtime contract, supported tasks, calibration/eval methodology, latency/cost data, license/terms, and exact confidence semantics.

---

## 2. Claude / ChatGPT model-selection carousel

**Screenshot claim:** a Korean creator post presents an '업무별 선택 가이드' (task-by-task selection guide) comparing Claude and ChatGPT model families.

Visible mapping in the screenshot:

| Task class | Claude | ChatGPT |
| --- | --- | --- |
| Routine work | Opus 5.5 | GPT-6 Sol |
| Complex / important work | Fable 5.1 | GPT-6 Astra |
| Fast processing | Sonnet 5 | GPT-6 Luna* |

Footnote visible in the screenshot: Luna is recommended for light repetitive tasks.

**Observed concept:** route work by task class rather than using one model for everything.

**Editorial / system relevance**
- Useful as a discovery example of **task-conditioned model routing**.
- The transferable principle is to classify work by quality requirement, complexity/risk, latency target, and cost budget before selecting a model.
- A three-bin taxonomy such as routine / complex-important / fast-repeatable can be a simple owner-facing abstraction, but it should not replace measured policy.
- Model routing should be validated using repository-specific evals and actual workload traces rather than creator preference alone.

**Important boundary**
- The screenshot is a third-party recommendation, not an official provider benchmark.
- The listed model names, relative positioning, and task-fit claims must not be promoted into canonical policy without fresh first-party or measured evidence.
- 'Complex' and 'important' are different axes: complexity concerns cognitive difficulty, while importance concerns consequence/risk. A production router may need separate dimensions.

**Verification needed:** original post/video, tested workloads, model versions, effort settings, latency/cost assumptions, benchmark population, and whether the recommendation reflects actual measurements or subjective experience.

---

## Cross-cutting synthesis

These two captures point to the same architectural theme at different levels:

```text
Task / event
   ↓
Cheap classifier or policy gate
   ↓
Route by confidence, complexity, latency, cost, and risk
   ↓
Small / fast model     OR     larger reasoning model
   ↓
Approval / human escalation when confidence or consequence requires it
```

For AES and adjacent agent systems, the reusable lessons are:

1. **Do not spend a frontier model on every decision.**
2. **Separate classification/routing from deep reasoning.**
3. **Confidence should control escalation, not merely be displayed.**
4. **Tool-call gating is an authority problem, not just a model-selection problem.**
5. **Task-fit claims require workload-specific eval evidence.**
6. **Complexity, importance/risk, latency, and cost should be modeled as separate routing dimensions.**

## Handling rule

This is a **capture-derived discovery note**. It does not authorize adopting Jev, changing model policy, or treating the creator's task-to-model table as benchmark truth.

If either item becomes an implementation or editorial candidate, promote it into the normal reference-evaluation flow with canonical sources and measured evidence.
