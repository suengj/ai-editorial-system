# PoC findings (AES-P4.1–P4.3)

What the artifacts in this directory actually showed, and what would have
happened had they shown otherwise.

## Evidence visual — the chart tested the thesis

`specs/cost-stack.chart.json` → `cost-stack.svg`.

The chart plots two indexed series over the same window: mid-tier list price
(claim `c1`) against reported gross margin (claim `c2`).

**What it showed.** The price series falls to 70 while the margin series stays
within one point of 100. The divergence is the argument, and it is visible
without reading a number off the axis.

**What it would have meant otherwise.** If margin had tracked price, the
article's thesis would have failed and the correct response would have been to
return to framing — not to redraw the chart, and not to soften the prose. That
is why the plan records a `feedback_point` per evidence visual, and why
evidence media is gated at `framed` rather than at `final`.

**What it cannot do.** The renderer cannot invent a point. Every value comes
from the spec, every series names the claim it depicts, and the claim must be
`verified` on the article. Period, units, and source note are required fields:
a spec missing any of them throws rather than rendering a chart that invites
misreading.

The chart also carries no colour. Series are distinguished by dash pattern and
an inline label, so it reads in either theme and does not depend on colour to
carry meaning — the same rule as the presentation contract.

## Structural visual — the diagram carries no quantities

`specs/cost-flow.diagram.json` → `cost-flow.mmd`.

A flow of where a price drop lands in the cost stack. Deliberately
**quantity-free**: it shows that three inputs meet at inference spend and that
spend is one line among several in COGS. It does not show how much, because
the sources do not establish how much, and a diagram that implied a magnitude
would be asserting something the article cannot support.

The Mermaid source is the artifact. Rendering is a build product.

## Brief — a door, not a second article

`brief.md`, compiled from article version 3 and the plan's brief decision.

Carries three verified claims with their citations, the article's stated
uncertainty, and a link to the full piece. It cannot carry a claim the plan
did not name or the article did not verify — the generator refuses.

Uncertainty is **mandatory** in the brief. Dropping it would make the short
form more confident than the long one, which is the most likely way a brief
misleads.

## Deck — the chain stays textual

`deck.md`, Marp-compatible, six argument beats plus an uncertainty page.

`theme: suengj` is a *name*. What it resolves to is `suengj-com`'s decision,
exactly as in the presentation contract. Nothing here chooses a colour.

## Determinism

All four artifacts regenerate byte-identically from unchanged inputs:

```
npm run poc:check
```

This is the property the P1.2 benchmark argued for and could not verify from
vendor claims. It now holds for our own renderers, which is a narrower but
real result: **the spec is the artifact, the render is a build product.**

## Honest limits

- The brief and deck generators are **deterministic compilers, not writers**.
  They assemble verified claims and a planned hierarchy into a fixed shape.
  That proves the contract, the lineage, and the refusals — it does not prove
  that a model-written brief would stay inside the same boundary. The
  generator slot remains replaceable, which is the point, but the replacement
  has not been tested.
- The chart renderer is ours and handles one chart type. It is not a
  Vega-Lite implementation and does not validate that claim by proxy.
- The worked article mixes a Korean title with English claim text, so the
  generated brief reads bilingually. That is a fixture artefact, not a
  contract decision.
