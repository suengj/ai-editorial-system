# Korean language pack (ko-KR) — prose contract

Machine surface: `editorial/profiles/language/ko-KR.json`. That JSON is
authoritative for ids, authority classes, scope, checkability, and status.
This document explains the phenomena behind each rule and must not contradict
the JSON — where the two disagree, the JSON wins and this file is out of
date.

The methodology this pack plugs into — authority classes, precedence,
genre/audience orthogonality, discovery/holdout, promotion, anti-imitation —
is language-agnostic and lives in
`docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md`. Nothing in that
document is restated here, and nothing here is a Korean rule that belongs
there instead.

**Status: draft, and this pack governs nothing until a human activates it.**
SUE-604 ran the pack's first holdout evaluation; two `register` rules now
carry a result other than `not_yet_tested`
(`reg-report-bare-noun-compression: improved`,
`reg-report-hedge-language: neutral`) and the rest of `native_fluency`,
`register`, and `audience` still read `not_yet_tested`. SUE-604's broad
rule-driven rewrite pass that produced that evidence was itself rejected by
the owner — it treated every rule's existence as license to rewrite, and
that is exactly what produced a manufactured quotation and a deleted
concrete agent alongside the genuine repairs. SUE-610 (§0 below) answers
that with `application_mode`: a field on every rule stating what it is
allowed to authorize, independent of whether it has been holdout-validated.
`calibration_ref` remains `null` and `status` remains `draft` — neither
holdout promotion nor this reclassification changes that. Activating the
pack is a separate, human decision
(`docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md` §10).

The authority registry this pack draws on is
`references/korean-language-authorities.md`. Every `authority_ref` in the JSON
resolves to an entry in the pack's own `authorities[]`, and that is checked
mechanically (`scripts/validate-language.mjs`). The onward correspondence
between those entries and the registry document was verified by hand and is
**not** machine-checked: the registry is prose and carries no ids. This
document does not re-derive the registry; it explains what each cited
authority is used for.

---

## 0. `application_mode` — a rule's existence does not authorize an edit

AES-V2.18 / SUE-610 added `application_mode` to every rule in the JSON
(`schema_version` bumped to `1.1.0`). This section explains what the field
means; the reclassification itself is table 0.1 below. Nothing here overrides
`docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md`, which stays the
authority on authority classes, precedence, and discovery/holdout. This
section is the language pack's own account of what SUE-604's rejected
broad rewrite got wrong and how this pack answers it.

SUE-604 ran fifteen drafts through every rule in this pack as if a rule's
mere presence licensed a rewrite. The independent evaluation
(`evals/dogfood/2026-09-05-sue604-recalibration/EVALUATION.md`) found real
gains from that pass, but also a manufactured quotation, a deleted subject
that was the only concrete agent in a sentence, and stiffer Korean introduced
where nothing was broken. None of those failures came from a rule being
*wrong*. They came from every rule being treated as a command. `application_mode`
is the fix: it separates *what a rule knows* from *what a rule is allowed to
do about it*.

Five values, and only these five:

- **`hard_local_correction`** — a high-confidence, deterministic local fix
  (orthography, spacing, an exact-quotation mismatch, an authoritative
  terminology correction). The rule may edit directly.
- **`soft_detector`** — a signal for detection and review. It produces a
  *candidate* edit that must survive the pairwise gate
  (`docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md` polish contract,
  eleven criteria, `accept`/`revert`). It is never a mandatory rewrite, and
  silence from this rule is a legitimate outcome.
- **`upstream_guidance`** — owned by Audience, Genre, or Transformation. It
  informs generation. It never authorizes a polish edit, because the thing it
  governs (how a piece is framed for a ten-year-old, how a document is
  composed for a genre) is not a local, bounded fix.
- **`local_observation`** — observed, but not supported well enough to act on
  anywhere yet. Neither generation nor polish should treat it as
  authoritative.
- **`deprecated_as_instruction`** — retained as a research record; explicitly
  withdrawn as an instruction. The corpus work behind it is not deleted; the
  license to act on it is.

The guards that assign these mechanically live in
`scripts/lib/language-core.mjs` and are restated here only so this document
does not drift from them:

- `hard_local_correction` requires `authority_class` ∈ {`INTEGRITY`,
  `NORMATIVE`, `DOMAIN_TERMINOLOGY`} **and** `checkability: mechanical`. A
  `NORMATIVE` rule in this mode also requires a non-null `authority_ref`.
- `NATIVE_QUALITY`, `GENRE_CONVENTION`, `AUDIENCE_CONSTRAINT`, and
  `OWNER_PREFERENCE` may never be `hard_local_correction` — 26 of this pack's
  35 rules fall in one of those four classes, and none of them are.
- Every rule whose `layer` is `audience` must be `upstream_guidance` or
  `local_observation`. This is the direct fix for the child-draft
  regression in §2.6 of the evaluation: the polish layer re-authored an
  audience adaptation (a term gloss, a causal simplification) that
  generation already owned, and one of those rewrites turned a hedged
  interpretation into an unhedged general claim.
- `deprecated_as_instruction` requires a non-empty `notes` recording what
  withdrew it.
- `generality: source_local` may never be `hard_local_correction` (no rule in
  this pack currently has that generality, so this guard is dormant here).

**Status stays `draft`.** This reclassification does not activate the pack.
`calibration_ref` is untouched. Nothing below governs a real draft until a
human activates a calibration version
(`docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md` §10).

### 0.1 The reclassification, rule by rule

| Rule id | `application_mode` | Why |
|---|---|---|
| `norm-particle-attachment` | `hard_local_correction` | NORMATIVE, `mechanical`, has `authority_ref` — the only kind of rule L1 lets through. |
| `norm-dependent-noun-spacing` | `soft_detector` | NORMATIVE but `review_guidance` — deciding dependent-noun vs. fused-particle homographs takes context, so L1 blocks `hard_local_correction`. This is not a defect to fix by relabelling it `mechanical`; it genuinely is not. |
| `norm-auxiliary-verb-spacing` | `soft_detector` | Both spacings are normatively permitted; the rule's whole purpose is catching false-positive "errors," which is a review job, not an autonomous edit. |
| `norm-doeda-dwaeda-distinction` | `hard_local_correction` | NORMATIVE, `mechanical` (decidable by the 되어-substitution test), has `authority_ref`. |
| `norm-standard-form-usage` | `soft_detector` | NORMATIVE, but which registered synonym fits the context is judgment, not lookup. |
| `norm-loanword-transliteration` | `soft_detector` | NORMATIVE, but the exception list is large enough that per-word confirmation is required. |
| `norm-quotation-attribution-punctuation` | `soft_detector` | NORMATIVE, but quotation vs. re-quotation vs. emphasis is contextual. See the open gap flagged in §0.2 below — this rule does not yet cover what SUE-604 actually found broken. |
| `nq-translationese-connective-scaffolding` | `soft_detector` | NATIVE_QUALITY — L2 forbids `hard_local_correction` outright. Evaluation credits this rule with real, verified repairs (tools-news, tools-report). |
| `nq-double-passive` | `soft_detector` | NATIVE_QUALITY; diagnosis borrowed from public-language guidance and generalised as this pack's own claim, not that guidance's authority. |
| `nq-excessive-nominalization` | `soft_detector` | NATIVE_QUALITY; verified repair in tools-news and bonds-report. |
| `nq-particle-misuse` | `soft_detector` | NATIVE_QUALITY; not individually evaluated in SUE-604, kept at the class default. |
| `nq-subject-topic-omission` | `soft_detector` | NATIVE_QUALITY. The evaluation's F5 finding shows this rule over-applied in `bonds-news`, deleting the sentence's only concrete agent and failing `audience_fit`. It stays `soft_detector`, not because the risk isn't real, but because this is exactly the failure the pairwise gate's `audience_preservation` criterion exists to catch — a mandatory rewrite would not have had that backstop. |
| `nq-connective-adverb-overuse` | `soft_detector` | NATIVE_QUALITY; verified repair in tools-news. |
| `nq-passive-causative-overuse` | `soft_detector` | NATIVE_QUALITY. Evaluation shows both over-application (bonds-news: `그대로이다`→`유지되다`, a stiffer construction introduced where nothing was broken) and under-application (housing-report's agentless forecast predicates, F6). Both directions argue for judgment-per-instance, i.e. `soft_detector`, not for discarding the rule. |
| `nq-relative-clause-stacking` | `soft_detector` | NATIVE_QUALITY; not individually evaluated, class default. |
| `nq-jeok-suffix-pileup` | `soft_detector` | NATIVE_QUALITY; supported by count evidence (15→12, 4→2 across two pairs). |
| `nq-possessive-chaining` | `soft_detector` | NATIVE_QUALITY; not individually evaluated, class default. |
| `nq-predicate-final-variety` | `soft_detector` | NATIVE_QUALITY; not individually evaluated, class default. |
| `nq-redundant-expression` | `soft_detector` | NATIVE_QUALITY; not individually evaluated, class default. |
| `nq-formulaic-translated-abstract-opener` | `soft_detector` | NATIVE_QUALITY, `do_not_copy`; a detection signal for a recognizable tic, not a rewrite instruction. |
| `reg-news-lead-fact-first` | `soft_detector` | GENRE_CONVENTION — L2 forbids `hard_local_correction`. The usual fix (reorder the first sentences of a lead) is bounded enough to stay a polish candidate; no evaluated instance shows harm. |
| `reg-news-attribution-placement` | `deprecated_as_instruction` | See §0.2 — withdrawn, not merely downgraded. |
| `reg-report-hedge-language` | `soft_detector` | GENRE_CONVENTION; `holdout_result: neutral` (unchanged) — transferred to the unseen topic without demonstrating a gain, and with a documented over-application risk (see `nq-passive-causative-overuse` above). Valid genre convention, not yet earning more than detection. |
| `reg-report-outline-vs-narrative` | `soft_detector` | GENRE_CONVENTION; not evaluated in SUE-604, no evidence either way, but the fix (a single bullet's form) is local enough to stay a candidate. |
| `reg-report-bare-noun-compression` | `soft_detector` | GENRE_CONVENTION, `holdout_result: improved` (unchanged). Promotion on the holdout does not upgrade the mode — L2 still forbids `hard_local_correction` for GENRE_CONVENTION. The fix is a sentence-ending compression, local and bounded, exactly what `soft_detector` is for. |
| `aud-vocab-tier-basic` | `upstream_guidance` | `layer: audience` — L3 forces this off `soft_detector`. Grounded in a real (if interpretively applied) NIKL authority; this is guidance to generation about which vocabulary tier to reach for, not a local polish fix. |
| `aud-sentence-length-short` | `upstream_guidance` | `layer: audience`, L3. Directly derived from the audience profile's own "short conceptual steps" principle. |
| `aud-hanja-to-native-preference` | `local_observation` | `layer: audience`, L3 forces `upstream_guidance` or `local_observation`. This is the one audience rule with no multi-source corpus support at all (its own rationale says so) and no SUE-604 evaluation coverage — weaker grounding than the other five audience rules, so it is downgraded to `local_observation` rather than `upstream_guidance`. |
| `aud-uncertainty-child-register` | `upstream_guidance` | `layer: audience`, L3. Directly derived from the audience profile's own anti-pattern (never lower stated uncertainty for simplicity's sake). |
| `dom-practitioner-usage-retention` | `soft_detector` | DOMAIN_TERMINOLOGY, but `review_guidance` (not `mechanical`), so L1 blocks `hard_local_correction`. Verified working correctly in bonds-report (`falsifiable한` → `반증 가능한`). |
| `dom-refined-word-advisory-only` | `soft_detector` | DOMAIN_TERMINOLOGY, `review_guidance`; functions as a guard against over-applying refined-word substitutions, which is itself a detection job. |
| `owner-avoid-a-not-b-formula` | `soft_detector` | OWNER_PREFERENCE — L2 forbids `hard_local_correction`. `owner_voice_fit` is `UNKNOWN` on every SUE-604 draft, but that describes those specific drafts, not whether `voice.md` §3's own warning about this construction is real; `voice.md` already documents it as an observed tendency the owner should not let calcify into a formula. Kept as a detector, not elevated to a mandatory rewrite. |
| `owner-no-stock-opening-closing-phrases` | `soft_detector` | OWNER_PREFERENCE. `checkability: mechanical` does not help here — L2 blocks `hard_local_correction` for OWNER_PREFERENCE regardless of checkability. A literal-phrase-match detector is exactly what this rule already is; it stays a candidate pending pairwise review, not an autonomous deletion. |
| `aud-concrete-before-abstract` | `upstream_guidance` | `layer: audience`, L3. Corroborated across two independent discovery sources and confirmed on an independent holdout mechanism; the evaluation found no measurable delta to promote on `holdout_result` (unchanged, `not_yet_tested`), but the sequencing itself is a generation-time composition choice, not a local text fix. |
| `aud-child-label-is-not-adaptation` | `upstream_guidance` | `layer: audience`, L3. Corroborated across two independent government sources (기상청, 국립생물자원관) discovering the same failure pattern; this governs how a piece is composed for a child audience, which is generation's job. |

### 0.2 `reg-news-attribution-placement` — deprecated, not just downgraded

This rule is the one place SUE-610 withdraws a rule as an instruction rather
than merely restricting it. The evaluation's holdout finding
(`EVALUATION.md` §6) says this plainly: the rule's `holdout_result` reads
`not_yet_tested` not because evidence is missing but because the evidence
that exists is bad. On the one holdout instance with a real speaker
(국토교통부's announcement) the rule reproduced the corroborated nested
attribution form correctly. Everywhere else it manufactured attribution:
six document-attributions in `tools-news` ("필자는 … 지적하며 … 짚는다" applied
to a written View, which said nothing out loud), a quote-marked paraphrase in
`bonds-news` that the canonical source does not contain (the source says
"채권시장 붕괴"; the AFTER draft put "채권시장 위기라기보다" inside quotation
marks), and two sourceless attributions in `housing-news`
("지적이 나온다", "시각도 있다").

The rule's own evidence base is the thinnest in the pack — four newsrooms
covering one official's announcement on one day (`benchmarks/KOREAN-LANGUAGE-CORPUS.md`
§8) — and it has never been checked against a piece with no speaker at all,
which turns out to be exactly where it fails. The evaluation's routing
finding F3 says what would fix it: a scope condition distinguishing (i) a
person who spoke, (ii) a document that states, (iii) no attributable source —
and forbidding (iii) outright. That fix is out of scope for this
reclassification; SUE-610 only decides what the rule is allowed to do in the
meantime.

Leaving it at `soft_detector` was considered and rejected. A `soft_detector`
still produces a candidate edit for a Writer or Polisher to act on, and the
failure mode here is not "the Korean this rule produces reads badly" (it
reads fluently — a native newsroom writer produces exactly these sentences,
per the evaluation's F3 analysis) — it is that the rule invents a source or a
quotation. That is a `semantic_integrity` risk the pairwise gate's
`domain_terminology_preservation` and `semantic_integrity` criteria are not
guaranteed to catch, because the produced Korean is not obviously false on
its face; it takes checking against the source, which the corpus and holdout
work behind this rule already show this pack does not yet do reliably at the
attribution layer. So the rule is `deprecated_as_instruction`: the corpus
work behind it stands, the diagnosis of the nested attribution *form* is not
wrong, but nothing may act on it as an instruction until the scope condition
exists and is re-tested. Re-promotion to `soft_detector` is the natural next
step once that happens, not a re-derivation from scratch.

---

## 1. Normative layer — codified correctness

These rules trace to 국립국어원's 한국어 어문 규범 and 표준국어대사전 — a
standards body, not a corpus. A construction appearing in every well-edited
publication in the country is still not thereby correct; a correct
construction appearing nowhere is still correct. That is why every rule in
this section carries an `authority_ref` pointing at a `NORMATIVE_STANDARD`
source, and why none of them carry `evidence_refs` — corpus examples may
illustrate a normative rule, they cannot establish one.

**Spacing (띄어쓰기).** Korean's word-spacing rules are not "put a space
between words" — they are "put a space between *어절*, and treat 조사 as
part of the preceding word." A 조사 never gets its own space:

> 맞음: 학교에 간다
> 틀림: 학교 에 간다

Dependent nouns (의존명사) go the other way — they get a space, because they
are nouns standing on their own, not particles:

> 맞음: 아는 것이 힘이다
> 틀림: 아는것이 힘이다

The same string can be either, depending on function. '대로' after a verb
stem is a dependent noun and takes a space (아는 대로); '대로' directly after
certain nouns has fused into something closer to a particle and does not.
This is exactly why the spacing rules are marked `review_guidance` rather
than `mechanical` in the JSON — deciding which case applies requires reading
the sentence, not pattern-matching the string.

**Orthography (맞춤법).** The most common decidable case in edited Korean is
되/돼: '되어'가 원래 형태이고, 그 자리에 '되어'를 넣어 자연스러우면 '돼'를
쓰고 그렇지 않으면 '되'를 쓴다.

> 맞음: 안 됐다 (← 안 되었다)
> 틀림: 안 됬다

That substitution test is exactly why `norm-doeda-dwaeda-distinction` is
one of the two rules in this pack marked `mechanical` — a validator can run
the substitution without judgment.

**Punctuation (문장부호).** 큰따옴표는 직접 인용, 작은따옴표는 인용 안의
재인용이나 강조. The symbol list itself is fixed by the standard; whether a
given span is a quotation, a re-quotation, or an emphasis is a judgment
call, hence `review_guidance`.

**Standard forms (표준어) and loanword transliteration (외래어 표기법).**
표준국어대사전에 없는 어형은 표준형으로 교정하고, 외래어는 표기법이 정한
한글 형태를 쓴다(카페, 액세서리 — 까페, 악세사리가 아니라). Both require
per-word lookup against a large reference, so both are `review_guidance`.

What none of these rules do: they say nothing about whether a sentence is
well-formed *as writing*. A perfectly spelled, correctly spaced sentence can
still be bad Korean. That is the next layer.

---

## 2. Native fluency layer — what a fluent writer actually produces

This is the empirical core of the pack, and the largest section by rule
count (13 of 35). Every rule here is marked `holdout_result: not_yet_tested`
and none carries `evidence_refs` yet — these are phenomena named from
`editorial/voice.md` §5/§12 and from the diagnostic vocabulary of Korean
plain-language guidance (adapted, not adopted as that guidance's authority —
see §2 note below), not yet corpus-validated across sources.

**번역투 (translationese) as connective scaffolding.** The failure is not
any individual English-derived phrase — it is narrating the *structure* of
an argument instead of making the argument:

> 번역투: 이러한 관점에서 볼 때, 위의 논의는 다음과 같은 함의를 갖는다.
> 자연스러움: 위 논의는 [구체적 함의]로 이어진다.

If the relationship between two sentences is already clear from what they
say, the scaffolding sentence is doing nothing but announcing that a
relationship exists.

**이중피동 (double passive).** Korean piles a second passive marker onto an
already-passive verb — '잊히다' (already passive) becomes '잊혀지다' (passive
+ '-지다' again):

> 이중피동: 그 사실은 이미 잊혀졌다.
> 단일피동/능동: 그 사실은 이미 잊혔다. / 사람들은 그 사실을 이미 잊었다.

This diagnosis is borrowed from 국립국어원's 공공언어 guidance, which governs
public administrative documents, not editorial writing generally. The JSON
deliberately leaves `authority_ref` empty on this rule (and on the two
nominalization rules below) for that reason: the *diagnosis* is useful
everywhere double passives occur, but the *authority* behind the diagnosis
does not extend past the documents it was written for. Using it here is
this pack's own empirical claim, not that guidance's jurisdiction widening.

**과잉 명사화 (excessive nominalization).** '~것이다', '~함', '~에 대한'
chains erase which noun is doing what to which:

> 명사화 과다: 정책 변화에 대한 대응 방안 마련이 필요함.
> 동사 중심: 정책이 바뀐 만큼 어떻게 대응할지 마련해야 한다.

**조사 misuse.** 은/는 marks topic, 이/가 marks focus; swapping them changes
what a sentence is claiming to be about, not just its grammaticality. 에
marks a static point, 에서 marks where an action happens — these are not
interchangeable prepositions with one Korean equivalent each.

**주어/화제 생략 (subject/topic omission) — this one is `adopt`, not
`avoid`.** English requires an explicit subject in nearly every clause;
Korean drops it whenever context makes it obvious. Writing that supplies a
subject in every sentence because "that's what a sentence needs" is
importing English syntax wholesale:

> 번역투: 그는 회의에 참석했다. 그는 발표를 했다. 그는 질문에 답했다.
> 자연스러움: 그는 회의에 참석해 발표하고 질문에 답했다. (or drop 그는 entirely
> once established)

**접속 부사 (연결어) 남용.** '따라서', '그러나', '또한' repeated at the start
of successive paragraphs narrates the shape of the argument instead of
carrying it. Cut the connective where the relationship is already legible
from the content.

**피동/사동 남용.** Passive and unnecessary causative forms obscure who is
doing what — '~시키다' attached to a verb that already means the same thing
without it is the commonest case ('교육시키다' where '교육하다' already
means to educate someone).

**관형절 stacking.** Nesting two or more modifying clauses onto one noun
pushes the subject and predicate of the outer sentence apart until the
reader has to hold too much in working memory. Split the sentence instead
of stacking further.

**~적(的) suffix pileup.** '효과적인 전략적 대응이 본질적으로 필요하다' —
each individual '~적' is fine; three in one clause reads like a translated
policy memo. Prefer native predicates or a different part of speech for at
least one of them.

**의 possessive chaining.** '정부의 정책의 방향의 전환' stacks three
possessives where a single restructured clause reads faster: '정부가
정책의 방향을 바꾸는 것'.

**종결어미 단조로움 (predicate-final monotony) — `adopt` the fix, not
`avoid` the pattern.** A paragraph where every sentence ends '~이다' or
'~하다' reads flat regardless of content. Vary sentence-final form where the
meaning supports it — a quoted judgment, a different verb class, a question
where a question is actually being asked.

**중복 표현 (redundant expression).** The '역전 앞' class: '결과가 나온
결과', '남은 여생', '과반수 이상' double-encode one concept in two
morphemes. Say it once.

**Do not copy: formulaic translated-abstract openers.** '이러한 맥락에서
볼 때', '이와 같은 관점에서' are recognizable as machine-translation-adjacent
academic-abstract phrasing. This is the pack's first `do_not_copy` verdict:
even where a piece of writing that used this phrase is otherwise well
edited, the phrase itself is not craft evidence to reproduce — it is a
recognizable tic to avoid, per the anti-imitation principle in
`LANGUAGE-QUALITY-ARCHITECTURE.md` §6.

---

## 3. Register layer — genre convention, not audience adaptation

These five rules are scoped by `content_types` only, never by `audiences` —
a newsroom lead convention does not become gentler or harsher because a
piece is written for a child; it either belongs to the news genre or it
does not.

**뉴스 리드 (news lead): fact first.** A Korean news lead states what
changed before it explains why. Opening with background is a structural
defect in this genre, independent of whether the background sentence is
itself well written:

> 배경 우선 (지양): 그동안 논의되어 온 정책 변화가 마침내 시행되었다.
> 사실 우선: 정부가 [구체적 정책]을 오늘부터 시행했다. 이는 [배경]에 따른
> 조치다.

**인용/출처 배치 (attribution placement).** Korean news convention puts the
speaker after the quoted content, not before it: '~라고 밝혔다' /
'~에 따르면' close the sentence rather than open it. Leading with the
speaker's name and title before any content reads like a translated wire
lede, not a Korean one.

**보고서의 불확실성 표현 (report hedging).** Where a news lead states what
happened, an institutional report states what is not yet certain, using a
narrow, recognizable set of hedges — '~로 보인다', '~가능성이 있다', '~로
추정된다' — rather than a flat declarative that overstates confidence. This
is drawn from Bank of Korea and similar published-report register as
`EMPIRICAL_REFERENCE`: evidence of how the genre phrases uncertainty, not a
normative claim about correctness.

**개조식 vs 서술식 (outline vs. narrative form).** A Korean institutional
report's summary and table of contents are conventionally outline-form —
noun phrases, no終결 verb — while the analytical body is full narrative
sentences. Mixing the two within the same section reads as unedited, not
as a stylistic choice.

**보고서의 명사형 압축 (bare-noun compression) — `holdout_result: improved`,
the pack's one clean promotion so far.** A report's forecast or trend-summary
clause may close on a bare noun instead of a predicate ('...확대 전망',
'...성장 견인'). The compression is licensed only when it marks the clause's
status as forecast rather than observed fact — the same device on an already-
observed fact is a defect, not a stylistic choice. SUE-604's holdout draft
(an unseen topic, KDI/KIET's discovery/holdout pair never touched it) showed
the device denser and better placed than on the tuned topics, including one
boundary case in the holdout itself where the same document closed an
observed-fact clause with a full predicate rather than compressing it —
exactly the selectivity the rule asks for. `application_mode: soft_detector`:
promotion on `holdout_result` changes what the pack knows about the rule, not
what the rule is allowed to do — GENRE_CONVENTION rules stay capped below
`hard_local_correction` regardless (§0).

None of these five generalize past the genre they were observed in. A news
lead convention does not migrate into research writing, and a report's
hedging vocabulary does not migrate into news.

---

## 4. Audience layer — reading level, not a genre of its own

`child` is not a content type in this system — see
`LANGUAGE-QUALITY-ARCHITECTURE.md` §3. These six rules are scoped by
`audiences: ["child-upper-elementary"]` only, and compose with *whichever*
genre a piece actually is: a news piece for a 10-year-old still opens with
the fact, per §3 above; it simply uses simpler vocabulary and shorter
sentences to say it.

**All six carry `application_mode: upstream_guidance` or `local_observation`
as of SUE-610 (§0), never `soft_detector` or `hard_local_correction`.**
Audience adaptation — how a piece is framed and sequenced for a reader, not
how a sentence is locally repaired — is Audience/Transformation work. SUE-604's
independent evaluation found the concrete case for this: the polish layer
re-authored a term gloss and a causal simplification in a child draft that
generation had already framed correctly, and one of those rewrites turned a
hedged interpretation ("이자율이 오르는 것과 … 망할 위험이 커지는 것은 서로
다른 이야기야") into an unhedged general claim the source does not make. That
is not a defect a local polish edit should ever have had the authority to
introduce.

**어휘 등급 (vocabulary tier).** The pack uses 국립국어원's 2024 corpus-based
5-tier graded vocabulary list as a proxy for lexical basicness, preferring
tier 1–2 words. This is stated as a proxy deliberately: the list's tiers
reflect acquisition/frequency order in a national corpus, not a validated
mapping to any specific reader age. Applying it to "age 10–12" is this
pack's own interpretive step — the authority registry says so explicitly,
and this document repeats the caveat rather than letting the citation imply
more precision than exists.

**문장 길이 (sentence length).** One idea per sentence; a compound idea
becomes two sentences rather than one sentence with two subordinate
clauses. This mirrors the "short conceptual steps" principle already stated
in `editorial/profiles/audience/child-upper-elementary.json`, applied at
the sentence level specifically.

**한자어 대 고유어 (Sino-Korean vs. native vocabulary) —
`application_mode: local_observation`.** Prefer native Korean words over
Sino-Korean equivalents where both exist and mean the same thing (가능하다
stays; a term like 유동성 gets glossed immediately rather than assumed).
This is not a ban on 한자어 — plenty of concepts have no native alternative —
it is an ordering preference when a real choice exists. Of the six audience
rules this is the one with no multi-source corpus support behind it at all
(its own rationale says so) and no SUE-604 evaluation coverage either way,
so SUE-610 leaves it at `local_observation` rather than `upstream_guidance` —
observed, not yet supported enough to act on.

**구체 우선, 추상은 그 위에 (concrete before abstract).** When introducing an
abstract concept to a child reader, lead with a scene or native-word image
the child already has and layer the term on top of it — not the reverse. A
한자어 term may be explained through its component characters when that
yields a picture rather than a definition. Discovered in 어린이경제신문 and
confirmed independently on 한국은행's 초등용 material via a different device
(a sustained family narrative frame); 기획재정부's material defines the term
first and is recorded as the counter-example that marks this rule's boundary.
SUE-604's evaluation found no measurable delta from this rule on the two
pilot child drafts — both baselines already opened concrete-first before the
calibration existed — but the unseen-topic holdout draft is the cleanest
execution in the whole evaluation (a crane on an empty lot, before
인허가/착공/준공 are named). Untested by delta, demonstrated by execution.

**'어린이용' 표지는 그 자체로 조정의 증거가 아니다.** The fact that a piece is
labelled for children is not evidence it was actually adapted for children.
Two independent government sources (기상청 어린이 기상교실, 국립생물자원관
어린이 자료) were found defining phenomena by professional diagnostic
criteria — numeric thresholds, classification schemes — inside material
labelled for children, which is the *opposite* of the baby-talk failure the
audience profile's own anti-patterns anticipate. Recorded as a separate rule
because the profile did not anticipate this direction of failure. Applies
equally to how a Writer selects a reference for a child piece: judge the
actual register, not the label.

**Keeping uncertainty without sounding adult-written.** The report-register
hedges above ('~로 추정된다') are adult institutional vocabulary. A child
piece keeps the same *degree* of uncertainty — it does not upgrade "might"
into "will" for simplicity — but renders it in words a ten-year-old already
uses: "아직 확실하지 않아요" rather than "~로 사료된다." Simplifying the
wording must never simplify the truth-value underneath it; that boundary is
already stated as an anti-pattern in the audience profile itself and this
rule exists to keep the language layer from being the place that boundary
quietly breaks.

---

## 5. Domain terminology layer — rendering policy, not translation policy

`editorial/voice.md` §1 states the principle: the test for whether a term
stays in English is not "can this be translated" but "which form would a
practitioner in this field reach for without mentally translating." This
pack's two domain-terminology rules apply that test specifically:

- Where practice has settled on the English form (`gross margin`,
  `inference`, `RAG`), the pack keeps it, and the terminology table below
  marks that policy explicitly rather than leaving it to a Writer's
  judgment call each time.
- Where 국립국어원's 다듬은 말 (refined-word) list proposes a Korean
  substitute for an imported term, that substitute is a recommendation, not
  a mandatory replacement — the list itself is `STRONG_GUIDANCE`, not a
  standard, and does not override established domain usage.

---

## 6. Owner voice layer — two rules, both traceable to voice.md

`OWNER_PREFERENCE` sits below normative correctness and below native
fluency in the precedence order — an owner preference cannot make incorrect
Korean correct, and cannot override a genuine fluency defect. This pack
carries exactly two owner-voice rules, both lifted from constructions
`editorial/voice.md` already marks as *preference* or *observed tendency*,
not invented here.

**Avoid the "A와 B는 다른 문제다" contrast formula — `do_not_copy`.**
`voice.md` §3 observes that published writing separates casually conflated
concepts, and immediately warns against turning that into a repeated
formula: "A와 B는 다른 문제다", "X와 Y는 동일하지 않다", "중요한 것은 A가
아니라 B다" used more than once in nearby paragraphs make the writer's
habit visible instead of the argument. The construction is not
grammatically or generically wrong — it is a recognizable signature move,
which is exactly what `do_not_copy` is for.

**No stock openings or closings.** `voice.md` §8 and §9 already name banned
openings ("최근 ~가 화두다", "바야흐로") and banned closings ("결론적으로
살펴본 바와 같이", "앞으로가 기대된다"). This rule carries that list into the
language pack rather than inventing a new one — the check is a literal
phrase match, which is why it is the one owner-voice rule marked
`mechanical`.

---

## 7. Terminology table — what changes with audience, what does not

The JSON's `terminology[]` records the canonical concept for each term, its
default rendering policy, and — for three finance terms so far — an
audience alias for `child-upper-elementary`. An alias changes the *words*,
never the *referent*:

> canonical: 국채 금리
> child alias: "나라가 돈을 빌릴 때 내는 이자" (gloss required)

The alias is a plain-language gloss of the same concept, not a simpler
concept standing in for it. An alias that quietly names something else — "나라가
돈을 버는 방법" for 국채 금리, say — would not be an audience adaptation; it
would be a `domain_terminology` defect, because the reader now holds a
wrong concept expressed in easy words instead of the right concept
expressed simply.

---

## 8. What this pack does not decide

Per `not_authoritative_for` in the JSON: this pack has no authority over
whether a claim is true, over any language other than Korean, over whether
something gets published, or over owner taste beyond what `voice.md`
already records. It also does not define what a genre or an audience *is*
— those definitions live in `editorial/profiles/content/*.json` and
`editorial/profiles/audience/*.json` respectively; this pack only adds the
Korean-language overlay on top of them.
