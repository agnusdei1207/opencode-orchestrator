# Agent Memory - OCO Session

## Current Task

User requested repeated fresh exhaustive audit passes, with commit and push after each pass. Current pass completed: 5. The broader requested target remains active beyond this session.

## Last Completed Step

Completed audit pass 5 after reopening the pass-5 files and current worktree state.

- Confirmed `main` was aligned with `origin/main` at `3e016af` before pass 5 changes.
- Reopened `AGENT_MEMORY.md`, `src/plugin-handlers/event-handler.ts`, `src/plugin-handlers/session-compacting-handler.ts`, `src/core/loop/mission-loop-handler.ts`, `tests/unit/event-handler.test.ts`, `tests/unit/session-compacting-handler.test.ts`, `tests/e2e/mission-loop-lifecycle.test.ts`, and `tests/e2e/mission-loop-persistence.test.ts`.
- Checked installed `@opencode-ai/plugin` and `@opencode-ai/sdk` generated types. Plugin events are SDK `Event`; v1 created/deleted use `info`, v2 created/deleted include direct `sessionID` plus `info`; idle/status/error use direct `sessionID`.
- Found session lifecycle ID reading only used `info.id` for created/deleted and direct `sessionID` for other events.
- Updated `event-handler.ts` to use one `readSessionID(...)` helper that prefers direct `sessionID` and falls back to `info.id`.
- Updated plugin root `readCreatedSessionID(...)` to prefer direct `sessionID` for TodoSync registration.
- Removed duplicate implementation-file type re-exports from `event-handler.ts` and `session-compacting-handler.ts`; canonical exports remain in `plugin-handlers/interfaces/index.ts`.
- Added a regression test proving direct SDK `sessionID` wins over nested `info.id` for session lifecycle routing.

## Next Exact Step

Start audit pass 6 from current state:

1. Open `AGENT_MEMORY.md`.
2. Run `git status --branch --short`.
3. Reopen the pass-6 target files listed below.
4. Continue compatibility-shim removal and route-surface consolidation from a fresh file boundary.

## Incomplete Items And Why

The full requested repeated-pass objective is not complete. Pass 5 is complete and ready to commit/push.

## Key Decisions

- Prefer current SDK event fields over compatibility fallback fields when both exist.
- Keep type exports centralized in `plugin-handlers/interfaces/index.ts`; implementation modules should expose behavior, not duplicate type barrels.
- Preserve `info.id` fallback only where current installed SDK v1 generated types prove it is still required for created/deleted events.

## Rejected Alternatives

- Rejected removing the `info.id` fallback for created/deleted in this pass because installed `@opencode-ai/sdk@1.17.9` v1 generated types still use `properties.info` for those events.
- Rejected keeping implementation-file type re-exports because `plugin-handlers/index.ts` already exports the canonical interfaces barrel.

## Known Risks

- The broader 100/1000-pass objective is intentionally not marked complete.
- `src/plugin-handlers/system-transform-handler.ts` still has an implementation-file type re-export and should be checked in pass 6 with its tests.
- `src/core/agents/interfaces/index.ts` still re-exports shared types for compatibility and needs a dedicated migration, not a drive-by removal.

## Verification Observed

- Baseline focused tests passed before edits: `tests/unit/event-handler.test.ts`, `tests/unit/session-compacting-handler.test.ts`, `tests/e2e/mission-loop-lifecycle.test.ts`, and `tests/e2e/mission-loop-persistence.test.ts` with 28 tests.
- Focused tests passed after edits: the same 4 files with 29 tests.
- SDK/plugin generated type evidence checked in `node_modules/@opencode-ai/plugin/dist/index.d.ts`, `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts`, and `node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts`.
- `rg -n "Re-export interfaces|backward compatibility|readSessionID|session-direct|readCreatedSessionID" src/plugin-handlers src/index.ts tests/unit/event-handler.test.ts` showed the removed re-exports in touched files and the remaining `system-transform-handler.ts` re-export for pass 6.
- `npm run build`: passed.
- `npx vitest run --reporter=dot`: passed, 96 files and 806 tests.
- `cargo fmt --check`: passed.
- `cargo test -p orchestrator-cli -p orchestrator-core`: passed, CLI 12 tests and core 35 tests.
- `git diff --check`: passed.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --short`
3. `src/plugin-handlers/system-transform-handler.ts`
4. `src/plugin-handlers/index.ts`
5. `src/plugin-handlers/interfaces/index.ts`
6. `tests/unit/system-transform-handler.test.ts`
7. `src/core/agents/interfaces/index.ts`
8. `src/core/agents/manager.ts`
9. `tests/unit/task-resumer.test.ts`
