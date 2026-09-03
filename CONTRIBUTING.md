# Contributing to OpenCode Orchestrator 🦀

Last updated: 2026-09-03 22:52 KST

Welcome to the OpenCode Orchestrator development guide. This project uses a high-performance hybrid architecture combining **TypeScript** for agent orchestration and **Rust** for core tool execution.

---

## 🏗️ Architecture Overview

The system is built on a **4-Agent Cognitive Architecture**:
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
- **Node.js**: v24+ (Latest LTS)
- **Rust**: Latest stable (with `cargo`)
- **OpenCode**: Installed locally

### Quick Start
```bash
# Install dependencies
npm install

# Build TypeScript and Docker-based Rust distribution artifacts
npm run build:all

# Start OpenCode and see the "Orchestrator" in action!
```

---

## 🛠️ Scripts & Tools

| Command | Description |
|---------|-------------|
| `npm run build` | Build the TypeScript plugin and install hook bundles |
| `npm run build:all` | Build TypeScript and Docker-based Rust distribution artifacts |
| `cargo test --workspace --all-targets` | Run Rust tests |
| `npm run test:all` | Run TypeScript build and Vitest suite |
| `npm run release:dry-run` | Run local release preflight and package dry-run |
| `npm run release:patch` | Verify npm auth, bump patch version, rebuild release artifacts, and publish |
| `npm run log` | Follow real-time logs of the orchestrator |

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
- Performance-heavy tools (Search, AST, Diff) should be implemented in **Rust**.
- UI-heavy or complex logic flows should be handled in **TypeScript**.

### 3. Logging
Always use the centralized logger (`src/core/agents/logger.ts`) in TS and `tracing` in Rust. Do not use `console.log` as it can corrupt the OpenCode TUI.

---

## 📦 Release Process

```bash
npm run release:patch   # Bug fixes
npm run release:minor   # New features / Agent upgrades
```
Releases automatically handle binary distribution for multiple architectures (Windows/macOS/Linux).
Patch/minor/major release scripts verify npm authentication before `npm version` so a missing token cannot leave behind a local version commit or tag.
Use `npm run release:dry-run` first to run build, tests, Rust tests, audit, and package dry-run without publishing.

Installation hooks are bootstrapped through `scripts/run-install-hook.mjs`.
They prefer built `dist/scripts/*.js`, fall back to source `scripts/*.ts` in a source checkout, prefer `opencode.jsonc` over `opencode.json`, preserve sibling plugin entries/comments, and no-op in CI to avoid mutating runner config.
