# Agent Memory - OCO Session

## Current Task

Confirm the published `opencode-orchestrator@1.2.69` patch is available downstream and watch for any remaining `/task` TUI corruption reports.

## Last Completed Step

Fixed the unsafe toast rendering path, published `opencode-orchestrator@1.2.69`, and prepared the post-release metadata sync commit for push.

## Next Exact Step

Push the release commit, the follow-up metadata sync commit, and tag `v1.2.69`, then verify the remote branch is clean.

## Incomplete Items And Why

- Downstream install verification from a clean shell is still pending because only local build/test and npm publish have been completed in this session.

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
- The tagged release commit does not include the README version-line sync, so the repository history keeps that as a follow-up commit after the published tag.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `README.md`
3. `src/core/notification/toast-sanitizer.ts`
4. `src/core/notification/task-toast-manager.ts`
5. `src/core/notification/toast-core.ts`
6. `tests/unit/toast-sanitizer.test.ts`
