# Agent Memory - OCO Session

## Current Task

Mission complete: PR #29 updated with LSP diagnostics timeout recovery and RustToolPool concurrency hardening.

## Last Completed Step

Final Reviewer pass verified the latest RustToolPool timeout/concurrency hardening, updated shared verification metadata, and approved committing/pushing the latest changes to PR #29.

## Completed Work

- Fixed `src/tools/rust-pool.ts` so timed-out requests detach stdout listeners, kill/remove poisoned Rust processes, and prevent destroyed processes from being released back to the pool.
- Added `tests/unit/rust-pool-timeout.test.ts` covering timeout kill/removal, fresh-process recovery after timeout, and normal successful process reuse.
- Hardened `crates/orchestrator-core/src/tools/lsp.rs` so diagnostics use local project binaries, enforce command-level timeouts, skip optional ESLint when no config exists, and report failed/non-JSON TypeScript or ESLint command output as error diagnostics instead of misleading clean results.
- Earlier commits include `b5bdc9d fix: recover rust tool pool after diagnostics timeout`, follow-up session memory commits, and the latest PR update commit for pool concurrency hardening.
- `.opencode/todo.md` is 22/22 complete and `.opencode/sync-issues.md` has no unresolved sync issues.
- Unit review sync gap for the preserved ses_3 Rust pool timeout record was resolved by updating the record/work-log to the current 5-test evidence.
- Refactored pool acquisition so waiters create a fresh process when timeout removal opens capacity below `maxSize`.
- Added a concurrent waiter regression test that starts while the only process is busy, waits through timeout removal, and resolves via a fresh process.
- Reserved newly spawned Rust processes by pushing them into the pool as busy until the spawning caller finishes `sendRequest()` and `release()` marks them idle.
- Added a deterministic fake-timer regression test proving a second concurrent call cannot write to a newly spawned process during `processReadyDelayMs`, then may reuse it after the first request releases it.

## Verification Evidence

- `npm run build` passed.
- `npx vitest run tests/unit/rust-pool-timeout.test.ts --reporter=verbose` passed 5 tests in the final Reviewer pass.
- `cargo test -p orchestrator-core lsp` passed 8 tests in the latest Reviewer recheck.
- `cargo test -p orchestrator-core` passed 29 tests plus doc-tests in the latest Reviewer recheck.
- Earlier full `cargo test` passed orchestrator-cli 3 tests and orchestrator-core 28 tests before the additional LSP missing-local-binary test was added.
- `npm run test:unit` passed 53 files / 593 tests after the timeout/concurrency regressions were added.
- `npx vitest run tests/e2e/json-rpc-bridge.test.ts --reporter=verbose` passed 1 file / 2 tests.
- `npm test` passed 61 files / 652 tests.
- Fresh direct `./bin/orchestrator-linux-x64 serve` JSON-RPC `lsp_diagnostics` for `file:"*"` returned clean.
- Final Reviewer evidence: `lsp_diagnostics({file:"*"})` still returned documented stale `Request timeout`; `npx vitest run tests/unit/rust-pool-timeout.test.ts --reporter=verbose` passed 1 file / 5 tests; `npm run build` passed; `cargo test -p orchestrator-core` passed 29 tests plus doc-tests; `npm test` passed 61 files / 652 tests; `git status --short --branch` initially showed only `AGENT_MEMORY.md`, `src/tools/rust-pool.ts`, and `tests/unit/rust-pool-timeout.test.ts` as tracked modifications before shared metadata updates.

## Incomplete Items and Why

None for the requested source/test update. Runtime caveat: the active in-session OpenCode `lsp_diagnostics` wrapper continued returning `Request timeout`, consistent with a stale/poisoned already-running plugin pool that predates the fix. Fresh local JSON-RPC verified the fixed path.

## Key Decisions

- Pushed to `fork` remote and updated existing PR #29.
- Kept source/test corrective changes separate from session memory.
- Did not commit rebuilt binary artifacts.

## Known Risks

- Reviewers should restart OpenCode/plugin process before testing the wrapper tool in-session to clear any pre-fix poisoned pool.

## First Files to Open Next Session

1. `.opencode/todo.md`
2. `.opencode/sync-issues.md`
3. `src/tools/rust-pool.ts`
4. `crates/orchestrator-core/src/tools/lsp.rs`
5. `tests/unit/rust-pool-timeout.test.ts`
