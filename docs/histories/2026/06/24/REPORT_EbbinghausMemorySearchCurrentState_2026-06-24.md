# 에빙하우스 기억감쇠와 Markdown RAG 현재 구조 요약

작성일: 2026-06-24 KST  
목적: 현재 메모리/RAG 구조를 핵심 흐름만 남겨 이해하기 쉽게 정리

## 핵심 결론

현재 구현에는 Markdown 기반 RAG가 있다. 다만 벡터 DB/embedding 기반 RAG가 아니라, `docs/`와 `.opencode/docs/` 아래의 Markdown을 읽어서 lexical/tag/graph 검색으로 후보를 찾는 로컬 Markdown RAG다.

에빙하우스 기억감쇠는 검색 결과를 만든 뒤 최종 점수에 곱해진다.

```text
final_score = rrf_score * memoryStrength(metadata)
```

즉 감쇠는 "어떤 기억을 위로 올릴지/아래로 내릴지"에 관여한다. 반면 `<knowledge_rag_context>`를 어디에 붙일지는 별도의 프롬프트 아키텍처 문제다.

## 용어 기준

| 용어 | 한글 개념 | 역할 |
| --- | --- | --- |
| `frontmatter(metadata header)` | Markdown 맨 위 `--- ... ---` 영역 | tag, 시간, 중요도, 감쇠값, 안전 필터 같은 관리 정보 |
| `body(content body)` | frontmatter 아래 실제 본문 | 단어 검색과 snippet 생성에 쓰이는 내용 |
| `metadata` | frontmatter를 파싱한 객체 | `memoryStrength(metadata)`, `isPromptSafeMemory(metadata)`에 들어감 |
| `noteName` | 현재 구현의 검색 표시 이름 | 파일명에서 `.md`를 뺀 값. 충돌 가능성이 있어 장기적으로 개선 필요 |
| `<knowledge_rag_context>` | LLM에게 주는 참고자료 묶음 | 검색된 Markdown 후보의 Source/Snippet 요약 |

## 전체 구조

```text
[MemoryManager]
  런타임 중 기억을 들고 있는 중앙 저장소.
  SYSTEM / PROJECT / MISSION / TASK 계층으로 나눠 보관한다.
  파일이 아니라 프로세스 메모리 안의 구조다.
        |
        | export()
        v
[syncMissionMemory()]
  Runtime memory 중 중요한 PROJECT / MISSION / TASK 기억을
  Markdown 파일로 복사한다.
        |
        v
[.opencode/docs/brain/]
  scratchpad.md
    - 현재 미션 상태 요약
    - RAG 검색에서는 제외되고 <mission_scratchpad>로 별도 주입된다.

  knowledge-map.canvas
    - objective / runtime / verification / evidence 관계도

  memories/*.md
    - 장기적으로 남는 파일 기반 기억
    - frontmatter(metadata header): 관리/감쇠 정보
    - body(content body): 실제 기억 내용
        |
        v
[KnowledgeContextProvider.buildPrompt()]
  docs/와 .opencode/docs/의 Markdown을 읽어 검색 가능한 후보를 만든다.
        |
        v
[HybridSearch.search()]
  lexical / tag / graph 세 방식으로 관련 Markdown을 찾는다.
        |
        v
[memoryStrength(metadata)]
  오래 안 쓰인 기억의 점수를 낮춘다.
        |
        v
[<knowledge_rag_context>]
  선택된 기억을 Source + Snippet 형태의 짧은 참고자료로 만든다.
        |
        v
[system-transform-handler]
  현재 production에서는 일반 user prompt가 아니라
  system transform의 output.system에 추가한다.
```

## 검색 흐름

```text
Markdown file
  -> TagIndexer.parseFrontmatter()
     Markdown을 frontmatter(metadata header)와 body(content body)로 나눈다.

  -> KnowledgeContextProvider.indexKnowledge()
     docs/와 .opencode/docs/의 .md 파일을 모아 검색 후보로 정리한다.

  -> HybridSearch.indexContent(noteName, body, metadata)
     Markdown 하나를 검색 후보 하나로 등록한다.
     body는 본문 단어 검색용이고, metadata는 감쇠/안전 필터용이다.

  -> HybridSearch.search(query, weightsForRole(role))
     현재 작업 맥락을 query로 삼아 관련 후보를 찾는다.

  -> lexical / tag / graph
     lexical: body(content body)의 단어 일치
     tag: frontmatter(metadata header)의 tags 일치
     graph: Markdown link/backlink 관계

  -> RRF fusion
     세 검색 결과를 하나로 합친다.
     여러 경로에서 동시에 잡힌 문서는 더 위로 올라간다.

  -> score * memoryStrength(metadata)
     관련성 점수에 기억 강도를 곱한다.
     오래 안 쓰인 generated memory는 아래로 내려간다.

  -> isPromptSafeMemory(metadata)
     sensitive, malicious, tombstone 같은 위험 후보를 제외한다.

  -> <knowledge_rag_context>
     최종 후보를 LLM용 참고자료 블록으로 만든다.
```

## 감쇠가 하는 일

`memoryStrength(metadata)`는 기억의 현재 강도를 계산한다.

핵심 기준:

- `keep: true`: 감쇠하지 않음
- `memory_layer: archive`: 0점 처리
- `last_accessed`: 마지막으로 검색에서 다시 쓰인 시간
- `ingestion_time`: 기억 파일로 저장된 시간
- `access_count` / `access_ema`: 자주 다시 쓰인 정도
- `memory_kind` / `decay_lambda`: 얼마나 빨리 잊힐 종류인지

요약하면:

```text
최근에 다시 쓴 기억  -> 점수 유지
오래 안 쓴 기억      -> 점수 하락
중요해서 keep된 기억 -> 점수 유지
archive/tombstone    -> 제외 또는 0점
```

감쇠는 snippet 길이나 system prompt 권한 문제를 해결하지 않는다. 감쇠는 검색 순위 문제다.

## 실제 Markdown memory 예시

```md
---
tags: [mission-memory, orchestrator, mission]
title: "mission memory mem_123"
level: "mission"
horizon: "execution"
importance: 0.800
event_time: "2026-06-24T02:00:00.000Z"
ingestion_time: "2026-06-24T02:01:00.000Z"
last_accessed: "2026-06-24T02:01:00.000Z"
access_count: 1
memory_kind: "workflow"
decay_lambda: 0.02
memory_layer: "warm"
confidence: 1
---

# Mission Memory

## Content
Markdown 기반 RAG는 Markdown 파일의 metadata와 body를 나눠 검색하고,
검색 점수에 기억감쇠를 적용한다.
```

이 파일은 검색 시 이렇게 쓰인다.

```text
frontmatter(metadata header)
  -> tag 검색
  -> memoryStrength(metadata)
  -> isPromptSafeMemory(metadata)
  -> writeback/maintenance 관리

body(content body)
  -> lexical 검색
  -> Snippet 생성
```

## 주입 위치와 걱정 지점

현재 `<knowledge_rag_context>`는 일반 user prompt 뒤에 붙는 구조가 아니다.

코드 기준 production 경로:

```text
system-transform-handler
  -> output.system.unshift(...systemAdditions)
```

현재 길이 제한:

- 검색 결과 최대 3개
- snippet 최대 220자
- 전체 파일이 아니라 `noteName`, `matchType`, `Source`, `Snippet`만 주입

그래도 걱정할 점은 남는다.

- system 영역은 user prompt보다 지시 우선순위가 높다.
- RAG는 원래 명령이 아니라 참고자료다.
- 따라서 system 영역에 넣으면 참고자료가 명령처럼 강하게 작동할 위험이 있다.

명확한 표현으로 말하면:

```text
감쇠 문제:
  어떤 기억을 검색 상위에 올릴지 정하는 문제

프롬프트 아키텍처 문제:
  선택된 기억을 어느 권한 위치에 넣을지 정하는 문제

토큰 예산 문제:
  선택된 기억을 얼마나 길게 넣을지 정하는 문제
```

## 상황별 프롬프트 흐름 예시

### 1. Commander orchestrated session

사용자가 활성 미션 안에서 작업을 이어갈 때의 흐름이다.

```text
User prompt
  "현재 RAG 구조 설명해줘"
        |
        v
system-transform-handler
  세션이 active mission인지 확인한다.
        |
        v
buildKnowledgeContextPrompt()
  objective / mission prompt / currentTask / lastProgress 등을 합쳐
  검색 query를 만든다.
        |
        v
KnowledgeContextProvider.buildPrompt()
  docs/와 .opencode/docs/의 Markdown을 검색한다.
        |
        v
<knowledge_rag_context>
  관련 Markdown Source/Snippet만 짧게 만든다.
        |
        v
output.system
  commander.systemPrompt
  <orchestrator_mission_loop>
  <mission_scratchpad>
  <knowledge_rag_context>
  <orchestrator_background_tasks>
        |
        v
Model
  user prompt를 답하되, 위 system additions를 함께 본다.
```

핵심은 `<knowledge_rag_context>`가 user prompt 문자열 뒤에 붙는 것이 아니라, system transform의 `output.system` 배열에 추가된다는 점이다.

### 2. 검색 hit와 감쇠 적용

Markdown memory가 검색 후보가 되는 상황이다.

```text
.opencode/docs/brain/memories/mission-mem_123.md
  frontmatter(metadata header)
    last_accessed: "2026-06-01..."
    access_count: 1
    memory_kind: "workflow"
    decay_lambda: 0.02

  body(content body)
    "Markdown RAG는 metadata와 body를 나눠 검색한다..."
        |
        v
HybridSearch.search(query)
  lexical: body 단어가 query와 맞는지 본다.
  tag: frontmatter tags가 query와 맞는지 본다.
  graph: Markdown link/backlink 관계를 본다.
        |
        v
RRF fusion
  여러 검색 경로의 순위를 합친다.
        |
        v
memoryStrength(metadata)
  오래 안 쓴 기억이면 점수를 낮춘다.
        |
        v
isPromptSafeMemory(metadata)
  sensitive / tombstone / malicious 후보를 제외한다.
        |
        v
<knowledge_rag_context>
  Source + Snippet 형태로만 들어간다.
```

여기서 감쇠는 "검색 결과 순위 조절"이다. 감쇠가 system 영역 주입 권한을 낮추거나 snippet 길이를 줄이지는 않는다.

### 3. Subagent delegated task

Commander가 Planner/Worker/Reviewer에게 일을 넘길 때의 흐름이다.

```text
delegate_task()
  agent: "Worker"
  prompt: "이 파일 수정해"
        |
        v
TaskLauncher
  agent role wrapper를 붙인다.
        |
        v
MemoryManager.getContext(finalPrompt)
  Runtime MemoryManager 기억 중 관련 내용을 찾는다.
        |
        v
injectedPrompt
  [MemoryManager context]

  ### AGENT ROLE: Worker
  [Worker systemPrompt]

  [task prompt]
        |
        v
subagent session.prompt()
```

현재 상태에서 subagent 전용 Markdown RAG 주입은 폐기했다. 따라서 subagent 쪽은 `KnowledgeContextProvider` 기반 `<knowledge_rag_context>`가 아니라 `MemoryManager.getContext()` 기반 runtime memory가 붙는 경로로 보면 된다.

## 현재 한계

1. `noteName`이 파일명 기반이라 같은 파일명이 있으면 충돌 가능성이 있다.
2. 검색은 embedding 기반이 아니라 lexical/tag/graph 기반이다.
3. 한국어 검색은 whitespace/tokenizer 한계가 있다.
4. `<knowledge_rag_context>`가 system transform `output.system`에 들어가는 점은 재검토할 가치가 있다.
5. subagent 전용 role-aware RAG 주입은 위험 판단으로 폐기한 상태다.

## 판단

현재 중요한 구조는 세 줄로 요약된다.

```text
MemoryManager 기억 일부가 Markdown 파일로 투영된다.
Markdown 파일은 검색 시 frontmatter(metadata header)와 body(content body)로 나뉘어 RAG 후보가 된다.
검색 결과에는 memoryStrength(metadata)가 곱해져 오래 안 쓴 기억이 아래로 내려간다.
```

다음으로 검토할 지점은 감쇠 공식이 아니라 `<knowledge_rag_context>`를 system transform `output.system`에 넣는 현재 프롬프트 아키텍처다.
