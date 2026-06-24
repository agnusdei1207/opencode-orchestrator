# Agent Memory - OCO Session

## Current Task

User requested repeated fresh exhaustive audit passes, with commit and push after each pass. Current pass completed: 15. The broader requested target remains active beyond this session.

## Last Completed Step

Completed audit pass 15 after removing shared-layer compatibility and legacy-debt paths.

- Confirmed `main` was aligned with `origin/main` before pass 15 changes.
- Reopened `AGENT_MEMORY.md`, `AGENTS.md`, `src/shared/loop/constants.ts`, `src/shared/lifecycle/shutdown-manager.ts`, `src/shared/lifecycle/index.ts`, `src/shared/lifecycle/registration.ts`, `tests/unit/layering.test.ts`, `src/plugin-handlers/chat-message-handler.ts`, `src/shared/notification/presets.ts`, `src/shared/notification/index.ts`, `src/core/notification/toast.ts`, and all affected preset consumers.
- Removed deprecated `MISSION` alias from `src/shared/loop/constants.ts`; `MISSION_CONTROL` remains the only mission-control constant export.
- Removed deprecated `CleanupHandler` from the lifecycle public surface.
- Converted `ShutdownManager` to store `CleanupRegistration[]` directly and removed its shared-to-core logger import.
- Changed `ShutdownManager` logging to an injected logger with a no-op default and imported `LOG_PREFIX` from the shared constants owner directly.
- Removed duplicate lifecycle registration interface declarations.
- Moved notification preset implementation from `src/shared/notification/presets.ts` to `src/core/notification/presets.ts`.
- Removed the shared notification preset export and updated all current consumers to import presets from the core notification surface.
- Removed the layering-test allowlist; `src/shared` now fails on any shared-to-core import.
- Removed the empty legacy session block/comment from `src/plugin-handlers/chat-message-handler.ts`.

## Next Exact Step

Start audit pass 16 from current state:

1. Open `AGENT_MEMORY.md`.
2. Run `git status --branch --short`.
3. Reopen the pass-16 target files listed below.
4. Continue compatibility/debt removal from fresh evidence, starting with status/type ownership, shared barrel exposure, and any remaining redundant re-export wrappers.

## Incomplete Items And Why

The full requested repeated-pass objective is not complete. Pass 15 is complete and ready to commit/push.

## Key Decisions

- Compatibility aliases should be deleted after all consumers are confirmed absent, not retained as convenience exports.
- Notification presets execute core UI side effects, so they belong under `src/core/notification`, not under `src/shared`.
- The shared layer must not import upward into core. The test now enforces this without an allowlist.
- Shutdown lifecycle types should use the canonical `CleanupRegistration` contract directly.

## Rejected Alternatives

- Rejected retaining `MISSION` as a deprecated alias because no consumer required it.
- Rejected keeping `CleanupHandler` as a public compatibility type because `CleanupRegistration` is the canonical type.
- Rejected keeping notification presets in shared with an allowlisted layering exception because that preserved known architecture debt.
- Rejected importing `LOG_PREFIX` through `src/shared/index.ts` from `shutdown-manager.ts` because the direct constants owner avoids shared barrel recursion.

## Known Risks

- The broader 100/1000-pass objective is intentionally not marked complete.
- `ShutdownManager` now defaults to a no-op logger; this matches the current logger's observed no-op behavior but leaves explicit logging injection available.
- More compatibility/debt may remain outside the pass-15 target set and must be surveyed in pass 16.

## Verification Observed

- Baseline focused tests before edits: `tests/unit/layering.test.ts`, `tests/unit/config-handler.test.ts`, `tests/unit/session-compacting-handler.test.ts`, and `tests/e2e/mission-loop-lifecycle.test.ts`, 4 files and 27 tests passed.
- Baseline `npm run build --silent`: passed.
- Focused tests after initial lifecycle/loop edits: same 4 files and 27 tests passed.
- `npm run build --silent`: passed after initial edits.
- Focused tests after preset migration: `tests/unit/layering.test.ts`, `tests/unit/event-handler.test.ts`, `tests/unit/task-launcher.test.ts`, and `tests/unit/todo-continuation.test.ts`, 4 files and 25 tests passed.
- Final focused tests after the direct `LOG_PREFIX` import cleanup: `tests/unit/layering.test.ts`, `tests/unit/event-handler.test.ts`, `tests/unit/task-launcher.test.ts`, `tests/unit/task-resumer.test.ts`, `tests/unit/todo-continuation.test.ts`, and `tests/e2e/mission-loop-lifecycle.test.ts`, 6 files and 38 tests passed.
- Final `npm run build --silent`: passed.
- Final `npx vitest run --reporter=dot`: passed, 96 files and 806 tests.
- `cargo fmt --check`: passed.
- `cargo test -p orchestrator-cli -p orchestrator-core --quiet`: passed, CLI 12 tests and core 35 tests.
- `git diff --check`: passed.
- `rg -n "from\s+[\"'](?:\.\.\/){2,}core/|notification/presets|CleanupHandler|\bMISSION\b\s*=|ALLOWLIST|known debt|legacy implementation|except known legacy debt" src/shared tests/unit/layering.test.ts -g '*.ts'`: no matches.
- `rg -n "import \{ presets \} from .*shared|export \* as presets|notification/presets" src tests -g '*.ts'`: only `src/core/notification/toast.ts` exports presets from `./presets.js`.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --branch --short`
3. `src/core/agents/consts/task-status.const.ts`
4. `src/core/commands/types/background-task-status.ts`
5. `src/core/orchestrator/types/task-status.ts`
6. `src/core/agents/types/parallel-task-status.type.ts`
7. `src/shared/index.ts`
8. `src/shared/lifecycle/registration.ts`
9. `src/core/notification/toast.ts`
