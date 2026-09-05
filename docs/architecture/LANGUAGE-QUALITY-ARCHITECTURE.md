# Language quality architecture (AES-V2.17 / SUE-607)

**Language-agnostic.** Nothing in this document is a Korean rule. It defines
what the layers of language quality are, which authorities may change each
one, how they compose, what may become durable, and how a proposed change is
proved or reverted. The rules themselves live in a **language pack**
(`editorial/profiles/language/`), which this document never inspects.

Korean (`ko-KR`) is the first and currently the only pack. That is a fact
about what has been built, not a property of the architecture.

---

## 1. Why one score is wrong

SUE-570 produced a result the system could not express:

```text
the Korean was grammatically correct
the News / Report / Child tone separation worked
and the prose still did not read like professionally edited Korean
```

A single `prose quality` verdict has to round that to something. Rounded up,
the defect disappears. Rounded down, the tone differentiation that *did* work
is discarded along with it. Either way the next action is unknowable: nobody
can tell from one number whether to fix the orthography, the sentence
construction, the newsroom form, the reading level, the terminology, or
nothing at all because the owner simply prefers something else.

So the model here is **dimensional, and deliberately refuses to total**.
There is no weighted sum, no overall grade, and no tie-break that collapses
the dimensions back into one. A review that reports

```text
normative_correctness   PASS
native_fluency          FAIL
genre_fit               PASS
audience_fit            PASS
owner_voice_fit         UNKNOWN
```

is a complete result, not an incomplete one.

---

## 2. Eight authority classes

Every durable language statement in a pack carries exactly one class. The
class answers a single question: *what kind of thing would have to change for
this statement to stop being true?*

| Class | What it is | What would change it |
|---|---|---|
| `INTEGRITY` | Meaning, claim status, uncertainty must survive the language pass | Nothing. Not negotiable at this layer |
| `NORMATIVE` | Codified correctness in the language — orthography, spacing, punctuation, standard usage, transliteration | The issuing standards body |
| `NATIVE_QUALITY` | What a fluent writer in the language would actually produce, independent of correctness | Cross-source empirical evidence, holdout-validated |
| `GENRE_CONVENTION` | Form expected of news / report / academic / note / promotional writing | Cross-source evidence *within that genre* |
| `AUDIENCE_CONSTRAINT` | Reading level, background knowledge, terminology tolerance, information density | Evidence about readers, or an authority on literacy/age banding |
| `DOMAIN_TERMINOLOGY` | Canonical term, its accepted rendering, and its audience-facing explanation | A terminology authority in that domain |
| `OWNER_PREFERENCE` | The owner likes or dislikes something otherwise valid | The owner, explicitly, through versioned calibration |
| `TASK_OVERRIDE` | One request, one time | Nothing — it expires with the task |

### Precedence

Higher class wins where they genuinely conflict:

```text
INTEGRITY
  > NORMATIVE
    > AUDIENCE_CONSTRAINT
      > DOMAIN_TERMINOLOGY
        > NATIVE_QUALITY
          > GENRE_CONVENTION
            > OWNER_PREFERENCE
              > TASK_OVERRIDE          (composes; never overrides above it)
```

Three consequences worth stating plainly, because each has been got wrong
before:

- **Owner preference cannot make incorrect language correct.** It sits below
  `NORMATIVE`, and far below `INTEGRITY`. "The owner likes it" is not a
  defence of a misspelling or of a claim that changed meaning.
- **`AUDIENCE_CONSTRAINT` outranks `DOMAIN_TERMINOLOGY`** on the *surface
  word*, and never on the *concept*. A ten-year-old may be given a plain-word
  explanation; the canonical term it maps to does not change, and the mapping
  is recorded. Simplifying the wording may never simplify the referent.
- **`TASK_OVERRIDE` composes downward only.** "이번 글만 짧게" may displace a
  genre default or an owner preference for one task. It may not displace
  normative correctness, and it may never be read as a durable preference
  signal — see the calibration firewall in
  [`V2-EDITORIAL-LEARNING-CORE.md`](V2-EDITORIAL-LEARNING-CORE.md) §4.

Most of the time these do not conflict at all. Precedence is a tie-break, not
a pipeline.

---

## 3. Genre and audience are orthogonal

They are two axes, not two values on one axis. The repository already
enforces this and predates this document: genre is the **content axis**
(`editorial/profiles/content/`), audience is the **audience axis**
(`editorial/profiles/audience/`), and Editorial Intent resolves them
independently (`schemas/editorial-intent.schema.json`).

The grid is real, and most cells are legitimate:

```text
                 general   practitioner   executive   age 10-12
   news             ok          ok           ok          ok
   research         ok          ok           ok          ok
   view             ok          ok           ok          ok
   note             ok          ok           ok          ok
```

The failure this prevents has a name: **`child` is not a genre.** A child
audience is an audience constraint that composes with news, report, or
explainer form. Encoding it as a genre produces one fixed "children's
writing" voice that ignores what the piece actually is, and it makes
"news for a 10-year-old" inexpressible.

The same holds in the other direction. A newsroom lead convention is a genre
convention; it does not become general language quality because news happens
to be the genre most often sampled.

---

## 4. Where each layer already lives

This architecture is mostly a **classification of things that already
exist**. It does not create a parallel quality system.

| Dimension | Authority class | Where it lives today |
|---|---|---|
| `semantic_integrity` | `INTEGRITY` | `editorial/constitution.md` §1–3, §6, §8; `verify-claims`; polish invariants |
| `normative_correctness` | `NORMATIVE` | **new** — language pack, per locale |
| `native_fluency` | `NATIVE_QUALITY` | `editorial/voice.md` §5, §12 (translationese, synthetic rhythm) + language pack |
| `genre_fit` | `GENRE_CONVENTION` | `editorial/profiles/content/*.json` + language pack genre overlay |
| `audience_fit` | `AUDIENCE_CONSTRAINT` | `editorial/profiles/audience/*.json` + language pack literacy overlay |
| `domain_terminology_fit` | `DOMAIN_TERMINOLOGY` | **new** — language pack terminology overlay; `editorial/voice.md` §1 states the principle |
| `owner_voice_fit` | `OWNER_PREFERENCE` | `editorial/voice.md` invariants/preferences; versioned calibration |

Two of these are genuinely new (`normative_correctness`,
`domain_terminology_fit`). The rest are existing authorities being *named* so
a failure can be routed to exactly one of them.

`editorial/voice.md` keeps a mixed role and that is correct: it holds both
`NATIVE_QUALITY` observations and `OWNER_PREFERENCE`. It already marks the
difference itself — *invariant* vs *preference* vs *observed tendency*. The
language pack does not absorb it and does not restate it.

---

## 5. Smallest-layer routing

One failure changes one layer. This is the existing V2.5 routing discipline
(`editorial/feedback-routing.json`,
[`V2-EDITORIAL-LEARNING-CORE.md`](V2-EDITORIAL-LEARNING-CORE.md) §5) extended
with the language dimensions.

```text
misspelling, spacing, punctuation, wrong standard form
        → normative

grammatical but not what a fluent writer would write
        → native_fluency

fluent, but not the form this genre uses
        → register            (genre convention; the existing text layer)

fluent and correctly formed, but too hard or too easy for this reader
        → audience            (existing shared layer)

wrong technical term, or a term simplified into a different concept
        → domain_terminology

valid on every dimension above, and the owner dislikes it
        → owner_voice

"just this once"
        → task override — no layer changes, nothing is recorded as preference
```

The discipline is the point: **do not change several layers because one
output was bad.** If a draft is both misspelled and unidiomatic, those are
two findings against two layers, not one general "improve the Korean" edit.
And a failure that cannot be assigned to exactly one layer is not yet
understood well enough to fix.

---

## 6. Empirical layers earn their rules; normative layers do not

The two kinds of authority are proved in completely different ways, and
confusing them is the central failure mode this architecture exists to
prevent.

**`NORMATIVE` comes from a standards body.** It is not voted into existence
by a corpus. A construction that appears in every newspaper in the country is
still not thereby correct, and a correct construction that appears in none of
them is still correct. Corpus examples may *illustrate* a normative rule.
They may never *establish* one.

**`NATIVE_QUALITY`, `GENRE_CONVENTION`, and `AUDIENCE_CONSTRAINT` are
empirical**, and therefore have to clear a bar:

1. **Multi-source.** A trait observed in one publisher or institution is a
   local trait of that publisher. It is recorded as such and stays scoped
   there. Promotion to a reusable baseline requires independent sources —
   the same repeated-evidence rule V2 already applies to every other
   promotion (`scripts/lib/promotion-core.mjs`).
2. **Holdout-validated.** See §7.
3. **Cross-genre checked.** A trait discovered in one genre stays in that
   genre's overlay unless there is evidence for it in others. Promotion into
   the shared native-quality layer is a separate decision with its own
   evidence, never a side effect of having found the trait.
4. **Not an imitation objective.** Trait extraction records *how the language
   behaves* — collocation, clause construction, connective logic, information
   pacing. It never instructs a Writer to sound like a named outlet or to
   reuse recognizable wording. Traits carry `adopt` / `avoid` / `do_not_copy`,
   and `do_not_copy` is a real verdict with real consequences, not a
   disclaimer.

This is the existing **Source ≠ Reference** boundary
([`V2-EDITORIAL-LEARNING-CORE.md`](V2-EDITORIAL-LEARNING-CORE.md) §2) applied
to language: a reference grants craft evidence and nothing else. It cannot
make a claim true, and it cannot make a construction correct.

---

## 7. Discovery and holdout

Empirical calibration derived from a corpus and validated on the same corpus
proves only that the extraction worked.

```text
discovery / calibration set     traits are derived from these
holdout / validation set        traits are tested against these
                                — never used for derivation
```

Reference records carry which set they belong to (`corpus_role`), and the
assignment is made **before** trait extraction begins, not chosen afterwards
to suit a result. A reference that has informed a trait can never be moved
into the holdout set.

**Topic holdout is separate and also required.** Validating only on the
topics the system already failed on measures lexical adaptation to those
topics. At least one generation on an **unseen topic** is required before a
language calibration is proposed for activation.

A calibration that improves scores on the discovery set and not on the
holdout set has not improved the language. It has fit the corpus, and it is
rejected.

---

## 8. Evaluation contract

L1 and human review report **per dimension**:

```text
semantic_integrity
normative_correctness
native_fluency
genre_fit
audience_fit
domain_terminology_fit
owner_voice_fit
```

Rules:

- **No total.** Nothing sums or averages these. A consumer that wants one
  number is asking the wrong question.
- **`UNKNOWN` is first-class.** `owner_voice_fit` is `UNKNOWN` until a human
  says otherwise. Silence is not acceptance — the existing rule
  ([`V2-EDITORIAL-LEARNING-CORE.md`](V2-EDITORIAL-LEARNING-CORE.md) §11)
  applies here unchanged.
- **Integrity dominates.** A `native_fluency` win never offsets a
  `semantic_integrity` failure. The dimensions do not trade.
- **Every verdict carries evidence.** A dimension verdict with no observable
  span is not a verdict. This is the existing L1 contract
  (`schemas/l1-review.schema.json`), not a new rule.

Dimension-level results are what make §5 routing possible at all: the review
output *is* the routing input.

The seven dimensions answer **what is wrong**. They do not, on their own,
answer **how much may change** — that is a separate question, decided
upstream by the delta gate in
[`SOURCE-TARGET-DELTA-PLANNING.md`](SOURCE-TARGET-DELTA-PLANNING.md). SUE-604
conflated the two: a dimension being checkable was read as permission to
edit whatever it flagged, at whatever scope the available rule reached. That
conflation is what produced the rejected pass. A dimension verdict is a
diagnosis. It is never, by itself, a rewrite order.

---

## 9. The language pack boundary

```text
Language Quality Methodology          ← this document
  authority classes · precedence · overlay composition
  routing · discovery/holdout · promotion · revert
  anti-imitation · anti-overfitting
                ↓
Language Pack  (per language, optionally per locale)
  normative authorities
  native fluency phenomena
  genre conventions
  audience / literacy guidance
  terminology authorities
                ↓
Task composition
  language + genre + audience + domain + owner voice + task override
```

What belongs on each side:

| Generic | Pack |
|---|---|
| `normative_correctness` **as a category** | which spacing rule applies |
| `native_fluency` **as a category** | subject omission, particles, nominalization density |
| genre overlay **as a mechanism** | what a lead looks like in this language's newsrooms |
| promotion and holdout discipline | which institutions are credible sources in this language |

The test for a proposed generic rule: *would this still be true for a
language with no particles, no honorifics, and different spacing
conventions?* If not, it belongs in the pack.

**Locale is representable and mostly unused.** Packs are keyed by BCP-47-style
ids (`ko-KR`), so `en-US` and `en-GB` could differ later. No locale profile
is created before there is evidence it differs from another. Portability
here is architectural — a second language reuses the methodology and inherits
none of Korean's phenomena — and explicitly **not** a multi-language framework
built in advance of a second language existing.

Adding a language is a data change: one directory under
`editorial/profiles/language/` and one registry entry. No router, no script,
and no schema changes.

**One known soft spot in that boundary.** `editorial/feedback-routing.json`
is shared across every language, and its misroute `trigger_keywords` are
currently Korean and English strings, because those are the languages the
owner actually writes feedback in. That is correct today and will stop being
correct the moment a second language pack exists — at which point the keyword
lists belong in the packs, keyed by the language of the *feedback*, not of
the output. Recorded here rather than pre-built: a per-language keyword store
with one language in it is the speculative infrastructure this section
otherwise forbids.

---

## 10. Versioning and revert

Language calibration is calibration. It uses the machinery that already
exists (`schemas/calibration-version.schema.json`,
`schemas/experiment-record.schema.json`) and gets no parallel mechanism:

- a durable language change is a **versioned snapshot with lineage**, never
  an in-place edit;
- an agent may raise a `DRIFT_CANDIDATE`; **only a human activates** a
  calibration version (write-authority class 4);
- historical records are immutable evidence;
- every activation records the evidence it rests on, the holdout result, and
  the layer it changed — which is what makes reverting a single layer
  possible without unwinding everything else.

`TASK_OVERRIDE` never enters this path. It is recorded as task-local and
expires, by construction.

---

## 11. The conservative polish execution contract (AES-V2.18 / SUE-610)

A polish pass produces exactly one of three actions:

```text
KEEP                       LOCAL_POLISH                UPSTREAM_REPLAN_REQUIRED
```

**P1 — `KEEP` requires zero accepted edits.** `KEEP` is the default, and it is
a first-class success. A draft that needed no edit is not an incomplete run of
the polish layer; it is the polish layer doing its job correctly on a draft
that already satisfied the target. `KEEP` applies whenever no candidate edit
survives the pairwise gate below — which, per §7's polarity note and the
accept rule, is the ordinary outcome for prose that was already close to
correct. Mechanically: action `KEEP` and any edit with verdict `accept` may
never both appear in the same record (`scripts/lib/delta-core.mjs`).
`bonds-news` (`evals/dogfood/2026-09-05-sue604-recalibration/EVALUATION.md`
§2.4) is the case that should have produced `KEEP` and did not.

**P2 — `LOCAL_POLISH` requires at least one accepted edit.** `LOCAL_POLISH`
applies when at least one candidate edit survives the pairwise gate: a
bounded local defect was found, a candidate fix was generated, and it
demonstrably left the draft better without making anything worse. This is the
only action that may report an `accept` verdict on any edit, and it must
report at least one.

**P3 — `UPSTREAM_REPLAN_REQUIRED` requires a named route and zero accepted
edits.** `UPSTREAM_REPLAN_REQUIRED` applies when the polish layer detects a
defect it is not authorized to fix — the defect is real, but the fix is not a
local language edit. It reports zero accepted edits and names, in
`upstream_route`, the owning layer and a reason:

| Defect observed at polish time | Routes to |
|---|---|
| Wrong audience depth (too advanced or too simple for the stated reader) | Audience |
| Wrong information hierarchy (the piece foregrounds the wrong thing for its genre) | Genre / Transformation |
| Missing conceptual explanation (a term or mechanism is used but never explained) | Audience / Frame |
| A source or claim problem (a claim the language can't repair without changing meaning) | Verification / Frame |
| Wrong domain concept (not a wording issue — the underlying concept is wrong) | Domain terminology / Source integrity |

A polish pass that tries to fix any row in that table locally is doing
upstream work under polish authority, which is exactly the overreach
[`SOURCE-TARGET-DELTA-PLANNING.md`](SOURCE-TARGET-DELTA-PLANNING.md) G1
prohibits at the routing level; this table is the language-specific
instance of that same prohibition, stated for the moment the defect is
actually found rather than the moment scope is planned.

---

## 12. Hard vs soft application

Every language-pack rule carries exactly one `application_mode` (five
values, fixed):

```text
hard_local_correction       high-confidence deterministic local fix
                             (orthography, spacing, exact-quotation mismatch,
                             authoritative terminology correction)
soft_detector                a signal for detection and review; produces a
                             CANDIDATE that must survive the pairwise gate;
                             never a mandatory rewrite
upstream_guidance            guidance owned by Audience / Genre /
                             Transformation; informs generation, never
                             authorizes a polish edit
local_observation             observed, not yet supported well enough to act
                             on anywhere
deprecated_as_instruction     retained as research record; explicitly
                             withdrawn as an instruction
```

The headline sentence of this section, because SUE-604 is the record of what
happens without it: **a rule's existence does not authorize an edit.** A rule
being calibrated, corroborated, and present in an active pack answers the
question "is this a real phenomenon in the language." It does not answer "does
this specific draft need it changed," which is a question about this text,
not about the rule's general validity.

The pack guards enforcing this live in `scripts/lib/language-core.mjs`, fixed
ids L1-L5:

- **L1.** `hard_local_correction` requires `authority_class` ∈ `{INTEGRITY,
  NORMATIVE, DOMAIN_TERMINOLOGY}` and `checkability: "mechanical"`. A
  `NORMATIVE` rule in this mode additionally requires a non-null
  `authority_ref`.
- **L2.** `authority_class` ∈ `{NATIVE_QUALITY, GENRE_CONVENTION,
  AUDIENCE_CONSTRAINT, OWNER_PREFERENCE}` — empirical or preference-based —
  may **not** be `hard_local_correction`.
- **L3.** A rule whose `layer` is `audience` must be `upstream_guidance` or
  `local_observation` — never a mode a polish pass can act on directly. This
  is the child-case fix, and it is the single most important guard in this
  issue: audience adaptation is Audience/Transformation work, and a
  polish-layer rule that quietly performs it produces a draft that was never
  actually adapted, dressed as one that was.
- **L4.** `deprecated_as_instruction` requires a non-empty `notes` saying what
  withdrew it.
- **L5.** `generality: "source_local"` may not be `hard_local_correction` — a
  trait scoped to one publisher has not earned a deterministic, no-review
  correction status.

Together, L1/L2 tie the mode to what kind of authority the rule actually is
(only mechanically checkable, high-authority rules may be
`hard_local_correction`; empirical native-quality and preference-class rules
may not).

The soft native-fluency traits — passive/causative overuse, nominalization
density, connective frequency, subject omission, rhythm, report compression,
attribution placement — are `soft_detector` by construction. They are
detectors and reviewer signals first. Each one may propose a candidate edit;
none may apply itself. Whether a candidate survives is decided by the gate in
§13, not by the detector that raised it.

---

## 13. The pairwise gate

Every candidate edit is judged against the draft it would replace. The
incumbent candidate is called **ORIGINAL** — not "before," which implies the
edit is presumptively an improvement; ORIGINAL is simply the other option the
gate is choosing between.

Eleven criteria, fixed, each taking exactly one of `better | same | worse |
not_applicable`:

```text
continuous_readability     native_naturalness        rhythm
repetition                 over_explication          stiffness
information_loss           semantic_integrity        genre_preservation
audience_preservation      domain_terminology_preservation
```

**Polarity note**, because it is the easiest thing here to get backwards: for
`repetition`, `over_explication`, `stiffness`, and `information_loss`,
`better` means the edited version has **less** of it. These four are named
after defects, not after qualities — a "better" repetition score is a
quieter one.

**Accept rule.** An edit's verdict may be `accept` only when all of:

- **A1.** at least one of `continuous_readability` or `native_naturalness` is
  `better`;
- **A2.** none of `semantic_integrity`, `information_loss`,
  `genre_preservation`, `audience_preservation`, or
  `domain_terminology_preservation` is `worse`;
- **A3.** none of `repetition`, `over_explication`, or `stiffness` is
  `worse`.

Otherwise the verdict is `revert`, and ORIGINAL stands. **Ambiguity reverts.**
An edit that cannot be shown to satisfy every clause is not a marginal
accept; it is a revert, because the burden sits with the edit, not with the
incumbent text (see the preservation-first principle in
[`SOURCE-TARGET-DELTA-PLANNING.md`](SOURCE-TARGET-DELTA-PLANNING.md) §7).

**P4.** A `soft_detector` edit must carry the full eleven-criterion pairwise
block — no criterion may be absent. An edit missing one is invalid, not
accepted; it never reaches the accept rule at all.

**P5.** An edit whose `application_mode` is `upstream_guidance`,
`local_observation`, or `deprecated_as_instruction` may never carry verdict
`accept`. Those three modes do not authorize a polish edit at all, regardless
of what the pairwise block would otherwise show — this is what makes the
pack/record mode cross-check (guard B, `scripts/lib/delta-core.mjs`)
load-bearing: P5 only ever inspects the `application_mode` the edit itself
asserts; it cannot, by itself, catch an edit that asserts a mode other than
the one §12's pack guards actually license for the rule it cites.

**P6 — the `hard_local_correction` carve-out.** A `hard_local_correction`
edit may omit the full pairwise block entirely and record only
`semantic_integrity`; `worse` there is rejected outright, not merely blocked
from `accept`. This exists because a deterministic correction (a spacing
fix, a doeda/dwaeda distinction) is not judged on readability gain — its
justification is correctness, not a comparative literary judgment — so
holding it to the full eleven-criterion block would make every
`hard_local_correction` edit fail P4 by construction. The accept rule's A1
clause is correspondingly read as satisfied for a `hard_local_correction`
edit when `continuous_readability`/`native_naturalness` are both absent
(there is nothing to be "better" than when the criterion was never asked
for); A2/A3 still apply to whatever criteria the edit does carry, and an
absent criterion never counts as `worse`.

**This carve-out is also the premise the critical exploit used.** A record
citing an `upstream_guidance` audience rule while asserting
`application_mode: "hard_local_correction"` gets the benefit of the P6
carve-out — a bare `semantic_integrity` block, no readability evidence
required — and, absent a check that the asserted mode actually matches what
the pack declares for the cited rule, sails through both P5 (which only ever
looks at the asserted mode) and the accept rule's A1 exemption. The
pack/record mode cross-check is what closes this: it verifies the mode
against the pack before P4/P5/P6 or the accept rule ever run, so an edit
cannot claim the `hard_local_correction` carve-out for a rule the pack does
not actually license that way.

A local rule-compliance gain can never offset a holistic readability
regression. Notice what is deliberately absent from the eleven criteria:
**rule compliance is not one of them.** An edit that correctly executes a
pack rule but reads worse fails the gate regardless of how faithfully it
followed the rule, because the gate is judging the draft, not grading the
edit's adherence to instructions. A rule is a hypothesis about what makes
language better; the pairwise gate is where that hypothesis is actually
tested against this text, and a rule "working as designed" is not evidence
if the resulting prose is worse.

---

## 14. Churn is a quality risk — edit-surface observability

Every polish record carries an `edit_surface` measurement: how much of the
original text changed, in characters or sentences. This is recorded so a
broad rewrite is visible as a broad rewrite, not laundered into a series of
individually-defensible small edits that add up to something nobody signed
off on.

One advisory constant governs it: `ADVISORY_EDIT_SURFACE_BAND = 0.20`.
Crossing it does not fail the draft — it is not a gate. Crossing it requires
the record to carry a non-empty `large_edit_justification` naming the
concrete defect that justified editing that much of the text, and to state
whether `UPSTREAM_REPLAN_REQUIRED` was considered instead of a large local
pass.

The owner's "last 5–6%" figure is design posture: it describes roughly how
much of a well-targeted draft should typically still need at the polish
stage. **It is not a threshold, and it is explicitly documented as not a
threshold in as many words**, because encoding it as a numeric gate is the
obvious next mistake once edit-surface data exists to compute one from. A
gate built on that number would fail exactly the kind of draft this
architecture is supposed to accommodate — a `P3_RECOMPOSE` target that
correctly needed heavy upstream work and now legitimately needs a
correspondingly large polish surface — while missing the actual failure mode,
which is an unjustified edit at any surface size.

---

## 15. Deference to the delta gate

Intervention magnitude is not decided here. It is decided upstream, per axis,
by [`SOURCE-TARGET-DELTA-PLANNING.md`](SOURCE-TARGET-DELTA-PLANNING.md),
before this layer runs. Polish executes inside the ceiling the delta gate
already set; it does not compute or override that ceiling, and no verdict
produced by this architecture's seven dimensions may be read as license to
widen it.

Concretely: polish runs *after* delta-driven upstream work, not instead of
it, and it must not repeat that work. In the age 10–12 case worked through in
[`SOURCE-TARGET-DELTA-PLANNING.md`](SOURCE-TARGET-DELTA-PLANNING.md) §6, once
Audience/Transformation has legitimately recomposed a Report into
child-appropriate language, the polish pass that follows must not re-run that
adaptation merely because child-register traits exist somewhere in the
language pack. A polish layer that "helpfully" re-simplifies an already
age-appropriate draft is not adding safety margin — it is duplicating a
decision a higher-authority layer already made correctly, and every
duplicate pass is another chance to introduce the kind of unforced error
`bonds-child` recorded
(`evals/dogfood/2026-09-05-sue604-recalibration/EVALUATION.md` §2.6: a
causal denial the source never made, and a caption whose stated-uncertainty
span existed nowhere in the AFTER draft).

---

## 16. Portability

The execution contract in §11–§15 — detect a candidate defect, generate a
bounded candidate edit, judge it against ORIGINAL on eleven fixed criteria,
keep or revert — is generic methodology. Nothing in it is Korean. A future
language pack supplies its own defect signals (its own native-fluency
phenomena, its own genre conventions, its own terminology authorities, per
§4 and §9 above); the execution contract that turns a detected signal into an
accepted or reverted edit does not change with the language. This mirrors the
portability claim already made for the seven dimensions in §9: a second pack
is cheap to add and inherits none of Korean's phenomena, because the
methodology was never coupled to them.

---

## 17. What this architecture must not become

- **A style checker.** Mechanically decidable normative checks are welcome
  where they genuinely are decidable. Most of `native_fluency` is not, and
  pretending otherwise produces confident wrong verdicts. A pack states which
  of its rules are checkable and which are review guidance.
- **A house style for a language.** The pack describes how the language
  behaves in professionally edited use. It does not describe how one outlet
  writes, and it does not encode the owner's taste — that is a separate,
  lower-authority overlay that is allowed to change over time.
- **A second quality system.** Every dimension routes into the existing
  layer vocabulary, the existing feedback record, the existing calibration
  ledger. Nothing here has its own evaluation loop.
- **A multilingual platform.** One pack exists. The architecture makes a
  second one cheap; it does not make a second one exist.
- **A rewriter.** A language-quality layer that re-authors readable prose has
  stopped measuring language and started generating it. This layer's job is
  to detect defects and judge candidate fixes against the incumbent text —
  `KEEP` is the expected outcome for a draft that already satisfies the
  target, not a shortfall to be corrected by finding something, anything, to
  change. SUE-604 is the record of what happens when that boundary is
  crossed: rules that were applicable were treated as rules that were due,
  and an already-acceptable draft (`bonds-news`) came out worse for having
  been run through a pass with rules available and no defect to repair.
