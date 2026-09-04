<!--
SUE-569 후속 dogfood run-02 — write-article + editorial-polish 단계의 산출물.

이 파일은 발행 가능한 아티클이 아니다. content/ 경로가 아니며, front matter가
없고(type/status 필드 없음), suengj-com에 올라갈 완결된 원고를 대표하지 않는다.
schemas/ARTICLE-ARTIFACT-CONTRACT.md에 따르면 canonical Markdown 본문은 이
리포지토리가 아니라 suengj-com이 소유한다 — 여기 있는 것은 그 경계를 지키면서도
write-article과 editorial-polish 두 스킬이 실제로 수행한 작업(논증을 구성하고,
사실/해석을 분리하고, protected span을 보존한 채 문장을 다듬는 것)을 정직하게
보여주기 위한, 의도적으로 짧은 발췌본이다. 03-frame-and-article/article-bundle.json의
frame.structure 다섯 항목 중 앞의 세 항목만 실제로 산문화했고, 나머지 둘은
산문화하지 않았다 — 이 파일 자체가 그 사실을 숨기지 않는다.

인용 마커 [^c1]~[^c6]는 article-bundle.json의 verification.claims의 claim_id에
대응한다.
-->

GitHub가 npm 공급망을 지키겠다며 내놓은 조치와, 실제로 뚫린 사고는 서로 다른
이야기가 아니다. 같은 문 이야기다. [^c1][^c2] GitHub는 2025년 9월 장기 유효
토큰을 없애고 짧은 수명의 trusted publishing으로 옮기겠다고 밝혔고, 2026년 6월
발표한 대로 7월 8일 npm v12에서 preinstall/install/postinstall 생명주기
스크립트를 기본적으로 꺼버렸다. [^c1][^c2] 그리고 그로부터 한 달이 채 지나지
않은 8월 4일, CHAINDROP이라는 웜이 keyv 유지관리자의 게시 권한을 훔쳐 바로 그
preinstall 훅으로 co-owned 패키지들을 감염시켰다. [^c3]

Elastic은 이 사고를 "400개 이상의 패키지"로, StepSecurity는 "444개 패키지,
2,212개 버전, 4시간 이내"로 보고했다. [^c3] 두 수치는 다르다. 이 글은 둘 중
하나를 골라 반올림하지 않는다 — 침해 규모의 정확한 경계는 이 두 리포트만으로는
확정되지 않는다는 사실 자체가 기록할 만하다. Elastic이 직접 밝힌 패키지별 월간
다운로드 수(keyv 6억 이상, flat-cache 약 5.8억, cacheable-request 1.37억 이상,
cacheable 3천만 이상, cache-manager 1,600만 이상)를 합치면 약 13.6억이다. [^c4]
같은 사고를 다룬 일부 2차 보도의 제목은 "20억 다운로드"를 언급했지만, 이 글은
그 보도 본문을 직접 확인하지 못했고 Elastic의 자체 수치와도 맞지 않아 채택하지
않는다. [^c5]

여기서 눈에 띄는 것은 침해 자체가 아니라 침묵이다. npm v12의 스크립트 기본
차단은 정확히 CHAINDROP이 사용한 실행 경로를 겨냥한 조치였다. 그런데 이 사고를
분석한 세 개의 독립된 리포트 — Elastic, StepSecurity, Unit 42 — 중 어느 것도
피해 환경이 npm v12 이상을 쓰고 있었는지, 썼다면 스크립트 실행을 opt-in으로
켜둔 상태였는지 다루지 않는다. [^c6] 세 리포트 모두 preinstall 훅을 실행
벡터로 정확히 지목하면서도, 그 벡터를 한 달 전에 기본값에서 꺼버린 새 버전과의
관계는 언급하지 않는다. 이것은 방어가 실패했다는 증거가 아니다. 방어가
실제로 작동했는지조차 아직 아무도 확인하지 않았다는 증거다.
