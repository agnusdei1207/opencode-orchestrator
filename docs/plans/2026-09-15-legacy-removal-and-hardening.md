# Legacy removal and runtime hardening plan

Date: 2026-09-15
Status: Implemented; patch release pending

## Target and reason

Remove internal TypeScript modules that cannot be reached from the shipped
plugin entrypoint, remove runtime projections that have no consumer, and fix
security and release defects found by a second full-source audit. Keep the
root plugin contract and every currently registered tool unchanged.

The baseline is release `1.7.19` at `a3112c017d7c5b02c38370783769dadf9e23fe8c`.
All 116 Vitest files and 1,096 tests passed before implementation. A TypeScript
AST import graph found 207 source files, 17 unreachable files, and two circular
dependency groups. Knip independently reported the same unreachable source
families. Direct process-call review found OS notification text interpolated
into shell commands. Cargo metadata also declared a different license from the
repository and several dependencies absent from all Rust source.

## Options considered

1. Delete only proven internal legacy and harden existing behavior. This is the
   selected option because it reduces the shipped declarations and runtime
   coupling without removing a supported OpenCode tool or changing mission
   data.
2. Complete ADR-0021 by removing the custom toolbelt, Rust bridge, agent pool,
   and background runtime in one change. This changes public behavior and still
   lacks a verified native background-delivery replacement, so it remains a
   separately versioned compatibility migration.

## Affected areas

- `src/core/queue/`, `src/core/task/`, `src/core/session/`,
  `src/core/recovery/`, and unused barrel modules: delete code whose only
  consumers are its own tests or cleanup calls.
- `src/core/progress/` and agent manager components: remove the broadcaster
  projection whose sole runtime subscriber has no effect, then eliminate the
  resulting manager cycle.
- `src/core/async/`: retain the timeout primitive used by session and context
  code without retaining the obsolete queue family.
- `src/core/notification/os-notify/`: replace shell command construction with
  executable-plus-argument calls and preserve platform behavior.
- Cargo manifests and lockfile: align the license with `LICENSE` and remove
  dependencies with no Rust consumer.
- Rust CLI configuration commands: use OpenCode's current config-root
  precedence, preserve invalid files, recognize tuple/versioned plugin entries,
  back up mutations, and leave unrelated MCP configuration untouched.
- Development toolchain: move to TypeScript 7 and Vitest 5, explicitly load
  Node types, and use `es-module-lexer` for the source-graph regression test.
- Local and GitHub release definitions: remove destructive/stale legacy paths,
  make the Docker build command cross-platform, expose the documented npm CLI,
  and make release QA deterministic across all five platform artifacts.
- Structural, notification, release, package, and affected unit tests.

## Execution

1. Add failing source-reachability, cycle, notification process-boundary,
   license, and release-hardening tests.
2. Delete each unreachable family together with tests that only assert that
   family exists. Update every import, cleanup owner, and barrel assertion.
3. Replace the generic recovery detour with the rate-limit behavior actually
   consumed by session recovery.
4. Remove the no-op progress broadcaster and direct manager references.
5. Harden notification process execution and command-path parsing.
6. Prune manifest-only Rust dependencies and obsolete local release paths.
7. Harden the retained Rust CLI install/uninstall boundary without changing
   the npm install hook, which remains the JSONC-aware registration path.
8. Re-run the source graph, Knip, build, typecheck, full tests, coverage, npm
   audit, package smoke, Rust format/Clippy/tests, and native OpenCode host QA.
9. Compare the refreshed OpenCode and `oh-my-openagent` package boundaries;
   retain this plugin's contracts while adopting only the small launcher and
   version-matched artifact checks needed for a reliable install.
10. Reopen all changed files, update ADR/review/memory records, and complete the
   authorized commit, push, and patch-release flow if every gate passes.

## Expected impact and rollback

The npm tarball should contain fewer declaration files and the production
module graph should have no unreachable source or circular dependency. OS
notifications continue to use the same native programs while treating all
titles, messages, and paths as arguments. No user data migration is involved.
The Rust CLI now refuses to rewrite malformed or commented JSONC; npm
postinstall remains the supported JSONC-preserving path.
The `orchestrator` command resolves only a binary for the declared supported
OS/CPU matrix. Release publishing moves to the tag-triggered hosted workflow so
an npm package cannot be assembled from only the two locally built Linux files.
Rollback is a revert of the implementation commit followed by a new patch
version if the release has already been published.
