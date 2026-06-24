# Agent Memory - OCO Session

## Current Task

User requested repeated fresh exhaustive audit passes, with commit and push after each pass. Current pass completed: 18. The broader requested target remains active beyond this session.

## Last Completed Step

Completed audit pass 18 after migrating agent launch/resume input ownership to the shared task contract and removing core agent input wrapper files.

- Confirmed `main` was aligned with `origin/main` at `bacb5d9` before pass 18 changes.
- Reopened `AGENT_MEMORY.md`, `AGENTS.md`, `src/shared/task/types.ts`, `src/core/agents/interfaces/launch-input.interface.ts`, `src/core/agents/interfaces/resume-input.interface.ts`, `src/core/agents/interfaces/index.ts`, `src/core/agents/manager.ts`, `src/core/agents/manager/task-launcher.ts`, and `src/core/agents/manager/task-resumer.ts`.
- Reopened `src/core/agents/interfaces/session-pool.interface.ts`, `src/core/agents/session-pool.ts`, and `src/core/agents/index.ts` to verify remaining interface ownership and public exports.
- Confirmed `ResumeInput` was duplicated exactly between shared task types and core agent interfaces.
- Confirmed `LaunchInput` was duplicated except for active runtime fields `mode` and `groupID` used by delegate task and unit-review launch paths.
- Added `mode?: "normal" | "race" | "fractal"` and `groupID?: string` to canonical `src/shared/task/types.ts` `LaunchInput`.
- Updated `src/core/agents/manager.ts`, `src/core/agents/manager/task-launcher.ts`, and `src/core/agents/manager/task-resumer.ts` to import `LaunchInput` and `ResumeInput` from shared.
- Removed `src/core/agents/interfaces/launch-input.interface.ts`, `src/core/agents/interfaces/resume-input.interface.ts`, and `src/core/agents/interfaces/index.ts`.
- Removed the dead interface barrel export from `src/core/agents/index.ts`.

## Next Exact Step

Start audit pass 19 from current state:

1. Open `AGENT_MEMORY.md`.
2. Run `git status --branch --short`.
3. Reopen the pass-19 target files listed below.
4. Continue compatibility/debt removal from fresh evidence, starting with session-pool interface ownership and remaining core/orchestrator interface barrels.

## Incomplete Items And Why

The full requested repeated-pass objective is not complete. Pass 18 is complete and ready to commit/push.

## Key Decisions

- `src/shared/task/types.ts` is the canonical owner of agent launch/resume task contracts.
- `LaunchInput.mode` and `LaunchInput.groupID` are real runtime fields, so they belong in the canonical shared contract rather than a core-only duplicate.
- `src/core/agents/index.ts` should expose agent classes only; removed input types come from shared.
- `src/core/agents/interfaces/session-pool.interface.ts` remains for now because it describes the internal session-pool implementation and is still consumed by `src/core/agents/session-pool.ts`.

## Rejected Alternatives

- Rejected deleting `mode` and `groupID` from launch inputs because delegate task and unit-review paths actively use them.
- Rejected preserving the core launch/resume interface files as compatibility paths because current consumers can import the canonical shared types.
- Rejected moving session-pool interfaces in the same pass because that is a separate ownership question from task launch/resume contracts.

## Known Risks

- The broader 100/1000-pass objective is intentionally not marked complete.
- External consumers importing removed `src/core/agents/interfaces/*` launch/resume paths would need to import canonical shared task types instead, matching the user's no-compatibility-shim direction.
- Session-pool interface ownership and other interface barrels still need dedicated fresh passes.

## Verification Observed

- Baseline focused tests before edits: `tests/unit/task-launcher.test.ts`, `tests/unit/task-resumer.test.ts`, `tests/unit/delegate-task.test.ts`, and `tests/unit/parallel-manager.test.ts`, 4 files and 19 tests passed.
- Baseline `npm run build --silent`: passed.
- Focused tests after edits: same 4 files and 19 tests passed.
- `npm run build --silent`: passed after edits.
- Final `npx vitest run --reporter=dot`: passed, 96 files and 806 tests.
- `cargo fmt --check`: passed.
- `cargo test -p orchestrator-cli -p orchestrator-core --quiet`: passed, CLI 12 tests and core 35 tests.
- `test ! -e src/core/agents/interfaces/launch-input.interface.ts && test ! -e src/core/agents/interfaces/resume-input.interface.ts && test ! -e src/core/agents/interfaces/index.ts && echo deleted`: printed `deleted`.
- `rg -n "core/agents/interfaces|agents/interfaces|launch-input\.interface|resume-input\.interface|from [\"']\.\/interfaces\/index\.js|from [\"']\.\/interfaces\/index" src/core/agents src/tools tests -g '*.ts'`: no matches.
- `git diff --check`: passed.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --branch --short`
3. `src/core/agents/interfaces/session-pool.interface.ts`
4. `src/core/agents/session-pool.ts`
5. `src/core/agents/index.ts`
6. `src/core/orchestrator/interfaces/session-state.ts`
7. `src/core/orchestrator/interfaces/index.ts`
8. `src/core/orchestrator/session-manager.ts`
9. `src/core/orchestrator/state.ts`
