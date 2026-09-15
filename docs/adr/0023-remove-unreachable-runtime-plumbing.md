# ADR-0023: Remove Unreachable Runtime Plumbing

Date: 2026-09-15 18:20 KST
Status: Implemented
Source: `docs/plans/2026-09-15-legacy-removal-and-hardening.md`

## Context

An import-graph survey from the shipped `src/index.ts` entrypoint found 17 of
207 TypeScript source files unreachable and two circular dependency groups.
Several additional modules only projected task/session/progress state to
consumers that performed no action. OS notification values were interpolated
into shell command strings, and the secondary Rust CLI installer used a legacy
Windows config path and replaced malformed configuration with an empty object.

## Decision

- Delete internal queue, task, session projection, generic recovery, progress
  broadcaster, TODO parser, and barrel modules once all production consumers
  are proven absent. Delete tests that only preserve those implementations.
- Keep the timeout behavior still used by session and context code as the small
  `src/core/async/with-timeout.ts` primitive.
- Keep rate-limit recovery in `session-recovery.ts`, its only runtime owner,
  rather than retaining a generic recovery framework.
- Require OS notification and sound processes to use fixed executables plus
  argument arrays or child-only environment variables. User-controlled text
  must never become shell source.
- Keep the Rust CLI install/uninstall commands for compatibility, but align
  their path precedence with OpenCode, prefer existing `opencode.jsonc`, reject
  non-strict JSON without modifying it, recognize versioned and tuple plugin
  entries, back up writes, and never remove unrelated `mcp.orchestrator` data.
- Make source reachability and cycle checks permanent tests. Move development
  tooling to TypeScript 7 and Vitest 5; use `es-module-lexer` instead of a
  compiler-internal AST API for the graph test.
- Require coverage, npm audit, dependency-tree validation, Rust formatting,
  Clippy with warnings denied, and Rust tests in local and GitHub release gates.
- Expose the documented `orchestrator` command through a small Node launcher.
  Reject unsupported targets rather than selecting an incompatible binary.
- Publish only from a version-matched tag after the hosted matrix assembles and
  validates all five platform binaries and an isolated package smoke passes.
- Remove the undocumented scoped GitHub Packages rewrite. Its package identity
  diverged from the install hook's OpenCode registration identity; npm remains
  the supported package registry and GitHub Releases carry binary assets.
- Defer public tool, Rust bridge, and bounded task-runtime removal to the
  compatibility migration governed by ADR-0021.

## Consequences

The production TypeScript graph now has 185 files, all reachable from the two
shipped entrypoints, and no dependency cycle. Twenty-three source modules and
eight implementation-only test files were removed. Using the same static
thresholds, oversized or complex function findings fell from 55 to 40.

The retained plugin tools and root/`./server` package exports are unchanged.
The npm package now creates the documented `orchestrator` command, while the
launcher reuses the plugin runtime's platform mapping and never invokes a
shell. Hosted publishing rejects missing, extra, stale-version, or
wrong-architecture artifacts before registry writes. Release binaries are
ignored build outputs rather than tracked source files, so the version tag
cannot contain an artifact with an older embedded version.
Notification tests cover malicious quotes, command substitutions, newlines,
and platform-specific execution. Rust CLI configuration tests cover path
selection, malformed input preservation, tuple/version detection, scoped
uninstall, backup creation, and write verification.

The npm hook remains the normal installation path because it preserves JSONC
comments. The Rust command deliberately refuses commented JSONC instead of
rewriting it. Stateful process-pool and task-runtime functions remain larger
than the repository's preferred limits; their behavioral suites stay in place
until ADR-0021's public compatibility gates permit removal.
