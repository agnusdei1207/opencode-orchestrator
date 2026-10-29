# ADR-0028: OpenCode 2 Only and a Minimal Core

Date: 2026-10-29 15:39 KST
Status: Implemented

## Context

Since ADR-0024 one default export served two hosts: the OpenCode 1 `server`
function and the OpenCode 2 `setup` function. The core spoke a v1-shaped
client, and `src/v2` translated OpenCode 2 calls into it. That kept v1-only
handlers, the `@opencode-ai/plugin` and `@opencode-ai/sdk` 1.18.x
dependencies, and code that OpenCode 2 never calls. Other subsystems had no
reader at all, or produced behavior that was wrong on OpenCode 2. ADR-0021
already set deletion-first as the direction.

## Decision

- Drop OpenCode 1. Remove the `server` entry, the `./server` package export,
  the v1-only handlers (config, chat params, command execute, messages
  transform and guard, text completion) and the `@opencode-ai/plugin` and
  `@opencode-ai/sdk` dependencies. `src/index.ts` exports only
  `{ id, setup }`.
- Rename `src/v2` to `src/host`. The core talks to OpenCode 2 through a small
  `HostClient` (`src/host/client.ts`): `createSession`, `prompt`,
  `interrupt`, `removeSession`, `messages`, `statuses` and
  `modelContextLimit`, instead of a v1-shaped adapter. Host API failures
  throw. Tools use a local `tool()` contract (`src/host/tool.ts`).
- OpenCode 1 users stay on 2.0.19. This ships as a patch at the owner's
  request. OpenCode installs plugins from `@latest`, so a major version number
  would not protect OpenCode 1 users either way.
- Remove code that OpenCode 2 cannot use or that nothing reads:
  - toasts: the server plugin context has no toast API; toasts exist only in
    the separate TUI plugin context (`@opencode/plugin/tui`);
  - object and string pools;
  - the task archive and `CleanupScheduler`;
  - the compaction guard: the countdown check already drops continuations
    scheduled before compaction;
  - global orchestrator state;
  - mission episode notes and memory decay metadata (ADR-0019);
  - concurrency auto-scaling, the circuit breaker, priority, resource
    pressure, and provider and model limits;
  - the `slashcommand` tool (the slash commands remain host commands);
  - the unimplemented `race`/`fractal` delegate modes;
  - MemoryGate tool-output capture. It fed stale tool output from every
    session into delegated prompts.
- Fixes shipped in the same change:
  - in-progress `[/]` and failed `[-]` TODO items no longer count as
    complete;
  - the mission ledger is trimmed to the newest 100 events;
  - built-in agents no longer get their system prompt twice on delegation;
  - auto-scaling no longer raises user concurrency limits;
  - cancellations no longer trip a circuit;
  - the poller no longer fetches full transcripts or fails healthy tasks on
    fetch errors;
  - launch errors reach the model with their cause;
  - unknown agent names are rejected instead of running as Commander;
  - every assistant-done hook runs even when one injects; the first
    injection wins;
  - the role guard checks OpenCode's `bash` tool; it checked a nonexistent
    `run_command`;
  - rate-limit "recovery" no longer claims success after a sleep;
  - the context-limit fallback uses the OpenCode 2 model list; the v1
    provider call never worked on OpenCode 2;
  - finished background jobs are pruned after 30 minutes, and their timers no
    longer keep the process alive;
  - the stagnation count is a single counter.
- Deferred, not decided here: removing the 13 Rust-backed tools (ADR-0021
  Stage 3) and the shell listener.

## Consequences

The plugin loads only on OpenCode 2. Options keys that this version no
longer reads (`providerConcurrency`, `modelConcurrency`, `circuit*`,
`halfOpenSuccessThreshold`, `resourcePressureMaxHeapPercent`) are ignored by
the tolerant parser in `src/core/config/options.ts`. The plugin registers 24
tools. Existing archive files, episode notes and decay fields in old notes
stay on disk; nothing deletes them.

ADR-0022 is superseded. ADR-0024's hybrid entry is superseded; its OpenCode 2
boundary remains in `src/host`. ADR-0027's per-instance toast manager is gone
with the toasts.

Rollback is a revert of this change, which restores the 2.0.19 hybrid
package.
