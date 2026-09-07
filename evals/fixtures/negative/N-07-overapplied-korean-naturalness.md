<!--
STATUS — NOT REGISTERED. This fixture is deliberately absent from
evals/fixtures/manifest.json and is not part of the routine evaluation corpus.
scripts/test-eval.mjs holds the corpus to at most 10 fixtures so it stays
cheap to rerun, and the corpus is already at that limit. Registering N-07
means deciding to raise or re-allocate that budget, which is an evaluation-
semantics decision for the language/eval lane — not something an evidence
salvage should take.

It is kept here so the fixture survives the deletion of branch
sue-523-quiet-authority (commit 9559e54), where it originated as N-05. Its
Korean prose body is byte-identical to that commit; only the cross-references
in the comment below were repointed at the contracts that exist on main.

Do not treat it as an active fixture until it is registered.
-->

<!--
Negative fixture N-07 — over-applied Korean naturalness (SUE-523 salvage).

`skills/editorial-polish/SKILL.md` treats Korean-naturalness traits (subject omission,
verb-forward rewriting, de-nominalization, connective removal) as soft
detectors, not rewrite instructions. This fixture calibrates what those moves
look like applied too hard. It is deliberately gate-invisible: everything wrong
with it is a judgement failure, not a mechanical one, and no gate in
`editorial/quality-gates.json` is expected to fire on it.

Three failure modes, each an over-application of a move `editorial/voice.md` or
`skills/editorial-polish/SKILL.md` actually recommends in moderation:

1. Subject dropped after a plausible-but-wrong antecedent. Paragraph 1
   introduces two distinct actors (팀, 벤더). Paragraph 3 reads fine on a
   fast pass — this is realistic over-application, not a caricature — but
   the dropped subject has two equally plausible referents in each clause
   (did the *team* send the confirmation request to the vendor, or did the
   *vendor* send it? who started the response, who finished the recovery?),
   and nothing in the sentence resolves it either way.
   `nq-subject-topic-omission` in `editorial/profiles/language/ko-KR.json`
   is a soft detector, not a rewrite command; it must not drop a subject where
   two named actors remain plausible antecedents.
2. Stated uncertainty flattened into a confident claim one sentence later.
   Paragraph 2 states the cause is undetermined, then immediately asserts a
   single cause with no new evidence between the two sentences. This is
   exactly the failure `skills/editorial-polish/SKILL.md` prohibits: stated
   uncertainty/confidence must survive a polish pass.
3. Hypotactic sentences chopped into clipped, efficient-sounding fragments.
   `editorial/voice.md` §5 requires rhythm to follow the thought rather than a
   quota, so uniformly clipped sentences are a defect — but the earlier version
   of this fixture chopped paragraph 3 into four bare two-character verbs
   that no real polish pass would ever emit, which calibrated nothing. The
   revised paragraph 3 is what over-application actually looks like: three
   short status-log sentences, each still a full clause, dense enough to
   read as efficient rather than obviously broken, which is what makes the
   subject ambiguity in mode 1 easy to miss on a fast read.

Expected: no reject-severity findings, and no translationese rule should fire —
none of these are translationese; they are Korean-naturalness technique applied
without judgement. This is the calibration point for what editorial-polish must
not become, not a positive example of anything.
-->

팀이 새 버전을 배포했다. 벤더도 같은 날 설정을 바꿨다.

장애가 발생했다. 원인은 확정되지 않았다. 배포가 원인이다.

확인 요청을 보냈다. 대응을 시작했다. 몇 시간 만에 복구했다.

재발을 막기로 했다. 점검 주기를 2주로 조정했다.
