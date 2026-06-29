# Agent Memory - OCO Session

## Current Task

Removed Docker/Compose local build plumbing because OpenCode Orchestrator does not need repository-local Docker files for runtime, local build, or local release flow.

## Last Completed Step

1. Confirmed Docker/Compose files were release/build helpers, not plugin runtime requirements:
   - `compose.yml`
   - `Dockerfile`
   - `Dockerfile.windows`
2. Removed Docker/Compose files:
   - `compose.yml`
   - `Dockerfile`
   - `Dockerfile.windows`
3. Removed the now-unused local artifact sync helper:
   - `scripts/release-sync-artifacts.mjs`
4. Updated `package.json`:
   - removed all `docker:*` scripts
   - changed `build:all` to `npm run build`
   - removed Docker artifact rebuild and artifact sync from `release:patch|minor|major`
   - changed `release:clean` to preserve tracked `bin/` artifacts and remove only `dist`
5. Updated `tests/unit/release-hardening.test.ts`:
   - removed Docker compose expectations
   - asserted local release scripts do not call Docker
   - asserted removed Docker files are absent
   - kept GitHub Actions release workflow artifact checks intact

## Verification Observed

1. `npx vitest run tests/unit/release-hardening.test.ts tests/unit/binary.test.ts --reporter=verbose` passed:
   - 2 files passed.
   - 10 tests passed.
2. `npm run build` passed.
3. `git diff --check -- package.json tests/unit/release-hardening.test.ts compose.yml Dockerfile Dockerfile.windows scripts/release-sync-artifacts.mjs` passed.
4. `rg --files | rg -i '(^|/)(compose\\.ya?ml|dockerfile(\\..*)?)$|release-sync-artifacts' || true` produced no file results.
5. Remaining Docker mentions are generic discovery/verification text, historical release notes, or tests asserting Docker is absent; no active `package.json` or script execution path calls Docker.

## Next Exact Step

If continuing, decide whether to also update historical docs that mention prior Docker local release behavior. They are historical records, so leave them alone unless the user asks.

## Incomplete Items and Why

- Full `npm test` was not rerun after Docker removal; focused release/binary tests and build passed.
- `.github/workflows/release.yml` still builds release binaries via GitHub Actions matrix without Docker; this was intentionally left unchanged.
- Existing unrelated uncommitted SDK plumbing changes remain from the prior task:
  - `src/plugin-handlers/interfaces/index.ts`
  - `src/plugin-handlers/interfaces/tool-hook.ts`
  - `src/plugin-handlers/tool-execute-handler.ts`
  - `src/plugin-handlers/tool-execute-pre-handler.ts`
  - `tests/unit/tool-execute-handler.test.ts`
- Earlier docs/history consolidation remains in the workspace:
  - moved `docs/plans/2026-06-19/...` into `docs/histories/2026/06/19/`
  - moved `docs/plans/2026-06-21/...` into `docs/histories/2026/06/21/`
  - added `docs/histories/2026/06/24/REPORT_EbbinghausMemorySearchCurrentState_2026-06-24.md`
- `AGENTS.md` is deleted in the current worktree; it was already shown deleted during this task and was not restored.

## Key Decisions

1. Removed Docker local release/build path rather than keeping unused infrastructure files.
2. Preserved tracked `bin/` artifacts by changing `release:clean` to remove only `dist`.
3. Kept GitHub Actions release matrix because it already builds Linux/macOS/Windows artifacts without repository Docker files.
4. Left generic Docker detection prompts and historical docs unchanged because they are not active local Docker plumbing.

## Rejected Alternatives

1. Keeping `compose.yml` only for optional local cross-compilation was rejected because the user stated it is unnecessary here.
2. Removing `bin/` in `release:clean` was rejected because Docker removal leaves no local script that rebuilds all package binaries.

## Known Risks

- Local `release:patch|minor|major` no longer rebuilds Linux x64/arm64 artifacts before publishing. It publishes whatever tracked/current `bin/` artifacts are present.
- Cross-platform artifact production remains the responsibility of `.github/workflows/release.yml`.
- Worktree contains unrelated changes; inspect `git status --short` before further edits.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `package.json`
3. `tests/unit/release-hardening.test.ts`
4. `.github/workflows/release.yml`
5. `src/utils/binary.ts`
