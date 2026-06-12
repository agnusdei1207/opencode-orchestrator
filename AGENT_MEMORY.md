# Agent Memory - OCO Session

## Current Task

Prepare and push the `1.4.1` patch release after adding the authorized shell-listener CLI, updating OpenCode SDK/plugin dependencies, refactoring clippy warnings, and completing five-pass release review.

## Last Completed Step

1. Added `orchestrator shell-listener` as an explicit Rust CLI command.
2. Kept shell-listener outside the OpenCode JSON-RPC tool registry.
3. Updated `@opencode-ai/plugin` and `@opencode-ai/sdk` to `1.17.4`.
4. Bumped package metadata to `1.4.1`.
5. Removed Rust clippy warnings across touched CLI/core paths.
6. Added release audit notes at `docs/release/2026-06-12-1.4.1-audit.md`.

## Verification Observed

1. `npx tsc --noEmit` -> success.
2. `cargo clippy --workspace --all-targets -- -D warnings` -> success.
3. `cargo test --workspace --all-targets` -> success, 41 Rust tests passed.
4. `npm run build` -> success.
5. `npm test` -> success, 713 Vitest tests passed.
6. `git diff --check` -> success.
7. `npm run release:dry-run` -> success for `opencode-orchestrator@1.4.1`.

## Next Exact Step

1. If continuing release operations, run the real publish flow only with confirmed npm credentials and an intentional publish window.
2. Rotate any exposed GitHub credential and prefer a credential manager instead of embedding credentials in the remote URL.

## Incomplete Items and Why

- npm publish was not run; only dry-run release validation was executed in this session before commit/push.

## Key Decisions

1. Shell-listener remains CLI-only, not LLM tool-callable.
2. Remote binds require `--allow-remote`.
3. `1.4.1` is the patch release target after the prepared `1.4.0` minor integration.
4. SDK/plugin dependencies are exact-pinned to `1.17.4`.

## Rejected Alternatives

1. Registering shell-listener as an OpenCode tool was rejected because interactive network sessions should not be model-callable through JSON-RPC.
2. Running `release:minor` or `release:patch` directly was rejected during validation because those scripts include publish behavior.

## Known Risks

- A local remote URL had an embedded credential during the session. Treat that credential as exposed and rotate it.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `docs/release/2026-06-12-1.4.1-audit.md`
3. `crates/orchestrator-cli/src/shell_listener.rs`
4. `package.json`
