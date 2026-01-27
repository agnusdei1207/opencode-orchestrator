# System Architecture (v2)

## Overview
OpenCode Orchestrator has evolved into a **Native-First Autonomous Engine**. It leverages OpenCode's native Todo and Session APIs to orchestrate complex engineering tasks with high reliability and low overhead.

## Core Design Principles
1. **Native-First**: Minimize custom state management; use OpenCode's built-in Todo and Session management.
2. **Resource Integrity**: Every spawned session, timer, and interval is strictly tracked and cleared.
3. **Adaptive Execution**: Concurrency and strategy adjust based on real-time agent performance.
4. **Stagnation Awareness**: The system detects when it's "stuck" and forces strategy pivots.

## Primary Components

### 1. MissionController
The "Central Nervous System" of the orchestrator.
- **Loop Strategy**: Uses an event-driven loop triggered by `session.idle`.
- **Iteration Logic**: Analyzes Todo progress, detects stagnation, and injects continuation prompts.
- **Prompt Injection**: Wraps system instructions in standardized XML tags (`<system>`, `<mission>`, etc.).

### 2. ResourceTracker
The safety layer for resource management.
- **Tracking**: Monitors all active sessions, timeouts, and intervals.
- **Auto-Cleanup**: Automatically releases all allocated resources when a parent session is deleted or completed.

### 3. AdaptiveConcurrencyController
Smart slot management for parallel execution.
- **Dynamic Limits**: Adjusts concurrency slots based on agent success rates and latency.
- **Fail-Fast**: Aggressively scales down during instability to prevent token waste.
- **Speculative Scaling**: Increases slots during high-confidence performance streaks.

### 4. UnifiedTaskExecutor
High-level interface for parallel agent delegation.
- **Encapsulation**: Manages session acquisition from `SessionPool`, execution, and result collection.
- **Resilience**: Handles network timeouts and session errors gracefully.

## Data Flow
1. **Trigger**: User enters `/task` command.
2. **Initialization**: `MissionController` creates a master session and sends the `Commander` definition.
3. **Planning**: `Commander` uses `todowrite` (Native API) to define the roadmap.
4. **Execution Cycle**:
    - `MissionController` waits for `session.idle`.
    - On idle, it checks Native Todos.
    - If incomplete, it injects a continuation prompt (potentially with stagnation intervention).
    - `Commander` may use `delegate_task` to spawn sub-agents via `UnifiedTaskExecutor`.
5. **Completion**: When all Native Todos are `completed` or `cancelled`, the loop terminates.

## Technology Stack
- **Framework**: OpenCode Plugin SDK (Node.js)
- **Language**: TypeScript 5+ (Strict)
- **Rust Backend**: High-performance binary for heavy-duty search/parsing/diagnostics.
- **Build System**: esbuild + tsc for type-safe bundling.