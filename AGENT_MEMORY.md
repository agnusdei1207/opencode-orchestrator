# Agent Memory - OCO Session

## Current Task

Published the `1.5.0` minor release after adding the authorized shell-listener CLI, updating OpenCode SDK/plugin dependencies, refactoring clippy warnings, and completing release verification.

## Last Completed Step

1. Added `orchestrator shell-listener` as an explicit Rust CLI command.
2. Kept shell-listener outside the OpenCode JSON-RPC tool registry.
3. Updated `@opencode-ai/plugin` and `@opencode-ai/sdk` to `1.17.4`.
4. Removed Rust clippy warnings across touched CLI/core paths.
5. Ran `npm run release:minor`, which created release commit `afe616e` and tag `v1.5.0`.
6. Fixed `scripts/release-sync-artifacts.mjs` path parsing and amended the `1.5.0` release commit before publish.
7. Published `opencode-orchestrator@1.5.0` to npm with the `latest` tag.
8. Pushed `main` and `v1.5.0` to origin.

## Verification Observed

1. `npm run release:minor` preflight ran build, tests, Rust tests, audit, and package dry-run.
2. Docker Linux x64 and Linux arm64 Rust release artifact builds completed.
3. `npm publish --access public` succeeded for `opencode-orchestrator@1.5.0`.
4. `npm view opencode-orchestrator version --json` returned `1.5.0`.
5. `npm view opencode-orchestrator@1.5.0 version --json` returned `1.5.0`.
6. `git push origin main` succeeded.
7. `git push origin v1.5.0` succeeded.

## Next Exact Step

1. Rotate the previously exposed GitHub credential if it is still valid.
2. If needed, verify install from npm in a clean environment with `npm install -g opencode-orchestrator@1.5.0`.

## Incomplete Items and Why

- No incomplete release work remains for `1.5.0`.

## Key Decisions

1. Final release type is minor, published as `1.5.0`.
2. Shell-listener remains CLI-only, not LLM tool-callable.
3. Remote binds require `--allow-remote`.
4. SDK/plugin dependencies are exact-pinned to `1.17.4`.

## Rejected Alternatives

1. Publishing `1.4.1` was stopped after the user clarified minor release.
2. Re-running `release:minor` after partial failure was rejected because it would create another version bump; the existing `1.5.0` release commit was recovered instead.

## Known Risks

- A local remote URL had an embedded credential earlier in the session. Treat that credential as exposed and rotate it.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `docs/release/2026-06-12-1.5.0-publish.md`
3. `crates/orchestrator-cli/src/shell_listener.rs`
4. `scripts/release-sync-artifacts.mjs`
