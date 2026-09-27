# Capture note — Claude Code operations / operating-system design

- **Captured from:** user-provided YouTube Shorts screenshots
- **Captured date:** 2026-09-27
- **Editorial role:** discovery / operating-principles intake
- **Factual authority:** none beyond what is visibly stated in the screenshots. Treat all operational claims as source-derived guidance until independently verified.
- **Rights:** raw screenshots are not reproduced in-repo; this note stores normalized observations only.

## Source context

The screenshots are from a MINsoo / AIMAX carousel about using Claude Code for business/operations. The central thesis is that reliable automation should not be designed as one monolithic instruction bundle. Instead, rules, SOPs, workers/agents, connections, permissions, and schedules should be separated and governed explicitly.

## 1. Separate the operating layers

**Screenshot wording:** "사업 전체를 AI에게?! 먼저 운영 층부터"

**Normalized principle:** design rules, SOPs, workers, connections, permissions, and schedules as distinct operating layers rather than collapsing them into one prompt or one automation.

**Editorial / system implication**
- Useful as a compact explanation pattern for agent operating architecture.
- Maps well to the distinction between policy, reusable procedure, execution actor, connector, authority, and scheduler.
- Do not treat the carousel as proof of a specific architecture being universally correct; use it as a framing reference.

## 2. Context and memory are not the same thing

**Screenshot wording:** "규칙과 자동 학습을 한 파일로 보지 마세요."

The slide distinguishes:
- `CLAUDE.md` as durable instructions written by a human.
- Auto memory as separate notes accumulated by Claude.

**Normalized principle:** separate explicit human-authored operating instructions from model-maintained memory/state.

**Editorial / system implication**
- Strong explanatory reference for authority boundaries.
- Durable rules should live in an explicit, reviewable source of truth.
- Learned or accumulated context should remain secondary and should not silently override operating policy.

## 3. Repeated SOPs belong in Skills

**Screenshot wording:** "반복 SOP는 Skills로 저장합니다."

The slide adds that Skills are a device for reusing the same guidance and are **not** an engine that guarantees identical results every run.

**Normalized principle:** package repeated procedures as reusable skills, but do not confuse procedural reuse with deterministic execution.

**Editorial / system implication**
- Useful distinction for editorial skill design: a Skill encodes process constraints and reusable guidance, not outcome certainty.
- This supports explicit verification and acceptance stages downstream of skill execution.

## 4. Plugins are bundles of extension capability

**Screenshot wording:** "확장 기능은 Plugins로 묶습니다."

The screenshot groups Skills, Hooks, Subagents, and MCP under plugin-style extension packaging, with the caveat that actual composition and permissions follow organizational policy.

**Normalized principle:** extension mechanisms can be packaged together, but packaging must not erase the underlying authority and permission boundaries.

**Editorial / system implication**
- Relevant to how AES connectors, skills, hooks, and agent roles should be composed.
- Plugin packaging is a deployment/UX layer, not the canonical source of authority.

## 5. Subagents should receive bounded context

**Screenshot wording:** "전문 작업은 별도 맥락에 나눕니다."

The slide notes that parallel work is possible, but usage and coordination cost increase, and durable memory is not automatically created.

**Normalized principle:** delegate specialist tasks into bounded contexts rather than exposing every worker to the full state.

**Editorial / system implication**
- Strong reference for bounded-context review and specialist-agent design.
- Parallelism adds coordination overhead and should not be equated with free throughput.
- A subagent run does not create durable organizational memory unless explicitly persisted.

## 6. External tools must stay within granted authority

**Screenshot wording:** "외부 도구 연결은 권한 안에서만"

Examples shown include email, documents, and CRM through MCP-like connections.

**Normalized principle:** tool access is constrained by both server capability and authentication/authorization scope.

**Editorial / system implication**
- Directly relevant to connector governance.
- "Connected" must never imply unrestricted action.
- Action rights, read/write boundaries, and credential scope should remain explicit in system design and editorial explanations.

## 7. Checkpoints are not complete safety

**Screenshot wording:** "99% 안전은 검증된 수치가 아닙니다."

The screenshot states that checkpoints may not restore Bash activity, external changes, or most subagent edits.

**Normalized principle:** rollback/checkpoint features are partial recovery mechanisms, not proof of safety.

**Editorial / system implication**
- Important caution for any article or UI language that presents checkpointing as "safe" or "reversible."
- Recovery scope must be described precisely by mutation class.
- External side effects and out-of-band changes require independent controls.

## 8. Schedules are execution-environment dependent

**Screenshot wording:** "일정은 실행 장소마다 조건이 다릅니다."

The slide contrasts Cloud, Desktop, and `/loop`, noting that they have different computer/session requirements.

**Normalized principle:** scheduling semantics depend on the runtime environment and lifecycle of the executing session.

**Editorial / system implication**
- Strong explanatory pattern for avoiding vague "automation runs automatically" language.
- Any schedule description should name where it runs, what must remain alive, and what happens after disconnect/restart.

## 9. Record failure, not only success

**Screenshot wording:** "자율 운영도 실패를 기록했습니다."

The slide gives a small-store experiment example where discounting/free offers caused profit failure.

**Normalized principle:** autonomous-operation claims should include failure evidence and economic downside, not only successful executions.

**Editorial / system implication**
- Highly relevant to evidence standards for automation case studies.
- "It worked" should be separated from "it produced the desired business outcome."
- Failure cases are useful training/evaluation evidence and should be retained rather than discarded.

## 10. Start with a small task and an approval line

**Screenshot wording:** "작은 업무 하나와 승인선을 같이 적으세요."

Examples named: send, payment, deletion should be reviewed by a person before execution.

**Normalized principle:** begin automation with a narrow task and an explicit approval boundary for material or irreversible actions.

**Editorial / system implication**
- Strong operational pattern for staged automation.
- Human approval should be attached to mutation class, not added as a vague "human in the loop" slogan.
- High-impact actions such as sending, paying, deleting, publishing, or changing authority should remain explicit gates.

## Cross-cutting synthesis

The carousel's most reusable idea is a layered operating model:

```text
Human-authored rules
        ↓
Reusable SOP / Skills
        ↓
Specialist workers / Subagents
        ↓
External tools / MCP
        ↓
Permissions / approval gates
        ↓
Schedules / runtime conditions
        ↓
Execution evidence + failure record
```

For editorial use, the strongest transferable lessons are:

1. **Memory is not authority.**
2. **A Skill is reusable procedure, not deterministic outcome.**
3. **Packaging extensions does not collapse permission boundaries.**
4. **Subagents need bounded context and explicit persistence.**
5. **Connectors operate only within granted authority.**
6. **Checkpoint/rollback claims must name what they cannot restore.**
7. **Scheduling must name the runtime environment.**
8. **Failure evidence belongs in the system record.**
9. **Material actions need explicit approval lines.**

## Handling rule

This is a **capture-derived reference note**, not a product specification or authoritative Claude Code manual.

Before any of these points are used as:
- product documentation,
- implementation requirements,
- security claims,
- capability claims,
- or operational guarantees,

they should be checked against the relevant first-party documentation and the target runtime's actual behavior.
