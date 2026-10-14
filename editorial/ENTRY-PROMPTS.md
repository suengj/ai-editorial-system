# Entry prompts (SUE-1426 R5)

Short starting text for the common editorial entry. **Having this file in the repo does not load it anywhere.**
Nothing here is auto-applied to a ChatGPT project, a chat, the registry runner or any agent.

| Where | State |
| -- | -- |
| New ChatGPT conversation | `HUMAN_REQUIRED` / `NOT_APPLIED` — paste prompt A as the first message (or into the project's instructions). ChatGPT-native cannot run the Node commands; it can only read the listed files and follow the rules. |
| Existing local/server agents (Claude Code, Codex-class, registry runner) | Repo-root `AGENTS.md` / `CLAUDE.md` now expose the selected task entry to compatible agents; **runtime discovery is not verified**. If the agent does not load repository instruction files, install prompt B explicitly. A Registry `aes_entry` by itself does not execute Node. |

Targets: `personal-linkedin`, `personal-instagram`, `signalytics-news`, `trends-moa` (list: `node scripts/resolve-editorial.mjs --list-targets`).
Existing non-SNS flows: `blog`, `news`, `report` (`--list-targets --flows`). Other channels are not mapped.

## 2026-10-14 P0 repository activation

- **Compatible coding agents:** the root `AGENTS.md` and `CLAUDE.md` route editorial tasks to this file and `editorial/entry-manifest.json`. This is repo-local discovery, not a guarantee that every CLI or hosted agent reads them; confirm the actual selected profile in its receipt.
- **Registry selected jobs:** `ai-workflow-registry/dispatcher.yaml` names the selected-job-only `aes_entry` bootstrap and tells an interpreting runner how to load only the chosen manifest rules. It is a declarative contract, **not** proof that ChatGPT's current scheduled task prompt incorporated the update.
- **ChatGPT Project / independent new chats:** still `HUMAN_REQUIRED / NOT_APPLIED` until the operator pastes section A into that Project's instructions or the conversation. GitHub access cannot edit the ChatGPT Project's UI settings. Do not claim global activation by merging this commit.
- **No fabricated E2E:** the script/manifest connection, exact PNG proof and local tests remain separate from a real ChatGPT-native image generation run and owner visual acceptance.
- **trends.moa:** current owner-selected production HIGH intensity is the default in `entry-manifest.json`, matching Registry `production-v2.yaml`; explicit task overrides remain governed by the normal field-wise precedence rules.

## Owner-approved personal excerpt lookup (2026-10-14)

For personal LinkedIn/Instagram only, the ten owner-approved **sentence-level** positive examples are indexed by `editorial/approved-examples.json` with `kind: owner_selected_excerpt`. They do **not** enter the generic L1 real-output corpus. No other target may use them.

Routine writing stays style-description-only. On `ambiguity`, `failure` or `quality_comparison`, the current resolver returns **at most three metadata pointers**. If `private_read_required:true` or `source_text_read:false`, an authorized calling agent must follow only those selected commit-pinned private `suengj/intelligence-library` file line references and read their exact text using available tools. Do not load the 132-post source corpus; do not infer access from URL existence; if a line is unavailable, report `PRIVATE_REFERENCE_UNAVAILABLE`, not source text read or style match. Never reveal private Google Doc identifiers or excerpt text in the public repo, or use this personal voice for Signalytics/trends.moa/non-SNS flows.

`editorial/SUENGJ-STYLE-20261014-PROPOSAL.md` is only a candidate for later approval. The canonical `editorial/SUENGJ-STYLE.md` remains unchanged.

## A. New ChatGPT conversation

```text
suengj/ai-editorial-system 의 editorial/entry-manifest.json 을 먼저 읽고, 내가 말한 대상(personal-linkedin / personal-instagram / signalytics-news / trends-moa, 또는 blog / news / report)에 해당하는 항목이 지정한 파일과 task_kinds 의 core 파일(글: editorial/constitution.md, editorial/voice.md / 이미지: editorial/constitution.md, editorial/STRUCTURED-VISUAL-EXECUTION.md)과 axis_profile_paths 의 해당 축 profile 만 읽어라(그 밖의 README·문서 순회 금지). 다른 계정의 말투 문서는 읽지 마라. 읽지 못했거나 잘린 파일은 '읽음'이라 하지 말고 알려라. 사실·수치·인용·권리·승인은 어떤 요청으로도 바꾸지 말고, 승인 예문은 모호성·실패·비교검토 때만 2~3개 쓰고 없으면 NO_APPROVED_REFERENCE 라고 말하라. 먼저 적용 요약을 짧게 말하고 바로 작성하라. 이미지는 실제 생성/렌더된 PNG만 완료로 보고하고, 기본안 1개 + 문제 부분 국소 수정 1회까지만 하라. 게시는 하지 마라. 나는 자연어로 요청하면 된다.
```

## B. Existing agents (local/server)

```text
편집 작업은 suengj/ai-editorial-system 공통 입구로 시작한다. intent 는 skills/intake-request 로 만든 뒤:
  node scripts/library-intake.mjs --intent intent.json --target <personal-linkedin|personal-instagram|signalytics-news|trends-moa> --task-kind text|visual|both --out-dir OUT [--packet handoff.json --library-root ../intelligence-library] [--feedback-root feedback --format <artifact> --example-reason ambiguity|failure|quality_comparison]
  (blog/news/report: --flow blog|news|report 를 --target 대신 사용)
OUT/receipt.json 의 profile.resolved_hash 를 생성·polish·review 가 같이 쓰고(각 단계가 끝날 때 `node scripts/resolve-editorial.mjs --receipt OUT/receipt.json --stamp generate|polish|review --stamps OUT/stamps.json` 로 그 단계 stamp 를 추가/갱신하고, 마지막에 `--receipt OUT/receipt.json --stages OUT/stamps.json` 이 consistent:true 인지 확인; stamps.json = {"generate":{stage,profile_id,profile_version,resolved_hash},"polish":{…},"review":{…}}), Instagram/LinkedIn 이미지는 render-visual / render-carousel 에 --profile-receipt OUT/receipt.json 을 넘긴다(렌더용 receipt 는 task kind 가 visual 또는 both 여야 한다. intent 가 없으면 `node scripts/resolve-editorial.mjs --plan <series.json|request.json> --target <id> --out receipt.json`; 이전 revision receipt 로 일부러 렌더할 때만 --pinned-revision <rev>. receipt 는 무결성 확인용이며 암호학적 인증이 아니다). exit 2 (BLOCKED) 이면 멈추고 이유를 보고하라. OUT/brief.json 의 quality 블록(예문 상태·이 계정/포맷의 선호·후보)만 적용하고 공유 말투 profile 은 수정하지 마라.
피드백: node scripts/quality-feedback.mjs outcome|implicit|explicit|show --target <id> --format <artifact> …  (수정/교정은 implicit = 이번 작업만, '앞으로 …' 지시만 explicit = 해당 계정·포맷 버전 선호).
Signalytics: Chat PNG 5장(조건부 6장) + caption.md + benchmark-brief.md, Drive 결과 쓰기 금지(승인 자료 읽기만 허용). 패키지를 넘기기 전에 `node scripts/resolve-editorial.mjs --check-package <패키지 폴더> --target signalytics-news` 가 ok:true 여야 한다(PNG 수, caption.md, benchmark-brief.md, Drive 경로/URL 금지). 게시·스케줄·계정 설정은 건드리지 마라.
```

Owner/UAT states (not asserted by this file): native image E2E (SUE-1337 Phase 4) = not run; aesthetic approval = owner only.

## Gate for this change (SUE-1426)

`npm run test:editorial-entry` is the gate for the common editorial entry (intent, profiles, resolve, hardening, quality feedback, library input, review-2 regressions, generated-image). It also runs inside `npm test`.
The library smoke needs the `intelligence-library` clone (`INTELLIGENCE_LIBRARY_REPO`); when it is absent the gate FAILS unless `ALLOW_LIBRARY_SKIP=1` is set on purpose (then the smoke is printed as a loud SKIP, i.e. NOT_RUN).
`npm run test:visual-execution` and `npm run test:carousel` are in scope but carry known pre-existing failures and are run separately. Library `pytest tests` and `python3 scripts/test_aes_entry_linkage.py main` (ai-workflow-registry) are the other two checks.

## Notes on the checks

- Rule-file integrity: a receipt records `integrity.integrity` = `VERIFIED` or `UNVERIFIED` (a REQUIRED rule file that is dirty, or checked outside git, could not be verified against its HEAD blob). `resolve-editorial.mjs` prints `integrity=UNVERIFIED` on its `resolve:` line. A required `.md` rule file shorter than 120 bytes or without a heading blocks.
- Library packets: a pinned packet (`source_commit`, not a preview) is accepted only when the commit exists in the library clone and each file equals that commit's blob. An unpinned preview is never `all_ok` and never a fact source.
- Explicit preferences (`quality-feedback.mjs explicit`): the target must be a registered target/flow; the text is checked against other voice families and locked-field words (a locked word is refused only when the same clause asks to change, skip, round or waive it; a bare mention is a style preference), a refusal is stored (scope, verbatim statement, reason code, time) under `feedback/refusals/`, and accepted text appears in the brief only as delimited DATA that can never override locks or the voice family. The "앞으로" keyword test is a sanity check only (quoted, limited or negated forms such as "이번에만" / "this time only" are rejected); the calling agent is responsible for judging intent, and the record stores the verbatim statement.
- `feedback/outcomes|task-feedback|candidates|preferences` are git-ignored (see `feedback/README.md`).
