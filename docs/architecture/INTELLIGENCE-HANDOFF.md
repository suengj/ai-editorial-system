# Intelligence → Editorial Handoff

Status: **V0 cross-repository contract**  
Upstream learning SSOT: `suengj/reference-library`  
Editorial authority: `suengj/ai-editorial-system`

## Purpose

`reference-library` now maintains a recurring Learning Intelligence layer: Daily Briefs, a cumulative Knowledge Map, Article Candidates, and selected-topic Dossiers. These artifacts may seed editorial work, but they do **not** become editorial authority or factual authority merely because they were curated upstream.

This document defines the boundary from that intelligence layer into the AI Editorial System.

## Two different meanings of “reference”

Do not conflate these systems:

| Concept | Authority | Role |
| --- | --- | --- |
| External source registry / learning intelligence | `reference-library` | What external material is worth monitoring; what was learned; candidate topics; provenance-linked evidence maps |
| Editorial craft reference / evaluation traits | `ai-editorial-system/references/` and editorial profiles | How quality, structure, style, audience fit, or artifact craft should be evaluated or guided |

An external analysis source is not automatically a preferred craft reference. A preferred craft reference is not automatically evidence for a factual claim.

## Entry condition

The Editorial Core is invoked only after one of these occurs:

1. the owner explicitly asks to write from a Daily Brief / Knowledge Topic / Candidate / Dossier; or
2. an upstream candidate is explicitly marked as selected by a human-controlled workflow.

A Daily Intelligence run alone does not authorize article generation.

## Handoff inputs

A selected Topic Dossier should provide, by URI/reference rather than copied source bodies where practical:

- working topic / question;
- why-now context;
- source links and provenance;
- evidence roles (`primary`, `A+`, `A`, specialist, P03/YouTube);
- known counter-evidence or competing explanations;
- unresolved factual risks;
- related Knowledge Topic / Daily Brief references;
- last research date and freshness status.

The dossier should avoid polished draft prose. Its purpose is evidence scaffolding, not pre-writing.

## Mandatory pre-write refresh

Before framing or writing, the Editorial workflow must assess whether the evidence is fresh enough for the topic.

Default research windows are guidelines, not hard-coded truth:

| Topic type | Typical fresh-research window |
| --- | --- |
| Fast-moving AI, models, agents, markets, current events | 7–14 days |
| Business, industry, management, technology adoption | 30–90 days |
| Research, history, conceptual synthesis | Adaptive; extend historically as needed |

The workflow should widen or narrow the window when the claim horizon requires it.

The refresh should:

1. re-open the material claims and source links that matter;
2. seek the strongest available primary evidence;
3. check for material developments since the dossier was last updated;
4. seek meaningful counter-evidence, not merely additional agreement;
5. record sources added during the refresh.

For fast-moving topics, perform an additional freshness check close to publication; target 24–48 hours before publish when practical.

## Evidence rule

Source tier is a workflow role, not a truth score.

- `A+` is primarily a **trigger / high-signal discovery role**.
- `A` is primarily a **context, corroboration, or counter-view role**.
- `primary` is the preferred factual authority where available.
- P03/YouTube summaries remain derived material unless the originating video itself is the primary event/evidence being analyzed.

No claim becomes verified merely because a Daily Brief, Knowledge Map, or Topic Dossier says it is true. `verify-claims` must resolve the claim to admissible evidence under the existing source policy.

This is now mechanically enforced rather than only stated. A selected dossier enters as a source of kind `intelligence_dossier` (repo + immutable commit + path + content hash, body never copied here), and `npm run validate:source` rejects any manifest that cites it with `role: primary` — see [`../../schemas/SOURCE-CONTRACT.md`](../../schemas/SOURCE-CONTRACT.md). The dossier may still be cited as `supporting`, `background`, or `contradicting` context.

`youtube_summary` remains exempt from that rule, because a video can be the primary event under analysis; the judgement stays with `verify-claims`.

## Editorial sequence remains unchanged

```text
Selected Candidate / Topic Dossier
        ↓
Freshness + source refresh
        ↓
Editorial Intent
        ↓
Frame / NO_ARTICLE
        ↓
Write
        ↓
Verify
        ↓
Polish
        ↓
Evaluation / HITL
        ↓
suengj.com handoff
```

The upstream recommendation cannot bypass `Frame` or prevent `NO_ARTICLE`.

## Output boundary

The Editorial Core may return:

- `NO_ARTICLE` with reason;
- an Article Frame requiring more evidence;
- a ready frame;
- a draft/finalized Editorial Package under existing contracts.

It does not update the Knowledge Map merely to make the article cleaner, and it does not publish directly.

If the editorial research materially changes the owner's durable understanding of a topic, that is a **feedback candidate** for the Learning Intelligence layer; it should be routed back explicitly rather than silently rewriting upstream knowledge.

## Status

The handoff is certified as of 2026-09-09 (SUE-737). No second writing path was created: a selected dossier enters through the existing `intake-request` → `frame-article` sequence as an ordinary source manifest entry. The only contract delta was the `intelligence_dossier` source class and the `derived-evidence-role` invariant above.

## Non-goals

- Re-implementing blog/RSS crawling inside `ai-editorial-system`.
- Copying the P03 corpus into this repository.
- Treating `reference-library` as a source-body database.
- Creating article quotas from Daily Intelligence.
- Allowing source popularity or source tier to replace claim-level verification.
