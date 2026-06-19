# Agent Memory - OCO Session

## Current Task

Completed a full evidence-based audit (TS plugin + Rust crates), wrote a phased refactor plan
and report dated 2026-06-19, and shipped the `1.5.2` patch covering the safe subset
(Phase 0 + Rust Phase 1). Phases 2–6 are planned, not yet executed.

## Last Completed Step

1. Wrote `docs/histories/2026/06/19/PLAN_FullAuditAndStructuralRefactor_2026-06-19.md` and the
   companion `REPORT_*` file.
2. Synced the Cargo workspace version to the npm package version (`0.1.0` → `1.5.2`) and added
   a regression test in `tests/unit/package-metadata.test.ts` to guard it.
3. Removed the verified-dead Rust `config` module (`config/{mod,loader,schema}.rs`) and its
   `lib.rs` exports.
4. Bumped `package.json`/`README.md` to `1.5.2`; committed and pushed `v1.5.2`.
5. Verified green: `tsc --noEmit`, `cargo check`/`cargo test` (24), `npm test` (713).
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
