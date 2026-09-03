# Agent Memory - OCO Session

Last updated: 2026-09-04 08:00 KST

## Current Task

ADR implementation and verification: ADR-0020 (Risk-Graded Test Coverage Policy), ADR-0019 Phase 1 (Knowledge RAG Runtime Decoupling), and ADR-0018 residual pipeline hardening.

## Last Completed Step

- **ADR-0020 (Risk-Graded Test Coverage Policy) Completed & Implemented**:
  - Ratchet regression thresholds installed in [vitest.config.ts](file:///C:/workspace/opencode-orchestrator/vitest.config.ts):
    - lines: 85% (measured: 88.68%)
    - statements: 85% (measured: 87.04%)
    - functions: 88% (measured: 90.83%)
    - branches: 72% (measured: 75.85%)
  - All 4 gap files from ADR-0020 verified on par with happy path tests:
    - `progress-notifier.ts`: 100% lines
    - `object-pool.ts`: 100% lines
    - `todo-sync-service.ts`: 79.4% lines
    - `session-recovery.ts`: 74.4% lines
  - [docs/adr/0020-risk-graded-test-coverage-policy.md](file:///C:/workspace/opencode-orchestrator/docs/adr/0020-risk-graded-test-coverage-policy.md) and [docs/adr/README.md](file:///C:/workspace/opencode-orchestrator/docs/adr/README.md) promoted to `Implemented`.
- **ADR-0019 (Retire In-Memory Knowledge RAG Subsystem) Phase 1 Implemented**:
  - `enableKnowledgeRag: boolean` added to `MissionRuntimeOptions` and `MissionLoopOptionsSchema` defaulting to `false`.
  - Regenerated [opencode-orchestrator.schema.json](file:///C:/workspace/opencode-orchestrator/opencode-orchestrator.schema.json) via `npm run gen:schema`.
  - [src/plugin-handlers/system-transform-handler.ts](file:///C:/workspace/opencode-orchestrator/src/plugin-handlers/system-transform-handler.ts) gates `<knowledge_rag_context>` prompt injection behind `enableKnowledgeRag`, eliminating context window bloat and partial-context hallucinations.
  - Tests in [tests/unit/system-transform-handler.test.ts](file:///C:/workspace/opencode-orchestrator/tests/unit/system-transform-handler.test.ts) and [tests/unit/concurrency-config.test.ts](file:///C:/workspace/opencode-orchestrator/tests/unit/concurrency-config.test.ts) updated and verified (11/11 pass).
  - [docs/adr/0019-retire-knowledge-rag-subsystem.md](file:///C:/workspace/opencode-orchestrator/docs/adr/0019-retire-knowledge-rag-subsystem.md) and [docs/adr/README.md](file:///C:/workspace/opencode-orchestrator/docs/adr/README.md) updated to `Accepted (Phase 1 Implemented)`.
- **ADR-0018 Pipeline Hardening**:
  - Added `rm -f bin/*` before binary packaging in [.github/workflows/release.yml](file:///C:/workspace/opencode-orchestrator/.github/workflows/release.yml) to eliminate stale extensionless binary packaging risk.
- **Verification & Baseline Results**:
  - `npm run build`: Exit code 0.
  - `npm run gen:schema`: Exit code 0.
  - `npm run test:coverage`: **131 test files / 1182 tests passed**, 0 failures, all ratchet thresholds passed.

## Next Exact Step

1. Commit the working tree changes (`git add` and `git commit`).
2. Plan Phase 2 of ADR-0019: Decouple markdown scratchpad from decay graph indexing.

## Key Decisions

- Soft-disable Knowledge RAG: Set `enableKnowledgeRag: false` by default in runtime options and schema so normal turns run lean without token pollution, while allowing existing tests and external consumers to remain unbroken.
- Ratchet thresholds: Set at 85% lines, 85% statements, 88% functions, 72% branches to protect against code regression without creating artificial test hurdles.
- Prune bin directory: `rm -f bin/*` before copying built binaries in CI release workflow.

## Known Risks

- In Phase 3 of ADR-0019, 14 test suites in `tests/unit/knowledge/` will need to be pruned or adapted when the in-memory RAG subsystem files are decommissioned.

## Files To Open First Next Session

1. [AGENT_MEMORY.md](file:///C:/workspace/opencode-orchestrator/AGENT_MEMORY.md)
2. [docs/adr/0019-retire-knowledge-rag-subsystem.md](file:///C:/workspace/opencode-orchestrator/docs/adr/0019-retire-knowledge-rag-subsystem.md)
3. [docs/adr/0020-risk-graded-test-coverage-policy.md](file:///C:/workspace/opencode-orchestrator/docs/adr/0020-risk-graded-test-coverage-policy.md)
4. [src/plugin-handlers/system-transform-handler.ts](file:///C:/workspace/opencode-orchestrator/src/plugin-handlers/system-transform-handler.ts)
