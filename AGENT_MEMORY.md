# Agent Memory - OCO Session

Last updated: 2026-10-03 KST

## Current task

Full-codebase audit (read-only) followed by the user-approved scope "TS bug
fixes first": fix the verified High-severity TypeScript defects one commit
each, then commit, push, and cut a patch release (v2.0.10).

## Last completed step

Audit covered `src/**`, `crates/**`, tests, docs, CI. High items were
re-opened and verified before fixing. Seven TDD commits (red then green):

1. `c7f86a1` root-deletion / fork-bomb guard bypasses
   (`security-patterns.ts`, `strict-role-guard.ts`).
2. `f40e443` multi-line `/task` detection (`slash-command.ts`, dotAll flag).
3. `b9d788b` unlimited (0) concurrency keys threw on auto-scale-down
   (`concurrency.ts handleFailure`).
4. `cfb2e00` V2 event bridge ended on the first handler throw
   (`v2/event-bridge.ts dispatch`).
5. `2b06b05` unhandled rejection from the countdown timer
   (`mission-loop-handler.ts runScheduledContinuation`).
6. `9825e57` pooled tasks never left `ObjectPool.inUse` on normal delete
   (`ObjectPool.discard`, `TaskStore.removeEntry`).
7. `164162e` Rust CLI integration test looked for a non-existent
   `orchestrator-cli` binary; now uses `getBinaryPath()` and stderr for help.

`tsc --noEmit`, `npm run build`, and all 120 Vitest files / 1,053 tests
passed after the last commit.

## Next exact step

Run `npm run release:patch` (version bump, preflight, push with tag), then
confirm GitHub CI, Build & Release, and npm `latest` for 2.0.10 and record
the result here.

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
