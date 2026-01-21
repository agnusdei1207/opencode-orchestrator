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

OpenCode Orchestrator manages complex software tasks through **parallel multi-agent execution**. Commander orchestrates Workers and Reviewers to implement and verify code concurrently.

---

## 📊 Workflow

```text
              [User Task Input]
                     │
           ┌─────────▼─────────┐
           │     COMMANDER     │  (Orchestration)
           └─────────┬─────────┘
                     │
           ┌─────────▼─────────┐
           │      PLANNER      │  (Create TODO.md)
           └─────────┬─────────┘
                     │
    ┌────────────────▼────────────────┐
    │   COMMANDER: Parallel Workers   │
    └──────┬─────────┬─────────┬──────┘
           │         │         │
    ┌──────▼──┐ ┌────▼───┐ ┌───▼────┐
    │ WORKER  │ │ WORKER │ │ WORKER │
    └──────┬──┘ └────┬───┘ └────┬────┘
           │         │          │
    ╔══════▼═════════▼══════════▼══════╗
    ║   COMMANDER: Parallel Reviewers  ║
    ╚══════╤═════════╤══════════╤══════╝
           │         │          │
    ┌──────▼──┐ ┌────▼───┐ ┌────▼────┐
    │REVIEWER │ │REVIEWER │ │REVIEWER │
    └──────┬──┘ └────┬───┘ └────┬────┘
           │         │          │
          ═▼═════════▼══════════▼═
          │     SYNC BARRIER     │
          ═══════════╤═══════════
                     │
           ┌─────────▼─────────┐
           │  MASTER REVIEWER  │  (E2E Verification)
           └─────────┬─────────┘
                     │
                [MISSION SEALED]
```


```mermaid
graph TD
    %% Nodes
    User(("User 👤"))
    LLM(("Brain (LLM) 🧠"))
    Tool(("Tool 🛠️"))
    
    %% 1. Chat Processing
    subgraph Chat_Processing [Chat Processing]
        UserAct[UserActivity Hook]
        MissionChat[MissionControl Hook - Start]
    end

    %% 2. Pre-Execution
    subgraph Pre_Execution [Pre-Execution Guard]
        RoleGuard[StrictRoleGuard]
    end

    %% 3. Post-Execution
    subgraph Post_Execution [Post-Execution Processing]
        Scanner[SecretScanner]
        UI[AgentUI Hook]
        Resource[ResourceControl - Track]
    end

    %% 4. Completion
    subgraph Completion [Completion & Loop Control]
        Sanity[SanityCheck]
        MissionDone[MissionControl Hook - Loop]
        ResourceComp[ResourceControl - Compact]
    end

    %% Flow Connections
    User -->|1. Message| UserAct
    UserAct --> MissionChat
    MissionChat -->|2. Modified Prompt| LLM
    
    LLM -->|3. Tool Call| RoleGuard
    RoleGuard -->|4. Safe?| Tool
    RoleGuard -.->|Blocked| LLM
    
    Tool -->|5. Output| Scanner
    Scanner --> UI
    UI --> Resource
    Resource -->|6. Result| LLM
    
    LLM -->|7. Turn Done| Sanity
    Sanity --> MissionDone
    
    MissionDone -.->|No Seal: Auto-Continue| LLM
    MissionDone -->|Yes Seal: Complete| ResourceComp
    ResourceComp -->|9. Final Response| User
```

---

## 🚀 Agents

| Agent | Role |
|:------|:-----|
| **Commander** | Orchestrates all agents, manages task flow |
| **Planner** | Creates TODO.md with task breakdown |
| **Worker** | Implements features, writes tests |
| **Reviewer** | Validates code, runs verification |

---

## ✨ Key Features

- **Parallel Execution**: Up to 50 concurrent agent sessions
- **Two-Stage Verification**: Unit review → Master review → Seal
- **Fault Tolerance**: Auto-recovery from failures
- **Context Optimization**: Manages token limits automatically

---

##  Piano Developer's Note

OpenCode Orchestrator was developed to solve the "sequential bottleneck" in AI-assisted coding. By treating agents as distributed processing units rather than just chat interfaces, we aim to provide a more reliable and scalable autonomous engineering experience.

[Full Developer's Note →](docs/DEVELOPERS_NOTE.md)

[System Architecture →](docs/SYSTEM_ARCHITECTURE.md)

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
