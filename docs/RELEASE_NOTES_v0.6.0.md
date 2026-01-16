# v0.6.0 Release Notes

## 🚀 Ultimate Agent Architecture

This release introduces a comprehensive upgrade to the OpenCode Orchestrator, implementing the Ultimate Agent Architecture system. Key features include anti-hallucination measures, unlimited execution mode, hierarchical task decomposition, and advanced infrastructure components.

---

## ✨ New Features

### 1. Anti-Hallucination System

#### Librarian Agent (`src/agents/subagents/librarian.ts`)
- **Purpose**: Documentation research specialist
- **Features**:
  - Searches official documentation before implementation
  - Caches findings for team reference
  - Provides cited, verified information
  - Reduces false information in AI responses

#### Researcher Agent (`src/agents/subagents/researcher.ts`)
- **Purpose**: Pre-task investigation specialist
- **Features**:
  - Gathers all necessary information before coding
  - Analyzes task requirements
  - Finds existing patterns in codebase
  - Identifies potential risks

### 2. Web Research Tools

#### `webfetch` Tool
```typescript
webfetch({ url: "https://docs.example.com/api" })
```
- Fetches URL content and converts HTML to Markdown
- Automatic caching with configurable TTL
- Respects rate limits

#### `websearch` Tool
```typescript
websearch({ query: "Next.js 14 app router tutorial" })
```
- Web search using DuckDuckGo API
- Returns formatted results with URLs
- Supports filtering and tips

#### `codesearch` Tool
```typescript
codesearch({ query: "useEffect cleanup", language: "typescript" })
```
- Searches open source code via grep.app
- Finds real-world usage patterns
- Links to GitHub sources

#### `cache_docs` Tool
```typescript
cache_docs({ action: "list" })
cache_docs({ action: "get", filename: "nextjs_app_router.md" })
```
- Manages cached documentation
- List, retrieve, clear, and get statistics

### 3. Document Caching System (`src/core/cache/document-cache.ts`)
- Stores fetched documentation in `.cache/docs/`
- Automatic expiration handling
- Metadata tracking (source URL, fetch time, size)
- Statistics and cleanup utilities

### 4. Unlimited Execution Mode

#### Configuration
```typescript
const UNLIMITED_MODE = true;  // Default: enabled
```

- **No step limits**: Execution continues until mission complete
- **Todo-driven execution**: Works through all pending items
- **Completion detection**: Automatic mission complete detection

#### Todo Enforcer (`src/core/loop/todo-enforcer.ts`)
- Tracks todo items with priority and status
- Generates continuation prompts for incomplete work
- Provides progress statistics

### 5. Event Bus System (`src/core/bus/index.ts`)
- **Pub/Sub pattern** for inter-component communication
- **Event types**:
  - `task.started`, `task.completed`, `task.failed`
  - `todo.created`, `todo.updated`, `todo.completed`
  - `session.idle`, `session.busy`, `session.error`
  - `mission.complete`, `mission.failed`
- **Features**:
  - Subscribe/unsubscribe handlers
  - One-time subscriptions
  - Wildcard subscriptions (`*`)
  - Event history tracking
  - Promise-based `waitFor` method

### 6. AsyncQueue & Work Pool (`src/core/queue/index.ts`)
- **AsyncQueue**: Async iterable queue for producer/consumer patterns
- **workPool**: Concurrent task execution with limit
- **workPoolWithResults**: Returns results in original order
- **processBatches**: Batch processing utility
- **retryWithBackoff**: Exponential backoff retry
- **withTimeout**: Timeout wrapper

### 7. Session Shared Context (`src/core/session/shared-context.ts`)
- Share context between parent and child sessions
- **Trackable items**:
  - Cached documents
  - Key findings (patterns, APIs, configs, warnings)
  - Decisions made
- Context merging between parent and child

### 8. Hierarchical Task Decomposition (`src/core/task/task-decomposer.ts`)
- **3-level hierarchy**: L1 (objectives) → L2 (sub-tasks) → L3 (atomic actions)
- **Parallel groups**: Tasks that can run simultaneously
- **Dependencies**: Task ordering via `dependsOn`
- **Progress tracking**: Real-time completion percentage
- **Text parsing**: Parse hierarchy from Architect output

### 9. Toast Notification System (`src/core/notification/toast.ts`)
- Visual notifications for task events
- **Preset notifications**:
  - Task started/completed/failed
  - Mission complete
  - Document cached
  - Rate limited warning
- Event bus integration

### 10. Progress Tracker (`src/core/progress/tracker.ts`)
- Real-time progress snapshots
- Elapsed time tracking
- Progress bar formatting
- Rate calculation (items/minute)
- Time remaining estimation

### 11. Auto Recovery System (`src/core/recovery/auto-recovery.ts`)
- **Automatic error handling**:
  - Rate limit: Exponential backoff
  - Context overflow: Compact context
  - Network errors: Retry with backoff
  - Session errors: Abort gracefully
  - Parse errors: Retry then skip
- **`withRecovery` wrapper** for automatic retry
- Recovery statistics and history

---

## 🔧 Enhanced Agents

### Commander Agent
- **Anti-Hallucination section** added to prompt
- Research workflow instructions
- Mandatory research triggers
- Librarian usage guidelines

### Architect Agent
- **Hierarchical task decomposition** (L1/L2/L3)
- Parallel group specification
- Dependency tracking
- New agent assignments (librarian, researcher)

### Inspector Agent
- **Documentation verification** added
- Cache checking instructions
- Doc compliance in output format
- Deviation flagging

---

## 📁 New Files

```
src/
├── agents/subagents/
│   ├── librarian.ts           # Documentation research agent
│   └── researcher.ts          # Pre-task investigation agent
├── core/
│   ├── bus/
│   │   └── index.ts           # Event bus system
│   ├── cache/
│   │   ├── document-cache.ts  # Document caching
│   │   └── index.ts
│   ├── loop/
│   │   └── todo-enforcer.ts   # Todo-based execution
│   ├── notification/
│   │   └── toast.ts           # Toast notifications
│   ├── progress/
│   │   └── tracker.ts         # Progress tracking
│   ├── queue/
│   │   └── index.ts           # AsyncQueue & Work Pool
│   ├── recovery/
│   │   └── auto-recovery.ts   # Auto recovery system
│   ├── session/
│   │   └── shared-context.ts  # Session context sharing
│   └── task/
│       └── task-decomposer.ts # Hierarchical tasks
└── tools/web/
    ├── webfetch.ts            # URL fetching
    ├── websearch.ts           # Web search
    ├── codesearch.ts          # Code search
    ├── cache-docs.ts          # Cache management
    └── index.ts

tests/unit/
├── event-bus.test.ts          # 11 tests
├── async-queue.test.ts        # 14 tests
├── todo-enforcer.test.ts      # 18 tests
├── document-cache.test.ts     # 12 tests
├── shared-context.test.ts     # 12 tests
├── task-decomposer.test.ts    # 14 tests
├── toast.test.ts              # 11 tests
├── progress-tracker.test.ts   # 12 tests
└── auto-recovery.test.ts      # 10 tests
```

---

## 🧪 Test Coverage

```
Test Files:  17 passed
Tests:       202 passed
Duration:    ~4.2s
```

### New Test Suites
- EventBus: 11 tests
- AsyncQueue: 14 tests
- TodoEnforcer: 18 tests
- DocumentCache: 12 tests
- SharedContext: 12 tests
- TaskDecomposer: 14 tests
- Toast: 11 tests
- ProgressTracker: 12 tests
- AutoRecovery: 10 tests

---

## 📊 Build Size

```
dist/index.js: 552.2kb
```

---

## 🚀 Usage

### Enable Unlimited Mode (default)
Unlimited mode is enabled by default. All commands (`/task`, regular messages, agent selection) work in unlimited mode.

### Research Before Implementation
```typescript
// Commander automatically:
// 1. Searches for documentation
websearch({ query: "API documentation" })

// 2. Fetches official docs
webfetch({ url: "https://official-docs.com/...", cache: true })

// 3. Or delegates to Librarian
delegate_task({ agent: "librarian", prompt: "Research X API" })
```

### Hierarchical Task Planning
```
/task Implement user authentication

// Architect outputs:
- [L1] Setup auth infrastructure
  - [L2] Research auth patterns | agent:librarian
  - [L2] Implement JWT handler | agent:builder | depends:2.1
  - [L2] Create login endpoint | agent:builder | parallel_group:A
  - [L2] Create register endpoint | agent:builder | parallel_group:A
  - [L2] Verify implementation | agent:inspector | depends:2.3,2.4
```

---

## ⚠️ Breaking Changes

None. This release is backward compatible.

---

## 🔄 Migration

No migration required. Simply update to v0.6.0:

```bash
npm install opencode-orchestrator@latest
```

---

## 📝 Contributors

Built with ❤️ by agnusdei1207
