# Official OpenCode Alignment and Release Hardening Plan

Date: 2026-06-11
Scope: `opencode-orchestrator`
Status: In progress

## 1. Objective

Bring the plugin to a cleaner next-stage baseline by aligning documented behavior, runtime wiring, release plumbing, and tested compatibility with the current OpenCode SDK/plugin contract.

## 2. Verified Starting Facts

1. The plugin currently generates Commander, Planner, Worker, and Reviewer inside `src/plugin-handlers/config-handler.ts`.
2. Global permissions are merged into generated agents and same-name agent overrides are preserved.
3. Concurrency settings are read from both plugin tuple options and legacy top-level config keys.
4. Mission loop state, ledger output, markdown memory, and `.canvas` output are already implemented.
5. The current npm package metadata already routes `homepage` and `bugs.url` to GitHub issues.
6. The GitHub repository sidebar homepage still points to a dead external URL and requires repository settings access to change.

## 3. Why This Work Matters

1. Users need one unambiguous answer for where concurrency belongs and how models are selected.
2. Release notes and workflow dependencies should not lag behind the actual architecture.
3. Evidence-based docs reduce support churn and prevent configuration folklore.
4. Version drift between `@opencode-ai/plugin` and `@opencode-ai/sdk` is a real compatibility risk for plugin surfaces.
5. Builder-inspired memory concepts are useful here only when they remain local-first, optional, and subordinate to OpenCode contracts.

## 4. Scope Boundary

Included:

1. README clarification for model routing, permission inheritance, and concurrency placement
2. Architecture documentation rewrite to match current source
3. Release workflow hardening
4. Dependency compatibility pinning and tests
5. Evidence-based comparison notes for Builder-derived memory patterns

Excluded:

1. Repository admin-only settings changes without a valid GitHub token
2. Major runtime redesign of the orchestration core
3. Upstream OpenCode TUI internals outside the plugin boundary
4. Unverified performance marketing claims

## 5. Target Files

1. `README.md`
2. `docs/SYSTEM_ARCHITECTURE.md`
3. `.github/workflows/release.yml`
4. `package.json`
5. `package-lock.json`
6. `tests/unit/dependency-compatibility.test.ts`
7. `AGENT_MEMORY.md`

## 6. Design Principles

1. Keep OpenCode as the contract authority.
2. Prefer current source over old architectural prose.
3. Reduce documentation volume where it repeats or exaggerates.
4. Keep Builder learnings only when they fit a plugin-first design:
   - local markdown scratchpad
   - visual `.canvas` artifact
   - continuation guards around interrupts and idle events
5. Do not import Builder-only runtime policy or permission defaults.

## 7. Phased Execution

### Phase 1: Contract Audit

1. Re-open the OpenCode plugin and SDK type definitions.
2. Confirm plugin tuple support, config shape, and hook names.
3. Confirm the current dependency versions installed in the workspace.
4. Re-check issue state and public metadata links.

Done when:

1. Every README claim used in the new version is backed by a file read or type definition.
2. Unsupported or ambiguous claims are removed.

### Phase 2: Documentation Consolidation

1. Rewrite README configuration guidance around the actual supported config tuple.
2. Add a direct explanation for model selection:
   - framework model equals Commander model by default
   - subagents inherit the invoking primary model unless overridden
3. Replace the oversized architecture memo with a shorter, source-backed map.
4. Keep the issue tracker as the public support destination.

Done when:

1. A new user can answer issue `#26` from README alone.
2. There is no dead external support link in package metadata or docs.

### Phase 3: Release Plumbing Hardening

1. Remove stale release-note copy that no longer matches the product.
2. Update Node-runtime-sensitive GitHub Actions where the workflow still uses older majors.
3. Keep the artifact matrix unchanged unless source evidence requires otherwise.

Done when:

1. Workflow YAML reflects current release behavior.
2. The release body no longer advertises removed or unverified features.

### Phase 4: Dependency Compatibility Lock

1. Pin `@opencode-ai/plugin` and `@opencode-ai/sdk` to the same tested version.
2. Refresh lockfile state.
3. Add a test that fails on version drift.

Done when:

1. `package.json` and `package-lock.json` are synchronized.
2. The new test catches accidental SDK/plugin skew.

### Phase 5: Verification

1. Run TypeScript typecheck.
2. Run focused tests covering config, events, chat hooks, package metadata, dependency compatibility, and mission loop lifecycle.
3. Re-open every changed file and re-read it.
4. Review `git diff` for accidental behavior changes.

Done when:

1. All targeted verification commands pass.
2. Documentation and tests agree with code.

## 8. Builder-Derived Learnings To Keep

Keep:

1. A local-first markdown scratchpad
2. Optional `.canvas` graph output
3. Interrupt-aware continuation guards
4. Concise architecture visualizations instead of dense prose

Reject:

1. Builder-specific permission defaults
2. Builder runtime policy replacing OpenCode policy
3. Large product-neutral platform layers that do not fit a plugin
4. Unbounded memory systems or unverifiable autonomy claims

## 9. Risks

1. GitHub repository sidebar homepage cannot be fixed without repository settings access.
2. Upstream OpenCode behavior may change faster than repo documentation unless version checks stay pinned.
3. README examples can drift again if config parsing changes without tests.

## 10. Rollback Plan

1. Revert workflow changes if release automation regresses.
2. Revert dependency pinning if upstream requires a wider semver range.
3. Restore the previous docs only if a verified code path contradicts the rewrite.

## 11. Expected Outcome

1. Cleaner public documentation
2. Explicit version compatibility baseline
3. Lower release drift risk
4. Easier triage for configuration and model-selection questions
5. A more defensible next patch release
