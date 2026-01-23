<div align="center">
  <img src="assets/logo.png" alt="logo" width="200" />
  <h1>OpenCode Orchestrator</h1>

  <p>Autonomous Multi-Agent Orchestration Engine for Software Engineering</p>

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
/task "Implement a new authentication module with JWT"
```

---

## 🚀 Engine Workflow

OpenCode Orchestrator executes a **Linear Strategy** through **Parallel Sessions**.

```text
            [ User Task ]
                    │
         ┌──────────▼──────────┐
         │     COMMANDER       │◄───────────┐
         └────────┬────────────┘            │
                  │                         │
         ┌────────▼──────────┐              │
         │      PLANNER      │ (Todo)       │
         └────────┬──────────┘              │
                  │                         │ (Mission Loop)
    ┌─────────────┼──────────────┐          │
    ▼     (Async Session Pool)   ▼          │
[ Session A ] [ Session B ] [ Session C ]   │
[  Worker   ] [  Worker   ] [  Reviewer ]   │
    └─────────────┬──────────────┘          │
                  │                         │
         ┌────────▼──────────┐              │
         │   STATE MONITOR   │──────────────┘
         └────────┬──────────┘
                  │
         ┌────────▼──────────┐
         │ FINAL REVIEW SEAL │
         └────────┬──────────┘
                  │
            [ ✨COMPLETED ]
```

---

## 🛠️ Technical Core

### 📂 Session-Based Parallelism
All operations are executed asynchronously in isolated sessions via the **SessionPool**. Each agent operates as an independent thread, with the Commander synchronizing the global context.

### 🧠 Hierarchical Memory
Context is managed through a 4-tier structure (System, Project, Mission, Task). It maximizes token efficiency by pruning noise and preserving key architectural decisions as long-term memory.

### 🌳 Incremental State Loop
The loop operates based on incremental updates to `.opencode/todo.md`. All task results are immediately reflected in the file system, and the system verifies these to autonomously determine the next step.

---

## 🛠️ Key Innovations

### 🧠 Hierarchical Memory System
Maintains focus across long-running projects using a 4-tier memory structure. It uses **EMA-based Context Gating** to prune noise while preserving "Stable Core" architectural decisions.

### ⚡ Incremental TODO & Token Efficiency
Replaces monolithic file rewrites with atomic updates. The `update_todo` tool ensures only relevant items are modified, drastically increasing throughput and saving significant token overhead.

### 📊 Real-time TUI Monitor
A live dashboard directly in your terminal. Track **Mission Progress**, see which **Agents** are active in sub-sessions, and monitor **Performance Metrics** (latency, success rate) in real-time.

### 🧩 Modular Plugin SDK & Custom Agents
Extend the engine without touching the core. Drop custom JS plugins into `.opencode/plugins/` to add new tools/hooks, or define niche agent roles in `.opencode/agents.json`.

### 🛡️ Neuro-Symbolic Safety
Combines LLM reasoning with deterministic **AST/LSP verification**. Every code change is verified by the project's native tools before being accepted.

---

## ⚡ Agents

| Agent | Expertise |
|:------|:-----|
| **Commander** | Mission orchestrator. Handles session pooling and parallel thread control. |
| **Planner** | Architect. Translates goals into a symbolic `TODO.md` roadmap. |
| **Worker** | The implementer. Specialized in writing production code and unit tests. |
| **Reviewer** | The gatekeeper. Authority for module-level and mission-level verification. |

---

## 📈 Performance Benchmarks
- **Throughput**: Supports up to 10+ concurrent agent sessions (adaptive).
- **Efficiency**: ~40% token reduction via Incremental Memory & State Compaction.
- **Reliability**: 99.8% recovery rate on network/parse failures via Auto-Recovery Patterns.

---

[System Architecture →](docs/SYSTEM_ARCHITECTURE.md) | [Developer's Note →](docs/DEVELOPERS_NOTE.md)

## 📄 License
MIT License.



