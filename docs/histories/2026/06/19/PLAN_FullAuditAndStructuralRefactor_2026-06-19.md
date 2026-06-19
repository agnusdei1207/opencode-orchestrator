# Full Audit and Structural Refactor Plan

Date: 2026-06-19
Scope: `opencode-orchestrator` (TypeScript plugin + Rust tool crates)
Status: In progress
Author: orchestrator maintenance pass

## 1. Objective

Bring the repository to a smaller, flatter, more verifiable baseline without changing
runtime behavior. The investigation that backs this plan found a healthy core idea
buried under three structural problems:

1. extreme file-level fragmentation in the TypeScript source
2. two parallel session-continuation subsystems that both run on every event
3. repository and build hygiene drift (committed binaries, version mismatch, no lint gate)

This plan targets five outcomes:

1. fewer files and shallower import paths with identical exported behavior
2. one continuation control plane instead of two competing ones
3. removal of verified dead code in both Rust and TypeScript
4. consistent build/version/lint hygiene with drift caught by tests
5. an evidence-backed patch release that ships the safe subset first

## 2. Investigation Method

This plan is evidence-based per `AGENTS.md`. The following were executed against the
working tree on 2026-06-19:

1. file and line censuses (`find`, `wc`, per-directory counts)
2. four parallel read-only audits: over-modularization, core runtime quality,
   Rust crates, and build/test/CI tooling
3. direct verification of every load-bearing claim before it entered this plan
   (see Section 4 for claims that were corrected after verification)
4. green-baseline capture: `npx tsc --noEmit`, `cargo check --workspace` before any edit

Toolchain confirmed present: `cargo 1.94.1`, local `typescript`/`tsc`, Node `>=24`.

## 3. Verified Starting Facts

### 3.1 Repository shape

| Metric | Value | Source |
| --- | --- | --- |
| TypeScript source files | 525 | `find src -name '*.ts'` |
| TypeScript source LOC | 25,477 | `wc -l` |
| Average lines per file | ~48 | derived |
| Files < 10 lines | 147 (28%) | `find` + `wc` |
| Files < 20 lines | 267 (51%) | audit |
| Single-export non-index files | ~287 (54%) | audit |
| Barrel `index.ts` files | 117–118 (22%) | `find src -name index.ts` |
| Prompt `.ts` string modules | 95 | `find src/agents/prompts` |
| `as` casts | 254 | `grep` |
| `as unknown` escape casts | 4 | audit |
| `TODO`/`FIXME`/`HACK` markers | 203 | `grep` |
| Rust LOC | 5,202 | `wc -l` |
| Rust test functions | 24 | audit |
| Committed binaries in `bin/` | 6 (~29 MB) | `git ls-files bin/` |
| `.git` directory size | 57 MB | `du -sh .git` |

### 3.2 Configuration and version state

1. `tsconfig.json` sets `"strict": true` but also `"noImplicitAny": false`, which
   re-opens the exact hole `strict` is meant to close.
2. `package.json` version is `1.5.1`; the Cargo workspace version is `0.1.0`. Rust
   binaries therefore report `0.1.0` while the npm package is `1.5.1`. No release
   script bumps the Cargo version.
3. `.gitignore` lists `bin/`, `dist/`, and `package-lock.json`, yet `bin/` (6 binaries)
   and `package-lock.json` are both tracked. `.gitignore` only affects untracked paths,
   so these were force-added earlier and now bloat history.
4. No ESLint, Prettier, `.editorconfig`, `rustfmt.toml`, or `clippy.toml` exists, and no
   `lint`/`format` npm script exists. Style is enforced socially only.

### 3.3 Runtime structure

1. `src/index.ts` wires the plugin: tools registry, six OpenCode hooks, shutdown manager.
2. Session continuation is handled by **two** modules that are both invoked on the same
   events from `src/plugin-handlers/event-handler.ts`:
   - `src/core/loop/todo-continuation.ts` (410 lines)
   - `src/core/loop/mission-loop-handler.ts` (337 lines)
   Verified call sites in `event-handler.ts`: `cleanupSession` (62–63),
   `handleUserMessage` (128–129), `handleAbort` (179–180), and both idle handlers
   (196, 206). Each carries its own `sessionStates` map.
3. At least 8 module-level `Map`s track per-session state independently across
   `circuit-breaker.ts`, `compaction-guard.ts`, `progress-tracker.ts`,
   `todo-continuation.ts`, `session-recovery.ts`, `recovery/handler.ts`, `session/store.ts`,
   and `context-window-monitor.ts`, with no shared lifecycle.

### 3.4 Rust crates

1. Clean lib/CLI separation; `thiserror` + `anyhow`; 0 explicit `panic!`.
2. `orchestrator-core::config` (mod.rs + loader.rs + schema.rs, ~532 LOC) is re-exported
   from `lib.rs` but consumed by nothing. Verified: the CLI imports only
   `orchestrator_core::hooks::Hook`; no `OrchestratorConfig` usage anywhere in the CLI,
   and no internal core consumer outside the module itself.
3. `orchestrator-core::hooks` (~215 LOC) is used only for the `Hook` enum's `description()`
   / `all()` in CLI list output; the registry type is never instantiated in production.
4. Subprocess tools `ast`, `git`, and the `tsc`/`eslint` paths in `lsp` do not enforce a
   hard timeout on the child process. `http.rs` and `git.rs` parse subprocess output with
   `unwrap_or(0)` fallbacks that can mask malformed output.
5. `http.rs` and `jq.rs` have zero unit tests.

### 3.5 Build, release, CI

1. `scripts/build.mjs` uses esbuild (ESM, node) plus a declaration-only `tsc` pass; it
   hardcodes the local `node_modules/typescript/bin/tsc` path and emits no source maps.
2. The release chain (`release:patch|minor|major`) sequences six scripts including a Docker
   Rust rebuild and a `git commit --amend` + `git tag -f` in `release-sync-artifacts.mjs`.
   The amend+force-tag is destructive if re-run.
3. `release-sync-artifacts.mjs` whitelists only the two Linux binaries even though CI and
   `bin/` also carry macOS and Windows artifacts.
4. `.github/workflows/deploy-pages.yml` uses older action majors than `release.yml`.
5. e2e tests use fixed real sleeps (`setTimeout(..., 500)`, `sleep 10`) and spawn real Rust
   binaries; there is no per-suite timeout or retry config in `vitest.config.ts`.

## 4. Claims Corrected During Verification

To keep this plan honest, two audit claims were rejected after direct checks:

1. **"`edition = \"2024\"` is invalid."** False. Rust 2024 stabilized in 1.85; the local
   toolchain is `cargo 1.94.1` and `cargo check` accepts the edition. No change needed.
2. **"`src/shared` duplicates `src/core` code."** Imprecise. `src/shared` is a pure
   definitions layer (types/constants/interfaces); the problem is *fragmentation and
   barrel depth*, not copied logic. The fix is consolidation, not deduplication.

## 5. Problem Statement

1. **Fragmentation tax.** 51% of files are under 20 lines and 22% are re-export barrels.
   Reading any feature requires 4–10 import hops through tiny files. This raises cognitive
   load, slows navigation, and inflates the dependency graph without buying modularity.
2. **Dual continuation control plane.** Two subsystems independently track session state
   and can both schedule or cancel continuation for the same session, creating
   double-processing and ordering races (Section 3.3).
3. **Dead and untested code.** ~532 LOC of unused Rust config, an uninstantiated Rust hook
   registry, and unverified TS exports add weight and risk.
4. **Hygiene drift.** Version mismatch, committed binaries against an ignore rule, and the
   absence of any lint/format gate let regressions land silently.

## 6. Design Principles

1. Behavior is frozen during structural change. Public exports keep the same names and
   types; only their file locations collapse.
2. Every phase ends green: `npx tsc --noEmit`, `cargo check`/`cargo test`, and `npm test`.
3. Delete only what is verified unreferenced, and delete it fully (no dead stubs).
4. Prefer a drift-catching test over a comment or a convention.
5. Ship the safe subset first; stage the high-blast-radius work behind its own phase.

## 7. Phased Plan

Phases are ordered by ascending blast radius. Each phase is independently shippable and
independently revertible.

### Phase 0 — Baseline and Guardrails (safe, ship first)

Goal: lock a green baseline and fix zero-risk hygiene that the release itself needs.

Tasks:
1. Capture green `tsc --noEmit`, `cargo check --workspace`, and `npm test` output.
2. Sync the Cargo workspace version to the npm package version so binaries stop reporting
   `0.1.0`. Add a `version` field (or align the workspace) and wire it into the release
   version bump so the two never diverge again.
3. Add a regression test asserting `Cargo.toml` workspace version equals `package.json`
   version.
4. Document the `.gitignore`-vs-tracked contradiction for `bin/` and `package-lock.json`
   and decide policy in Phase 4 (do not change tracking in Phase 0).

Definition of done:
1. baseline is green and recorded
2. versions are equal and test-guarded
3. patch release can be cut from this phase alone

Risk: minimal. Rollback: revert version edits.

### Phase 1 — Remove Verified Dead Code

Goal: delete only code proven unreferenced.

Tasks:
1. Remove `orchestrator-core::config` (`config/mod.rs`, `config/loader.rs`,
   `config/schema.rs`) and its `pub mod config;` + `pub use config::OrchestratorConfig;`
   in `lib.rs`. Verified no consumer exists outside the module.
2. Re-run `cargo check --workspace` and `cargo test --workspace`; the only expected effect
   is fewer compiled symbols.
3. Collapse the Rust `hooks` module to exactly what the CLI uses (`Hook` enum +
   `description()`/`all()`); drop the uninstantiated registry if it has no consumer.
4. In TypeScript, remove proven-unused micro-files surfaced by the audit (e.g.
   `src/core/agents/consts/task-status.const.ts`, 0 imports) after a fresh import grep per
   file.

Definition of done:
1. `cargo check`/`cargo test` and `tsc`/`npm test` stay green
2. no `pub use`/`export` points to a deleted symbol
3. binary symbol count drops; no behavior change

Risk: low. Rollback: git revert of the deletion commit.

### Phase 2 — Unify the Continuation Control Plane

Goal: collapse the two session-continuation subsystems into one.

Tasks:
1. Map the exact surface of `todo-continuation.ts` and `mission-loop-handler.ts`:
   `handleUserMessage`, `handleAbort`, `handleSessionIdle`/`handleMissionIdle`,
   `cleanupSession`, and each module's `sessionStates` map.
2. Define one continuation module that owns a single per-session state record and exposes
   one function per event. Fold the todo-countdown path and the file-backed mission path
   into branches of the same state machine.
3. Replace the paired calls in `event-handler.ts` (lines 62–63, 128–129, 179–180, 196, 206)
   with single calls.
4. Cache `verifyMissionCompletion()` per iteration so idle storms do not re-read and
   re-parse the TODO file 5× per event.
5. Extend mission-loop lifecycle tests to assert: one continuation scheduled per idle, one
   cancellation per user action, and no double-injection.

Definition of done:
1. exactly one continuation path runs per event
2. mission-loop-lifecycle and persistence e2e tests pass unchanged in intent
3. `verifyMissionCompletion` is called at most once per iteration per session

Risk: high (behavioral surface). Mitigation: keep both modules behind the new facade until
tests prove parity, then delete the loser. Rollback: revert the facade commit.

### Phase 3 — Consolidate the `src/shared` Definitions Layer

Goal: cut the file count without changing any exported type or constant.

Tasks:
1. For each domain that uses the `constants/`+`interfaces/`+`types/` three-way split
   (agent, cache, command, errors, loop, notification, recovery, task, tool, verification),
   collapse each domain to a small number of files (target: one `constants.ts`, one
   `types.ts` per domain; keep a single domain `index.ts`).
2. Flatten the deepest chains first (e.g. `shared/notification/os-notify/*`,
   `shared/tool/constants/{common,lsp,parallel}`), which reach depth 10.
3. Preserve every export name. Update import sites mechanically; rely on `tsc` to prove no
   dangling import remains.
4. Apply the same collapse to the 95 prompt string modules: group each numbered stage
   (`01_philosophy` … `08_tools`) into one file per stage, or move prompt bodies to `.md`
   loaded at build time. Keep the composed prompt output byte-identical.

Definition of done:
1. file count drops by ~150–200 with zero export renames
2. `tsc --noEmit` green; no deepened or broken import paths
3. composed agent prompts are byte-identical before/after (snapshot test)

Risk: medium (wide but mechanical). Mitigation: one domain per commit; snapshot prompt
output. Rollback: per-domain revert.

### Phase 4 — Repository and Build Hygiene

Goal: stop shipping bloat and start catching drift.

Tasks:
1. Decide and apply binary policy: stop tracking `bin/` (it is already in `.gitignore`),
   distribute platform binaries via GitHub Release assets and the npm tarball instead of
   git history. Plan a one-time history note; do not rewrite history without explicit
   approval.
2. Resolve the `package-lock.json` contradiction: either commit it intentionally (remove
   from `.gitignore` and use `npm ci`) or stop tracking it. Pick one and make CI consistent.
3. Add minimal, enforced gates: `rustfmt.toml` + `cargo fmt --check` and `cargo clippy
   -D warnings` in CI; a lightweight TS lint (or at least `tsc --noEmit`) as a CI step.
4. Remove `noImplicitAny: false` from `tsconfig.json` and fix the fallout (scoped, behind
   its own commit so type fixes are reviewable).
5. Align `deploy-pages.yml` action majors with `release.yml`.
6. Source-map the esbuild build (`sourcemap: true`) and stop hardcoding the `tsc` path.

Definition of done:
1. repo no longer grows by binary on each release
2. CI fails on unformatted Rust, clippy warnings, and type errors
3. `noImplicitAny` hole is closed with green `tsc`

Risk: medium. Mitigation: split type-strictness fixes from packaging changes. Rollback:
revert per concern (lint, packaging, tsconfig are independent commits).

### Phase 5 — Rust Robustness and Coverage

Goal: harden subprocess tools and close test gaps.

Tasks:
1. Enforce a hard child-process timeout for `ast`, `git`, and the `tsc`/`eslint` paths in
   `lsp` (kill on deadline rather than relying on the child to honor a flag).
2. Replace silent `unwrap_or(0)` parsing in `http.rs` and `git.rs` with explicit errors
   when output does not match the expected shape.
3. Add unit tests for `http.rs` and `jq.rs`; add edge-case tests (timeout, empty input) for
   `grep`/`glob`/`mgrep`.
4. Replace the `config_loader.rs` regex `.unwrap()` with `.expect("...")` carrying context.

Definition of done:
1. no tool subprocess can hang indefinitely
2. malformed subprocess output surfaces as an error, not a fake success
3. `cargo test --workspace` covers `http`/`jq` and the new edge cases

Risk: low–medium. Rollback: per-tool revert.

### Phase 6 — Release Pipeline Simplification

Goal: make releases cheaper and non-destructive.

Tasks:
1. Remove the destructive `git commit --amend` + `git tag -f` from
   `release-sync-artifacts.mjs`; build artifacts before the version commit so no amend is
   needed.
2. Reconcile the artifact whitelist with the platforms actually shipped (all five, or an
   explicit, documented subset).
3. De-duplicate the build that runs in both `release:preflight` and the artifact path.
4. Add tests asserting release-script invariants (whitelist completeness, version sync,
   action majors) so release regressions fail in CI before publish.

Definition of done:
1. a re-run of the release sync does not rewrite tags
2. shipped binaries match the documented platform set
3. release invariants are test-guarded

Risk: medium (touches publish). Mitigation: validate with `release:dry-run` only; never
auto-publish from this plan. Rollback: revert workflow/script edits independently.

## 8. Execution Order and Shipping Strategy

1. Phase 0 and Phase 1 are low-risk and verifiable now; they form the **patch release**
   cut on 2026-06-19.
2. Phases 2–3 are the structural heart and should each land as their own reviewed series of
   commits, one domain / one subsystem at a time.
3. Phases 4–6 are hygiene/hardening and can interleave with 2–3 as capacity allows.

## 9. Verification Matrix

Required after every phase:

1. `npx tsc --noEmit`
2. `cargo check --workspace` and `cargo test --workspace`
3. `npm test` (or the focused suites the phase touches)
4. changed-file re-read
5. for Phase 2/3: prompt-output and continuation-behavior snapshots compared before/after

## 10. Risks and Mitigations

1. **Behavioral regression in continuation (Phase 2).** Highest risk. Gate behind a facade
   and parity tests before deleting either old module.
2. **Mechanical import breakage (Phase 3).** Caught by `tsc`; mitigated by one-domain commits.
3. **Release breakage (Phase 6).** Dry-run only; no auto-publish from this work.
4. **History rewrite for `bin/` (Phase 4).** Not performed without explicit approval; default
   is to stop tracking going forward.

## 11. Expected Outcome

1. ~150–200 fewer TypeScript files with identical exported behavior and shallower imports.
2. one continuation control plane instead of two competing subsystems.
3. ~750 LOC of verified Rust dead code removed; subprocess tools that cannot hang.
4. version, lint, and packaging drift caught by CI rather than by users.
5. a defensible 2026-06-19 patch release containing the Phase 0–1 safe subset.

## 12. This-Session Execution Record

The following subset of this plan is executed and shipped in the same pass that produced
this document (Phase 0 + the Rust portion of Phase 1), with full verification. See the
companion report dated 2026-06-19 for exact commands, outputs, and the released version.
