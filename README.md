<div align="center">
  <img src="assets/logo.png" alt="OpenCode Orchestrator logo" width="160" />
  <h1>OpenCode Orchestrator</h1>
  <p>Multi-agent mission control for OpenCode.</p>

  [![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)
  <!-- VERSION:START -->
  **Version:** `1.6.1`
  <!-- VERSION:END -->
</div>

---

## 1. Install

```bash
npm install -g opencode-orchestrator
```

The install hook merges OpenCode config instead of replacing it, prefers `opencode.jsonc` when present, preserves existing plugin tuple options, and skips automatic config mutation in CI.

To remove the plugin from OpenCode config:

```bash
npm explore -g opencode-orchestrator -- npm run cleanup:plugin
npm uninstall -g opencode-orchestrator
```

Manual fallback: remove `"opencode-orchestrator"` or `["opencode-orchestrator", {...}]` from the `plugin` array in `opencode.json` or `opencode.jsonc`.

## 2. Configure

Tested compatibility:

1. Node.js `24+`
2. `@opencode-ai/plugin` `1.17.4`
3. `@opencode-ai/sdk` `1.17.4`

OpenCode plugin options belong inside the `plugin` array as `["plugin-name", {...}]` tuples. Configure `agentConcurrency` and `missionLoop` there:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "opencode/gpt-5.1-codex",
  "permission": {
    "question": "allow"
  },
  "agent": {
    "commander": {
      "model": "opencode/gpt-5.1-codex"
    },
    "worker": {
      "model": "anthropic/claude-opus-4-5-20251101"
    }
  },
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

Model selection follows normal OpenCode inheritance. The plugin does not force a model:

1. Commander uses the global `model` unless `agent.commander.model` is set.
2. Planner, Worker, and Reviewer inherit the invoking primary agent model unless `agent.<name>.model` is set.
3. Generated Commander, Planner, Worker, and Reviewer agents inherit global permissions.
4. Same-name user agent config can still override model, temperature, and specific permission keys.

Legacy top-level concurrency keys (`agentConcurrency`, `providerConcurrency`, `modelConcurrency`, `defaultConcurrency`) are still accepted for backward compatibility, but the plugin tuple is the preferred location.

Plugin options are schema-described in `opencode-orchestrator.schema.json` (generated from the Zod source, shipped in the package) for editor autocomplete and validation. Invalid or missing option fields fall back to defaults rather than failing.

## 3. Run

Inside OpenCode:

```bash
/task "Implement the requested change and verify it"
```

Mission controls:

1. `/task ...` starts a persisted mission loop under `.opencode/`.
2. `Esc`/OpenCode interrupt is respected by idle guards so the plugin does not immediately re-continue an interrupted turn.
3. `/cancel` and `/stop` deactivate the current mission loop.
4. The default mission iteration ceiling is `1,000,000,000`.

Role-aware agent sessions are created or reused on demand: Commander delegates Planner, Worker, and Reviewer tasks into a per-role session pool, then releases or cleans those sessions automatically after completion.

### Authorized Shell Listener TUI

For owned lab machines or explicitly authorized test environments, the bundled Rust CLI can run a multi-session TCP shell listener:

```bash
orchestrator shell-listener --bind 127.0.0.1 --port 4444
```

The listener is intentionally outside the OpenCode JSON-RPC tool surface. It is an operator-driven terminal workflow, not an LLM-callable tool.

Safety defaults:

1. Loopback-only bind by default.
2. Non-loopback bind addresses require `--allow-remote`.
3. Raw stream logs are stored under `.opencode-orchestrator/shell-listener/`.
4. The CLI does not generate payloads, exploit targets, or bypass authentication.

TUI commands:

| Command | Purpose |
| --- | --- |
| `sessions` | Show connected sessions, peer addresses, status, and raw log paths. |
| `use <id>` | Select the active session. |
| `send <text>` | Send one input line to the active session. Use this for login, registry, CDK, or reverse-proxy prompts that need human input. |
| `run <cmd>` | Send a command followed by a unique sentinel marker so completion can be recognized in output. |
| `pty` | Send a manual PTY helper to the active session when the remote environment supports Python. |
| `close [id]` | Close a session. |
| `quit` | Stop the listener UI. |

## 4. How It Works

```text
                    /task input
                         |
                         v
                  +-------------+
           +----->|  Commander  |
           |      +------+------+
           |             | delegates
           |       +-----+------+
           |       v            v
           |  +---------+  +-------------+
           |  | Planner |  | Worker pool |
           |  +----+----+  +--+-------+--+
           |       | writes   | impl  |
           |       v          v       v
           |  +------------------+  +----------+
           |  |  Mission state   |  | Reviewer |
           |  |   (.opencode/)   |  +----+-----+
           |  +------------------+       |
           |                             v
           |  no (keep working)    +-----------+
           +-----------------------+ Verified? |
                                   +-----+-----+
                                         | yes
                                         v
                                       Done
```

| Agent | Purpose |
| --- | --- |
| Commander | Interprets the mission, coordinates agents, and keeps the loop aligned. |
| Planner | Breaks work into ordered steps and tracks dependencies. |
| Worker | Implements scoped file changes with isolated context. |
| Reviewer | Checks completion evidence, tests, and integration risk. |

The mission loop adjudicates continuation at the idle boundary rather than trusting a model's "done":

1. Tool calls are observed to record changed files and verification runs; if files changed with no verification, the continuation prompt emphatically asks the model to run tests/build/lint and cite results (a nudge, never a hard block).
2. Before declaring done the model is asked for a short self-account (scope fit, verification, residual risk).
3. After sustained stagnation the loop stops blind retries and escalates: DECOMPOSE → RE-PLAN → ASK the user.

Memory retrieval is role-aware (planners favor structure, workers favor exact matches, reviewers favor breadth) and memory notes carry a relevance `horizon`.

Runtime evidence is written only when enabled:

| Artifact | Purpose |
| --- | --- |
| `.opencode/mission-ledger.jsonl` | Bounded event trail for mission decisions. |
| `.opencode/docs/brain/scratchpad.md` | Generated Markdown memory surface for active missions. |
| `.opencode/docs/brain/knowledge-map.canvas` | Obsidian-compatible visual map of objective, evidence, and verification nodes. |
| `.opencode/docs/brain/memories/*.md` | Generated mission-relevant memory notes indexed by the knowledge retriever. |

## 5. Developer Notes

Local checks that mirror CI (`.github/workflows/ci.yml`), which gates every push and PR:

```bash
# TypeScript
npm run build
npx tsc --noEmit
npm test

# Rust (same gates CI enforces)
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Regenerate the plugin-options JSON Schema after changing option types: `npm run gen:schema`.

Useful references:

1. OpenCode plugins: https://opencode.ai/docs/plugins/
2. OpenCode config: https://opencode.ai/docs/config/
3. OpenCode keybinds: https://opencode.ai/docs/keybinds/
4. Project issues: https://github.com/agnusdei1207/opencode-orchestrator/issues

Contributions are welcome: open an issue or pull request when you find a bug, compatibility gap, or focused improvement.

Config logs:

| Platform | Path |
| --- | --- |
| Unix | `/tmp/opencode-orchestrator.log` |
| Windows | `%TEMP%\opencode-orchestrator.log` |

## 6. License

MIT License. See [LICENSE](LICENSE).
