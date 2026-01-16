# OpenCode Orchestrator v0.6.0 - Ultimate Agent Architecture

> **The most significant release yet** - A complete rewrite of the internal architecture introducing enterprise-grade distributed agent orchestration.

See **[README.md](../../README.md)** for the complete architecture diagram.

---

## ⚡ Key Changes At-a-Glance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Parallel Sessions** | 1 | 50 | 50x |
| **Concurrency/Agent** | 1 | 10 | 10x |
| **Memory Management** | None | Auto GC + Disk Archive | ✅ |
| **Error Recovery** | Manual | Pattern-based Auto | ✅ |
| **Event System** | None | Pub/Sub Bus | ✅ |
| **Progress Tracking** | None | Real-time Snapshots | ✅ |
| **Context Sharing** | None | Parent-Child Merge | ✅ |
| **Task Decomposition** | Flat | 3-Level Hierarchy | ✅ |
| **Tests** | 87 | 211 | 2.4x |

---

## 🎯 New Core Systems

### 1. Event Bus (`src/core/bus/`)
Real-time pub/sub communication across all components.

```typescript
emit(TASK_EVENTS.STARTED, { taskId, agent: "builder" });
EventBus.subscribe(TASK_EVENTS.COMPLETED, (event) => { ... });
```

### 2. Parallel Agent Manager (`src/core/agents/`)
Session-based async agent execution with full lifecycle management.

- TaskLauncher → Create new parallel sessions
- TaskResumer → Resume paused sessions  
- TaskPoller → Detect completion (1s interval)
- TaskCleaner → GC + Archive to disk
- EventHandler → session.idle, session.deleted
- ConcurrencyController → Max 10/agent, 50 total

### 3. Auto Recovery (`src/core/recovery/`)
Pattern-based automatic error handling.

| Error Pattern | Recovery Action |
|---------------|-----------------|
| `/rate.?limit\|429/` | Retry + Exponential backoff |
| `/token.?limit/` | Compact context |
| `/network/` | Retry 3x with backoff |
| `/parse.?error/` | Retry 2x then skip |

### 4. Progress Tracker (`src/core/progress/`)
Real-time progress monitoring with formatted output.

### 5. Toast Notifications (`src/core/notification/`)
Visual notifications with presets and auto-subscribe to events.

### 6. Document Cache (`src/core/cache/`)
Cached documentation with auto-expiration.

### 7. Shared Context (`src/core/session/`)
Parent-child session context sharing and merging.

### 8. Task Decomposer (`src/core/task/`)
3-level hierarchical task breakdown with parallel groups.

---

## 📦 Memory Safety Guarantees

| Resource | Limit | Safety Mechanism |
|----------|-------|------------------|
| **Tasks in Memory** | 1,000 | Auto GC when exceeded |
| **Archived Tasks** | Unlimited | Disk storage |
| **Notifications/Parent** | 100 | FIFO eviction |
| **Event History** | 100 | Ring buffer |
| **Session TTL** | 60 min | Auto cleanup |

---

## 🧪 Test Coverage

```
Test Suites:  18 passed
Tests:        211 passed
Duration:     ~4.3s
```

---

## 📁 New Directory Structure

```
src/core/
├── bus/           # Event Bus (4 files)
├── agents/        # Parallel Agent Manager (12+ files)
├── notification/  # Toast System (5 files)
├── cache/         # Document Cache (6 files)
├── progress/      # Progress Tracker (5 files)
├── recovery/      # Auto Recovery (5 files)
├── session/       # Shared Context (4 files)
├── task/          # Task Decomposer (6 files)
├── loop/          # Todo Enforcer (5 files)
└── queue/         # Async Utilities (4 files)
```

---

## 🚀 New Tools

| Tool | Description |
|------|-------------|
| `webfetch` | Fetch URL content as Markdown |
| `websearch` | Web search (SearXNG → Brave → DuckDuckGo) |
| `codesearch` | Search open source code patterns |
| `cache_docs` | Manage cached documentation |

---

## 📊 Build Size

```
dist/index.js: 572.6kb
```

---

## ⚠️ Breaking Changes

None. This release is fully backward compatible.

---

## 🔄 Upgrade

```bash
npm install -g opencode-orchestrator@latest
```

---

## 📝 Contributors

Built with ❤️ by agnusdei1207
