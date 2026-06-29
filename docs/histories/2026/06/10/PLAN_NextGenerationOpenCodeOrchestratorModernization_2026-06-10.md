# Next-Generation OpenCode Orchestrator Modernization and Release Patch Plan

Date: 2026-06-10 22:37:54 +0900

Repository: `/home/user/opencode-orchestrator`

Related survey target: `/home/user/builder-private`

Current package version observed from `package.json`: `1.3.3`

Plan type: Evidence-based modernization plan, not an implementation record.

## 1. Executive Intent

The objective is to move `opencode-orchestrator` into a next-generation plugin architecture while preserving the working user-facing behavior that already exists. The immediate output of this planning session is a release-oriented roadmap, not code changes. The next implementation session should use this plan as the control document for a patch release.

The modernization target is:

1. Align the OpenCode plugin implementation with the current official plugin contract.
2. Remove release blockers and cross-platform fragility.
3. Replace prompt/file-only completion authority with structured runtime evidence.
4. Adopt the useful general-agent orchestration patterns observed in `builder-private` without importing its domain-specific pentesting behavior.
5. Reduce legacy complexity and dead code after replacement paths are verified.
6. Harden installation, binary selection, release packaging, and rollback across Linux, macOS, Windows, WSL, and multiple CPU architectures.

## 2. Evidence Collected

### 2.1 OpenCode Official Usage Evidence

Official documentation checked:

- `https://opencode.ai/docs/plugins/`
- `https://opencode.ai/docs/windows/`

Observed plugin facts:

- OpenCode plugins are JavaScript or TypeScript files loaded from the OpenCode configuration directory.
- The documented config field is `"plugin"`, with entries such as local plugin files or npm packages.
- The documented plugin helper is imported from `@opencode-ai/plugin`.
- Documented hooks include `tool.execute.before`, `tool.execute.after`, `chat.message`, `event`, `config`, `experimental.session.compacting`, and `experimental.chat.system.transform`.
- Windows support has two paths:
  - WSL is the recommended Windows route.
  - Native Windows support is experimental and supports PowerShell, Command Prompt, Git Bash, MSYS2, and Cygwin.
- Native Windows installation can require Microsoft Visual C++ Redistributable.

Package registry evidence observed by command:

- `npm view @opencode-ai/plugin version dist-tags --json` returned latest `1.17.1`.
- `npm view @opencode-ai/sdk version dist-tags --json` returned latest `1.17.1`.
- Current repository dependencies are still on `^1.15.13`.

### 2.2 Local Baseline Evidence

Commands executed in `/home/user/opencode-orchestrator`:

| Command | Observed result | Meaning |
| --- | --- | --- |
| `npm ci` | Passed after dependencies were absent | Node dependency graph can install from the current lockfile. |
| `npm run build` | Passed | TypeScript bundle currently builds with installed dependencies. |
| `npm test` | Passed, 62 test files and 650 tests | Existing TypeScript regression suite is green. |
| `cargo test --workspace --all-targets` | Passed, 24 Rust tests | Rust workspace baseline is green. |
| `npm audit --json` | Failed with one moderate direct `esbuild <=0.24.2` advisory | Security/dependency remediation is required before a release patch. |
| `node -p "require('./package.json').version"` | Returned `1.3.3` | Current package version is `1.3.3`. |

### 2.3 Current Repository Facts

Files inspected directly:

- `package.json`
- `tsconfig.json`
- `README.md`
- `CONTRIBUTING.md`
- `src/index.ts`
- `src/plugin-handlers/config-handler.ts`
- `src/plugin-handlers/event-handler.ts`
- `src/plugin-handlers/tool-execute-handler.ts`
- `src/plugin-handlers/system-transform-handler.ts`
- `src/shared/message/constants/plugin-hooks.ts`
- `src/hooks/index.ts`
- `src/hooks/registry.ts`
- `src/hooks/types.ts`
- `src/features/mission-loop/*`
- `src/core/loop/*`
- `src/core/orchestrator/session-manager.ts`
- `src/core/sync/todo-sync-service.ts`
- `src/core/agents/manager.ts`
- `src/core/agents/session-pool.ts`
- `src/core/agents/concurrency.ts`
- `src/core/agents/persistence/task-wal.ts`
- `src/core/agents/manager-components/*`
- `src/utils/binary.ts`
- `scripts/postinstall.ts`
- `scripts/preuninstall.ts`
- `scripts/run-install-hook.mjs`
- `crates/orchestrator-cli/src/main.rs`
- `Dockerfile`
- `Dockerfile.windows`

Observed current architecture:

- `src/index.ts` is the plugin entry point and returns OpenCode hook handlers.
- `config` hook injection is implemented in `src/plugin-handlers/config-handler.ts`.
- `message.updated` events are bridged into assistant completion handling in `src/plugin-handlers/event-handler.ts`.
- Hook registration exists through `src/hooks/index.ts` and `src/hooks/registry.ts`.
- Mission continuation and verification are largely file-backed through `.opencode/verification-checklist.md`, TODO state, and sync issue files.
- Background agents are launched through `ParallelAgentManager` and its manager components.
- Rust binaries are selected through `src/utils/binary.ts`.
- TypeScript postinstall/preuninstall scripts modify OpenCode config with JSONC-aware backups and atomic writes.
- Rust CLI installation code duplicates some config-modification behavior with a weaker JSON-only path.

### 2.4 Builder-Private Survey Evidence

Survey target resolved from the user's `../builder private` request to:

- `/home/user/builder-private`

The literal `/home/user/opencode-orchestrator/../builder` path did not exist. Nearby builder repositories were enumerated and `/home/user/builder-private` was selected for this survey.

Builder files inspected directly:

- `AGENTS.md`
- `AGENT_MEMORY.md`
- `README.md`
- `ARCHITECTURE.md`
- `Cargo.toml`
- `package.json`
- `CLAUDE.md`
- `/home/user/builder-private/docs/plans/2026-06-10/INDEX.md`
- `/home/user/builder-private/docs/plans/2026-06-10/PLAN_Orchestration_Pentest_Migration_2026-06-10-2133.md`
- `/home/user/builder-private/docs/plans/2026-06-10/REPORT_Integrated_Migration_Verification_2026-06-10-2155.md`
- `.builder/agents/coordinator.md`
- `.builder/agents/investigator.md`
- `.builder/agents/operator.md`
- `.builder/agents/reviewer.md`
- `.builder/agents/verifier.md`
- `.builder/agents/report-writer.md`
- `.builder/skills/ctf-competition/SKILL.md`
- `.builder/skills/pentesting-methodology/SKILL.md`
- `crates/builder_repo/src/agent.rs`
- `crates/builder_app/src/agent_executor.rs`
- `crates/builder_domain/src/engagement.rs`
- `crates/builder_services/src/permissions.default.yaml`
- `scripts/check-pentesting-package.sh`
- `scripts/publish-pentesting-package.sh`
- `packages/pentesting/lib/runtime.mjs`

Builder commands observed:

| Command | Observed result | Meaning |
| --- | --- | --- |
| `git rev-parse HEAD` | `cb207896528a0db0a28a2fabe6d4c460c6efe311` | Builder survey was tied to a concrete commit. |
| `npm run pentesting:status` | Passed; local package `0.90.0`, registry latest `0.73.14`, branch `main`, worktree clean | Builder has a release-status preflight script for its facade package. |
| `cargo metadata --no-deps --format-version 1` | Passed and returned a 28-crate workspace | Builder is a multi-crate Rust workspace with broad runtime separation. |

Reusable Builder patterns:

- General agents remain domain-neutral, while CTF/pentesting behavior is pushed into skills and facade packages.
- Agent loading supports project-local, global, and built-in precedence.
- Dynamic profile descriptors model task shape, evidence rigor, tool scope, risk posture, review pressure, and retrieval bias.
- Reviewer and verifier profiles are constrained to read-only behavior.
- Completion authority is modeled as runtime state through workflow phases, evidence records, completion obligations, and acceptance gates.
- Release scripts check branch, worktree cleanliness, registry version collisions, dry-run package content, and token presence.
- The pentesting facade keeps distribution thin and delegates real runtime behavior to the core.

Builder patterns to avoid copying directly:

- Do not import CTF or pentesting defaults into `opencode-orchestrator`; keep them as optional skills or external packages only.
- Do not silently adopt Builder's permissive default permission file. Use named profiles and explicit user opt-in for dangerous capabilities.
- Do not copy Rust workspace structure wholesale unless a measured runtime need appears. The current TypeScript plugin surface remains the primary OpenCode integration layer.

## 3. Current Risk Brief

### P0 Release Blockers

1. `@opencode-ai/plugin` and `@opencode-ai/sdk` are behind the current npm latest version.
2. `npm audit` reports a moderate direct `esbuild` advisory.
3. Build scripts use POSIX shell assumptions even though Windows support is part of the product surface.
4. Concurrency token lifecycle appears split between launch-time and completion-time code paths, creating risk of early or duplicate slot release.
5. Completion authority is mostly file and prompt based, not a structured runtime contract.
6. Install/uninstall config mutation exists in both TypeScript and Rust with different safety properties.
7. Binary selection does not cover all target pairs represented by Builder's facade matrix and does not consistently fail with explicit unsupported-platform guidance.

### P1 Modernization Risks

1. `tsconfig.json` has strict mode enabled but `noImplicitAny` disabled.
2. Hook metadata advertises retry behavior, but the registry currently implements stop/continue semantics only.
3. `TodoSyncService` creates and watches a TODO file, but its session push path is intentionally empty.
4. Documentation is stale in places:
   - `README.md` mentions Node 18+ while `package.json` requires Node `>=24`.
   - `CONTRIBUTING.md` references scripts that are not present in `package.json`.
5. `TaskWAL` is a deprecated no-op compatibility stub, which is dead complexity unless it becomes the new run ledger.
6. Current memory, mission-loop, and session state are split across in-memory maps, disk files, and global state.

### P2 Quality and Scale Risks

1. Knowledge injection is filesystem-scanning oriented rather than clearly incremental.
2. Hook names are manually mirrored in local constants.
3. Error policy is not uniformly typed across hook execution, agent sessions, install hooks, and release scripts.
4. Cross-platform Docker and native binary build coverage is incomplete.
5. The release workflow does not yet encode all gates that were useful in Builder's release scripts.

## 4. Target Architecture

### 4.1 Plugin Boundary

The OpenCode plugin boundary remains:

- `src/index.ts` as the plugin export.
- Official hook names and official input/output types imported from OpenCode packages where available.
- A small adapter layer for any local convenience types.

Target properties:

- No hook is registered with a stale or undocumented name.
- Experimental hooks are isolated behind compatibility wrappers.
- The plugin config hook produces deterministic agent entries.
- All default agent changes are documented and tested.

### 4.2 Runtime State Boundary

Introduce a runtime ledger as the source of truth for orchestration state:

- `WorkflowRun`
- `WorkflowPhase`
- `EvidenceItem`
- `VerificationRun`
- `CompletionObligation`
- `AcceptanceGate`
- `AgentTask`
- `AgentLease`

The ledger should not be a generic log only. It must answer these operational questions:

1. What objective is active?
2. Which agents are assigned?
3. What evidence has been produced?
4. Which verification obligations remain?
5. Which gates block completion?
6. Which resources are currently leased?
7. Which state can be safely resumed after process restart or compaction?

### 4.3 Agent Model

Keep the current OpenCode plugin persona as the user-facing orchestrator, and add Builder-inspired specialist roles only when they have clear runtime boundaries:

- `commander`: existing primary coordination role.
- `investigator`: read-heavy survey role.
- `operator`: bounded write/execute role.
- `reviewer`: read-only code review and risk role.
- `verifier`: read-only evidence and test validation role.
- `report-writer`: bounded documentation/report generation role.

Each role must have:

- tool scope
- evidence rigor
- output contract
- completion definition
- forbidden files or actions when applicable
- tests proving config injection and role defaults

### 4.4 Completion Authority

Completion must be decided by runtime evidence, not a model assertion.

Target rule:

- A task can be marked complete only when all required `CompletionObligation` records are either satisfied, explicitly waived with reason, or not applicable with evidence.

Minimum obligation classes:

- `files_reopened`
- `commands_executed`
- `tests_observed`
- `upstream_downstream_checked`
- `docs_synced`
- `dead_code_removed_or_justified`
- `release_preflight_passed`
- `rollback_plan_recorded`

### 4.5 Cross-Platform Boundary

Target OS/architecture matrix:

| Platform | Architecture | Target state |
| --- | --- | --- |
| Linux | x64 | Supported and tested |
| Linux | arm64 | Supported and tested |
| macOS | x64 | Supported and tested |
| macOS | arm64 | Supported and tested |
| Windows | x64 | Supported and tested |
| Windows | arm64 | Either supported with binary or explicitly unsupported with clear error |
| WSL | host-dependent | Supported through Linux binary path |
| Android/Termux | arm64 | Either supported with binary or explicitly unsupported with clear error |

No platform should silently fall back to the wrong binary.

## 5. Phased Implementation Plan

### Phase 0: Baseline Freeze and Release Branch Preparation

Goal: Create a controlled starting point for the patch release.

Tasks:

1. Verify clean worktree in `opencode-orchestrator`.
2. Capture `node -v`, `npm -v`, `rustc -V`, `cargo -V`, `uname -a`, and current package version.
3. Re-run baseline commands:
   - `npm ci`
   - `npm run build`
   - `npm test`
   - `cargo test --workspace --all-targets`
   - `npm audit --json`
4. Create an implementation branch, for example `release/next-generation-orchestrator-1.3.4`.
5. Record the baseline in a release log under `docs/histories/2026/06/10/`.

Verification:

- Worktree is clean before implementation starts.
- Baseline failures are classified as known pre-existing failures or blockers.
- `npm audit` advisory is recorded as a blocker until fixed.

Rollback:

- Return to `main` without merging the implementation branch.

### Phase 1: OpenCode SDK and Plugin Contract Alignment

Goal: Align the plugin with the current OpenCode package surface.

Tasks:

1. Update `@opencode-ai/plugin` from `^1.15.13` to the current verified latest compatible version.
2. Update `@opencode-ai/sdk` from `^1.15.13` to the current verified latest compatible version.
3. Re-run type checks and inspect any changed exported hook types.
4. Replace locally duplicated hook input shapes with official types where the SDK exports them.
5. Keep local adapter types only where official SDK types do not exist.
6. Add compatibility tests for:
   - `config`
   - `event`
   - `chat.message`
   - `tool.execute.before`
   - `tool.execute.after`
   - `experimental.session.compacting`
   - `experimental.chat.system.transform`
7. Confirm documented config output still uses the official `"plugin"` field.
8. Update docs to mention the exact supported OpenCode package range.

Verification:

- `npm run build` passes.
- `npm test` passes.
- A hook fixture test proves the plugin export returns all intended hooks.
- A config fixture test proves generated agents remain deterministic.

Rollback:

- Revert package version updates and compatibility adapter changes together.

### Phase 2: Dependency and Build Modernization

Goal: Remove immediate release blockers and shell portability issues.

Tasks:

1. Upgrade `esbuild` to a non-vulnerable version compatible with the project.
2. Replace POSIX-only `package.json` scripts with cross-platform Node scripts or `shx`.
3. Move build orchestration into a script such as `scripts/build.ts` if the command becomes too complex.
4. Ensure `dist/` cleanup works on Windows, macOS, and Linux.
5. Ensure executable bit handling is explicit for Unix binaries and not assumed for Windows.
6. Add a `release:preflight` script that runs:
   - clean worktree check
   - branch check
   - dependency install check
   - build
   - tests
   - audit
   - package dry-run
   - registry duplicate-version check
7. Update package scripts to make patch/minor/major releases depend on preflight.

Verification:

- `npm run build` passes from a clean checkout.
- `npm run release:dry-run` passes.
- `npm audit --json` returns no unresolved release-blocking advisory.
- Build script can be reasoned about without POSIX shell dependencies.

Rollback:

- Revert script modernization and dependency bump in one commit if esbuild changes break bundling.

### Phase 3: Runtime Ledger Introduction

Goal: Introduce a structured orchestration state layer without changing external behavior yet.

Tasks:

1. Define ledger types:
   - `WorkflowRun`
   - `WorkflowPhase`
   - `AgentTask`
   - `AgentLease`
   - `EvidenceItem`
   - `VerificationRun`
   - `CompletionObligation`
   - `AcceptanceGate`
2. Store the ledger under `.opencode/orchestrator/runs/` or another explicit internal path.
3. Add serialization and deserialization tests.
4. Add versioning to the ledger format.
5. Write a migration reader that tolerates missing ledger files.
6. Make current mission-loop evidence write through the ledger while continuing to update existing files.
7. Treat existing checklist files as compatibility outputs during this phase.

Verification:

- Existing tests pass.
- New ledger round-trip tests pass.
- A simulated restart reloads the ledger.
- Existing `.opencode/verification-checklist.md` behavior remains unchanged.

Rollback:

- Disable ledger writes behind a feature flag or internal config switch.

### Phase 4: Concurrency and Agent Lifecycle Correction

Goal: Make concurrency ownership unambiguous and prevent early or duplicate slot release.

Tasks:

1. Trace current task lifecycle from launch to completion.
2. Define the owner of a concurrency token as the persisted `AgentLease`.
3. Release the token exactly once through a single lifecycle finalizer.
4. Add task states:
   - `queued`
   - `launching`
   - `running`
   - `completed`
   - `failed`
   - `cancelled`
   - `timed_out`
5. Move release behavior out of prompt-return cleanup if the task continues asynchronously.
6. Ensure poller completion, error handling, cancellation, and shutdown use the same finalizer.
7. Add regression tests for:
   - prompt returns before agent finishes
   - successful completion
   - failed launch
   - failed poll
   - timeout
   - shutdown while running
   - duplicate completion event
8. Add invariant checks to prevent negative or over-released concurrency counts.

Verification:

- Unit tests prove one release per lease.
- Integration tests prove max concurrency is enforced under parallel launches.
- Shutdown tests prove no leaked leases.

Rollback:

- Revert lifecycle finalizer changes while keeping tests disabled only if the current release cannot absorb the change. This should be a last resort because concurrency correctness is a release-quality issue.

### Phase 5: Builder-Inspired General Agent Profiles

Goal: Add next-generation general-agent capability without domain lock-in.

Tasks:

1. Define role descriptors for:
   - commander
   - investigator
   - operator
   - reviewer
   - verifier
   - report-writer
2. Add profile fields:
   - tool scope
   - evidence rigor
   - risk posture
   - review pressure
   - output contract
   - completion obligations
3. Keep CTF/pentesting content out of default profiles.
4. Add optional skill/facade integration points for specialized domains.
5. Update config injection to register the new profiles deterministically.
6. Make reviewer and verifier read-only by default.
7. Make operator write/execute capable only where the surrounding OpenCode permission model allows it.
8. Add tests for injected agent names, prompts, mode defaults, and no domain-specific leakage.

Verification:

- Config snapshot tests pass.
- Agent role docs match injected config.
- No pentesting or CTF terms appear in default runtime prompts.

Rollback:

- Keep only existing agents and ship profile descriptors behind an internal feature flag.

### Phase 6: Completion Obligations and Acceptance Gates

Goal: Move completion decisions from informal prompt text into auditable runtime records.

Tasks:

1. Map existing AGENTS.md completion requirements into `CompletionObligation` records.
2. Add acceptance gate evaluation:
   - build gate
   - test gate
   - audit gate
   - docs sync gate
   - cross-platform gate
   - release preflight gate
3. Record command output summaries as evidence items.
4. Record file-read verification as evidence items.
5. Add explicit waiver records with reason and owner.
6. Teach mission-loop continuation to read unsatisfied obligations.
7. Keep human-readable markdown checklists generated from the ledger.

Verification:

- A task cannot be marked complete while required gates are unsatisfied.
- Waived obligations remain visible in reports.
- Markdown checklist output matches ledger state.

Rollback:

- Continue generating obligations without enforcing them until tests and UX are stable.

### Phase 7: TODO Sync and Mission State Consolidation

Goal: Replace ambiguous TODO/session state with a single producer-consumer contract.

Tasks:

1. Decide whether TODO sync is:
   - OpenCode session TODO synchronization, or
   - local markdown continuity only.
2. If OpenCode TODO synchronization is supported by the SDK, implement it against official SDK calls.
3. If not supported, rename the service and docs to reflect local markdown continuity only.
4. Fix markdown generation so produced TODO lines match the parser contract.
5. Move mission state into the ledger and generate compatibility markdown from it.
6. Add tests for parsing, writing, watching, debouncing, and restart recovery.

Verification:

- Generated TODO markdown parses back into equivalent state.
- Session update path is either implemented or removed from public claims.
- No empty method is left behind as implied functionality.

Rollback:

- Keep existing local TODO file behavior but remove claims of session synchronization.

### Phase 8: Install, Uninstall, and Config Hardening

Goal: Make OpenCode config mutation safe and single-sourced.

Tasks:

1. Choose one implementation source for config mutation.
2. Prefer the TypeScript implementation if it remains the package install path.
3. Extract shared operations:
   - locate OpenCode config
   - parse JSONC
   - preserve formatting where possible
   - create backup
   - atomic write
   - idempotent plugin entry add/remove
   - WSL/native path handling
4. Retire or route the Rust CLI install/uninstall logic through the same contract.
5. Add fixture tests for:
   - JSON
   - JSONC with comments
   - missing config
   - existing plugin entry
   - duplicate plugin entry
   - malformed config
   - Windows path
   - WSL path
6. Update install docs with exact supported behavior and rollback steps.

Verification:

- Install/uninstall tests pass.
- Manual dry-run config edits produce backups.
- Rust and TypeScript paths do not diverge.

Rollback:

- Keep TypeScript postinstall behavior and remove CLI install/uninstall commands from public docs until unified.

### Phase 9: OS, Architecture, and Binary Distribution

Goal: Make binary delivery explicit, predictable, and safe.

Tasks:

1. Define the official binary support matrix.
2. Compare current `bin/` artifacts against the matrix.
3. Update `src/utils/binary.ts` to:
   - handle supported pairs explicitly
   - reject unsupported pairs explicitly
   - include remediation text
   - avoid wrong-architecture fallback
4. Add tests for all platform/architecture combinations.
5. Add Windows arm64 decision:
   - build and publish `orchestrator-windows-arm64.exe`, or
   - return an explicit unsupported error.
6. Add Android/Termux arm64 decision:
   - build and publish an Android-compatible binary, or
   - return an explicit unsupported error.
7. Update Dockerfile coverage:
   - Linux x64
   - Linux arm64
   - Windows x64 where practical
   - Windows arm64 decision recorded
8. Add artifact manifest with checksums.

Verification:

- Binary selector tests pass for Linux, macOS, Windows, WSL, and unsupported combinations.
- Docker builds pass for supported targets.
- Package dry-run contains exactly expected binaries.

Rollback:

- Preserve existing supported binaries and add only explicit unsupported errors.

### Phase 10: Legacy and Complexity Cleanup

Goal: Remove dead or misleading code only after replacement paths are verified.

Tasks:

1. Classify `TaskWAL`:
   - delete if fully unused, or
   - replace with runtime ledger implementation if the name remains useful.
2. Remove hook constants that duplicate official names unless they provide clear value.
3. Remove empty methods or convert them into implemented behavior.
4. Remove stale config paths and dead exports.
5. Remove obsolete docs references to non-existent scripts.
6. Tighten imports after dead-code removal.
7. Run circular dependency checks if available or add a lightweight check.
8. Move compatibility shims into explicitly named files with removal conditions.

Verification:

- `rg` confirms removed symbols have no references.
- Build and tests pass.
- Docs no longer mention removed APIs or scripts.

Rollback:

- Restore compatibility shim only if an actual public consumer is identified.

### Phase 11: Type Safety and Quality Tightening

Goal: Gradually raise code quality without mixing broad refactors into behavioral changes.

Tasks:

1. Enable stricter TypeScript checks in stages:
   - first audit current implicit any count
   - then enable `noImplicitAny` for new or touched modules
   - finally enable globally when count reaches zero
2. Replace unexplained `any` with explicit types or narrow adapter types.
3. Enforce maximum function size and complexity through review or tooling where practical.
4. Add focused tests instead of broad rewrites.
5. Keep refactors separate from feature behavior changes.

Verification:

- TypeScript build remains green after each tightening step.
- New code has no untyped `any`.
- Refactor commits have no intentional behavior changes.

Rollback:

- Revert the specific strictness flag change if it blocks release, while keeping typed local improvements.

### Phase 12: Observability and Evidence Reporting

Goal: Make orchestration behavior debuggable and auditable.

Tasks:

1. Standardize event names for:
   - run created
   - phase changed
   - agent started
   - agent completed
   - evidence recorded
   - obligation satisfied
   - gate failed
   - lease released
2. Add structured logs with run id and session id.
3. Add a report writer that can produce:
   - concise Korean user report
   - English technical plan
   - release verification report
4. Ensure logs do not expose secrets.
5. Add tests for redaction.

Verification:

- Test logs contain run ids and no known secret fixtures.
- Report generation reads from ledger records.

Rollback:

- Keep internal ledger data and omit report generation until redaction is proven.

### Phase 13: Release Patch Workflow

Goal: Ship the patch only after the gates prove it is safe.

Tasks:

1. Run `release:preflight`.
2. Run package dry-run and inspect contents.
3. Verify no duplicate npm version exists.
4. Verify git worktree is clean.
5. Create patch version bump after all gates pass.
6. Build final artifacts.
7. Run final smoke tests:
   - install package from local tarball
   - plugin config entry is added
   - OpenCode can load plugin
   - binary selector returns expected binary on current host
   - uninstall removes only the expected plugin entry
8. Commit implementation and release documents.
9. Tag release.
10. Publish npm package.
11. Push commit and tag after publication succeeds, or follow the repository's chosen release ordering explicitly.
12. Record publication evidence.

Verification:

- npm registry shows the new patch as latest.
- Git tag points to the release commit.
- Package contents match manifest.
- Release notes list risks and rollback.

Rollback:

- If npm publish fails before tag push, remove local tag and fix.
- If npm publish succeeds but git push fails, push release commit/tag as recovery.
- If package is broken after publish, publish a corrective patch; do not rely on unpublish.

## 6. Immediate Implementation Backlog

### P0: Must Fix Before Patch Release

1. Upgrade OpenCode packages to the current compatible versions and update hook type tests.
2. Upgrade `esbuild` and clear the audit finding.
3. Replace POSIX-only build/release scripts.
4. Fix concurrency token ownership and release exactly once.
5. Add explicit unsupported-platform behavior for missing binaries.
6. Unify install/uninstall config mutation or remove the weaker public path.
7. Update stale README and CONTRIBUTING claims.

### P1: Should Include If Patch Scope Allows

1. Runtime ledger initial implementation with compatibility markdown output.
2. Completion obligations for release and verification gates.
3. TODO sync contract cleanup.
4. Hook retry metadata implementation or removal.
5. New general-agent profiles with read-only reviewer/verifier.

### P2: Next Minor Release Candidate

1. Global `noImplicitAny` tightening.
2. Incremental knowledge indexing.
3. Full artifact checksum manifest.
4. Advanced report writer fed by the runtime ledger.
5. Optional specialized skill/facade packages.

## 7. Cross-Platform Safety Plan

### Linux

Actions:

- Test x64 and arm64 binary resolution.
- Confirm executable permissions survive package creation.
- Run Docker build for Linux target images.

Evidence required:

- binary selector tests
- package dry-run contents
- Docker build logs

### macOS

Actions:

- Test x64 and arm64 binary resolution.
- Avoid Linux-only commands in npm scripts.
- Document Gatekeeper or executable-permission behavior if observed.

Evidence required:

- binary selector tests
- package manifest check
- install/uninstall path tests

### Windows Native

Actions:

- Remove POSIX shell assumptions from scripts.
- Test path handling with backslashes and spaces.
- Treat native Windows as experimental where OpenCode docs do.
- Decide Windows arm64 support explicitly.

Evidence required:

- script tests that do not require Bash
- config fixture tests
- explicit binary selector behavior

### WSL

Actions:

- Preserve WSL-aware config detection.
- Confirm Linux binary path is used under WSL.
- Avoid mutating Windows config when the intended target is WSL config unless explicitly requested.

Evidence required:

- WSL path fixture tests
- install/uninstall config tests

### Android/Termux

Actions:

- Decide whether Android arm64 is supported.
- If unsupported, return a clear message instead of selecting Linux arm64 by accident.
- If supported, add a distinct target artifact and test it.

Evidence required:

- platform selector tests
- release artifact manifest

## 8. Test Matrix

### Required Before Merge

1. `npm ci`
2. `npm run build`
3. `npm test`
4. `cargo test --workspace --all-targets`
5. `npm audit --json`
6. `npm pack --dry-run`
7. `git diff --check`
8. `git status --short --branch`

### Required After SDK Upgrade

1. Hook fixture tests.
2. Config injection snapshot tests.
3. Experimental hook compatibility tests.
4. OpenCode plugin loading smoke test.

### Required After Concurrency Fix

1. One-release-per-lease unit tests.
2. Parallel launch integration tests.
3. Timeout and cancellation tests.
4. Shutdown cleanup tests.

### Required After Install Hardening

1. JSON config fixture test.
2. JSONC config fixture test.
3. malformed config test.
4. duplicate plugin entry test.
5. uninstall idempotency test.
6. Windows and WSL path fixture tests.

### Required Before Publish

1. Release preflight script.
2. Package dry-run contents inspection.
3. Registry duplicate-version check.
4. Local tarball install smoke test.
5. Publication evidence document.

## 9. Documentation Updates Required

Files to update during implementation:

- `README.md`
- `CONTRIBUTING.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- release history under `docs/histories/2026/06/10/`
- package script descriptions if a scripts section exists
- install/uninstall troubleshooting docs
- OS and architecture support docs

Required documentation corrections:

1. Align Node version claims with `package.json`.
2. Remove or replace scripts that do not exist.
3. Document official OpenCode plugin config syntax.
4. Document supported OpenCode package range.
5. Document supported OS/architecture matrix.
6. Document release preflight gates.
7. Document rollback for install, publish, and binary artifact mistakes.

## 10. Risk Register

| Risk | Severity | Mitigation |
| --- | --- | --- |
| OpenCode SDK upgrade changes hook types | High | Add compatibility adapter and hook fixture tests before broader edits. |
| esbuild upgrade changes bundling output | High | Inspect bundle, run tests, run package dry-run. |
| Concurrency lifecycle fix changes behavior | High | Add focused lifecycle tests before refactor. |
| Runtime ledger creates duplicate state | Medium | Write through ledger while preserving existing markdown output during migration. |
| New agent profiles alter user workflows | Medium | Add deterministic config tests and keep behavior opt-in where possible. |
| Windows scripts fail without Bash | High | Replace shell commands with Node/shx and test path fixtures. |
| Unsupported CPU architecture selects wrong binary | High | Make platform selection explicit and fail closed. |
| Install/uninstall damages user config | High | Use backups, JSONC parser, idempotency tests, and atomic writes. |
| Docs drift after refactor | Medium | Add docs sync gate to release preflight. |
| Private Builder patterns are copied too literally | Medium | Reuse architecture ideas only, not domain-specific content. |

## 11. Rollback Strategy

### Code Rollback

- Keep each phase in a separately reviewable commit.
- Revert the smallest phase commit that introduced the regression.
- Do not mix SDK upgrade, concurrency fix, and ledger introduction in one commit.

### Install Rollback

- Always create config backups before mutation.
- Uninstall must remove only the plugin entry it owns.
- Failed install must leave either the old config or a recoverable backup.

### Release Rollback

- If publication has not happened, delete local tag and rebuild.
- If npm publication has happened, publish a corrective patch instead of relying on package removal.
- If git push fails after npm publication, recover by pushing the exact release commit and tag.

### Feature Rollback

- Runtime ledger can run in compatibility mode.
- New agent profiles can be disabled behind config.
- Unsupported platform handling can be shipped before new binaries are added.

## 12. Definition of Done for the Patch

The patch is complete only when all of the following are true:

1. Changed files have been reopened and reviewed.
2. Upstream and downstream connections have been traced.
3. OpenCode plugin hooks are aligned with official package versions.
4. Security audit has no unresolved release-blocking issue.
5. Build and tests pass.
6. Rust tests pass.
7. Install/uninstall paths are tested.
8. Binary selector behavior is tested for supported and unsupported targets.
9. Documentation is synchronized.
10. Release preflight passes.
11. Package dry-run is inspected.
12. Release notes and rollback steps are recorded.
13. `AGENT_MEMORY.md` is updated.

## 13. Recommended Patch Scope

The next patch release should prioritize safety and compatibility over broad new behavior.

Recommended patch inclusion:

1. SDK/package alignment.
2. esbuild audit remediation.
3. cross-platform build script fix.
4. concurrency lifecycle bug fix.
5. binary selector fail-closed behavior.
6. install/uninstall contract consolidation.
7. docs synchronization.
8. release preflight hardening.

Recommended deferral to the following minor release:

1. Full runtime ledger enforcement.
2. Full dynamic profile synthesis.
3. advanced report writer.
4. global TypeScript strictness changes.
5. Android binary support if it requires new build infrastructure.

This split gives the patch release a smaller blast radius while still preparing the next-generation architecture.

## 14. Confidence and Open Questions

Confidence: 86/100.

Basis for confidence:

- The current repository build and tests were directly observed.
- The Rust workspace tests were directly observed.
- The npm audit issue was directly observed.
- Official OpenCode plugin and Windows documentation were checked.
- Builder-private files and release scripts were directly inspected.

Remaining unknowns:

1. Whether OpenCode SDK `1.17.1` introduces type or runtime changes not visible until dependency update.
2. Whether Windows arm64 should be supported with a native binary or explicitly rejected.
3. Whether Android/Termux is a product requirement or only an inspiration from Builder's target matrix.
4. Whether TODO synchronization has an official SDK API path in the current OpenCode version.
5. Whether release patch scope should include the runtime ledger in compatibility mode or defer it entirely.
