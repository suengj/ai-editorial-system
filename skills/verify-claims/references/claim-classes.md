# Claim classes — reference

Loaded when classifying claims or deciding whether fresh retrieval is
required.

## The four classes

| Class | Example | Verification |
|---|---|---|
| **Stable** | A definition; a filed figure for a closed quarter; a historical date | Any reliable source. Age is irrelevant. |
| **Time-sensitive** | A current price; "as of now"; a market state; a live product capability | **Fresh retrieval required.** The claim carries its observation date. |
| **Primary-source-preferred** | A company's reported margin; a regulation's text; what a speaker actually said | Go to the filing, the statute, the recording. Commentary is corroboration, not evidence. |
| **Interpretation** | "This means margins will compress"; "the mechanism is X" | **Never verified.** Attributed to us, marked as our reading, and separated in the prose. |

## The test for time-sensitivity

Ask: *would this sentence have been false a year ago, or could it become false
next month?* If yes, it is time-sensitive, regardless of how stable it feels.

"Model prices have fallen" is time-sensitive. "Model prices fell between March
and August 2026" is stable — it has been pinned to a window.

Pinning a claim to a window is often the correct correction. It converts a
claim that will rot into one that will not.

## Freshness does not outrank authority

A recent blog post does not beat an older filing for a claim the filing
covers. Freshness decides *whether the claim is still current*; authority
decides *whether the source can establish it at all*. Both must hold.

## Phantom citations

A citation that resolves but does not support the claim beside it is worse
than no citation: it survives every link check and transfers unearned
authority.

Check the claim against what the source actually says, not against its title.
Two common shapes:

- The source supports a *weaker* version of the claim. Correct the claim, do
  not restate the source.
- The source supports the claim for a different scope — a different period,
  market, or definition. This is a scope error and requires a qualification.

## Contradictions

Two sources conflict. Before recording a contradiction, establish which kind
it is:

- **Factual** — they cannot both be right. Record both, weight by authority,
  and state the disagreement in the piece. Do not average.
- **Definitional** — they are measuring different things. This is the more
  common case and is frequently the more interesting finding. The correction
  is usually to name the boundary, not to pick a side.

Either way the losing source keeps the `contradicting` role in `source_set`. A
source that undercuts the thesis is lineage, not an omission.
