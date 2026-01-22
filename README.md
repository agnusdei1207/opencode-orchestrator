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

In an OpenCode environment:
```bash
/task "Implement"
``` 

## Overview

OpenCode Orchestrator is an **autonomous software engineering engine** designed for mission-critical tasks. Unlike simple chat assistants, it operates on a strict **"verify, then trust"** philosophy.

The Commander orchestrates specialized agents (Planner, Worker, Reviewer) to execute complex engineering workflows—adapting to new requirements, writing strict tests, and persisting until the job is done.

---

## 📊 Workflow

```text
              [ 👑 User Task Input ]
                        │
            ┌───────────▼───────────┐ <────────────────────────────────────────┐
            │   🫡 COMMANDER (Hub)  │  (Orchestration)                         │
            └───────────┬───────────┘                                          │
                        │                                                      │
            ┌───────────▼───────────┐                                          │
            │   🗓️ PLANNER (Map)    │  (Create TODO.md)                        │
            └───────────┬───────────┘                                          │
                        │                                                      │
     ┌──────────────────▼──────────────────┐                                   │
     │   ⚡ COMMANDER: Parallel Spawning   │                                   │
     └──────┬───────────┬───────────┬──────┘                                   │
            │           │           │                                          │
     ┌──────▼───┐ ┌─────▼────┐ ┌────▼─────┐                                    │
     │ 🔨 WORKER│ │ 🔨 WORKER│ │ 🔨 WORKER│                                    │
     └──────┬───┘ └─────┬────┘ └────┬─────┘                                    │
            │           │           │                                          │
     ╔══════▼═══════════▼═══════════▼══════╗                                   │
     ║   🔍 COMMANDER: Parallel Reviewers  ║                                   │
     ╚══════╤═══════════╤═══════════╤══════╝                                   │
            │           │           │                                          │
     ┌──────▼───┐ ┌─────▼────┐ ┌────▼─────┐                                    │
     │🔍REVIEWER│ │🔍REVIEWER│ │🔍REVIEWER│                                    │
     └──────┬───┘ └─────┬────┘ └────┬─────┘                                    │
            │           │           │                                          │
           ═▼═══════════▼═══════════▼═                                         │
           │      🚦 SYNC BARRIER      │                                         │
           ═════════════╤═════════════                                         │
                        │                                                      │
            ┌───────────▼───────────┐                                          │
            │ ✔️ MASTER REVIEWER    │  (E2E Verification)                      │
            └───────────┬───────────┘                                          │
                        │                                                      │
              __________▼_________                                             │
             ╱                    ╲    NO (Loop / Auto-Correction)             │
            ╱   ✅ All TODOs?      ╲ ──────────────────────────────────────────┘
            ╲   🛡️ Error Rate 0%?  ╱
             ╲____________________╱
                        │ YES
                        │
                [ 🎖️ MISSION SEALED ]
```


---

## 🧠 Cognitive Architecture & Key Strengths

### 📉 Exponential Context Smoothing & Stable Memory
We combat "Context Drift" using a mechanism akin to **Exponential Smoothing**. Irrelevant conversation noise decays rapidly, while critical architectural decisions are reinforced into a **Stable Core Memory**. This ensures agents retain only the "pure essence" of the mission state, allowing them to work indefinitely without **Catastrophic Forgetting** or polluting the context window.

### 🧬 Adaptive Anthropomorphic Collaboration
Built on an **Adaptive AI Philosophy**, the agents function like a **Human Engineering Squad**, not a chatbot. They **do not estimate** or guess. If tools are missing, they install them; if requirements are vague, they clarify. The Commander, Planner, and Reviewer collaborate organically to solve problems deterministically, mirroring a senior team's workflow.

### ⚙️ Neuro-Symbolic Hybrid Engine (Rust + LLM)
Pure LLM approaches are stochastic. We bind them with a **Neuro-Symbolic Architecture** that anchors probabilistic reasoning to the deterministic precision of **Rust-based AST/LSP Tools**. This ensures every generated token is grounded in rigorous syntax analysis, delivering high performance with minimal resource overhead.

### ⚡ Hybrid Sync/Async & Dynamic Parallelism
The engine features an **Intelligent Load-Balancing System** that fluidly switches between synchronous synchronization barriers and asynchronous fork-join patterns. It monitors execution pressure to **Dynamically Adjust** concurrency slots in real-time. This **Resource-Aware Multi-Parallel System** maximizes throughput on high-end hardware while maintaining stability on constrained environments.

### 🎯 Iterative Rejection Sampling (Zero-Shot Defense)
We employ a **Rejection Sampling Loop** driven by the Reviewer Agent (Reward Model). Through the **Metric-based Strict Verification Protocol (MSVP)**, code paths that fail execution tests are pruned. The system iterates until the solution converges on a mathematically correct state (0% Error Rate), rejecting any solution that lacks evidence.

### 🧩 Externalized Chain-of-Thought (CoT)
The Planner's `TODO.md` serves as an **Externalized Working Memory**. This persistent **Symbolic Chain-of-Thought** decouples detailed planning from the LLM's immediate context window, enabling the orchestration of massive, multi-step engineering tasks without logical degradation.

---

## ⚡ Agents

| Agent | Role |
|:------|:-----|
| **Commander** | Orchestrates the mission, manages parallel threads and sync barriers |
| **Planner** | Architecture architect. Breaks downtasks into strictly defined steps |
| **Worker** | The builder. Writes code and corresponding unit tests |
| **Reviewer** | The gatekeeper. Rejects any code that doesn't pass execution verification |

---

## Developer's Note

OpenCode Orchestrator is a testament to the operational paradox: **Complexity is easy; Simplicity is hard.**

While the user interaction remains elegantly minimal, the internal architecture encapsulates a rigorous alignment of **microscopic state management** (`Rust atoms`) and **macroscopic strategic planning** (`Agent Topology`). Every component reflects a deep design philosophy aimed at abstracting chaos into order.

Building this system reaffirmed a timeless engineering truth: **"Simple is Best" is the ultimate complexity to conquer.** This engine is our answer to that challenge—hiding the heavy machinery of autonomous intelligence behind a seamless veil of collaboration.

This philosophy extends to efficiency. We achieved **Zero-Configuration** usability while rigorously optimizing for **Token Efficiency** (saving ~40% vs major alternatives). By maximizing the potential of cost-effective models like **GLM-4.7**, we prove that superior engineering—not just raw model size—is the key to autonomous performance.

[Full Developer's Note →](docs/DEVELOPERS_NOTE.md)

[System Architecture →](docs/SYSTEM_ARCHITECTURE.md)

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
