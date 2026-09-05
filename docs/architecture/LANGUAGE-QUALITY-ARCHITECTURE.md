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

## 11. What this architecture must not become

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
