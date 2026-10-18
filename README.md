<div align="center">
  <h1>OpenCode Orchestrator</h1>
  <p>Mission continuity for OpenCode.</p>

  [![MIT License](https://img.shields.io/badge/license-MIT-red.svg)](LICENSE)
  [![npm](https://img.shields.io/npm/v/opencode-orchestrator.svg)](https://www.npmjs.com/package/opencode-orchestrator)

  <!-- VERSION:START -->
  **Version:** `2.0.15`
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
| `/task <objective>` | Start a persisted mission, replacing an active mission in the same project |
| `/plan <objective>` | Prepare a plan without implementing it |
| `/stop` or `/cancel` | Stop the active mission |

Ordinary questions and small edits can be handled directly. Roles are used when they help; they are not a required pipeline.
Replacing a mission stops its previous session and delegated work before the new goal starts. Existing project TODO and checklist files remain available for the new mission to reconcile.

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

### Strict review (opt-in)

Set `strictReview` to `true` when Commander must not be the one deciding that its own code changes are done. After any session in which Commander or its Workers changed files, the session cannot finish until a Reviewer task started after the last change ends with `VERDICT: APPROVED`. A `VERDICT: REJECTED` sends the findings back to Commander, and any later edit requires a new review. It works with or without `/task`.

```jsonc
{
  "plugins": [
    {
      "package": "opencode-orchestrator",
      "options": { "strictReview": true, "maxReviewRejections": 3 }
    }
  ]
}
```

In this mode the Reviewer is read-only, Commander delegates through `delegate_task` instead of host-native subagent tools, and after `maxReviewRejections` consecutive rejections (default `3`) Orchestrator stops the automatic loop and asks Commander to report the unapproved state to you. Ticking verified items in the `.opencode` TODO or checklist does not count as a code change. Files changed only through shell commands are not detected. The default is `false`, which leaves behavior unchanged.

### OpenChamber and other WebUIs

Since 2.0.15, set `customRendering` to `false` to disable Orchestrator's display changes. This removes the timestamp/step/duration footer from tool results and preserves completed assistant text without the OpenCode 1 standalone thinking-tag cleanup. The default is `true` for existing installations.

For OpenCode 1 (including WebUIs backed by OpenCode 1), replace the existing entry in `opencode.jsonc`:

```jsonc
{
  "plugin": [
    ["opencode-orchestrator", { "customRendering": false }]
  ]
}
```

For OpenCode 2:

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

Keep a single entry for the package, merge this option with any existing options, and restart the OpenCode backend after saving. It applies to newly processed results; previously stored footers remain in the conversation history. Mission tracking, memory, secret redaction, and the outgoing message-size guard remain active. The option controls Orchestrator's presentation changes; OpenCode and the WebUI own their rendering.

## Contributing

Pull requests from anyone are appreciated. See [CONTRIBUTING.md](https://github.com/agnusdei1207/opencode-orchestrator/blob/main/CONTRIBUTING.md) for development and test commands. If you'd like maintainer access, please [open an issue](https://github.com/agnusdei1207/opencode-orchestrator/issues/new); I'm happy to grant it.

[MIT License](LICENSE) © agnusdei1207
