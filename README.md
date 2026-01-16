<div align="center">
  <img src="assets/logo.png" alt="Logo" width="200" />
</div>

# OpenCode Orchestrator 🎯

> **Autonomous Multi-Agent Plugin for [OpenCode](https://opencode.ai)**

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
[![Tests](https://img.shields.io/badge/tests-211%20passed-brightgreen.svg)]()

---

## 🚀 What's New in v0.6.0

**Ultimate Agent Architecture** - The most powerful orchestration system yet!

| Feature | Description |
|---------|-------------|
| **♾️ Unlimited Mode** | No step limits - runs until mission complete |
| **🧠 Anti-Hallucination** | Research before coding, verify with docs |
| **📚 New Agents** | Librarian & Researcher for accurate information |
| **🔄 Auto Recovery** | Handles rate limits, errors automatically |
| **📊 211 Tests** | Comprehensive test coverage |

---

## Why?

Tested GLM-4, got disappointed. Built this to make mid-tier models work like premium ones through structured orchestration.

### Key Features

- **♾️ Unlimited Execution** — Runs until ALL todos are complete (default!)
- **🧠 Anti-Hallucination** — Researches documentation before implementation
- **📚 Document Caching** — Stores verified docs in `.cache/docs/`
- **🎯 Autonomous Loop** — Commander runs until the mission is complete
- **🔍 Environment Scan** — Analyzes Infra, Stack, and Domain before coding
- **🔨 Smart Implementation** — Matches existing codebase patterns
- **🛡️ Rigorous Audit** — Proves success with builds/tests/logs
- **💾 Persistent Context** — Saves session state to disk
- **🏗️ Parallel Agents** — Run multiple agents concurrently
- **⏳ Background Tasks** — Non-blocking command execution
- **🔄 Auto Recovery** — Handles errors, rate limits automatically
- **📡 Event Bus** — Real-time inter-component communication

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

> **💡 Tip:** Both regular messages and `/task` now run in **unlimited mode** by default!

---

## The 7 Agents

| Agent            | Role         | Responsibility                     |
| :--------------- | :----------- | :--------------------------------- |
| **Commander** 🎯 | Orchestrator | Autonomous mission control         |
| **Architect** 🏗️ | Planner      | Hierarchical task decomposition    |
| **Builder** 🔨   | Developer    | Full-stack implementation          |
| **Inspector** 🔍 | Quality      | Audit, auto-fix & doc verification |
| **Recorder** 💾  | Context      | Progress tracking                  |
| **Librarian** 📚 | Research     | Documentation & API research       |
| **Researcher** 🔬 | Investigation | Pre-task research & analysis      |

---

## 🛠️ New Tools in v0.6.0

| Tool | Description |
|------|-------------|
| `webfetch` | Fetch URL content as Markdown |
| `websearch` | Search the web for information |
| `codesearch` | Search open source code patterns |
| `cache_docs` | Manage cached documentation |

---

## 🏗️ Architecture Highlights

### Event-Driven System
```
Event Bus → Toast Notifications
         → Progress Tracking
         → Auto Recovery
```

### Hierarchical Task Decomposition
```
[L1] Main Objective
  [L2] Sub-task (parallel: A)
  [L2] Sub-task (parallel: A)
    [L3] Atomic action
    [L3] Verify (depends: above)
```

### Auto Recovery
- **Rate Limit** → Exponential backoff
- **Context Overflow** → Auto compact
- **Network Error** → Retry with fallback
- **Parse Error** → Retry then skip

---

## 🧪 Test Coverage

```
Test Files:  18 passed
Tests:       211 passed
Duration:    ~4.3s
```

---

## Uninstall

```bash
npm uninstall -g opencode-orchestrator
```

---

## Documentation

- [Architecture & Design](docs/ARCHITECTURE.md)
- [Release Notes v0.6.0 (EN)](docs/RELEASE_NOTES_v0.6.0.md)
- [릴리즈 노트 v0.6.0 (KO)](docs/RELEASE_NOTES_v0.6.0_KO.md)
- [Troubleshooting](docs/PLUGIN_TROUBLESHOOTING.md)

---

## License

MIT License. [LICENSE](LICENSE)

---

**Reliability over slop. Research before code. Unlimited until done.**
