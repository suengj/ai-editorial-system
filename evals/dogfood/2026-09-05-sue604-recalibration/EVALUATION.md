# SUE-604 — independent language-quality evaluation

Evaluator: independent reviewer. Did not write, commission, or review any of
the fifteen drafts. Read-only pass over both repositories; nothing was edited
except this file.

---

## 1. Method

**Read, in the AES repo:**
`docs/architecture/LANGUAGE-QUALITY-ARCHITECTURE.md` (all of it, §7 and §8
authoritative over this document), `editorial/profiles/language/ko-KR.json`
(all 35 rules, dumped and read in full), `benchmarks/KOREAN-LANGUAGE-CORPUS.md`,
`editorial/voice.md` §5 and §12, `editorial/profiles/audience/child-upper-elementary.json`,
`editorial/feedback-routing.json` (layer definitions, `owns` / `do_not` blocks),
and the reference-evaluation directory listing under `references/evaluations/`.

**Read, in suengj-com (`sue-604-korean-recalibration-review`):** all six
BEFORE drafts, all six AFTER drafts, all three holdout drafts, and — because
claim status had to be checked against something — the two canonical views
`content/views/companies-become-like-the-tools-they-use.md` and
`content/views/japan-us-global-bond-selloff.md`, plus the conclusion of
`content/views/seoul-housing-starts-completions-lag.md`.

**Compared against:** the four corroborated traits in
`KOREAN-LANGUAGE-CORPUS.md` §4, the negative audience finding in §5
(the 기상청 / 국립생물자원관 "labelled child ≠ adapted for child" pattern), the
`do_not_copy` list in §6, and the `NATIVE_QUALITY` rules in the pack. I did not
re-read the source articles behind the reference evaluations — they are
pointer-only and not stored — so my comparison is against the extracted traits
as recorded, not against the underlying Korean.

**Counting.** Where I claim a device is denser or sparser in one draft than
another, I counted occurrences mechanically (hedge predicates, sentence-final
bare nouns, attribution verbs, `~적` suffix, `~의` chains) rather than
estimating. Counts are reported where they carry the argument.

**Limits of my judgement — stated plainly.** I am a model assessing Korean, not
a native human editor. On `normative_correctness` I can check the mechanically
decidable rules (particle attachment, 되/돼, obvious spacing) and I did; on the
`review_guidance` normative rules and on most of `native_fluency` my verdict is
a model's reading of idiomaticity, which is exactly the kind of confident wrong
verdict `LANGUAGE-QUALITY-ARCHITECTURE.md` §11 warns about. Where I say a
construction is stiffer, that is a judgement a human Korean editor could
overturn. I have marked the two places where my own confidence is low rather
than smoothing them into verdicts.

**Per the evaluation contract:** no dimension is totalled or averaged.
`owner_voice_fit` is `UNKNOWN` on all fifteen drafts — no human has expressed a
preference on any of them, and `editorial/voice.md` records the voice, not a
verdict on this text. Every other verdict below carries a quoted span.

**One cross-cutting observation, out of scope but recorded once.** All six
AFTER drafts delete the image and figure caption their BEFORE carried
(`tools-news-diagram.svg`, `tools-report-infographic.svg`,
`tools-child-concept.svg`, `news-jp-us-10y-divergence.svg`,
`report-repricing-vs-crisis-matrix.svg`, `child-rate-vs-worry-bars.svg`).
That is not a language dimension and I do not score it. It does mean the pairs
are not strictly like-for-like as delivered artifacts, and in one case
(`bonds-child`) the deleted caption carried a stated-uncertainty span —
"막대 높이는 정확한 눈금이 아니라 … 크게 보여주기 위한 그림이에요" — which
now exists nowhere in the AFTER draft.

---

## 2. Per-pair BEFORE → AFTER

### 2.1 tools-news

| Dimension | BEFORE | AFTER |
|---|---|---|
| semantic_integrity | PASS | PASS |
| normative_correctness | PASS | PASS |
| native_fluency | FAIL | PASS |
| genre_fit | PASS | PASS (with one caveat below) |
| audience_fit | PASS | PASS |
| domain_terminology_fit | PASS | PASS |
| owner_voice_fit | UNKNOWN | UNKNOWN |

**native_fluency — changed, FAIL → PASS.** BEFORE narrates its own argument
structure: "**뉴스거리는 사건이 아니라 관점이다.** 그래서 "왜 지금이냐"는
질문에는 "이런 일이 막 일어났다"가 아니라 "이 틀로 보면 지금 벌어지는 일이
설명된다"가 답이다." AFTER collapses it to "여기서 뉴스거리는 사건이 아니라
관점 자체다." — `nq-translationese-connective-scaffolding` and
`nq-connective-adverb-overuse`; also `editorial/voice.md` §12 "logic narration".
Second instance: BEFORE "이것은 검증된 사실이 아니라 필자 한 명의 해석이다 —
데이터로 증명된 인과관계가 아니라, 유비를 통해 지금의 변화를 설명하려는
시도라는 뜻이다" (the "…라는 뜻이다" gloss restating the sentence just given)
→ AFTER "데이터로 증명된 인과관계가 아니라 유비로 지금의 변화를 설명하려는
시도이며, 필자 한 사람의 해석이라는 점은 이 글에서도 바뀌지 않는다."
`nq-excessive-nominalization` / `nq-subject-topic-omission`.

**semantic_integrity — unchanged PASS, and one improvement worth naming.**
c1 is quoted in AFTER as "스프레드시트가 계산을 프로그래밍 가능하게
만들었다면, AI는 업무 자체를 프로그래밍 가능한 대상으로 만들고 있다" — that is
verbatim the canonical `claims[].text` for c1. BEFORE paraphrased it as
"스프레드시트가 숫자를 프로그래밍 가능하게 만들었다면" (숫자, matching the
canonical body prose but not the claim record). Both are defensible; AFTER is
tighter to the claim contract. c2 and c3 are marked as interpretation in both
("이 역시 확인된 결과가 아니라 저자의 해석이다"; "이 문장 역시 결론이 아니라
해석이다").

**genre_fit — caveat, not a downgrade.** AFTER doubles the attribution verbs
(3 → 6: 짚는다 ×2, 지적하며, 우려한다, 못 박는다, 본다) on a piece whose
"speaker" is a written View, not a person who said anything. "필자는 …
지적하며 … 짚는다" is the `reg-news-attribution-placement` nesting shape applied
to a document. It is not wrong — Korean newsrooms attribute to documents — but
see §4.

**Unchanged:** normative_correctness, audience_fit, domain_terminology_fit.
Nothing in either draft violates a NORMATIVE rule I can check, both are pitched
at the same general reader, and both keep 스프레드시트 / AI / CRM in the same
forms.

### 2.2 tools-report

| Dimension | BEFORE | AFTER |
|---|---|---|
| semantic_integrity | PASS | PASS |
| normative_correctness | PASS | PASS |
| native_fluency | FAIL | PASS |
| genre_fit | PASS | PASS |
| audience_fit | PASS | PASS |
| domain_terminology_fit | PASS | PASS |
| owner_voice_fit | UNKNOWN | UNKNOWN |

**native_fluency — changed, FAIL → PASS.** The clearest single repair in the
whole set: BEFORE "이 구분 — 원인이 아니라 촉매/실행 비용 인하 — 은 이 리포트의
나머지 논증 전체가 기대는 지지대이므로, 다음 절에서 반드시 다시 등장한다."
"이 구분은" is named verbatim in `editorial/voice.md` §5 as the mechanical
translation of *This distinction …*. AFTER: "원인이 아니라 촉매였다는 이
구분에 이 리포트의 나머지 논증이 기대고 있으므로, 다음 절에서 다시 등장한다."
Rule: `nq-translationese-connective-scaffolding`. Supporting count: `~적`
occurrences fall 15 → 12 (`nq-jeok-suffix-pileup`), e.g. BEFORE "**질적으로 다른
지점 하나는 명시할 가치가 있다.**" → AFTER "질적으로 다른 지점도 하나 있다."

**genre_fit — changed, and this is the one I am least sure about.** AFTER adds
a bullet that did not exist in BEFORE: "이 흐름이 이어질 경우 agent
identity·permission·audit trail·policy·evaluation 같은 통제 계층 도입 확대
전망 — 다만 이는 원문의 전망일 뿐 이미 관측된 변화가 아니다." This is
`reg-report-bare-noun-compression` executed correctly by the letter of the rule
— it closes on the bare noun 전망 on a genuine forecast clause, not on an
observed fact, and the canonical view does carry the content
("결국 기업은 agent identity, permission, audit trail, policy, evaluation 같은
새로운 통제 계층을 필요로 하게 될 가능성이 높다"). So integrity holds. But the
device arrives as a *new sentence inserted into an uncertainty list*, not as a
compression of prose that was already there. A rule that adds content to
demonstrate itself is a different thing from a rule that improves the language
already present. Recorded, not scored as a failure.

**semantic_integrity — unchanged PASS.** All three claims stay interpretation
in both: "c1, c2, c3 모두 `kind: interpretation`이다" is preserved verbatim.
AFTER softens c2's rendering from "더 centralized해질 수 있다" to "더
centralized해질 가능성이 있다" — same modal status, slightly more explicit; and
adds a hedge to a described mechanism ("범위는 넓어질 것으로 보인다" where
BEFORE had "범위가 넓어진다"). That second one hedges the *source's* mechanism
rather than the report's own judgement, which is a small over-application of
`reg-report-hedge-language`, not an integrity change.

**Unchanged:** normative_correctness, audience_fit, domain_terminology_fit.
Both keep the practitioner English (`span of control`, `shadow workflow`,
`discount-rate shock`) per `dom-practitioner-usage-retention`.

### 2.3 tools-child

| Dimension | BEFORE | AFTER |
|---|---|---|
| semantic_integrity | PASS | PASS |
| normative_correctness | PASS | PASS |
| native_fluency | PASS | PASS |
| genre_fit | PASS | PASS |
| audience_fit | PASS | PASS |
| domain_terminology_fit | NOT_APPLICABLE | NOT_APPLICABLE |
| owner_voice_fit | UNKNOWN | UNKNOWN |

**Nothing changed on any dimension.** This is the honest result and it matters
for §4. The AFTER is a lighter edit: bold emphasis stripped (BEFORE
"**질문 하나를 더 하는 것 자체가 시간과 돈이 드는 일**이었던 거지." → AFTER
"질문 하나를 더 던지는 것 자체가 시간과 돈이 드는 일이었어."), two reader-
handholding sentences deleted ("이것도 이 사람의 생각인데, 좀 헷갈릴 수 있으니
천천히 짚어보자.", "여기까지만 들으면 AI가 사람을 자꾸 숫자로만 보는 나쁜
도구처럼 들릴 수 있어."), and 보조용언 spacing regularised
("계산해주는" → "계산해 주는", "정해줘야" → "정해 줘야"). That last one is
**churn, not a fix**: `norm-auxiliary-verb-spacing` states explicitly that both
forms are permitted and that flagging either as an error is the actual defect
the rule guards against. The AFTER is also not internally consistent about it
("바꿔놨어" stays joined).

**audience_fit — unchanged PASS, and the reason is important.** BEFORE already
opened concrete-first: "너희 반에서 학급 문고 예산을 짠다고 생각해보자.
"책을 3권 더 사면 얼마가 남을까?"" before any mention of 표 계산 프로그램.
`aud-concrete-before-abstract` had nothing left to repair here.

**semantic_integrity — unchanged PASS.** Uncertainty survives in both:
"이것도 아직 확인된 사실이 아니라 그럴 수도 있다는 추측이야." Register is 해체
throughout, neither baby-talk nor unadapted specialist prose — it does not
reproduce the 기상청/국립생물자원관 failure the corpus §5 records.

### 2.4 bonds-news — **the one net regression**

| Dimension | BEFORE | AFTER |
|---|---|---|
| semantic_integrity | PASS | PASS |
| normative_correctness | PASS | PASS |
| native_fluency | PASS | FAIL |
| genre_fit | PASS | PASS |
| audience_fit | PASS | FAIL |
| domain_terminology_fit | PASS | PASS |
| owner_voice_fit | UNKNOWN | UNKNOWN |

The bonds writer's own note — that this baseline "wasn't badly broken to begin
with" — is **correct**, and the AFTER did not improve it. Three specific
regressions:

**(a) audience_fit — FAIL. A concrete agent was deleted by over-applying
`nq-subject-topic-omission`.** BEFORE: "이 조합은 보통 "돈을 빌려주는 사람들이
기업 부도 위험을 새로 걱정하기 시작했다"는 신호가 아니라…". AFTER: "이런
조합은 흔히 "기업 부도 위험을 새로 걱정하기 시작했다"는 신호가 아니라…". The
rule licenses omission only "문맥상 주어나 화제가 명백할 때". In a
general-reader brief this is the first and only mention of *who* does the
worrying; 돈을 빌려주는 사람들 was the sentence's one plain-language handhold and
it is now gone. Grammatical, less informative.

**(b) native_fluency — FAIL. An idiomatic construction was replaced by a
stiffer one.** BEFORE: "국채금리는 높은 채 그대로인데 신용스프레드는 벌어지지
않았다는 뜻이다." AFTER: "국채금리는 높은 채로 유지됐지만 신용스프레드는
벌어지지 않았다." `유지되다` is an agentless 되다 predicate where BEFORE had the
native `그대로이다`; `nq-passive-causative-overuse` says 능동형을 기본으로 한다.
This is the "removed a defect and introduced a stiffer construction" pattern —
except no defect was removed. (Confidence: medium. A human editor might read
유지됐지만 as ordinary financial-news register.)

**(c) native_fluency — a lost anaphor rewritten as a restatement.** BEFORE:
"이 구분에 가장 중요한 신호는 회사채 신용스프레드다." AFTER: "채권시장 위기와
정상적인 재가격을 가르는 신호는 회사채 신용스프레드다." The preceding sentence
already set up exactly that pair ("위기 신호인지, 아니면 … 정상적인 재가격인지").
Repeating both terms one sentence later is redundancy, and it is the opposite
of what `nq-subject-topic-omission` asks for. Note the internal inconsistency
with (a): the same pass omitted a subject that was needed and re-stated a topic
that was not.

**genre_fit — unchanged PASS, but with the sharpest instance of the attribution
problem.** BEFORE: "원문 분석(2026-09-02)은 이 상황을 "채권시장 위기"가 아니라
"글로벌 term premium의 재가격"으로 해석했다." AFTER: "원문 분석(2026-09-02)은
이런 흐름을 두고 "채권시장 위기라기보다 글로벌 term premium의 재가격"이라며,
신용스프레드가 장기금리만큼 급격히 벌어지지 않은 점을 근거로 들었다." Two
things happened. The added grounds are **faithful** — the canonical view says
"신용스프레드가 장기금리 상승만큼 급격히 벌어지지 않았기 때문이다" — so
semantic_integrity holds, and the AFTER is better grounded. But the
`~이라며 … 근거로 들었다` nesting wraps a **constructed** string in quotation
marks: the canonical text reads "채권시장 붕괴"보다 … 재가격, not
"채권시장 위기라기보다 … 재가격". Applying the corroborated speech-attribution
form to a document upgraded a loose concept-label quote into what reads as a
verbatim quotation of the source. `norm-quotation-attribution-punctuation`
governs which marks; nothing in the pack governs whether marks may enclose a
paraphrase, and that gap is now load-bearing.

**semantic_integrity — PASS.** Every figure, date, footnote id and the
"확인되지 않은 부분" section are identical between the two drafts. No claim
status changed.

### 2.5 bonds-report

| Dimension | BEFORE | AFTER |
|---|---|---|
| semantic_integrity | PASS | PASS |
| normative_correctness | FAIL | PASS |
| native_fluency | FAIL | PASS |
| genre_fit | PASS | PASS |
| audience_fit | PASS | PASS |
| domain_terminology_fit | FAIL | PASS |
| owner_voice_fit | UNKNOWN | UNKNOWN |

The strongest pair in the set — three dimensions genuinely repaired, each with
an unambiguous span.

**normative_correctness — FAIL → PASS.** BEFORE heading: "## 캐버트와
불확실성". 캐버트 is not a 외래어 표기법 form of *caveat* and is not in
표준국어대사전; it is an ad-hoc transliteration. AFTER: "## 한계와 불확실성".
Rule: `norm-loanword-transliteration` (the repair happens to eliminate the
loanword entirely, which the rule permits but does not require).

**domain_terminology_fit — FAIL → PASS.** BEFORE: "원문의 가장 falsifiable한
주장". AFTER: "원문에서 가장 반증 가능한 주장". This is
`dom-practitioner-usage-retention` applied in the *correct* direction: the rule
retains English where practitioners actually reach for English (term premium,
credit crisis, OAS — all correctly kept in AFTER), and 반증 가능성 is standard
Korean that no analyst re-translates. BEFORE's `-한` suffix on an English
adjective was English retained because it looked technical —
`editorial/voice.md` §12 "terminology mismatch".

**native_fluency — FAIL → PASS.** Two de-nominalisations. BEFORE: "이 표의
관찰 가능성이 이 분석 전체의 핵심이다." → AFTER: "이 표가 실제로 힘을 갖는
이유는 두 시나리오가 관찰로 바로 갈린다는 데 있다." And BEFORE: "신용위험에
대한 재평가가 아니다." → AFTER: "신용위험을 다시 매긴 결과가 아니다."
(`nq-excessive-nominalization` — the rule names `~에 대한` explicitly).
`~적` count 4 → 2.

**genre_fit — changed, PASS → PASS.** `reg-report-bare-noun-compression` fires
once: BEFORE "다음 BOJ 회의와 JGB 입찰 결과가 이 질문에 더 직접적으로 답할
것이다." → AFTER "다음 BOJ 회의와 JGB 입찰 결과에서 더 분명한 답이 나올 전망."
Correctly scoped — it is a forecast clause, not an observed fact, which is the
boundary condition KIET established. One instance in a 10KB report.

**semantic_integrity — PASS, with one wording note.** The Bottom line was
rewritten from "이번 재확인은 전자는 참, 후자는 부분적으로 갱신되었다는 것을
보여준다" to "분석의 스파인은 참으로 확인됐다. 그 스파인을 처음 뒷받침했던
개별 수치 하나만 사흘 사이 바뀌었을 뿐이다." That reads as slightly more
assertive ("부분적으로 갱신" → "하나만 … 바뀌었을 뿐"), but the table above it
shows exactly one moved row and four confirmed, so the stronger phrasing is
supported by the draft's own evidence. Not an integrity finding.

### 2.6 bonds-child — **a semantic_integrity regression**

| Dimension | BEFORE | AFTER |
|---|---|---|
| semantic_integrity | PASS | **FAIL** |
| normative_correctness | PASS | PASS |
| native_fluency | PASS | PASS |
| genre_fit | PASS | PASS |
| audience_fit | PASS | FAIL |
| domain_terminology_fit | PASS | PASS |
| owner_voice_fit | UNKNOWN | UNKNOWN |

**semantic_integrity — PASS → FAIL. An interpretation became a general fact.**

BEFORE: "여기서부터가 이 글에서 제일 조심해야 하는 부분이야. **이자율이
오르는 것**과 **은행이나 회사가 망할 위험이 커지는 것**은 서로 다른
이야기야."

AFTER: "이자율이 오른다고 해서 은행이나 회사가 망할 위험이 커지는 건 아니야."

These are not the same statement. BEFORE distinguishes two phenomena — the
canonical view's actual position ("현재는 credit crisis로 보기 어렵다.
신용스프레드가 장기금리 상승만큼 급격히 벌어지지 않았기 때문이다" — a
*present-tense, evidence-conditioned* reading). AFTER asserts a general,
unhedged causal denial: rate rises do not raise default risk. That is a claim
the canonical source does not make and would not survive its own next
paragraph, which explains that credit spreads *are* the thing to watch and
could widen. It is also delivered flat to a ten-year-old, with the "제일
조심해야 하는 부분" warning that framed it removed. Per
`child-upper-elementary.json` `anti_patterns`: "Lowering factual accuracy or
dropping stated uncertainty in exchange for simplicity". Per
`aud-uncertainty-child-register`: "확실성의 정도 자체를 낮추거나 높이지
않는다". Integrity dominates — no fluency gain in this draft offsets it.

**audience_fit — PASS → FAIL, second span.** AFTER adds "그러니까 **국채
금리**란, 나라가 돈을 빌릴 때 내는 이자를 말해." Two problems. The `X란 ~을
말해` shape is precisely the 기획재정부 어린이 경제교실 form the corpus §4.4
records as the *negative* instance defining the edge of
`aud-concrete-before-abstract` — a near-dictionary definition. Here it at
least follows the concrete explanation rather than preceding it, so the
sequencing rule is not violated; but it introduces the term 국채 금리, which
appears **nowhere else in the draft** (the draft says 이자율 throughout). A
glossed term the reader never meets again is added terminology load with no
payoff.

**A third, smaller change, in the right direction.** BEFORE "물가(인플레이션)"
→ AFTER "물가(물건 값이 시간이 지나면서 오르는 정도)" — a genuine
`aud-hanja-to-native-preference` / `aud-vocab-tier-basic` improvement, and the
referent is unchanged, which is what `LANGUAGE-QUALITY-ARCHITECTURE.md` §2
requires (audience may change the surface word, never the concept). Worth
noting that the canonical term 인플레이션 is now absent entirely, so the
audience-alias → canonical-concept mapping exists only in the reader's head.

**Unchanged:** normative_correctness, native_fluency (the 해체 register, the
"국채" money-lending scene, the three-cause list are near-identical), genre_fit,
domain_terminology_fit.

---

## 3. The three unseen-topic drafts

No baseline exists and none should. Judged on their own.

### 3.1 sue604-housing-news

| Dimension | Verdict |
|---|---|
| semantic_integrity | PASS |
| normative_correctness | PASS |
| native_fluency | PASS |
| genre_fit | PASS |
| audience_fit | PASS |
| domain_terminology_fit | PASS |
| owner_voice_fit | UNKNOWN |

`reg-news-lead-fact-first`: the piece opens on the result, not the background —
"국토교통부의 '26년 7월 주택통계에 따르면, 서울 주택 착공은 올해 1~7월
1만9,507호로 지난해 같은 기간보다 44.4% 늘었다." `reg-news-attribution-placement`
is executed on a **real speaker**, in the corroborated nested shape — speaker
first, a `~하며` paraphrase clause, closing speech verb: "국토교통부는 8월 13일
'주택 신속공급 방안'을 발표하며 9월부터 재건축·재개발 제도 개선 설명회를
시작했다고 밝혔다." Uncertainty is explicit and structural
("## 아직 판단하기 이른 부분"; "이번 통계가 방향을 단정해주지는 않는다").

**One finding against this draft (routed in §5).** Two attributions have no
attributable source: "…1~7월 누적 44.4% 증가가 방향을 보여주는 지표로 더
신뢰할 만하다는 지적이 나온다" and "착공 반등을 공급 부족이 곧 끝난다는
신호로 단정하기는 이르다는 시각도 있다." 지적이 나온다 / 시각도 있다 are
attribution grammar with the speaker slot empty. The draft's own analysis is
being handed to an unnamed third party. That is not a fluency defect — it is
fluent Korean journalese — and it is not what `reg-news-attribution-placement`
asks for either.

### 3.2 sue604-housing-report

| Dimension | Verdict |
|---|---|
| semantic_integrity | PASS |
| normative_correctness | PASS |
| native_fluency | PASS |
| genre_fit | PASS |
| audience_fit | PASS |
| domain_terminology_fit | PASS |
| owner_voice_fit | UNKNOWN |

`reg-report-bare-noun-compression` is present, correctly scoped, and **denser
here than in either pilot AFTER draft** — in the title ("준공 정상화는 시차를
두고 확인될 전망"), in the 요약 (개조식, per `reg-report-outline-vs-narrative`:
"착공 확대가 준공 증가로 이어지는지는 향후 여러 분기에 걸친 확인 필요"), and in
관찰 변수 ("기저효과가 큰 월별 수치보다 분기·반기 단위 유지 여부"). Every
instance sits on a forecast, criterion, or summary clause; the body analysis
uses full predicates. That is the KIET boundary condition honoured.

`reg-report-hedge-language` is present at ten hedge predicates
(풀이된다, 보인다, 판단되며, 평가된다, 가능성이 있다, 배제할 수 없다,
것으로 전망된다, 평가가 나온다, 것으로 판단된다, 모습이다) against one in
`sue604-bonds-report`. **This is at the edge of over-application** and I record
it as an observation, not a FAIL: "착공 증가세가 여러 분기 유지되지 못하고 다시
꺾일 경우, 공급 부족 국면이 예상보다 길어질 것으로 전망된다" stacks a
conditional onto an agentless `~것으로 전망된다` — whose forecast is it? The
report's own. `nq-passive-causative-overuse` says 행위 주체가 분명한데도 피동형으로
주체를 흐리지 않는다. The same applies to "…평가가 나온다."

One bare noun sits slightly outside the rule's stated scope: "누적 준공이 전년
대비 40%대 감소를 유지하는 동안에는 공급 정상화로 보기 어려움" closes on 어려움,
an evaluative judgement rather than a forecast. Inside an 개조식 bullet this is
ordinary report form; against the rule's own wording ("해당 절의 지위가 사실이
아니라 전망임을 명사 자체로 표시할 때에만") it is a mild extension.

### 3.3 sue604-housing-child

| Dimension | Verdict |
|---|---|
| semantic_integrity | PASS (with a stated-uncertainty finding, below) |
| normative_correctness | PASS |
| native_fluency | PASS |
| genre_fit | PASS |
| audience_fit | PASS |
| domain_terminology_fit | PASS |
| owner_voice_fit | UNKNOWN |

**This is the best `aud-concrete-before-abstract` execution in the whole set,
and it is on the unseen topic.** The draft opens on a scene a child has
actually seen — "동네에 새 아파트가 생기는 모습을 본 적 있나요? 어느 날 빈
땅에 커다란 크레인이 서 있어요." — and only then names 인허가 / 착공 / 준공.
Concrete first, term second, exactly the econoi-derived sequencing.

It also gets the `AUDIENCE_CONSTRAINT` > `DOMAIN_TERMINOLOGY` relation right in
the way §2 of the architecture demands: the canonical terms are **kept** and
glossed in plain words ("**착공**: 실제로 공사를 시작하는 날"), so the surface
word is adapted while the referent and its name survive. Contrast
`sue604-bonds-child`, which deleted 인플레이션 outright.

Register is 해요체, is not baby-talk, and does not reproduce the
기상청/국립생물자원관 anti-pattern — no threshold definitions, no unglossed
specialist vocabulary. Uncertainty survives, repeatedly and in child register
per `aud-uncertainty-child-register`: "아직 확실하지 않아요.", "…말하는 것도
성급해요.", "…딱 잘라 말하기는 어려워요."

**Finding (not a FAIL, but recorded).** The causal explanation is stated flat:
"지금 완성되는 집(준공)은 몇 년 전에 공사를 시작한 집이에요. 그런데 몇 년
전에는 서울에서 공사를 새로 시작하는 곳이 적었어요. 그래서 지금 다 지어지는
집도 적은 거예요." — introduced by "이상하게 보이지만 이유는 간단해요." Its
sibling report hedges the same proposition: "현재의 준공 감소는 과거 착공 부진의
결과로 **보인다**." The canonical view does assert it as its own conclusion
("시장이 체감하는 공급은 아직 과거 착공 부진의 결과를 지나고 있다"), so this is
not a claim invented by the child draft, and I do not call semantic_integrity
FAIL. But "이유는 간단해요" is an added confidence marker present in neither the
source nor the sibling, and the three drafts in one batch state the same
proposition at three different confidence levels. That inconsistency is the
finding.

---

## 4. Is the AFTER better because the Korean is better, or because it was rewritten toward the corpus?

**Answer: mostly the former, with one device that fails the test and one draft
that got worse.** The evidence, split by the two tests the brief names.

### Test 1 — do the improvements transfer to the unseen topic?

| Device | Pilot AFTER | Housing holdout | Reading |
|---|---|---|---|
| `reg-report-bare-noun-compression` | 1 instance in `tools-report`, 1 in `bonds-report`, both inserted at the end of an uncertainty list | ~5 instances: title, 요약 bullets, 관찰 변수 bullets, all on forecast/criterion clauses | **Transfers, and is denser and better-placed where it was never tuned.** Not corpus-fitting. |
| `reg-report-hedge-language` | 1 hedge in `bonds-report`, 3 in `tools-report` | 10 hedges | **Transfers — arguably over-transfers.** Not corpus-fitting; a possible over-application finding instead. |
| `aud-concrete-before-abstract` | 0 changes — both child pairs already opened concrete-first in BEFORE | Present and the cleanest instance in the set (crane scene → 인허가/착공/준공) | **Present on the holdout, but with no measured delta anywhere.** Untestable from this run. |
| `reg-news-attribution-placement` | 3 → 6 attribution verbs in `tools-news`, all pointing at a *document*; 0 → 2 in `bonds-news`, wrapping a paraphrase in quote marks | 4 instances: 2 pointing at real speakers (국토교통부, 서울신문) and 2 pointing at nobody (지적이 나온다, 시각도 있다) | **Transfers, and drags a defect with it.** See below. |
| `nq-*` fluency repairs (연결어 내레이션, 명사화, `~적`, 이중피동) | The bulk of the real gains: `tools-report`, `tools-news`, `bonds-report` | Housing drafts show no translationese scaffolding, no `이 구분은`, no `~에 대한` pile-ups, `~적` at ordinary density | **Transfers.** The negative evidence is the point: the defects simply are not there on the unseen topic. |

The core native-fluency work — de-narrating the argument, de-nominalising,
un-stacking `~적` — is not topic-bound and shows up as absence-of-defect on
housing. `reg-report-bare-noun-compression` is not topic-bound either. So the
improvement is **not** primarily corpus-fitting.

The exception is `reg-news-attribution-placement`. On the two pilot topics it
was applied where there is no speaker at all — a View document
("필자는 … 짚는다", "원문 분석은 … 이라며 … 근거로 들었다") — and in
`bonds-news` it put quotation marks around a string
("채권시장 위기라기보다 글로벌 term premium의 재가격") that the canonical source
does not contain (it says 채권시장 붕괴). On the holdout, where a real speaker
exists, it works cleanly (국토교통부는 … 발표하며 … 밝혔다고) — and where no
speaker exists, it produces sourceless attribution (지적이 나온다, 시각도 있다).
So the same rule produces good Korean when there is someone to attribute to and
manufactured attribution when there is not. **Two writers flagged this
independently and they were right.** It is not doing work in the tools drafts;
it is performing a convention. The corpus itself warns about this: §8 records
that every news trait rests on **one event on one day**, where a named official
said things out loud. Nothing in the evidence base covers attributing to a
document.

### Test 2 — is any AFTER worse than its BEFORE?

**Yes. Two, one of them serious.**

**`bonds-child` is worse, on semantic_integrity.** "이자율이 오른다고 해서
은행이나 회사가 망할 위험이 커지는 건 아니야" replaced a careful distinction with
a general causal denial the source does not make, addressed to a child, with
the caution flag that framed it deleted. This is the exact failure mode the
seven-dimension model exists to make visible: the AFTER is *smoother* — one
short sentence instead of a bolded two-part contrast — and it is *wrong*.
Integrity dominates; the smoothness does not enter the ledger.

**`bonds-news` is worse, on native_fluency and audience_fit.** The bonds
writer's claim that this baseline "wasn't badly broken to begin with" checks
out: I found no translationese scaffolding, no nominalisation pile-up, no
`~적` stacking, and no normative error in `sue570-pilot-bonds-news`. Verified
by counting: `~적` 4 → 2 in bonds-*report* where there was something to fix,
but bonds-news had almost nothing to remove. What the pass did instead was
churn — 그대로인데 → 유지됐지만 (stiffer), 이 구분에 → 채권시장 위기와 정상적인
재가격을 가르는 (redundant restatement), and the deletion of 돈을 빌려주는
사람들이 (a needed subject removed under a rule that licenses removing obvious
ones). A rule followed past the point where it helped, in a draft that did not
need it.

Against those two: `bonds-report` is genuinely and substantially better on
three dimensions with unambiguous spans (캐버트, falsifiable한, 관찰 가능성),
`tools-report` and `tools-news` are genuinely better on native_fluency, and
`tools-child` is unchanged.

**Summary of the run: three real improvements (tools-news, tools-report,
bonds-report), one pair unchanged (tools-child), two regressions (bonds-news
churn, bonds-child integrity). The unseen topic shows the fluency and
report-register work generalising, and shows the news-attribution device
generalising a defect along with itself.**

---

## 5. Findings that should route somewhere

Layer ids from `editorial/feedback-routing.json`. One finding, one layer.

### F1 → `verification`
**`sue604-bonds-child`: "이자율이 오른다고 해서 은행이나 회사가 망할 위험이
커지는 건 아니야."**

Why `verification` and not `audience`: the layer `owns` "an interpretation
presented as verified" and its symptom list names "an interpretation is marked
or treated as a verified fact". The defect is not that the sentence is pitched
wrong for a ten-year-old — it would be equally false in the report. The
audience layer explicitly does not own truth. `verification`'s `do_not` block
also settles the repair route: polish may not reword around it.

### F2 → `audience`
**`sue604-bonds-child`: "그러니까 **국채 금리**란, 나라가 돈을 빌릴 때 내는
이자를 말해."** — a dictionary-form gloss introducing a term used nowhere else
in the draft, against `aud-vocab-tier-basic` and the concrete-first principle.

Why `audience` and not `domain_terminology`: 국채 금리 is the correct canonical
term and maps to the right concept, so nothing terminological is wrong. The
`domain_terminology` `do_not` block draws exactly this line — "Choosing a
plainer word for a young or novice reader is an audience adaptation … The test
is whether the alias still maps to the recorded canonical concept". It does.
The miss is depth/load for the profile, which is what `audience` owns.

### F3 → `register`
**`reg-news-attribution-placement` applied where there is no speaker.**
`sue604-tools-news` ("필자는 … 지적하며 … 짚는다", ×6);
`sue604-bonds-news` ("원문 분석은 … 이라며 … 근거로 들었다");
`sue604-housing-news` ("…지적이 나온다", "…시각도 있다").

Why `register` and not `native_fluency`: the Korean is fluent — a native
newsroom writer produces these sentences. What is wrong is the genre
convention's *scope*: the rule was corroborated across four outlets covering one
event where a named official spoke, and it has been carried into pieces whose
"speaker" is a document or nobody. `register` owns content-type conventions and
its durable form is a profile/pack edit (class 5). The `native_fluency`
`do_not` block warns in the other direction, and applies here symmetrically:
these are genre-scope problems, not unidiomatic Korean.

Concrete ask for that layer: `reg-news-attribution-placement` needs a scope
condition distinguishing (i) a person who spoke, (ii) a document that states,
(iii) no attributable source — and it should forbid (iii) outright.

### F4 → `normative`
**A gap, not a violation: nothing in the pack governs whether quotation marks
may enclose a paraphrase.** `sue604-bonds-news` renders the canonical
"채권시장 붕괴"보다 … 재가격 as "채권시장 위기라기보다 글로벌 term premium의
재가격" **inside quotation marks**, closed with 이라며.

Why `normative` and not `verification`: the underlying claim is faithful — the
canonical source does support both the reading and the added grounds, so there
is no factual defect to verify. What is missing is a codified rule about what
큰따옴표 may enclose. `norm-quotation-attribution-punctuation` currently governs
only which marks distinguish quotation from re-quotation from emphasis. Per the
`normative` layer's own repair note, adding such a rule requires a standards
body behind it (국립국어원 문장부호 규정), not corpus evidence — which is exactly
why this is a routing finding and not something I can decide.

### F5 → `native_fluency`
**`sue604-bonds-news` churn: 그대로인데 → 유지됐지만; 이 구분에 → 채권시장
위기와 정상적인 재가격을 가르는; deletion of 돈을 빌려주는 사람들이.**

Why `native_fluency` and not `register` or `owner_voice`: this is lexical
choice, predicate choice, and subject handling — the exact list the layer
`owns`. Both `do_not` blocks on that layer point at the two mistakes available
here (calling it a genre problem; calling it taste). The finding is that
`nq-subject-topic-omission` needs a stated recoverability condition, and that a
draft with no detected defect should be able to come out of a language pass
unchanged.

### F6 → `native_fluency` (second, distinct finding)
**Agentless forecast predicates in `sue604-housing-report`:**
"…공급 부족 국면이 예상보다 길어질 것으로 전망된다", "…평가가 나온다",
"…판가름 날 가능성이 높다는 평가가 나온다". Ten hedge predicates against one in
the comparable bonds report.

Why `native_fluency` and not `register`: `reg-report-hedge-language` is being
*obeyed* — hedging a forecast is right for the genre. The defect is the choice
of an agentless 피동 predicate that erases whose forecast it is, which is
`nq-passive-causative-overuse`'s territory ("행위 주체가 분명한데도 … 주체를
흐리지 않는다"). Fixing this at the register layer would wrongly weaken the
hedging rule.

### F7 → `domain_terminology`
**`sue604-bonds-child` deleted 인플레이션 entirely** ("물가(인플레이션)" →
"물가(물건 값이 시간이 지나면서 오르는 정도)"), where `sue604-housing-child`
kept 인허가/착공/준공 and glossed them.

Why `domain_terminology` and not `audience`: the audience adaptation itself is
correct and welcome. The layer `owns` "whether an audience-facing alias still
maps to the same concept" — and here the alias exists with no recorded mapping,
because the canonical term is gone from the text. Housing-child shows the
pattern that satisfies both layers. This is a small finding and the weakest of
the seven.

### `owner_voice` — nothing routes here.
No finding in this evaluation is a taste finding. Every one above has a defect
on a higher layer. Routing any of them to `owner_voice` would be the specific
misroute that layer's `do_not` block names.

---

## 6. Recommendation on `holdout_result`

All four rules currently read `not_yet_tested`. Per
`LANGUAGE-QUALITY-ARCHITECTURE.md` §7, a topic-holdout generation is required
before activation, and a calibration that improves only on the discovery topics
is rejected. One run of three holdout drafts is thin evidence for any of these,
and I have weighted that.

### `reg-report-bare-noun-compression` → **`improved`**

The only one of the four I would move without reservation.

Observation: the device appears on the unseen topic **more densely and better
placed** than on the topics it was tuned on — `sue604-housing-report` carries it
in the title ("준공 정상화는 시차를 두고 확인될 전망"), in the 요약
("향후 여러 분기에 걸친 확인 필요"), and in 관찰 변수 ("분기·반기 단위 유지
여부"), while the body analysis keeps full predicates. That is the KIET
boundary condition — selective, not blanket — reproduced on material KIET never
touched. On the pilot topics it fires once each (`bonds-report`:
"다음 BOJ 회의와 JGB 입찰 결과에서 더 분명한 답이 나올 전망."), correctly scoped
to a forecast. No instance in any draft applies it to an observed fact.

Caveat to record with the promotion: one holdout instance closes on an
evaluative noun rather than a forecast ("…공급 정상화로 보기 어려움"), and both
pilot instances arrive as *newly inserted* sentences rather than compressions of
existing prose. Neither undermines the result; both belong in the record.

### `reg-report-hedge-language` → **`neutral`**

Observation: hedging transferred to the unseen topic — ten hedge predicates in
`sue604-housing-report` — so it is not corpus-fitted. But "transferred" is not
"improved", and I have no observation showing the hedging made a draft better.
`sue570-pilot-bonds-report` already hedged appropriately before the calibration
("…판단할 수 없다", "…나타날 수 있다"), so there was no defect to repair; the
AFTER's only hedge change is the bare-noun rewrite scored above. On the tools
side the rule produced a mild *over*-application — hedging the source's
mechanism rather than the report's own judgement ("범위는 넓어질 것으로
보인다", where the source states the mechanism directly). And on the holdout it
produced agentless forecast predicates (F6) that obscure whose forecast is
whose. Applied without breaking anything, demonstrably generalising, with no
demonstrated gain: that is `neutral`.

### `reg-news-attribution-placement` → **stays `not_yet_tested`**

This is not a "no evidence" verdict — it is a "the evidence is bad" verdict, and
`not_yet_tested` is the only honest place to leave the rule until the defect is
fixed.

Observation: on the one holdout instance with a real speaker the rule works and
produces exactly the corroborated nested form — "국토교통부는 8월 13일 '주택
신속공급 방안'을 발표하며 9월부터 재건축·재개발 제도 개선 설명회를 시작했다고
밝혔다." Everywhere else it produced attribution without an attributable
speaker: six document-attributions in `sue604-tools-news`, a quote-marked
paraphrase in `sue604-bonds-news`, and two sourceless
지적이 나온다 / 시각도 있다 in `sue604-housing-news`. One clean instance against
several distorted ones is not a holdout pass. And the rule's evidence base is
the weakest in the corpus by its own admission: `KOREAN-LANGUAGE-CORPUS.md` §8
records that all four news references cover the same day's story, so the trait
has never been checked against a different event, let alone a different *kind*
of source. Marking this `improved` on this run would promote a scope error into
the pack. Re-test after F3's scope condition is added.

### `aud-concrete-before-abstract` → **stays `not_yet_tested`**

Recommending `not_yet_tested` here is a statement about the experiment, not
about the rule.

Observation: there is **no measurable before/after delta anywhere**.
`sue570-pilot-tools-child` already opened concrete-first ("너희 반에서 학급
문고 예산을 짠다고 생각해보자") and `sue604-tools-child` changed nothing about
its sequencing; `sue570-pilot-bonds-child` already opened with the
money-lending scene before naming 국채, and the AFTER's only sequencing-relevant
change was to *add* a dictionary-form definition (F2). The holdout draft
executes the trait beautifully — "동네에 새 아파트가 생기는 모습을 본 적
있나요? … 빈 땅에 커다란 크레인이 서 있어요" before 인허가/착공/준공 — but with
no baseline to compare against, that shows the rule is *satisfiable* on an
unseen topic, not that the calibration caused it. The pilot baselines already
satisfied it before the calibration existed.

To move this rule, the next run needs a child draft whose baseline actually
fails concrete-first sequencing. Until then the rule has been demonstrated, not
tested.

---

*Verdicts in this document are per dimension and are not summed. `owner_voice_fit`
is `UNKNOWN` on all fifteen drafts: no human has expressed a preference on any of
this text, and silence is not acceptance.*
