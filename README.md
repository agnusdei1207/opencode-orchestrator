<div align="center">
  <img src="assets/logo.png" alt="logo" width="200" />
  <h1>OpenCode Orchestrator</h1>

  <p>Native-First Autonomous Multi-Agent Engine for High-Integrity Software Engineering</p>

  [![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
</div>

---

## ⚡ Quick Start

```bash
/task "Refactor the authentication module and add unit tests"
```

## 🚀 Engine Architecture (v2)

OpenCode Orchestrator utilizes a **Native-First Loop** to manage autonomous missions with extreme reliability and resource efficiency.

```text
            [ User Mission ]
                    │
          ┌─────────▼─────────┐
          │ MissionController │◄──────────┐ (Idle-Triggered Loop)
          └─────────┬─────────┘           │
                    │                     │
          ┌─────────▼─────────┐           │ (Native Todo Sync)
          │     COMMANDER     │ (Native)  │
          └─────────┬─────────┘           │
                    │                     │
      ┌─────────────┼──────────────┐      │
      ▼             ▼              ▼      │
 [ Planner ]   [ Worker ]   [ Reviewer ]  │
      └─────────────┬──────────────┘      │
                    │                     │
          ┌─────────▼─────────┐           │
          │  ResourceTracker  │───────────┘
          └─────────┬─────────┘
                    │
              [ ✨MISSION COMPLETE ]
```

---

## 🛠️ Key Innovations

### 🏗️ Native-First Orchestration
Directly integrated with OpenCode's **Native Todo** and **Session API**. By using the host's infrastructure for state management, we've reduced internal code complexity by 70% while drastically increasing reliability and performance.

### 🧠 Adaptive Concurrency Control
Execution slots for parallel agents are no longer fixed. Our **Adaptive Controller** dynamically scales slots based on real-time success rates and API latency—scaling up for speed and down for stability.

### 🛡️ Resource Integrity Protocol
The **ResourceTracker** ensures that every session, timer, and asynchronous resource is safely reclaimed. No "zombie" sessions or memory leaks, even during complex agent delegation chains.

### 🔄 Stagnation-Aware Intelligence
The system doesn't just loop; it **analyzes**. If an agent hasn't made progress on Todos across iterations, the MissionController injects a specialized **Diagnostic Intervention** to force a strategy pivot.

---

## ⚡ Elite Multi-Agent Swarm

| Agent | Expertise | Role |
|:------|:-----|:---|
| **Commander** | Mission Hub | Orchestration, parallel delegation, native loop coordination. |
| **Planner** | Architect | Roadmap generation, dependency analysis, research. |
| **Worker** | Implementer | TDD implementation, code generation, refactoring. |
| **Reviewer** | Auditor | Rigid verification, LSP/Lint authority, quality assurance. |

---

## 📊 Technical Excellence
- **Zero-Leak Policy**: Automated resource cleanup via `ResourceTracker`.
- **High Throughput**: Adaptive concurrency scaling for maximum parallel efficiency.
- **Reliable Verification**: Every step is verified using native LSP and AST tools via our high-performance Rust backend.

[Architectural Details →](docs/SYSTEM_ARCHITECTURE.md)
