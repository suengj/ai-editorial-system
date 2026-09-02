# Source weighting — reference

Loaded when the source set mixes authority levels, contains sources that
disagree, or includes evidence that could materially narrow the proposed
thesis.

## Authority is per claim, not per source

There is no global ranking of sources. A source is authoritative *for
something*:

| Source | Primary for | Weak for |
|---|---|---|
| Vendor pricing page | that vendor's list prices, and their effective date | anyone's realised cost, margins, or negotiated rates |
| Regulatory filing | reported financials as filed | forward-looking interpretation |
| YouTube summary | what the speaker said | whether the speaker was right |
| Market brief | the series it reports, on its observation date | causal explanation |
| Project repository | what the code does at a pinned commit | what the project intended or achieved |
| Press coverage | that a statement was made | the truth of the statement |

Record weighting against the claim, so a later reader can see *why* one source
outranked another for a specific number.

## Freshness is a second axis, not a tiebreak

A recent secondary source does not outrank an older primary one. The question
is whether the claim is time-sensitive:

- **Stable** — a definition, a historical figure, a filed number. Age is
  irrelevant.
- **Time-sensitive** — a price, a rate, a "currently", a market state. The
  source must be recent *relative to the claim*, and the claim must carry its
  observation date.

## Challenge evidence is not noise

Do not reduce research to a search for a source that says the opposite. The
useful challenge can take several forms:

- **Factual conflict** — two claims cannot both be true under the same scope.
- **Definitional conflict** — the sources use the same label for different
  boundaries or measurements.
- **Boundary evidence** — a finding holds, but only for a narrower population,
  period, mechanism, or condition than the proposed thesis assumes.
- **Missing-variable evidence** — the observed relationship survives, but a
  plausible variable makes the proposed causal reading too strong.

For each material challenge, record:

1. what the source actually establishes, at full strength;
2. what it is authoritative for;
3. which part of the thesis it changes — truth, scope, mechanism, confidence,
   or none.

Do not average unresolved sources and do not silently pick the convenient one.
A definitional conflict often produces a better article by forcing a boundary
to be named. A boundary source may be more useful than an explicit opponent.

The existing lineage role `contradicting` covers a source that **directly
contradicts or materially undercuts the scope of the thesis**. The name does
not require a binary debate. Give a source that role only when the thesis would
be materially weaker or narrower if the source is right. Record the unresolved
part in `uncertainty`.

## Count is not weight

Ten summaries of one event are one source. Before treating a set as broad,
collapse it by underlying origin: shared `content_hash`, shared upstream URL,
or the same event reported downstream.
