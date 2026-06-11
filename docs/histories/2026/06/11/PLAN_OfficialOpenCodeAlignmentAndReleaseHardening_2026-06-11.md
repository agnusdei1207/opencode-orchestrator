# Official OpenCode Alignment and Release Hardening Plan

Date: 2026-06-11
Scope: `opencode-orchestrator`
Status: In progress

## 1. Objective

Move the plugin to a cleaner patch-release baseline that is easier to operate, easier to verify, and harder to misconfigure.

This plan targets four outcomes:

1. documented behavior matches the current OpenCode contract
2. release plumbing is simpler and less warning-prone
3. compatibility expectations are explicit and test-guarded
4. Builder-inspired ideas are kept only where they strengthen the plugin without exceeding the plugin boundary

## 2. Verified Starting Facts

The following facts were re-verified from source, tests, and current registry metadata on 2026-06-11:

1. `src/plugin-handlers/config-handler.ts` generates Commander, Planner, Worker, and Reviewer at config-hook time.
2. Generated agents inherit global `permission` and then merge same-name user agent overrides on top.
3. Concurrency is accepted from both:
   - plugin tuple options
   - legacy top-level config keys
4. Mission-loop runtime options currently include:
   - `ledger`
   - `markdownMemory`
   - `maxEvidenceEvents`
5. Mission loop default iteration ceiling is `1_000_000_000`.
6. `package.json` already routes `homepage` and `bugs.url` to GitHub issues.
7. The GitHub repository sidebar homepage still points to `https://rdot.agnusdei.kr/`.
8. The installed and latest published OpenCode packages both resolve to:
   - `@opencode-ai/plugin` `1.17.3`
   - `@opencode-ai/sdk` `1.17.3`
9. The release workflow still contains older action majors and an unnecessary Bun setup step.

## 3. Evidence Sources

Primary sources used for this plan:

1. local source files under `src/`, `tests/`, `.github/workflows/`, and `package.json`
2. installed type definitions under:
   - `node_modules/@opencode-ai/plugin/dist/index.d.ts`
   - `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts`
3. official OpenCode documentation:
   - `https://opencode.ai/docs/config/`
   - `https://opencode.ai/docs/plugins/`
   - `https://opencode.ai/docs/keybinds/`
4. current registry and release metadata:
   - `npm view @opencode-ai/plugin version`
   - `npm view @opencode-ai/sdk version`
   - `gh release list` for workflow actions used by this repository

## 4. Problem Statement

The project is functionally healthier than its older README and release plumbing suggest, but three sources of drift remain:

1. users still need a sharper answer for model inheritance, concurrency placement, and interrupt behavior
2. GitHub Actions release plumbing still carries stale or unnecessary setup that increases warning noise
3. repository-level support routing is split between correct package metadata and an incorrect GitHub sidebar homepage

## 5. Scope Boundary

Included:

1. README and architecture alignment to current verified code paths
2. release workflow simplification and action-major refresh
3. workflow- and compatibility-focused tests
4. issue/support-link cleanup where repository permissions allow it
5. detailed planning artifact for this exact date

Excluded:

1. unverified performance claims
2. major orchestration-core redesign
3. OpenCode application internals outside the plugin contract
4. Builder-private runtime policy that conflicts with OpenCode authority

## 6. Target Files

1. `README.md`
2. `docs/SYSTEM_ARCHITECTURE.md`
3. `.github/workflows/release.yml`
4. `package.json`
5. `package-lock.json`
6. `tests/unit/dependency-compatibility.test.ts`
7. `tests/unit/package-metadata.test.ts`
8. `tests/unit/release-workflow.test.ts`
9. `AGENT_MEMORY.md`

## 7. Design Principles

1. OpenCode remains the contract authority.
2. Source and installed types override historical prose.
3. Remove complexity when it does not buy verified capability.
4. Keep Builder-derived concepts only when they are:
   - local-first
   - optional
   - inspectable in plain files
   - subordinate to OpenCode runtime behavior
5. Prefer tests that catch drift at the file-contract boundary.

## 8. Workstreams

### Workstream A: Contract and Compatibility Audit

Tasks:

1. re-open plugin and SDK type definitions
2. confirm plugin tuple support and hook shapes
3. confirm latest published SDK/plugin versions
4. verify the current node baseline and package metadata

Definition of done:

1. every compatibility claim maps to a file read or command output
2. no README statement depends on memory or guesswork

### Workstream B: Documentation Consolidation

Tasks:

1. keep README focused on install, configure, run, and support
2. keep architecture notes short and source-backed
3. preserve the validated sample config shape using the plugin tuple
4. keep contribution guidance visible but compact

Definition of done:

1. issue `#26` can be answered directly from README
2. dead support links are removed from repo-controlled docs and metadata

### Workstream C: Release Workflow Simplification

Tasks:

1. replace outdated GitHub Action majors with current stable majors verified today
2. remove the unused Bun setup from the release job
3. remove deprecated registry/scope action inputs when a plain `.npmrc` step is clearer
4. keep the existing build matrix unless source evidence requires a matrix change

Definition of done:

1. workflow YAML is shorter and clearer
2. warning-prone or unnecessary setup has been removed
3. publish steps still cover:
   - GitHub Release assets
   - GitHub Packages
   - public npm

### Workstream D: Test Hardening

Tasks:

1. retain compatibility tests for SDK/plugin version lock
2. retain metadata tests for issue routing
3. add workflow-file tests that catch action-version and deprecated-input regressions
4. keep interrupt/idle continuation tests in the verification set

Definition of done:

1. workflow regressions fail in CI before release
2. docs and packaging assumptions remain executable expectations

### Workstream E: Repository Support Routing

Tasks:

1. verify the current GitHub auth and repository permission level
2. if permissions allow it, change the repository homepage to the GitHub issues page
3. comment on and close issue `#25` only after the public broken link is actually gone

Definition of done:

1. public support link path is internally consistent
2. issue `#25` is not closed on assumption

## 9. Builder-Derived Learnings To Keep

Keep:

1. generated markdown scratchpad for active mission memory
2. optional `.canvas` visualization artifact
3. interrupt-aware continuation guards around idle resumption
4. concise visual explanation instead of inflated architecture prose

Reject:

1. Builder-specific permission defaults
2. Builder-specific model policy
3. autonomous claims that exceed current code evidence
4. large generalized platform layers that are not justified inside a plugin

## 10. Verification Matrix

Required verification after edits:

1. `npx tsc --noEmit`
2. focused Vitest covering:
   - config handler
   - concurrency config
   - event handler
   - package metadata
   - dependency compatibility
   - release workflow
   - mission loop lifecycle
3. `npm test`
4. changed-file re-read
5. release/publish verification after the patch cut

## 11. Risks

1. GitHub repository settings may still block sidebar homepage updates even with write-level repository access.
2. Action-major upgrades can introduce workflow syntax drift if not validated by a real tag release.
3. README examples can drift again if config parsing changes and tests do not cover the affected contract.

## 12. Rollback Plan

1. revert workflow-only changes if release automation regresses
2. revert doc-only changes if a verified code path contradicts the new wording
3. revert action-major upgrades independently from package/runtime changes if the workflow surface is the only failing layer

## 13. Expected Outcome

1. cleaner documentation with fewer repeated claims
2. explicit compatibility baseline pinned to the current official package versions
3. lower GitHub Actions drift and less release warning noise
4. stronger issue-routing hygiene
5. a defensible patch release with evidence-backed notes
