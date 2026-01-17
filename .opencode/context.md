# Project Context

## Environment
- Runtime: Node.js (TypeScript ES2022) + Rust 2024
- Build: npm (esbuild) + cargo
- Test: vitest
- Type System: TypeScript (strict mode)

## Structure

### Source Directories
- `src/` - Main TypeScript source code
  - `agents/` - Agent definitions and prompts
  - `core/` - Core functionality
    - `agents/` - Agent management (manager, concurrency, task-store)
    - `cache/` - Document caching system
    - `commands/` - Background command execution
    - `loop/` - Mission loop, TODO parsing, continuation logic
    - `notification/` - Toast notification system
    - `orchestrator/` - Orchestrator state management
    - `progress/` - Progress tracking
    - `queue/` - Async queue and work pool
    - `recovery/` - Error recovery and auto-recovery
    - `session/` - Shared context management
    - `task/` - Task decomposition and scheduling
  - `tools/` - Plugin tools (parallel execution, web, background commands)
  - `plugin-handlers/` - OpenCode plugin event handlers
  - `shared/` - Shared utilities and constants
  - `utils/` - Helper functions
- `crates/` - Rust components (orchestrator-core, orchestrator-cli)
- `tests/` - Vitest test files
- `dist/` - Compiled output (generated)
- `docs/` - Documentation

### Key Files
- Entry: `src/index.ts` - Main plugin export
- Config: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Plugin Definition: `src/shared/agent/definition.ts`
- Agent Prompts: `src/agents/prompts/`

## Build System

### npm scripts
- `build` - esbuild bundle + tsc declarations
- `test` - vitest run
- `dev:link` - Link for local development
- `postinstall` - Install hooks via Rust CLI
- `release:*` - Version bump and publish

### Rust Integration
- `crates/orchestrator-core/` - Core Rust functionality
- `crates/orchestrator-cli/` - CLI tools for postinstall/preuninstall
- `Cargo.toml` - Workspace configuration

## Conventions

### Agent System
- 4 Consolidated Agents: Commander, Planner, Worker, Reviewer
- Each agent has dedicated prompts in `src/agents/prompts/{agent}/`
- Subagents implement specific behavior in `src/agents/subagents/`

### Task Management
- Hierarchical TODO: Epic (E) → Task (T) → Subtask (S)
- TODO stored in `.opencode/todo.md`
- Progress tracked via checkboxes [x]

### Context Management
- Shared workspace in `.opencode/` directory
- `context.md` - Adaptive context (shrinks as progress increases)
- `docs/` - Cached documentation (auto-expire)
- `archive/` - Old context for reference

### Error Handling
- Pattern-based auto recovery in `src/core/recovery/`
- Session recovery with 3 retry attempts
- Background task management for long operations

### Notifications
- TaskToastManager for consolidated views
- Presets for different event types
- Max 100 notifications per parent (FIFO eviction)

### Resource Limits
- Max 50 parallel sessions
- Max 1,000 tasks in memory (with auto GC)
- 60 min session TTL
- 1 second poll interval for task completion

### Code Organization
- Interfaces in separate `interfaces/` directories
- Types in `types/` subdirectories
- Constants in shared `constants.ts` files
- Index files for barrel exports

## Testing
- 19 test files, 216 tests
- Test coverage in `src/core/`
- Vitest with v8 coverage provider
