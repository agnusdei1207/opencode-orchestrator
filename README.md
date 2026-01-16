<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator 🎯

> **Autonomous Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

---

## Why?

Tested GLM-4, got disappointed. Built this to make mid-tier models work like premium ones through structured orchestration.

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

<div align="center">
  <img src="assets/tui_image.png" alt="Commander TUI" width="600" />
  <p><sub><b>Commander</b> agent selection interface in OpenCode (TUI)</sub></p>

  <br/> <img src="assets/window_image.png" alt="Commander Windows" width="600" />
  <p><sub>Execution of <b>Commander</b> agent on Windows environment</sub></p>
</div>

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

| Agent            | Role         | Responsibility             |
| :--------------- | :----------- | :------------------------- |
| **Commander** 🎯 | Orchestrator | Autonomous mission control |
| **Architect** 🏗️ | Planner      | Task decomposition         |
| **Builder** 🔨   | Developer    | Full-stack implementation  |
| **Inspector** 🔍 | Quality      | Audit & auto-fix           |
| **Recorder** 💾  | Context      | Progress tracking          |

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
