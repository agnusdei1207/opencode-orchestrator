# OpenCode Orchestrator - System Architecture

> Complete technical documentation for system flow, components, and resource management.

**See [README.md](../README.md) for the complete architecture diagram.**

---

## 🎯 Master Session Concept

The orchestrator uses a **Master Session Architecture** with **4 consolidated agents**:

1. **Master Session** (Commander) - Receives user requests, orchestrates all work
2. **Worker Sessions** (Planner, Worker, Reviewer) - Execute delegated tasks in parallel
3. **Shared Context** (`.opencode/`) - All sessions read/write shared state

```
Consolidated Agent Roles:
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 Commander - Master orchestrator (Read → Delegate → Loop)    │
│ 📋 Planner   - File-level planning + TODO sync                 │
│ 🔨 Worker    - TDD file-level implementation (1 file = 1 session) │
│ ✅ Reviewer  - Async verification + E2E test + sync check      │
└─────────────────────────────────────────────────────────────────┘

Master Session Flow (with Sync Loop):
1️⃣ READ STATE → work-log.md, sync-issues.md, todo.md
2️⃣ DELEGATE   → Planner for file planning, Workers for implementation
3️⃣ MONITOR    → Wait for parallel workers (async)
4️⃣ VERIFY     → Reviewer checks integration + sync
5️⃣ LOOP/SEAL  → If sync issues: loop back. If clean: SEAL.

Worker Sessions (up to 50 parallel):
• ONE FILE per Worker session (complete isolation)
• TDD cycle: Test → Implement → Delete test (record in unit-tests/)
• Read/write shared .opencode/ workspace
• Cannot spawn sub-workers (recursion prevention)
```

---

## ⚠️ Loop Conditions (CRITICAL)

### SEALED Conditions (all must be true)
1. ✅ **TODO fully complete** - All items checked [x]
2. ✅ **sync-issues.md is empty** - No unresolved issues
3. ✅ **Build passes** - Full build successful
4. ✅ **E2E tests pass** - Integration tests successful

### LOOP BACK Conditions (any of these)
- ❌ TODO has incomplete items
- ❌ sync-issues.md has unresolved issues
- ❌ Build fails
- ❌ E2E tests fail

---

## 🔄 TDD File-Level Workflow

```
👤 User: /task "Build REST API"
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│  🎯 COMMANDER                                              │
│  1. Read .opencode/ (work-log, sync-issues, todo)         │
│  2. Delegate to Planner: "Create file plan"               │
└───────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│  📋 PLANNER                                                │
│  1. Analyze requirements                                   │
│  2. Create File Manifest (CREATE/MODIFY/DELETE)           │
│  3. Write todo.md with file-level subtasks                │
│  4. Initialize work-log.md                                │
└───────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│  🎯 COMMANDER                                              │
│  1. Read todo.md                                          │
│  2. Dispatch Workers (parallel, background: true)         │
│     - Worker A: file:src/auth/login.ts                    │
│     - Worker B: file:src/auth/logout.ts                   │
│     - Worker C: file:src/types/auth.ts                    │
└───────────────────────────────────────────────────────────┘
            │
            ▼ (PARALLEL)
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 🔧 WORKER A │ │ 🔧 WORKER B │ │ 🔧 WORKER C │
│ login.ts    │ │ logout.ts   │ │ auth.ts     │
│             │ │             │ │             │
│ TDD Cycle:  │ │ TDD Cycle:  │ │ TDD Cycle:  │
│ 1. Test     │ │ 1. Test     │ │ 1. Test     │
│ 2. Impl     │ │ 2. Impl     │ │ 2. Impl     │
│ 3. Delete   │ │ 3. Delete   │ │ 3. Delete   │
│    test     │ │    test     │ │    test     │
│ 4. Update   │ │ 4. Update   │ │ 4. Update   │
│ work-log.md │ │ work-log.md │ │ work-log.md │
└─────────────┘ └─────────────┘ └─────────────┘
            │
            ▼ (Wait for all Workers)
┌───────────────────────────────────────────────────────────┐
│  ✅ REVIEWER                                               │
│  1. Read work-log.md (check completed files)              │
│  2. Run E2E integration tests                             │
│  3. Check file sync (imports, types)                      │
│  4. If PASS: Mark TODO [x]                                │
│  5. If FAIL: Write sync-issues.md                         │
└───────────────────────────────────────────────────────────┘
            │
     ┌──────┴──────┐
     │ sync-issues │
     │   exist?    │
     └──────┬──────┘
       Yes ↓   ↓ No
     ┌─────┐ ┌─────┐
     │LOOP │ │SEAL │
     │BACK │ │ED!  │
     └──┬──┘ └─────┘
        │
        ▼ (Sync issue handling loop)
┌───────────────────────────────────────────────────────────┐
│  🎯 COMMANDER (Loop)                                       │
│  1. Read sync-issues.md                                   │
│  2. Delegate Planner: "Add FIX task to TODO"              │
│  3. Delegate Workers: "Fix this file like this"           │
│  4. Delegate Reviewer: "Verify again"                     │
└───────────────────────────────────────────────────────────┘
```

---

## 📂 Shared State (.opencode/)

### Directory Structure
```
.opencode/
├── todo.md              - Master task list (Planner creates/syncs)
├── context.md           - Project context
├── work-log.md          - 🔄 Real-time work status (ALL agents)
├── unit-tests/          - 📝 Unit test records (preserved after deletion)
├── sync-issues.md       - ⚠️ File sync issues (Reviewer writes)
├── integration-status.md - ✅ Integration test results
├── docs/                - Cached documentation
└── archive/             - Old context
```

### ID Prefix Constants (`ID_PREFIX`)
```typescript
// Format: PREFIX + any number (no fixed digits)
ID_PREFIX.SESSION     // "ses_"      → ses_1, ses_42
ID_PREFIX.SYNC_ISSUE  // "SYNC-"     → SYNC-1, SYNC-100
ID_PREFIX.UNIT_TEST   // "UT-"       → UT-1, UT-50
ID_PREFIX.TASK        // "task_"     → task_1, task_200
ID_PREFIX.WORKER      // "wrk_"      → wrk_1, wrk_10
```

### Path Constants (`PATHS`)
```typescript
PATHS.OPENCODE           // ".opencode"
PATHS.TODO               // ".opencode/todo.md"
PATHS.CONTEXT            // ".opencode/context.md"
PATHS.WORK_LOG           // ".opencode/work-log.md"
PATHS.STATUS             // ".opencode/status.md"  ← Progress tracking
PATHS.UNIT_TESTS         // ".opencode/unit-tests"
PATHS.SYNC_ISSUES        // ".opencode/sync-issues.md"
PATHS.INTEGRATION_STATUS // ".opencode/integration-status.md"
PATHS.DOCS               // ".opencode/docs"
PATHS.ARCHIVE            // ".opencode/archive"
```

### Work Status Constants (`WORK_STATUS`)
```typescript
// Actions
WORK_STATUS.ACTION.CREATE | MODIFY | DELETE | FIX

// Status
WORK_STATUS.STATUS.PENDING | IN_PROGRESS | DONE | FAILED

// E2E Status
WORK_STATUS.E2E_STATUS.NOT_STARTED | RUNNING | PASS | FAIL

// Mission Phase
WORK_STATUS.PHASE.PLANNING | IMPLEMENTATION | E2E | FIXING | SEALING

// Test Result
WORK_STATUS.TEST_RESULT.PASS | FAIL | SKIP
```

---


| Module | Status | Integration Path |
|--------|--------|------------------|
| `SharedContext` | ✅ Tested | Use in `delegate_task` for context passing |
| `TaskDecomposer` | ✅ Tested | Use in Planner agent prompt output parsing |
| `AutoRecovery` | ✅ Tested | Wrap API calls in `withRecovery()` |
| `AsyncQueue` | ✅ Tested | Use for batch processing |
| `TodoEnforcer` | ✅ Integrated | Used by `TodoContinuation` |

### 🔄 Session Recovery System (P2 Complete)

| Component | File | Purpose |
|-----------|------|---------|
| `SessionRecovery` | `src/core/recovery/session-recovery.ts` | Event-based error recovery |
| Error Patterns | `src/core/recovery/patterns.ts` | Pattern matching for errors |
| Recovery Handler | `src/core/recovery/handler.ts` | Action determination |

**Supported Error Types:**
- `tool_result_missing` - Tool crash, inject recovery prompt
- `thinking_block_order` - Thinking block issues
- `rate_limit` - API rate limiting with backoff
- `context_overflow` - Token limit exceeded warning

**Safety Measures:**
- Max 3 recovery attempts per session
- 5-second cooldown between attempts
- Recovery loop prevention via `isRecovering` flag
- Auto-reset on successful assistant message

### 📋 Todo Continuation System (P2 Complete)

| Component | File | Purpose |
|-----------|------|---------|
| `TodoContinuation` | `src/core/loop/todo-continuation.ts` | Auto-continue on idle |
| `TodoEnforcer` | `src/core/loop/todo-enforcer.ts` | Todo parsing/stats |
| `formatters` | `src/core/loop/formatters.ts` | Continuation prompt generation |

**Features:**
- Monitors `session.idle` events for incomplete todos
- 2-second countdown toast before auto-continuation
- Cancels on user interaction (chat.message)
- Skips if background tasks running or in recovery

### 🎖️ Mission Seal System (Explicit Completion Detection)

| Component | File | Purpose |
|-----------|------|---------|
| `MissionSeal` | `src/core/loop/mission-seal.ts` | Seal detection & loop state |
| `MissionSealHandler` | `src/core/loop/mission-seal-handler.ts` | Event handling & continuation |

**Completion Tag:**
```xml
<mission_seal>SEALED</mission_seal>
```

**Usage:** Simply use `/task "your mission"` - Mission Seal is automatically active.

**Architecture Diagram:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🎖️ MISSION SEAL LOOP                                 │
└─────────────────────────────────────────────────────────────────────────────┘

        /task "Build REST API"
                │
                ▼
┌─────────────────────────────────────────┐
│  1️⃣ MISSION STARTS                      │
│  • Loop state created                   │
│  • iteration = 1, max = 20              │
│  • State saved: .opencode/loop-state.json│
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  2️⃣ AGENT WORKS                         │◄──────────────────┐
│  • Plans, delegatesexecutes            │                   │
│  • Updates .opencode/todo.md            │                   │
│  • Runs tests, builds                   │                   │
└─────────────────────────────────────────┘                   │
                │                                              │
                ▼                                              │
┌─────────────────────────────────────────┐                   │
│  3️⃣ SESSION GOES IDLE                   │                   │
│  • session.idle event fired             │                   │
│  • MissionSealHandler triggered         │                   │
└─────────────────────────────────────────┘                   │
                │                                              │
                ▼                                              │
┌─────────────────────────────────────────┐                   │
│  4️⃣ CHECK FOR SEAL                      │                   │
│  • Scan last 3 assistant messages       │                   │
│  • Look for <mission_seal>SEALED</...>  │                   │
└─────────────────────────────────────────┘                   │
                │                                              │
       ┌────────┴────────┐                                     │
       ▼                 ▼                                     │
┌─────────────┐   ┌─────────────────────────────┐              │
│ SEAL FOUND  │   │ NO SEAL                     │              │
│             │   │                             │              │
│ ✅ Complete │   │ iteration < max?            │              │
│ Clear state │   │    ┌─────┴─────┐            │              │
│ Show toast  │   │    YES         NO           │              │
└─────────────┘   │    │           │            │              │
                  │    ▼           ▼            │              │
                  │ ┌────────┐ ┌───────────┐    │              │
                  │ │++iter  │ │ MAX LIMIT │    │              │
                  │ │3s toast│ │ Stop loop │    │              │
                  │ │Inject  │ │ Notify    │    │              │
                  │ │continue│ └───────────┘    │              │
                  │ └───┬────┘                  │              │
                  └─────┼───────────────────────┘              │
                        │                                      │
                        └──────────────────────────────────────┘
                                    LOOP

┌─────────────────────────────────────────────────────────────────────────────┐
│                          STATE FILE (.opencode/loop-state.json)             │
├─────────────────────────────────────────────────────────────────────────────┤
│  {                                                                          │
│    "active": true,                                                          │
│    "iteration": 3,                                                          │
│    "maxIterations": 20,                                                     │
│    "sessionID": "abc123...",                                                │
│    "prompt": "Build REST API",                                              │
│    "startedAt": "2026-01-17T15:00:00Z"                                      │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Continuation Prompt (injected on each iteration):**
```xml
<mission_loop iteration="3" max="20">
📋 **Mission Loop Active** - Iteration 3/20

Your previous iteration did not seal the mission. Continue working.

**RULES**:
1. Review your progress from the previous iteration
2. Continue from where you left off
3. Check TODO list for incomplete items
4. When ALL work is TRULY complete, output:
   <mission_seal>SEALED</mission_seal>

**Original Task**: Build REST API
</mission_loop>
```

**Constants (`MISSION_SEAL`):**
```typescript
TAG: "mission_seal"
CONFIRMATION: "SEALED"
PATTERN: "<mission_seal>SEALED</mission_seal>"
DEFAULT_MAX_ITERATIONS: 20
DEFAULT_COUNTDOWN_SECONDS: 3
STOP_COMMAND: "/stop"
CANCEL_COMMAND: "/cancel"
```

### 📣 TaskToastManager (P1 Complete)

| Component | File | Purpose |
|-----------|------|---------|
| `TaskToastManager` | `src/core/notification/task-toast-manager.ts` | Consolidated task notifications |
| `presets` | `src/core/notification/presets.ts` | Common notification templates |

**Features:**
- Consolidated task list display: `Running (3): [2/5]`
- NEW marker for recently added tasks
- Completion summary with remaining count
- Concurrency slot information display

---

## 📂 Directory Structure

```
src/
├── index.ts                    # Plugin main entry
├── agents/
│   ├── definitions.ts          # 7 agent definitions
│   └── subagents/              # Individual agent prompts
├── core/
│   ├── agents/                 # Parallel Agent Manager (12 files)
│   │   ├── manager.ts          # Main facade
│   │   ├── manager/            # TaskLauncher, TaskPoller, TaskCleaner, EventHandler
│   │   ├── concurrency.ts      # ConcurrencyController
│   │   └── task-store.ts       # TaskStore with GC
│   ├── notification/           # Toast System (6 files)
│   │   ├── toast.ts            # Module re-exports
│   │   ├── toast-core.ts       # Core toast functions
│   │   ├── task-toast-manager.ts # Consolidated task notifications (P1)
│   │   └── presets.ts          # Common notification templates
│   ├── cache/                  # Document Cache (6 files)
│   ├── progress/               # Progress Tracker (5 files)
│   ├── recovery/               # Auto Recovery (6 files)
│   │   ├── auto-recovery.ts    # Module re-exports
│   │   ├── session-recovery.ts # Event-based session recovery (P2)
│   │   ├── handler.ts          # Recovery action handler
│   │   └── patterns.ts         # Error pattern definitions
│   ├── session/                # Shared Context (4 files)
│   ├── task/                   # Task Decomposer (6 files)
│   ├── loop/                   # Todo Enforcer + Continuation + Mission Seal (8 files)
│   │   ├── todo-enforcer.ts    # Module re-exports
│   │   ├── todo-continuation.ts # Auto-continue on idle (P2)
│   │   ├── mission-seal.ts     # Explicit completion detection
│   │   ├── mission-seal-handler.ts # Seal event handling
│   │   ├── stats.ts            # Todo statistics
│   │   └── formatters.ts       # Continuation prompt generation
│   └── queue/                  # Async Utilities (4 files)
├── tools/
│   ├── callAgent.ts            # Synchronous agent call
│   ├── parallel/               # Parallel agent tools (delegate_task, etc.)
│   ├── background-cmd/         # Background command tools
│   ├── search.ts               # grep/glob/mgrep
│   └── web/                    # Web tools (fetch/search)
└── shared/
    ├── constants.ts            # System constants + PATHS
    └── event-types.ts          # Event type enums
```

---

## 🔄 Execution Flow

### Phase 1: Plugin Initialization & Master Session Setup

```typescript
OrchestratorPlugin(input):
  1. Toast.initToastClient(client)         // Toast notifications
  2. Toast.initTaskToastManager(client)    // Consolidated task toasts
  3. sessions Map initialization           // Track Master + Worker sessions
  4. ParallelAgentManager.getInstance()    // Worker session manager
  5. Return { provider, tools, hooks }

// When user sends first message:
hooks["chat.message"] → Master Session starts:
  - SessionID tracked in sessions Map
  - Commander agent receives request
  - Master Session begins THINK → PLAN → DELEGATE → MONITOR cycle
```

### Phase 2: Session Lifecycle

```typescript
hooks["chat.message"]:
  1. Parse slash commands (/task, /plan)
  2. TodoContinuation.handleUserMessage()  // Cancel pending countdown
  3. Auto-start on Commander agent selection
  4. ProgressTracker.startSession(sessionId)
  5. Toast.presets.taskStarted()

hooks["event"]:
  1. session.created → Toast.presets.missionStarted()
  2. session.deleted → cleanup all resources
     - sessions.delete(), state.sessions.delete()
     - ProgressTracker.clearSession()
     - SessionRecovery.cleanupSessionRecovery()
     - TodoContinuation.cleanupSession()
  3. session.error → SessionRecovery.handleSessionError()
     - Detect error type (tool_crash, thinking_block, rate_limit)
     - Inject recovery prompt if applicable
     - Return early if recovery initiated
  4. message.updated (assistant) → SessionRecovery.markRecoveryComplete()
  5. session.idle → MissionSealHandler or TodoContinuation
     - If Mission Seal loop active → MissionSealHandler.handleMissionSealIdle()
       - Check for <mission_seal>SEALED</mission_seal>
       - If sealed → complete, else → increment iteration, inject continuation
     - Else → TodoContinuation.handleSessionIdle()
       - Check for incomplete todos
       - Start countdown, inject continuation
  6. ParallelAgentManager.handleEvent()

hooks["tool.execute.after"]:
  1. Check for `<mission_seal>SEALED</mission_seal>` → Toast.presets.missionComplete()
  2. ProgressTracker.recordSnapshot()
  3. Inject CONTINUE_INSTRUCTION
```

### Phase 3: Worker Session Execution (Parallel Tasks)

```typescript
// Master Session calls delegate_task → Worker Sessions created
TaskLauncher.launch():
  1. concurrency.acquire(key)
  2. client.session.create()
  3. store.set(task)
  4. TaskToastManager.addTask()        // Consolidated task list toast
  5. client.session.prompt()
  6. poller.start()

TaskPoller.poll() every 1s:
  1. Get running tasks
  2. Check session events
  3. If idle + stable + hasOutput → completed
  4. Notify parent, schedule cleanup

delegate_task (sync mode):
  1. session.create()
  2. session.prompt()
  3. pollWithSafetyLimits()            // MAX_POLL_COUNT=600, SYNC_TIMEOUT_MS=5min
     - validateSessionHasOutput()     // Ensure actual AI output exists
     - Check idle + stability
  4. extractSessionResult()           // Get final text output
```

### Phase 4: Resource Cleanup

```typescript
EventHandler.handle(session.deleted):
  1. concurrency.release(key)
  2. store.delete(taskId)

TaskCleaner.notifyParentIfAllComplete():
  1. If pendingCount > 0: noReply=true (brief update)
  2. If allComplete: noReply=false (AI processes results)
  3. TaskToastManager.showCompletionToast() or showAllCompleteToast()

TaskCleaner.scheduleCleanup():
  1. setTimeout(10min)
  2. session.delete()
  3. store.delete()

TaskStore.gc():
  1. completed > 30min → archiveTasks()
  2. error > 10min → delete
```

---

## 🛡️ Resource Safety

### Subscription Cleanup

| Subscription | Returns | Cleanup Timing |
|--------------|---------|----------------|
| `Toast.initToastClient()` | `void` | One-time init at plugin start |

### Concurrency Control

```typescript
ConcurrencyController:
  acquire(key):
    if count < limit → immediate
    else → queue.push(resolve)

  release(key):
    if queue.length → queue.shift()()
    else → count--
```

### Memory Limits

| Data Structure | Max Size | Overflow |
|----------------|----------|----------|
| TaskStore.tasks | 1,000 | Auto GC |
| notifications | 100/parent | FIFO |
| ProgressTracker | 100/session | FIFO |

---

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| Max Parallel Sessions | 50 |
| Default Concurrency/Agent | 10 |
| Poll Interval | 1 second |
| Stability Wait | 3 seconds |
| Session TTL | 60 minutes |
| GC Trigger | >1,000 tasks |
| Archive After | 30 minutes |

---

## 🧪 Test Coverage

```
Test Suites: 19 passed
Tests: 216 passed
Duration: ~4.3s
```

---

## 📝 Summary

This **Master Session Architecture** provides:

1. **Master-Worker Pattern** - Commander orchestrates, subagents execute
2. **Scalable** - 50 parallel Worker Sessions
3. **Memory-safe** - Auto GC, disk archiving
4. **Self-healing** - SessionRecovery for automatic error handling
5. **Auto-resuming** - TodoContinuation continues incomplete work
6. **Explicit Completion** - Mission Seal for confirmed task completion
7. **Smart Context** - Shared .opencode/ with adaptive summarization
8. **Observable** - TaskToastManager for consolidated notifications

**Enterprise-grade, memory-safe, self-healing distributed agent orchestration with Master Session coordination.**
