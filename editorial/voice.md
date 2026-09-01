# Suengj voice

Prose characteristics, derived from published `suengj-com` writing rather than
invented. Structure belongs to the content-type profiles; principles belong to
`constitution.md`. This document describes only **how the sentences sound**.

Rules are in English because the repository is; examples are Korean because
the prose is.

---

## 1. Korean-first, with technical terms left in English

Korean carries the argument. Technical vocabulary stays in English and is not
translated into awkward Korean equivalents.

> AI Agent를 실제 프로젝트에 오래 붙여두면 관심사는 자연스럽게 모델 자체에서
> **운영 구조**로 이동한다.

`Context Engineering`, `Permission Boundary`, `Multi-Agent Orchestration`,
`gross margin`, `inference` — these appear in English. Do not write
"문맥 공학" or "권한 경계선". A reader who works in this field reads the
English term faster than any translation of it.

English-language pieces exist and are terser and more declarative. Same
principles, fewer connectives.

## 2. Restrained first person

The author is present but not performing. Positions are stated as positions.

> …라고 보고 있다.  ·  …로 두고 있다.  ·  내가 관심을 갖게 된 질문은 단순했다.

Not: 놀랍게도, 정말 흥미로운 점은, 여러분도 아시다시피.

The register is that of someone thinking carefully in public, not someone
addressing an audience.

## 3. Distinctions are the characteristic move

The most recognisable thing about this voice is that it separates things
others conflate, and names the separation.

> observed ≠ declared ≠ inferred ≠ normative

> Agent가 GitHub를 수정할 수 있다는 사실과, 현재 역할의 Agent가 그 변경을
> 수행해도 된다는 것은 별개의 문제다.

When a paragraph is doing real work, it is usually drawing a line. Prefer
"A와 B는 다른 문제다" over "A는 중요하다".

## 4. Bold marks concepts, not emphasis

`**Operating Model**`, `**Project State**`, `**운영 구조**` — bold introduces
the term the paragraph is about. It is not used for excitement and never for
whole sentences.

## 5. Paragraph rhythm

Three to six sentences. The first states the point; the middle develops it
with a mechanism or a number; the last lands a consequence or a limit.
Single-sentence paragraphs are allowed for a turn, not as a habit.

Sentences are medium-length and hypotactic — subordinate clauses that carry
conditions, not decoration. Do not chop prose into staccato fragments to
appear punchy.

## 6. Structures shown as structures

Pipelines, lifecycles, and hierarchies appear as fenced text blocks rather
than being narrated:

```text
Diagnosis → Prescription → Compilation → Validation → Controlled Apply
```

If a sequence takes three sentences to describe, draw it.

## 7. Counterarguments are load-bearing

The strongest objection appears, stated at full strength, and is answered or
conceded. Views carry an explicit `counterarguments` list and a `confidence`
level; that habit extends to the prose.

> CMS tools win on collaboration UX and full-text search out of the box. If
> Suengj Note needed multi-author daily publishing, I'd reconsider.

Conceding a real limit strengthens a piece. Pre-empting a strawman weakens it.

## 8. Openings start at the argument

No throat-clearing, no scene-setting, no definition of a term the reader
already knows. The first paragraph either states the position or states the
question precisely enough that the position is implied.

Banned openings: 최근 ~가 화두다 · 오늘날 급변하는 · 바야흐로 · In today's
rapidly evolving landscape · It is no secret that.

## 9. Endings stop

The last paragraph carries the consequence or the open question. It does not
summarise what was just read, and it does not reach for a note of uplift.

Banned closings: 결론적으로 살펴본 바와 같이 · 앞으로가 기대된다 · Only time
will tell · The future is bright.

## 10. Numbers appear as numbers

"3배" not "크게 증가". "$0.04/image" not "저렴한 편". When the figure is
unknown, the sentence says it is unknown — it does not substitute an adjective
for the missing number.

## 11. What this voice does not do

- Rhetorical questions used as section transitions.
- Enumerated "3 reasons why" framing when the reasons are not parallel.
- Repeated section framing ("What happened / Why it matters") applied
  mechanically to every piece.
- Analogies for decoration. A historical analogue appears only where it
  sharpens the argument, and it is then examined, not merely invoked.
- Emoji, exclamation marks, second-person coaching.

## Protected against style-only rewrite

A polish pass may change rhythm, connectives, ordering within a paragraph, and
word choice **outside** the protected set. It may not alter:

facts · numbers · dates · citations and citation ids · quotations ·
technical terms · the thesis · stated uncertainty

This is enforced mechanically, not trusted to judgement — see
`quality-gates.md` (`polish-invariants`). It is what makes "polish" different
from "rewrite", and it is why this document contains no rule of the form
"vary sentence length to sound more natural".
