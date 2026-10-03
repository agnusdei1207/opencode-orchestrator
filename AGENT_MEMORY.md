# Agent Memory - OCO Session

Last updated: 2026-10-03 KST

## Current task

Second audit pass (re-verification, tool metrics, plugin SDK comparison
against a freshly pulled `../opencode`), then the user-approved fix batch
1 → 2 → 3 → 5 from that report. Commits are local; push and release await
the user's go-ahead.

## Last completed step

Batch 1 (released as v2.0.10, commit `50cfa55`, tag `v2.0.10`, npm `latest`):
`5c10197` guard bypasses, `813cf52` multi-line `/task`, `c4b5d6e` unlimited
concurrency auto-scale, `c0e6060` V2 event bridge isolation, `52c142b`
countdown unhandled rejection, `eecda63` task pool discard, `7c320d8` Rust
CLI integration test path.

Batch 2 (local, TDD red then green, not pushed):

1. `687fb08` declined idle no longer sets sticky `lastAbortAt`; it still
   pauses the mission via `MissionLoopHandler.handleAbort`
   (`plugin-handlers/event-handler.ts`). Background notices survive.
2. `9d94865` memory note pruning removes only unpinned notes tagged
   `mission-memory`; pinned and user files survive a restart
   (`core/knowledge/mission-memory.ts`, docs/SYSTEM_ARCHITECTURE.md).
3. `05d8f15` `detectErrorType` reads `message`, `data.message` and `name`
   together; upstream session errors are `{ name, data: { message } }`
   (`packages/core/src/v1/session.ts:55`). Session recovery now runs.
4. `4bf7e6c` V2 child sessions deleted via `session.remove` when present;
   `@opencode/plugin` dev contract 2.0.15 → 2.0.22; ADR-0024, architecture
   doc and dependency pin test updated.

`tsc --noEmit`, `npm run build`, all 120 Vitest files / 1,057 tests,
`npm audit --omit=dev` (0) and `npm run release:dry-run` passed.

## Next exact step

Ask the user whether to push and release batch 2 as v2.0.11
(`npm run release:patch`), then verify CI, Build & Release and npm `latest`.

## Incomplete items and why

- Rust items not fixed: `http.rs:113-117` `-d @file` exfiltration, no `--`
  or `--proto`; `-X HEAD` timeouts; eslint argument injection
  (`lsp.rs:204`); git exit status ignored; `diff` temp-file race;
  `sed_replace` CRLF loss; `shell_listener.rs:352` exits on operator typo.
  No local cargo, but `npm run release:dry-run` runs Rust fmt, clippy and
  tests through Docker, so Rust fixes are locally verifiable.
- TS Medium items still open: unchecked `session.prompt` `.error`
  (`mission-loop-handler.ts:174`); TIMEOUT toasted twice as "Completed",
  cancel shown as "Failed" (`task-toast-manager.ts:241`,
  `task-cleaner.ts:72`); untracked-session map leak on delete
  (`event-handler.ts:121`); idle scheduled twice per idle (`:260`, `:278`);
  secret scanner misses `sk-proj-`, `sk-ant-`, `github_pat_`, `AKIA`;
  unbounded `commands/manager.ts:98-103` output; non-atomic
  `mission-loop.ts:156`; `http` tool `headers` schema `object({})` tells
  models headers must be empty (`tools/search.ts:136`).
- Low: `maxIterations` never enforced; objective not escaped inside
  `<mission_loop>` (`mission-loop.ts:319`); unused `LIMITS` constants;
  `slashCommand.ts:77` prototype lookup; dead `state.missionActive`;
  landing page advertises retired RAG/Ebbinghaus (`public/index.html:13-14`).
- Metrics (ESLint, AGENTS.md limits): 27 complexity, 13 length, 3 depth
  violations; 0 params. madge: 0 cycles. knip: 23 unused exported types.
- `@opencode-ai/plugin`/`sdk` 1.18.34 is available (version-sync only);
  not bumped.
- `logger.ts` is a deliberate no-op; design decision, not changed.
- #50 and #48 still await reporter confirmation.

## Key decisions

- Declined idles pause the mission but do not mark an explicit abort.
- Generated-note pruning keys on the `mission-memory` tag and `keep`.
- Error text for detection joins message, data.message and name so
  name-only types (MessageAbortedError) keep matching.
- V2 deletion feature-detects `session.remove` at runtime.

## Rejected alternatives

- Removing the declined-idle mission pause entirely: an existing test pins
  it as deliberate abort heuristics.
- Preferring `data.message` over `name` in detection: broke
  `MessageAbortedError` (data.message is "Aborted"); caught by a new test.
- V2 sub-agent tool restriction item: V1 `tools` only creates allow rules
  (upstream `session/prompt.ts:1061`), so there was nothing to port.

## Known risks

- Recovery now actually runs: rate-limit recovery awaits up to 8 s
  (1 s × 2^3). V1 hosts fire event hooks with `void`, but the V2 bridge
  awaits handlers sequentially, so V2 event processing can lag that long.
- Pinned generated notes are never auto-pruned and can accumulate.
- Root-deletion guard is a safety net; quoted `"/"`, `~/`, `find / -delete`
  pass, and `git rm -r --cached /` is a false positive.
- `/stop` followed by more lines is now treated as a stop command.
- Local `bin/orchestrator-windows-x64.exe` is stale (1.7.27, gitignored).

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `crates/orchestrator-core/src/tools/http.rs`
4. `src/core/loop/mission-loop-handler.ts`
5. `src/core/notification/task-toast-manager.ts`
6. `src/plugin-handlers/event-handler.ts`
