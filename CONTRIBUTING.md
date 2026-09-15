# Contributing to OpenCode Orchestrator 🦀

Last updated: 2026-09-15 KST

OpenCode Orchestrator uses TypeScript for the OpenCode plugin boundary and Rust
for its retained search, AST, LSP, config, and operator CLI paths.

---

## 🏗️ Architecture Overview

The plugin provides four agent presets:
- **Commander**: Mission orchestration and execution.
- **Planner**: Strategic planning and initial research.
- **Worker**: Implementation, refactoring, and documentation.
- **Reviewer**: Verification, context management, and quality control.

### Hybrid Core
- **Frontend**: TypeScript (Node.js) handles the OpenCode Plugin API and Agent LLM logic.
- **Backend**: Rust (`orchestrator-cli`) handles performance-critical tools via **JSON-RPC over stdio**.

---

## 🚀 Development Setup

### Prerequisites
- **Node.js**: `>=24.15.0`
- **Rust**: `1.98.1` (with `cargo`), matching CI and release builders
- **OpenCode**: Installed locally

### Quick Start
```bash
# Install dependencies
npm install

# Build TypeScript and the two Linux Rust distribution artifacts
npm run build:all

# Start OpenCode and see the "Orchestrator" in action!
```

---

## 🛠️ Scripts & Tools

| Command | Description |
|---------|-------------|
| `npm run build` | Build the TypeScript plugin and install hook bundles |
| `npm run build:all` | Build TypeScript and the Linux x64/arm64 Rust artifacts |
| `cargo test --workspace --all-targets` | Run Rust tests |
| `npm run test:all` | Run TypeScript build and Vitest suite |
| `npm run release:dry-run` | Run local release preflight and an isolated packed-install smoke |
| `npm run release:patch` | Bump and verify the version, then push `main` and its exact tag for hosted publishing |
| `npm run log` | Follow orchestrator logs with the cross-platform Node helper |

---

## 🧪 Testing Strategy

We maintain strict verification across the entire stack.

### 1. Rust Core Tests
Located in `crates/orchestrator-core` and `crates/orchestrator-cli`.
```bash
cargo test --workspace --all-targets
```

### 2. TypeScript Unit Tests
Testing the agent logic and state management.
```bash
npm run test:unit
```

### 3. JSON-RPC Bridge (E2E)
Verifies the actual communication between TS and the Rust binary.
```bash
npx vitest tests/e2e/json-rpc-bridge.test.ts
```

### 4. Full System E2E
Tests background tasks, parallel sessions, and real-world scenarios.
```bash
npm run test:e2e
```

---

## 📜 Coding Standards

### 1. Synchronization (CRITICAL)
Since we use JSON-RPC for communication, **Constants must be synchronized**.
- **Rust**: `crates/orchestrator-core/src/constants.rs`
- **TypeScript**: `src/shared/core/constants/` and tool definitions.
Always update both sides when adding new tools, agents, or status labels.

### 2. Tool Implementation
- Keep the OpenCode plugin boundary and orchestration state in **TypeScript**.
- Keep existing Rust search, AST, LSP, and operator CLI behavior synchronized
  with the TypeScript tool contracts until ADR-0021's migration gates are met.

### 3. Logging
Use the centralized logger (`src/core/agents/logger.ts`) in plugin runtime code
and `tracing` in the Rust stdio server. Standalone install and release scripts
may write to their own terminal; the JSON-RPC stdout channel may not.

---

## 📦 Release Process

```bash
npm run release:patch   # Bug fixes
npm run release:minor   # New features / Agent upgrades
```
The release command creates a version commit and exact tag only after a clean
worktree check, runs the complete local preflight, and pushes `main` plus that
tag. The tag-triggered GitHub workflow is the sole publisher. It builds all five
Linux/macOS/Windows artifacts from the tag, verifies their format, architecture,
and embedded version, smoke-tests the assembled npm package, publishes both
the npm package and GitHub release. Branch-only manual workflow runs do
not publish.

Use `npm run release:dry-run` first to run build, coverage, Rust formatting,
Clippy, Rust tests, audit, dependency validation, and the isolated package smoke
without publishing.

Installation hooks are bootstrapped through `scripts/run-install-hook.mjs`.
They prefer built `dist/scripts/*.js`, fall back to source `scripts/*.ts` in a source checkout, prefer `opencode.jsonc` over `opencode.json`, preserve sibling plugin entries/comments, and no-op in CI to avoid mutating runner config.
