<div align="center">
  <h1>OpenCode Orchestrator</h1>
  <p>Mission continuity for OpenCode.</p>

  [![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

  <!-- VERSION:START -->
  **Version:** `2.0.21`
  <!-- VERSION:END -->
</div>

## What it does

OpenCode Orchestrator keeps a task and its unfinished work connected across turns. Commander handles the goal; Planner, Worker, and Reviewer are optional helpers that Commander starts with OpenCode's own `subagent` tool. Mission state is stored in the project's `.opencode/` directory.

OpenCode runs the tools, shell commands and child sessions. The plugin adds mission continuation, the four agent presets, an `update_todo` tool, a guard against destructive shell commands, secret redaction in tool output, and a size guard for outgoing messages.

## Install

Requires Node.js `>=24` and OpenCode 2. Let OpenCode install and manage the plugin:

```bash
opencode plugin add opencode-orchestrator
opencode plugin list
```

To remove it, run `opencode plugin remove opencode-orchestrator`.

OpenCode 1 is no longer supported; use version 2.0.19 or earlier with it. The optional `orchestrator` terminal CLI is available separately with `npm install -g opencode-orchestrator`.

## Use

Select **Commander** in OpenCode and send a request, or start a continuing mission:

```text
/task "Implement the feature and verify it"
```

| Command | Purpose |
| --- | --- |
| `/task <objective>` | Start a persisted mission, replacing an active mission in the same project |
| `/plan <objective>` | Prepare a plan without implementing it |
| `/stop` or `/cancel` | Stop the active mission |

Ordinary questions and small edits can be handled directly. Roles are used when they help; they are not a required pipeline.
Replacing a mission stops its previous session and its running subagents before the new goal starts. Existing project TODO and checklist files remain available for the new mission to reconcile.

Mission updates (steps, progress, verification, and scratchpad) are sent as a request-only user message after the conversation. Orchestrator preserves the host's system instructions and existing conversation prefix so changing mission state does not invalidate them for provider prompt caching. Cache usage still depends on the provider, model, host, and other plugins; no fixed hit rate is guaranteed.

## Configuration

The default installation needs no extra options. Set options in `opencode.jsonc` using the package object:

```jsonc
{
  "plugins": [
    {
      "package": "opencode-orchestrator",
      "options": {
        "agentTemperatures": { "Worker": 0.2 }
      }
    }
  ]
}
```

Agent names in options are exact: `Commander`, `Planner`, `Worker`, or `Reviewer`. Delegation limits and permissions follow OpenCode's own agent configuration. See the [options schema](opencode-orchestrator.schema.json) for all settings. Replace a plain string entry with the object when adding options; keep only one entry for this package.

If commands are missing, check `opencode plugin list`.

### OpenChamber and other WebUIs

Set `customRendering` to `false` to remove the timestamp/step/duration footer that Orchestrator adds to tool results. The default is `true`.

```jsonc
{
  "plugins": [
    {
      "package": "opencode-orchestrator",
      "options": { "customRendering": false }
    }
  ]
}
```

Keep a single entry for the package, merge this option with any existing options, and restart the OpenCode backend after saving. It applies to newly processed results; previously stored footers remain in the conversation history. Mission tracking, mission memory files, secret redaction, and the outgoing message-size guard remain active. The option controls Orchestrator's presentation changes; OpenCode and the WebUI own their rendering.

## Contributing

Pull requests from anyone are appreciated. See [CONTRIBUTING.md](https://github.com/agnusdei1207/opencode-orchestrator/blob/main/CONTRIBUTING.md) for development and test commands. If you'd like maintainer access, please [open an issue](https://github.com/agnusdei1207/opencode-orchestrator/issues/new); I'm happy to grant it.

[MIT License](LICENSE) © agnusdei1207
