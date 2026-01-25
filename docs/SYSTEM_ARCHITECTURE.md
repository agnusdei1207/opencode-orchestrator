# System Architecture

## Overview
OpenCode Orchestrator is a plugin for OpenCode that implements a specialized **Multi-Agent Architecture** governed by strict protocols. The system transforms a single user prompt into a coordinated effort between Commander, Planner, Worker, and Reviewer agents.

## Core Components

### 1. Parallel Agent Manager
- **Role**: The central coordinator that manages the lifecycle of independent agent sessions (`ParallelTask`).
- **Responsibility**:
    - Spawning isolated sessions via `SessionPool`.
    - Managing concurrency slots (`ConcurrencyController`).
    - Handling task states (Pend/Run/Comp/Fail).

### 2. Event-Driven Pipeline
The architecture utilizes a hybrid event-driven approach for maximum responsiveness and reliability:
- **EventHandler**: Listens to OpenCode native events (`session.idle`, `message.updated`) to trigger immediate state transitions.
- **TaskPoller**: Complements events with periodic health checks and progress stats aggregation (Tool Call tracking).

### 3. Native TUI Integration
To ensure compatibility with OpenCode's TUI and avoid rendering conflicts:
- **TaskToastManager**: The single source of truth for user feedback.
- **Mechanism**: Utilizes `client.tui.showToast` to display:
    - Task Start/Completion
    - Real-time Progress Bars
    - concurrency Wait-times
    - Mission Success/Failure summaries.

### 4. Configuration Safeties
- **Agent Registry**: Loads agent definitions from `agents.json`.
- **Zod Validation**: Enforces strict schema validation at runtime to prevent invalid agent configs from crashing the system.

## Data Flow
1. **User Command** (`/task`) -> `ChatMessageHandler`
2. **Launch**: `TaskLauncher` creates sessions -> `TaskStore`
3. **Execution**:
    - `ConcurrencyController` authorizes execution.
    - `TaskLauncher` fires the initial prompt.
4. **Monitoring**:
    - `EventHandler` watches for output/idle.
    - `TaskToastManager` updates UI.
5. **Completion**:
    - Task marked `COMPLETED`.
    - `TodoList` updated.
    - Parent notified.

## Technology Stack
- **Runtime**: Node.js (OpenCode Plugin)
- **Language**: TypeScript (Strict)
- **Validation**: Zod
- **Build**: esbuild, tsc