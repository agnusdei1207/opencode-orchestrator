<div align="center">
  <h1>OpenCode Orchestrator</h1>
  <p>Mission continuity for OpenCode.</p>

  [![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

  <!-- VERSION:START -->
  **Version:** `2.0.4`
  <!-- VERSION:END -->
</div>

## What it does

OpenCode Orchestrator keeps a task and its unfinished work connected across turns. Commander handles the goal; Planner, Worker, and Reviewer are optional helpers when the work benefits from them. Mission state is stored in the project's `.opencode/` directory.

## Install

Requires Node.js `>=24.15.0` and OpenCode. On OpenCode 2, let OpenCode install and manage the plugin:

```bash
opencode plugin add opencode-orchestrator
opencode plugin list
```

To remove it, run `opencode plugin remove opencode-orchestrator`.

For OpenCode 1 versions 1.18.29 and newer, add `"plugin": ["opencode-orchestrator"]` to your OpenCode `opencode.json(c)`. OpenCode installs configured npm plugins when it starts. The optional `orchestrator` terminal CLI is available separately with `npm install -g opencode-orchestrator`.

## Use

Select **Commander** in OpenCode and send a request, or start a continuing mission:

```text
/task "Implement the feature and verify it"
```

| Command | Purpose |
| --- | --- |
| `/task <objective>` | Start a persisted mission |
| `/plan <objective>` | Prepare a plan without implementing it |
| `/stop` or `/cancel` | Stop the active mission |

Ordinary questions and small edits can be handled directly. Roles are used when they help; they are not a required pipeline.

## Configuration

The default installation needs no extra options. On OpenCode 2, set options in `opencode.jsonc` using the package object:

```jsonc
{
  "plugins": [
    {
      "package": "opencode-orchestrator",
      "options": {
        "agentConcurrency": { "worker": 4 }
      }
    }
  ]
}
```

See the [options schema](opencode-orchestrator.schema.json) for all settings. Replace a plain string entry with the object when adding options; keep only one entry for this package. OpenCode 1 uses a `plugin` array and `["opencode-orchestrator", { ...options }]` for options.

If commands are missing, check `opencode plugin list` on OpenCode 2 or `opencode debug config` on OpenCode 1.

## Contributing

Pull requests from anyone are appreciated. See [CONTRIBUTING.md](https://github.com/agnusdei1207/opencode-orchestrator/blob/main/CONTRIBUTING.md) for development and test commands. If you'd like maintainer access, please [open an issue](https://github.com/agnusdei1207/opencode-orchestrator/issues/new); I'm happy to grant it.

[MIT License](LICENSE) © agnusdei1207
