<!--
Negative fixture N-05 — over-applied voice (SUE-523, review defect D7).

`editorial-polish/SKILL.md`'s Korean-naturalness step (subject omission,
verb-forward rewriting, de-nominalization, connective removal) has no
fixture calibrating what those moves look like applied too hard. This one
does. It is deliberately gate-invisible: everything wrong with it is a
judgement failure, not a mechanical one, and no gate in
`editorial/quality-gates.json` is expected to fire on it.

Three failure modes, each an over-application of a move `voice.md` or
`editorial-polish/SKILL.md` actually recommends in moderation:

1. Subject dropped after a plausible-but-wrong antecedent. Paragraph 1
   introduces two distinct actors (팀, 벤더). Paragraph 3 reads fine on a
   fast pass — this is realistic over-application, not a caricature — but
   the dropped subject has two equally plausible referents in each clause
   (did the *team* send the confirmation request to the vendor, or did the
   *vendor* send it? who started the response, who finished the recovery?),
   and nothing in the sentence resolves it either way. `voice.md`'s rule is
   "let the subject stay implied once context carries it" (see `voice.md`,
   "Native Korean, not translated Korean"); this drops it where context is
   ambiguous between two named actors, not clear.
2. Stated uncertainty flattened into a confident claim one sentence later.
   Paragraph 2 states the cause is undetermined, then immediately asserts a
   single cause with no new evidence between the two sentences. This is
   exactly the failure `editorial-polish/SKILL.md`'s invariants forbid
   ("stated uncertainty and confidence" must survive a polish pass) — but
   `polish-invariants.mjs` only diffs a before/after pair on protected
   spans; it has no "uncertainty" span class, so a single document asserting
   this internal contradiction is invisible to it.
3. Hypotactic sentences chopped into clipped, efficient-sounding fragments.
   `voice.md` §5 warns against staccato fragments — but the earlier version
   of this fixture chopped paragraph 3 into four bare two-character verbs
   that no real polish pass would ever emit, which calibrated nothing. The
   revised paragraph 3 is what over-application actually looks like: three
   short status-log sentences, each still a full clause, dense enough to
   read as efficient rather than obviously broken, which is what makes the
   subject ambiguity in mode 1 easy to miss on a fast read.

Expected: no reject-severity findings, and `translationese-scaffold` does
not fire — none of these are translationese; they are Korean-naturalness
technique applied without judgement. This is the calibration point for what
editorial-polish must not become, not a positive example of anything.
-->

팀이 새 버전을 배포했다. 벤더도 같은 날 설정을 바꿨다.

장애가 발생했다. 원인은 확정되지 않았다. 배포가 원인이다.

확인 요청을 보냈다. 대응을 시작했다. 몇 시간 만에 복구했다.

재발을 막기로 했다. 점검 주기를 2주로 조정했다.
