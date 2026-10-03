# Agent Memory - OCO Session

Last updated: 2026-10-03 KST

## Current task

Final pass requested by the user: finish every remaining audit item, the
AGENTS.md metric refactoring and full QA, then commit, push and cut a patch
release (v2.0.13).

## Last completed step

Since v2.0.12 (`5970020`): 90 commits (45 refactor, 34 fix, 5 docs, 2 build,
2 chore, 1 ci, 1 test). Work ran in isolated git worktrees by file
ownership (Rust / TS core / TS handlers), was cherry-picked onto main, and
every worktree was removed afterwards.

- Metric refactoring: TS 43 -> 0 violations (complexity <= 10, <= 40 lines,
  depth <= 3, <= 4 params; measured with a scratch ESLint config). Rust 20 ->
  0 (clippy too_many_lines 40, cognitive_complexity 10, too_many_arguments 4).
  An independent review of all 39 refactor commits found no behavior change.
- Second-round fixes: src/core (single-flight gc, timeout re-fire guard,
  toast dedupe, recovery budget, async taskkill, bounded metrics, poller cache
  cleanup, dead code, TodoManager validation, prune timers restart after
  re-init); Rust (jq env clearing, file_stats bounds, 16 MiB capture cap,
  search truncation flags, root-relative filters, glob `*` per component,
  pinned ast-grep 0.45.3, RPC log redaction and line cap, schema drift, dead
  Rust code, shell-listener hardening, LazyLock regex, release profile, clear
  missing-diff error).
- A regression review of those fixes found 9 issues; all fixed: path filter
  excluding regular files, unread truncation flags, jq cap bypass via
  /dev/zero/FIFO, shell-listener write deadline and per-IP log cap, oversized
  request id recovery (Rust) plus a TS pre-send size guard, shutdown budget
  per handler (background manager gets termination + 2 s), abort
  confirmation deadline (30 s), all-complete summary toast, V2 agent lag note.
- Cleanup: 64 unreferenced shared constant keys and helpers, 22 unexported
  types, one shared isRecord guard instead of 15 copies, BOMs stripped,
  docs drift (option table, ADR index, completed plans removed), CI least
  privilege + timeouts + --locked, Docker non-root + .dockerignore, landing
  page SRI.

Verification on the final tree: tsc; build (incl. declarations); 124 Vitest
files / 1,108 tests; coverage 91.43 % statements, 82.08 % branches; ESLint
metrics 0; madge 0 cycles; knip 0 unused exports/types; Rust fmt, clippy
-D warnings, 44 CLI + 106 core tests (Docker, --locked); Rust metrics 0;
fresh Windows binary (Docker MinGW) passes the JSON-RPC bridge e2e and a
13-check Windows tool smoke test (CRLF sed, atomic writes, http body/proto/
HEAD, git, glob, grep, jq env isolation with jq 1.8.1, diff); native host QA
against installed OpenCode 1.18.32 with the built plugin 17/17;
`npm run release:dry-run` passed.

## Next exact step

Run `npm run release:patch` for v2.0.13, then verify CI, Build & Release,
GitHub Release assets and npm `latest`, and record the result here.

## Incomplete items and why

- `logger.ts` is a deliberate no-op (TUI corruption and overhead); logged
  catches stay silent. Changing it is a product decision.
- V2 `session.remove` and V2 prompt-hook agent attribution are verified
  against SDK types and mocks only; no OpenCode 2 host was available.
- `user-prompt/*.md` are tracked scratch prompts owned by the user; left
  untouched.
- #50 and #48 still await reporter confirmation.

## Key decisions

- Behavior-preserving refactors and fixes were kept in separate commits.
- Metrics outputs are reported, not reset: MetricsCollector keeps running
  aggregates so all-time averages stay exact.
- Cancelled tasks keep ERROR status for parent agents; only toasts differ.
- diff on Windows returns a clear "install diffutils" error rather than a
  partial reimplementation.

## Rejected alternatives

- Capping metrics arrays to a window: would change reported all-time stats.
- `[workspace.lints]` in Cargo: would add pedantic noise with no benefit.
- Enforcing `maxIterations`: the ceiling is deliberately unreachable.

## Known risks

- Model-visible tool changes: glob `*` no longer recurses (`**` needed);
  git tools error outside a repo; http rejects unknown methods and bad
  header names; lsp filters starting with `-` are rejected; jq rejects files
  over 16 MiB and non-regular files; text tools add `truncated`.
- Session recovery is active; V2 event processing can lag up to 8 s during
  rate-limit recovery.
- Background shutdown can take up to 12 s on a loaded Windows machine.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `docs/SYSTEM_ARCHITECTURE.md`
4. `src/plugin-runtime.ts`
5. `crates/orchestrator-cli/src/tools.rs`
