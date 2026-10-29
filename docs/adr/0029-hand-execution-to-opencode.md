# ADR-0029: Hand Execution to OpenCode

Date: 2026-10-29 16:42 KST
Status: Implemented

## Context

After ADR-0028 the plugin still ran its own execution layer next to OpenCode:
a delegation engine (task manager, concurrency queue, poller, session
registry, custom agents from `.opencode/agents.json`), four background-command
tools, 13 Rust-backed search, AST and LSP tools behind a JSON-RPC pool,
metrics, and an in-memory memory manager that fed delegated prompts.

Every OpenCode 2 release since 2.0.0 ships native tools that cover the same
ground. This was checked in the 2.0.0 and 2.2.0 binaries:

- `subagent` delegates to a child session in the foreground or background,
  resumes by session id, and notifies the parent on completion;
- `shell` runs commands, including in the background;
- `grep`, `glob`, `read`, `edit`, `patch`, `write`, `webfetch`, `websearch`,
  `question` and `skill`.

Keeping a second implementation duplicated the host, and it was where most
defects were found. ADR-0021 Stages 3 and 5 already named these subsystems as
deletion targets once the host covered them.

An audit of the remaining code also found defects:

- The context window always resolved to the 200,000-token default, because
  OpenCode 2 step events carry no model.
- Safety hooks (role guard, secret redaction) ran only in the active mission
  session.
- The role guard checked `bash`, but OpenCode's tool is `shell`.
- The event stream was never restarted after it ended or failed.
- Any session error latched the mission pause, not only an abort.
- Per-session hook state was never cleared, and mission state carried over
  between missions.

## Decision

- Delete the delegation engine and its tools (`delegate_task`,
  `get_task_result`, `list_tasks`, `cancel_task`, `list_agents`). Commander
  delegates with OpenCode's `subagent` tool. Planner, Worker and Reviewer get
  an appended `subagent` deny permission, so delegation stays one level deep.
- Delete the background-command tools; OpenCode's `shell` runs background
  commands.
- Delete the Rust-backed tools, the JSON-RPC pool and the `orchestrator-core`
  crate. The Rust binary keeps only the `shell-listener` CLI, `--help` and
  `--version`.
- Delete metrics (`show_metrics`), `MemoryManager`, the memory gate and
  generated memory notes. The scratchpad, canvas and ledger remain.
- Keep one plugin tool, `update_todo`.
- Track child sessions from `session.created` events (`ChildSessions`). The
  mission loop holds continuation while a child of the owner is busy. A
  mission replacement interrupts the old owner and its busy children.
- Fixes shipped in the same change:
  - the context window is resolved from the model the session last used;
  - the role guard and secret redaction run in every session, and the guard
    checks `shell`; step counting, footers and evidence stay mission-only;
  - the event bridge resubscribes with a backoff from 1 to 30 seconds;
  - only abort errors pause the mission;
  - hooks drop per-session state on `session.deleted`;
  - mission start, stop and completion clear the session's runtime state;
  - prompts no longer contradict optional delegation;
  - `TodoManager` is a small locked editor without version files;
  - in-progress `[/]` and failed `[-]` verification checklist items count as
    incomplete; before, they were skipped and the checklist could pass;
  - a hook registered for several events clears its session state once.
- Shrink what is left to what is used: `HostClient` keeps `prompt` (always
  synthetic), `interrupt`, `messages`, `statuses` and `modelContextLimit`;
  one session-state type replaces two; the package ships the bundle and a
  hand-written `index.d.ts` without internal declarations or source maps;
  `engines.node` is `>=24`, since no dependency needs 24.15.
- Options left: `customRendering`, `agentTemperatures`, `contextMaxTokens` and
  `missionLoop`. The JSON schema no longer marks defaulted fields required.
  `jsonc-parser` is removed; `zod` is the only runtime dependency.

## Consequences

OpenCode owns execution, concurrency and child sessions. The plugin keeps
mission continuity, its four agent presets, the role guard, secret redaction,
the outgoing message guard and mission memory files. The TypeScript source
shrank from about 12,500 to about 7,600 lines, and the Rust workspace to one
crate with one dependency.

Removed option keys (`agentConcurrency`, `defaultConcurrency`,
`acquisitionTimeoutMs`) are ignored by the tolerant parser. Custom agents in
`.opencode/agents.json` are no longer read; define them as OpenCode agents.
Delegation limits now follow OpenCode's own configuration. Old memory notes
under `.opencode/docs/brain/memories/` stay on disk; nothing deletes them.

This meets the exit targets of ADR-0021 Stage 3 (general toolbelt) and
Stage 5 (execution): one custom tool and no custom execution engine. Native
parity was checked with a live OpenCode 2 run in which Commander delegated to
Worker through `subagent`. The full Stage 1 scenario list (resume,
cancellation failure, restart) was not run; those behaviors are now
OpenCode's responsibility.

Rollback is a revert of this change, which restores the 2.0.20 tools.
