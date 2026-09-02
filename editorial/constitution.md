# Editorial Constitution

Durable principles. They hold across every content type, every artifact, and
every generator. Content-type structure lives in the profiles; prose
characteristics live in `voice.md`; enforceable conditions live in
`quality-gates.md`. Nothing type-specific belongs here.

Ten principles. If a rule is not load-bearing across all five content types,
it is not constitutional.

---

## 1. Evidence outranks rhetoric

A claim is worth what its evidence is worth. Fluency is not evidence, length
is not evidence, and confident phrasing is not evidence. When the evidence is
thin, the sentence says so.

## 2. Fact, interpretation, and hypothesis are marked apart

Three different things, never blended into one register:

- **Fact** — verified, cited, attributable to a source that can be checked.
- **Interpretation** — our reading of the facts. Ours, and named as ours.
- **Hypothesis / scenario** — what would follow *if* something holds.

A reader must be able to tell, sentence by sentence, which one they are
reading. Blending them is the most common way a piece becomes untrue while
containing no false statement.

## 3. Uncertainty is stated, not smoothed

What we do not know appears in the piece. An article with no stated
uncertainty is either about something trivial or is hiding something. This is
why an Article Frame with an empty `uncertainty` list is rejected outright.

Stating uncertainty is not hedging. "We do not know X" is precise; "results
may vary" is filler.

## 4. Synthesis, not sequential summary

An article is not a queue of sources restated in order. The value is in the
connection the sources do not make themselves: a contradiction between two of
them, a number that undercuts a narrative, a pattern visible only across
several.

**The topology of the source set is never, by itself, the topology of the
article.** A repository tree, README section order, report table of contents,
search-result order, or research notebook is an inventory of material, not an
outline. A consulted source earns a place in the published piece only when it
does load-bearing work for the argument; coverage is not a quality target.

If the piece could be replaced by reading the sources, files, or repository
sections in order, it should not exist.

## 5. A thesis, or no article

Every **drafted article** is written from a stated thesis. This is a publication
boundary, not a command to decide the answer before research begins. Source
discovery may start from a question, competing explanations, or an unresolved
observation; a thesis formed early remains provisional until it has met the
strongest evidence that could narrow or overturn it.

When the corpus does not support a thesis by the Article Frame boundary,
`no_article` with a recorded reason is the correct outcome — not a weaker
article on the same topic.

Declining to publish is a normal result of the process, not a failure of it.

## 6. Verification is not editing

Checking whether a claim is true and improving how it reads are different
activities with different authority. Polish may not change a fact, a number, a
date, a citation, a quotation, a technical term, the thesis, or a stated
uncertainty. If a polish pass wants to change one of those, it has found a
verification problem and must say so instead.

## 7. Do not write to sound human

The objective is **Suengj editorial fit with factual and technical integrity
preserved** — never "looks less machine-generated". Any rule whose purpose is
to defeat a detector is out of scope and will be removed. A piece that reads
as ours because it argues like ours has succeeded; a piece that reads as ours
because its sentence lengths were randomised has not.

## 8. Provenance survives every transformation

Source → frame → draft → final → artifact. At each step the trail back to the
evidence remains intact. An artifact that asserts a fact the article never
verified is a defect, regardless of how good it looks.

## 9. Density over volume

Every paragraph changes what the reader knows or understands: a number, a
mechanism, a distinction, a consequence, or the explanation needed to make a
hard inference legible. Filler sections, restated headings, and paragraphs that
only announce what the next paragraph will say are cut.

Density is not compression. A paragraph may spend words making a difficult
connection easier to absorb without adding another fact or citation. Shorter
is not automatically better. Emptier always is worse.

## 10. Human finalization is not publication

AI drafts. A human reviews, revises, and finalizes. Publication is a separate,
explicit human act. No process in this system may collapse those two steps,
and no quality score may substitute for the second one.

---

## Precedence

When principles collide, resolve in this order:

1. **Factual integrity** (1, 2, 6, 8) — never traded away.
2. **Human authority** (10) — never automated around.
3. **Editorial worth** (4, 5, 9) — decides whether to publish at all.
4. **Voice and fit** (7) — shapes what is published, never what is true.

Style never wins over fact. Worth never wins over honesty about uncertainty.

## What this document is not

- Not a structural template. See `profiles/`.
- Not a style guide. See `voice.md`.
- Not a checklist. See `quality-gates.md`, which is executable.
