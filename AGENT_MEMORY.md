# Agent Memory - OCO Session

## Current Task

Completed the full 2026-06-19 audit + phased refactor. All phases resolved across patches
`1.5.2`–`1.5.4`: Phase 0/1 (version sync + Rust dead-code), Phase 4 (hygiene/CI), Phase 5
(Rust robustness), and Phase 3 (over-modularization: `src/shared` 185→53, total `src`
525→393, all exports preserved; shipped as `1.5.4`). Phases 2 and 6 were withdrawn after
direct verification proved they are intentional designs, not bugs. No phases remain open.

## Last Completed Step

1. `1.5.2`: synced Cargo workspace version to npm (`0.1.0`→`1.5.2`) + guard test; removed the
   verified-dead Rust `config` module.
2. `1.5.3`: Phase 4 hygiene (`.gitattributes` eol=lf, removed `noImplicitAny:false`, resilient
   `build.mjs` + source maps, `ci.yml` with fmt/clippy/tsc/test gates, `.gitignore` aligned,
   `cargo fmt`) and Phase 5 Rust robustness (`tools/process.rs::run_with_timeout` applied to
   ast/git/jq/http; fixed `http.rs` curl exit-status bug; Rust tests 24→35).
3. Withdrew Phase 2 (`event-handler.ts:194` already dispatches idle continuation mutually
   exclusively) and Phase 6 (`release-hardening.test.ts:92-93` locks the amend/tag-f design).
4. Verified green: `tsc`, `npm run build`, `cargo fmt --check`, `cargo clippy -D warnings`,
   `cargo test` (35), `npm test` (713). Committed and pushed `v1.5.2` and `v1.5.3`.
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
