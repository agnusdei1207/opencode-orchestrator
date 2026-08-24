# Agent Memory - OCO Session

## Current Task

Completed the full audit and release requested on 2026-08-24: verified all open
issues against OpenCode's official SDK/plugin documentation and `../opencode`,
fixed every remaining gap, submitted the HOL catalog PR, released v1.7.14, and
closed issues #35-#38 with evidence.

## Last Completed Step

- Published GitHub Release and npm package `opencode-orchestrator@1.7.14`.
- Closed #35, #36, #37, and #38 as completed after posting resolution details.
- Confirmed main CI, release workflow, and Pages deployment all succeeded.

## Next Exact Step

Monitor `hashgraph-online/awesome-ai-plugins#142` for maintainer feedback or
merge; no source-repository work remains for the current request.

## Incomplete Items and Why

- The external catalog PR is open pending review by the
  `hashgraph-online/awesome-ai-plugins` maintainers. Its contribution gate
  passed. The centralized scanner reported advisory findings, explicitly marked
  non-blocking by the catalog bot.

## Key Decisions

- Treat SDK structured error responses from `session.status()` as unavailable,
  preserving the last event-derived busy flag instead of interpreting the
  response wrapper as an empty status map.
- Build resumed-agent routing first, then perform the authoritative busy check
  immediately before the session write. This closes the idle-to-busy race while
  custom agent files are loading.
- Mark resumed-session instructions synthetic because they are orchestrator
  messages written into an existing visible session, unlike a new subagent's
  opening instruction.
- Clear activity and deferred prompts on every `session.deleted` event, even for
  sessions absent from the plugin's tracked-session map.
- Remove the prompt-only `<150 lines` limit from `.opencode/context.md`; there
  was no runtime limit.
- Update only the vulnerable transitive lockfile resolutions (`postcss` 8.5.26,
  `nanoid` 3.3.18) after the first release preflight exposed two high advisories.
- Submit exactly one alphabetical README entry to the HOL catalog.

## Rejected Alternatives

- Trusting the original v1.7.11-v1.7.13 fixes without tracing every
  `session.prompt` path: the audit found missed resume and deletion paths.
- Checking busy only before prompt routing: async custom-agent loading creates a
  race in which the session can start work before the write.
- Adding scanner CI during the HOL submission: the requester explicitly required
  a one-entry README-only PR, and the catalog states scanner CI is optional.
- Publishing locally: npm authentication was unavailable locally, while the
  repository's tag workflow had the configured secret and published successfully.

## Known Risks

- HOL PR #142 still requires external maintainer review/merge.
- HOL's centralized scan returned advisory findings without details in the PR
  check; the catalog gate and bot explicitly say this does not block listing.
- `GET /session/status` remains a per-injection check. On endpoint failure the
  implementation intentionally falls back to push-event state.

## Verification Observed

- Release preflight: build passed; 112 TypeScript test files / 1,008 tests passed;
  47 Rust tests passed; npm audit reported 0 vulnerabilities; npm pack dry-run
  produced the expected v1.7.14 package.
- Remote CI: TypeScript and Rust jobs succeeded.
- Release workflow: five platform builds, GitHub Release, GitHub Packages, and
  npm publication succeeded.
- GitHub Release v1.7.14 has five binary assets; npm registry reports 1.7.14.
- External PR #142 changes one file with one addition and passed the contribution
  gate.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `src/core/agents/manager/task-resumer.ts`
3. `src/core/session/activity.ts`
4. `src/plugin-handlers/event-handler.ts`
5. `tests/unit/task-resumer.test.ts`
