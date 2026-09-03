# ADR-0016: Session Lifecycle Safety and Model-Aware Context Limits

Date: 2026-09-02 18:00 KST
Status: Implemented
Source: `docs/histories/2026/09/02/PLAN_SessionLifecycleAndContextLimits_2026-09-02.md` (removed 2026-09-03; history in git)
Report: `docs/histories/2026/09/02/REPORT_SessionLifecycleAndContextLimits_2026-09-02.md`

## Context

Three production defects shared one theme — lifecycle actions taken without
observing actual state: pool deletes raced host writes (#41, FOREIGN KEY
failures), context alerts measured 1M-token models against a 200k default
(#40), and output-repetition loops had no breaker (#39).

## Decision

- #41: never delete an in-use, busy (authoritative `isSessionBusy`), or
  recently-active session (10s settle window from host activity, not own
  polls); forget unsettled sessions after 10 min; `shutdown()` deletes only
  settled idle sessions; `session.deleted` maps to pool `forget()`.
- #40: `ContextLimitResolver` — explicit override → model metadata from chat
  params / provider list → 200k default; token counting matches upstream
  `session/overflow.ts`.
- #39: circuit breaker on output repetition (3 identical no-tool turns, long
  reset); continuation skips an open circuit; real user messages clear it.

## Consequences

- Build + tsc clean, 1046 tests pass, live QA on OpenCode 1.18.26 with zero
  FOREIGN KEY errors across 85 LLM calls.
