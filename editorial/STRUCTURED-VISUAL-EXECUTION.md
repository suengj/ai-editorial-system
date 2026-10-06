# Structured Visual Execution — 공통 이미지 실행 진입점

상태: SUE-1333–1336의 제한된 로컬 실행 연결. **SUE-1337 Phase 4의 새로운 대화/native 이미지 생성·실사진·실데이터 UAT는 사용자 진행**이다. 파일 생성은 시각 승인이나 게시 승인이 아니다.

사용자는 “1:1 카드, 심플하게, 사진은 오른쪽, 이 데이터는 그래프로, 남색과 아이보리, 워터마크 없음”처럼 말한다. LLM/agent가 아래 과정을 실행한다. 사용자에게 JSON 작성이나 모든 옵션 선택을 요구하지 않는다. 이 가이드는 새 이미지 엔진이 아니라 기존 규칙과 실제 도구 사이의 공통 진입점이다.

카드뉴스/여러 장 요청은 아래 **§9 시리즈 실행**으로 이어진다. 기존 단일 이미지 경로와 승인 경계는 유지한다.

## 1. 처음 읽을 것과 재사용 경계

| 판단/기능 | 기존 정본/실행 경로 |
| --- | --- |
| 자연어 요구·중요한 모호성 | `skills/intake-request/` |
| 기사 파생 이미지의 필요성·사실/정보량 | `skills/plan-artifacts/`, `VISUAL-INFORMATION-GAIN.md` |
| 정보 구조와 스타일의 분리 | `VISUAL-STRUCTURE-AND-LANGUAGE.md` |
| 카드/인포그래픽/보고서의 구조 | `profiles/artifact/`, `INFOGRAPHIC-AND-POSTER.md`, `skills/compile-slide-deck/` |
| 소비 환경·브랜드·선택 레퍼런스 | 기존 `profiles/` registry와 `scripts/lib/profile-core.mjs` |
| 기사 기반 의미/참조/생성 프롬프트 | 기존 VisualBrief·RenderSpec·visual-job, `scripts/compile-visual-prompt.mjs` |
| 문자 소유권·워터마크 | `IMAGE-TEXT-RENDERING-PROFILES.md`, 기존 `scripts/lib/watermark-core.mjs` |
| 데이터 증거 그림 | 기존 `scripts/lib/chart-renderer.mjs`; 기존 API는 유지하고 `renderChartPanel`을 추가 |
| 로컬 합성·실행 기록 | `scripts/render-visual.mjs`, `scripts/lib/visual-execution-core.mjs` |
| 원본/승인 master·게시 | `APPROVED-VISUAL-ASSET-LIFECYCLE.md`, 기존 publisher/manifest 계약 |

이 표 전체를 매 요청마다 프롬프트에 복제하지 않는다. 공통 가이드 + 선택된 artifact/surface + 필요한 데이터/사진/텍스트 규칙만 읽는다. 숫자 없는 카드에 예측시장 정책을 로딩하지 않는다. 참조는 스타일/정보 구조 근거이지 사실 출처가 아니다.

## 2. LLM 실행 순서

1. **요청과 소재를 읽는다.** 새 이미지인지 기존 이미지 수정인지 구분한다. 글, 사용자 메시지, 데이터, 사진, 레퍼런스 중 실제 읽을 수 있는 파일만 사용한다. 수정 대상이 없으면 원본부터 받는다. 권리·내용·시각을 추측하지 않는다.
2. **구조를 먼저 정한다.** 한 장의 주요 질문/주장, 읽는 사람, 정보 역할, 시리즈 필요성을 정한다. Instagram은 surface이고 인포그래픽은 artifact다. 보고서 구조가 삼성/남색 스타일을 뜻하지 않는다. 기사 기반이면 기존 article/claim·information-gain 경로를 우회하지 않는다.
3. **명시값과 기본값을 분리한다.** 해당 작업의 비율·문구·색상·워터마크 지시가 호환 가능한 기본값보다 우선한다. 원본·사실·기존 승인 잠금은 보존한다. “심플”은 장식/인지부담을 줄이라는 뜻이지 필수 사실을 빼라는 뜻이 아니다. 계정 preset은 작업 옵션이며 게시 인증 정보와 분리한다.
4. **레이어를 배정한다.** 이미지 모델은 필요한 장면/일러스트를, 기존 데이터 도구는 차트의 관측값·축·좌표를, 로컬 합성은 실제 사진·정확한 문자·선택 워터마크를 담당한다. 사진+차트+문자+생성 장면은 한 이미지에 함께 들어갈 수 있다.
5. **환경을 확인하고 실행한다.** 현재 도구의 실제 기능과 파일 접근을 확인한다. 누락된 생성 레이어는 도구로 만든 후 실제 PNG 파일을 연결한다. 참조 ID/파일명만으로 bytes가 있다고 가정하지 않는다. 필요 없는 이미지 생성 API는 호출하지 않는다.
6. **검토하고 필요한 부분만 수정한다.** 실제 크기/한글/사진 보존/배치/축·단위·값/정보 구조를 확인한다. 스타일 수정 때문에 source나 채택 master를 다시 그리지 않는다. 바뀐 결과가 이전 게시 승인을 자동 상속하지 않는다.
7. **요청된 전달만 한다.** 출력과 명세/영수증을 기존 content manifest에 참조한다. Drive 저장은 실제 업로드·readback이 있을 때만 완료다. 이 도구는 업로드/게시/자동화를 수행하지 않는다.

가역적인 여백/색상 선택은 작업 기본값으로 진행하고 기록한다. 사실, 읽을 수 없는 소재, 불가능한 명시 제약만 질문한다. JSON은 LLM이 작성하는 내부 실행 자료이며 사용자 입력 양식이 아니다.

## 3. 같은 규칙, 두 실행 경로

**기사/기존 visual-job**: 실제 job을 `job_ref`로 연결한다. 기존 validator와 prompt compiler를 호출하며 VisualBrief/RenderSpec를 execution packet에 참조한다. 승인 잠긴 job은 기존 approved-media 경로로 보내고 새 생성 packet으로 열지 않는다. 작업별 합성 옵션은 원래 compiled prompt를 손으로 고치는 근거가 아니다. 기사/claim 승인 경로의 통합 실증은 Phase 4에서 별도로 확인한다.

**글 없는 source-only 요청**: 원자료 파일과 요청에서 시작한다. 실행 sidecar를 사용하고 가짜 `article_id`/claims를 만들지 않는다. source-only 로컬 문자/사진/차트 합성과 준비된 생성 master를 지원한다. 이것은 기사 기반 VisualBrief의 대체 스키마도, 자동 사실 검증기도 아니다. `source_bound`는 파일 연결 상태이지 사실 검증 통과가 아니다. 가상 자료는 `illustrative`로 표시하며 실제 수치의 근거로 쓰지 않는다.

기존 integrated generated text·verified-generative-fact 경로는 그대로 유지한다. 로컬 compositor는 지정한 문자 레이어만 정확하게 조판한다. 기사 기반 통합형 생성 결과의 사실/텍스트 검증을 이 도구의 `text_fit` 결과로 대체하지 않는다.

## 4. 실제 실행 명령

Node.js 22 이상과 **rsvg-convert 또는 RSVG 지원 ImageMagick**이 필요하다. 한글 glyph를 제공하는 설치 폰트도 필요하다. 이 CLI는 도구를 설치하거나 폰트를 다운로드하지 않는다. 생성 도구/원본 읽기/합성 기능은 각각 별도 capability다.

아래는 LLM/개발 agent가 실행할 명령이다. 첫 예제는 가상 자료의 조판 smoke이며 이미지 모델 시안이 아니다.

```bash
node scripts/render-visual.mjs \
  --plan scripts/fixtures/visual-execution/card.json \
  --out /tmp/aes-card-first

node scripts/render-visual.mjs \
  --plan /path/to/llm-resolved-plan.json \
  --preset /path/to/account-visual-options.json \
  --out /tmp/aes-candidate-second \
  --rasterizer auto

node scripts/render-visual.mjs \
  --plan /path/to/llm-resolved-plan.json \
  --out /tmp/aes-plan-only --compile-only

node scripts/test-visual-execution.mjs
```

`--out`은 **새 빈 디렉터리**다. 재실행은 기존 입력/master에서 새 출력 디렉터리로 한다. 오래된 PNG를 실패한 새 실행의 결과로 착각하거나 입력을 덮는 일을 막는다. 완성 결과는 `image.png`, 깨끗한 합성 원본은 `master.png`/`master.svg`, 재실행 설명은 `execution.json`/`receipt.json`이다. 디렉터리 존재만으로 성공을 판단하지 말고 receipt 상태와 출력 hash를 확인한다.

원본 그림/글꼴 파일을 저장소에 넣지 않는다. 실제 사용자 파일은 기존 Drive/local locator, 생성물은 기존 전달 계층에 두며 이 저장소에는 작은 가상 테스트 자료만 둔다.

## 5. 내부 실행 sidecar의 최소 구조

현재 버전 `1.0.0`. `compileExecution`이 unknown field·프로필 적합성·실행 제약을 검증한다. 예시는 `scripts/fixtures/visual-execution/card.json`; source-bound line/bar spec 예시는 같은 폴더다.

| 필드 | 의미 |
| --- | --- |
| `request` | 원래 자연어 요청. 코드는 문장의 의미를 자동 이해하는 또 다른 LLM이 아니다. |
| `source.ref / sha256 / scope` | plan 기준 로컬 원자료 경로, 선택적 예상 digest, source_bound 또는 illustrative |
| `profiles.surface / artifact / brand` | 기존 registry ID. brand는 선택 사항. 새로운 style/account 축 없음. |
| `task.canvas` | width/height 또는 width/aspect_ratio. 비율만 주면 선택된 폭을 사용. |
| `task.theme` | background/foreground/accent의 실제 #RRGGBB, font_family. 요청/정식 token에서 resolve한 값. |
| `task.density / text_policy` | 기존 semantic/visual density 및 text ownership 의도. 실제 밀도 평가는 렌더 후 사람/vision이 수행. |
| `task.watermark / watermark_layer` | 기존 default-OFF 설정; overlay 또는 독립 background 레이어. |
| `layers[]` | 순서가 z-order. 종류는 text, image, chart, generated; 배타적 이미지 family가 아님. |
| `layers[].slot` | x/y/width/height 모두 0–1 정규화 좌표. 최종 pixel 좌표도 기록. |
| text 레이어 | text, source_ref, font_size/weight/align/max_lines/line_height/color. source_ref는 request 또는 실제 입력 ref. |
| image/generated 레이어 | 실제 ref, rights_note, 선택 digest, contain/cover, exact_composite/cutout_composite, 보호 영역 protect. |
| chart 레이어 | 기존 chart JSON ref. 관측값을 생성 프롬프트에 다시 입력하지 않음. |
| ref 없는 generated 레이어 | instruction을 담은 RENDER_REQUIRED. 실제 그림을 만든 것처럼 성공 처리하지 않음. |
| `caption / job_ref` | 선택 caption, 실제 기존 visual-job 파일. 게시 권한을 담지 않음. |

프로필은 의미/정보량의 기준을 제공하지만 로컬 helper가 자동으로 멋진 레이아웃을 발명하지는 않는다. LLM이 기존 editorial 구조를 바탕으로 slot/문구량을 정한다. 미지정 exact 색상의 로컬 기본값은 **renderer default**로 기록하며, suengj.com의 정식 token이라고 가장하지 않는다. versioned brand 파일을 덮어쓰지 않는다.

## 6. 사진·차트·워터마크 처리

**사진/스크린샷**: v0.1 로컬 입력은 비인터레이스 8-bit RGB/RGBA PNG다. 다른 형식은 기존 도구로 명시적으로 변환하고 원본 hash와 변환을 별도로 보존한다. `exact_composite`는 source bytes를 그대로 보관하면서 선언한 scale/crop만 한다. 출력 리샘플링 hash가 원본과 같아야 한다는 뜻이 아니다. cutout은 실제 alpha가 있는 준비된 PNG를 사용한다. 자동 배경제거/inpainting은 이 CLI가 하지 않는다. 보호 영역을 자르는 cover는 거절한다.

**생성 배경/국소 수정**: 실제 생성 도구가 사용 가능할 때만 실행한다. 원본 사진은 다시 그리게 하지 않고 최종 단계에서 재합성한다. 마스크 지시만으로 원본 픽셀 불변을 보장하지 않는다. 준비된 master를 후속 요청에서 재사용하며, 채택/승인된 asset은 기존 잠금 정책을 따른다.

**차트**: `renderChartPanel`은 기존 모듈 안의 line/단일-series bar 확장이다. 원래 `renderChart`·Mermaid 경로는 바꾸지 않았다. 숫자 finite, 시간/x 순서, unit/period/source, 데이터가 축 밖으로 잘리지 않는지 확인한다. null은 선을 끊고 임의 보간/이동평균/forward-fill하지 않는다. 일반 건수/가격 차트에 확률 0–100/%p 규칙을 강제하지 않는다. 더 복잡한 차트는 기존 producer가 만든 PNG를 원본 증거 레이어로 사용한다.

예측시장은 `INSTAGRAM-NUMERIC-VISUAL-POLICY.md`와 PMC producer가 데이터·단위·quote/history·보간·비교 의미를 소유한다. 이 일반 line/bar helper로 PMC 정책이나 검증된 producer 렌더를 대체하지 않는다. 기존 PMC PNG를 합성하고 bundle/source hash를 유지하는 것이 먼저다. 실제 PMC bundle 결합은 Phase 4의 UAT 항목이다.

**워터마크**: OFF는 master와 byte-identical. ON은 기존 watermark 엔진의 glyph/제외 영역 검사와 합성을 사용한다. background 모드는 분리된 배경에만 적용하므로 실제 그림 아래에 놓을 수 있다. 이미 납작해진 PNG 내부의 차트 뒤로 넣을 수 있다고 주장하지 않는다. source credit, 페이지 수, 계정 브랜드 문구는 다른 역할이다. 워터마크는 복제 방지를 보장하지 않는다.

## 7. 실패와 재생산성

`RENDER_REQUIRED`는 생성 자산 미준비, `COMPOSITION_REQUIRED`는 미실행/도구 미준비, `RENDERED_NEEDS_REVIEW`는 파일 생성 후 검토 대기다. CLI exit 2는 미완료, exit 1은 오류다. 존재하지 않는 PNG/Drive URL을 만들지 않는다.

문구가 안 맞으면 `TEXT_OVERFLOW`: 실제 glyph 측정으로 확인하며 임의 축약/사실 삭제/무한 축소를 하지 않는다. source hash 변경, 보호 crop, 텍스트/증거 위 덮어쓰기, 중복 워터마크, 잘못된 축은 각각 실패한다. 로컬 검증은 사실 의미·시각적 취향·승인 상태를 대신하지 않는다.

`request_hash`는 입력 요청 명세, `execution_hash`는 resolve된 프로필·preset·source/레이어 hash·옵션을 포함한다. renderer/version/font stack과 실제 output hash도 별도로 기록한다. SVG rasterizer의 생성시각 메타데이터만 정규화해 결정론적 출력 비교를 가능하게 한다. 입력 파일은 변경하지 않는다. 다른 폰트나 renderer 버전까지 동일 픽셀을 약속하지 않으며, 이미지 모델의 재호출은 결정론적 재현으로 취급하지 않는다.

## 8. Phase 4에 넘길 확인 항목

새 대화에서 이 가이드만 진입점으로 삼아 실제 native 생성→bytes 확보→합성이 가능한지 확인한다. AI-tech 카드, 사진 카드, 실데이터 카드, 블로그 인포그래픽, 보고서와 3-frame 시리즈를 검토한다. 워터마크/제목/색상/비율만 바꾸는 후속 요청에서 원본과 사실이 보존되는지 확인한다. 실제 계정 preset·Drive 전달·기사 job 통합은 검증한 범위만 기록한다. headless 성공을 native 성공으로 대신하지 않는다.

전체 owner playbook(SUE-571)은 이 **같은 진입점**을 참조한다. 이 문서를 복사한 채널별 프롬프트 매뉴얼을 만들지 않는다.

## 9. 카드뉴스: 한 장씩 다시 설계하지 않는 시리즈 실행 (SUE-1345)

카드뉴스 요청은 [SLIDES-AND-CAROUSELS.md](SLIDES-AND-CAROUSELS.md)의 `silent_carousel`과 §11 시리즈 일관성 계약을 먼저 적용한다. 보고서에서 주장→근거→의미의 연결을 차용하되 `working_report`의 높은 밀도를 옮기지 않는다. 인포그래픽의 한 질문·시각 위계 원칙을 재사용하되 긴 한 장을 기계적으로 잘라 카드로 만들지 않는다. 각 카드에는 주요 기능 하나와 이전/다음 카드와의 관계가 있어야 한다.

자연어 요청 예:

> 이 자료로 4:5 카드뉴스 3장을 만들어줘. 표지는 질문, 가운데는 근거, 마지막은 의미를 보여줘. 미니멀 에디토리얼로 하고 제목·출처·페이지 번호는 통일해. 숫자와 사진은 원본을 보존하고 워터마크는 빼줘. 2장 문구만 수정하면 나머지는 그대로 유지해.

3장은 예시이지 고정 서사나 장수 규칙이 아니다. 사용자가 지정한 구성·장수와 자료의 beat를 바탕으로 LLM이 필요성/분할/순서를 결정한다. `beats`는 기존 Visual Story Plan의 필요한 ID·의존성을 실행용으로 투영한 것이며 두 번째 논지/사실 정본이 아니다. 기사 파생이면 기존 article/claim 계획과 실제 `job_ref`를 유지한다. 글 없는 요청은 §3 source-only 경로를 따른다.

### 선택한 recipe와 공통 규칙

[`visual-recipes.v1.json`](visual-recipes.v1.json)은 기존 task preset의 작은 조합이다. 새로운 style axis, 계정 DB, 전역 brand 변경이 아니다.

| Recipe | 구성 방향 | 사실/시리즈 경계 |
| --- | --- | --- |
| `editorial-minimal` | 아이보리·남색, serif 중심, 타이포와 여백 | 정확한 문구·출처·페이지는 공통 조판 |
| `dark-data` | 어두운 배경·밝은 강조색, 근거 그림 중심 | 실제 차트는 기존 renderer; 가상 성과 수치 금지 |
| `pop-collage` | 강한 대비·콜라주 소재, 생성 그림 비중 확대 | 그림은 내용 슬롯 안에서 표현; 반복 문구는 별도 조판 |

recipe 선택은 이번 작업의 디자인 지시다. 실제 brand/reference 권한과 사실·잠금을 우회하지 않는다. 호환 가능한 `task.theme`·`task.canvas` 지정이 recipe 기본값보다 우선한다. 한 시리즈에서는 색상·비율·역할별 타이포를 한 번 결정한다. 개별 카드가 임의로 다른 글자 크기/색으로 바꾸는 대신 시리즈 공통 옵션을 바꾸거나 카드를 분할한다. 한 번의 피드백을 영구 선호로 저장하지 않는다.

현재 로컬 recipe는 본문 `text`, 근거/사진 `visual`, 좌우 비교 `split`의 세 가지 layout을 지원한다. 같은 시리즈에서 내부 layout은 달라도 eyebrow/headline/source/pagination은 공통 영역이다. 더 복잡한 infographic/report layout이나 전체 화면 integrated art는 기존 해당 경로를 사용하고 이 단순 preset이 모든 미감을 재현한다고 주장하지 않는다.

### 실행과 결과

```bash
# 계획만 확인: 실제 원본 bytes/폰트/시각 품질 검증은 아님
node scripts/render-carousel.mjs --plan scripts/fixtures/carousel/series.json \
  --out /tmp/aes-series-plan --compile-only

# 기존 single-image executor로 전체 시리즈 렌더
node scripts/render-carousel.mjs --plan scripts/fixtures/carousel/series.json \
  --out /tmp/aes-series-first

# 같은 series_id의 수정 명세: 바뀌지 않은 프레임은 검증 후 재사용
node scripts/render-carousel.mjs --plan /path/to/revised-series.json \
  --previous /tmp/aes-series-first --out /tmp/aes-series-revised

# 로컬 회귀 검사; CI를 실행하는 명령이 아님
node scripts/test-carousel.mjs --render
```

내부 `series.json` 입력은 LLM/agent가 작성한다. 기본 필드는 `series_id / request / source / profiles / recipe / series_label / beats / frames`다. `profiles.artifact`는 기존 `visual/slide-image`를 사용한다. 각 frame에는 `id / function / beat_ids / takeaway / alt_text / headline / source_note / layout / blocks`가 있다. `blocks`의 text/image/chart/generated는 기존 레이어로 변환한다. source·chart·photo 경로는 입력 명세 파일 기준으로 해석된다. `task / typography / regions / layouts`는 시리즈 공통 override다. 지원하지 않는 필드를 조용히 버리지 않고 거절한다.

각 frame은 `master.png / image.png / master.svg / execution.json / receipt.json`과 390px 폭 `phone.png`를 만든다. 전체에는 `series.json`, `contact-sheet.png`, `review-worklist.json` 및 frame별 실행 plan이 남는다. 합성기는 게시하지 않으며 manifest는 실제 출력 순서와 해시를 제공한다. 1–20 frame은 v0.1 로컬 자원 한도일 뿐 Instagram API 한도에 대한 주장이 아니다.

### 영역 보호와 국소 수정

반복 영역과 내용 슬롯은 0–1 좌표로 표현하고 실제 pixel slot으로 변환한다. 영역 충돌/알 수 없는 슬롯/중복 ID/누락된 beat/의존성 역전은 컴파일 시 거절한다. 생성 모델에는 선택한 미술 방향과 내용 슬롯의 역할을 전달한다. **빈 공간을 남기라는 프롬프트만 믿지 않고, 합성기가 생성 자산을 슬롯에 clip/fit한다.** 이는 슬롯 밖 덮어쓰기를 막는 것이며 그림 속 피사체의 품질이나 의미까지 보장하지 않는다. 정확한 원본 인물/제품은 기존 source-asset 합성을 이용한다.

글이 넘치면 실제 glyph 측정에서 `TEXT_OVERFLOW`다. 자동 축약·작은 글자로 땜질·새 사실 생성은 하지 않는다. LLM이 필요한 qualifier를 지키며 문구를 재작성하거나 다음 카드로 분할한다. 기본 후보는 1개; 실제 실패가 확인되면 해당 프레임/레이어부터 수정한다. 무조건 A/B/C 생성이나 10–20장 실험은 요구하지 않는다.

`--previous`는 source/레이어/선택 recipe/프로필/실행 코드·rasterizer·관측 가능한 폰트 환경과 이전 출력 해시가 같은 프레임만 새 디렉터리에 복사한다. 이전 bytes가 달라졌으면 거절한다. Fontconfig 환경을 관측할 수 없으면 재사용을 생략하고 렌더한다. 단순 명세만 같은 것이 재생산성 증거는 아니다. 생성 자산의 새 호출은 이 캐시가 대신하지 않으며 font/runtime이 다른 환경까지 같은 픽셀을 약속하지 않는다. 재사용한 이미지라도 시리즈 맥락이 달라졌으면 다시 의미를 검토한다. 승인 상태는 자동 상속하지 않는다.

### Visual QA는 기존 reviewer에게 연결

`review-worklist.json`은 **검토 대상 목록이지 검토 통과 기록이 아니다.** 기존 `skills/review-visual/`, SUE-646/647 및 §11 시리즈 검토로 각 full/phone 이미지와 전체 contact sheet를 확인한다. focal hierarchy, balance/whitespace, text readability, visual density, style coherence, 사진/차트 충돌, 카드 순서·반복 역할의 일관성을 구분한다. `dashboardization`, `box_overload`, `dense_text`, `style_dilution`, `reference_drift`, `factual_overlay_intrusion` 등 기존 실패 태그를 사용한다. 요청한 dark-data 방향을 무조건 dashboard라는 이유만으로 탈락시키거나 pop-collage를 모든 계정 기본 스타일로 승격하지 않는다.

로컬 출력은 `RENDERED_NEEDS_REVIEW`다. 실제 원자료 진실/미감/게시 승인은 따로 확인한다. 생성 bytes가 없으면 `RENDER_REQUIRED`, 일부 프레임이 미완료면 시리즈는 `INCOMPLETE`이며 완성 contact sheet를 만들지 않는다. 이미지 모델 호출, 자동 inpainting/배경제거, native ChatGPT의 bytes 인계 및 실제 사용자 사진·PMC·블로그/보고서 미감 검증은 이 로컬 테스트로 통과시키지 않는다. SUE-1337 Phase4는 계속 사용자 담당이다.
