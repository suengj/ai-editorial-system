# Answer unit contract (AEO-P2.3 / SUE-525)

An **answer unit** is the retrieval-facing compression of an article: the
question it answers, one concise answer, and pointers into the claims the
article already verified. It exists so an AI or search system reading
`suengj.com` does not have to *infer* which sentence is the answer and which
evidence stands behind it.

Machine schema: [`article.schema.json`](article.schema.json) `$defs.answer`.
Enforced by `scripts/lib/article-contract-core.mjs` (`answer-unit` code),
regression-tested in `scripts/test-article-contract.mjs`.

## Shape

```json
{
  "answer": {
    "question": "Did per-token price cuts move the filer's gross margin?",
    "summary": "Published prices fell while the reported gross margin did not move materially.",
    "claims": [
      { "claim_id": "c1", "kind": "fact", "anchor": "published per-token inference prices" },
      { "claim_id": "c3", "kind": "interpretation", "anchor": "serving infrastructure is the dominant share" }
    ]
  }
}
```

The unit is **additive**. An article with no answer unit is complete, and
removing one removes nothing from the canonical Markdown.

## Invariants

A compression is where fabrication enters: the shorter the surface, the easier
it is to assert something the article never established. The contract closes
that gap mechanically rather than by review habit.

| Rule | Why |
|---|---|
| `claim_id` must exist in `verification.claims` | The unit points at claims; it never introduces them. |
| `kind: fact` requires `status: verified` **and** at least one `evidence` entry | No support, no fact. An unsupported statement must be labelled `interpretation` or `forecast`. |
| A claim may be referenced once | Repetition in a summary reads as corroboration that does not exist. |
| `summary` ≤ 400 characters | An answer, not a second article. |
| `anchor` ≥ 8 characters of body text | The compression is checkable against the full article instead of trusted. |

`kind` is deliberately a different axis from `verification.claims[].kind`
(`number`, `date`, `quotation`, `attribution`, `assertion`), which describes
*what sort of statement* a claim is. The answer unit's `kind` describes *what
the reader is being offered* — and that is the distinction a retrieval system
needs in order not to quote an opinion as a sourced finding.

## Boundary

This repository owns the meaning: what a claim is, whether it is verified,
what evidence supports it, and therefore whether an answer may call something a
fact. `suengj-com` owns publication: rendering the answer unit as visible HTML,
emitting truthful structured data, and refusing anything whose support does not
resolve.

The unit crosses the boundary **resolved, not by reference**
(`scripts/lib/handoff-core.mjs`): claim text and supporting URLs are copied
into the handoff front matter, so the site never reads this repository's claim
store and can never publish an answer whose support was not recorded here.

Front matter handed to the site:

```yaml
answer:
  question: "…"
  summary: "…"
  claims:
    - id: c1
      text: "…"          # copied from the verified claim
      kind: fact
      anchor: "…"        # verbatim body text
      support: ["https://…"]   # evidence URLs; absent when there are none
```

## Prohibitions

* No FAQ stuffing — an answer unit answers the question the article actually
  addresses, not a list of questions assembled for crawlers.
* No crawler-only text. Everything in the unit is visible on the page.
* No fabricated confidence. There is no confidence field; epistemic honesty is
  carried by `kind` plus the verification status behind it.
* No fabricated citation. Support comes from recorded evidence or is absent.
* No `ClaimReview`, `FAQPage`, or `HowTo` markup on the publication side: the
  site is not making a fact-checking claim about third-party statements.

## Content-type behaviour

| Type | What the answer unit may carry |
|---|---|
| `research` | Evidence-backed findings compiled from verified claims. `fact` is normal here. |
| `view` | The thesis as `interpretation`; only genuinely sourced premises may be `fact`. |
| `news` | Event and source provenance, with freshness carried by the article's dates. |
| `note` | A source-derived summary, kept distinct from the author's own note. |
| `project` | Identity and status. Project copy is not a research claim and must not be presented as one. |
