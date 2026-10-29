# Agent Memory - OCO Session

Last updated: 2026-10-29 16:45 KST

## Current task

2.0.21: hand execution to OpenCode (ADR-0029). 2.0.20 shipped (OpenCode 2
only, ADR-0028). The 2.0.21 work is on main, verified locally, and goes out
through `npm run release:patch`.

## Last completed step

- Delegation engine, background commands, Rust tools and `orchestrator-core`,
  metrics, `MemoryManager` and memory notes removed. Commander uses
  OpenCode's `subagent`; Planner/Worker/Reviewer get a `subagent` deny rule.
  Only `update_todo` remains.
- Fixes: context window per session model, safety hooks in every session,
  role guard on `shell`, event-stream resubscribe, abort-only pause, hook
  state cleared on delete, mission state cleared on start/stop/complete,
  checklist `[/]`/`[-]` count as incomplete.
- Tests repaired and type-checked (`npm run typecheck:test`, in CI); CI runs
  coverage. Docs: ADR-0029, SYSTEM_ARCHITECTURE, README, CONTRIBUTING.

## Next exact step

After the release: confirm the Actions run, the GitHub release and npm
`opencode-orchestrator@latest`.

## Incomplete items and why

- ADR-0021 Stage 1 (full native parity scenarios) and Stage 4 (mission
  record consolidation) are open.
- Deferred structure: the event bridge's translated event shapes, several
  per-session stores that could merge, verification size, the desktop
  notification on headless servers.

## Key decisions

- Patch releases at the owner's request; OpenCode installs from `@latest`.
- OpenCode 1 users stay on 2.0.19.

## Known risks

- Removed option keys and `.opencode/agents.json` custom agents are silently
  ignored.
- Old `.opencode/docs/brain/memories/` notes remain on disk.

## Files to open first in the next session, in order

1. AGENTS.md
2. AGENT_MEMORY.md
3. docs/adr/0029-hand-execution-to-opencode.md
4. src/host/plugin.ts
5. src/plugin-runtime.ts
6. src/plugin-handlers/event-handler.ts
7. src/core/loop/mission-loop-handler.ts
