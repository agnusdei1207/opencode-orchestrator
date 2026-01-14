<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator 🎯

> **Autonomous Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

---

## What is this?

A **5-agent autonomous architecture** designed to solve complex engineering tasks with high reliability, even on mid-range LLMs.

**Core Philosophy**: Intelligence is a resource. We orchestrate that resource through **Phase-based Workflows** and **Mandatory Environment Scans** to ensure code always fits the project's infrastructure.

### Key Features
- **🎯 Autonomous Loop** — Commander runs relentlessly until the mission is complete.
- **🔍 Environment Scan** — Mandatory analysis of Infra (Docker/OS), Stack, and Domain before any code change.
- **🔨 Smart Implementation** — Builder matches existing codebase patterns exactly.
- **🛡️ Rigorous Audit** — Inspector proves success with environment-specific evidence (Builds/Tests/Logs).
- **💾 Persistent Context** — Recorder saves session state to disk, enabling resume at any time.
- **🏗️ Parallel Tasking** — Architect splits work into concurrent DAG groups.

---

## Installation

```bash
npm install -g opencode-orchestrator
```

Restart OpenCode after installation.

---

## Usage

### Just Select Commander Agent 🎯
Press `tab` → Select **Commander** → Type your mission!

```
"Fix the login bug in the docker-compose environment"
```

The Commander will:
1. **Survey**: Scan the Docker environment and codebase.
2. **Plan**: Break the fix into steps.
3. **Execute**: Call Builder to fix while matching patterns.
4. **Verify**: Run builds/tests to prove the fix works.
5. **Complete**: Report results with concrete evidence.

### Or Use /task Command
```bash
/task "Implement user authentication with JWT"
```

---

## Agents (5-Agent Architecture)

| Agent | Emoji | Role | Responsibility |
| :--- | :--- | :--- | :--- |
| **Commander** | 🎯 | Orchestrator | Autonomous mission control & delegation |
| **Architect** | 🏗️ | Planner | Task decomposition & strategy correction |
| **Builder** | 🔨 | Developer | Full-stack implementation (Logic + UI) |
| **Inspector** | 🔍 | Quality | 5-point audit & automatic bug fixing |
| **Recorder** | 💾 | Context | Persistent environment & progress tracking |

---

## The Workflow (Progressive Phases)

1. **Phase 0: Triage (Smart)**
   - **Fast Track 🟢**: Simple fixes → Execute instantly (Skip heavy scans).
   - **Deep Track 🔴**: Complex features → Full Environment Scan & Plan.
2. **Phase 1: Environment Scan**
   - Mandatory for Deep Track: Infra/Domain/Stack analysis.
3. **Phase 2: Parallel Planning**
   - Architect creates a DAG of atomic tasks (Scalable Planning).
4. **Phase 3: Execution & Audit**
   - Builder writes code ↔ Inspector verifies with evidence.
5. **Phase 4: Completion**
   - Mission Complete reported with proof of build/test success.

---

## Uninstall

```bash
npm run dev:uninstall
# OR
npm uninstall -g opencode-orchestrator
```

---

## Docs

- [Architecture & Design](docs/ARCHITECTURE.md) — Detailed system design and agent protocols
- [Plugin Troubleshooting](docs/PLUGIN_TROUBLESHOOTING.md) — Setup and common issues

---

## License

MIT License. [LICENSE](LICENSE)

---

**Reliability over slop. Environment over assumptions.**
