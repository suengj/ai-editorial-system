# Canonical Prompt Integration — Editorial Design and Audit Note

작성·개정: 2026-09-09. **운영 설계·instruction 감사와 한정된 기계 검증 반례다. 새로운 Writer 품질 인증, production Skill 축소, owner pilot 완료가 아니다.**

기존 Editorial Learning Core의 책임을 유지한다. 자연어 요청을 긴 prompt로 반복하기보다 Intent·Brief·RenderSpec·profile·lineage·승인 자산 계약을 조립한다. 최종 owner-facing 안내는 SUE-571의 실제 pilot 조건을 충족한 뒤 작성한다.

## 1. 정식 소유권

| 대상 | Owner | Prompt 역할 |
|---|---|---|
| 의도·독자·surface·artifact·변환 | EditorialIntent와 선택된 profile | 이번 outcome/delta 전달 |
| 사실·수치·주장 | 원본 Source와 verified claims | source-bound 값을 보존; craft reference는 사실 authority가 아님 |
| 이미지 목적·논지 | VisualBrief | provider-facing 표현 |
| 장면·읽기 순서·사실 배치 | RenderSpec | 의미·정보 위계 보존 |
| 참고 자료의 허용 차원 | registry authority / not_authority | 선택된 craft 차원만 사용 |
| 자산 승인·잠금 | 기존 visual-job approval lock | prompt/gate flag는 승인 증거가 아님 |
| 보관·발행 | publication adapter/repository | 별도 승인 인계와 read-back |
| 과업·수용 기준·dependency | Linear | 현재 work contract의 projection |

[SSOT-BOUNDARIES](SSOT-BOUNDARIES.md), [V2 architecture](V2-EDITORIAL-LEARNING-CORE.md), [VisualBrief/RenderSpec contract](../../schemas/VISUAL-BRIEF-AND-RENDER-SPEC-CONTRACT.md)가 규범을 소유한다. 새 Prompt DB·중복 Intent schema·기사 저장소·범용 agent runtime을 만들지 않는다.

## 2. 자연어 입력과 현재 대상 확인

사용자는 목적과 변경점을 말한다. 예: “수치와 결론은 그대로 두고 번역투만 다듬어”, “승인된 이미지는 건드리지 말고 설명만 수정해”, “reference의 정보 구조만 참고하고 색감은 따라하지 마”. 이것은 새로운 요청 예시이며 실제 승인·대상 상태를 대신하지 않는다.

Agent가 접근 가능한 source, target revision, approved asset identity와 profile을 직접 확인한다. 대상 이미지가 없으면 편집했다고 주장하지 않는다. source로 해결할 수 없는 결과·권한·정확성의 중요한 모호성만 묻는다. reversible default는 task-local 가정이며 durable preference가 아니다.

```text
Owner intent/delta
→ current source/target identity
→ EditorialIntent + source-target delta
→ selected profiles / Skills / reference authority
→ frame / Brief / RenderSpec / audio plan
→ generation
→ actual output evaluation
→ targeted correction or KEEP
→ separate approval / handoff
```

Bootstrap에는 목적·hard boundary·보존할 사실/자산·authority·종료점을 둔다. task context는 필요한 source/profile/Skill만, 깊은 설명은 locator/load condition으로 제공한다. 필수 source가 없으면 UNKNOWN/SOURCE_MISSING으로 해당 동작을 제한하되 안전한 독립 작업까지 막지 않는다.

## 3. 의미·상태·승인의 보존

Adapter는 wording을 바꿀 수 있지만 intent, factual payload, profile, reference authority, 검증과 발행 권한을 바꾸지 못한다. 기존 lineage에 material source/ref와 선택 이유를 연결한다. 동일 normalized input과 deterministic compiler version은 같은 구조화 계약을 생성한다. 자유 prose의 byte 차이는 곧 의미 변화가 아니며, byte identity는 이를 약속한 renderer에만 요구한다.

조립 시점과 실제 rendering/replacement/publication 시점은 다르다. source claim·target revision·승인 digest 변경 시 영향 검증과 승인을 재확인한다. mutation API timeout은 실패 확정이 아니므로 read-back/기존 멱등 계약을 확인한 뒤 재시도한다. 이 설명이 Core runtime enforcement를 구현하지는 않는다.

현재 VisualBrief/RenderSpec의 article-title 외부 처리, craft-only reference, approval lock을 유지한다. SUE-669의 integrated text ownership은 해당 구현·검증 이후에 적용한다. structural text / verified generative fact / deterministic external text 후보도 source binding과 필요한 실제 post-render 검증을 잃지 않는다. prompt 문자열이 정확해도 이미지 글자·수치·가독성이 정확하다는 증거는 아니다.

승인 자산을 무관한 prose 수정 때문에 재생성하지 않는다. 바뀐 자산은 기존 승인을 승계하지 않는다. 정보가 조밀하면 허용된 분할·caption·외부 표현을 검토하고 억지로 글자를 축소하지 않는다. 음성 계획은 음성 생성·청취 인증이 아니며 미인증 lane을 사용 가능하다고 쓰지 않는다.

## 4. Instruction audit — 관찰과 가설

감사 기준: repository `c3e7f49f82671cc4383518938005c063f9376a2f`. 아래 blob identity는 재현 기준이며 현재 상태를 계속 복제하는 ledger가 아니다. 각 행은 해당 `skills/<name>/SKILL.md`의 명시된 절을 검토한 결과다.

| Skill / baseline blob | 감사한 절과 판정 | 지금 유지 / 이후 후보 |
|---|---|---|
| write-article / `3b2f7f7c95e04892138c4597ef7b50a3ad9d6372` | Preconditions·capability·authority·invariants는 KEEP_ALWAYS; Procedure의 상세 합성/문체 설명은 LOAD_ON_DEMAND 또는 REFERENCE/EVAL 후보 | 이미 frame 순서 재배열과 높은 Writer 하한이 있다. thesis·verified claims·citation·한국어·content type·human boundary는 유지. active Skill 축소 없음 |
| frame-article / `a7c718fb1417530a13a63a26049dfd61837c2ddc` | frame-before-prose, source weights, claim class, NO_ARTICLE은 KEEP; 선택 reference/상세 framing 예시는 task/reference | 이미 조건부 reference loading이 있다. 좋은 framing을 형식 채우기로 대체하지 않음 |
| editorial-polish / `fb8eff11f18c589814a924ddb713765d3c7a73d5` | KEEP, 의미·불확실성·사실 보호, semantic pairwise review는 KEEP; soft detector/기법 예시는 EVAL/REFERENCE 후보 | 기계적 span 보존만으로 의미 검증을 대체하지 않음. 정상 문장은 보존하고 doubtful change는 되돌림 |
| review-l1 / `87dbbf98dd32ce4334c9301302e04a96e4a235b3` | Evidence와 Invariants를 대조. 비교 차원·evidence span·tie/abstain·integrity 우선·human authority는 KEEP | 이미 작은 reviewer 계약이다. “모든 invariant를 기계적으로 강제”하는 포괄 표현만 교정; 의미 판정과 기록 구조를 분리 |
| verify-claims / `9315dc55538a35debc7a3be6dfa735b7ab958982` | Source·status·immutable claim/lineage·권한 경계는 KEEP_ALWAYS; 기술적 설명은 필요 시 reference | 사실 안전을 사후 스타일 evaluator로 이동하지 않음. status 어휘 정합은 기존 schema-parity 책임에서 확인하며 이 감사로 임의 수정하지 않음 |
| compile-visual-story / `b6660c28243c58ffca202a38d2475975717f17c5` | Procedure 1의 surface별 조건부 load는 KEEP; beat/schema 예시는 REFERENCE 후보 | 이미 전체 style 문서 로드를 금지하고 계획/실제 media QA를 분리. 현재 visual 구현을 이 실험으로 막지 않음 |
| compile-audio-script / `ff54b0e58771c5afc466721708594b3b105d33f4` | selected profile, verified carried claims, clean narration, renderer 권한 분리는 KEEP | provider-neutral pronunciation/timing 예시는 REFERENCE 후보. 실제 청취·render 검증은 별도이며 축소하지 않음 |

**발견된 반례:** Writer autonomy와 KEEP이 이미 있어 “현재 Skill은 강한 Writer를 단순 실행자로 만든다”는 일괄 진단은 부정확하다. instruction density가 실제 품질을 억누른다는 인과관계도 아직 미측정이다.

Disposition은 KEEP_ALWAYS / LOAD_ON_DEMAND / MOVE_TO_REFERENCE / MOVE_TO_EVAL / MOVE_TO_EXECUTABLE_GUARDRAIL / MOVE_TO_OPERATOR_PROFILE / DELETE_OR_RETIRE로 설명한다. 이들은 상호 배타적이지 않다. 안전 규칙은 generator cue, 실행 통제, negative eval에 함께 남을 수 있다. 모델·effort·비용은 [WRITER-MODEL-ROUTING](WRITER-MODEL-ROUTING.md)과 current profile이 소유한다. 즉시 RETIRE하는 것은 포괄적인 기계 검증 보장 표현이지 품질·권한 규칙이 아니다.

## 5. 실제 기계 검증 반례

`assessPolish()`는 protected-span multiset을 비교한다. 정확한 baseline module blob은 `174b36a51d19ae1ddf7c3090863c9bd7c2475bb7`이며 다음 synthetic pair를 실행했다. 실행 Node version은 결과에 기록한다. 변경한 것은 이 함수의 보장 범위를 설명하는 JSDoc뿐이며 계산 로직/API는 유지한다.

| 사례 | 기계 검사 | 명시한 semantic fixture 판정 |
|---|---|---|
| 동일 문장 | ok=true, changed=false | KEEP |
| 매출 20원 → 30원 | ok=false | REJECT: factual amount 변경 |
| 매출20/비용10 → 매출10/비용20 | ok=true | REJECT: entity와 quantity의 결합 변경 |
| “신호로 읽힌다” → “신호다” | ok=true | REJECT: qualification 삭제 |
| “입증되지 않았다” → “입증되었다” | ok=true | REJECT: negation 반전 |

세 semantic-invalid pair의 mechanical PASS는 **검사 범위의 한계**를 보여준다. 전체 pipeline이 이를 승인한다는 뜻도, 실제 운영 오류율도 아니다. 기존 editorial-polish의 의미 비교와 human gate가 여전히 필요한 이유다. synthetic semantic labels는 평가 모델의 실험 결과가 아니다.

재현:

```bash
node --check scripts/test-polish-assurance-boundary.mjs
node scripts/test-polish-assurance-boundary.mjs
```

[fixture](../../evals/prompt-migration/polish-assurance-boundary.json)는 입력·기대 기계 결과·semantic label을 보존한다. 실행 결과는 source/fixture git blob과 Node version을 출력한다. 이것은 repository test contract에 포함된 targeted test이며, semantic approval이나 전체 npm test의 대체가 아니다. 후속 구현이 검증 범위를 넓히면 기대 결과도 근거와 함께 명시적으로 갱신한다.

## 6. 비활성 Writer 후보와 검증 순서

[Writer candidate](../../evals/prompt-migration/write-article-candidate.md)는 평가 전용이다. Skill 등록·routing 변경·production adoption을 하지 않는다. hard invariant, native Korean positive goal, source/claim/citation, content type, human authority와 PROSE_HIGH를 보존한다. 자세한 문체/합성 예시를 필요 시 읽는 방식이 실제로 유리한지 SUE-732에서 확인한다.

먼저 동일 Writer/model/effort/tool permission/topology/source/frame/profile에서 instruction family 하나만 바꾸는 ablation을 수행한다. 이후 Legacy / Thin / Hybrid 전체 운영 구성을 비교한다. prompt와 reviewer 구성을 동시에 바꿔 얻은 결과를 prompt 길이의 효과로 설명하지 않는다. Thin이 프로젝트 assurance 하한을 깨면 부적격이다.

실제 source 접근, loaded Skill/reference, host-hidden context를 기록한다. 파일 bytes는 input tokens나 비용이 아니고, reference로 옮겨 다시 읽은 자료도 비용에 포함된다. 생성·retrieval·review·수정·실패를 합친 비용과 first-pass acceptance, 한국어 자연스러움, translationese, source-tour, voice overfit, coherence, claim accuracy, human intervention을 본다. blind pairwise·holdout·tie/abstain을 사용하고 critical integrity/authority 회귀는 스타일 이득보다 우선한다.

현재 모델 기반 Legacy/Thin/Hybrid 비교는 NOT_RUN이다. 후보 작성·static 검사·위 5개 반례 실행만으로 품질 또는 토큰 절감률을 주장하지 않는다. 소규모 pilot은 보편 우월성 증명이 아니다.

## 7. 실패한 층만 수정한다

논지/독자 문제는 Intent·frame, 수치/인용 문제는 Source·verification, 한국어 문제는 적정 Writer·profile·language evaluation, 정보 과밀은 Brief/RenderSpec, 잘린 글자는 실제 render QA, 일회성 취향은 task-local instruction으로 보낸다. 반복 피드백도 자동 durable preference나 source authority가 아니다.

강한 Manager는 최종 prose Writer의 낮은 역량을 보상하지 못한다. source-target delta와 승인 자산은 보존하고 정상 문장을 전면 재작성하지 않는다. 어떤 validator의 PASS든 해당 실행에서 실제로 검사한 속성만 의미한다. 기록의 형태가 유효하다고 claim truth, 의미 보존, 한국어 품질, 실제 render, human approval이 입증되지는 않는다.

## 8. 기존 작업과 rollout

SUE-731은 이 감사·정확한 assurance 표현·synthetic assurance fixture를 소유한다. SUE-732는 benchmark 후 frame/write/polish/review/verify 순으로 bounded relocation을 판단하고, visual/audio는 해당 기존 owner와 별도 검증 후 적용한다. SUE-564는 실제 corpus, SUE-571은 pilot-backed owner guide, SUE-669는 integrated visual prompt 책임을 유지한다. 완료된 Skill/routing/polish 과제는 재오픈하지 않는다.

source missing, source/target revision 변화, reference authority injection, approved-image 보존, 실제 이미지 수치 불일치, 기존 text-free 호환, 음성 미인증의 기존 검증 요구도 유지한다. prompt가 존재함·compiler 지원·산출물 수용·발행 승인은 서로 다른 상태다.

적용은 candidate → controlled comparison → bounded owner-reviewed pilot → profile/version별 adoption이다. claim/authority 또는 중대한 품질 회귀가 발생하면 이전 Skill/profile ref로 복구하고 실패 이력은 남긴다. repo-specific required validation이 미실행이면 NOT_RUN으로 남기며 audit 완료가 merge/production readiness를 대신하지 않는다.
