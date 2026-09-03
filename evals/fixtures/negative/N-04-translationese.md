<!--
Negative fixture N-04 — translationese, seven calibration cases (SUE-523).

Same facts and argument as golden/G-04-korean-native.md, paragraph for
paragraph. Cases 1-6 are sentence-level: one short paragraph each,
demonstrating one failure signature at a time. Case 7 is paragraph-length —
four sentences carrying one argument — because sentence-level cases alone
cannot show English-shaped discourse order, which is the thing SUE-523 cares
about most; only a paragraph can show sentences arranged in the wrong order
relative to each other, not just words arranged wrong within one sentence.

Recorded per case: the exact failure signature, the minimum rewrite (see the
matching case in G-04), and why the rewrite is better. None of these
signature strings is banned individually — repetition and English-shaped
discourse order are the defect (voice.md, "Native Korean, not translated
Korean"). Cases 5 and 6 are unchanged from the first pass — the review that
produced this revision named them as already clean.

1. ~라는 점에서 / ~다는 점에서 / ~의 관점에서 stacked as justification
   scaffolding where a direct claim would do. This is not self-positioning —
   "보안팀의 관점에서" attributes the viewpoint to a third party, not the
   author — it is discourse-scaffolding stacking, the same failure shape as
   case 3 but built from a different signature. Minimum rewrite: state the
   fact, then the recommendation, without the "in that X, from Y's
   perspective" scaffolding. Better because the security claim and the
   recommendation are no longer buried inside two nested justification
   clauses.
2. 이를 통해 / 이러한 맥락에서 standing in for a causal link an "-자" clause
   states directly. Minimum rewrite: keep the subject explicit once, as an
   antecedent, then fuse the two clauses with "-자" and end on a plain
   verbal predicate rather than a nominal-copula substitute. Better because
   the cause and the effect sit in one sentence, and "회사는" still gives the
   reader something to hold onto rather than dropping the only mention of
   who did this.
3. "결국 중요한 것은 X이다" scaffolding wrapping an abstract noun stack
   (전이 가능성에 대한 판단) around a verb the noun form hides. Minimum
   rewrite: replace the topic-fronting frame itself, not just its wording —
   "관건은 X다" swaps the noun stack but keeps the same "topic은 X(이)다"
   shape, so the earlier pass's fix did not actually fix this. State the
   spread and the judgment as a cause naming a plain verb instead. Better
   because the sentence no longer announces its own topic before making the
   claim, in either wording.
4. 따라서 / 한편 used as mechanical glue between unrelated observations, plus
   "이는 ~것을 의미한다" repeated twice as English-style declarative
   scaffolding. Minimum rewrite: combine the two number sentences with
   "-지만", state the co-occurrence as a plain verbal clause without
   strengthening it into a stronger claim the source doesn't make, and keep
   the subject "회사는" explicit before the second observation rather than
   dropping it or fusing it into an assumed proportionality. Better because
   the sentence states exactly what the numbers show — that margin fell
   while revenue rose, and that hiring rose alongside labor cost — without
   inferring a full offset or a proportional relationship the two lone facts
   don't establish.
5. ~에 대한 / ~에 있어 / ~을 통해 stacked into a noun chain that keeps the
   English clause order ("regarding the solution to this problem, the most
   important thing is..."). Minimum rewrite: front the verb ("풀려면") and
   let "검증해" carry the second action directly. Better because two verbs
   replace three nominalizations and the sentence follows Korean's own
   information order instead of the English original's.
6. The subject "그는" restated in three consecutive sentences where Korean
   drops it once context is set, and each sentence kept separate in the
   English original's declarative rhythm. Minimum rewrite: state the subject
   once, fuse the first two clauses with "-해", and let the third continue
   without a subject. Better because the paragraph reads as one thought
   instead of three restatements of who is doing it.
7. Discourse order, not sentence order: the paragraph opens with a general
   claim, then a self-referential "this piece will examine..." move (English
   essay scaffolding, not a Korean-shaped opening — see voice.md §8), then
   the data, then the conclusion tacked on at the end with 이러한 맥락에서.
   Minimum rewrite: reorder the sentences themselves — lead with the number
   that does the work, let the conclusion follow as a direct clause, and cut
   the "이 글은 … 살펴본다" self-referential move entirely, while keeping the
   data provenance itself ("청구 데이터") — only the meta-commentary about
   the piece's own act of examining is scaffolding; the data source is
   evidence, not scaffolding, and SUE-523's scope boundary forbids weakening
   it. Better because the reader reaches the load-bearing fact first instead
   of last, which is the Korean-shaped order for this argument, not just a
   sentence-level rewording.
-->

AI Agent가 코드베이스에 접근할 수 있다는 사실은 보안 이슈라는 점에서, 권한 설계는 보안팀의 관점에서 다시 검토될 필요가 있다는 점에서 중요하다.

회사는 2024년에 배포 파이프라인을 자동화했다. 이를 통해 배포 빈도가 주당 2회에서 5회로 늘었다. 이러한 맥락에서 이는 조직의 병목이 코드가 아니라 승인 절차였음을 보여준다.

결국 중요한 것은 구조적 변화의 전이 가능성에 대한 판단이다.

매출은 전년 대비 12% 증가했다. 하지만 영업이익률은 3%p 하락했다. 따라서 이는 매출 성장이 비용 증가를 동반했다는 것을 의미한다. 한편 회사는 채용을 늘렸다. 이는 인건비가 늘었다는 것을 의미한다.

이 문제에 대한 해결에 있어 가장 중요한 것은 데이터 품질에 대한 검증을 통해 신뢰성을 확보하는 것이다.

그는 이 모델을 2023년에 도입했다. 그는 이 모델을 통해 응답 속도를 40% 개선했다. 그는 이 결과에 만족했다.

클라우드 백업 비용은 일반적으로 저장 용량에 비례한다고 여겨진다. 이러한 통념에 대한 재검토가 필요하다는 점에서 이 글은 실제 청구 데이터를 살펴본다. 2025년 한 해 동안 스냅샷 개수는 20% 늘었지만 저장 용량 자체는 5% 느는 데 그쳤다. 이러한 맥락에서 비용을 움직이는 것은 저장 용량이 아니라 스냅샷 개수라는 결론에 도달하게 된다.
