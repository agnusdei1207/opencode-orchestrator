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
/task "Implement a real-time collaborative editor using WebSocket"
```

## Overview

OpenCode Orchestrator is a framework designed to manage complex software engineering tasks through parallel multi-agent execution. It extends the capabilities of standard AI agents by introducing a hierarchical delegation model and a multi-stage verification pipeline.

### Key Characteristics
*   **Parallel Execution**: Manages multiple concurrent agent sessions to accelerate development.
*   **Hierarchical Delegation**: Supports recursive task decomposition (Fractal Spawning) for complex requirements.
*   **Integrated Verification**: Employs a multi-stage pipeline (Unit & Integration) to ensure code quality.
*   **Persistent State**: Uses structured logging to maintain state and recover from interruptions.

---

## Core Philosophy: Adaptive Engineering

The orchestrator follows an **Explore → Learn → Adapt → Act** cycle to ensure agents remain grounded in the project's specific context.

*   **Explore**: Systematically discover the project structure, tech stack, and documentation.
*   **Learn**: Extract existing patterns, naming conventions, and architectural decisions from the codebase.
*   **Adapt**: Adjust implementation strategies and verification parameters based on learned context.
*   **Act**: Execute tasks through parallel delegation with evidence-based verification.

---

## 🏗️ Architecture

The system is built upon two core mechanisms that handle scaling and quality control.

### HPFA (Hyper-Parallel Fractal Architecture)
HPFA is a parallel execution model that enables task decomposition at scale.
*   **Managed Concurrency**: Orchestrates up to 50 parallel agent sessions simultaneously.
*   **Recursive Scaling**: Allows "Worker" agents to spawn sub-workers for modular tasks, ensuring deep architectural coverage.

### MSVP (Multi-Stage Verification Pipeline)
MSVP is a structured verification process that decouples implementation from quality assurance.
*   **Stage 1 (Unit Verification)**: Reviewers validate individual module changes and run local tests immediately after implementation.
*   **Stage 2 (Integration Review)**: A master reviewer verifies cross-module consistency and system integrity after all individual units are completed.

---

## 📊 Workflow Diagram

```text
              [User Task Input]
                     │
           ┌─────────▼─────────┐
           │     COMMANDER     │ (Orchestration context)
           └─────────┬─────────┘
                     │
    ┌────────────────▼────────────────┐
    │  Phase 0: Parallel Discovery    │ (Structure, Tech Stack, Docs, Infra)
    └────────────────┬────────────────┘
                     │
           ┌─────────▼─────────┐
           │      PLANNER      │ (Create Hierarchical Plan)
           └─────────┬─────────┘
                     │
    ┌────────────────▼────────────────┐
    │  Phase 1: Parallel Execution    │ (HPFA Implementation Grid)
    └──────┬─────────┬─────────┬──────┘
           │         │         │
    ┌──────▼──┐ ┌────▼───┐ ┌───▼────┐
    │ WORKER  │ │ WORKER │ │ WORKER │ (Fractal Spawning)
    └──────┬──┘ └────┬───┘ └───┬────┘
           │         │         │
    ┌──────▼──┐ ┌────▼───┐ ┌───▼────┐
    │ REVIEWER│ │ REVIEWER│ │ REVIEWER│ (Stage 1: Unit Verification)
    └──────┬──┘ └────┬───┘ └───┬────┘
           │         │         │
    ───────▼─────────▼─────────▼───────
    │          Sync Barrier           │ (Wait for all units)
    ─────────────────┬─────────────────
                     │
           ┌─────────▼─────────┐
           │  MASTER REVIEWER  │ (Stage 2: System Integration)
           └─────────┬─────────┘
                     │
           ┌─────────▼─────────┐
           │  Mission Sealed?  │
           └─────────┬─────────┘
                No ↙   ↘ Yes
             [Loop]   [Complete]
```

---

## 🚀 System Roles

| Role | Responsibility | Key Actions |
|:-----|:---------------|:------------|
| **Commander** | Mission Control | Task assignment, conflict resolution, global synchronization |
| **Planner** | Architecture | Environment analysis, dependency mapping, TODO generation |
| **Worker** | Implementation | Code writing, file modification, unit test creation |
| **Reviewer** | Quality Control| Static analysis, build verification, integration testing |

---

## 🛠️ Features

*   **Concurrent Task Management**: Efficiently handles up to 50 background agent sessions.
*   **Automated Context Synthesis**: Parallel scouters gather environment intelligence (Structure, Stack, Docs) instantly.
*   **Synchronized Verification**: Ensures all distributed tasks pass Stage 1 review before final integration.
*   **Fault Tolerance**: Automatically resumes progress from checkpoints in case of tool or session failure.
*   **Context Optimization**: Monitors context window limits and performs automated compaction for long sessions.

---

##  Piano Developer's Note

OpenCode Orchestrator was developed to solve the "sequential bottleneck" in AI-assisted coding. By treating agents as distributed processing units rather than just chat interfaces, we aim to provide a more reliable and scalable autonomous engineering experience.

[Full Developer's Note →](docs/DEVELOPERS_NOTE.md)
[System Architecture →](docs/SYSTEM_ARCHITECTURE.md)

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
