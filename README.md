<div align="center">
  <img src="assets/logo.png" alt="OpenCode Orchestrator logo" width="160" />
  <h1>OpenCode Orchestrator</h1>
  <p>Multi-agent mission control for OpenCode (Commander, Planner, Worker, Reviewer).</p>

  [![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
  [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=github-sponsors)](https://github.com/sponsors/agnusdei1207)
  [![3D Architecture Explorer](https://img.shields.io/badge/3D%20Architecture-Explorer-3b82f6.svg)](https://agnusdei1207.github.io/opencode-orchestrator/)
  <!-- VERSION:START -->
  **Version:** `1.7.16`
  <!-- VERSION:END -->
  <!-- LAST-UPDATED: 2026-09-03 22:52 KST -->
</div>

---

## Overview

OpenCode Orchestrator coordinates multi-agent workflows with autonomous verification and local-first memory.

> 🌐 **Interactive 3D Explorer**: Experience the complete 3D runtime architecture, agent council, hybrid RAG, and Ebbinghaus memory in your browser: [https://agnusdei1207.github.io/opencode-orchestrator/](https://agnusdei1207.github.io/opencode-orchestrator/)

- **Autonomous Mission Loop**: Commander, Planner, Worker, and Reviewer collaborate with verification gates before concluding tasks.
- **Role-Aware Context**: Pluggable agent profiles with modular system prompts and tailored retrieval weights.
- **Local-First Memory**: On-disk Ebbinghaus decay model combining BM25, tags, and graph connections without external vector databases.
- **Fast Rust Tooling**: High-performance AST, LSP, search, and parallel execution primitives.

---

## 1. Installation

```bash
npm install -g opencode-orchestrator
```

> **Note**: The install hook automatically registers the plugin in `opencode.json` / `opencode.jsonc`.

### Troubleshooting: plugin installed but `/task` is missing

OpenCode reads its global config from one location only (run `opencode debug paths`
to see it under `config`): `$XDG_CONFIG_HOME/opencode`, otherwise
`~/.config/opencode` — on **every** OS, including Windows. Versions ≤ 1.7.15 of
this package mistakenly registered in `%APPDATA%\opencode` on Windows, which
OpenCode never reads. Reinstalling with the current version migrates that stale
entry automatically (with a `.backup.*` copy next to the original).

To diagnose:

```bash
opencode debug config | grep -A5 '"plugin"'
opencode debug paths
```

- If `plugin` is empty, the registration landed in the wrong file: reinstall
  this package and restart OpenCode.
- If `plugin` lists this package but commands are still missing, OpenCode may be
  loading a stale cached copy: reinstalling clears
  `<cache>/opencode/packages/opencode-orchestrator@*` automatically.
- `OPENCODE_CONFIG_DIR`, when set, takes precedence over every default location.

To remove the plugin:

```bash
npm explore -g opencode-orchestrator -- npm run cleanup:plugin
npm uninstall -g opencode-orchestrator
```

---

## 2. Configuration

Add or customize in `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "opencode-orchestrator",
      {
        "agentConcurrency": {
          "commander": 1,
          "planner": 10,
          "worker": 10,
          "reviewer": 10
        },
        "missionLoop": {
          "ledger": true,
          "markdownMemory": true
        }
      }
    ]
  ]
}
```

- **Model Inheritance**: Subagents inherit the primary agent model unless explicitly configured under `agent.<name>.model`.
- **Context Window Limits**: Context usage alerts are measured against the window OpenCode reports for the model in use (a 1M-token model is no longer measured against a 200k default). Set `contextMaxTokens` (an integer token count) in the plugin options to force one limit for every model.
- **Options Schema**: Full configuration schema is available in `opencode-orchestrator.schema.json`.

---

## 3. Usage

Start a mission inside OpenCode:

```bash
/task "Implement feature and verify test suite"
```

| Command | Action |
| --- | --- |
| `/task <objective>` | Starts a persisted mission loop under `.opencode/` |
| `/stop` or `/cancel` | Halts the active mission loop |
| `Esc` (Interrupt) | Pauses loop continuation until next turn |

---

## 4. Multi-Agent Architecture

```text
                    /task input
                         |
                         v
                   +-------------+
            +----->|  Commander  | (Coordinates & delegates)
            |      +------+------+
            |             |
            |       +-----+------+
            |       v            v
            |  +---------+  +-------------+
            |  | Planner |  | Worker Pool | (TDD & isolated edits)
            |  +----+----+  +------+------+
            |       |              |
            |       v              v
            |  +---------------------+
            |  |  Mission Workspace  |
            |  |     (.opencode/)    |
            |  +----------+----------+
            |             |
            |             v
            |       +------------+
            |       |  Reviewer  | (Verifies evidence & tests)
            |       +-----+------+
            |             |
            |             v
            |      +-------------+
            +------|  Verified?  |
             (no)  +------+------+
                          | (yes)
                          v
                        Done
```

| Agent | Role | Responsibility |
| --- | --- | --- |
| **Commander** | Orchestrator | Interprets missions, manages agent pool, and handles loop state. |
| **Planner** | Strategy | Breaks objectives into ordered file-level tasks and tracks TODOs. |
| **Worker** | Implementation | Executes file changes with isolated context and TDD practices. |
| **Reviewer** | Gatekeeper | Verifies test evidence, builds, and marks completion. |

---

## 5. Shell Listener (Optional)

For authorized testing environments, a multi-session TCP shell listener TUI is available via the bundled Rust CLI:

```bash
orchestrator shell-listener --bind 127.0.0.1 --port 4444
```

---

## 6. Development

```bash
# TypeScript
npm run build
npx tsc --noEmit
npm test

# Rust
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
```

---

## 7. License

[MIT License](LICENSE) © agnusdei1207
