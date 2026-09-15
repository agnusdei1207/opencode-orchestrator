# OpenCode Compatibility and Refactor Review

Date: 2026-09-15
Target baseline: `a8f318192275e255636f10fbb18cd75d7c9c232b`
Release candidate: `1.7.19`

## Scope and sources

The review covered every production TypeScript file under `src/` and traced the
public package entry, OpenCode hooks, runtime initialization and shutdown,
mission idle continuation, progress state, error recovery, package exports,
dependencies, and distribution tests. The AST survey covered 207 files and
1,123 function-like nodes after the refactor.

Compatibility evidence came from:

- OpenCode `dev` at `e03db9bc6908f75c9334d8aa997deeaac81c0298`,
  including plugin types, package entry resolution, module detection, legacy
  function loading, and hook dispatch.
- Oh My OpenAgent `dev` at
  `db37b83aff8f577cb1da65c3d85a7f90bed67be7`, limited to its thin OpenCode
  adapter and `{ id, server }` export structure. No source or prompts were
  copied.
- Published OpenCode host, plugin, and SDK version `1.18.31`.

## Findings and changes

1. The package depended on OpenCode integration packages `1.17.18` while the
   released host was `1.18.31`. Both dependencies are now pinned together at
   `1.18.31`, and the Node engine matches their resolved dependency floor.
2. The package had only a root export. Current OpenCode source prefers
   `exports["./server"]`; that subpath now resolves to the same built entry.
3. Runtime construction and lifecycle registration occupied the public plugin
   function. `src/index.ts` now composes hooks, while `src/plugin-runtime.ts`
   owns configuration, managers, handler state, timers, and shutdown wiring.
4. Mission continuation used the general circuit check, so three legitimate
   same-named tool calls could stop a mission. The mission path now trips only
   for repeated identical text-only turns. Tests cover both signals.
5. Mission verification-state updates, progress observation, session storage,
   and recovery effects mixed policy with orchestration. They were split into
   typed helpers; unused session-state fields were removed.

Using the same static method before and after, functions outside the repository
limits (more than 40 lines, more than four parameters, or approximate cyclomatic
complexity above 10) fell from 62 to 55. Six changed-path offenders (plugin
bootstrap, mission idle handling, continuation injection, progress tracking,
session-state creation, and error recovery) no longer appear in that report.
The remaining 55 are pre-existing work across the Rust bridge, task manager,
mission parser/memory, configuration, and utility code. They are recorded
rather than mixed into this compatibility patch without behavioral need;
ADR-0021 defines the deletion-first path for those subsystems.

## Connection contract

The installer registers `"opencode-orchestrator"` in OpenCode's plugin array.
Manual configuration may use that string or `["opencode-orchestrator", options]`.
Both package root and `/server` resolve to `dist/index.js`, whose default export
remains the supported function plugin. Runtime options flow from OpenCode into
`parseOrchestratorPluginOptions()`, then into concurrency, mission, and context
configuration before hook factories receive their shared context.

Shutdown owns the cleanup scheduler, Rust pool, background manager, agent
manager, circuit/compaction/session maps, pending injection state, progress
tracker, and mission-loop store. Distribution tests import both public package
paths, and the live host runner loads the built plugin in an isolated profile.

## Verification record

- Environment: Node `24.19.0`, npm `11.17.0`, OpenCode `1.18.31`, Windows host,
  and the repository's Linux Docker toolchain.
- TypeScript build and standalone `tsc --noEmit`: passed.
- Full Vitest run: 116 files and 1,096 tests passed.
- Coverage: 89.97% statements, 80.15% branches, 92.71% functions, and
  92.23% lines; every configured threshold passed.
- Isolated native-host suite: 14 of 14 scenarios passed with OpenCode `1.18.31`,
  SDK `1.18.31`, and the local `dist/index.js`.
- Packed-install smoke test: the tarball installed under an isolated HOME and
  config root; postinstall registered `opencode-orchestrator` in
  `opencode.jsonc`; package root and `/server` both imported the function
  entrypoint.
- Rust: `cargo fmt --check`, workspace/all-target Clippy with `-D warnings`, and
  all 57 tests passed through `scripts/dbuild.ps1`.
- Dependency tree: `npm ls` reported no invalid required dependency. OpenTUI
  peers are optional host integrations.
- Security audit: npm reported zero vulnerabilities at every severity.
- Final package dry run: 220 files, 4,161,661 packed bytes, and 12,386,485
  unpacked bytes. Its SHA-1 was
  `759090b0042fae447e9586dda91a7ed6dbccf5c0`.
- Static comparison: 62 baseline findings to 55 after refactoring.

## Release record

- The clean `release:preflight` gate passed at version `1.7.19`, including the
  Node, Rust, audit, and package checks above.
- Versioned Linux x64 and arm64 distribution builds passed. Both artifacts are
  ELF64 for their declared architecture; the x64 artifact reported `1.7.19` in
  a clean Linux container. Their SHA-256 values are
  `49f0bb0fc8fbd8551620091f73c073e8541f9464ac841cfdec5eb12128af5f12`
  and `f1c7e611363502323f8c0128bfa1a20ad0c1aef390bbfccb873ade61e25c2194`.
- npm published `opencode-orchestrator@1.7.19` under `latest`. Registry metadata
  returned the same package SHA-1 and integrity
  `sha512-6UhS+q8ZTAS9prpBStAf3+nD893jl1hmJB52AZrwQ1G7sZ0IgQ7PosmQQxszJKmr3Z5l2khg31cvXV3hXsMQug==`.
- A fresh registry install under isolated home and config directories ran the
  postinstall registration, imported both public paths, and confirmed they
  expose the same plugin function.
- Remote `main` and `v1.7.19` both resolved to release commit
  `fefd948bdd48f1cb750ab9e007fbab65c713a055` before this documentation commit.
- Docker cleanup removed the project cache volumes and every unused Docker
  image and volume. `docker system df` fell from 2.312 GB of images and 4.941 GB
  of volumes to zero for images, containers, volumes, and build cache.

No performance gain is claimed because this change did not include a runtime
benchmark.
