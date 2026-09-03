# Agent Memory - OCO Session

Last updated: 2026-09-03 23:55 KST

## Current Task

None active. ADR/PTY closeout session finished end-to-end; release 1.7.17
completed and verified.

## Last Completed Step

- ADR status audit + promotion: 0003/0005/0008/0013 Accepted -> Implemented,
  0004/0006 -> Partially implemented, with promotion evidence in each
  Consequences section; README index synced (commit 612d17f).
- PTY removal closed out (commit 94e8d88): decision recorded as ADR-0018,
  SYSTEM_ARCHITECTURE section 7 re-aligned, four stale pre-8248ce0 binaries
  removed from bin/ by owner decision (repo bin/ now tracks only the Linux
  pair the release pipeline refreshes; `tests/unit/binary.test.ts` 5/5 pass
  re-measured after removal).
- Release 1.7.17 completed: commits 612d17f + 94e8d88 pushed with the
  pending de09ac0/tag via `release:push-tags`; Build & Release workflow
  succeeded and npm `latest` verified as 1.7.17 via `npm view`; main CI
  branch run also succeeded.

## Release Facts (1.7.17)

- npm: `opencode-orchestrator@1.7.17` latest (verified 2026-09-03 23:53 KST).
- CI built all five platform targets from the tag source; repo bin/ carries
  only orchestrator-linux-x64/arm64 by design.
- Gates before release: vitest 115 files / 1063 tests pass (exit 0), docker
  `cargo test` exit 0.

## Next Exact Step

Nothing pending. Next session: open AGENT_MEMORY.md, then proceed with
whatever new task the owner requests.

## Key Decisions

- ADR dates use git birth-commit timestamps; promotion lines carry evidence.
- Release-history docs keep their PTY mentions — point-in-time records.
- Stale binary removal accepted the loss of the repo-checkout extensionless
  fallback (`binary.ts` still defines the fallback name; macOS/Windows repo
  checkouts rebuild locally via docker targets).
- `git rm`-staged deletions ride along with the next commit unless unstaged;
  caught and split the commit via `git reset --soft` + `git restore --staged`.

## Known Risks

- None open.

## Files To Open First Next Session

1. AGENT_MEMORY.md
2. docs/adr/README.md (decision index)
