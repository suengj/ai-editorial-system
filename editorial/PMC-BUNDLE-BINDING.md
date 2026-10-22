# PMC bundle → 기존 차트 패널 결합 (SUE-1336)

Prediction-Market-Crawler(PMC)가 만든 **plot bundle**을 `renderChartPanel`·`render-visual`에 결정론적으로 묶는 경로다. 새 렌더러나 새 모델 호출이 아니다. 이 문서는 `STRUCTURED-VISUAL-EXECUTION.md` §6의 "실제 PMC bundle 결합" 항목을 실행 가능하게 만든 것이며, 숫자 정책은 계속 `INSTAGRAM-NUMERIC-VISUAL-POLICY.md`가 소유한다.

## 1. 누가 무엇을 소유하는가

| 소유자 | 책임 |
|---|---|
| PMC | 시장 선택, 확률/가격 단위, quote vs history, 갭/보간(PCHIP·step), `hero`/`delta` 문자열, `plot_data_sha256` |
| 이 경로 | PMC 파일의 무결성 검증, 관측값을 **복사**해 차트 spec 구성, 카드 plan 구성, 렌더 결과가 PMC 숫자와 같은지 대조 |
| owner | 최종 시각 판단과 게시 승인 (이 경로는 어느 것도 대신하지 않는다) |

원시 관측값과 표시 숫자는 바꾸지 않는다. 기본 `raw` mode는 모든 원 관측을 정확한 monotone 경로로 그리고 smoothing·resampling·simplification을 금지한다. 예측시장 card-news profile이 선택한 `flow` mode만 내부 곡선을 시각적으로 smoothing할 수 있으며, raw 양 끝점·방향·signed delta와 모든 표시 숫자/날짜는 검증된 PMC bundle과 일치해야 한다. 중간 관측값 라벨이 있는 차트에는 `flow`를 쓸 수 없다. 데이터 수정·forward-fill·갭 메우기는 하지 않는다.

## 2. 실행 순서

```bash
# 1) PMC bundle(.plot.json)을 검증하고 새 빈 디렉터리에 입력을 구성한다. 네트워크/모델 호출 없음.
node scripts/bind-pmc-bundle.mjs bind --plot <slug>.plot.json --out out/<name>/inputs \
  [--title "표시 제목" [--title-origin source_rewrite|request_summary|source_verbatim]]

# 2) 기존 SNS 렌더 게이트: plan에서 profile receipt를 만든다 (계정은 추측하지 않으므로 --target 필수)
node scripts/resolve-editorial.mjs --plan out/<name>/inputs/plan.json --target personal-instagram \
  --out out/<name>/receipt.json

# 3) 기존 executor로 렌더 (--out은 새 빈 디렉터리)
node scripts/render-visual.mjs --plan out/<name>/inputs/plan.json \
  --profile-receipt out/<name>/receipt.json --out out/<name>/render

# 4) 렌더 결과가 PMC bundle의 숫자와 같은지 대조
node scripts/bind-pmc-bundle.mjs verify --inputs out/<name>/inputs --render out/<name>/render
```

결과 산출물은 저장소의 무시되는 `out/`(`.gitignore`) 아래에만 둔다. 실제 시장 데이터·PNG를 커밋하지 않는다. 회귀 검사는 `npm run test:pmc-binding`(오프라인, 실제 SVG rasterizer 필요).

`bind`가 쓰는 파일: `pmc.plot.json`(원본 bytes 복사), `chart.spec.json`(관측값 복사 spec), `plan.json`(1080×1350 Instagram 카드, 워터마크 OFF), `binding.json`(검증 결과·hash·`api_calls: 0`·`publication: NOT_AUTHORIZED`·`visual_review: OWNER_REQUIRED`). `verify`는 렌더 디렉터리에 `pmc-binding-qa.json`을 쓰고 FAIL이면 exit 1이다.

## 3. 무엇을 검증하고 무엇을 거절하는가

`bind` 단계(거절 시 exit 1, 코드로 보고):

- `schema == pmc.plotdata/1` 단일 outcome만. 다중 outcome bundle은 `PLOT_SCHEMA`로 거절한다(PMC가 직접 렌더).
- `plot_data_sha256`을 파일에서 다시 계산해 일치해야 한다(`PLOT_HASH_MISMATCH`). PMC는 Python canonical JSON(`float` repr 유지)으로 해시하므로 JS의 `34.0 → 34` 정규화를 그대로 쓰지 않고 숫자 표기를 보존하는 해셔를 쓴다.
- `status`가 `ok`이고 관측이 2개 이상이어야 한다. snapshot/단일 관측/`no-chart`는 추세로 그리지 않는다(`PLOT_NOT_CHARTABLE`).
- sibling `.meta.json`이 있으면 같은 `plot_data_sha256`인지, PMC PNG가 있으면 `chart_sha256`이 맞는지 `binding.json`에 기록한다. 없으면 `NOT_FOUND`/`ABSENT`로 정직하게 남기고 통과로 위장하지 않는다. 해시를 다시 써서 편집한 파일은 자체 정합성은 있어도 PMC meta가 더 이상 보증하지 않는다.
- 카드 제목의 `N%` 숫자는 카드가 실제로 보여주는 값이어야 한다(`TITLE_NUMBER_UNGROUNDED`). 부호가 붙은 숫자는 부호까지 맞아야 한다(`-17.3%`는 `+17.3%p`와 다르다). 부호 없는 숫자는 크기로 본다.
- 제목 원천(`title_origin`)을 `binding.json`과 카드 `layers[0].source_ref`에 기록한다. 기본값: `--title`을 주면 `request_summary`(사용자가 쓴 글), 주지 않으면 PMC `meta.title`이므로 `source_verbatim`. `--title` 없이 `--title-origin`을 주면 거절하고(`TITLE_ORIGIN`), `source_verbatim`은 제목이 PMC `meta.title`과 같을 때만 쓴다.
- 제목이 맞지 않으면 `TEXT_OVERFLOW`로 실패한다. 줄이거나 자르지 않는다.
- **범위 한계:** 제목 검사는 `N%` 숫자만 본다. `checkNumericCard`가 보는 제목의 날짜/기간 주장("2주 만에" 등)·footer의 `as_of`/coverage·dual 모드는 이 결합이 적용하지 않는다(`binding.json.numeric_policy_scope`에 기록). 그래서 제목의 날짜·기간 문구와 footer 요건은 owner 검토(§5) 항목이며, 이 결합의 PASS를 numeric-visual 정책 전체 통과로 읽지 않는다.

`verify` 단계(`numeric_lineage_qa`): 차트가 렌더되었는지, 끝점 라벨이 PMC `hero.text`와 같은지, 끝점이 마지막 관측인지, hero/delta 텍스트 레이어가 PMC 문자열과 같은지, 단위 `%`, y축 범위, 관측 개수(segment id가 바뀔 때마다 null 1개 포함, A→B→A는 2개), 관측 기간, 렌더된 spec digest가 bind한 spec과 같은지.

## 4. 그리는 방식과 PMC PNG의 차이 (owner가 알아야 할 것)

- 패널은 **원시 관측점을 직선으로 잇는다.** 평활화·step·면적 채움을 추가하지 않는다. 갭은 별개의 sub-path로 끊고 이어 그리지 않는다.
- PMC는 `history_type == "event"`(거래가 있었던 시점만 기록)를 **step 곡선**으로 그리고 `observed_period` 변화 문구를 자체 규칙으로 쓴다. 이 패널은 같은 점을 직선으로 이으므로 **곡선 모양이 PMC PNG와 다르다.** 두 PNG를 나란히 놓고 어느 쪽이 의도에 맞는지는 owner가 판단한다. 이 경로가 PMC PNG를 대체한다는 주장은 하지 않는다.
- 날짜 표기는 UTC(`관측일(UTC)`)다. PMC PNG는 KST 시각을 쓸 수 있어 같은 관측이 하루 다른 날짜로 보일 수 있다.
- 제목·hero·delta는 PMC가 준 문자열을 그대로 쓴다. delta 문구는 `관측 기간 변화 <PMC delta.text>`이며, 기준 시점이 없는 "7일" 같은 문구는 만들지 않는다.
- 공급자 색: Polymarket cobalt, Kalshi coral은 numeric profile의 값을 그대로 쓰고, 다른 공급자는 중립 색(`#2A7F7A`)이다. 하단은 공급자 이름만 쓴다(URL 없음).

## 5. owner 최종 시각 검토 체크리스트

기계 검증(`numeric_lineage_qa: PASS`)은 숫자·계보 일치만 말하며 **시각 취향, 게시, owner 승인을 증명하지 않는다.** 렌더된 `image.png`(와 비교용 PMC PNG)를 직접 보고 아래를 확인한다.

1. 원본 크기와 휴대폰 폭(약 390px)에서 모두 읽히는가. 큰 hero 숫자와 제목 사이 여백이 과하지 않은가.
2. 긴 한국어 제목이 의도한 줄 수에 들어가는가(`TEXT_OVERFLOW`가 나면 제목을 다시 쓴다, 자르지 않는다).
3. 끝점 라벨, hero, delta가 서로 같은 값을 말하는가. 이 숫자들이 제목/본문의 서술과 모순되지 않는가.
4. 직선 곡선과 PMC의 step/평활 곡선의 차이가 이 게시물의 메시지를 왜곡하지 않는가(특히 `history_type: event`).
5. 갭(데이터 없는 구간)이 눈에 띄고 오해를 부르지 않는가. 관측 수가 적은 카드가 추세처럼 읽히지 않는가.
6. 제목의 날짜·기간 문구가 실제 관측 기간과 맞는가, footer에 정책이 요구하는 기준 시점(as_of)·coverage가 필요한가(§3 범위 한계). 공급자 색·출처 표기가 정책과 같은가. 숫자 QA와 시각 QA는 별개이며 이 둘 다 게시 승인이 아니다.
7. 승인되면 별도 게시 절차(이 저장소 밖)에서 처리한다. 이 경로의 출력은 `RENDERED_NEEDS_REVIEW`다.

## 6. 하지 않는 것

시장 선택·검색(PMC의 일), 실시간 호출·유료 호출·업로드·게시, 다중 outcome 차트, PMC 정책 재구현, owner 승인 대행, 실제 시장 PNG/데이터 커밋. 저장소의 fixture(`scripts/fixtures/pmc-bundle/`)는 **명시적으로 가상인** 실행을 PMC의 실제 `pmc chart` 파이프라인에 통과시킨 것(제목 `(가상 예시)`, `example.invalid` URL)이며 실제 시장 정보가 아니다.
