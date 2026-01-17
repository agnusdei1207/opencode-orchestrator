# OpenCode Orchestrator - System Architecture

> Complete technical documentation for system flow, components, and resource management.

**See [README.md](../README.md) for the complete architecture diagram.**

---

## 📞 Caller / Callee Relationship Table

### System Components (Automatic, No Agent Involvement)

| Caller | Calls | When | Purpose |
|--------|-------|------|---------|
| `index.ts` | `Toast.initToastClient()` | Plugin init | Initialize toast |
| `index.ts` | `ParallelAgentManager.getInstance()` | Plugin init | Initialize manager |
| `index.ts` | `ProgressTracker.startSession()` | Session start | Begin tracking |
| `index.ts` | `ProgressTracker.recordSnapshot()` | Each loop step | Record progress |
| `index.ts` | `ProgressTracker.clearSession()` | Session end | Cleanup |
| `index.ts` | `Toast.presets.taskStarted()` | Session start | Show notification |
| `index.ts` | `Toast.presets.missionComplete()` | Mission done | Show notification |
| `index.ts` | `Toast.presets.taskFailed()` | Cancelled | Show notification |
| `index.ts` (handler) | `ParallelAgentManager.handleEvent()` | Any event | Resource cleanup |
| `TaskLauncher` | `ConcurrencyController.acquire()` | Task start | Get slot |
| `TaskLauncher` | `TaskStore.set()` | Task start | Store task |
| `TaskLauncher` | `TaskPoller.start()` | First task | Begin polling |
| `TaskPoller` (1s) | `TaskStore.getRunning()` | Poll loop | Find active tasks |
| `TaskPoller` | `TaskCleaner.scheduleCleanup()` | Task done | Schedule GC |
| `EventHandler` | `ConcurrencyController.release()` | session.idle/deleted | Free slot |
| `EventHandler` | `TaskStore.delete()` | session.deleted | Remove task |
| `TaskCleaner` | `TaskStore.gc()` | Prune | Archive old tasks |
| `TaskStore` | `archiveTasks()` | gc() | Write to disk |

### Agent-Callable Tools (Used in Prompts)

| Tool | Agent User | Function | Core System Used |
|------|------------|----------|------------------|
| `delegate_task` | Commander, Architect | Spawn parallel agent | `ParallelAgentManager.launch()` |
| `get_task_result` | Commander | Get completed result | `ParallelAgentManager.getResult()` |
| `list_tasks` | Commander | View all tasks | `ParallelAgentManager.getAllTasks()` |
| `cancel_task` | Commander | Stop task | `ParallelAgentManager.cancelTask()` |
| `webfetch` | Librarian, Researcher | Fetch URL | `DocumentCache.set()` |
| `websearch` | Librarian, Researcher | Search web | External API |
| `codesearch` | Librarian, Researcher | Search code | External API |
| `cache_docs` | Librarian, Inspector | Manage docs | `DocumentCache.get/list/clear()` |
| `run_background` | Inspector, Builder | Run command | `BackgroundManager.run()` |
| `check_background` | Inspector | Check command | `BackgroundManager.check()` |
| `grep_search` | All agents | Search files | Node fs |
| `glob_search` | All agents | Find files | Node fs |
| `call_agent` | Commander | Sync agent call | Direct session |

### Smart Context (.opencode/) Management

| File | Managed By | Purpose |
|------|------------|----------|
| `.opencode/todo.md` | Recorder | Master TODO list |
| `.opencode/context.md` | Recorder | Adaptive-size context |
| `.opencode/summary.md` | Recorder | Ultra-brief when needed |
| `.opencode/docs/` | Librarian | Cached documentation (with expiry) |
| `.opencode/archive/` | Recorder | Old context for reference |

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
| `TaskDecomposer` | ✅ Tested | Use in Architect agent prompt output parsing |
| `AutoRecovery` | ✅ Tested | Wrap API calls in `withRecovery()` |
| `AsyncQueue` | ✅ Tested | Use for batch processing |
| `TodoEnforcer` | ✅ Imported | Integrate with CONTINUE_INSTRUCTION |

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
│   ├── notification/           # Toast System (5 files)
│   ├── cache/                  # Document Cache (6 files)
│   ├── progress/               # Progress Tracker (5 files)
│   ├── recovery/               # Auto Recovery (5 files)
│   ├── session/                # Shared Context (4 files)
│   ├── task/                   # Task Decomposer (6 files)
│   ├── loop/                   # Todo Enforcer (5 files)
│   └── queue/                  # Async Utilities (4 files)
├── tools/
│   ├── callAgent.ts            # Synchronous agent call
│   ├── parallel/               # Parallel agent tools
│   ├── background-cmd/         # Background command tools
│   ├── search.ts               # grep/glob/mgrep
│   └── web/                    # Web tools (fetch/search)
└── shared/
    ├── constants.ts            # System constants
    └── event-types.ts          # Event type enums
```

---

## 🔄 Execution Flow

### Phase 1: Plugin Initialization

```typescript
OrchestratorPlugin(input):
  1. Toast.initToastClient(client)  // Initialize toast system
  2. sessions Map initialization
  3. ParallelAgentManager.getInstance(client, directory)
  4. Return { provider, tools, hooks }
```

### Phase 2: Session Lifecycle

```typescript
hooks["chat.message"]:
  1. Parse slash commands (/task, /plan)
  2. Auto-start on Commander agent selection
  3. ProgressTracker.startSession(sessionId)
  4. Toast.presets.taskStarted()

hooks["tool.execute.after"]:
  1. Check "MISSION COMPLETE" → Toast.presets.missionComplete()
  2. ProgressTracker.recordSnapshot()
  3. Inject CONTINUE_INSTRUCTION

hooks["handler"]:
  1. session.deleted → cleanup all resources
  2. ParallelAgentManager.handleEvent()
```

### Phase 3: Parallel Task Execution

```typescript
TaskLauncher.launch():
  1. concurrency.acquire(key)
  2. client.session.create()
  3. store.set(task)
  4. Toast.presets.sessionCreated()
  5. client.session.message()
  6. poller.start()

TaskPoller.poll() every 1s:
  1. Get running tasks
  2. Check session events
  3. If idle + stable → completed
  4. Notify parent, schedule cleanup
```

### Phase 4: Resource Cleanup

```typescript
EventHandler.handle(session.deleted):
  1. concurrency.release(key)
  2. store.delete(taskId)

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
Test Suites: 15 passed
Tests: 167 passed
Duration: ~4.3s
```

---

## 📝 Summary

This architecture is:

1. **Scalable** - 50 parallel sessions
2. **Memory-safe** - Auto GC, disk archiving
3. **Self-healing** - Pattern-based error handling
4. **Smart Context** - Adaptive .opencode/ summarization
5. **Observable** - Progress tracking, toast notifications

**Enterprise-grade, memory-safe, self-healing distributed agent orchestration.**
