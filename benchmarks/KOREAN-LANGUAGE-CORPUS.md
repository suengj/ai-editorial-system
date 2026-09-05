# Benchmark — Korean reference corpus (SUE-604)

Observed 2026-09-05. This benchmark records what the 14 Korean-language
references added to `references/catalog.json` under SUE-604 actually license,
as evidence for `editorial/profiles/language/ko-KR.json`. Every reference
below is cited here in the place it is doing analytical work; this document
is also what makes those catalog entries pass `scripts/validate-rights.mjs`,
which fails any entry not cited by a document under `benchmarks/` or
`editorial/`.

---

## 1. What this corpus is and is not

This is craft evidence about how published Korean behaves at the sentence and
paragraph level in three genre/audience settings the pack cares about:
economic-outlook reports, hard news, and material addressed to children aged
roughly 10–12. It is not a source of facts — nothing in it is used to verify
a claim in any article. It is not a style to imitate — no trait here licenses
a Writer to sound like 중앙일보 or KDI or 이코노아이; per
`docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md` §6, trait extraction
records *how the language behaves* (collocation, clause construction,
connective logic, information pacing), never a target voice. And it is
pointer-only: no article or report body is stored in this repository. Every
reference below is `copy_status: linked` in `references/catalog.json`, and
every Korean fragment quoted in this document is a short, attributed
evidentiary excerpt already quoted in the corresponding evaluation record
under `references/evaluations/`, not a reproduction of the source.

---

## 2. Composition table

| Group | Discovery | Holdout |
|---|---|---|
| Report (research/academic) | `ref:bok-economic-outlook-report` (BOK), `ref:kdi-economic-outlook-report` (KDI), `ref:nabo-economic-outlook-report` (NABO) — 3 institutions | `ref:kiet-economy-industry-outlook` (KIET), `ref:kcmi-capital-market-focus` (KCMI) — 2 institutions |
| News | `ref:joongang-ilbo-public-institution-reform` (중앙일보), `ref:khan-public-institution-reform` (경향신문) — 2 institutions | `ref:asiae-public-institution-reform` (아시아경제), `ref:mt-public-institution-reform` (머니투데이) — 2 institutions |
| Child / audience (ages ~10–12) | `ref:econoi-childrens-economic-newspaper` (이코노아이), `ref:kma-kids-weather-classroom` (기상청), `ref:mofe-kids-economics-classroom` (재정경제부/기획재정부) — 3 institutions | `ref:bok-easy-economics-elementary` (한국은행), `ref:nibr-bris-child-biology-encyclopedia` (국립생물자원관) — 2 institutions |

Five institution groups, seven genre/audience roles, fourteen references. No
group has fewer than two institutions on either side of the split — the
minimum the multi-source bar in `LANGUAGE-QUALITY-ARCHITECTURE.md` §6 asks
for before a trait can even be considered for promotion.

---

## 3. Discovery vs holdout, and why the split is load-bearing

`corpus_role` was assigned to every one of the 14 references **before**
extraction began, per §7 of the architecture doc. This is not a formality.
A trait derived and then checked against the same material it was derived
from proves only that the extraction worked; it says nothing about whether
the trait generalizes past one publisher's habits. The five holdout records
in this corpus exist to test traits already found elsewhere, never to
originate one — and several say so explicitly in their own `weaknesses`:

- `ref:kiet-economy-industry-outlook`: "This record was assigned holdout
  before reading and validates a trait already derived from
  ref:kdi-economic-outlook-report; it must never be treated as having
  originated the bare-noun-ending finding."
- `ref:kcmi-capital-market-focus`: the record is explicit that it "validates
  the hedging trait; it does not originate it."
- `ref:asiae-public-institution-reform` and `ref:mt-public-institution-reform`
  both state they validate the nested-quotation trait found at
  `ref:khan-public-institution-reform` and must not be read as originating
  it.
- `ref:bok-easy-economics-elementary` and `ref:nibr-bris-child-biology-encyclopedia`
  both state the same discipline for the two audience findings below.

A reference that has informed a trait can never later be moved into the
holdout set. None of the five holdout records above contributed to deriving
the trait they corroborate; each was read only after the discovery record's
finding already existed.

---

## 4. Promotion candidates — traits corroborated across ≥2 independent institutions

Four traits in this corpus clear the multi-source bar. All four still carry
`holdout_result: not_yet_tested` on their corresponding rules in
`editorial/profiles/language/ko-KR.json` — see §8.

### 4.1 Report: sentence-final bare-noun compression on forecast clauses

Discovery source `ref:kdi-economic-outlook-report`: a load-bearing forecast
clause ends on a bare noun (전망, 완화, 존재) with no closing predicate —
e.g. a clause built up to "...성장을 나타낼 전망" with no 이다/verb. The
device compresses the sentence while keeping the modal status (forecast, not
settled fact) legible from the noun alone.

Holdout corroboration `ref:kiet-economy-industry-outlook`: an independent
institution — an industrial-policy research body, not a central bank —
reproduces the same device on its own forecast/trend-summary clause,
ending on the bare noun 견인. Crucially, the same document also shows the
device is **selective, not blanket**: a separate sentence on manufacturing
employment closes on a full predicate with an evidential hedge
("...모습을 보이고 있다"), not a bare noun. This licenses the trait as a
report-register device reserved for forecast/trend-summary clauses
specifically, not a general compression habit to apply to every sentence in
a report.

### 4.2 Report: graded evidential hedging on forecast/risk clauses

Discovery source `ref:kdi-economic-outlook-report`: risk clauses stack a
conditional connective, a causal chain, and an explicit possibility marker
in one sentence rather than asserting an outcome outright — e.g. a clause
combining 경우 (conditional) + 에 따라 (causal) + 가능성도 존재 (explicit
possibility).

Holdout corroboration `ref:kcmi-capital-market-focus`: a third institution
(capital-markets commentary, a different subgenre from both KDI's macro
forecast and KIET's industry outlook) reaches for the same family of
evidential closing predicates — 것으로 전망된다, 모습이다 — rather than
flat declaratives. This licenses graded hedging as a report-genre
convention across at least three institutions and two subgenres. It does
not license the record's own triple-stacked hedge formula — see §6.

### 4.3 News: nested paraphrase-then-quote attribution

Discovery sources `ref:khan-public-institution-reform` (a paraphrased setup
clause closed with ~라며, followed by a second quoted clause closed with
고 밝혀다, both attributed to the one named speaker in a single sentence)
and `ref:joongang-ilbo-public-institution-reform` (a flatter variant: named
speaker and title precede a single quotation, closed with 고 했다, with
figurative language kept inside the quote rather than the reporter's
narration).

Holdout corroboration, independently, from `ref:asiae-public-institution-reform`
(a background/history-specific closing variant, ~고 지적하며 ... 지시한 바
있다, used for a retrospective clause rather than a live announcement quote)
and `ref:mt-public-institution-reform` (a third variant where the second
layer is the reporter's own interpretive clause — 화두를 던졌다 — rather
than a second quotation). Four outlets, four structurally distinct closing
forms, the same underlying move: attribute the words, then let a separate
clause — quoted or the reporter's own — carry the interpretive load. This
licenses nested attribution as a flexible News convention, not one fixed
sentence template to reproduce verbatim.

### 4.4 Audience: concrete-before-abstract sequencing

Discovery source `ref:econoi-childrens-economic-newspaper`: two articles
read in full both name a familiar native-Korean word, or voice the reader's
likely (even if wrong) guess, before attaching the technical 한자어 term —
e.g. naming 사고팔다 before 매매, or voicing "기본값으로 되돌렸다는 뜻일까
요?" before correcting to 채무불이행. A 한자 decomposition device (breaking
a term into characters with a concrete origin-story) reinforces the same
concrete-first move.

Holdout corroboration `ref:bok-easy-economics-elementary`: a structural
corroboration only — a central-bank publication programme reaches for the
same concrete-before-abstract move via a different device (a persistent
family-conversation frame plus retold folk-tale episodes, rather than
econoi's Q&A-and-한자어-decomposition). The record is explicit that this
booklet's body prose was never read (it is PDF-distributed), so this
corroborates the framing device structurally, not any sentence-level craft.

`ref:mofe-kids-economics-classroom` is a genuine same-domain counterexample
that defines this trait's edge rather than corroborating it: a government
children's-economics micro-site defines 수요 and 공급 in near-dictionary
form (X란 ~것을 말한다) **before** attaching a concrete market scenario —
the reverse of econoi's sequencing, from an institution of the same tier, on
the same basic-economics-for-children domain. This is recorded as a
same-domain negative instance, not folded into the promoted trait; no
holdout has yet corroborated this specific sequencing failure, so it stays
source-local (see §6).

---

## 5. The strongest audience finding, and it is negative

"Labelled child" is not "adapted for child." `ref:kma-kids-weather-classroom`
(기상청 어린이 기상교실) defines 태풍 by its meteorological diagnostic
thresholds — "중심기압이 950헥토파스칼 이하이고 최대풍속이 17m/s 이상인" —
with no concrete scene, no analogy, and no gloss of 열대저기압, under a page
explicitly labelled for children. A second passage in the same section
layers unglossed physical-geography vocabulary (저위도/고위도 열에너지
불균형, 대류구름, 태양의 고도각) with equally no restatement.

`ref:nibr-bris-child-biology-encyclopedia` independently corroborates the
identical anti-pattern from a second government institution in an unrelated
domain: a species entry in 국립생물자원관's 어린이 생물도감 opens with
unglossed taxonomic classification and lifecycle terminology (명아주과, 1년생
초본) before any concrete image of the plant. Two independent government
institutions, two unrelated domains (meteorology and botany), publishing
under an 어린이 label with fully unadapted specialist register.

This is the opposite failure from the baby-talk anti-pattern
`editorial/profiles/audience/child-upper-elementary.json` warns about under
`anti_patterns` ("exaggerated simplicity, sing-song register, or vocabulary
well below the stated reading level"). The profile anticipates register
pitched too low; this corpus shows the failure mode of register never
adapted at all, still carrying full specialist density and unglossed
terminology, with a "child" label doing no adaptation work whatsoever. The
profile did not anticipate this failure and should be read as incomplete on
this point until it is amended.

---

## 6. Kept deliberately local — `do_not_copy` and single-source

These are recorded as evidence, explicitly not as transferable rules:

- `ref:kcmi-capital-market-focus`'s triple-stacked hedge formula
  ("~할 수 있다는 점에 유의해야 할 것이다" — modal possibility + a
  nominalized "point to note" + a further modal obligation, three hedging
  layers in one clause, plus a translationese-adjacent nominal phrase,
  전술한 경로를 통해) is the evaluation's own `do_not_copy` verdict: it did
  not appear at KDI or KIET and reads as house-specific caution phrasing,
  not a general report-genre convention.
- `ref:mt-public-institution-reform`'s idiomatic predicate 화두를 던지다
  ("threw out a talking point") is vivid but did not appear in the 경향신문
  or 중앙일보 coverage of the same event — a publisher-local word choice,
  not a corroborated predicate-choice norm.
- `ref:econoi-childrens-economic-newspaper`'s recurring column formats
  (Q&A boxes, a 한자어 word-of-the-day column) and family-character device
  are the outlet's own recognizable house structure. Adopting the
  underlying concreteness and hedging moves is fine; reproducing the column
  format or character names is imitation, not craft transfer.
- `ref:bok-easy-economics-elementary`'s named family characters (한은이,
  중은이, and their parents) and its specific retold folk-tale episodes are
  this publication's own recognizable content. The transferable lesson is
  the structural device — a persistent, familiar narrative frame carrying
  an abstraction — never the characters or the stories themselves.
- `ref:mofe-kids-economics-classroom`'s define-then-illustrate sequencing
  is kept as a single observation, not a rule: no holdout has yet
  independently corroborated this specific sequencing anti-pattern, so
  per the multi-source bar it stays source-local pending a second
  institution.

---

## 7. What the corpus says about the existing pack

One rule already in `editorial/profiles/language/ko-KR.json` is partly
contradicted by this evidence. `reg-news-attribution-placement` states that
quotes are attached after the speech content (~라고 밝혔다 / ~라고 말했다
form) and that leading a sentence with the speaker's name should not be the
default form. But `ref:joongang-ilbo-public-institution-reform` places the
speaker's title and name *before* the quotation as its ordinary lead-in
form ("한성숙 국무총리는 \"...\"고 했다"), and the nesting construction
found independently across `ref:khan-public-institution-reform`,
`ref:asiae-public-institution-reform`, and `ref:mt-public-institution-reform`
consistently opens with the named speaker before the attributed material
follows. Four independent outlets place the speaker's name first as
ordinary Korean newsroom form, not as an exception to a name-last default.
This is reported here as a finding; the Manager is amending the rule.

---

## 8. Limitations

- All four news references — `ref:joongang-ilbo-public-institution-reform`,
  `ref:khan-public-institution-reform`, `ref:asiae-public-institution-reform`,
  `ref:mt-public-institution-reform` — cover the **same day's story** (the
  공공기관 통폐합 announcement). Holding the event constant isolates form
  from content, which is the reason this set is useful at all, but it also
  means every news-genre trait in this corpus rests on one event on one day.
  None of it has been checked against a different story.
- `ref:bok-economic-outlook-report` and `ref:nabo-economic-outlook-report`
  are PDF-gated; neither evaluation could extract body prose, so only their
  structural report templates (section skeletons, stated analytical scope)
  were verifiable. No sentence-level trait in §4 rests on either reference.
  The report-genre prose traits in this corpus therefore rest entirely on
  KDI, KIET, and KCMI.
- 연합뉴스 and 한겨레 could not be fetched for the news holdout set and were
  substituted with 아시아경제 and 머니투데이 respectively; the substitutions
  and the reasoning for each are recorded in
  `references/evaluations/asiae-public-institution-reform/` and
  `references/evaluations/mt-public-institution-reform/`.
- `ref:bok-easy-economics-elementary`'s body prose was never read at all —
  the record corroborates the family-narrative framing device only, from
  publisher front-matter, and makes no claim about sentence length, clause
  depth, or whether stated uncertainty survives simplification in the
  booklet's actual body.
- No trait in this corpus has been tested by generating anything. Holdout
  corroboration proves the trait's *presence* in independent material; it is
  not a measured before/after improvement on generated text. Every rule in
  `editorial/profiles/language/ko-KR.json` affected by this corpus still
  carries `holdout_result: not_yet_tested`, and stays there until a
  generation on an unseen topic is run against it, per
  `LANGUAGE-QUALITY-ARCHITECTURE.md` §7.
