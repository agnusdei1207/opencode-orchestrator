<div align="center">
  <h1>OpenCode Orchestrator</h1>
  <p>Mission continuity for OpenCode.</p>

  [![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

  <!-- VERSION:START -->
  **Version:** `1.7.25`
  <!-- VERSION:END -->
</div>

## What it does

OpenCode Orchestrator keeps a task and its unfinished work connected across turns. Commander handles the goal; Planner, Worker, and Reviewer are optional helpers when the work benefits from them. Mission state is stored in the project's `.opencode/` directory.

## Install

Requires Node.js `>=24.15.0` and OpenCode. The package includes the plugin and an optional `orchestrator` CLI.

```bash
npm install -g --allow-scripts=opencode-orchestrator opencode-orchestrator
```

The install hook registers the plugin in your OpenCode config. If npm skips install scripts, run `npm install-scripts approve opencode-orchestrator` and `npm rebuild opencode-orchestrator`, then restart OpenCode.

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

The default installation needs no extra options. OpenCode 1 uses `plugin`; OpenCode 2 uses `plugins` for package options. See the [options schema](opencode-orchestrator.schema.json) and [architecture notes](https://github.com/agnusdei1207/opencode-orchestrator/blob/main/docs/SYSTEM_ARCHITECTURE.md) for details. If commands are missing, check registration with `opencode debug config` and confirm npm ran the install hook.

## Contributing

Pull requests are welcome from everyone. See [CONTRIBUTING.md](https://github.com/agnusdei1207/opencode-orchestrator/blob/main/CONTRIBUTING.md) for development and test commands. If you would like to help maintain the project, comment on the [maintainer invitation](https://github.com/agnusdei1207/opencode-orchestrator/issues/47); I am open to granting maintainer access to contributors who want an ongoing role.

[MIT License](LICENSE) © agnusdei1207
