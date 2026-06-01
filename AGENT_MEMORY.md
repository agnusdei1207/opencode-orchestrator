# Agent Memory - OCO Session

## Current Task

Fix `lsp_diagnostics` timeout recovery and diagnostics robustness, then open corrective PR.

## Last Completed Step

1. Confirmed root cause evidence: active OpenCode `lsp_diagnostics` wrapper timed out while fresh Rust JSON-RPC diagnostics succeeded.
2. Updated `src/tools/rust-pool.ts` so timed-out requests detach stdout listeners, kill/remove the poisoned process, and are not released back to the idle pool.
3. Added `tests/unit/rust-pool-timeout.test.ts` for timeout kill/removal and fresh-process recovery.
4. Updated `crates/orchestrator-core/src/tools/lsp.rs` so diagnostics commands use local executables, enforce configured timeouts, kill/wait timed-out subprocesses, and return explicit `command-failed` diagnostics for failed/unparseable TypeScript or ESLint output.
5. Added colocated Rust tests for TypeScript/ESLint command failures, timeout behavior, local executable behavior, optional no-config ESLint, and TypeScript diagnostic parsing.
6. Verification passed:
   - `npx vitest run tests/unit/rust-pool-timeout.test.ts --reporter=verbose` → 2/2 passed.
   - `npm run test:unit -- tests/unit/rust-pool-timeout.test.ts tests/unit/rust-tools-wrapper.test.ts` → 53 files / 591 tests passed.
   - `cargo test -p orchestrator-core tools::lsp -- --nocapture` → focused LSP tests passed.
   - `cargo test` → 3 CLI tests and 28 core tests passed.
   - `npm run build` → passed.
   - `npx vitest run tests/e2e/json-rpc-bridge.test.ts --reporter=verbose` → 2/2 passed.
   - Direct `target/debug/orchestrator serve` JSON-RPC `lsp_diagnostics` → clean for `src/utils/binary.ts` and `*`.

## Incomplete Items and Why

- Active in-process OpenCode `lsp_diagnostics` still returns `Request timeout`; this is documented as stale/poisoned runtime state from before the fix. Fresh rebuilt Rust JSON-RPC verifies the corrected path.
- PR delivery remains until commit/push/PR creation completes.

## Key Decisions

- Timeout recovery belongs in the TypeScript Rust process pool: a timed-out request poisons its child process and must remove/kill it.
- Diagnostics robustness belongs in Rust core: failed or timed-out TypeScript/ESLint subprocesses must return explicit error diagnostics instead of clean results.
- Use local `node_modules/.bin` executables instead of `npx -y` to avoid diagnostics-triggered installs or network delays.
- Keep ESLint optional when no ESLint config exists.

## Rejected Alternatives

- Did not keep timed-out Rust processes in the pool because stale stdout listeners and late responses can poison later calls.
- Did not rely on `npx -y` for diagnostics because it can install/hang and obscures configured command timeout behavior.
- Did not commit rebuilt binary artifacts; the LSP fix is source/test only.

## Known Risks

- Existing OpenCode runtime must be restarted/reloaded to use the rebuilt TypeScript/Rust pool fix.
- The timeout-aware Rust command loop does not stream stdout/stderr while the child runs; very large diagnostics output could still hit timeout if the child blocks on a full pipe.

## First Files to Open Next Session

1. `.opencode/todo.md`
2. `.opencode/sync-issues.md`
3. `src/tools/rust-pool.ts`
4. `tests/unit/rust-pool-timeout.test.ts`
5. `crates/orchestrator-core/src/tools/lsp.rs`
