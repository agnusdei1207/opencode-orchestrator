# Agent Memory - OCO Session

## Current Task

User requested repeated fresh exhaustive audit passes, with commit and push after each pass. Current pass completed: 13. The broader requested target remains active beyond this session.

## Last Completed Step

Completed audit pass 13 after reopening the pass-13 files and current worktree state.

- Confirmed `main` was aligned with `origin/main` at `8f33d32` before pass 13 changes.
- Reopened `AGENT_MEMORY.md`, `AGENTS.md`, `src/utils/compatibility/claude.ts`, `src/plugin-handlers/config-handler.ts`, `tests/unit/dependency-compatibility.test.ts`, `src/index.ts`, `tests/unit/config-handler.test.ts`, `docs/SYSTEM_ARCHITECTURE.md`, `README.md`, and related system-transform/cache files.
- Checked current official OpenCode docs: plugin modules receive plugin context and return hooks; rules are OpenCode-owned through `AGENTS.md`, `opencode.json` `instructions`, and Claude Code fallback behavior.
- Removed the plugin-level Claude compatibility prompt injection from `src/plugin-handlers/config-handler.ts`.
- Deleted `src/utils/compatibility/claude.ts`; no files remain under `src/utils/compatibility`.
- Added a config-handler regression test proving generated prompts no longer embed `<claude_compatibility>` or `<project_rules>` wrappers.
- Updated `README.md` and `docs/SYSTEM_ARCHITECTURE.md` from OpenCode SDK/plugin `1.17.4` to the current package/test baseline `1.17.9`.
- Documented that project instruction files are not copied into generated agent prompts by the plugin; OpenCode owns the rules layer.

## Next Exact Step

Start audit pass 14 from current state:

1. Open `AGENT_MEMORY.md`.
2. Run `git status --branch --short`.
3. Reopen the pass-14 target files listed below.
4. Continue compatibility-shim removal from fresh owners, starting with legacy top-level concurrency config and deprecated cache/shared constants wrappers.

## Incomplete Items And Why

The full requested repeated-pass objective is not complete. Pass 13 is complete and ready to commit/push.

## Key Decisions

- Rules loading belongs to OpenCode, not to the orchestrator config hook. The config hook should register commands/agents and forward plugin options only.
- Historical release notes under `docs/release` still mention older versions and were not rewritten because they are dated records, not current baseline docs.
- Avoid `process.chdir()` in Vitest tests; it can perturb unrelated parallel test files that use process-relative paths.

## Rejected Alternatives

- Rejected keeping `findClaudeRules()` because OpenCode already documents native `AGENTS.md` and `CLAUDE.md` precedence.
- Rejected preserving plugin-side `<claude_compatibility>` prompt wrappers because they duplicate the host rules layer and add prompt hierarchy ambiguity.
- Rejected a stronger temp-directory test that changes cwd because it caused cross-file test risk.

## Known Risks

- The broader 100/1000-pass objective is intentionally not marked complete.
- Remaining compatibility/debt surfaces include legacy top-level concurrency config in `src/core/agents/concurrency-config.ts`, README/SYSTEM_ARCHITECTURE references to that legacy path, `src/core/cache/constants.ts`, `src/shared/loop/constants.ts`, `src/shared/lifecycle/shutdown-manager.ts`, `tests/unit/layering.test.ts`, and legacy comments in `src/plugin-handlers/chat-message-handler.ts`.
- The first full Vitest run in pass 13 hit a `document-cache.test.ts` timeout. A temporary `process.chdir()` test was removed, then focused document-cache tests and the full suite passed.

## Verification Observed

- Baseline focused tests passed before edits: `tests/unit/config-handler.test.ts`, `tests/unit/dependency-compatibility.test.ts`, and `tests/unit/system-transform-handler.test.ts`, 3 files and 16 tests.
- Baseline `npm run build --silent`: passed.
- `node -p` confirmed `@opencode-ai/plugin`, `@opencode-ai/sdk`, and Node engine baseline as `1.17.9`, `1.17.9`, and `>=24`.
- Focused tests after edits passed: `tests/unit/config-handler.test.ts`, `tests/unit/dependency-compatibility.test.ts`, `tests/unit/system-transform-handler.test.ts`, and `tests/unit/document-cache.test.ts`, 4 files and 29 tests.
- `npm run build --silent`: passed after edits.
- `rg -n "compatibility/claude|findClaudeRules|claude_compatibility|<project_rules|Claude Code Compatibility Mode|Loaded CLAUDE|1\\.17\\.4" src tests README.md docs/SYSTEM_ARCHITECTURE.md package.json package-lock.json -g '*.{ts,md,json}'` only matched the intentional negative assertions in `tests/unit/config-handler.test.ts`.
- `test ! -e src/utils/compatibility/claude.ts && echo deleted`: printed `deleted`.
- `find src/utils/compatibility -maxdepth 2 -type f -print`: returned no files.
- Final `npx vitest run --reporter=dot`: passed, 96 files and 808 tests.
- `cargo fmt --check`: passed.
- `cargo test -p orchestrator-cli -p orchestrator-core --quiet`: passed, CLI 12 tests and core 35 tests.
- `git diff --check`: passed.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --branch --short`
3. `src/core/agents/concurrency-config.ts`
4. `tests/unit/concurrency-config.test.ts`
5. `src/core/config/plugin-options.ts`
6. `src/index.ts`
7. `README.md`
8. `docs/SYSTEM_ARCHITECTURE.md`
9. `src/core/cache/constants.ts`
10. `src/core/cache/operations.ts`
