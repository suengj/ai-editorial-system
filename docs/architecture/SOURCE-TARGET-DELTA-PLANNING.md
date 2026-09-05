# Source→Target delta planning (AES-V2.18 / SUE-610)

**Language-agnostic, and upstream of language.** This gate decides how much
may change before anything is rewritten. It governs Transformation, Audience,
and Genre exactly as much as it governs language polish, which is why it is
its own document rather than a section of
[`LANGUAGE-QUALITY-ARCHITECTURE.md`](LANGUAGE-QUALITY-ARCHITECTURE.md). That
document defines what language quality is and how a polish edit is proved or
reverted. This one defines how large an edit is allowed to be in the first
place, on every axis, before any polish or recomposition step runs. Read
together: this gate answers *how much may change*; the language architecture
answers *what is wrong* once the gate has fixed the ceiling. See its §15
("Deference to the delta gate") for the point made from the other side.

---

## 1. Why label-driven rewriting is the failure

SUE-604 ran a broad rule-driven rewrite and the owner rejected it. The
mechanism was simple and is worth stating without softening: the system
inferred how much to change from the **target label** — "make it a Report,"
"make it for a child" — without first reading what the incumbent source
already was. A label names a destination. It says nothing about distance,
because distance depends on where the draft already stood, and that can only
be read from the actual text.

`bonds-news` is the concrete case
(`evals/dogfood/2026-09-05-sue604-recalibration/EVALUATION.md` §2.4). The
BEFORE draft was, in the bonds writer's own words, a piece that "wasn't badly
broken to begin with." Nothing about it required intervention. The AFTER
draft is worse on two dimensions: `audience_fit` fails because
`nq-subject-topic-omission` deleted the sentence's one plain-language
handhold — *who* was doing the worrying — and `native_fluency` fails because
an idiomatic construction was replaced by a stiffer agentless one. Neither
change repaired a defect. Both changes were licensed because a rule existed
and was applicable, and the system had no gate asking whether an edit was
*needed* before asking whether a rule *could* fire.

State the principle plainly: **quality dimensions are not rewrite magnitude.**
A dimension existing (native fluency, audience fit, register) tells you what
could be checked. It does not tell you how much of the text should change,
and treating "a rule is available" as "an edit is due" is exactly the failure
this gate exists to close off.

---

## 2. SourceProfile and TargetProfile

Both are profiled on the same seven axes, in fixed order under fixed ids.
The machine surface that enforces the set and its completeness is
`schemas/delta-plan.schema.json`:

```text
language_quality
genre
audience
knowledge_depth
register
information_structure
terminology
```

**SourceProfile** describes what the incumbent text actually is, on each
axis, read from the text itself — not inferred from its metadata, its
provenance, or the request that originally produced it. If nobody reads the
draft, there is no SourceProfile; there is only a guess wearing its name.

**TargetProfile** describes what the request asks for, on the same seven
axes, derived from Editorial Intent
([`V2-EDITORIAL-LEARNING-CORE.md`](V2-EDITORIAL-LEARNING-CORE.md) §3) and any
task override in effect.

What a profile is **not**: it is not a score, on any axis or in aggregate. It
is not a summary of the text — a profile does not paraphrase the draft, it
characterizes it along seven fixed axes. And it is not the label restated.
"Report" is a genre value, not a profile. A profile for a Report still has to
say what depth of mechanism this particular Report draft carries, what
register it is actually written in, and what its information hierarchy
currently looks like — because two drafts labelled Report can sit at entirely
different points on every one of those axes.

---

## 3. Per-axis delta assessment

Each axis gets exactly one of four states:

```text
LOW | MATERIAL | LARGE | UNKNOWN
```

**There is no aggregate.** No total, no average, no weighted distance, no
overall number computed by arithmetic across the seven axes. This is not an
oversight to be patched later; it is the same argument
[`LANGUAGE-QUALITY-ARCHITECTURE.md`](LANGUAGE-QUALITY-ARCHITECTURE.md) §1
makes about collapsing seven quality dimensions into one score, applied here
to distance instead of to quality. A single `distance: 0.6` is unusable for
the same reason a single `prose quality: 6/10` was unusable: it cannot say
which axis moved, so it cannot say what to do. A draft that is LOW on every
axis but LARGE on `audience` and one that is MATERIAL across the board might
average to the same number and need completely different interventions. The
average destroys exactly the information the gate exists to produce.

What the record carries instead is `plan_intervention`: the **ceiling**, the
highest intervention level appearing on any single axis. It is a routing
value, not a score. It says "at least one axis needs this much authority
engaged," and nothing more — it does not rank drafts against each other, and
it is never compared numerically across records. Field names matching
`/(score|total|average|weight|distance|rating)/` are forbidden anywhere in
the delta or polish record schemas for exactly this reason: the shape of the
field is how the discipline gets enforced when the discipline of writing
prose about it eventually erodes.

---

## 4. The four intervention levels

| Level | Authorizes | Owner |
|---|---|---|
| `P0_PRESERVE` | Nothing. The source already satisfies the target on this axis. | Nobody edits. |
| `P1_LOCAL_POLISH` | A bounded local language defect, addressed in place. | Language Polish. |
| `P2_CONTROLLED_ADAPT` | Depth, register, terminology, or audience work in selected paragraphs — not a rewrite of the whole draft. | The relevant upstream axis owner (Audience, Genre, Domain terminology as applicable) — never Language Polish. |
| `P3_RECOMPOSE` | Composing a new target draft, because the audience, knowledge, or structural gap is large enough that local adaptation cannot close it. | Transformation / Audience / Genre / Frame. |

These describe **intervention scope**, not quality. `P3` is not "worse" than
`P0`; it is the honest answer when the source and target are genuinely far
apart, and reaching for it correctly is a success, not a downgrade. The
failure mode this table exists to prevent is the opposite one — reaching for
`P2` or `P3` work by default because the target label sounds ambitious,
instead of because an axis actually measured that far apart.

---

## 5. The guards

The guards are mechanical — enforced in `scripts/lib/delta-core.mjs`, not
left to a reviewer's discretion — but each one
closes a specific failure this gate has already seen or can foresee.

**G1 — upstream axes cannot be discharged as polish.** An axis with delta
`MATERIAL` or `LARGE` on `audience`, `knowledge_depth`,
`information_structure`, or `genre` may not be assigned `P1_LOCAL_POLISH`.
This is the direct fix for the child-audience failure this architecture
already names elsewhere
([`LANGUAGE-QUALITY-ARCHITECTURE.md`](LANGUAGE-QUALITY-ARCHITECTURE.md) L3):
audience and structural work is Audience/Transformation/Genre work, and a
polish pass that quietly absorbs it produces a draft that reads fine
sentence-by-sentence while still being aimed at the wrong reader. If those
axes measure far apart, the ceiling must route there, not to polish.

**G2 — pervasive translationese is not a polish-scale defect.** A
`language_quality` delta of `LARGE` cannot be `P1` alone. If the prose is
translationese throughout rather than locally, the defect sits at the
translation/adaptation stage, not in a handful of local sentence fixes — this
is the "Translation boundary" SUE-610 names. Local polish patches symptoms;
it does not repair a text that was never adapted for the target language in
the first place.

**G3 — a small gap cannot justify a large intervention.** A `LOW` delta must
resolve to `P0_PRESERVE` or `P1_LOCAL_POLISH`; it may never justify `P3`. This
is the direct fix for `bonds-news`. Nothing about that draft measured LARGE on
any axis — it was already close to the target. `P3_RECOMPOSE` was never on
the table for it, and if this guard had existed, the rewrite that followed
could not have been authorized under it.

**G4 — not knowing is not evidence of distance.** An `UNKNOWN` delta **MUST**
be `P0_PRESERVE`; no other intervention is legal on it — not `P1`, not `P2`,
not `P3`. Unknown is a reason to look, not a licence to intervene. The
guard originally closed only the `P2`/`P3` direction, leaving `P1` open: a
record could declare every axis `UNKNOWN` and route the whole draft to
Language Polish, and it validated clean. Treating "we didn't check" as "it's
probably far apart" (or "it's probably a bounded local fix") is how caution
gets inverted into overreach either way; the record has to say what would
resolve the unknown, not paper over it with an intervention — you may not
edit on an axis you did not assess.

**G5 — every non-trivial axis names who owns it.** Every axis assigned `P2`
or `P3` must name a non-null `owning_layer`, and that layer may not be a
polish-owned one (`normative`, `native_fluency`, `domain_terminology`). If
Language Polish shows up as the owner of a `P2`/`P3` axis, the routing has
already failed — that is precisely the overreach G1 exists to prevent, caught
a second way at the ownership field instead of the level field.

**G6 — the axis record has to be about the actual text.** Both
`source_observation` and `target_requirement` must be non-empty observations
of the real source and the real request — never a restatement of the target
label. "Target is a Report, so genre delta is LARGE" is not an observation;
it is the label-driven inference this whole gate was built to stop. The
observation has to name what the source's information hierarchy currently
does and what the Report target actually requires of it.

---

## 6. Worked heuristics — heuristics, not routes

These two examples are illustrations of how the axes can turn out for a given
label pair. They are not rules that fire on the label. The same pair of
target labels can produce different deltas depending on what the actual
source is, and that variability is the entire point of profiling the source
instead of trusting the label.

**Readable News → professional Report.** Suppose the News draft is already
well-written: clear, accurate, well-ordered for a general reader. Moving it to
Report might measure `register` at LOW–MATERIAL (both are legitimate written
registers; the gap is closer than it looks), `knowledge_depth` at
MATERIAL–LARGE (a Report is expected to carry mechanism and evidence a News
piece leaves implicit), and `information_structure` at MATERIAL (a Report's
hierarchy foregrounds evidence and caveats that a News lead does not). The
correct response is not to rewrite the prose — it is already good prose for
its register — but to expand evidence and mechanism *upstream*, in
Frame/Transformation, and let the existing sentences carry more of that
weight rather than replacing them with new ones. The subsequent polish pass
should find comparatively little to do.

**Professional Report → age 10–12.** Here `audience`, `knowledge_depth`,
`register`, and `terminology` are all plausibly `LARGE` at once — a
practitioner-pitched report and a ten-year-old reader are far apart on every
axis that matters. This is a legitimate `P3_RECOMPOSE`: Audience/Transformation
should genuinely recompose the piece, not adapt it in place. Once that
recomposition has been done well, the language-polish pass that follows
should be close to a no-op — the audience work is already done, and a polish
layer that re-runs it because child-register traits exist in the language
pack is duplicating work a higher-authority layer already discharged
correctly. See
[`LANGUAGE-QUALITY-ARCHITECTURE.md`](LANGUAGE-QUALITY-ARCHITECTURE.md)'s new
"Deference to the delta gate" section for the polish side of this same case.

The pair of labels is identical in both scenarios' second half — Report to a
target audience — and yet the deltas and interventions differ entirely from
what a label-driven system would assume, because they were read from the
actual draft each time rather than inferred from the destination name.

---

## 7. Preservation-first: burden of proof

The better the incumbent source already satisfies the target on an axis, the
higher the burden for changing anything on that axis. A sentence that already
reads well is an asset the draft owns, not raw material waiting to be
processed by whichever rules happen to apply to it.

This is the inverse of what SUE-604 did. A rule being applicable to a span of
text is not evidence that editing that span produces a better draft — it is
evidence that the rule *could* fire, which is a fact about the rule's
matching conditions, not about the draft's quality. `P0_PRESERVE` is not the
absence of a decision. It is the correct decision whenever the axis is
already `LOW`, and choosing it requires the same rigor as choosing to
intervene: an axis record explaining why the source already satisfies the
target, not silence.

---

## 8. Where the gate sits in the pipeline

```text
actual source / incumbent draft
        ↓
   SourceProfile            ← read from the text, seven axes
        ↓
   TargetProfile             ← derived from the request, same seven axes
        ↓
   per-axis delta            ← LOW | MATERIAL | LARGE | UNKNOWN, no aggregate
        ↓
   smallest justified
   intervention              ← P0 | P1 | P2 | P3, per axis, guards G1–G6
        ↓
   target draft               ← produced at the level each axis actually earned
        ↓
   conservative polish        ← KEEP | LOCAL_POLISH | UPSTREAM_REPLAN_REQUIRED
        ↓
   pairwise gate               ← eleven criteria, ORIGINAL is the incumbent
        ↓
   KEEP / ACCEPT / REPLAN
```

The delta gate runs once, upstream of generation and polish both. It decides
scope; it does not itself write anything. Everything below it — Transformation
composing a `P3` target, Language Polish running a bounded `P1` pass, the
pairwise gate accepting or reverting an edit — operates inside the ceiling
this gate already set, and none of those steps re-litigates the ceiling.

---

## 9. What this must not become

- **A scoring system.** No number describes distance, no matter how
  convenient a single figure would be for comparing drafts. Section 3 of this
  document exists to make that failure impossible to reintroduce quietly.
- **A licence to recompose because a label changed.** The label is an input
  to the TargetProfile, not a shortcut around reading the source. `P3` is
  earned per-axis, from an observation of the actual draft; it is never
  assigned because the destination name sounds like it should require a
  rewrite.
- **A second planner competing with Editorial Intent.** This gate does not
  decide *what* the target is — that is Editorial Intent's five axes
  ([`V2-EDITORIAL-LEARNING-CORE.md`](V2-EDITORIAL-LEARNING-CORE.md) §3). It
  decides how far the current draft is from a target Editorial Intent has
  already set, and how much of that distance any given layer is authorized
  to close. Collapsing the two would produce exactly the kind of parallel
  quality system
  [`LANGUAGE-QUALITY-ARCHITECTURE.md`](LANGUAGE-QUALITY-ARCHITECTURE.md) §17
  already forbids on the language side.

The machine-readable shape of a delta record lives in
`schemas/delta-plan.schema.json`, owned separately from this document. This
document describes what the gate means and why each guard exists; it does not
specify field names.
