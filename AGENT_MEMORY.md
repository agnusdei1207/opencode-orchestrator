# Agent Memory - OCO Session

Last updated: 2026-10-03 KST

## Current task

Full-codebase audit (read-only) followed by the user-approved scope "TS bug
fixes first": fix the verified High-severity TypeScript defects one commit
each, then commit, push, and cut a patch release (v2.0.10).

## Last completed step

Audit covered `src/**`, `crates/**`, tests, docs, CI. High items were
re-opened and verified before fixing. Seven TDD commits (red then green):

1. `5c10197` root-deletion / fork-bomb guard bypasses
   (`security-patterns.ts`, `strict-role-guard.ts`).
2. `813cf52` multi-line `/task` detection (`slash-command.ts`, dotAll flag).
3. `c4b5d6e` unlimited (0) concurrency keys threw on auto-scale-down
   (`concurrency.ts handleFailure`).
4. `c0e6060` V2 event bridge ended on the first handler throw
   (`v2/event-bridge.ts dispatch`).
5. `52c142b` unhandled rejection from the countdown timer
   (`mission-loop-handler.ts runScheduledContinuation`).
6. `eecda63` pooled tasks never left `ObjectPool.inUse` on normal delete
   (`ObjectPool.discard`, `TaskStore.removeEntry`).
7. `7c320d8` Rust CLI integration test looked for a non-existent
   `orchestrator-cli` binary; now uses `getBinaryPath()` and stderr for help.

`tsc --noEmit`, `npm run build`, and all 120 Vitest files / 1,053 tests
passed after the last commit.

Released v2.0.10 via `npm run release:patch` (version commit `50cfa55`, tag
`v2.0.10`). Preflight passed. GitHub CI run 37109170711, Build & Release run
37109170390 and Pages deploy succeeded; the GitHub Release has five platform
binaries. The public npm registry reports `opencode-orchestrator@2.0.10` as
`latest`, with tarball metadata present.

## Next exact step

Pick the next audit batch from "Incomplete items" below. Recommended order:
Rust `http.rs` exfiltration fix (needs a Rust toolchain or CI-only
verification), then the Medium TS items.

## Incomplete items and why

- Audit findings not fixed (user chose TS bug fixes first). Highest
  remaining: Rust `http` tool `-d @file` local-file exfiltration and missing
  `--`/`--proto` (`crates/orchestrator-core/src/tools/http.rs:113-117`),
  `-X HEAD` timeouts, eslint argument injection (`lsp.rs:204`), git exit
  status ignored, `diff` temp-file race, `sed_replace` CRLF loss,
  `shell_listener` exits on operator typo (`:352`). Rust needs a toolchain;
  none is installed on this machine.
- Medium TS items: V2 `agent: ""` and empty intercepted prompts
  (`v2/setup.ts:87-95`), untracked-session cleanup on delete
  (`event-handler.ts:121`), duplicate idle timers, unchecked
  `session.prompt` error (`mission-loop-handler.ts:174`), unbounded buffers
  (`commands/manager.ts:99`, `rust-pool.ts`), TIMEOUT shown as completed in
  toasts, non-atomic state writes, landing page still advertising retired
  RAG/Ebbinghaus features (`public/index.html:13-14`).
- `src/core/agents/logger.ts` is a deliberate no-op, so logged catches are
  silent in production; changing it is a design decision, not done.
- #50 and #48 still await reporter confirmation (see git history of this
  file for their details).

## Key decisions

- Deleted tasks are `discard`ed from pool tracking, not `release`d, because
  notifications and toasts may still hold the object; only `gc()` recycles.
- Unlimited concurrency keys are excluded from auto-scale-down.

## Rejected alternatives

- Audit item "V2 drops the V1 sub-agent tool restriction": rejected after
  reading upstream `packages/opencode/src/session/prompt.ts:1061`. V1
  `tools` entries only become `allow` rules, so V1 never denied
  `delegate_task` to sub-agents; role separation is prompt-based by design.
- Releasing tasks to the pool on every delete: would reset objects still
  referenced by async continuations.

## Known risks

- The new root-deletion regex blocks `rm ... /` and `/*` with any flags
  only when the target ends the command or precedes `;`, `&`, `|`. It is a
  safety net, not a sandbox; `rm -rf foo /` and quoting tricks still pass.
- Local `bin/orchestrator-windows-x64.exe` reports 1.7.27 (stale, gitignored);
  release binaries are rebuilt in CI.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `crates/orchestrator-core/src/tools/http.rs`
4. `src/v2/setup.ts`
5. `src/plugin-handlers/event-handler.ts`
6. `src/core/loop/mission-loop-handler.ts`
