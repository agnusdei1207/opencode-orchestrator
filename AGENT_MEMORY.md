# Agent Memory - OCO Session

## Current Task

User requested exhaustive project audit/refactoring, OpenCode SDK/plugin checking 10 times, then commit and push. User then requested installing missing tools if needed, rerunning checks 10 times, and upgrading the default Node runtime to 24. Current pass completed: 40, with environment-complete verification rerun and default Node 24 upgrade finished.

## Last Completed Step

Completed audit pass 40 by deleting an unused shared recovery type compatibility file and keeping recovery constants as the only shared recovery export.

- Started from clean `main` aligned with `origin/main`.
- Reopened `AGENT_MEMORY.md`, `AGENTS.md`, `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/shared/recovery/types.ts`, `src/shared/recovery/index.ts`, `src/shared/recovery/constants.ts`, `src/core/recovery/handler.ts`, `src/core/recovery/auto-recovery.ts`, `src/core/recovery/patterns.ts`, `src/core/recovery/session-recovery.ts`, `src/core/agents/manager/task-launcher.ts`, `src/shared/index.ts`, recovery tests, and OpenCode SDK/plugin integration files.
- Confirmed `src/core/recovery/handler.ts` owns the real `ErrorContext`, `RecoveryAction`, `RecoveryRecord`, and `RecoveryStats` contracts.
- Confirmed `src/core/recovery/auto-recovery.ts` re-exports the recovery contracts consumed outside the recovery owner.
- Confirmed `src/shared/recovery/types.ts` exported a different unused string-union recovery contract and had no consumers outside its own barrel.
- Removed `export * from "./types.js";` from `src/shared/recovery/index.ts`.
- Deleted `src/shared/recovery/types.ts`.
- Pushed commit `1e76a05 refactor: remove unused shared recovery types`.
- Installed missing verification tooling: `file` via apt and Rust stable toolchain via `rustup default stable`.
- Verified Node 24 execution through `npx -p node@24`; Node 24 path was used for all post-install JavaScript checks.
- Reran the full verification bundle 10 times after environment setup; every run passed.
- Upgraded the shell default Node runtime from `/usr/bin/node` `v22.22.1` to `/usr/local/bin/node` `v24.18.0` using `n`.
- Verified the project with the default `node` now resolving to Node 24.

## Next Exact Step

Start audit pass 41 from current state:

1. Open `AGENT_MEMORY.md`.
2. Run `git status --branch --short`.
3. Reopen the pass-41 target files listed below.
4. Continue compatibility/debt removal from fresh evidence, starting with `src/shared/agent/types.ts`; determine whether its contracts are true shared domain contracts or can be moved into the owning agent modules.

## Incomplete Items And Why

The broader repeated-pass objective remains active beyond this session. Pass 40, the requested OpenCode SDK/plugin checks, the follow-up 10 full verification reruns, and the default Node 24 upgrade are complete.

## Key Decisions

- Kept recovery runtime contracts in `src/core/recovery/handler.ts` because it creates recovery records, returns recovery actions, records history, and computes recovery stats.
- Kept the internal `auto-recovery.ts` re-export path because `src/core/agents/manager/task-launcher.ts` consumes `ErrorContext` from that compatibility surface.
- Deleted `src/shared/recovery/types.ts` instead of moving it because its action shape did not match the real handler action union and no consumer used it.
- Did not change recovery behavior; this pass removed dead shared exports only.

## Rejected Alternatives

- Rejected keeping `src/shared/recovery/types.ts` as a compatibility barrel because it exposed an unused and incompatible recovery action shape.
- Rejected moving handler contracts into `src/shared/recovery/types.ts` because recovery action production and history ownership live in `core/recovery/handler.ts`.
- Rejected broad recovery behavior cleanup in the same pass because the goal was a refactor/dead-code removal with behavior unchanged.

## Known Risks

- External unpublished consumers importing `src/shared/recovery/types.ts` must stop using that internal path.
- Default shell `node`, `npm`, and `npx` now resolve to `/usr/local/bin` and report Node `v24.18.0` with npm/npx `11.16.0`.
- Remaining type candidates observed with `rg --files src | rg '/interfaces/|/types/index\\.ts$|/types/.*\\.ts$|/types\\.ts$' | sort`: `src/shared/agent/types.ts`, `src/shared/command/types.ts`, `src/shared/loop/types.ts`, `src/shared/notification/os-notify/types.ts`, `src/shared/notification/types.ts`, `src/shared/os/types.ts`, `src/shared/task/types.ts`, `src/shared/tool/types.ts`, and `src/shared/verification/types.ts`.

## Verification Observed

- Initial `npm run build --silent` failed before dependency install because `esbuild` was missing.
- Initial focused Vitest failed before dependency install because local `vitest/config` was missing.
- `npm ci` failed in postinstall under Node `v22.22.1` with `ERR_NO_TYPESCRIPT`.
- `npm ci --ignore-scripts` completed with engine warnings and 0 vulnerabilities.
- Baseline `npm run build --silent`: passed after dependency install.
- Baseline focused recovery/plugin tests passed: 5 files and 26 tests.
- Post-edit `rg -n "shared/recovery/types|\\.\\/types\\.js|RecoveryAction|RecoveryRecord|ErrorContext" src/shared src/core src/plugin-handlers tests -g '*.ts'` showed recovery contracts only in `core/recovery` and task-launcher consumers, with no deleted shared recovery type path.
- `test ! -e src/shared/recovery/types.ts && echo 'src/shared/recovery/types.ts deleted'`: printed `src/shared/recovery/types.ts deleted`.
- Post-edit focused recovery/plugin tests passed: 5 files and 26 tests.
- Post-edit `npm run build --silent`: passed.
- OpenCode SDK/plugin check loop ran 10 times; each run passed 4 files and 15 tests covering `dependency-compatibility`, `plugin-manager`, `tool-registry`, and `config-handler`.
- `git diff --check`: passed.
- Full `npx vitest run --reporter=dot`: failed with 2 files failed and 94 passed; observed 11 failed and 795 passed out of 806 tests.
- `command -v file`: no output; `file bin/orchestrator-linux-x64` failed with `file: command not found`.
- `node --version`: `v22.22.1`; `node -e "console.log(process.versions.typescript || 'no-typescript-runtime')"` printed `no-typescript-runtime`.
- `node --experimental-strip-types scripts/postinstall.ts`: failed with `ERR_NO_TYPESCRIPT`.
- `cargo fmt --check` and `cargo test -p orchestrator-cli -p orchestrator-core --quiet`: failed to start because `cargo` was not found.
- Final `npm run build --silent`: passed.
- Follow-up environment check found `cargo` and `rustup` in `/home/agent/.cargo/bin`, but no default Rust toolchain was configured.
- `sudo apt-get update && sudo apt-get install -y file`: installed `file-5.46`.
- `rustup default stable`: installed and selected `rustc 1.96.0 (ac68faa20 2026-05-25)`.
- `npx -y -p node@24 node --version`: printed `v24.18.0`.
- Tool verification after setup: Node `v24.18.0`, `file-5.46`, `cargo 1.96.0`, and `rustc 1.96.0`.
- Single environment-complete verification passed: `npm run build --silent`, full `node ./node_modules/vitest/vitest.mjs run --reporter=dot` under Node 24 with 96 files and 806 tests, `cargo fmt --check`, and `cargo test -p orchestrator-cli -p orchestrator-core --quiet` with CLI 12 tests and core 35 tests.
- Full verification loop ran 10 times after installing missing tools; each run passed `npm run build --silent`, full Vitest under Node 24 with 96 files and 806 tests, `cargo fmt --check`, and `cargo test -p orchestrator-cli -p orchestrator-core --quiet` with CLI 12 tests and core 35 tests.
- `sudo npm install -g n && sudo n 24.18.0`: installed Node `v24.18.0` to `/usr/local/bin/node` with npm `11.16.0`.
- `hash -r`, then `which node && node --version`, `which npm && npm --version`, and a fresh `bash -lc` check confirmed default Node `v24.18.0`, npm `11.16.0`, and npx `11.16.0`.
- `CI=true XDG_CONFIG_HOME="$(mktemp -d)" HOME="$(mktemp -d)" node --experimental-strip-types scripts/postinstall.ts`: passed and skipped plugin registration in CI mode.
- Default-Node-24 verification passed: `npm run build --silent`, full `node ./node_modules/vitest/vitest.mjs run --reporter=dot` with 96 files and 806 tests, `cargo fmt --check`, and `cargo test -p orchestrator-cli -p orchestrator-core --quiet` with CLI 12 tests and core 35 tests.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --branch --short`
3. `src/shared/agent/types.ts`
4. `src/shared/agent/index.ts`
5. `src/shared/agent/constants.ts`
6. `src/core/agents/manager.ts`
7. `src/core/agents/config.ts`
8. `src/agents/definitions.ts`
9. `src/shared/index.ts`
10. relevant tests found by `rg -n "Agent|AGENT_NAMES|shared/agent" tests src -g '*.ts'`
