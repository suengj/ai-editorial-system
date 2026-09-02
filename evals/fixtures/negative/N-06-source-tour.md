<!--
Negative fixture N-06 — fact-shaped, coherent, and mechanically clean, but the
article is organized by the source/repository topology rather than by an
independent argument.

Intended editorial failures: E-2 synthesis, E-4 original-reasoning, E-6
flow-density. Expected: no reject-severity finding. The defect is editorial,
not mechanical.
-->

AI 글쓰기 시스템에서 중요한 것은 편집 권한을 분리하는 일이다. 이를 위해 현재 시스템은 framing, verification, writing, polish, human review를 서로 다른 단계로 구성한다.

## Framing

Framing 단계에서는 어떤 글을 쓸지 정한다. Thesis와 uncertainty를 기록하고, source를 검토한 뒤 필요한 verification 항목을 정리한다. 근거가 부족한 경우에는 `NO_ARTICLE`을 반환할 수 있다.

## Verification

Verification 단계에서는 숫자, 날짜, citation, quotation을 확인한다. 지원되지 않는 claim은 다음 단계로 넘기지 않고, contradictory evidence가 있으면 이를 표시한다.

## Writing

Writing 단계에서는 verified claim set을 바탕으로 초안을 작성한다. Content type별 profile을 읽고, citation anchor를 유지하면서 Markdown article을 만든다.

## Polish

Polish 단계에서는 문장 리듬과 표현을 다듬는다. Numbers, dates, citations, technical terms는 protected span으로 취급하고 변경하지 않는다.

## Human review

마지막에는 사람이 frame, verification, final article을 확인한다. Finalization과 publication은 분리되어 있고, 공개 여부는 별도의 판단으로 남는다.

이 구조를 통해 AI 글쓰기 과정의 여러 작업을 나눌 수 있다. 각 단계가 자신의 역할을 수행하고 다음 단계로 결과를 넘기면 전체 workflow를 더 체계적으로 관리할 수 있다.
