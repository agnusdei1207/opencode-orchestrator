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
│ 🎯 Commander - Master orchestrator (THINK → PLAN → DELEGATE)   │
│ 📋 Planner   - Strategic planning + research (was: Architect+Researcher) │
│ 🔨 Worker    - Implementation + docs (was: Builder+Librarian)  │
│ ✅ Reviewer  - Verification + context (was: Inspector+Recorder)│
└─────────────────────────────────────────────────────────────────┘

Master Session Flow:
1️⃣ THINK    → Analyze request, assess complexity (L1/L2/L3)
2️⃣ PLAN     → Create .opencode/todo.md via Planner
3️⃣ DELEGATE → Spawn Worker Sessions via delegate_task
4️⃣ MONITOR  → Watch .opencode/ for progress, handle complete

Worker Sessions (up to 50 parallel):
• Independent execution with own agent persona
• Read/write shared .opencode/ workspace
• Notify Master on completion (via session events)
• Cannot spawn sub-workers (recursion prevention)
```

---

## 📞 Caller / Callee Relationship Table

### System Components (Automatic, No Agent Involvement)

| Caller | Calls | When | Purpose |
|--------|-------|------|---------|
| `index.ts` | `Toast.initToastClient()` | Plugin init | Initialize toast |
| `index.ts` | `Toast.initTaskToastManager()` | Plugin init | Initialize task toast manager |
| `index.ts` | `ParallelAgentManager.getInstance()` | Plugin init | Initialize manager |
| `index.ts` | `ProgressTracker.startSession()` | Session start | Begin tracking |
| `index.ts` | `ProgressTracker.recordSnapshot()` | Each loop step | Record progress |
| `index.ts` | `ProgressTracker.clearSession()` | Session end | Cleanup |
| `index.ts` | `SessionRecovery.handleSessionError()` | session.error event | Attempt auto-recovery |
| `index.ts` | `SessionRecovery.markRecoveryComplete()` | message.updated | Reset recovery state |
| `index.ts` | `SessionRecovery.cleanupSessionRecovery()` | session.deleted | Cleanup state |
| `index.ts` | `TodoContinuation.handleSessionIdle()` | session.idle event | Check for incomplete todos |
| `index.ts` | `TodoContinuation.handleUserMessage()` | chat.message | Cancel continuation countdown |
| `index.ts` | `TodoContinuation.cleanupSession()` | session.deleted | Cleanup state |
| `index.ts` | `Toast.presets.taskStarted()` | Session start | Show notification |
| `index.ts` | `Toast.presets.missionComplete()` | Mission done | Show notification |
| `index.ts` | `Toast.presets.taskFailed()` | Cancelled | Show notification |
| `index.ts` (handler) | `ParallelAgentManager.handleEvent()` | Any event | Resource cleanup |
| `TaskLauncher` | `ConcurrencyController.acquire()` | Task start | Get slot |
| `TaskLauncher` | `TaskStore.set()` | Task start | Store task |
| `TaskLauncher` | `TaskToastManager.addTask()` | Task start | Show consolidated toast |
| `TaskLauncher` | `TaskPoller.start()` | First task | Begin polling |
| `TaskPoller` (1s) | `TaskStore.getRunning()` | Poll loop | Find active tasks |
| `TaskPoller` | `TaskCleaner.scheduleCleanup()` | Task done | Schedule GC |
| `TaskCleaner` | `TaskToastManager.showCompletionToast()` | Task done | Show completion toast |
| `TaskCleaner` | `TaskToastManager.showAllCompleteToast()` | All done | Show batch summary |
| `EventHandler` | `ConcurrencyController.release()` | session.idle/deleted | Free slot |
| `EventHandler` | `TaskStore.delete()` | session.deleted | Remove task |
| `TaskCleaner` | `TaskStore.gc()` | Prune | Archive old tasks |
| `TaskStore` | `archiveTasks()` | gc() | Write to disk |

### Agent-Callable Tools (Used in Prompts)

| Tool | Agent User | Function | Core System Used |
|------|------------|----------|------------------|
| `delegate_task` | Commander, Planner | Spawn parallel agent | `ParallelAgentManager.launch()` |
| `get_task_result` | Commander | Get completed result | `ParallelAgentManager.getResult()` |
| `list_tasks` | Commander | View all tasks | `ParallelAgentManager.getAllTasks()` |
| `cancel_task` | Commander | Stop task | `ParallelAgentManager.cancelTask()` |
| `webfetch` | Planner, Worker | Fetch URL | `DocumentCache.set()` |
| `websearch` | Planner, Worker | Search web | External API |
| `codesearch` | Planner, Worker | Search code | External API |
| `cache_docs` | Planner, Reviewer | Manage docs | `DocumentCache.get/list/clear()` |
| `run_background` | Worker, Reviewer | Run command | `BackgroundManager.run()` |
| `check_background` | Reviewer | Check command | `BackgroundManager.check()` |
| `grep_search` | All agents | Search files | Node fs |
| `glob_search` | All agents | Find files | Node fs |
| `call_agent` | Commander | Sync agent call | Direct session |

### Smart Context (.opencode/) Management

| File | Managed By | Purpose |
|------|------------|----------|
| `.opencode/todo.md` | Planner creates, Reviewer updates | Master TODO list |
| `.opencode/context.md` | Reviewer | Adaptive-size context |
| `.opencode/summary.md` | Reviewer | Ultra-brief when needed |
| `.opencode/docs/` | Planner, Worker | Cached documentation (with expiry) |
| `.opencode/archive/` | Reviewer | Old context for reference |

**Dynamic Detail Levels:**
- **EARLY** (0-30%): Detailed explanations, research
- **BUILDING** (30-70%): Key decisions + file references
- **FINISHING** (70-100%): Brief status, blockers only

**Centralized Path Constants** (`shared/constants.ts`):
```typescript
PATHS.OPENCODE      // ".opencode"
PATHS.DOCS          // ".opencode/docs"
PATHS.ARCHIVE       // ".opencode/archive"
PATHS.TODO          // ".opencode/todo.md"
PATHS.CONTEXT       // ".opencode/context.md"
PATHS.DOC_METADATA  // ".opencode/docs/_metadata.json"
```

### Unused Infrastructure (Available for Future Integration)

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
