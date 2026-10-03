# Agent Memory - OCO Session

Last updated: 2026-10-03 KST

## Current task

Third fix batch: the user asked to fix every remaining audit item, then
commit, push and cut a patch release (v2.0.12).

## Last completed step

Earlier batches: v2.0.10 (guard bypasses, multi-line /task, concurrency,
V2 event bridge, countdown rejection, task pool, Rust CLI test path) and
v2.0.11 (declined-idle notices, memory note pruning, error detection, V2
`session.remove`).

Batch 3, TS (TDD red then green unless noted):
- `eec3fcc` continuation prompt checks `response.error`.
- `c0968b0` timeout/cancel toasts (single toast, "Task Timed Out",
  "Task Cancelled"; `TASK_CANCELLED_BY_USER` constant).
- `029c566` session.deleted releases per-session state for untracked
  sessions.
- `2e48cec` one idle continuation per host idle transition.
- `02a3770` secret scanner covers sk-proj/sk-ant, github_pat_, gho_/ghu_/
  ghs_/ghr_, AKIA/ASIA, AIza, PEM private keys.
- `f448d28` background command output capped to MAX_OUTPUT_LENGTH tail.
- `45d9272` loop state written via atomicWrite (unique temp names).
- `cfc23ca` http tool `headers` is a string record.
- `f63794c` unused LIMITS constants removed; iteration comments corrected.
- `2a8f529` `<mission_loop>` tags neutralized in embedded text.
- `9461526` slash command tool uses `Object.hasOwn`.
- `f7ff2f3` refactor: unread global `missionActive`/`maxIterations`/
  `maxRetries` removed.
- `830e8f7` memory-gate redacts secrets via shared `redactSecrets`.
- `a9d8354` landing page no longer claims Ebbinghaus/RAG.
- `079a57b` `@opencode-ai/plugin`/`sdk` 1.18.34; ADR-0021 corrected.

Batch 3, Rust (done in an isolated worktree, cherry-picked, worktree
removed): `9239965` http (stdin body, `--url`, `--proto`, `--head`,
sub-second timeout, header-block parsing, unknown method error),
`e9a0a6b` lsp filter (reject `-`, glob support), `1b5d7c9` git exit status
and locale, `893342a` diff temp dirs/timeout/exit 2, `57aedcf` sed CRLF,
atomic writes, directory errors, `4c85765` shell listener continues after
operator errors, `84446bb` JSON-RPC error replies, `a47c518` Unix-only test
gating. Docs: `216fb0e`.

Verification: `tsc --noEmit`; all 122 Vitest files / 1,077 tests; madge 0
cycles; Rust fmt, clippy -D warnings, 23 CLI + 76 core tests in Docker
(agent run); native host QA against installed OpenCode 1.18.32 with the
built plugin passed 17/17 (`OCO_QA_PLUGIN=dist/index.js`,
`OCO_QA_EXECUTABLE=C:/nvm4w/nodejs/node_modules/opencode-ai/bin/opencode.exe`).

## Next exact step

Run `npm run release:patch` for v2.0.12, then verify CI, Build & Release,
GitHub Release assets and npm `latest`, and record the result here.

## Incomplete items and why

- Not done by decision: AGENTS.md metric violations (27 complexity, 13
  length, 3 depth). Pure refactors across ~40 functions carry regression
  risk with no behavior goal; propose a dedicated refactor release.
- V2 prompt hook passes `agent: ""` (V2 prompt hook has no agent field);
  only memory-note labels are affected. Could be fed from the V2 `context`
  hook's `agent`; skipped as low value.
- `logger.ts` is a deliberate no-op; design decision, unchanged.
- `rust-pool.ts` stdout buffer grows until newline but is bounded by the
  60 s request timeout; unchanged.
- V2 `session.remove` and Windows-only Rust paths (atomic rename,
  `\\?\` paths) are not exercised on a real host here.
- #50 and #48 still await reporter confirmation.

## Key decisions

- Cancelled tasks keep ERROR status for parent agents; only the toast
  distinguishes them via `TASK_CANCELLED_BY_USER`.
- `maxIterations` stays an unreachable ceiling (documented), not enforced.
- Rust work ran in a separate git worktree to avoid file overlap; owned
  files were `crates/**` and Cargo manifests only.

## Rejected alternatives

- Enforcing `maxIterations`: unreachable by design, would add dead code.
- Switching cancel to CANCELLED status: changes the parent-agent contract
  and many consumers for a display issue.

## Known risks

- Rust behavior changes visible to models: git tools error outside a
  repository, `diff` errors on missing files, `http` rejects unknown
  methods and invalid header names, `lsp_diagnostics` rejects filters
  starting with `-`, `sed_replace` directory mode reports `errors` and
  `timed_out`.
- Session recovery now runs (since v2.0.11); V2 event processing can lag
  up to 8 s during rate-limit recovery.
- Local `bin/orchestrator-windows-x64.exe` is stale (1.7.27, gitignored).

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `docs/SYSTEM_ARCHITECTURE.md`
4. `crates/orchestrator-core/src/tools/http.rs`
5. `src/plugin-handlers/event-handler.ts`
