# `/task` 명령어 전체 플로우 점검 결과

> 점검일시: 2026-01-18

## ✅ 플러그인 초기화 (index.ts)

```
OrchestratorPlugin 시작
    │
    ├─ Toast.initToastClient(client)           ✅ 토스트 시스템
    ├─ Toast.initTaskToastManager(client)      ✅ 태스크 토스트 매니저
    ├─ sessions = new Map()                    ✅ 세션 맵
    ├─ ParallelAgentManager.getInstance()      ✅ 병렬 에이전트 매니저
    ├─ createAsyncAgentTools()                 ✅ delegate_task, list_tasks, etc.
    └─ taskToastManager.setConcurrencyController() ✅ 동시성 연결
```

## ✅ 플러그인 Hook 연결

| Hook | Handler | 연결 상태 |
|------|---------|----------|
| `config` | `createConfigHandler()` | ✅ 에이전트, 명령어 등록 |
| `event` | `createEventHandler()` | ✅ session.idle, session.deleted 등 |
| `chat.message` | `createChatMessageHandler()` | ✅ /task 처리, 세션 등록 |
| `tool.execute.after` | `createToolExecuteAfterHandler()` | ✅ 도구 실행 후 처리 |
| `assistant.done` | `createAssistantDoneHandler()` | ✅ 미션 씰 감지, continuation |

## ✅ `/task` 실행 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 사용자: /task "미션 설명"                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. chat.message hook (chat-message-handler.ts)                  │
│    ├─ detectSlashCommand() → command = "task"                   │
│    ├─ COMMAND_NAMES.TASK 비교                                   │
│    ├─ sessions.set(sessionID, { active: true, ... })  ✅ 등록   │
│    ├─ state.sessions.set(sessionID, { ... })          ✅ 상태   │
│    ├─ ProgressTracker.startSession()                  ✅ 진행률  │
│    └─ startMissionLoop(directory, sessionID, prompt)  ✅ 루프   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. startMissionLoop() (mission-seal.ts)                         │
│    ├─ mkdirSync(.opencode/, { recursive: true })     ✅ 디렉토리 │
│    └─ writeLoopState() → loop-state.json             ✅ 상태 저장 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Commander 에이전트 실행                                       │
│    └─ delegate_task 도구 호출 → ParallelAgentManager.launch()   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. ParallelAgentManager (manager.ts)                            │
│    ├─ TaskLauncher.launch()                          ✅ 태스크   │
│    │   ├─ concurrency.acquire()                      ✅ 슬롯 획득│
│    │   ├─ client.session.create()                    ✅ 세션 생성│
│    │   ├─ store.set(task)                            ✅ 저장    │
│    │   ├─ TaskToastManager.addTask()                 ✅ 알림    │
│    │   └─ client.session.prompt()                    ✅ 프롬프트 │
│    ├─ TaskPoller.poll() (1초 간격)                   ✅ 폴링    │
│    └─ TaskCleaner (완료 시 정리)                     ✅ 정리    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. session.idle 이벤트 (event-handler.ts)                       │
│    ├─ sessions.has(sessionID)                        ✅ 메인 체크│
│    ├─ session?.active                                ✅ 활성 체크│
│    ├─ isLoopActive(directory, sessionID)             ✅ 루프 체크│
│    │                                                            │
│    ├─ [루프 활성] → MissionSealHandler.handleMissionSealIdle()  │
│    │   ├─ SEAL 패턴 감지 → 미션 완료                            │
│    │   └─ 미감지 → iteration++, continuation 주입               │
│    │                                                            │
│    └─ [루프 비활성] → TodoContinuation.handleSessionIdle()      │
│        ├─ hasRemainingWork() 체크                               │
│        └─ 미완료 TODO 시 continuation 주입                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. assistant.done hook (assistant-done-handler.ts)              │
│    ├─ SEAL 패턴 감지 → 🎖️ MISSION COMPLETE                     │
│    ├─ ProgressTracker.recordSnapshot()                          │
│    └─ CONTINUE_INSTRUCTION 주입                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. 미션 완료 (session.deleted 또는 SEAL)                        │
│    ├─ sessions.delete()                              ✅ 정리    │
│    ├─ state.sessions.delete()                        ✅ 상태    │
│    ├─ ProgressTracker.clearSession()                 ✅ 진행률  │
│    ├─ SessionRecovery.cleanupSessionRecovery()       ✅ 복구    │
│    ├─ TodoContinuation.cleanupSession()              ✅ 루프    │
│    └─ MissionSealHandler.cleanupSession()            ✅ 씰 핸들러│
└─────────────────────────────────────────────────────────────────┘
```

## ✅ 도구 연결 확인

| 도구 | 위치 | 연결 |
|-----|------|------|
| `call_agent` | callAgent.ts | ✅ |
| `slashcommand` | slashCommand.ts | ✅ |
| `delegate_task` | parallel/delegate-task.ts → ParallelAgentManager | ✅ |
| `get_task_result` | parallel/get-task-result.ts → ParallelAgentManager | ✅ |
| `list_tasks` | parallel/list-tasks.ts → ParallelAgentManager | ✅ |
| `cancel_task` | parallel/cancel-task.ts → ParallelAgentManager | ✅ |
| `run_background` | background-cmd/run.ts | ✅ |
| `check_background` | background-cmd/check.ts | ✅ |
| `list_background` | background-cmd/list.ts | ✅ |
| `kill_background` | background-cmd/kill.ts | ✅ |
| `webfetch` | web/webfetch.ts | ✅ |
| `websearch` | web/websearch.ts | ✅ |
| `cache_docs` | web/cache-docs.ts | ✅ |
| `codesearch` | web/codesearch.ts | ✅ |
| `grep_search` | search.ts | ✅ |
| `glob_search` | search.ts | ✅ |
| `mgrep` | search.ts | ✅ |

## ✅ 에이전트 등록 확인

| 에이전트 | 모드 | 등록 |
|---------|------|------|
| Commander | primary (default) | ✅ |
| Planner | subagent (hidden) | ✅ |
| Worker | subagent (hidden) | ✅ |
| Reviewer | subagent (hidden) | ✅ |

## ✅ 핵심 시스템 연결

| 시스템 | 파일 | 연결 |
|--------|------|------|
| TaskToastManager | notification/task-toast-manager.ts | ✅ index → setConcurrencyController |
| ConcurrencyController | agents/concurrency.ts | ✅ ParallelAgentManager 내부 |
| TaskStore | agents/task-store.ts | ✅ ParallelAgentManager 내부 |
| TaskLauncher | agents/manager/task-launcher.ts | ✅ ParallelAgentManager 내부 |
| TaskPoller | agents/manager/task-poller.ts | ✅ ParallelAgentManager 내부 |
| TaskCleaner | agents/manager/task-cleaner.ts | ✅ ParallelAgentManager 내부 |
| EventHandler | agents/manager/event-handler.ts | ✅ ParallelAgentManager 내부 |
| SessionRecovery | recovery/session-recovery.ts | ✅ event-handler에서 호출 |
| TodoContinuation | loop/todo-continuation.ts | ✅ event-handler에서 호출 |
| MissionSealHandler | loop/mission-seal-handler.ts | ✅ event-handler에서 호출 |
| ProgressTracker | progress/tracker.ts | ✅ chat-message, event-handler |

## ✅ 점검 결과

**모든 연결이 정상입니다.**

- `/task` 명령어 실행 시 모든 시스템이 순차적으로 동작
- 세션 등록 → 병렬 에이전트 → 이벤트 처리 → 자동 continuation
- SEAL 감지 → 미션 완료 → 리소스 정리

---

**v0.9.11 기준**
