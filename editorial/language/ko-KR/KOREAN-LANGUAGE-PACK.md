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

**Status: draft.** Every empirical rule below (`native_fluency`,
`register`, `audience`) carries `holdout_result: not_yet_tested` in the
JSON. Nothing in this pack has been validated against material it was not
derived from. That validation is SUE-604's job. Claiming `active` before
then would assert something false about how much is actually known.

The authority registry this pack draws on is
`references/korean-language-authorities.md`. Every `authority_ref` in the JSON
resolves to an entry in the pack's own `authorities[]`, and that is checked
mechanically (`scripts/validate-language.mjs`). The onward correspondence
between those entries and the registry document was verified by hand and is
**not** machine-checked: the registry is prose and carries no ids. This
document does not re-derive the registry; it explains what each cited
authority is used for.

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
count (13 of 32). Every rule here is marked `holdout_result: not_yet_tested`
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

These four rules are scoped by `content_types` only, never by `audiences` —
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

None of these four generalize past the genre they were observed in. A news
lead convention does not migrate into research writing, and a report's
hedging vocabulary does not migrate into news.

---

## 4. Audience layer — reading level, not a genre of its own

`child` is not a content type in this system — see
`LANGUAGE-QUALITY-ARCHITECTURE.md` §3. These four rules are scoped by
`audiences: ["child-upper-elementary"]` only, and compose with *whichever*
genre a piece actually is: a news piece for a 10-year-old still opens with
the fact, per §3 above; it simply uses simpler vocabulary and shorter
sentences to say it.

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

**한자어 대 고유어 (Sino-Korean vs. native vocabulary).** Prefer native
Korean words over Sino-Korean equivalents where both exist and mean the
same thing (가능하다 stays; a term like 유동성 gets glossed immediately
rather than assumed). This is not a ban on 한자어 — plenty of concepts have
no native alternative — it is an ordering preference when a real choice
exists.

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
