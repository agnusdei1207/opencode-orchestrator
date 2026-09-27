# Agent Memory - OCO Session

Last updated: 2026-09-27 23:25 KST

## Current task

Issue #49 (`/task` blocked by another session's project mission) is fixed and
released in `v2.0.7`. Issue #48 (compressed conversation treated as user input)
remains open pending a reproducible session transcript and plugin inventory.

## Last completed step

Traced the V1 chat/native command and V2 command entry points through
`MissionControlHook`, persisted mission state, delegated task cancellation, and
idle continuation. New `/task` in another session now aborts a busy owner,
cancels its running/pending children without notifying the retired parent,
checks the expected prior mission identity, replaces the project record, and
deactivates the old local session. Same-session restart remains available.
The patch is commit `5b69611`; `npm run release:patch` created release commit
`9e7a4e7` and tag `v2.0.7` and atomically pushed both.

Release preflight passed 119 TypeScript test files / 1,033 tests (coverage
statements 89.93%, branches 80.58%, functions 91.93%, lines 92.18%),
57 Rust tests, Rust fmt and Clippy, production npm audit, dependency checks,
and packed-package smoke. The built plugin passed all 14 isolated live-host
checks with OpenCode and SDK `1.18.32`, including a busy old mission replaced
by a native `/task`, compaction, delegation, abort, and restart. Hosted run
`36325507529` succeeded with five platform binaries, published the GitHub
release, and logged `+ opencode-orchestrator@2.0.7`. A fresh npm cache
confirmed `2.0.7` and `latest: 2.0.7`. Issue #49 was closed after publication.

For #48, the issue supplies only a screenshot. The screenshot's compressed
conversation wording matches the DCP compression placeholder documented in
the separate OpenCode Dynamic Context Pruning project, but the reporter's
installed plugins and actual message roles are unknown. This repository has
no matching placeholder; its compaction handler adds context to the host
compaction hook, and its own continuation prompts are synthetic. The isolated
host compaction check passed. No issue-specific change is justified yet.

## Next exact step

Obtain #48's OpenCode version, installed plugin list, and the session messages
immediately before/after the compressed section. Reproduce with only
OpenCode Orchestrator, then with other installed compression plugins. Fix a
confirmed Orchestrator path or route the finding to the owning project.

## Incomplete items and why

- #48 remains open because the screenshot does not identify the producing
  plugin or show serialized message roles.
- No released OpenCode 2 executable was installed for live QA. V2 command
  replacement and interrupt were covered with the installed `@opencode/plugin`
  contract and tests; perform a live-host run when an executable is available.
- Native background task parity and overlapping plugin-instance isolation
  remain outside this patch's verified scope.

## Key decisions

- Honor the requested overwrite behavior for a new `/task`, after confirmed
  interruption/cancellation. Keep one project mission record.
- Preserve project TODO/checklist files for the new mission to reconcile.
- Keep `/stop` session-owned; it does not stop another session's mission.
- Do not change compaction behavior based solely on #48's screenshot.

## Rejected alternatives

- Require a manual `/stop` in the old session before a new `/task`.
- Replace the mission without aborting busy owner and delegated work.
- Attribute #48 to Orchestrator and alter message roles without a transcript.

## Known risks

- Project TODO/checklist content from the old mission can still affect the new
  mission until reconciled.
- Abort/pause protection and delegated task state are process-local; distinct
  plugin processes do not share those in-memory guards.
- The #48 wording suggests another compression plugin, but its presence in
  the reporter's environment is unconfirmed.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `src/plugin-handlers/session-compacting-handler.ts`
4. `src/core/session/injection.ts`
5. `src/v2/setup.ts`
6. `src/plugin-handlers/chat-message-handler.ts`
7. `src/hooks/features/mission-loop.ts`
8. `src/core/loop/mission-loop.ts`
9. `scripts/qa-native-host.mjs`
