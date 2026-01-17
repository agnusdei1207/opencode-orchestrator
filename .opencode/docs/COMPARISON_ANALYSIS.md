# Oh-My-OpenCode vs OpenCode-Orchestrator 비교 분석

> 두 프로젝트의 구조, 에이전트 오케스트레이션, 병렬 처리, 루프 관리 방식을 비교 분석한 문서

---

## 📊 프로젝트 개요 비교

| 항목 | Oh-My-OpenCode | OpenCode-Orchestrator |
|------|----------------|----------------------|
| **주 언어** | TypeScript | TypeScript + Rust (CLI) |
| **아키텍처** | 플러그인 기반 | 플러그인 기반 |
| **에이전트 수** | 10+ (Sisyphus, Oracle, Librarian 등) | 4개 (Commander, Planner, Worker, Reviewer) |
| **프롬프트 규모** | 대규모 (Sisyphus ~2000줄) | 중규모 (Commander ~200줄) |
| **복잡도** | 높음 | 중간 |

---

## 🏗️ 아키텍처 구조 비교

### Oh-My-OpenCode 구조

```
src/
├── agents/           # 에이전트 정의 (10+ 에이전트)
│   ├── sisyphus.ts                  # 메인 에이전트 (641줄)
│   ├── orchestrator-sisyphus.ts     # 오케스트레이터 (1532줄!)
│   ├── oracle.ts                    # 고급 상담 에이전트
│   ├── librarian.ts                 # 외부 문서 조사
│   ├── explore.ts                   # 코드베이스 탐색
│   └── frontend-ui-ux-engineer.ts   # 프론트엔드 전문가
├── tools/
│   ├── delegate-task/   # 작업 위임 도구
│   ├── background-task/ # 백그라운드 작업 도구
│   └── session-manager/ # 세션 관리
├── hooks/
│   ├── todo-continuation-enforcer.ts  # TODO 완료까지 루프
│   ├── ralph-loop/                     # 반복 루프 시스템
│   ├── session-recovery/               # 세션 복구
│   └── background-notification/        # 백그라운드 알림
└── features/
    ├── background-agent/  # 백그라운드 에이전트 관리자
    └── claude-code-session-state/  # 세션 상태 관리
```

### OpenCode-Orchestrator 구조

```
src/
├── agents/           # 에이전트 정의 (4개)
│   ├── commander.ts      # 메인 오케스트레이터 (205줄)
│   └── consolidated/     # 통합 에이전트 (Planner, Worker, Reviewer)
├── tools/
│   ├── parallel/         # 병렬 작업 도구
│   │   ├── delegate-task.ts
│   │   ├── get-task-result.ts
│   │   └── list-tasks.ts
│   └── background-cmd/   # 백그라운드 명령어
├── core/
│   ├── agents/           # 에이전트 관리자
│   │   └── manager.ts    # ParallelAgentManager
│   ├── loop/             # 루프 관리
│   │   └── todo-continuation.ts
│   ├── recovery/         # 오류 복구
│   └── session/          # 세션 관리
└── index.ts              # 플러그인 엔트리 (713줄)
```

**결론**: 구조적으로 **비슷한 패턴**을 따르고 있음. 차이점은:
- Oh-My-OpenCode는 더 많은 전문화된 에이전트와 훅을 가짐
- OpenCode-Orchestrator는 더 간결하고 4-에이전트 통합 아키텍처

---

## 🔄 작업 루프 완수 메커니즘 비교

### 핵심 차이점: "끝까지 작업을 완수하는 방법"

#### Oh-My-OpenCode의 접근법

1. **Todo Continuation Enforcer** (`todo-continuation-enforcer.ts`)
   ```typescript
   // 세션이 idle 상태가 되면 자동으로 continuation prompt 주입
   if (event.type === "session.idle") {
       // 미완료 TODO 확인
       const incompleteCount = getIncompleteCount(todos);
       if (incompleteCount > 0) {
           // 카운트다운 후 continuation 주입
           startCountdown(sessionID, incompleteCount, total);
       }
   }
   ```

2. **Ralph Loop** (`ralph-loop/index.ts`)
   ```typescript
   // 완료 약속(promise) 기반 루프
   const CONTINUATION_PROMPT = `[SYSTEM DIRECTIVE - RALPH LOOP {{ITERATION}}/{{MAX}}]
   
   Your previous attempt did not output the completion promise.
   When FULLY complete, output: <promise>{{PROMISE}}</promise>`;
   
   // 트랜스크립트에서 완료 약속 감지
   if (detectCompletionPromise(transcriptPath, state.completion_promise)) {
       log("Completion detected!");
       clearState();
   }
   ```

3. **프롬프트 수준 강제** (`orchestrator-sisyphus.ts`)
   ```
   WHILE .opencode/todo.md has unchecked [ ] items:
     1. IDENTIFY all tasks with satisfied dependencies
     2. LAUNCH all identified tasks in PARALLEL
     3. MONITOR with list_tasks
     4. COLLECT results
     5. UPDATE: Reviewer marks [x]
     6. REPEAT until all complete
   ```

#### OpenCode-Orchestrator의 접근법

1. **Todo Continuation Handler** (`todo-continuation.ts`)
   ```typescript
   // 유사한 구조, 약간 단순화됨
   export async function handleSessionIdle(client, sessionID, mainSessionID) {
       // 백그라운드 작업 확인
       if (hasRunningBackgroundTasks(sessionID)) return;
       
       // 미완료 TODO 확인
       if (!hasRemainingWork(todos)) return;
       
       // 카운트다운 후 continuation 주입
       await showCountdownToast(client, COUNTDOWN_SECONDS, incompleteCount);
       // ...
   }
   ```

2. **프롬프트 수준** (`commander.ts`)
   ```
   <execution_loop>
   WHILE .opencode/todo.md has unchecked [ ] items:
     1. IDENTIFY all tasks with satisfied dependencies
     2. LAUNCH all identified tasks in PARALLEL
     3. MONITOR and COLLECT results
     4. UPDATE: Reviewer validates
     5. REPEAT
   </execution_loop>
   ```

**분석**:
- **기본 메커니즘은 거의 동일함**: `session.idle` 이벤트 감지 → TODO 확인 → continuation prompt 주입
- **Oh-My-OpenCode 추가 기능**:
  - Ralph Loop: 명시적인 완료 약속(`<promise>`) 감지 시스템
  - 더 정교한 abort 감지 (이벤트 기반 + API 폴백)
  - 에이전트별 skip 목록 지원

---

## ⚡ 병렬 처리 비교

### Oh-My-OpenCode

**delegate_task 도구** (`tools/delegate-task/tools.ts` - 771줄):

```typescript
// 카테고리 또는 에이전트 기반 위임
delegate_task({
  category: "visual-engineering",  // 또는
  agent: "oracle",                 // 직접 에이전트 지정
  background: true,                // 백그라운드 실행
  resume: "session_id",            // 세션 재개
  skills: ["frontend-ui-ux"],      // 스킬 첨부
  prompt: "..."
})
```

**BackgroundManager** (`features/background-agent/manager.ts` - 1119줄):
- 동시성 관리 (ConcurrencyManager)
- 작업 상태 추적
- 세션별 작업 그룹화
- 완료 알림 시스템
- 프로세스 정리 핸들러

```typescript
class BackgroundManager {
  // 작업 시작
  async launch(input: LaunchInput): Promise<BackgroundTask>
  
  // 세션 재개
  async resume(input: ResumeInput): Promise<BackgroundTask>
  
  // 세션별 작업 조회
  getTasksByParentSession(sessionID: string): BackgroundTask[]
  
  // 이벤트 처리
  handleEvent(event: Event): void
  
  // 출력 검증
  validateSessionHasOutput(sessionID: string): Promise<boolean>
}
```

### OpenCode-Orchestrator

**delegate_task 도구** (`tools/parallel/delegate-task.ts` - 373줄):

```typescript
// 에이전트 기반 위임
delegate_task({
  agent: "worker",      // 에이전트 지정
  background: true,     // 백그라운드 실행
  resume: "session_id", // 세션 재개
  prompt: "..."
})
```

**ParallelAgentManager** (`core/agents/manager.ts` - 237줄):
- 컴포넌트 기반 아키텍처 (TaskLauncher, TaskResumer, TaskPoller, TaskCleaner)
- 동시성 제어
- 세션별 작업 관리

```typescript
class ParallelAgentManager {
  private launcher: TaskLauncher;
  private resumer: TaskResumer;
  private poller: TaskPoller;
  private cleaner: TaskCleaner;
  
  async launch(input: LaunchInput): Promise<ParallelTask>
  async resume(input: ResumeInput): Promise<ParallelTask>
  getTasksByParent(parentSessionID: string): ParallelTask[]
}
```

**분석**:
| 기능 | Oh-My-OpenCode | OpenCode-Orchestrator |
|------|----------------|----------------------|
| 기본 병렬 실행 | ✅ | ✅ 동일 |
| 세션 재개 | ✅ `resume` 파라미터 | ✅ `resume` 파라미터 |
| 카테고리 기반 위임 | ✅ | ❌ (에이전트 직접 지정) |
| 스킬 시스템 | ✅ `skills` 파라미터 | ❌ |
| 동시성 제어 | ✅ | ✅ 동일 |
| 작업 모니터링 | ✅ | ✅ 동일 |

**결론**: 핵심 기능은 **거의 동일**. Oh-My-OpenCode가 카테고리/스킬 시스템으로 더 유연함.

---

## 🖥️ 백그라운드 명령어 처리 비교

### Oh-My-OpenCode

**background_task 도구들** (`tools/background-task/tools.ts`):
- `background_task`: 백그라운드 작업 시작
- `background_output`: 결과 조회
- `background_cancel`: 작업 취소

### OpenCode-Orchestrator

**background_cmd 도구들** (`tools/background-cmd/`):
- `run_background`: 백그라운드 셸 명령어 실행
- `check_background`: 명령어 상태 확인
- `list_background`: 모든 백그라운드 명령어 목록

**분석**: **거의 동일한 패턴**. 둘 다 장시간 실행 명령어를 비동기로 처리.

---

## 🔀 다중 세션 처리 비교

### Oh-My-OpenCode

```typescript
// 세션 상태 추적
import { subagentSessions, getMainSessionID } from "features/claude-code-session-state";

// 메인 세션 vs 서브에이전트 세션 구분
const isMainSession = sessionID === mainSessionID;
const isBackgroundTaskSession = subagentSessions.has(sessionID);

// 세션별 작업 조회
backgroundManager.getTasksByParentSession(sessionID);
backgroundManager.getAllDescendantTasks(sessionID);
```

### OpenCode-Orchestrator

```typescript
// 세션 관리
import { SessionStore } from "core/session/store";

// 세션별 작업 조회
manager.getTasksByParent(parentSessionID);

// 메인 세션 확인
if (mainSessionID && sessionID !== mainSessionID) {
    return; // 메인 세션만 처리
}
```

**분석**: **거의 동일한 패턴**. 둘 다:
- 부모-자식 세션 관계 추적
- 세션별 작업 그룹화
- 메인 세션 우선 처리

---

## 🎯 주요 차이점 요약

### 1. 에이전트 시스템

| 측면 | Oh-My-OpenCode | OpenCode-Orchestrator |
|------|----------------|----------------------|
| 에이전트 수 | 10+ (전문화) | 4개 (통합) |
| 프롬프트 길이 | 매우 긺 (Sisyphus: ~2000줄) | 짧음 (Commander: ~200줄) |
| 카테고리 시스템 | ✅ (visual, ultrabrain 등) | ❌ |
| 스킬 시스템 | ✅ | ❌ |

### 2. 루프 완수 메커니즘

| 측면 | Oh-My-OpenCode | OpenCode-Orchestrator |
|------|----------------|----------------------|
| 기본 Todo continuation | ✅ | ✅ (동일) |
| Ralph Loop (완료 약속) | ✅ | ❌ |
| Abort 감지 | 이벤트 + API 폴백 | 기본 |
| 에이전트 skip 목록 | ✅ | ❌ |

### 3. 병렬 처리

| 측면 | Oh-My-OpenCode | OpenCode-Orchestrator |
|------|----------------|----------------------|
| 핵심 기능 | 동일 | 동일 |
| 세션 재개 | ✅ | ✅ |
| 동시성 제어 | ✅ | ✅ |
| 카테고리 기반 위임 | ✅ (더 유연) | ❌ |

---

## 💡 /task 모드 개선을 위한 권장 사항

### 차용 가치가 높은 기능

1. **Ralph Loop 시스템**
   - 명시적인 완료 약속(`<promise>...</promise>`) 감지
   - 최대 반복 횟수 제한
   - 트랜스크립트 기반 완료 감지
   
   ```typescript
   // 작업 시작 시
   startLoop(sessionID, prompt, { maxIterations: 10, completionPromise: "TASK COMPLETE" });
   
   // 완료 감지 시
   if (detectCompletionPromise(transcriptPath, "<promise>TASK COMPLETE</promise>")) {
       clearState();
   }
   ```

2. **개선된 Abort 감지**
   - `session.error` 이벤트 기반 abort 감지
   - API 폴백으로 메시지 상태 확인
   - Grace period로 false positive 방지

3. **카테고리 기반 위임** (선택적)
   - 작업 유형에 따른 자동 에이전트/설정 선택
   - 온도, 모델 등 자동 최적화

### 차용할 필요 없는 기능

1. **복잡한 에이전트 시스템** - 현재 4-에이전트 아키텍처가 더 간결하고 관리하기 쉬움
2. **스킬 시스템** - 현재 구조로 충분
3. **프로세스 정리 핸들러** - 이미 유사하게 구현됨

---

## 📝 결론

두 프로젝트는 **핵심 메커니즘이 거의 동일**합니다:
- 병렬 에이전트 실행
- 세션 기반 작업 관리
- TODO continuation으로 작업 완수

**Oh-My-OpenCode의 주요 추가 기능**:
1. Ralph Loop (완료 약속 기반 루프)
2. 더 정교한 abort 감지
3. 카테고리/스킬 시스템

**권장 도입**:
- Ralph Loop 시스템의 "완료 약속 감지" 개념
- 개선된 abort 감지 로직

현재 OpenCode-Orchestrator의 아키텍처는 충분히 견고하며, 위의 몇 가지 기능만 선택적으로 도입하면 됩니다.
