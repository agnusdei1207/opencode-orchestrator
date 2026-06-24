# System Architecture

This document describes the current architecture that is directly verifiable from the repository source. It intentionally avoids speculative performance claims.

## 1. Entry Points

| Surface | File | Responsibility |
| --- | --- | --- |
| Plugin bootstrap | `src/index.ts` | Parses plugin options, initializes subsystems, registers hooks, tools, and cleanup. |
| Rust CLI | `crates/orchestrator-cli/src/main.rs` | Dispatches local commands including `serve`, metadata commands, install/uninstall, and explicit terminal utilities. |
| Shell listener CLI | `crates/orchestrator-cli/src/shell_listener.rs` | Runs the authorized-lab TCP session listener and line-mode TUI outside OpenCode RPC. |
| Config hook | `src/plugin-handlers/config-handler.ts` | Registers commands and the four generated agents, merges user agent overrides, and copies global permissions. |
| Event hook | `src/plugin-handlers/event-handler.ts` | Bridges OpenCode session/message events into mission continuation, recovery, and cleanup paths. |
| Chat hook | `src/plugin-handlers/chat-message-handler.ts` | Tracks user activity and routes slash-command text through the local hook registry. |

## 2. Runtime Shape

OpenCode Orchestrator is an OpenCode plugin with four generated agents:

| Agent | Mode | Role |
| --- | --- | --- |
| Commander | `primary` | Owns the mission loop and top-level coordination. |
| Planner | `subagent` | Breaks work into ordered steps and research tasks. |
| Worker | `subagent` | Implements scoped changes. |
| Reviewer | `subagent` | Verifies completion evidence and integration risk. |

The plugin does not force a model. Model routing follows OpenCode inheritance:

1. Commander uses the global `model` unless `agent.commander.model` is set.
2. Planner, Worker, and Reviewer inherit the invoking primary agent model unless their own `agent.<name>.model` is set.
3. Same-name user agent config is merged back into the generated agent definition.

## 3. Configuration Contract

The plugin accepts scoped options through the OpenCode plugin tuple:

```jsonc
{
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
          "markdownMemory": true,
          "maxEvidenceEvents": 20
        }
      }
    ]
  ]
}
```

Current option readers:

| Option | File | Effect |
| --- | --- | --- |
| `agentConcurrency` | `src/core/agents/concurrency-config.ts` | Per-agent concurrency overrides. |
| `providerConcurrency` | `src/core/agents/concurrency-config.ts` | Provider-level concurrency overrides. |
| `modelConcurrency` | `src/core/agents/concurrency-config.ts` | Model-level concurrency overrides. |
| `defaultConcurrency` | `src/core/agents/concurrency-config.ts` | Default fallback concurrency. |
| `missionLoop.*` | `src/core/config/plugin-options.ts` | Runtime mission memory and evidence controls. |

## 4. Permission Model

`src/plugin-handlers/config-handler.ts` copies the global OpenCode `permission` block into each generated agent and then merges same-name agent overrides on top. That keeps permission-gated tools such as `question` available when the user explicitly allows them, while still letting `agent.commander.permission` or similar narrow policy for a single agent.

Project instruction files are not copied into generated agent prompts by the plugin. OpenCode owns the rules layer through `AGENTS.md`, `opencode.json` `instructions`, and its documented Claude Code fallback behavior, so the config hook stays limited to command and agent registration.

## 5. Mission Loop Control Plane

Mission loop state is file-backed under `.opencode/`:

| Artifact | Producer | Purpose |
| --- | --- | --- |
| `.opencode/mission-loop.json` | `src/core/loop/mission-loop.ts` | Active mission state and iteration counters. |
| `.opencode/mission-ledger.jsonl` | `src/core/loop/mission-ledger.ts` | Bounded event trail when ledger output is enabled. |
| `.opencode/docs/brain/scratchpad.md` | `src/core/knowledge/mission-memory.ts` | Generated markdown memory surface. |
| `.opencode/docs/brain/knowledge-map.canvas` | `src/core/knowledge/mission-memory.ts` | Obsidian-compatible mission graph. |
| `.opencode/docs/brain/memories/*.md` | `src/core/knowledge/mission-memory.ts` | Generated mission-relevant memory notes for prompt-time retrieval. |

`startMissionLoop()` persists the mission state. `handleMissionIdle()` re-verifies completion before scheduling a continuation. `generateMissionContinuationPrompt()` injects a compact prompt containing objective, progress, verification summary, stagnation signal, and completion rule.

## 6. Continuation Guards

The plugin avoids immediate self-resume after interruption or unstable state. Current guard paths:

1. `src/plugin-handlers/event-handler.ts` requires an assistant completion for the current user turn before idle continuation is allowed.
2. `src/core/loop/todo-continuation.ts` cancels pending countdowns on user interaction, recent aborts, or recovery state.
3. `src/core/loop/mission-loop-handler.ts` skips prompt injection while the session is aborting, recovering, compacting, or holding running background tasks.
4. Mission continuation is blocked when the local circuit breaker is open.

This is the main protection against `/task` immediately restarting after `Esc` or other interrupt paths.

## 7. Authorized Shell Listener Control Plane

`orchestrator shell-listener` is a Rust CLI-only control plane for owned lab machines or explicitly authorized test environments. It is deliberately not registered in `src/tools/registry.ts`, so OpenCode model tool calls cannot start or drive an interactive shell session through the plugin JSON-RPC path.

Runtime flow:

1. `main.rs` dispatches the explicit `shell-listener` command.
2. `shell_listener.rs` binds a TCP listener with `127.0.0.1:4444` as the default address.
3. Non-loopback binds are rejected unless the operator passes `--allow-remote`.
4. Each accepted TCP stream receives a stable session id, peer metadata, a writer handle, an in-memory preview buffer, and a raw log path.
5. Reader threads append raw bytes to `.opencode-orchestrator/shell-listener/` and send sanitized preview events to the line-mode TUI.
6. Operator commands select sessions, send prompt responses, run sentinel-marked one-shot commands, request a manual PTY helper, or close sessions.

The design separates three concerns:

| Concern | Owner | Boundary |
| --- | --- | --- |
| Connection acceptance | Listener thread | TCP socket accept and session registration. |
| Session I/O | Per-session reader plus writer handle | Raw bytes are logged; preview bytes are sanitized for display. |
| Human operation | Line-mode TUI | The operator decides what to send and when to send it. |

Completion detection remains heuristic because shells do not emit a universal "command finished" event. The `run <cmd>` path appends a unique sentinel marker. Long-running or interactive programs should stay in `send <text>` mode so the operator can answer prompts directly.

## 8. Builder-Inspired Memory Surface

The generated markdown scratchpad and `.canvas` graph are the main Builder-derived ideas retained here:

1. Keep runtime memory local-first under the workspace.
2. Generate a readable markdown scratchpad instead of introducing a separate database.
3. Treat the graph as a visualization and navigation artifact, not as a second source of truth.

The current implementation writes these artifacts through `src/core/knowledge/mission-memory.ts`, injects the scratchpad directly through `src/plugin-handlers/system-transform-handler.ts`, and indexes the generated markdown notes through the existing prompt-context path.

## 9. Release and Platform Baseline

Current verified release baseline:

1. Node.js `24+`
2. `@opencode-ai/plugin` `1.17.9`
3. `@opencode-ai/sdk` `1.17.9`
4. GitHub Actions build matrix for Linux x64/arm64, macOS x64/arm64, and Windows x64 in `.github/workflows/release.yml`

Public support links should point to GitHub issues. Package metadata already uses:

- `homepage`: `https://github.com/agnusdei1207/opencode-orchestrator/issues`
- `bugs.url`: `https://github.com/agnusdei1207/opencode-orchestrator/issues`

## 10. Verification Pointers

When verifying architecture-sensitive changes, open these files first:

1. `src/index.ts`
2. `src/plugin-handlers/config-handler.ts`
3. `src/plugin-handlers/event-handler.ts`
4. `src/plugin-handlers/chat-message-handler.ts`
5. `src/core/config/plugin-options.ts`
6. `src/core/agents/concurrency-config.ts`
7. `src/core/loop/mission-loop.ts`
8. `src/core/loop/mission-loop-handler.ts`
9. `src/core/loop/todo-continuation.ts`
10. `crates/orchestrator-cli/src/shell_listener.rs`
