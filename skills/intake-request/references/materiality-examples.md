# Materiality examples (intake-request)

Loaded only when it is not obvious whether a missing field is material
enough to ask about. Worked resolve/ask calls per axis, not a general
introduction — read `SKILL.md` first.

The test is always the same: would getting this wrong change thesis,
audience fit, transformation fidelity, artifact route, publication
constraint, or cost? These pairs show the same missing field landing on
both sides of that line, because the surrounding utterance is what decides
it — not the field in isolation.

## Transformation

- "이 자료 정리해줘" (organize this material), one source, no further
  context → **assumed: `compress`**. Any of `compress`/`extract`/`summarize`
  would read similarly here and the cost of guessing wrong is one revision.
- "이 벡터 DB 노트들 정리해서 뭔가 만들어줘" (organize these notes into
  something), multiple sources with independent claims → **material**.
  `compress` (shorten what's there) and `synthesize` (combine into a new
  argument) produce structurally different outputs, and "뭔가" (something)
  gives no signal which is meant.

## Content type

- A same-day market brief, no content type named → **assumed: `news`**.
  The source material is inherently time-sensitive; no other content-type
  profile fits better and asking would not change the evidence burden
  meaningfully.
- A multi-source technical write-up, no content type named, and the human's
  phrasing could support either a short note or a fully-sourced research
  piece → **material**. `note.json` and `research.json` differ by more than
  one required source and a `contradicting`-role requirement — resolving
  this wrong changes how much verification work happens before drafting.

## Audience

- "suengj.com에 올릴 글" (a piece to post on suengj.com), no audience named
  → **assumed** to the surface's usual reader (commonly
  `domain-practitioner`). The surface profile already implies a readership;
  nothing forces a different one.
- "우리 딸한테 읽어줄 수 있게" (so I can read it to my daughter) with no
  stated age → **material** only if the age band is genuinely ambiguous
  (toddler vs. upper-elementary vs. teen change the audience profile
  entirely). "초등학교 5학년" (5th grade) in the same sentence resolves it to
  `confirmed` immediately — always re-read the whole utterance (Procedure
  step 1) before deciding a field is missing at all.

## Surface

- No destination named, request otherwise ordinary → **assumed:
  `suengj-com`**, the default publication surface (spine §8). Getting this
  wrong costs a `publication.target_path` correction, not a rewrite.
- "이거 뉴스레터용으로도 다시 만들어줘" (also make this for the newsletter)
  layered on an existing suengj-com piece with no further detail → still
  **assumed: `newsletter`**, since the utterance names it; this is
  `confirmed`, not even a materiality question — included here only to show
  that a second surface stated explicitly is `confirmed` per artifact, not
  a single axis value for the whole intent when multiple outputs are asked
  for in one utterance.

## Artifact

- Artifact list empty, request only says "글 써줘" (write something) →
  **always material**. There is no safe default for zero specified
  artifacts; ask at minimum which medium, with `text/article` as the marked
  default when the rest of the utterance already implies a written piece.
- "그림도 하나" (also a picture), no artifact profile named → often
  **assumed**, not material: infer the artifact profile from context (a
  research piece's supporting image is usually `visual/evidence-visual` or
  `visual/body-infographic`, not `visual/thumbnail`, unless the utterance
  frames it as a cover image). Ask only when the surrounding context gives
  genuinely no signal which visual family is meant — for example, a bare
  "이미지 하나 추가해줘" (add one image) with no article context at all yet.
