<!--
Golden fixture G-01 — the shape a passing article has.

Body only, synthetic, written for this fixture. Demonstrates: a thesis in the
first paragraph, synthesis across sources that disagree, facts separated from
interpretation, numbers rather than adjectives, a stated limit, and a closing
that lands a consequence instead of summarising.

Expected: no reject-severity findings.
-->

추론 가격이 내려가도 SaaS gross margin은 회복되지 않는다. 움직인 비용과 마진을 묶는 비용이 서로 다른 항목이기 때문이다.

공급자 가격표를 보면 mid-tier 모델의 1M output token 가격은 관찰 기간 동안 실제로 하락했다. [^1] 같은 기간 해당 코호트의 보고 gross margin은 유의미하게 움직이지 않았다. [^2] 두 사실은 서로 모순되지 않는다. 가격이 내려간 것은 **list price**이고, 마진을 결정하는 것은 seat당 실제 소비량이기 때문이다.

여기서 seat 기반 과금이 완충 장치가 아니라 증폭 장치로 작동한다. 단가가 내려가면 제품 팀은 같은 기능에 더 많은 호출을 쓰고, RAG 구조에서는 output이 짧아도 input token이 함께 청구된다. [^2] 단가 30% 하락이 소비량 50% 증가와 만나면 COGS는 늘어난다.

반대 방향의 근거도 있다. 대형 구매자의 협상 단가는 공개되지 않으며, list price는 이들이 실제로 지불하는 금액을 과대평가한다. [^3] 이 격차가 충분히 크다면 위 계산은 성립하지 않는다.

확인되지 않은 부분은 분명하다. serving infrastructure 비용은 대부분의 공시에서 다른 COGS 항목과 분리되지 않으며, 이 글은 그 분리를 가정하지 않았다.

가격 하락을 마진 회복의 신호로 읽는 쪽은 두 가지 중 하나를 보여야 한다. seat당 소비량이 단가보다 느리게 는다는 것, 또는 serving 비용이 COGS에서 지배적이라는 것. 지금까지 공개된 자료는 둘 다 보여주지 않는다.
