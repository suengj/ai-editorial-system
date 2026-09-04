# Surface adapters (AES-V2.9 / SUE-567)

The system-role architecture V2-EDITORIAL-LEARNING-CORE.md section 7 states
in prose; this document is its short, checkable form.

```text
P03 / Drive / GitHub / Web      ingestion — source availability
            ↓
AI Editorial System             transformation · audience · framing ·
                                 quality · evaluation      (SSOT)
            ↓
suengj.com   NotebookLM   academic   newsletter   YouTube   …    adapters
```

The handoff object between the Core and every adapter is the
**Editorial Package** ([`../../schemas/editorial-package.schema.json`](../../schemas/editorial-package.schema.json),
[`../../schemas/EDITORIAL-PACKAGE-CONTRACT.md`](../../schemas/EDITORIAL-PACKAGE-CONTRACT.md))
or, for `suengj.com` specifically, the existing handoff receipt
([`SUENGJ-COM-HANDOFF.md`](SUENGJ-COM-HANDOFF.md)). Nothing else crosses.

## What ingestion is

P03, Drive, GitHub, and the web are **source availability**, not editorial
input. They make material reachable by reference (`schemas/source.schema.json`,
`SOURCE-CONTRACT.md`). None of them may set audience, transformation, or
framing — that authority starts downstream, at intake.

## What the Core is

This repository is the sole system of record for transformation, audience
fit, framing, quality gates, and evaluation — see
[`SSOT-BOUNDARIES.md`](SSOT-BOUNDARIES.md). Every adapter reads a package or
a receipt; none of them reads editorial state directly, and none of them may
write editorial rules back into the Core.

## The adapter contract

An adapter is anything downstream of an Editorial Package:
`suengj.com`, NotebookLM, an academic export, a newsletter, a YouTube
render, a future workspace nobody has named yet.

| An adapter | Because |
|---|---|
| **Consumes** an Editorial Package and applies its own surface profile | The package is destination-neutral by construction; the adapter supplies the destination-specific rendering. |
| **May be swapped without a Core change** | Adding or replacing an adapter is a `target_surfaces` value plus, eventually, a profile file under `editorial/profiles/surface/` — never a router, evaluator, or schema change (V2-EDITORIAL-LEARNING-CORE.md section 7, "Extension rule"). |
| **Never writes editorial rules back into the Core** | An adapter's own constraints (a platform's character limit, a channel's house style) belong in that adapter's surface profile, not in this repository's transformation or content-type profiles. |
| **Never becomes a runtime dependency of anything already published** | A `suengj.com` article renders from its Markdown and front matter alone, with or without this repository reachable (`SUENGJ-COM-HANDOFF.md`, "No reader-side runtime dependency"). The same must hold for every other adapter's published output. |

`suengj.com` is the **default** adapter, not the Core's identity. It is
implemented as a profile under `editorial/profiles/surface/` and
`editorial/profiles/brand/`, and it appears nowhere in core routing logic.

## NotebookLM, specifically

NotebookLM is a **replaceable consumption adapter**. Stated explicitly
because it is the adapter most likely to be reached for as a shortcut:

- NotebookLM may never become **editorial authority**. It does not decide
  transformation, audience, or framing; it receives the result of those
  decisions, already made, as an Editorial Package.
- NotebookLM may never become a **runtime dependency**. Nothing in this
  repository's validation, generation, or evaluation may require NotebookLM
  to be installed, running, or reachable. If NotebookLM is unavailable, every
  other surface is unaffected.
- A NotebookLM handoff is an ordinary Editorial Package with
  `target_surfaces` including `notebooklm` — see
  `../../schemas/examples/package-notebooklm-handoff.example.json`. It gets
  no special schema path and no special validator exemption.

## Other generators

Any worker that turns an approved artifact into a rendered file — a chart
renderer, a TTS engine, a deck builder — is a **replaceable worker**, in the
same sense `artifact.schema.json#/$defs/generator` already states for V1:
the Skill is the orchestration contract, the tool is swappable, and no field
in either the Package or the Artifact contract is specific to a vendor.

## Where an adapter failure routes

Using the routing vocabulary from V2-EDITORIAL-LEARNING-CORE.md section 5:
a defect in what an adapter does with a correct package is a **surface**
failure, not a **frame** or **verification** failure, and must not be
repaired by changing the Core's framing or claim-verification logic.

| Symptom | Layer | Not this layer |
|---|---|---|
| NotebookLM mis-renders a correct study bundle | `surface` (NotebookLM's own rendering) | `frame` — the package's thesis and claims were correct |
| An adapter silently drops `uncertainty` because its surface has no obvious place for a hedge | `surface` | `verification` — the claim was verified; the adapter chose to hide the caveat |
| A package is missing `thesis` for a `synthesize` transformation | `frame` / schema violation, caught before any adapter sees it | not a surface problem at all |
| A chart renderer produces a bad density for its target surface | `VISUAL` (renderer route), per section 5 | `surface` in the adapter sense above — the renderer is a Core-side worker, not an adapter |

The distinction that matters: **the adapter boundary is downstream of every
Core routing layer.** A package reaching an adapter has already passed
framing, verification, and Core-side rendering; anything wrong after that
point is the adapter's own concern and must be fixed in that adapter's
surface profile, not by reopening a Core layer that already did its job
correctly.

## What this document does not decide

- Adapter-specific rendering, layout, or API integration — that is each
  adapter's own concern, symmetric with `SUENGJ-COM-HANDOFF.md`'s existing
  "what is deliberately not decided here."
- New profile files under `editorial/profiles/surface/` for any surface
  named above — adding one is data, per the Extension rule, and is out of
  scope for this document.
- Anything about `editorial/profiles/transformation/**` — that is
  AES-V2.9's other half, owned separately; this document only names the
  transformation axis where it constrains adapter behavior.
