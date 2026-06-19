# Full Audit and Structural Refactor — Execution Report

Date: 2026-06-19
Scope: `opencode-orchestrator`
Companion plan: `PLAN_FullAuditAndStructuralRefactor_2026-06-19.md`
Status: Phases 0, 1, 4, 5 shipped; Phases 2 and 6 resolved by verification (no change
needed); Phase 3 staged as follow-up.

## 1. What This Session Did

1. Ran a complete, evidence-based audit of the repository (TypeScript plugin + Rust crates).
2. Wrote the phased refactor plan (companion document).
3. Executed and verified the safe, high-value phases.
4. Used direct verification to refute three audit claims, including two whole phases.
5. Cut the `1.5.2` patch (Phase 0 + Rust Phase 1) and then the `1.5.3` patch (Phases 4–5).

## 2. Audit Outcome (Headline Numbers)

| Area | Finding |
| --- | --- |
| Fragmentation | 525 TS files / 25,477 LOC; 267 files (51%) < 20 lines; 117 barrel `index.ts` (22%) |
| Dead code (Rust) | `orchestrator-core::config` (~532 LOC) re-exported but consumed by nothing |
| Hygiene | npm `1.5.1` vs Cargo `0.1.0`; `bin/` tracked against `.gitignore`; no lint gate |
| Type safety | `strict: true` but `noImplicitAny: false`; 254 `as` casts |
| Rust robustness | `http.rs` never checked curl exit status; `ast`/`git` had no subprocess timeout |

## 3. Claims Refuted by Direct Verification

The audit summaries were treated as leads, not facts. Three were wrong:

1. **"`edition = \"2024\"` is invalid."** False. Rust 2024 stabilized in 1.85; local
   `cargo 1.94.1` accepts it. No change.
2. **"Remove the destructive `git commit --amend` + `git tag -f` (Phase 6)."** Rejected.
   `tests/unit/release-hardening.test.ts:92-93` *asserts* this exact behavior — it is an
   intentional, test-locked design (amend the release commit to embed freshly Docker-built
   Linux binaries, then move the tag to the final commit). The local artifact whitelist
   (Linux x64/arm64 only) also correctly matches what `docker:rust-dist` produces. No change.
3. **"Unify the two continuation subsystems (Phase 2)."** Rejected. `event-handler.ts:194`
   dispatches idle continuation **mutually exclusively**: `if (isLoopActive(...))` runs only
   `MissionLoopHandler.handleMissionIdle` and returns; otherwise only
   `TodoContinuation.handleSessionIdle` runs. There is no double-injection. The paired
   `handleUserMessage`/`handleAbort`/`cleanupSession` calls are idempotent cancel/cleanup on
   whichever module holds session state. The split (file-backed mission loop vs in-memory
   todo continuation) is intentional. No change.

`src/shared` was also confirmed to be a definitions layer, not duplicated logic; the real
issue is fragmentation (Phase 3), not duplication.

## 4. Changes Shipped

### Patch `1.5.2` — Phase 0 + Rust Phase 1

1. Synced the Cargo workspace version to the npm package version (`0.1.0` → `1.5.2`).
2. Removed the verified-dead Rust `config` module (`config/{mod,loader,schema}.rs`) and its
   `lib.rs` exports.
3. Added a regression test asserting Cargo workspace version == npm package version.

### Patch `1.5.3` — Phase 4 (hygiene) + Phase 5 (Rust robustness)

Phase 4 — repository, build, and type hygiene:

1. Added `.gitattributes` (`* text=auto eol=lf`, binaries marked `binary`) to end the
   whole-tree CRLF↔LF churn on Windows/WSL checkouts.
2. Removed `noImplicitAny: false` from `tsconfig.json`; `tsc --noEmit` stays green, so the
   `strict` hole is closed at no cost.
3. Hardened `scripts/build.mjs`: resolve the TypeScript compiler via `require.resolve`
   instead of a hardcoded `node_modules` path, and emit source maps (`sourcemap: true`).
4. Bumped `actions/checkout@v4` → `@v6` in `deploy-pages.yml` to match `release.yml`.
5. Added `.github/workflows/ci.yml` enforcing `tsc --noEmit`, `npm test`,
   `cargo fmt --check`, `cargo clippy -D warnings`, and `cargo test` on push/PR.
6. Aligned `.gitignore` with reality: `bin/` and `package-lock.json` are tracked on purpose
   (npm tarball payload and `npm ci`), so they no longer appear as ignored.
7. Ran `cargo fmt` across the workspace (import ordering in 5 files).

Phase 5 — Rust subprocess robustness and coverage:

1. Added `tools/process.rs::run_with_timeout`, a shared helper that pipes stdin, drains
   stdout/stderr on threads (no pipe deadlock), and kills + reaps any child that exceeds a
   hard deadline.
2. Routed `ast` (`npx`), `git` (6 call sites), `jq`, and `http` (`curl`) through it so no
   tool subprocess can hang indefinitely.
3. Fixed a real `http.rs` bug: curl's exit status was never checked, so transport failures
   (DNS/refused/TLS) returned a fake `200`-shaped success with `status_code = 0`. It now
   errors on non-zero curl exit and parses the final redirect block's status robustly,
   erroring on a missing/unparseable status line.
4. Added 11 unit tests (`process`, `jq`, `http` parser), raising Rust tests 24 → 35.

## 5. Verification (all green)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (source map emitted) |
| `cargo fmt --check` | clean |
| `cargo clippy --workspace --all-targets -- -D warnings` | exit 0 |
| `cargo test --workspace` | 35 passed, 0 failed |
| `npm test` | 75 files / 713 tests passed |

## 6. Environment Note

This `/mnt/c` (WSL) checkout shows ~674 files as modified purely from CRLF↔LF differences
(`--ignore-all-space` diff is empty). These were never committed: each touched file is
normalized to LF on `git add` (now backed by the new `.gitattributes`), so every release
commit contains only logical changes.

## 7. Release Status

1. `1.5.2` committed, tagged `v1.5.2`, pushed.
2. `1.5.3` committed, tagged `v1.5.3`, pushed.
3. `npm publish` was **not** performed: the environment has no npm authentication
   (`npm whoami` → `ENEEDAUTH`). The pushed state is ready for the final publish via
   `npm run release:patch` (or `npm run publish:token`) from an authenticated environment
   with Docker for the Rust artifact rebuild.

## 8. Phase 3 — Over-modularization Consolidation (shipped as `1.5.4`)

Executed the full `src/shared` consolidation. Every domain that used the
`constants/`+`interfaces/`+`types/` (and deeper `os-notify/*`, `tool/constants/{common,lsp,
parallel}`) split was flattened to at most `constants.ts` + `types.ts` + `index.ts`, with all
export names preserved so the 138 top-barrel consumers were untouched. The few direct
deep-importers were repointed to domain barrels.

Method: large/sensitive bodies (prompt strings, event tables) were merged by byte-preserving
concatenation (strip import lines, re-add fixed-path imports) rather than retyping, so prompt
output stays identical.

Results:

| Metric | Before | After |
| --- | --- | --- |
| `src/shared` files | 185 | 53 |
| total `src` files | 525 | 393 |

Domains flattened: agent, cache, message, os, prompt, session, command, errors, core,
recovery, loop, task, verification, notification (incl. `os-notify` + `presets`), tool. Also
removed verified-dead `shared/task/base-task.ts`.

One merge-induced regression was caught by the test suite and fixed: collapsing leaf files
created a `core ↔ tool` circular import (core needed `TOOL_NAMES`; tool needed
`STATUS_LABEL`). Resolved by keeping `TOOL_NAMES` in a zero-dependency `tool/tool-names.ts`
leaf so neither consolidated module imports the other at evaluation time.

Verification: `tsc --noEmit` 0, `npm run build` 0, `cargo fmt --check`/`clippy -D warnings` 0,
`cargo test` 35, `npm test` 75 files / 713 tests.

## 9. Phase Status Summary

| Phase | Status |
| --- | --- |
| 0 — Baseline + version sync | Done (`1.5.2`) |
| 1 — Dead code removal (Rust `config`) | Done (`1.5.2`) |
| 2 — Continuation unify | Withdrawn (intentional mutually-exclusive design) |
| 3 — Over-modularization consolidation | Done (`1.5.4`) |
| 4 — Repository/build/type hygiene | Done (`1.5.3`) |
| 5 — Rust subprocess robustness | Done (`1.5.3`) |
| 6 — Release pipeline | Withdrawn (intentional, test-locked design) |

No phases remain open.
