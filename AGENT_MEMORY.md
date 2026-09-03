# Agent Memory - OCO Session

Last updated: 2026-09-03 23:25 KST

## Current Task

Post-ADR-migration session: ADR status promotion (done), PTY removal
closeout (done), stale repo binaries removed by owner decision (done),
release pipeline completion in progress.

## Last Completed Step

- ADR status audit: 0003/0005/0008/0013 promoted Accepted -> Implemented,
  0004/0006 set to Partially implemented; each Consequences section carries
  the promotion evidence; `docs/adr/README.md` index synced (18 ADRs = 18 rows).
- PTY removal closed out: source was already clean (commit 8248ce0 removed the
  one-touch `pty` command; `shell_listener.rs` 717 lines reread, zero traces).
  Remaining remnants fixed in this session:
  - `docs/SYSTEM_ARCHITECTURE.md` section 7: "manual PTY helper" step removed.
  - New `docs/adr/0018-shell-listener-pty-helper-removal.md` records the
    decision post-hoc; index updated.
- Gates re-measured 2026-09-03: vitest 115 files / 1063 tests pass (exit 0);
  docker `cargo test` exit 0 (orchestrator-cli 35 pass included).
- True-Hangul check on docs: 0 matches (unicode codepoint grep). Note: bare
  `[가-힣]` with git grep on Windows false-positives on em-dash/arrow bytes;
  use `git grep -nP "[\x{AC00}-\x{D7A3}]"`.
- Release facts from 1.7.17 (still unpublished): release:patch ran through
  docker:rust-dist + sync-artifacts (commit de09ac0 amended, tag v1.7.17
  created); `publish:token` did not land — npm latest is still 1.7.16.
  CI (release.yml) builds all five targets on tag push and overwrites bin/
  before npm publish, so npm ships tag-source builds, never the repo bin/.

## Next Exact Step

1. Commit this session (ADR promotion + PTY closeout + stale-binary removal)
   as one purpose, then `npm run release:push-tags` (pushes main + v1.7.17);
   CI then publishes npm 1.7.17; verify with
   `npm view opencode-orchestrator version`.
2. Watch the CI run; if its npm publish step fails, fall back to local
   `npm run publish:token` after the tag push.
3. Update this memory with the release outcome.

## Key Decisions

- ADR dates use git birth-commit timestamps; promotion lines carry evidence.
- Release-history docs (e.g. 2026-06-12-1.5.0-publish.md) keep their PTY
  mentions — they are point-in-time records, not living docs.
- `bin/orchestrator` (extensionless) is consumed as the non-Windows fallback
  name by `src/utils/binary.ts`; deleting it changes that fallback wiring.

## Known Risks

- Stale repo binaries still carry the removed pty command until decision A.
- CI npm publish depends on the NPM_TOKEN secret in GitHub Actions; not
  verifiable from the local clone. If CI publish fails, fall back to local
  `npm run publish:token` after the tag push.

## Files To Open First Next Session

1. AGENT_MEMORY.md
2. docs/adr/0018-shell-listener-pty-helper-removal.md
3. docs/adr/README.md
