# Semantic article grammar (AES-P1.6 / SUE-464)

The layer between how an article is *written* and how `suengj.com` *renders*
it. It lets an article use richer structure — callouts, comparisons,
procedures, evidence blocks — without a single line of HTML or CSS crossing
the repository boundary.

Machine contract:
[`../schemas/presentation-plan.schema.json`](../schemas/presentation-plan.schema.json).
Role matrix: the `semantic_roles` block in each [profile](profiles/).
Enforcement: `npm run validate:presentation`.

## The authority split

```text
Editorial Constitution / Voice
        ↓
Content-Type Profile
        ↓
Semantic Article Grammar          ← this document
        ↓
Canonical Markdown + presentation plan
        ↓
suengj.com renderer / design tokens   ← SUE-459 / SUE-460
```

| Decided here | Decided in `suengj-com` |
|---|---|
| What an information block **means** | What that role **looks like** |
| Why it deserves separation | Colour, spacing, border, typography |
| What information it carries | Component implementation, responsive behaviour, accessibility affordances |

Writer output contains no HTML, no CSS, no hex colours, no inline styles, no
Astro or React component names, and no page-specific layout instruction.

This is not a convention. **The schema cannot express any of them** — there is
no colour field, no style field, no component field — and the validator
rejects them if they appear inside a block's text.

## V0.1 vocabulary

Ten roles, deliberately small:

| Role | For |
|---|---|
| `key_point` | A central takeaway or decision-critical statement |
| `evidence` | Source-backed support that benefits from explicit separation |
| `caution` | A limitation, uncertainty, caveat, or failure condition |
| `comparison` | A structured comparison where prose is inferior |
| `procedure` | Ordered operational steps |
| `example` | A concrete worked case |
| `code_example` | Executable or illustrative code |
| `data_table` | Genuinely tabular quantitative or categorical relationships |
| `timeline` | Chronological relationships |
| `visual_ref` | A chart or diagram produced under the evidence-media contract |

**No two roles differ only by decoration.** If a proposed role would render
differently but mean the same thing, it is not a role — it is a colour, and
colours are not ours to choose.

Every block declares `why` it deserves separation. A block that cannot answer
that question is decoration, and the schema requires the answer.

## Portability: the fallback is not optional

Every block carries a plain-Markdown `fallback` containing the **same
information**. Strip all presentation and nothing is lost — no fact, no
figure, no citation, no link, no qualification.

This is enforced by comparing protected spans between `content` and
`fallback`: numbers, dates, citation markers, URLs, and quotations present in
one must be present in the other. It reuses the polish-invariant machinery,
because it is the same guarantee applied to a different transformation.

A caution block whose fallback quietly drops the qualification is the failure
this rule exists to prevent.

## Role fit by content type

Each profile declares `recommended` / `allowed` / `usually_avoid`. Guidance,
not a template — an `usually_avoid` role produces a flag, not a rejection.

| Role | Research | View | News | Note | Project |
|---|---|---|---|---|---|
| `key_point` | allowed | **recommended** | **recommended** | allowed | allowed |
| `evidence` | **recommended** | allowed | **recommended** | — | allowed |
| `caution` | **recommended** | **recommended** | allowed | — | allowed |
| `comparison` | **recommended** | allowed | allowed | avoid | **recommended** |
| `procedure` | avoid | avoid | avoid | — | **recommended** |
| `code_example` | avoid | avoid | avoid | allowed | **recommended** |
| `data_table` | **recommended** | avoid | allowed | avoid | — |
| `timeline` | **recommended** | avoid | **recommended** | avoid | avoid |
| `visual_ref` | allowed | — | allowed | avoid | allowed |

Two entries worth explaining:

- **View avoids most blocks.** A judgment argued in prose reads as a judgment.
  The same judgment in a callout reads as a claim of authority it has not
  earned.
- **Note has no recommended roles at all.** A note that needs three callouts
  is a research piece, and the profile's 800-word cap already says so.

**No rule requires any article to use a block.** Plain prose is the default
and always sufficient.

## What is rejected

| Anti-pattern | Why |
|---|---|
| Callout spam | Blocks exceeding half the article. When most of a piece is separated, nothing is |
| Decorative colour semantics | "See the red box" — meaning may never depend on colour alone |
| Raw HTML or CSS | Crosses the authority boundary |
| Renderer component names | `<Callout>`, `<Aside>` — binds the editorial system to one frontend |
| Layout tables | A table is for real two-dimensional relationships, not for arranging things side by side |
| Heading level chosen for size | Heading rank is semantic. Wanting bigger text is not a reason to promote a heading |
| Emphasis manufacturing importance | A `key_point` the thesis does not support is an assertion of significance the evidence has not earned |

The first four are rejected mechanically. The last three are editorial
judgement and belong to HITL review — stated here so the reviewer knows to
look.

## Integrity rules

- Evidence blocks name the claims they rest on; `visual_ref` names its
  artifact. Both enforced.
- Evidence visuals keep their provenance and verification requirements from
  the media strategy — a block referring to one does not launder it.
- Semantic block selection is reviewable and **removable without factual
  drift**. That is exactly what the fallback guarantee buys.

## Handoff to `suengj-com`

Deferred to SUE-459 by design. The presentation plan is a sidecar in V0.1:
canonical Markdown stays exactly as it is today, and current production
content remains valid.

What SUE-459 receives: a stable role vocabulary, a `why` per block, a lossless
fallback, and no visual instruction to reconcile. What SUE-460 owns: the
mapping from role to component, the design tokens, and accessibility.

The contract can support a structured reading experience of the kind the
Denoiser benchmark describes (`ref:denoiser-consumption-architecture`) without
importing any of its visual identity — because it carries no visual identity
at all.
