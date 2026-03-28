# Agent Memory - OCO Session

## Current Task

Fix `/task` TUI corruption caused by unsafe toast payloads, publish a patch release, and confirm the patched build is pushed.

## Last Completed Step

Added a shared toast sanitization layer, wired it into `toast-core` and `task-toast-manager`, and verified the affected unit/build paths locally.

## Next Exact Step

Create the fix commit, run `npm run release:patch`, then push the resulting release commit and tag to `origin/main`.

## Incomplete Items And Why

- Published patch verification is still pending because the release command and remote push have not been executed yet.

## Key Decisions

- Treat the root cause as a rendering-safety bug in the toast pipeline rather than a mission-loop bug.
- Sanitize toast titles, inline labels, and multiline bodies separately so task context remains visible without letting control sequences or oversized payloads reach the TUI.
- Keep raw task metadata untouched in storage and sanitize only at the UI boundary.

## Rejected Alternatives

- Sanitizing only `/task` user input, because delegated task descriptions and error payloads can also inject unsafe content.
- Truncating task descriptions without stripping terminal control sequences, because escape bytes would still reach the TUI.
- Refactoring mission/task execution flow, because the evidence pointed to unsafe rendering payloads rather than broken orchestration state.

## Known Risks

- The patch is validated by targeted unit tests and local build, not by an interactive OpenCode TUI session in this workspace.
- `npm run release:patch` still depends on Docker and publish credentials being available in the environment.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `src/core/notification/toast-sanitizer.ts`
3. `src/core/notification/task-toast-manager.ts`
4. `src/core/notification/toast-core.ts`
5. `tests/unit/toast-sanitizer.test.ts`
