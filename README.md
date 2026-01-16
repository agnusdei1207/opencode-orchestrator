<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator 🎯

> **Autonomous Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

---

## Why I Built This

I tested **GLM-4** and was deeply disappointed. The model showed severe reasoning collapse, mixed-language hallucinations, and couldn't complete even simple multi-step tasks reliably.

But I didn't give up. Instead, I asked: **"What if the right orchestration could make even budget models perform like premium ones?"**

This plugin is that experiment. A **5-agent autonomous architecture** that breaks down complex tasks, enforces strict quality gates, and never stops until the mission is truly complete.

> *"Intelligence is a resource. Orchestrate it."*

### The Result

With this orchestration layer, even mid-tier models can:
- Complete multi-file refactoring tasks autonomously
- Self-correct errors through Inspector audits
- Maintain context across long sessions via Recorder
- Run parallel agents for speed without conflicts

### Key Features
- **🎯 Autonomous Loop** — Commander runs until the mission is complete
- **🔍 Environment Scan** — Analyzes Infra, Stack, and Domain before coding
- **🔨 Smart Implementation** — Matches existing codebase patterns
- **🛡️ Rigorous Audit** — Proves success with builds/tests/logs
- **💾 Persistent Context** — Saves session state to disk
- **🏗️ Parallel Agents** — Run multiple agents concurrently
- **⏳ Background Tasks** — Non-blocking command execution

---

## Installation

```bash
npm install -g opencode-orchestrator
```

Restart OpenCode after installation.

---

## Usage

### 🚀 Select Commander via Tab Key (Recommended)

Press `Tab` in OpenCode → Select **Commander** → Type your mission!

```
"Fix the login bug in the docker-compose environment"
```

### 📋 Use /task Command

```bash
/task "Implement user authentication with JWT"
```

> **💡 Tip:** `/task` makes Commander run **2x longer** for complex tasks.

---

## The 5 Agents

| Agent | Role | Responsibility |
| :--- | :--- | :--- |
| **Commander** 🎯 | Orchestrator | Autonomous mission control |
| **Architect** 🏗️ | Planner | Task decomposition |
| **Builder** 🔨 | Developer | Full-stack implementation |
| **Inspector** 🔍 | Quality | Audit & auto-fix |
| **Recorder** 💾 | Context | Progress tracking |

---

## Uninstall

```bash
npm uninstall -g opencode-orchestrator
```

---

## Documentation

- [Architecture & Design](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/PLUGIN_TROUBLESHOOTING.md)

---

## License

MIT License. [LICENSE](LICENSE)

---

**Reliability over slop. Environment over assumptions.**
