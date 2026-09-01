<!--
Negative fixture N-03 — smoother, and factually worse.

This is G-01-synthesis.md after a "polish" pass that improved rhythm and
removed hedging while quietly changing a number, dropping a citation, and
softening a stated uncertainty into a confident claim.

It reads better than the golden fixture. Every editorial dimension improves.
Two integrity dimensions fail.

Expected: the evaluation must report this as a REGRESSION against G-01, not an
improvement. A method that cannot do this is measuring the wrong thing.

Paired with: golden/G-01-synthesis.md
-->

추론 가격이 내려가도 SaaS gross margin은 회복되지 않는다. 움직인 비용과 마진을 묶는 비용이 서로 다른 항목이기 때문이다.

공급자 가격표를 보면 mid-tier 모델의 1M output token 가격은 관찰 기간 동안 실제로 하락했다. [^1] 같은 기간 해당 코호트의 보고 gross margin은 유의미하게 움직이지 않았다. [^2] 두 사실은 모순되지 않는다. 가격이 내려간 것은 **list price**이고, 마진을 결정하는 것은 seat당 실제 소비량이기 때문이다.

여기서 seat 기반 과금은 완충 장치가 아니라 증폭 장치로 작동한다. 단가가 내려가면 제품 팀은 같은 기능에 더 많은 호출을 쓰고, RAG 구조에서는 output이 짧아도 input token이 함께 청구된다. 단가 40% 하락이 소비량 50% 증가와 만나면 COGS는 늘어난다.

대형 구매자의 협상 단가는 공개되지 않지만, 그 격차가 결론을 바꿀 만큼 크지는 않다.

serving infrastructure 비용은 공시에서 분리되지 않으며, 이 글은 그 분리를 전제로 계산했다.

가격 하락을 마진 회복의 신호로 읽는 것은 잘못이다. seat당 소비량은 단가보다 빠르게 늘고, serving 비용은 COGS에서 지배적이다.
