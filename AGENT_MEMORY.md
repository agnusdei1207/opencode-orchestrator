# Agent Memory - OCO Session

## Current Task

Fixed GitHub issues #41, #40, #39 on 2026-09-02 and prepared an npm patch
release. Analyzed OpenCode 1.18.26 source (cloned to ../opencode) and the DCP
plugin (../opencode-dcp) to confirm root causes, implemented plugin-side fixes,
added tests, and verified end to end against a live OpenCode server with a mock
provider.

## Last Completed Step

- Implemented all three fixes, +38 tests (1046 total pass), build + tsc clean.
- Live QA on OpenCode 1.18.26 with the local plugin: 0 FOREIGN KEY errors across
  85 LLM calls, no false context toast at 150k on a 1M model, stagnation guard
  fired 7 pause toasts. Removed the QA-only global config afterward.
- Wrote PLAN and REPORT under docs/histories/2026/09/02/.

## Next Exact Step

Commit, push, then `npm run release:patch` (bumps to 1.7.15) once the user's
release auth is available. Release scripts require npm auth + Docker.

## Key Decisions

- Issue #41: never delete a session that is in use, busy (authoritative
  `isSessionBusy`), or within a 10s settle window measured from the last host
  activity (`message.updated`/`message.part.updated`, not our own status polls).
  A session that never settles is forgotten after 10 min, not force-deleted.
  `shutdown()` deletes only settled idle sessions. `session.deleted` -> pool
  `forget()` (no second delete). Dead/timed-out tasks now notify the parent.
- Issue #40: new `ContextLimitResolver` — override (`contextMaxTokens`) ->
  `chat.params` model metadata / `provider.list()` -> 200k default. Token count
  matches upstream `session/overflow.ts` (includes cache, excludes reasoning).
- Issue #39: circuit breaker output-repetition detection (3 identical no-tool
  turns) with a long reset; continuation skips an open circuit and toasts; a
  real user message clears it. The `compress` tool itself is DCP's, not ours.

## Known Risks

- The live provider was a mock (no real 1M-model auth available locally); DCP
  co-install interaction was reasoned from source, not run.
- `cancelTask` now aborts + releases instead of force-deleting; relies on the
  session abort route existing (it does in 1.18.26 SDK).

## Files To Open First Next Session

1. AGENT_MEMORY.md
2. src/core/agents/session-pool.ts
3. src/core/context/context-limit-resolver.ts
4. src/core/loop/circuit-breaker.ts
5. src/plugin-handlers/event-handler.ts
6. docs/histories/2026/09/02/REPORT_SessionLifecycleAndContextLimits_2026-09-02.md
