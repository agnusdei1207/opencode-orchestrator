# Agent Memory - OCO Session

## Current Task

User requested repeated fresh exhaustive audit passes, with commit and push after each pass. Current pass completed: 14. The broader requested target remains active beyond this session.

## Last Completed Step

Completed audit pass 14 after reopening the pass-14 files and current worktree state.

- Confirmed `main` was aligned with `origin/main` at `02b28d5` before pass 14 changes.
- Reopened `AGENT_MEMORY.md`, `AGENTS.md`, `src/core/agents/concurrency-config.ts`, `tests/unit/concurrency-config.test.ts`, `src/core/config/plugin-options.ts`, `src/index.ts`, `src/plugin-handlers/config-handler.ts`, `tests/unit/config-handler.test.ts`, `README.md`, `docs/SYSTEM_ARCHITECTURE.md`, `src/core/cache/constants.ts`, `src/core/cache/operations.ts`, `src/core/cache/utils.ts`, and `src/core/cache/document-cache.ts`.
- Removed config-hook handling of top-level OpenCode concurrency keys by deleting `hasConcurrencyConfig`, `mergeConcurrencyConfig`, and the `onConcurrencyConfig` callback path.
- Kept concurrency parsing only in plugin tuple option parsing via `parseOrchestratorPluginOptions()` and `extractConcurrencyConfig()`.
- Updated config-handler tests to prove top-level OpenCode config keys are not treated as orchestrator plugin options.
- Removed README and architecture claims that legacy top-level concurrency keys are accepted.
- Migrated document-cache operations/utils directly to shared `PATHS`/`CACHE` constants and deleted the deprecated `src/core/cache/constants.ts` wrapper.

## Next Exact Step

Start audit pass 15 from current state:

1. Open `AGENT_MEMORY.md`.
2. Run `git status --branch --short`.
3. Reopen the pass-15 target files listed below.
4. Continue compatibility/debt removal from fresh owners, starting with shared loop constants, lifecycle shutdown-manager, and layering legacy debt.

## Incomplete Items And Why

The full requested repeated-pass objective is not complete. Pass 14 is complete and ready to commit/push.

## Key Decisions

- Orchestrator runtime concurrency is configured through plugin tuple options only; the OpenCode config hook is no longer a second concurrency override path.
- `extractConcurrencyConfig()` remains because it parses the scoped plugin options object.
- Cache paths and TTL constants belong to shared constants; core cache no longer owns a deprecated constants re-export module.

## Rejected Alternatives

- Rejected retaining top-level config hook concurrency support because it preserved the compatibility path the user asked to remove.
- Rejected keeping `src/core/cache/constants.ts` because its consumers could import shared constants directly.
- Rejected editing historical release notes because they are dated audit records rather than current behavior documentation.

## Known Risks

- The broader 100/1000-pass objective is intentionally not marked complete.
- Remaining compatibility/debt surfaces include `src/shared/loop/constants.ts`, `src/shared/lifecycle/shutdown-manager.ts`, `tests/unit/layering.test.ts`, and legacy comments in `src/plugin-handlers/chat-message-handler.ts`.
- `tests/unit/document-cache.test.ts` still has an internal `TEST_CACHE_DIR` constant string, but no runtime import depends on the deleted cache constants wrapper.

## Verification Observed

- Baseline focused tests passed before edits: `tests/unit/concurrency-config.test.ts`, `tests/unit/config-handler.test.ts`, and `tests/unit/concurrency.test.ts`, 3 files and 25 tests.
- Baseline `npm run build --silent`: passed.
- Focused tests after edits passed: `tests/unit/concurrency-config.test.ts`, `tests/unit/config-handler.test.ts`, `tests/unit/concurrency.test.ts`, and `tests/unit/document-cache.test.ts`, 4 files and 35 tests.
- `npm run build --silent`: passed after edits.
- `rg -n "hasConcurrencyConfig|mergeConcurrencyConfig|onConcurrencyConfig|core/cache/constants|CACHE_DIR|METADATA_FILE|legacy top-level concurrency|backward compatibility remains|backward compatibility, but the plugin tuple" src tests README.md docs/SYSTEM_ARCHITECTURE.md -g '*.{ts,md}'` only matched the document-cache test local constant.
- `test ! -e src/core/cache/constants.ts && echo deleted`: printed `deleted`.
- Final `npx vitest run --reporter=dot`: passed, 96 files and 806 tests.
- `cargo fmt --check`: passed.
- `cargo test -p orchestrator-cli -p orchestrator-core --quiet`: passed, CLI 12 tests and core 35 tests.
- `git diff --check`: passed.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --branch --short`
3. `src/shared/loop/constants.ts`
4. `src/shared/lifecycle/shutdown-manager.ts`
5. `tests/unit/layering.test.ts`
6. `src/plugin-handlers/chat-message-handler.ts`
7. `src/shared/index.ts`
8. `src/core/loop/mission-loop.ts`
9. `src/core/loop/mission-loop-handler.ts`
