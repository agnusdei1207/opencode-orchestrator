# Legacy Removal and Runtime Hardening Review

Date: 2026-09-15
Baseline: `opencode-orchestrator@1.7.19` at
`a3112c017d7c5b02c38370783769dadf9e23fe8c`
Release target: `1.7.21`

## Scope and method

The survey traced every TypeScript source import from the shipped
`src/index.ts` entrypoint, package exports, OpenCode hook registration, dynamic
imports, build inputs, public landing assets, process boundaries, configuration
writers, Cargo manifests, release workflows, and tests. The baseline full suite
passed 116 files and 1,096 tests before removal. Its graph contained 207 source
files, 17 initially unreachable files, and two circular dependency groups.

The current OpenCode source was used as the authority for package discovery,
`./server` loading, configuration paths, and its experimental background-agent
boundary. The refreshed sibling `oh-my-openagent` source was reviewed only for
packaged CLI dispatch and platform-version integrity patterns. The implementation
retains this project's smaller package layout and plugin behavior. The requested
`../memory` material is present as `../my-memory`; its development methodology's
zero-omission, producer-to-consumer, package-boundary, and evidence rules were
applied to this review.

Deletion required both import-graph evidence and a consumer review. Tests whose
only purpose was to preserve an unreachable implementation were removed with
that implementation. Runtime behavior still consumed through another path was
kept or moved to a smaller owner. Public OpenCode tools, agent names, hook
contracts, package root, and `./server` export were held constant.

## Findings and changes

### Runtime structure

- Removed 23 TypeScript source modules across obsolete queue/task stores,
  session projections, generic retry/recovery, no-op progress broadcasting, an
  unused TODO parser, and redundant barrels. Eight implementation-only test
  files left with those modules.
- Preserved the used timeout operation in
  `src/core/async/with-timeout.ts`. Preserved the actual rate-limit warning and
  backoff directly in `session-recovery.ts`.
- Split manager construction, task launching/polling, background command
  lifecycle, mission-loop parsing, and mission-memory note generation into
  smaller typed helpers. Existing state transitions and output formats remain
  covered by regression tests.
- Added a permanent production source-graph test. The final graph contains 185
  reachable files out of 185 across the plugin and CLI entrypoints, with no
  cycle. The same static size/parameter/
  complexity scan fell from 55 findings at the task baseline to 40.

### Process and configuration safety

- Replaced notification shell strings with `execFile` calls. Linux and macOS
  receive user text as arguments; Windows receives it through child-only
  environment variables consumed by a fixed PowerShell script. Sound paths and
  executable discovery follow the same boundary.
- Added malicious title/message/path cases containing quotes, newlines, shell
  substitutions, and separators. Tests assert that the shell-string `exec`
  API is never called.
- Moved Rust CLI configuration logic out of `main.rs`. It now follows
  `OPENCODE_CONFIG_DIR` → `XDG_CONFIG_HOME/opencode` →
  `~/.config/opencode`, prefers an existing `opencode.jsonc`, recognizes plain,
  versioned, and tuple registrations, backs up and verifies writes, and removes
  only this plugin. Invalid or commented JSONC is left untouched with an error;
  the npm hook remains the JSONC-aware installation path.

### Dependencies and release paths

- Aligned npm and Cargo licensing on MIT, removed unused Rust workspace/core
  dependencies, and refreshed all compatible transitive versions in
  `Cargo.lock`.
- Confirmed the current OpenCode host, plugin package, and SDK are all
  `1.18.31`. Updated TypeScript to `7.0.2`, Vitest and coverage-v8 to `5.0.1`,
  esbuild to `0.28.2`, and Node 24 types to `24.13.4`. TypeScript 7 now receives
  an explicit Node type set. The graph test uses `es-module-lexer@3.0.2` because
  TypeScript 7 no longer exposes the former stable compiler AST entrypoint.
- Retained Node 24 types rather than Node 26 types because Node `>=24.15.0` is
  the supported runtime baseline and Vitest 5 supports that line.
- Pinned Docker and hosted Rust builds to stable `1.98.1`; this also avoids the
  upstream `1.98.0` compiler miscompilation fixed by that point release. Updated
  Checkout and Setup Node action majors across CI, Pages, and release workflows.
- Removed destructive local reset scripts and the duplicate Compose npm release
  service. The Docker Linux build no longer depends on host `sudo`, `id`, or
  command substitution.
- Added a GitHub release QA job and made publishing depend on both QA and the
  platform build matrix. Publishing now runs only from a package-version-matched
  tag, after exact-set/header/architecture/version validation for all five
  binaries and an isolated packed-install smoke. The documented `orchestrator`
  command is now a real npm bin entry backed by a shell-free Node launcher.
  The undocumented scoped GitHub Packages rewrite was removed because its
  package name did not match the plugin name registered by its install hook;
  npm is the single supported package registry.
  The release push sends the branch and exact version tag atomically. macOS
  artifacts build on native Intel and Arm runners, and an empty GitHub Release
  artifact glob fails the release.
  Versioned binaries are generated artifacts under ignored `bin/`; the source
  tag cannot retain a tracked binary with an older embedded version.
  Local preflight runs coverage, Rust fmt, Clippy with warnings denied, Rust
  tests, npm audit, dependency validation, and a packed-install smoke; its
  Docker fallback installs the required Rust components without resetting the
  image PATH.
- Replaced the development-only POSIX `tail` command substitution with a tested
  Node log follower, so `npm run log` works from Windows as well as Unix shells.

## Verification before release

- Node `24.19.0`, npm `11.17.0`, TypeScript `7.0.2`, Vitest `5.0.1`.
- Build and standalone `tsc --noEmit`: passed.
- Vitest: 115 files and 1,021 tests passed.
- Coverage: 90.37% statements, 80.62% branches, 93.28% functions, and 92.50%
  lines; every configured threshold passed.
- Rust: formatting and workspace/all-target Clippy passed with warnings denied;
  19 CLI tests and 45 core tests passed (64 total).
- Isolated OpenCode host: 14 of 14 scenarios passed against host/SDK `1.18.31`,
  including plugin hook loading, child task/resume paths, mission start/stop,
  abort, compaction, and restart persistence.
- Dependency tree: valid; production packages resolve to current registry
  versions. `npm audit` reports zero vulnerabilities.
- Dependency freshness: `cargo update --dry-run` locked zero additional
  compatible updates. `npm outdated` reports only Node 26 type definitions;
  the project intentionally stays on the latest Node 24 type line to match its
  supported runtime.
- Workflow syntax and shell fragments: actionlint `1.7.12` passed all GitHub
  workflow files.
- Packed-install smoke: postinstall registered the plugin in an isolated XDG
  config, root plus `/server` imports resolved to the same function export, and
  the installed Windows npm command reported the package version.
- Artifact smoke: freshly built Linux x64, Linux arm64, and Windows x64
  executables all reported `1.7.19`; ELF and PE architecture checks passed.
- Knip's normal scan retained six known dynamic/build assets: the canonical and
  mirrored landing-page `i18n.js`/`scene.js` files plus the two install-hook
  TypeScript inputs bundled by `build.mjs`. The import graph, build, package
  contents, and browser references verify their consumers. Its remaining
  `opencode-config.ts` export report is a static-entrypoint false positive: both
  bundled install hooks import those symbols. Platform QA binaries reported by
  Knip are fixed executable names, not package dependencies.

## Residual limits

Native OpenCode background-task behavior still lacks a released public contract,
so the bounded task runtime and Rust bridge remain. Their stateful process and
polling functions account for several of the remaining 40 static complexity
findings. Public removal stays under ADR-0021 and requires a compatibility
release with replacement-path tests.

No absolute correctness or performance claim is made. The evidence establishes
the enumerated platforms, package boundaries, and test scenarios. A runtime
benchmark was outside this refactor because no performance result was needed to
justify removal of unreachable code.

## Release record

The `v1.7.20` tag at `cd69c5cb4fd8bad840113c9956c384546f61b3fb`
completed the hosted quality gate and all five native builds. Artifact
header/architecture/version verification also passed. The release job then
stopped before npm publication because its isolated checkout had not built the
ignored `dist/` output before running the packed-package smoke test. The smoke
test correctly rejected the package when its postinstall entrypoint was absent.

The release workflow now builds the publishable package in the release job
after `npm ci` and before artifact assembly, package smoke, and publication. A
workflow-order regression test covers that boundary. Reproduction in a clean
Node `24.20.0` Linux container, starting without `node_modules` or `dist`, then
passed the build, isolated packed install, config registration, package entry
imports, and Linux CLI execution with all five hosted `1.7.20` artifacts.

The correction was committed as `1857e8559c9c2655d4fbe5aa3d491fec358ed446`.
Patch commit `49717319d5a0928327031c64019de68d5ef49d4f` and tag
`v1.7.21` were pushed atomically. Hosted run
[`34960594424`](https://github.com/agnusdei1207/opencode-orchestrator/actions/runs/34960594424)
passed its quality gate, five native build jobs, exact artifact verification,
packed-package smoke, npm publish, and GitHub Release creation on the first
attempt. The resulting
[`v1.7.21` release](https://github.com/agnusdei1207/opencode-orchestrator/releases/tag/v1.7.21)
contains exactly the five expected native assets.

npm reports `opencode-orchestrator@1.7.21` with 204 files, 26,544,115 unpacked
bytes, SHA-1 `77717c55fd8456c83f3796c3d0ececdaae5e5d39`, and integrity
`sha512-FqfLD1OQ9aP1GrMGpH0Dz/LlCrhvTLWqiVXGAgtTfVQKc8xUsnYHZunTUMTq70941spdo0o0l76qq4u5f3qF7w==`.
Fresh registry installs on Windows and Linux registered the plugin in isolated
OpenCode configuration, exposed only the same default function through the
package root and `/server`, contained exactly five validated native artifacts,
and executed the platform CLI as `1.7.21`.

After registry verification, generated `dist/` and `bin/` outputs were removed,
Compose volumes were deleted, `docker system prune -af --volumes` reclaimed
5.332 GB, and the remaining Docker image, container, volume, and build-cache
usage was 0 B.
