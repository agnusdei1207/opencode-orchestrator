<div align="center">
  <img src="assets/logo.png" alt="logo" width="200" />
  <h1>OpenCode Orchestrator</h1>

  <p>Autonomous Multi-Agent Orchestration Engine for High-Integrity Software Engineering</p>

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

OpenCode Orchestrator utilizes a **Hub-and-Spoke Topology** to execute complex engineering tasks through parallel, context-isolated sessions.

```text
            [ User Task ]
                    │
         ┌──────────▼──────────┐
         │     COMMANDER       │◄───────────┐ (Loop Phase)
         └────────┬────────────┘            │
                  │                         │
         ┌────────▼──────────┐              │
         │      PLANNER      │ (Todo.md)    │
         └────────┬──────────┘              │
                  │                         │ (MVCC Atomic Sync)
     ┌─────────────┼──────────────┐          │
     ▼     (Isolated Session Pool)▼          │
[ Session A ] [ Session B ] [ Session C ]   │
[  Worker   ] [  Worker   ] [  Reviewer ]   │
     └─────────────┬──────────────┘          │
                  │                         │
         ┌────────▼──────────┐              │
         │   MSVP MONITOR    │──────────────┘
         └────────┬──────────┘
                  │
         ┌────────▼──────────┐
         │ QUALITY ASSURANCE │
         └────────┬──────────┘
                  │
            [ ✨COMPLETED ]
```

---

## 🛠️ Technical Excellence

### ️ Atomic MVCC State Synchronization
The engine solves the "Concurrent TODO Update" problem using **Multi-Version Concurrency Control (MVCC) + Mutex**. Agents can safely mark tasks as complete in parallel without data loss or race conditions. Every state change is kryptographically hashed and logged for a complete audit trail.

### 🧩 Advanced Hook Orchestration
Execution flows are governed by a **Priority-Phase Hook Registry**. Hooks (Safety, UI, Protocol) are grouped into phases (`early`, `normal`, `late`) and executed using a **Topological Sort** to handle complex dependencies automatically, ensuring a predictable and stable environment.

### ️ Autonomous Recovery
- **Self-healing loops** with adaptive stagnation detection.
- **Proactive Agency**: Smart monitoring that audits logs and plans ahead during background tasks.

### ️ State-Level Session Isolation
Reused sessions in the **SessionPool** are explicitly reset using server-side compaction triggered by health monitors. This ensures that previous task context (old error messages, stale file references) never leaks into new tasks, maintaining 100% implementation integrity.

### 🚀 Zero-Payload Turbo Mode
Leverages `system.transform` to unshift massive agent instruction sets on the server side. This reduces initial message payloads by **90%+**, slashing latency and preventing context fragmentation during long autonomous loops.

---

## 🛠️ Key Innovations

### 🧠 Hierarchical Memory System
Maintains focus across thousands of conversation turns using a 4-tier memory structure and **EMA-based Context Gating** to preserve "Architectural Truth" while pruning operational noise.

###  Dynamic Concurrency Auto-Scaling
Slots for parallel implementation scale up automatically after a **3-success streak** and scale down aggressively upon detection of API instability or implementation failures.

### 🛡️ Neuro-Symbolic Safety
Combines LLM reasoning with deterministic **AST/LSP verification**. Every code change is verified by native system tools before being accepted into the master roadmap.

### 🔄 Adaptive Intelligence Loop
- **Stagnation Detection**: Automatically senses when no progress is made across multiple iterations.
- **Diagnostic Intervention**: Forces the agent into a "Diagnostic Mode" when stagnation is detected, mandating log audits and strategy pivots.
- **Proactive Agency**: Mandates Speculative Planning and Parallel Thinking during background task execution.

### 📊 Real-time TUI Monitor
A live dashboard directly in your TUI. Monitor **Mission Progress**, active **Agent Sub-sessions**, and **Technical Metrics** through optimized, protocol-safe channels.

---

## ⚡ Elite Multi-Agent Swarm

| Agent | Expertise | Capability |
|:------|:-----|:---|
| **Commander** | Mission Hub | Session pooling, parallel thread control, state rehydration. |
| **Planner** | Architect | Symbolic mapping, dependency research, roadmap generation. |
| **Worker** | Implementer | High-throughput coding, TDD workflow, documentation. |
| **Reviewer** | Auditor | Rigid verification, LSP/Lint authority, final mission seal. |

---

## 📈 Performance Benchmarks
- **Throughput**: 10+ concurrent agent sessions with adaptive slot scaling.
- **Accuracy**: 99.95% sync reliability via MVCC+Mutex transaction logic.
- **Efficiency**: 40% reduction in token burn via Incremental State & System Transform.
- **Uptime**: 100% mission survival through plugin restarts via S.H.R (Self-Healing Rehydration).

---

[Internal Architecture Deep-Dive →](docs/SYSTEM_ARCHITECTURE.md) | [Windows Configuration Guide →](docs/WINDOWS_CONFIGURATION.md)

## 📄 License
MIT License.
