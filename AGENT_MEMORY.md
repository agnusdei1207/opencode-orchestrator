# Agent Memory - OCO Session

## Current Task

Resolved the three open functional GitHub issues (#35, #37, #38), all of which
traced back to the same root problem: the plugin pushed prompts into user
sessions at the wrong time and in the wrong shape.

## Last Completed Step

- Fixed #35 (constant "ANOMALY #1: Low information density"), #37 (system
  messages rendered as user input), #38 (orchestrator interrupting the model
  mid tool call).
- Removed legacy: stray `src/core/context/state_accessor_thought.md`, dead
  `TerminalMonitor` calls, the non-existent `SESSION_EVENTS.BUSY` constant, a
  stale `strict-role-guard` docstring claiming RBAC it never implemented.
- Fixed a time-bomb test in `tests/unit/knowledge/hybrid-search.test.ts` whose
  hard-coded 2026-06 timestamps had decayed past the assertion.
- `tsc --noEmit` clean; 109 test files / 988 tests pass; `npm run build` clean.

## Next Exact Step

Reply to issues #35, #36, #37, #38 on GitHub once release CI finishes.

## Key Decisions

- **`synthetic: true` on every injected text part (#37).** Verified against the
  upstream source cloned at `../opencode` (v1.18.21): `TextPartInput.synthetic`
  is an accepted field (`packages/schema/src/v1/session.ts`), the TUI filters
  synthetic parts out of the transcript
  (`packages/tui/src/routes/session/index.tsx`), and `MessageV2.toModelMessage`
  filters only on `ignored` — so the model still receives them. Delegation
  prompts to subagent sessions stay non-synthetic: they are that session's real
  opening instruction and OpenCode derives session titles from the first
  non-synthetic user message.
- **Never prompt a busy session (#38).** `SessionPrompt.prompt` writes the user
  message *before* `SessionRunState.ensureRunning`, and `ensureRunning` on an
  already-`Running` session just awaits the in-flight run. The message therefore
  lands inside the turn the model is still executing. New
  `src/core/session/activity.ts` tracks busy/idle from `session.status` events
  and confirms against `GET /session/status` (upstream deletes idle sessions
  from that map, so absence means idle).
- **Defer done-hook prompts (#38).** A completed assistant message ends a
  *step*, not a turn — `runLoop` starts another step whenever the model asked
  for tool calls. The mission-loop done-hook was therefore injecting "continue"
  after every tool call. New `src/core/session/pending-injection.ts` queues those
  prompts (latest snapshot wins) and flushes them at the first real idle.
- **Entropy, not a unique/total ratio, for information density (#35).** The old
  ratio was not scale-invariant: unique characters saturate near the alphabet
  size while length grows unbounded, so any output past ~4.5 KB scored below the
  0.02 threshold. Replaced with Shannon entropy over a bounded sample, gated on
  fewer than 12 distinct characters.
- **Structure is not degeneration (#35).** Pattern-loop and single-char
  detectors now require an alphanumeric character in the repeated unit, so
  markdown table rules (`|---|---|…`) and `====` banners stop being flagged.
- **Anomaly interventions are CRITICAL-only and rate-limited** to one per minute
  per session, bounding the cost of any future detector misjudgment.

## Rejected Alternatives

- Blocking `session.prompt` behind a hard error when busy: would have silently
  dropped legitimate continuations. Skipping plus re-checking at the next idle
  is recoverable.
- Removing the sanity checker entirely: real decoder degeneration does happen;
  the detectors just needed scale-invariant statistics.
- Clearing session-activity state from the two loop modules' `cleanupSession`:
  moved to a single release on `session.deleted` so one loop cannot blind the
  other to a session that is still working.

## Known Risks

- The npm token was pasted in plaintext into the chat transcript on 2026-07-29
  and should be rotated.
- `GET /session/status` is queried per injection attempt. It is cheap and
  in-process, but if it ever becomes unavailable the code falls back to the
  event-derived flag rather than blocking the loop.

## Verification Observed

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — 109 files, 988 tests, all passing.
- `npm run build` — clean.
- False positives reproduced before the fix: 5,350-char prose scored 0.0043
  against the 0.02 threshold; a 9-column markdown rule matched the pattern loop.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `src/core/session/activity.ts`
3. `src/core/session/pending-injection.ts`
4. `src/utils/sanity/checker.ts`
