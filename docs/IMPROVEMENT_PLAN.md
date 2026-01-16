# OpenCode Orchestrator Improvement Plan

## Current Status (v0.5.4 - safe branch)

### Current Structure:
```
src/
├── agents/          # Agent definitions
│   ├── definitions.ts
│   ├── orchestrator.ts
│   └── subagents/
├── core/            # Core logic
│   ├── async-agent.ts
│   ├── background.ts
│   ├── config.ts
│   └── session-manager.ts
├── shared/          # Shared types/constants
├── tools/           # LLM tools
├── utils/           # Utilities
└── index.ts         # Plugin entry point
```

---

## 1. Prompt Engineering

### Goal:
- Standardize XML structures for all agents.
- Clarify agent roles and responsibilities.
- standardizing prompts for better quality control.

### Tasks:
- [ ] Centralize prompts (Internal/MD only)
- [ ] Standardize XML tags: `<purpose>`, `<rules>`, `<workflow>`, `<output>`.
- [ ] Refine role definitions for Commander, Architect, Builder, Inspector, and Recorder.

---

## 2. Refactoring & Structure Cleanup

### Goal:
- Centralize constants and remove hardcoded magic numbers.
- Modularize features like parallel task execution and background agents.

### Tasks:
- [ ] Centralize constants in `src/shared/constants.ts`
- [ ] Add a centralized logger in `src/shared/logger.ts`
- [ ] Reorganize folder structure for better modularity (Moving logic to `features/`)

---

## 3. Parallel & Background Session Management

### Goal:
- Improve stability and monitoring of background tasks.
- Enhance concurrency control for parallel sessions.

### Tasks:
- [ ] Modularize `ConcurrencyController`.
- [ ] Enhance error handling for background processes.
- [ ] Improve task status notifications in the UI.

---

## Priority

1. **Phase 1**: Structure Cleanup (Constants, Logger)
2. **Phase 2**: Parallel Processing improvements
3. **Phase 3**: Prompt Engineering (XML standardization)

---

**Start Date**: 2026-01-16
**Base Branch**: `safe` (v0.5.4)
