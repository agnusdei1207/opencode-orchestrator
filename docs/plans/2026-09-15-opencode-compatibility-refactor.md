# OpenCode compatibility and mission-loop refactor plan

Date: 2026-09-15
Status: Implemented; release verification in progress

## Target and reason

Audit the complete plugin boundary against the current OpenCode source and the
current `@opencode-ai/plugin` / `@opencode-ai/sdk` packages, then reduce the
mission idle continuation handler's size and branching without changing its
observable sequencing.

## Reference scope

- OpenCode `dev` at `e03db9bc`: plugin package types, package entrypoint
  resolution, external loader, compatibility checks, and hook dispatch.
- Oh My OpenAgent `dev` at `db37b83af`: OpenCode adapter entrypoint and config
  registration patterns. It is a reference only; no source is copied.

## Affected files

- `package.json`, `package-lock.json`: align the tested OpenCode packages and
  expose an explicit server plugin entrypoint.
- `src/index.ts`: preserve the supported plugin export while documenting the
  host contract.
- `src/core/loop/mission-loop-handler.ts`: retain lifecycle ordering while
  extracting policy and bounded helpers.
- `src/core/loop/mission-continuation.ts`: pure verification-count and
  continuation-state policy.
- Unit, integration, package, and distribution tests covering these contracts.
- README, architecture, ADR/review records, and `AGENT_MEMORY.md`.

## Execution

1. Add failing dependency, package-entry, circuit, and pure-policy tests.
2. Update the OpenCode packages to the current matched release.
3. Add the explicit `./server` package export while retaining the compatible
   function entrypoint.
4. Extract continuation policy and split idle/injection effects into small
   helpers. Preserve abort, ownership, activity, task, compaction, mission
   identity, ledger, memory, toast, and timer ordering.
5. Update operator documentation and architectural records.
6. Run focused tests, TypeScript build/type generation, full tests, coverage,
   npm audit, package contents/install smoke tests, Rust tests/format/clippy,
   and Docker distribution builds.
7. Commit the refactor, run the repository patch-release pipeline, publish,
   push `main` and the release tag, then verify GitHub and npm state.

## Impact and rollback

The runtime behavior is intended to remain stable except for one defect fix:
normal repeated tool use must not open the output-stagnation circuit. Rollback
is a revert of the refactor commit followed by a new patch version because npm
versions are immutable.
