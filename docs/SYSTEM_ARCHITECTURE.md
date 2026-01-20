# OpenCode Orchestrator - Titan-Class System Architecture

> **The Blueprint for Infinite Scalability and Multi-Stage Integrity.**

---

## 🌌 The Core Paradigm: HPFA™ & MSVP™

OpenCode Orchestrator is engineered to transcend the limitations of sequential AI tasking. It operates on a dual-engine architecture designed for maximum velocity and architectural absolute.

### 🧬 HPFA™ (Hyper-Parallel Fractal Architecture)
Achieves extreme execution density through autonomous fractal scaling.
1. **Fractal Multi-Agent Trees (MAT)**: Beyond simple delegation. Agents act as autonomous nodes (Mini-Planners) that can recursively expand into sub-grids.
2. **Speculative Racing**: Ambiguous tasks are tackled by multiple agents with varying strategies in parallel. The optimal verified path is integrated, and others are instantly pruned.
3. **Real-time Brain Sync**: A high-speed shared persistent memory layer where workers broadcast patterns, locks, and findings to prevent architectural drift across sessions.

### 🛡️ MSVP™ (Multi-Stage Verification Pipeline)
Eliminates post-completion failures through continuous, pipelined integrity checks.
1. **Stage 1: Parallel Unit Verification**: Every implemented module is immediately met by a **Shadow Reviewer** session for unit testing and static analysis before the main task concludes.
2. **Global Sync Barrier**: A deterministic coordination gate that ensures all parallel unit pairs (Work + Review) are SUCCESS before global integration begins.
3. **Stage 2: Final Integration Seal**: A Master Reviewer performs cross-module consistency checks and full E2E validation to ensure the mission is ready for **Sealing**.

```
HPFA Agent Roles:
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 Commander - Master orchestrator (Read → Delegate → Loop)     │
│ 📋 Planner   - Strategic planning + MAT initialization          │
│ 🔨 Worker    - Recursive implementer (Can act as Mini-Planner)  │
│ ✅ Reviewer  - MSVP enforcer (Unit-Stage & Integration-Stage)   │
└─────────────────────────────────────────────────────────────────┘

Master Session Flow (MSVP Model):
1️⃣ STRATEGIC PLAN → Planner creates architectural todo.md.
2️⃣ FRACTAL DELEGATE → Workers spawn for modules (Grid execution).
3️⃣ STAGE 1 REVIEW → Unit-Reviewers launch immediately per module.
4️⃣ SYNC BARRIER   → Global wait for all [Work + Unit-Review] pairs.
5️⃣ STAGE 2 REVIEW → Master Reviewer performs E2E + Cross-sync.
6️⃣ SEAL/LOOP      → Final mission validation.

Worker Sessions (Autonomous & Fractal):
• RECURSIVE: Workers can delegate sub-tasks using `delegate_task`.
• TDD+MSVP: Test → Implement → Immediate Unit-Review trigger.
• SYNC: Real-time broadcast of discovered patterns to `.opencode/`.
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

## 🔄 Multi-Stage Verification Workflow (MSVP)

```
👤 User: /task "Build Complex System"
             │
             ▼
┌───────────────────────────────────────────────────────────┐
│  🎯 COMMANDER (Orchestration)                              │
│  1. Strategize mission depth                              │
│  2. Delegate to Planner                                   │
└───────────────────────────────────────────────────────────┘
             │
             ▼
┌───────────────────────────────────────────────────────────┐
│  📋 PLANNER                                                │
│  1. Create Domain Manifest (Todo.md)                      │
│  2. Define parallel boundaries                            │
└───────────────────────────────────────────────────────────┘
             │
             ▼
    ══════════════════════════════════════════════════════
    ║            🔥 HPFA PARALLEL GRID (Stage 1)        ║
    ══════════════════════════════════════════════════════
    │               │               │
    ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│🔨 WORKER │    │🔨 WORKER │    │🔨 WORKER │  <-- Fractal Spawning
│ Module A │    │ Module B │    │ Module C │      (Sub-workers)
└────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │
     ▼ (Instant Review per Module - Stage 2)
┌──────────┐    ┌──────────┐    ┌──────────┐
│✅ REVIEW │    │✅ REVIEW │    │✅ REVIEW │  <-- Unit-Stage
│ (Unit-A) │    │ (Unit-B) │    │ (Unit-C) │      Verification
└────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │
    ═▼═══════════════▼═══════════════▼════════════════════
    ║                ⏳ SYNC BARRIER                     ║
    ══════════════════════════════════════════════════════
                               │
             (All Units Passed + Logic Complete)
                               │
           ┌───────────────────▼───────────────────┐
           │      ✅ MASTER REVIEWER — Stage 2 Pass │
           │         (Cross-module Integration)    │
           │    → Consistency, Full E2E, Final Seal│
           └───────────────────┬───────────────────┘
                               │
                     ┌─────────┴─────────┐
                     │   All Complete?   │
                     └─────────┬─────────┘
                         No ↙     ↘ Yes
                     ♻️ LOOP    🎖️ MISSION SEALED
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
│    "maxIterations": 1000,                                                     │
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
DEFAULT_MAX_ITERATIONS: 1000
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
│   ├── notification/           # Notification System (12 files)
│   │   ├── toast.ts            # Module re-exports
│   │   ├── toast-core.ts       # Core toast functions
│   │   ├── task-toast-manager.ts # Consolidated task notifications (P1)
│   │   ├── presets.ts          # Common notification templates
│   │   └── os-notify/          # OS Native Notifications (P3)
│   │       ├── handler.ts      # Main orchestration logic
│   │       ├── notifier.ts     # Command execution logic
│   │       ├── sound-player.ts # Cross-platform sound logic
│   │       ├── platform.ts     # Platform detection utils
│   │       ├── platform-resolver.ts # Command path resolution
│   │       └── todo-checker.ts # Integration with Todo system
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
  3. createSessionNotificationHandler()    // OS native notifications
  4. sessions Map initialization           // Track Master + Worker sessions
  5. ParallelAgentManager.getInstance()    // Worker session manager
  6. Return { provider, tools, hooks }

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

### Phase 3: Multi-Stage Verification (MSVP)
The orchestrator pipelines verification to avoid serial bottlenecks.

**Stage 1: Unit-Stage Review (Parallel)**
- Triggered immediately when any Worker completes a sub-task.
- A parallel Reviewer session is launched for that specific unit.
- **Tools**: `lsp_diagnostics`, `unit_tests`, `grep_search`.
- **Goal**: Verify the individual component is robust before global sync.

**Stage 2: Integration-Stage Review (Sequential)**
- Triggered after the **Sync Barrier** (all Stage 1 tasks must be SUCCESS).
- A single Master Reviewer validates the collective state.
- **Tools**: `build`, `e2e_tests`, `ast_search` (for cross-module consistency).
- **Goal**: Final system validation and Mission Seal.

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

## 🔔 OS Native Support

The orchestrator includes a dedicated OS-native notification system to alert users when the agent has completed its autonomous work and requires user feedback or approval.

### 🏠 OS Native Notifications
Located in `src/core/notification/os-notify/`, this system monitors session idle events and sends cross-platform alerts.

| Platform | Notification Method | Sound Player | Default Sound |
|----------|---------------------|--------------|---------------|
| **macOS** | `osascript` (AppleScript) | `afplay` | Glass.aiff |
| **Linux** | `notify-send` | `paplay` / `aplay` | complete.oga |
| **Windows** | PowerShell (Toast) | `Media.SoundPlayer` | notify.wav |

### 🛠️ Key Features
- **Intelligent Debouncing**: Uses `idleConfirmationDelay` (default: 1500ms) to ensure the session is truly idle before alerting.
- **Race Condition Handling**: Version tracking prevents duplicate notifications if the agent resumes activity during transmission.
- **Todo Consistency**: Optional `skipIfIncompleteTodos` check ensures notifications only fire when all planned subtasks are finished.
- **Background Filtering**: Automatically excludes parallel worker sessions from triggering notifications, focusing only on the Master Session.

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

### Execution Model (MSVP)

| Phase | Agent | Parallelism | Verification Level | Purpose |
|:------|:------|:------------|:-------------------|:--------|
| 1️⃣ Plan | Planner | Single | Static | Strategic Roadmap |
| 2️⃣ Build | Workers | **Fractal Parallel**| TDD | Implementation |
| 3️⃣ Unit Pass | Reviewers | **Shadow Parallel**| **Stage 1**: Unit | Module robustness |
| 4️⃣ Sync | Barrier | Blocking | N/A | State alignment |
| 5️⃣ Integrate | Master Reviewer | Single | **Stage 2**: E2E | System integrity |

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

---

## 📝 The Summary of Excellence

This **Hyper-Parallel Fractal Architecture** delivers:

1. **Fractal Delegation** - A self-replicating Master-Worker structure with recursive intelligence.
2. **Multi-Stage Verification (MSVP™)** - Zero-delay integrity through parallelized validation grids.
3. **Infinite Scalability** - Grid execution supporting massive concurrency with 0.1ms decision mapping.
4. **Iron-Clad Reliability** - Auto GC, disk-based WAL, and real-time state persistence.
5. **Self-Healing Mastery** - Adaptive session recovery that turns failures into learning loops.
6. **Deterministic Sealing** - <mission_seal> for absolute confirmation of mission success.

**Enterprise-grade, titan-class autonomous orchestration for the next era of high-velocity engineering.**
