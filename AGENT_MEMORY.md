# Agent Memory - OCO Session

## Current Task

Patch release `1.3.12` has been completed for the Builder-inspired mission memory hardening work. The codebase, tests, npm package, GitHub tag, and GitHub release are synchronized. The only remaining unresolved item is repository issue `#25`, which still depends on admin-only GitHub repository homepage access.

## Last Completed Step

1. Re-audited the memory and retrieval path:
   - `src/core/knowledge/mission-memory.ts`
   - `src/core/knowledge/context-provider.ts`
   - `src/plugin-handlers/system-transform-handler.ts`
   - `tests/unit/system-transform-handler.test.ts`
   - `tests/unit/mission-memory-knowledge.test.ts`
2. Implemented mission-memory projection into markdown notes under:
   - `.opencode/docs/brain/memories/*.md`
3. Added direct scratchpad injection for orchestrated sessions and enriched the retrieval query with mission/runtime fields.
4. Prevented duplicate prompt context by excluding `.opencode/docs/brain/scratchpad.md` from general markdown retrieval after direct injection.
5. Synced docs:
   - `README.md`
   - `docs/SYSTEM_ARCHITECTURE.md`
6. Verified the change set:
   - focused Vitest passed
   - `npx tsc --noEmit` passed
   - full `npm test` passed: `76 files`, `713 tests`
   - `npm run build` passed
   - `npm audit --json` reported `0` vulnerabilities
   - `npm pack --dry-run --json` succeeded
7. Committed the feature work:
   - `1d9db71` `Integrate mission memory into prompt retrieval`
8. Cut and published the patch release:
   - release commit `dfb0abb` `1.3.12`
   - tag `v1.3.12`
   - npm publish succeeded for `opencode-orchestrator@1.3.12`
9. Pushed `main` and `v1.3.12`, then verified GitHub Actions:
   - run `27319766653`
   - all 5 build jobs succeeded
   - release job succeeded
   - GitHub Release published for `v1.3.12`

## Verification Observed

1. Local verification:
   - `npx vitest run tests/unit/mission-memory-knowledge.test.ts tests/unit/system-transform-handler.test.ts --reporter=verbose`
   - `npx vitest run tests/unit/system-transform-handler.test.ts tests/unit/mission-memory-knowledge.test.ts tests/unit/mission-runtime-memory.test.ts --reporter=verbose`
   - `npx tsc --noEmit`
   - `npm test`
   - `npm run build`
   - `npm audit --json`
   - `npm pack --dry-run --json`
2. Registry verification:
   - `npm view opencode-orchestrator version dist-tags.latest` -> `1.3.12`
3. Git history verification:
   - `git log --oneline --decorate -n 6`
   - release commit `dfb0abb`
   - feature commit `1d9db71`
4. GitHub Actions verification:
   - `gh run view 27319766653 --json status,conclusion,url,jobs` -> `completed/success`
5. GitHub settings blocker verification:
   - `gh repo view agnusdei1207/opencode-orchestrator --json homepageUrl,viewerPermission,url`
   - homepage still `https://rdot.agnusdei.kr/`
   - `viewerPermission` still `WRITE`

## Next Exact Step

1. Obtain repository-admin credentials for `agnusdei1207/opencode-orchestrator`.
2. Run:
   - `gh repo edit agnusdei1207/opencode-orchestrator --homepage https://github.com/agnusdei1207/opencode-orchestrator/issues`
3. Re-verify:
   - `gh repo view agnusdei1207/opencode-orchestrator --json homepageUrl,viewerPermission,url`
4. Comment on and close issue `#25`.

## Incomplete Items and Why

- Issue `#25` remains open because the broken link is in the GitHub repository sidebar homepage setting, and the current token still lacks repository-admin capability to edit that field.
- The `.canvas` artifact remains a derived visualization surface rather than a retrieval input. This is intentional in the current design to preserve markdown and file-backed mission state as the source of truth.

## Key Decisions

1. Keep the `.canvas` file as a derived visualization, not a second source of truth.
2. Improve real prompt utility by:
   - projecting selected runtime memories into markdown notes
   - injecting the mission scratchpad directly into orchestrated prompt context
3. Avoid duplicate context by removing the generated scratchpad from the general markdown retriever once it is directly injected.
4. Ship the memory-path hardening as a patch release once the full regression suite, package audit, package dry-run, npm publish, and GitHub release workflow all passed.

## Rejected Alternatives

1. Indexing the `.canvas` file directly for retrieval: rejected because the retriever is markdown-based and the canvas remains a derived navigation artifact.
2. Dumping the entire `MemoryManager` snapshot into markdown without filtering: rejected because it would flood the workspace knowledge plane with low-value noise.
3. Keeping scratchpad retrieval and direct scratchpad injection active together: rejected because it duplicates the same context in the prompt path.

## Known Risks

1. `MemoryManager` is still process-global and not fully session-partitioned.
2. Repository issue `#25` still requires admin-level GitHub settings access.
3. Future GitHub Actions major changes will still require deliberate workflow/test updates.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `src/core/knowledge/mission-memory.ts`
3. `src/core/knowledge/context-provider.ts`
4. `src/plugin-handlers/system-transform-handler.ts`
5. `tests/unit/mission-memory-knowledge.test.ts`
6. `tests/unit/system-transform-handler.test.ts`
7. `gh repo view agnusdei1207/opencode-orchestrator --json homepageUrl,viewerPermission,url`
8. `gh issue view 25 --json number,title,state,url,body`
