# Canonical Prompt Integration — Editorial Design Note

작성: 2026-09-09 · 상태: **설계·운영 개선 안내. 신규 기능 구현 또는 owner pilot 인증 결과가 아니다.**

이 문서는 기존 Editorial Learning Core의 책임을 재배치하지 않는다. 자연어 요청을 더 긴 prompt로 반복하는 대신, 이미 있는 Intent·Brief·RenderSpec·profile·lineage·승인 자산 계약을 정확히 사용하도록 연결한다. 최종 owner-facing 사용 설명서는 기존 SUE-571의 실제 pilot 근거와 acceptance를 충족한 뒤 작성한다.

## 1. 기존 소유권을 유지한다

| 대상 | 기존 owner | Prompt의 역할 |
|---|---|---|
| 의도·변환·독자·surface·artifact | EditorialIntent와 해당 profile | 선택된 의도와 이번 변경점을 전달 |
| 사실과 정확한 수치·주장 | 원본 Source 및 검증된 payload | source-bound 값을 보존; craft reference를 사실로 사용하지 않음 |
| 이미지의 목적·논지·독자 효과 | VisualBrief | 목적을 provider용 표현으로 전달 |
| 장면·읽기 순서·공간·사실 배치 | RenderSpec | 설계 내용을 손실 없이 표현 |
| 스타일 참고의 허용 차원 | registry evaluation의 authority / not_authority | 선택된 차원만 반영; source body나 최근 이미지 기억을 새 권위로 사용하지 않음 |
| 실제 자산 승인·잠금 | visual-job의 기존 approval lock | 생성 prompt나 gate-routing flag는 승인 증거가 아님 |
| 콘텐츠 보관·발행 | publication adapter / publication repository | 별도 승인된 인계만 수행 |
| 작업 범위·수용 기준 | Linear | 현재 work contract의 projection |

정식 경계는 [SSOT-BOUNDARIES](SSOT-BOUNDARIES.md), [V2 architecture](V2-EDITORIAL-LEARNING-CORE.md), [VisualBrief/RenderSpec contract](../../schemas/VISUAL-BRIEF-AND-RENDER-SPEC-CONTRACT.md)가 소유한다. 이 문서는 별도 Prompt DB, 중복 Intent schema, 기사 저장소 또는 실행 프레임워크를 추가하지 않는다.

## 2. 사람은 자연어로 요청한다

사용자에게 JSON, 내부 profile 이름, schema version을 외우게 하지 않는다. 사용자는 목적과 변경점을 말하고, agent가 접근 가능한 정식 source를 읽어 내부 표현을 조립한다.

```text
이 자료를 바탕으로 실무자용 설명 글을 써줘.
주장의 한계는 유지하고, 이번에는 구매 의사결정에 필요한 부분만 강조해.

이 글의 결론과 수치는 그대로 두고 번역투 문장만 다듬어줘.
문제가 없는 부분은 바꾸지 마.

이 이미지는 승인된 버전이야. 이미지는 건드리지 말고 본문 설명만 수정해.

이 reference는 정보의 읽기 순서만 참고하고 색감과 인물은 따라하지 마.
```

위 예문은 새로운 복사용 예시다. 실제 target·revision·승인 상태는 지시문만 믿지 말고 기존 source/asset contract에서 확인한다. 대상이 없는 이미지 편집 요청은 임의의 이미지를 만들어 편집한 것처럼 처리하지 않는다.

추가 질문은 결과·권한·정확성에 실질적 영향을 주며 source로 해결할 수 없는 모호성에 집중한다. 이미 source에 있는 답을 다시 묻거나 모든 작은 선호를 필수 질문으로 만들지 않는다. 진행 가능한 reversible default는 task-local 가정으로 표시하고 durable preference로 몰래 승격하지 않는다.

## 3. 조립은 짧게, 계약은 충분하게

```text
현재 사용자 의도와 변경점
→ 접근 가능한 source / 현재 target revision 확인
→ 기존 Intent와 source-target delta
→ 필요한 profile·Skill·reference authority 선택
→ VisualBrief / RenderSpec 또는 text/audio plan
→ provider-facing projection
→ 실제 산출물 평가
→ 필요한 부분만 수정
→ 기존 승인·인계 계약
```

공통 kernel에는 목적, 바꾸지 않을 사실·승인 자산, 허용 작업, 필요한 검증과 종료점을 둔다. 해당 작업에 필요한 source/profile은 task pack으로 전달하고, 긴 참고문서는 locator와 필요 시 읽을 조건을 제공한다.

같은 규칙을 모든 prompt·Skill·profile에 중복 복제하지 않는다. 다만 중요한 사실·권한 경계를 짧게 재표시하는 것은 허용된다. 필수 source를 읽을 수 없으면 UNKNOWN/SOURCE_MISSING을 드러내고 그 source에 의존하는 생성·발행을 제한한다. 다른 독립적이고 허용된 계획 작업까지 무조건 중단할 필요는 없다.

## 4. 의미 보존과 재현성

Provider adapter는 wording을 바꿀 수 있지만 의도, 사실 payload, profile, reference authority, 필요한 검증, 발행 권한을 바꿀 수 없다. 기존 lineage에 material source/ref revision과 선택 이유를 연결한다. 새 provenance schema가 필요하다고 미리 단정하지 않고 기존 record를 먼저 사용한다.

정규화된 입력과 결정론적 compiler version이 같으면 구조화 계약은 동일해야 한다. 자유 문장으로 만든 prompt의 표현이 다르다는 이유만으로 의미가 달라졌거나 memory 오염이라고 단정하지 않는다. 의미 불변성을 검사하고, byte-identical output은 명시적으로 결정론적 renderer를 사용하는 경로에서만 요구한다.

조립 시 snapshot과 실제 렌더링/교체/발행 대상은 다를 수 있다. source claim, target revision, 승인된 asset identity가 바뀌면 영향받는 검증·승인을 재확인한다. 발행 API timeout은 실패 확정이 아니므로 실제 결과를 read-back하거나 기존 멱등 계약으로 확인한 뒤 재시도를 결정한다. 이 설명만으로 Core에 새로운 runtime enforcement가 구현되지는 않는다.

## 5. 기존 시각 계약과 진행 중인 변경을 구분한다

현재 VisualBrief/RenderSpec 계약의 article-title 외부 처리, reference의 craft-only 권위, visual-job approval lock을 유지한다. SUE-669의 integrated text ownership은 해당 작업이 구현·검증된 뒤에 적용할 변경이며, 이 문서가 세 가지 새 text class의 지원 완료를 선언하지 않는다.

SUE-669가 제안하는 structural text / verified generative fact / deterministic external text에서도 정확한 사실 payload의 source binding과 필요한 post-render 검증은 보존해야 한다. Prompt 문자열 검증은 실제 이미지의 글자·수치·가독성·브랜드 준수를 증명하지 않는다. 필요한 vision/owner review는 실제 산출물을 대상으로 한다.

이미 승인된 자산은 관련 없는 문구 수정 때문에 다시 생성하거나 교체하지 않는다. 실제 자산이 바뀌면 기존 승인을 자동 승계하지 않는다. Dense information은 정보를 삭제하거나 글자를 작게 우겨 넣는 대신 분할·caption·외부 표현 같은 허용된 경로를 검토한다.

## 6. 실패한 층만 고친다

| 불만·결함 | 먼저 확인할 층 | 피할 동작 |
|---|---|---|
| 논지가 약함·독자에게 맞지 않음 | Intent / framing / audience profile | 문장만 반복 치환 |
| 수치·인용·사실 오류 | Source / claim payload / verification | 스타일 reference로 사실 채우기 |
| 번역투·한국어 표현 품질 | source-target delta / native prose Writer / language evaluation | 정상 문장까지 전면 재작성 |
| 읽는 순서·정보 과밀 | VisualBrief / RenderSpec / artifact profile | 모든 문제를 모델 교체로 해결 |
| 잘린 글자·렌더링 결함 | 실제 asset / rendering / post-render QA | 논지·사실 계획까지 불필요하게 변경 |
| 한 번의 취향 변경 | task-local instruction | 전역 calibration을 자동 변경 |
| 앞으로의 명시적 선호 변경 | 기존 versioned calibration / feedback registry | 모든 과거 자산을 소급 재생성 |

역할 권한과 생성 역량은 별개다. 강한 Manager가 있다고 최종 한국어 prose Writer의 역량 하한을 낮추지 않는다. 이미지 계획, 이미지 렌더링, deterministic chart, vision review, 음성 대본과 실제 청취 평가도 같은 능력으로 취급하지 않는다. 현재 task에 명시된 M/W/R 배정과 effort는 이 일반 안내로 변경하지 않는다. [WRITER-MODEL-ROUTING](WRITER-MODEL-ROUTING.md)을 따른다.

## 7. 기존 과제에 반영할 검증 사례

아래는 **실행 전 검증 명세**이며 PASS 결과가 아니다.

| 사례 | 기대 동작 | 기존 integration owner |
|---|---|---|
| 필요한 factual source 접근 실패 | 값 추정 금지, 영향 작업 제한 | 기존 source/intake 경계; SUE-571은 사용자 안내 |
| provider prompt 표현만 변경 | 논지·사실·권한·검증 의미 유지 | SUE-669의 기존 compiler/lineage |
| source/target revision 변경 | 관련 검증과 승인 유효성 재확인 | compiler + 기존 downstream asset/publication owner |
| reference에 '사실을 바꾸라'는 지시 포함 | craft evidence와 authority 분리 | 기존 reference contract; SUE-669 회귀 확인 |
| 본문만 수정, 이미지 이미 승인됨 | 승인 자산 보존, 필요 없는 regeneration 금지 | 기존 asset lock; SUE-571 안내 |
| 수치가 prompt에는 맞고 실제 이미지에는 틀림 | post-render 검증 실패를 숨기지 않음 | 기존 vision/owner review |
| 현재 text-free job 입력 | 새 경로 도입 후에도 기존 계약과 호환 | SUE-669 |
| 음성 렌더링 기능 미인증 | 대본 계획과 생성·청취 검증을 구분 | 기존 audio owner; SUE-571 안내 |

새 코드가 필요한지 먼저 기존 test와 계약으로 확인한다. 완료된 기존 issue를 무조건 재오픈하거나 새 generic prompting epic을 만들지 않는다. 실제 결함이 기존 acceptance를 깨는지, 새 기능인지, 문서 보완인지 구분한다.

## 8. 평가와 채택

Prompt 길이만 비교하지 않는다. 같은 task/source/profile/model/permission 조건에서 필수 지시 누락, 실제 산출물 수용, owner 수정 횟수, 불필요한 전면 재작업, factual 오류, 승인 자산 침범, 전체 생성·재검토 비용을 본다. 실패 run도 포함한다. 비교 실험을 하지 않았다면 절감률이나 품질 향상 수치를 적지 않는다.

SUE-571의 최종 owner manual은 실제 pilot에서 입증된 내용만 추천한다. Korean prose·visual baseline에 남아 있는 hold나 deferred 상태를 이 문서로 해제하지 않는다. SUE-669는 기존 compiler 책임 안에서 필요한 계약·검증을 구현한다. 문서가 존재하는 것, compiler가 지원하는 것, 실제 산출물이 수용되는 것, 발행 권한이 있는 것은 서로 다른 상태다.
