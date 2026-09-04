# Portability probe — 2026-09-05 · intra-family capability

Trigger: AES-V2.11 (SUE-569) certification, area 8. This is the **first real
operating evidence** in this repository: three agent routes were actually run,
not simulated.

## What this probe is, and what it is not

**It is not the cross-vendor comparison SUE-569 requires.** All three routes are
Claude-family. That issue's certification area stays `NOT_RUN`, and reporting
this as satisfying it would be the exact failure it warns against — *"a
portability failure cannot be hidden by certifying only the manager's preferred
model."*

**It is a capability-tier probe**, and it tests the sharper risk. Vendor syntax
is not what breaks a portable SSOT; contracts that require *inference* rather
than *statement* are. A weaker model reading the same contract is an efficient
instrument for finding those.

## Method

One ordinary Korean utterance, one frozen repository state (`b3bf4f2`), three
routes run blind and in parallel, none able to see another's output. Identical
prompts. No file was written during the probe.

> P03에 모아둔 AI 에이전트 자료들 좀 묶어서 suengj.com에 올릴 글 하나 써줘.
> 독자는 AI 실무자야. 본문에 들어갈 인포그래픽도 하나 만들어줘.
> 아, 그리고 이 이미지 참고해 — 정보 배치는 좋은데 색감은 따라하지 마.

The utterance was chosen to carry, in one natural sentence: a source, a
reference with a *partial-adoption* qualifier, an audience, a surface, and two
artifacts across two modalities.

| Route | Model |
|---|---|
| A | Haiku 4.5 |
| B | Sonnet 5 |
| C | Opus 5 |

Compared on the six semantic contracts SUE-569 names. Style and wording
differences are expected and ignored; only contract interpretation is scored.

## Result

| Contract | A | B | C | Agreement |
|---|---|---|---|---|
| Transformation | `synthesize` confirmed | same | same | **3/3** |
| Audience | `domain-practitioner` confirmed | same | same | **3/3** |
| Surface | `suengj-com` confirmed | same | same | **3/3** |
| Artifact ids | `text/article`, `visual/body-infographic` | same | same | **3/3** |
| Source vs Reference | correct split | correct split | correct split, plus `do_not_copy` ≠ `avoid` | **3/3** on substance |
| Content-type materiality | `research` / **assumed** | `missing_material` | `missing_material` | **2/3 — A violates the contract** |
| Clarification set | image only | content type only | both | **0/3 identical** |
| Routing layer | "VISUAL / density" (paraphrase) | `information_density` | `information_density`, three-state | **2/3 exact id** |
| Calibration authority | task-scoped (imprecise) | none applicable, task-scoped | `calibration_ref: null`, class 0 | **3/3 on the firewall** |

## Findings

### P1 — PASS: the load-bearing distinction is portable

Source versus Reference resolved identically on all three routes, including the
partial-adoption split — adopt the information layout, do not copy the palette.
No route let the reference establish a fact, and no route treated the image as
wholesale style permission. This is the single most important contract in V2 and
it survived a three-tier capability spread.

The calibration firewall also held 3/3: no route proposed that anything in this
request durably change owner preference.

### P2 — FAIL: the materiality test is stated but not computed

`schemas/EDITORIAL-INTENT-CONTRACT.md:82` is explicit — *content type unstated,
and the difference between `note` and `research` changes the evidence burden by
more than one source → material.* Content type was unstated; `research` requires
3 sources, `view` requires 1. Material, unambiguously.

Route A marked it `assumed`, cited the contract as its authority, and supplied a
justification appearing nowhere in it ("getting it wrong costs little to correct
later; the risk direction is acceptable"). It substituted a plausibility
judgement for a numeric test and dressed it in a citation.

Per SUE-569 the first move is to check for contract ambiguity. **The contract is
not ambiguous.** The defect is that the rule is *stated* rather than *computed* —
the same failure pattern the independent review found nine times over, appearing
again on the intake path. `min_sources` is a field in every content profile; the
delta is mechanically computable and currently is not computed.

**Fix: compute materiality rather than asking a model to judge it.** Not a
prompt hack — an executable check.

### P3 — FAIL: the clarification set is non-deterministic

Three routes produced three different question sets. A asked only about the
missing image; B asked only about content type; C asked both. Each set is
individually defensible under "ask only what is material", and no two agree.

Both gaps were real: content type was material by the contract's own numeric
test, and `이 이미지` is a deictic pointer with nothing attached, which intake may
not resolve by inventing a `ref_id`. **C was right; A and B each missed one.**

The contract says *when* to ask but does not let a router enumerate *which*
fields are material for a given intent shape. Same root cause as P2, same fix.

### P4 — PARTIAL: a routing layer may be described instead of named

Route A emitted `"VISUAL / density"`; B and C emitted `information_density`. Any
downstream consumer keying on the id breaks on A. The validator enforces the id
on a persisted record, but the Skill body never says *emit the id, not a
description*.

### P5 — the unbuilt `text/*` gap surfaced in live operation

B and C noticed `text/article` is a `planned` id with no profile; A treated it as
available. Not a contract defect — the NOTE mechanism worked — but this is the
first time the gap has appeared in operation rather than in a validator line.

## Verdict

**Semantic contracts are portable across a three-tier capability spread; the
clarification gate is not.**

The axes, the Source/Reference boundary, and the calibration firewall held
unanimously. What did not hold is the one decision left to model judgement
rather than computation. That is a precise, actionable result, and it points at
a fix that makes the system *less* dependent on model strength rather than more.

Certification effect: area 8 stays **`NOT_RUN`** for cross-vendor portability.
This probe is recorded as intra-family evidence only.
