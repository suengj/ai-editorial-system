<!--
Negative fixture N-05 — coherent and mechanically clean, but it imitates one
recognisable house move until the prose becomes formulaic.

Intended editorial failure: E-11 voice-fit. Expected: no reject-severity
finding. A style tendency becoming a generation rule is the defect.
-->

도구가 많다는 것과 운영 체계가 있다는 것은 다른 문제다. 2026년의 개발 환경에서는 여러 Agent를 동시에 붙이는 것 자체는 어렵지 않지만, 누가 어떤 변경을 해도 되는지 정하는 일은 별개의 문제로 남는다.

실행 가능성과 실행 권한도 다른 문제다. Agent가 repository를 수정할 수 있다는 사실과 지금 이 역할의 Agent가 그 수정을 수행해도 된다는 것은 동일하지 않다. 기능의 존재를 authority의 존재로 읽으면 운영 사고가 시작된다.

자동화와 자율성 역시 같은 문제가 아니다. 반복 작업을 자동으로 실행하는 것과 상황을 해석해 다음 행동을 스스로 결정하는 것은 구분해야 한다. 중요한 것은 호출 횟수가 아니라 decision boundary가 어디에 놓여 있는가다.

검증과 리뷰도 다른 문제다. 테스트가 통과했다는 사실은 코드가 선언된 조건을 만족했다는 뜻이지, 그 변경이 프로젝트 목적에 맞는다는 뜻은 아니다. correctness와 appropriateness를 하나의 gate로 묶으면 둘 중 하나는 흐려진다.

결국 Agent 시스템의 복잡성과 운영 난이도도 같은 문제가 아니다. 구성 요소가 많아도 boundary가 명확하면 관리할 수 있고, 구성 요소가 적어도 authority가 섞이면 사고가 난다. 그래서 시스템을 볼 때 중요한 것은 얼마나 많은 Agent가 있는지가 아니라 각각의 역할이 어디에서 끝나는가다.
