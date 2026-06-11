# Agent Memory - OCO Session

## Current Task

Tighten the Builder-inspired graphical mission memory path so it is not just a generated artifact. The current work integrates mission-relevant runtime memories into the markdown knowledge plane, injects the mission scratchpad directly into orchestrated system prompts, and prevents duplicate scratchpad retrieval through the general markdown search path.

## Last Completed Step

1. Re-audited the current memory path in:
   - `src/core/knowledge/mission-memory.ts`
   - `src/core/knowledge/context-provider.ts`
   - `src/plugin-handlers/system-transform-handler.ts`
   - `tests/unit/system-transform-handler.test.ts`
2. Re-read the comparable Builder-private implementation in:
   - `../builder-private/crates/builder_knowledge/src/scratchpad.rs`
   - `../builder-private/crates/builder_knowledge/src/memory_note_adapter.rs`
   - `../builder-private/crates/builder_knowledge/src/unified_retrieval.rs`
   - `../builder-private/crates/builder_app/src/system_prompt.rs`
3. Implemented runtime-memory projection into workspace-local markdown notes:
   - `src/core/knowledge/mission-memory.ts`
   - generated path: `.opencode/docs/brain/memories/*.md`
4. Added direct mission scratchpad prompt injection and stronger retrieval query composition:
   - `src/plugin-handlers/system-transform-handler.ts`
5. Prevented duplicate scratchpad context by excluding `.opencode/docs/brain/scratchpad.md` from the general markdown retriever:
   - `src/core/knowledge/context-provider.ts`
6. Added and updated tests:
   - `tests/unit/mission-memory-knowledge.test.ts`
   - `tests/unit/system-transform-handler.test.ts`
7. Synced public docs:
   - `README.md`
   - `docs/SYSTEM_ARCHITECTURE.md`
8. Verified the full change set:
   - focused Vitest: mission memory + system transform tests passed
   - `npx tsc --noEmit` passed
   - full `npm test` passed: `76 files`, `713 tests`
   - `npm run build` passed

## Verification Observed

1. Current worktree state:
   - `git status --short --branch`
   - modified files are limited to the intended memory/retrieval/docs/test set
2. Focused verification:
   - `npx vitest run tests/unit/mission-memory-knowledge.test.ts tests/unit/system-transform-handler.test.ts --reporter=verbose`
   - passed: `2 files`, `8 tests`
3. Broader memory verification:
   - `npx vitest run tests/unit/system-transform-handler.test.ts tests/unit/mission-memory-knowledge.test.ts tests/unit/mission-runtime-memory.test.ts --reporter=verbose`
   - passed: `3 files`, `12 tests`
4. Type safety:
   - `npx tsc --noEmit` passed after the final scratchpad de-dup change
5. Full regression:
   - `npm test` passed: `76 files`, `713 tests`
6. Build:
   - `npm run build` passed

## Next Exact Step

1. Review the final diff for the memory-path change set:
   - `src/core/knowledge/mission-memory.ts`
   - `src/core/knowledge/context-provider.ts`
   - `src/plugin-handlers/system-transform-handler.ts`
   - `tests/unit/mission-memory-knowledge.test.ts`
   - `tests/unit/system-transform-handler.test.ts`
   - `README.md`
   - `docs/SYSTEM_ARCHITECTURE.md`
2. If the user wants this improvement shipped, create a commit and cut the next patch release.
3. Separately, repository issue `#25` still requires admin-level GitHub homepage access and remains unresolved outside the codebase.

## Incomplete Items and Why

- The `.canvas` artifact is still a visualization surface, not a retrieval input. This is intentional in the current design because the source of truth remains markdown and file-backed mission state.
- Issue `#25` is still blocked by GitHub repository settings access. Current verification still shows the stale homepage URL and only `viewerPermission: WRITE`.
- The current memory projection does not yet convert every runtime memory into a richer typed note graph the way Builder-private does for all conversation memories and skills; this turn narrowed the highest-value gap first.

## Key Decisions

1. Keep the `.canvas` file as a derived visualization instead of promoting it into a second source of truth.
2. Improve real prompt utility first by:
   - injecting the scratchpad directly
   - projecting selected runtime memories into markdown notes
3. Avoid duplicate context by excluding the generated scratchpad from the general markdown retriever once it is injected explicitly.
4. Filter projected memory notes by level, importance, and mission-query relevance so the workspace knowledge plane is not flooded with low-value task noise.

## Rejected Alternatives

1. Indexing the `.canvas` file directly as retrieval input: rejected because the current retriever is markdown-based and the canvas is meant to remain a derived navigation artifact.
2. Dumping the entire `MemoryManager` snapshot into markdown without filtering: rejected because it would amplify low-value task output and cross-mission noise.
3. Keeping scratchpad retrieval and direct scratchpad injection active at the same time: rejected because it duplicates the same context in the prompt path.

## Known Risks

1. `MemoryManager` is still process-global; projected mission memory is filtered, but not fully session-partitioned the way a richer typed memory store would be.
2. The graphical `.canvas` remains helpful for humans and vault tooling, but it still does not influence retrieval ranking directly.
3. Repository issue `#25` still needs admin-level GitHub settings access to finish the public broken-link cleanup.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `src/core/knowledge/mission-memory.ts`
3. `src/core/knowledge/context-provider.ts`
4. `src/plugin-handlers/system-transform-handler.ts`
5. `tests/unit/mission-memory-knowledge.test.ts`
6. `tests/unit/system-transform-handler.test.ts`
7. `README.md`
8. `docs/SYSTEM_ARCHITECTURE.md`
