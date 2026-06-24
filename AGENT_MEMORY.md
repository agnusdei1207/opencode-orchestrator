# Agent Memory - OCO Session

## Current Task

User requested repeated fresh exhaustive audit passes, with commit and push after each pass. Current pass completed: 17. The broader requested target remains active beyond this session.

## Last Completed Step

Completed audit pass 17 after removing duplicated core command interface declarations and migrating command consumers to the shared command contract.

- Confirmed `main` was aligned with `origin/main` at `17724aa` before pass 17 changes.
- Reopened `AGENT_MEMORY.md`, `AGENTS.md`, `src/core/commands/interfaces/background-task.ts`, `src/shared/command/types.ts`, `src/core/commands/interfaces/run-background-options.ts`, `src/core/commands/manager.ts`, `src/core/commands/index.ts`, `src/core/agents/interfaces/index.ts`, and `src/core/orchestrator/interfaces/index.ts`.
- Reopened command and agent producer/consumer files used to classify ownership: `src/shared/task/types.ts`, `src/core/agents/interfaces/launch-input.interface.ts`, `src/core/agents/interfaces/resume-input.interface.ts`, and `src/core/agents/manager.ts`.
- Confirmed `BackgroundTask` and `RunBackgroundOptions` were duplicated between `src/shared/command/types.ts` and `src/core/commands/interfaces/*`.
- Removed `src/core/commands/interfaces/background-task.ts`, `src/core/commands/interfaces/run-background-options.ts`, and `src/core/commands/interfaces/index.ts`.
- Removed the command interface barrel export from `src/core/commands/index.ts`.
- Updated `src/core/commands/manager.ts` to import `BackgroundTask`, `BackgroundTaskStatus`, and `RunBackgroundOptions` from `src/shared`.
- Added an internal `ManagedBackgroundTask` subtype in `src/core/commands/manager.ts` for runtime-only `timeoutHandle` storage instead of exposing it through public shared command types.
- Updated `src/tools/background-cmd/list.ts` to import `BackgroundTask` from `src/shared`.

## Next Exact Step

Start audit pass 18 from current state:

1. Open `AGENT_MEMORY.md`.
2. Run `git status --branch --short`.
3. Reopen the pass-18 target files listed below.
4. Continue compatibility/debt removal from fresh evidence, starting with agent launch/resume input ownership and remaining interface barrels.

## Incomplete Items And Why

The full requested repeated-pass objective is not complete. Pass 17 is complete and ready to commit/push.

## Key Decisions

- `src/shared/command/types.ts` is the canonical owner of command data contracts.
- `timeoutHandle` is manager-local runtime state and should remain internal to `BackgroundTaskManager`.
- The core command public index should expose the manager only; command data types come from shared.
- Agent `LaunchInput` was not removed in pass 17 because the core version currently includes `mode` and `groupID` while the shared version does not.

## Rejected Alternatives

- Rejected adding `timeoutHandle` to shared `BackgroundTask` because it is not part of the public command task contract.
- Rejected deleting agent launch/resume interfaces in this pass because that would mix a contract migration with the command interface cleanup.
- Rejected preserving the core command interface barrel as a compatibility path because current consumers can use shared types directly.

## Known Risks

- The broader 100/1000-pass objective is intentionally not marked complete.
- External consumers importing removed `src/core/commands/interfaces/*` paths would need to import canonical shared types instead, matching the user's no-compatibility-shim direction.
- Agent launch/resume input ownership still needs a dedicated pass because shared and core launch input shapes differ.

## Verification Observed

- Baseline focused tests before edits: `tests/e2e/background-task.test.ts` and `tests/unit/harness-builders.test.ts`, 2 files and 34 tests passed.
- Baseline `npm run build --silent`: passed.
- Focused tests after edits: `tests/e2e/background-task.test.ts` and `tests/unit/harness-builders.test.ts`, 2 files and 34 tests passed.
- `npm run build --silent`: passed after edits.
- Final `npx vitest run --reporter=dot`: passed, 96 files and 806 tests.
- `cargo fmt --check`: passed.
- `cargo test -p orchestrator-cli -p orchestrator-core --quiet`: passed, CLI 12 tests and core 35 tests.
- `test ! -e src/core/commands/interfaces/background-task.ts && test ! -e src/core/commands/interfaces/index.ts && test ! -e src/core/commands/interfaces/run-background-options.ts && echo deleted`: printed `deleted`.
- `rg -n "core/commands/interfaces|commands/interfaces|interfaces/background-task|interfaces/run-background-options|type BackgroundTask \} from [\"'].*core/commands|RunBackgroundOptions" src/core/commands src/tools/background-cmd tests -g '*.ts'`: only the shared-imported `RunBackgroundOptions` use in `src/core/commands/manager.ts` remained.
- `git diff --check`: passed.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --branch --short`
3. `src/shared/task/types.ts`
4. `src/core/agents/interfaces/launch-input.interface.ts`
5. `src/core/agents/interfaces/resume-input.interface.ts`
6. `src/core/agents/interfaces/index.ts`
7. `src/core/agents/manager.ts`
8. `src/core/agents/manager/task-launcher.ts`
9. `src/core/agents/manager/task-resumer.ts`
