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

### Native Korean, not translated Korean

Korean-first is a composition rule, not just a language choice: the thought
must be formed in Korean, not reasoned out in an English outline and then
translated. A sentence can be grammatically correct and still read as
translated when the discourse order, the subject handling, or the connective
density is English-shaped rather than Korean-shaped.

The following are signals, not banned phrases. Any one of them can appear
once where the sentence genuinely needs it. The defect is repetition, or an
English-shaped discourse order running underneath correct Korean grammar:

> ~라는 점에서 · ~의 관점에서 · 이를 통해 · 이러한 맥락에서 · 결국 중요한 것은 ·
> 한편/반면/따라서 used as mechanical transitions rather than earned turns ·
> "A는 B를 의미한다" repeated as English-style declarative scaffolding ·
> abstract noun stacks (`구조적 변화의 전이 가능성에 대한 판단`) ·
> excessive ~에 있어, ~에 대한, ~을 통해 nominalization · a subject restated
> where Korean would let it drop · English clause order preserved when Korean
> information flow wants a different sequence

Preferred instead: let the subject stay implied once context carries it;
prefer a verb to a stacked noun; reorder or split a clause so the Korean
sentence follows its own order rather than the English original's; drop a
connective rather than swap it for a synonym; let a sentence end plainly
without an attached analytical conclusion; state the causal relation directly
rather than framing it.

None of this is a formula to apply uniformly. A dense, hypotactic sentence
(§5) is not translationese merely for being long, and a technical term
carried in English (above) is not translationese merely for being foreign.
The test is whether the thought reads as though someone thought it in
Korean.

This whole list is judgement, checked by a human or a reviewing model.
`quality-gates.json`'s `G-13` gate mechanically flags genuine repetition of
five of these strings only (`라는 점에서`, `다는 점에서`, `의 관점에서`,
`이러한 맥락에서`, `결국 중요한 것은`) — `이를 통해`, `~에 있어`, and `~에 대한`
are deliberately left ungated, because they occur too often in ordinary
technical Korean to flag without reading the sentence.

## 2. Restrained first person

The author is present but not performing. Positions are stated as positions.

> …라고 보고 있다.  ·  …로 두고 있다.  ·  내가 관심을 갖게 된 질문은 단순했다.

Not: 놀랍게도, 정말 흥미로운 점은, 여러분도 아시다시피.

The register is that of someone thinking carefully in public, not someone
addressing an audience.

This is the same principle as quiet authority: authority is demonstrated
through observation, evidence, mechanism, distinction, judgment, and
uncertainty handled well — never through self-positioning. First person
stays valid exactly where it identifies ownership of a judgment, a decision,
or a question; it is not valid where the sentence exists mainly to establish
that the author is qualified to have an opinion.

> Not: 전문가의 관점에서 보면 · 제가 주목하는 핵심은 · 이 글에서는 심층적으로
> 분석한다 · 전략적으로 중요한 시사점은 · "I study..." / "I specialize in..."
> when the sentence's only job is to establish authority rather than state a
> position.

The distinction is not the presence of the first person, or of a claim to
depth — it is whether the sentence does work (states a position, owns an
uncertainty) or performs one (announces that work is about to happen).

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
