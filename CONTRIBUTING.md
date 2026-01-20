# Contributing to OpenCode Orchestrator 🦀

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
- **Node.js**: v18+ 
- **Rust**: Latest stable (with `cargo`)
- **OpenCode**: Installed locally

### Quick Start
```bash
# Install dependencies
npm install

# Build everything (TS + Rust) and link locally
npm run build:all
npm run dev:link

# Start OpenCode and see the "Orchestrator" in action!
```

---

## 🛠️ Scripts & Tools

| Command | Description |
|---------|-------------|
| `npm run build:all` | **Recommended**: Complete build of TS and Rust components |
| `npm run rust:build` | Build Rust binary only |
| `npm run rust:test` | Run Rust unit and integration tests |
| `npm run test:all` | **Full Suite**: Runs Rust tests + TS tests + E2E Bridge tests |
| `npm run dev:link` | Link current build to OpenCode for development |
| `npm run dev:unlink`| Remove local link |
| `npm run log` | Follow real-time logs of the orchestrator |

---

## 🧪 Testing Strategy

We maintain strict verification across the entire stack.

### 1. Rust Core Tests
Located in `crates/orchestrator-core` and `crates/orchestrator-cli`.
```bash
npm run rust:test
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
