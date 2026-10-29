# Contributing to OpenCode Orchestrator

Last updated: 2026-10-29 07:38 KST

OpenCode Orchestrator is an OpenCode 2 plugin that keeps a mission and its
unfinished work connected across turns. OpenCode owns execution: delegation
(its `subagent` tool), shell and background commands, search, editing,
sessions and compaction. The plugin adds mission state, the continuation loop,
safety hooks, four agent presets and one tool, `update_todo`.

The repository also contains a standalone Rust terminal CLI (`orchestrator`,
`crates/`). The plugin does not call it; `dist/cli.js` only launches the
platform binary when one is installed.

---

## Architecture Overview

Agent presets:
- **Commander**: owns the goal, implements small work directly, verifies, and
  delegates bounded scopes with OpenCode's `subagent` tool when useful.
- **Planner**: planning and research.
- **Worker**: implementation.
- **Reviewer**: independent verification.

Planner, Worker and Reviewer are terminal agents: they are denied the
`subagent` tool.

Code layout:
- `src/host/`: the OpenCode 2 plugin boundary (registration, events, tools).
- `src/plugin-handlers/`, `src/hooks/`: event handling and safety hooks.
- `src/core/`: mission loop, session state, recovery, TODO and mission memory.
- `crates/`: the Rust CLI.

---

## Development Setup

### Prerequisites
- **Node.js**: `>=24`
- **OpenCode 2**: installed locally (OpenCode 1 is not supported; see ADR-0028)
- For Rust/CLI work only:
  - **Rust** `1.98.1` with `cargo`, matching CI and release builders, or
  - **Docker** with Compose, used by `npm run build:all`, the `docker:*`
    scripts, and the release preflight when `cargo` is unavailable.

### Quick Start
```bash
npm install
npm run build
npm test
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Type-check `src/`, then bundle the plugin and CLI launcher into `dist/` |
| `npm test` | Run the Vitest suite (suites that need `dist/` or the Rust binary are skipped without them) |
| `npm run test:all` | Build, then run the Vitest suite |
| `npm run test:coverage` | Run the Vitest suite with the coverage thresholds used by CI and release |
| `npm run typecheck:test` | Type-check `src/` and `tests/` together |
| `npm run build:all` | Build TypeScript and the Linux x64/arm64 Rust binaries (Docker) |
| `cargo test --locked --workspace --all-targets` | Run Rust tests |
| `npm run release:dry-run` | Run the local release preflight and an isolated packed-install smoke |
| `npm run release:patch` | Bump and verify the version, then push `main` and its exact tag for hosted publishing |

---

## Testing

```bash
npm test                      # everything
npm run test:unit             # tests/unit
npm run test:e2e              # tests/e2e
cargo test --locked --workspace --all-targets
```

The end-to-end suites run the built `dist/index.js` and the Rust binary; build
them first (`npm run build`, `npm run build:all`) or they are reported as
skipped.

---

## Coding Standards

### Logging
Use the centralized logger (`src/shared/logger.ts`) in plugin runtime code.
Standalone release scripts and the Rust CLI may write to their own terminal.

### Scripts
Release and packaging scripts share their process helpers through
`scripts/lib.mjs`.

---

## Release Process

The package's only runtime dependency is `zod`. `@opencode/plugin` is a
development-only type contract; OpenCode 2 supplies the plugin context at
runtime. The root manifest's `"zod": "$zod"` override makes that contract
resolve the same Zod as the runtime. npm overrides apply only at the installing
project's root.

The published package contains only the two bundles (`dist/index.js`,
`dist/cli.js`), a hand-written `dist/index.d.ts` that types the default export,
the JSON schema, README and LICENSE.

```bash
npm run release:patch   # Bug fixes
npm run release:minor   # New features
npm run release:major   # Breaking changes
```
The release command creates a version commit and exact tag only after a clean
worktree check, runs the complete local preflight, and pushes `main` plus that
tag. The tag-triggered GitHub workflow is the sole publisher. It builds all five
Linux/macOS/Windows binaries from the tag, verifies their format, architecture,
and embedded version, smoke-tests the assembled npm package, and publishes both
the npm package and the GitHub release. Branch-only manual workflow runs do
not publish.

The hosted workflow builds explicitly and publishes with `--ignore-scripts`, so
`prepublishOnly` (`npm run build`) only guards a manual `npm publish`.

Use `npm run release:dry-run` first to run build, coverage, Rust formatting,
Clippy, Rust tests, audit, dependency validation, and the isolated package smoke
without publishing.

The npm package has no install or uninstall hook. OpenCode 2 manages package
registration through `opencode plugin add/remove`.
