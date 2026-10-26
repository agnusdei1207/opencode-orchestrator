# ADR-0026: Remove Test-Only Runtime Code

Date: 2026-10-26 20:30 KST
Status: Implemented

## Context

ADR-0023 proved every source file is reachable from the shipped entrypoints,
but reachability counts imports, not use. A production-mode export audit
(knip with only `src/index.ts` and `src/cli.ts` as entries, tests excluded)
plus consumer tracing found code that tests alone kept alive. Some was
write-only state: production wrote it and nothing ever read it.

## Decision

- Delete code that production cannot reach or whose output nothing reads:
  - the `core/progress` snapshot store;
  - `shared/errors/retry` and `utils/parsing/safe-json`;
  - the `getContextInjection` prompt builder, superseded by ADR-0025;
  - toast history and the toast handler list, which had no way to subscribe;
  - `ConcurrencyController.getConfig`, `ShutdownManager.isShutdown`, the
    unused `Todo` types, and constants only that code referenced.
- Remove the circuit breaker's tool-repetition path. Since d10b179 only
  `tripOutputCircuit` can open the circuit (issue #39 allows `read,read,read`),
  so tool calls were recorded but never evaluated.
- Remove `npm run log` and `scripts/tail-log.mjs`. Nothing has written the
  tailed file since file logging was disabled. Keep `log()` as a documented
  no-op seam, because stdout/stderr output corrupts the OpenCode TUI.
- Drop the unread ast-grep `range.end` field and its `allow(dead_code)`.
  serde already ignores unknown JSON fields here.
- Keep functions that exist only to reset or inspect module state for tests
  (`reset*`, `get*State`, `_resetForTesting`, `getMonitorStatus`). They are
  test seams over module-level state, not product features.
- Make every removal behavior-preserving. Delete tests that covered only
  removed code. Where a test asserted through removed state, it now asserts
  the observable contract instead.

## Consequences

Production TypeScript fell from 198 files / 17,367 lines to 192 / 16,730.
The suite fell from 128 files / 1,153 tests to 125 / 1,113. The removed tests
covered only the deleted code. A new regression test pins that tool-calling
turns never open the circuit. Source still meets the AGENTS.md limits:
complexity ≤ 10, ≤ 4 parameters, depth ≤ 3, ≤ 40 lines, no explicit `any`.
This was measured with an ESLint probe that is not installed in the
repository.

The published package no longer contains `scripts/tail-log.mjs`. The
plugin's tools, hooks and default export are unchanged.

Behavior changes found during the audit were left out of this refactor:

- `show_metrics` still prints agent latency, success rate and sub-task
  count, which production never records, so they read empty or 0.
- `session.deleted` does not clear `core/loop/progress-tracker` state; its
  10-minute prune releases it.
