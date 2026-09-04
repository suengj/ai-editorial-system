# V2 — Editorial Learning Core

The operating model of the system. V1 defined **how one article gets made
well**. V2 defines **how the system decides what to make, for whom, on which
surface, in which medium — and how it gets better from what actually came
out**.

Nothing in V1 is retired. The Constitution, voice, content-type profiles,
source/article/artifact contracts, Skills, HITL protocol, quality gates,
lineage rules, and the L0 fixture corpus remain the authorities they were.
V2 adds the layers around them and moves `suengj.com`-specific assumptions
behind profiles.

Planning authority: Linear `AI Editorial System · Editorial Learning Core`,
milestone *V2 Editorial Learning Core* (AES-V2.1 … V2.11).

---

## 1. The loop

```text
Source / Reference
        ↓
Natural-language intake                    ← V2.1
        ↓
Editorial Intent  (five axes + overrides)  ← V2.2
        ↓
Frame / Plan                               ← V1 frame-article, plan-artifacts
        ↓
Generate                                   ← V1 write-article + V2.7 visual, V2.8 audio
        ↓
L0 / L1 / Human evaluation                 ← V1 fixtures + V2.6 real corpus
        ↓
Failure routing                            ← V2.5
        ↓
Targeted tuning                            ← V2.5
        ↓
Versioned calibration                      ← V2.10
```

The loop is the product. A rule that does not enter it at a named step is
decoration.

---

## 2. Source is not Reference

The single most load-bearing distinction in V2.

| | **Source** | **Reference** |
|---|---|---|
| Answers | *Is this true?* | *Is this good?* |
| Grants | factual authority | craft evidence only |
| Governed by | `schemas/source.schema.json`, `verify-claims` | `references/`, `evaluate-reference` |
| Failure if confused | fabricated fact presented as verified | imitation of a style with no claim behind it |

A reference may never establish a fact. A source may never dictate a
composition. An asset can be registered as both, but only under two separate
records with two separate roles — never one record doing double duty.

This distinction is enforced, not merely stated: `evaluate-reference` may not
emit claims, and `verify-claims` may not read reference evaluations.

---

## 3. Editorial Intent — five independent axes

V1 had one axis that mattered (content type) and one implied destination
(`suengj.com`). V2 makes the axes explicit and orthogonal.

```text
Transformation   what may change, what must survive        editorial/profiles/transformation/
Content type     evidence burden, register, structure      editorial/profiles/content/
Audience         who is on the other end                   editorial/profiles/audience/
Surface          where it lands and what that constrains   editorial/profiles/surface/
Artifact         which medium and which shape of it        editorial/profiles/artifact/
```

Plus **task-specific overrides**: a value the human set for this run only.

Axes do not collapse into each other. `summarize` is not a content type.
`suengj.com` is not an audience. `body infographic` is not a transformation.
A common failure this model prevents: treating "make it a thumbnail" as a
style request when it is an artifact-axis change that alters information
density, semantic load, and renderer route.

Examples the one contract must express:

```text
summarize   + note     + general professional + NotebookLM  + text
synthesize  + research + AI practitioner      + suengj.com  + text + body infographic
adapt       + view     + finance beginner     + YouTube     + dialogue audio
recreate    + news     + executive            + newsletter  + text + card visual
```

Machine contract: [`../../schemas/editorial-intent.schema.json`](../../schemas/editorial-intent.schema.json).
Prose contract: [`../../schemas/EDITORIAL-INTENT-CONTRACT.md`](../../schemas/EDITORIAL-INTENT-CONTRACT.md).

### Audience is shared across modalities

Audience is not a text concern with visual and audio afterthoughts. One
audience profile feeds all three:

| Audience trait | Text | Visual | Audio |
|---|---|---|---|
| Domain expertise | explanation depth, term glossing | label density, whether a legend is needed | assumed knowledge, aside frequency |
| Purpose / decision context | what the piece must resolve | which comparison earns the canvas | what gets repeated |
| Attention context | length, section granularity | glance-time budget | pace, segment length |
| Jargon tolerance | terminology discipline | acronym expansion in-frame | pronunciation plan |

An audience change that does not change any of these was not material and
should not have been asked about.

---

## 4. Natural language is the human interface

The human writes sentences. The agent writes JSON. This is not a convenience —
it is the reason the system is usable by ChatGPT, Claude, Codex-style agents
and future workers without any of them sharing a UI.

Every intent field resolves to exactly one state:

| State | Meaning | May inform durable calibration? |
|---|---|---|
| `confirmed` | the human said it, or an authoritative upstream contract did | **yes** |
| `assumed` | inferred for this run because it was safe to infer | **no** |
| `missing_material` | absent, and its absence would materially change the result | — must be resolved |

**The calibration firewall:** an `assumed` value can never become owner
preference. Only `confirmed` values, explicit feedback, or accepted evidence
may move calibration (V2.10). This is what keeps a system that guesses well
from silently becoming a system that has decided who you are.

Clarification is an exception path, not a greeting. Ask only when a
`missing_material` field would change thesis, audience fit, transformation
fidelity, artifact route, publication constraint, or cost — normally 1–3
questions, offered as choices with a default. "알아서 해" authorizes
`assumed` for the run and nothing beyond it.

---

## 5. Layers — the routing target vocabulary

When output is bad, the question is never "what rule should I add?" It is
"which layer produced this?" These are the only legal answers, and the same
list is the tuning target vocabulary in V2.5.

```text
SHARED
  intake            intent extracted wrongly
  reference         wrong references selected, or misread
  audience          fit misjudged
  frame             thesis / argument path / worth
  verification      factual support, freshness, provenance
  surface           publication or destination constraint
  calibration       the evaluator or the active calibration was wrong

TEXT              writing · polish · content-type register
VISUAL            artifact route · semantic spec · density · composition · brand profile · renderer
AUDIO             spoken script · dialogue structure · pronunciation · pacing · delivery · TTS render
```

A new modality adds a routing profile under the shared layers. It does not get
its own framework.

Three routing errors this vocabulary exists to prevent:

1. A **frame** failure repaired in **polish** — the article stays wrong and
   reads better.
2. A **renderer** defect promoted to a **brand profile** change — one bad
   render rewrites the house style.
3. A **reference-selection** failure promoted to a **content rule** — the
   system accumulates prose rules for a lookup bug.

---

## 6. Learning without overfitting

One disliked output is evidence. It is not a rule.

```text
failure evidence
  → root-cause layer
  → smallest justified change
  → rerun L0 fixtures + relevant real corpus
  → keep | revert | insufficient evidence
  → experiment ledger record
```

Durable calibration change requires **repeated independent evidence** or an
**explicit owner declaration**. Anything less is recorded as a task-local
override and expires with the task.

Four quality signals stay separate and are never averaged into one score:

```text
1. objective quality / integrity     ← dominates; may not be traded
2. audience fit
3. publication / surface fit
4. owner preference                  ← changes over time; versioned, never rewritten
```

Preference is temporal. Calibration is a **versioned snapshot with lineage**,
not the mean of all feedback ever recorded. Historical records are immutable
evidence. An agent may raise a `DRIFT_CANDIDATE`; only a human activates a new
calibration version.

---

## 7. Generic Core, replaceable edges

```text
P03 / Drive / GitHub / Web      ingestion — source availability
            ↓
AI Editorial System             transformation · audience · framing · quality · evaluation  (SSOT)
            ↓
suengj.com   NotebookLM   academic   newsletter   YouTube   …       adapters
```

`suengj.com` is the **default** publication profile, not the Core's identity.
It appears in `editorial/profiles/surface/` and `editorial/profiles/brand/`,
versioned, and nowhere in core logic. NotebookLM is an adapter and may never
become editorial authority or a runtime dependency.

**Extension rule.** Adding a transformation, content type, audience, surface,
artifact class, or brand profile adds **data** — a JSON file in the matching
axis directory. It does not modify the router, the evaluator, or any Skill.
When a genuinely new *semantic capability* is required (a new axis, a new
routing layer, a new evaluation modality), that is a core change and must be
argued as one, in this document.

---

## 8. Context and cost are budgeted

Loading everything is the default failure mode of a system that has learned a
lot. Context is disclosed progressively:

```text
intake / router
  → minimum core + the profiles this intent actually selects
  → current calibration snapshot (not its history)
  → 1–3 relevant reference evaluations (not the corpus)
  → task source context
  → generate / review
```

Compact evaluation records exist so that references can inform generation
without being pasted into it. A reference body is loaded only when its
evaluation is demonstrably insufficient for the task.

Cost ordering is fixed: **cheap semantic preflight before expensive
rendering.** Script L1 before TTS. Semantic spec and information-gain gate
before image generation. A bad visual or audio direction routes back to
planning; it does not become an unbounded reroll.

The tracked figure is **cost per accepted artifact**, not generation count.

---

## 9. Agent auto-application

The owner writes sentences and reads results. **The owner never translates a
request or a complaint into a repository file.** When an agent has write
access, it closes the loop itself — and the boundary of what it may close
without asking is the subject of this section.

Two automatic paths:

```text
natural-language request
  → resolve the Editorial Intent axes
  → load only the profiles that intent selects  (§8)
  → generate / review
  → hand back the result

natural-language feedback
  → classify: task-local correction or durable preference signal?
  → identify the target layer                    (§5)
  → persist the record where persistence is warranted
  → update versioned calibration only when durable change is authorized
  → validate
  → commit the smallest justified change
```

No step in either path requires the owner to name a JSON file, a schema, a
Skill, or a routing target. An agent that answers "which layer should I route
this to?" by asking the owner has failed — classification is the system's job,
not the reader's.

### The change-scope ladder

"Smallest justified change" is not a sentiment; it is an ordered ladder, and an
agent takes the lowest rung that actually fixes the problem.

| Rung | Change | Repository effect | Authorization |
|---|---|---|---|
| 0 | task-local override | **none** — it lives in the intent record and expires with the task | automatic |
| 1 | feedback record | append one record, rebuild the index | automatic |
| 2 | reference evaluation | append one record, rebuild the index | automatic when asked or clearly appropriate |
| 3 | profile field | one field, in one profile, citing the evidence records | automatic only with repeated independent evidence; otherwise ask |
| 4 | calibration version | new version file with supersedes lineage | **explicit human instruction only** |
| 5 | constitution, gates, precedence | — | **never automatic**; owner decision, argued separately |

Rung 0 is the default and by far the most common. Most corrections are about
*this* piece; treating them as anything more is the overfitting failure §6
already names.

### What is automatic and what is not

**Automatic, no question asked:** generating when the intent is sufficient
(§4); revising locally when the correction is local; persisting a feedback or
reference record the owner asked for or plainly implied; rebuilding a derived
index; running validation.

**Requires explicit human instruction:** any durable preference change — a new
calibration version, or a profile edit that will shape every future run.
"이번 글만" and "앞으로" are different instructions and must be resolved as
different rungs. When the utterance is materially ambiguous between them, that
is exactly the clarification the gate in §4 exists for: ask one question,
offer the two readings, default to task-local.

**Never automatic, at any authorization level:** publication, approval,
finalization, or merging to a default branch. Constitution §10 is not a rung on
this ladder — it is off it entirely.

### Commit discipline

An automatic commit is small, single-purpose, and legible six months later:
one rung of the ladder, the evidence that motivated it, and validation output.
An agent that cannot state which rung it is on, and why the rung below was
insufficient, does not commit — it reports and asks.

## 10. What V2 must not become

Stop conditions. Any of these means the architecture is wrong, not that a
document is missing.

1. Two schemas that mean the same thing.
2. A global rule created from a single complaint.
3. `suengj.com` detail back inside the Generic Core.
4. Text, image, and audio merged into one vague generator contract.
5. The whole reference or feedback history loaded per request.
6. Agent-inferred preference overwriting human calibration.
7. A database, vector store, or agent framework introduced for convenience.
8. A vendor — NotebookLM or otherwise — holding editorial authority.
9. A document with no executable contract behind it.

---

## 11. Issue map

| Issue | Adds | Primary paths |
|---|---|---|
| AES-V2.1 (SUE-559) | natural-language intake, clarification gate | `skills/intake-request/`, `schemas/editorial-intent.schema.json` |
| AES-V2.2 (SUE-560) | five-axis intent, profile axis architecture | `editorial/profiles/*/`, `scripts/lib/profile-core.mjs` |
| AES-V2.3 (SUE-561) | reference + feedback registry | `references/`, `feedback/` |
| AES-V2.4 (SUE-562) | modality-aware reference evaluation and selection | `skills/evaluate-reference/`, `editorial/profiles/reference/` |
| AES-V2.5 (SUE-563) | failure routing and targeted tuning policy | `editorial/FEEDBACK-ROUTING.md` |
| AES-V2.6 (SUE-564) | real-output corpus, comparative L1 reviewer | `evals/corpus/`, `skills/review-l1/` |
| AES-V2.7 (SUE-565) | visual artifact profiles, brand tokens, prompt compilation | `editorial/profiles/artifact/`, `editorial/profiles/brand/` |
| AES-V2.8 (SUE-566) | audience-aware spoken artifacts | `editorial/profiles/artifact/audio-*`, `skills/compile-audio-script/` |
| AES-V2.9 (SUE-567) | transformation profiles, Editorial Package | `editorial/profiles/transformation/`, `schemas/editorial-package.schema.json` |
| AES-V2.10 (SUE-568) | calibration versioning, drift, ledger, budgets | `calibration/` |
| AES-V2.11 (SUE-569) | V2 certification, public project refresh | `docs/architecture/V2-CERTIFICATION.md` |

Certification closes the Core. **Adoption is proved separately**, in the
milestone *Post-V2 Pilot & Owner Adoption*, which runs strictly after V2.11:

| Issue | Adds | Primary paths |
|---|---|---|
| AES-V2.12 (SUE-570) | real multi-audience text + visual pilot on canonical `suengj.com` articles, delivered as a non-published review branch | `suengj-com` review branch; evidence + feedback records here |
| AES-V2.13 (SUE-571) | owner playbook for natural-language operation, written from pilot evidence | owner/operator documentation |

The pilot is the honest test of §12: two canonical articles, each transformed
into News / Report / child-oriented drafts from the *same* verified knowledge,
each with a visual its audience actually needed. It answers questions the Core
cannot answer about itself — whether one source really stops forcing one output
structure, whether audience reaches the visual information geometry and not just
the prose, and whether the `suengj.com` brand profile flattens three audiences
into one picture.

Two constraints on V2 design follow from it and are binding now, not later:

1. **A child audience is a named profile, not a softened adult one.** Ages
   10–12 change vocabulary ceiling, concrete-versus-abstract reasoning, example
   choice, and attention span — and lowering the assumed knowledge level may
   never lower factual accuracy or drop stated uncertainty.
2. **Draft is not published.** Pilot output reaches `suengj-com` as a review
   branch under the existing fail-closed draft contract, never as a merge and
   never as publication. Constitution §10 and the SSOT boundary hold without
   amendment.

Audio is explicitly deferred from the pilot and must be described as deferred —
not as working — wherever V2 capability is summarised.

## 12. The ten questions

V2 is not complete while any answer is materially *no*.

1. Can a person operate this with natural language alone?
2. Are Source and Reference separated in contract, not just in prose?
3. Does Audience actually change text, image, and audio output?
4. Can a new content type / transformation / surface be added without a core rewrite?
5. When output is bad, is the layer to repair identifiable?
6. Do references and feedback improve results without unbounded growth in context or rules?
7. Are the known `suengj.com` visual failures blocked by the new control path?
8. Is preference change handled as versioned calibration?
9. Are P03 → Editorial → suengj.com / NotebookLM connected by contracts rather than coupling?
10. Is this an Editorial Learning Core rather than a larger prompt collection?
