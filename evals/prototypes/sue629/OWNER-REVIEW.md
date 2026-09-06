# SUE-629 — owner review package

> Status: **HUMAN_REQUIRED.** Nothing here is activated, published, or promoted.
> This is a request for your judgement, not a report that the work is finished.

## What you are being asked

The SUE-570 pilot produced infographics you judged materially inadequate. SUE-627 diagnosed
why, SUE-628 built a contract meant to prevent it, and this phase tested that contract on
real `suengj.com` material.

**The question is whether the new plates are actually better — not whether they comply.**
A schema-valid plate that still looks bad is a FAIL, and this package is deliberately built
so you can reach that verdict.

## Where to look

**Side-by-side review page:** https://claude.ai/code/artifact/ba0b6737-79f7-4325-b1be-5aef2ac3b0e8

It renders every rejected asset next to its candidate, each in its own viewport, with a
figure-width control at 358 / 390 / 672px. Use it at 358px first — that is where every
previous asset failed, and it is the one thing a terminal cannot show you.

Draft assets also live on `suengj-com` branch `sue-629-infographic-review` (PR #39,
review-only, nothing published).

## The comparison

| | negative baseline (SUE-570, rejected) | new prototype |
|---|---|---|
| mechanism / causal | `tools-report-infographic.svg` | `plate-a-mechanism.svg` |
| comparison / analytical | (none existed) `tools-news-diagram.svg` is the nearest | `plate-b-comparison.svg` |
| governance / structure | (none existed) | `plate-c-governance.svg` |
| quantitative control | `news-jp-us-10y-divergence.svg` (you rated PARTIAL) | `plate-d-quantitative-control.svg` |

Baselines are in `evals/negative-baselines/assets/`. All four new plates draw on the
canonical `companies-become-like-the-tools-they-use`, except the control, which reuses the
bond-yield chart. **No canonical article was modified.**

The control exists to separate two things. Its data, chart type and editorial content are
unchanged — decoded back from both layouts, JP `3.00 / 2.96 / 2.90` and US
`4.796 / 4.78 / 4.76`, identical to the accepted asset. Only the responsive behaviour
differs. So if you find the control better, that improvement is the mobile fix alone and
says nothing about the information-design work; and if you find A/B/C better, the control
tells you how much of that was the mobile fix rather than the new planning layer.

## What was measured, and what was not

Measured mechanically, verifiable by `node scripts/validate-plate.mjs`:

| | labels | enclosures | smallest type at 358px | responsive |
|---|---|---|---|---|
| SUE-570 body infographic | 22 (ceiling 8) | 12 for 4 modules | **5.2px** | scale only |
| SUE-570 accepted chart | 13 | 0 | **6.4px** | scale only |
| plate A | 6 | 0 | **15px** | re-stacks |
| plate B | 14 | 0 | **15px** | re-stacks |
| plate C | 8 | 3 | **15px** | re-stacks |
| plate D (control) | 14 | 0 | **15px** | re-stacks |

Every asset in the SUE-570 set — **including the two you rated conditionally acceptable** —
rendered body text at 5.2–10.1px on a ~390px reading surface. That is roughly a third of a
usable size, and none of them had any mobile strategy at all beyond shrinking. This was not
an infographic-specific defect, and the chart lane's PARTIAL rating should not be read as
"mobile-safe".

**Not measured, and not measurable by me:** whether these plates actually read well. I have
verified structure, arithmetic and constraint compliance. I have not seen them rendered, and
no amount of validation substitutes for you looking at them. That is the whole reason this
stops here.

## Per-plate: what it claims, and where to attack it

### Plate A — mechanism

Answers: *does the metric-improving path stay aligned with the reality-improving path as
optimisation repeats?*

The article's existing live visual redraws the `Reality → Metric → Target → Optimization`
chain that the prose states immediately above it — which this repository's own
`VISUAL-INFORMATION-GAIN.md` already classifies as a redundancy regression. Plate A
deliberately does not redraw that chain. It shows the divergence the chain cannot: two
trajectories separating across iterations.

**Attack it here.** The curves are hand-authored Bézier shapes. Position sits on a declared
scale with named axes and the plate prints no numbers, which is what the plan asks for — but
the discriminator this whole re-baseline rests on is *position computed from meaning versus
position assigned by hand*, and here the **shape is asserted, not computed**. The y axis is
declared direction-only precisely so it claims no measured quantity. Whether that is honest
schematic reasoning or the same sin in better clothes is a judgement I do not think I should
make on your behalf.

### Plate B — comparison

Answers: *across which dimensions does AI-agent programmability differ from spreadsheet
programmability?*

Four dimensions the article actually establishes, with row names on the axis and the delta
rendered as direction rather than two columns of text to subtract mentally.

**Known weakness, flagged by the builder and not resolved:** the plate's interpretive payload
— that all four dimensions move narrow→broad together — rests on four arrows pointing the
same way. That may be too thin a signal for a synthesis no sentence in the article states.
The width channel on two rows encodes no measured quantity, so a reader may read widening as
data.

The article supplies six dimensions; four are here. The other two were moved to plate C, not
deleted, and the plan records that as a redistribution so it stays auditable.

### Plate C — governance

Answers: *what actually differs, structurally, between a governed workflow and a shadow
workflow?*

The builder's own assessment, which I share, is that this is the strongest plate. Its point
is an **absence**: the shadow workflow has no authority connector at all, and that is only
perceivable next to a workflow whose loop closes. Containment, flow and authority are on
three genuinely distinct channels — a nesting boundary used for nothing else, a solid
labelled arrow, and a dashed line ending in a bar rather than an arrowhead.

**Known limitation:** one of three flow connectors carries a verb label. The family's label
ceiling has no derivation that would justify raising it, and inflating a second ceiling to
fit my own output is exactly the move this work exists to prevent. So it ships short.

### Plate D — quantitative control

Same data, same chart, mobile fix only. Its two ISO-date credit lines moved out of drawn text
into `<desc>`, where the accepted asset already carried the rest of its provenance correctly.

## Evaluate on these, separately

Structural — I have checked these, please confirm:

- relation correctness · reading order · semantic completeness · deterministic label accuracy

Judgement — only you can settle these:

- **information gain** — is each plate genuinely faster to understand than the adjacent prose?
- **argument fidelity** — does it say what the article says?
- **visual restraint** — does it read as an editorial research spread or as a diagram?
- **typography hierarchy** — does the structure come through without chrome?
- **publication-native finish** — does it look like suengj.com?
- **mobile readability** — check at ~390px, which is where every previous asset failed.

## If the verdict is failure

Please say which layer, and I will fix only that one:

```text
information missing            → semantic plan
reading order wrong            → composition plan
too many boxes                 → composition grammar
text or numbers wrong          → deterministic rendering
accurate but repeats the prose → information-gain planning
ugly but structurally sound    → rendering / visual treatment
looks copied                   → reference selection
two questions on one canvas    → plate split
```

Unbounded re-rendering is explicitly not the response.

## What stays blocked until you rule

- no production profile activation;
- no canonical article replacement;
- no live publication;
- no promotion of any SUE-570 asset, charts included, to a positive reference;
- SUE-605 stays open.

One profile default did change during this phase, and you should know because it is the only
durable change made without your review: `visual/analytical-graphic`'s label ceiling went from
10 to 14. A labelled comparison across N dimensions needs `3N+2` labels, so the old ceiling
permitted two dimensions and forbade three or four — the family that exists for comparisons
forbade naming the rows of any comparison past two. The first render obeyed it by dropping
plate B's row names, which left the y axis unnamed in the artwork. If you would rather the
ceiling had held and the plate been split instead, say so and I will revert it.
