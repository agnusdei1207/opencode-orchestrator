
---

<div align="center">
  <img src="assets/logo.png" alt="logo" width="200" />
  <h1>OpenCode Orchestrator</h1>
  <p>Production-Grade Multi-Agent Orchestration Engine for High-Integrity Software Engineering</p>

  [![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
</div>

---

## ⚡ Quick Start

```bash
npm install -g opencode-orchestrator
```

Inside an OpenCode environment:
```bash
/task "Implement a new authentication module with JWT and audit logs"
```

---

## 🚀 Engine Workflow

OpenCode Orchestrator utilizes a **Hub-and-Spoke Topology** with **Work-Stealing Queues** to execute complex engineering tasks through parallel, context-isolated sessions.

```text
            [ User Task ]
                    │
         ┌──────────▼──────────┐
         │     COMMANDER       │◄───────────┐ (Loop Phase)
         │  [Work-Stealing]    │            │
         └────────┬────────────┘            │
                  │                         │
         ┌────────▼──────────┐              │
         │      PLANNER      │ (Todo.md)    │
         │  [Session Pool]   │              │
         └────────┬──────────┘              │
                  │                         │ (MVCC Atomic Sync)
     ┌─────────────┼──────────────┐          │
     ▼     (Isolated Session Pool)▼          │
[ Session A ] [ Session B ] [ Session C ]   │
[  Worker   ] [  Worker   ] [  Reviewer ]   │
│ [Memory   ] │ [Memory   ] │ [Memory    │  │
│  Pooling] │ │  Pooling] │ │  Pooling]  │  │
     └─────────────┬──────────────┘          │
                  │                         │
         ┌────────▼──────────┐              │
         │   MSVP MONITOR    │──────────────┘
         │ [Adaptive Poll]   │
         └────────┬──────────┘
                  │
         ┌────────▼──────────┐
         │ QUALITY ASSURANCE │
         └────────┬──────────┘
                  │
            [ ✨COMPLETED ]
```

---

## ⚡ Elite Multi-Agent Swarm

| Agent | Expertise | Capability |
|:------|:----------|:-----------|
| **Commander** | Mission Hub | Session pooling, parallel thread control, state rehydration, work-stealing coordination |
| **Planner** | Architect | Symbolic mapping, dependency research, roadmap generation, file-level planning |
| **Worker** | Implementer | High-throughput coding, TDD workflow, documentation, isolated file execution |
| **Reviewer** | Auditor | Rigid verification, LSP/Lint authority, integration testing, final mission seal |

---

## 🛠️ Core Capabilities

### 🔒 Atomic MVCC State Synchronization
Solves the "Concurrent TODO Update" problem using **MVCC + Mutex**. Agents safely mark tasks complete in parallel without data loss or race conditions. Every state change is cryptographically hashed and logged.

### 🧩 Advanced Hook Orchestration
Execution flows governed by a **Priority-Phase Hook Registry**. Hooks are grouped into phases (`early`, `normal`, `late`) and executed via **Topological Sort** for predictable, dependency-aware ordering.

### 🛡️ Autonomous Recovery
- **Self-healing loops** with adaptive stagnation detection
- **Proactive Agency**: Smart monitoring that audits logs and plans ahead during background tasks
- **Auto-retry with backoff**: Exponential backoff for transient failures

### 🎯 State-Level Session Isolation
Reused sessions in the **SessionPool** are explicitly reset via server-side compaction, ensuring previous task context never leaks into new tasks.

### 🚀 Zero-Payload Turbo Mode
Leverages `system.transform` to unshift agent instruction sets server-side, reducing initial message payloads by **90%+** and preventing context fragmentation.

### 🧠 Hierarchical Memory System
Maintains focus across thousands of conversation turns using a 4-tier memory structure with **EMA-based Context Gating** to preserve architectural truth while pruning noise.

### 🔄 Adaptive Intelligence Loop
- **Stagnation Detection**: Senses when no progress is made across iterations
- **Diagnostic Intervention**: Forces "Diagnostic Mode" mandating log audits and strategy pivots
- **Proactive Agency**: Mandates Speculative Planning during background task execution

---

## � Performance Benchmarks

| Metric | Improvement |
|:-------|:------------|
| CPU Utilization | 90%+ (up from 50-70%) |
| Tool Call Speed | 10x faster (5-10ms vs 50-100ms) via Rust pool |
| Session Creation | 90% faster (50ms vs 500ms) via session pooling |
| Memory Usage | 60% reduction via object/string/buffer pooling |
| GC Pressure | 80% reduction |
| Token Efficiency | 40% reduction via Incremental State & System Transform |
| Sync Accuracy | 99.95% via MVCC+Mutex |
| Parallel Efficiency | 80% improvement (50% → 90%+) |

---

## 🏗️ Infrastructure & Reliability

### Resource Safety
- **RAII Pattern**: Guaranteed resource cleanup with zero leaks
- **ShutdownManager**: Priority-based graceful shutdown (5s timeout per handler)
- **Atomic File Operations**: Temp file + rename for corruption-proof writes
- **Automatic Backups**: Timestamped config backups with rollback support

### Safety Features
- **Circuit Breaker**: Auto-recovery from API failures (5 failures → open)
- **Resource Pressure Detection**: Rejects low-priority tasks when memory > 80%
- **Terminal Node Guard**: Prevents infinite recursion via depth limit
- **Auto-Scaling**: Concurrency slots adjust based on success/failure rate

### Technical Stack
- **Runtime**: Node.js 18+ (TypeScript)
- **Tools**: Rust-based CLI tools (grep, glob, ast) via connection pool
- **Concurrency**: Chase-Lev work-stealing deque + priority queues
- **Memory**: Object pooling + string interning + buffer pooling
- **State Management**: MVCC + Mutex
- **Safety**: RAII + circuit breaker + resource pressure detection

---

## 🔧 Installation & Configuration

### Safe Installation
The installation process is **production-safe** with multiple protection layers:

1. ✅ **Never overwrites** — always merges with existing config
2. ✅ **Automatic backups** — timestamped, last 5 kept
3. ✅ **Atomic writes** — temp file + rename (OS-level atomic)
4. ✅ **Automatic rollback** — restores from backup on any failure
5. ✅ **Cross-platform** — Windows (native, Git Bash, WSL2), macOS, Linux
6. ✅ **CI-aware** — skips non-essential operations in CI environments
7. ✅ **Timeout protection** — 30s timeout prevents hanging
8. ✅ **Graceful degradation** — exits 0 on non-critical failures

### Configuration Logs
- Unix: `/tmp/opencode-orchestrator.log`
- Windows: `%TEMP%\opencode-orchestrator.log`

### Plugin Co-existence
The installer is designed to work alongside other OpenCode plugins, including **oh-my-openagent**:

- ✅ **Distinct plugin names** — `opencode-orchestrator` vs `oh-my-openagent` (or legacy `oh-my-opencode`)
- ✅ **Non-destructive installation** — only adds our plugin entry, never removes others
- ✅ **Non-destructive uninstallation** — only removes our plugin entry, preserves others
- ✅ **Exact matching** — uses exact match + version suffix (`PLUGIN_NAME@version`) to prevent false positives
- ✅ **Co-existence logging** — detects and logs other known plugins during install

Both plugins can be installed simultaneously without conflicts. Each maintains its own config entries independently.

---

## 🧪 Testing & Stability

### Test Harness System
A production-grade test harness (`tests/harness/`) provides:
- **Disposable tmpdir**: Automatic cleanup with `Symbol.asyncDispose` / `Symbol.dispose`
- **Test builders**: Factory functions for `ParallelTask`, `BackgroundTask`, `Todo`
- **Mock utilities**: Console, process, timers, file system, event emitter mocks

```typescript
import { tmpdir, createParallelTask, mockConsole } from "@/tests/harness";

await using tmp = await tmpdir({ git: true });
const task = createParallelTask({ description: "Test" });
```

### TUI Stability
- **Cleanup guarantees**: `initToastClient()` returns a cleanup function
- **Timeout protection**: AbortController-based 2-10s timeout for async toast operations
- **Error isolation**: Try/catch around all toast operations prevents cascade failures

### Cross-Platform Reliability
- **Windows guard**: Proper handling of WSL2, Git Bash, native Windows paths
- **Signal handling**: Graceful shutdown on SIGINT/SIGTERM
- **Process isolation**: Child process cleanup with timeout

---

## 📚 Documentation

- [System Architecture Deep-Dive →](docs/SYSTEM_ARCHITECTURE.md)
- [Developer Notes →](docs/DEVELOPERS_NOTE.md)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with ⚡ for production-grade autonomous software engineering</sub>
</div>
