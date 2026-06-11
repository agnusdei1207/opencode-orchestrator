# Agent Memory - OCO Session

## Current Task

OpenCode official contract alignment and release-plumbing hardening are in progress on top of the shipped `1.3.7` baseline.

## Last Completed Step

1. Re-verified current implementation against the local OpenCode package types:
   - `node_modules/@opencode-ai/plugin/dist/index.d.ts`
   - `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts`
2. Re-verified runtime wiring in:
   - `src/index.ts`
   - `src/plugin-handlers/config-handler.ts`
   - `src/plugin-handlers/event-handler.ts`
   - `src/plugin-handlers/chat-message-handler.ts`
   - `src/core/config/plugin-options.ts`
   - `src/core/agents/concurrency-config.ts`
   - `src/core/loop/mission-loop.ts`
   - `src/core/loop/mission-loop-handler.ts`
   - `src/core/loop/todo-continuation.ts`
3. Re-checked `../builder-private` for borrowable patterns and kept only:
   - local-first markdown scratchpad
   - `.canvas` graph output
   - interrupt-aware continuation guards
4. Updated documentation and release plumbing:
   - `README.md`
   - `docs/SYSTEM_ARCHITECTURE.md`
   - `.github/workflows/release.yml`
   - `package.json`
   - `package-lock.json`
5. Added verification coverage:
   - `tests/unit/dependency-compatibility.test.ts`
6. Added dated English plan:
   - `docs/histories/2026/06/11/PLAN_OfficialOpenCodeAlignmentAndReleaseHardening_2026-06-11.md`

## Verification Observed

1. Baseline before edits:
   - `npx tsc --noEmit` passed.
   - Focused tests passed: 6 files, 31 tests.
2. Post-change focused verification:
   - `npx tsc --noEmit` passed.
   - `npm run build` passed.
   - Focused Vitest passed: 7 files, 33 tests.
   - `git diff --check` passed.
3. Post-change wide verification:
   - `npm test` passed: 74 files, 708 tests.
   - `npm audit --json` passed with 0 vulnerabilities.
   - `npm pack --dry-run --json` passed and included updated `README.md`, `dist`, and platform binaries.
4. Repository/admin state:
   - `gh repo view --json homepageUrl,nameWithOwner,url` still reports `homepageUrl: https://rdot.agnusdei.kr/`.
   - `gh issue list --state open` still shows only `#25`.

## Next Exact Step

1. Commit the current alignment and release-hardening changes.
2. Push the commit to `origin/main`.
3. If repository settings access becomes available, change the GitHub repository sidebar homepage to `https://github.com/agnusdei1207/opencode-orchestrator/issues`, verify it, then close `#25`.

## Incomplete Items and Why

- `#25` remains open because the actual broken link is the GitHub repository sidebar Homepage setting, which still points to `https://rdot.agnusdei.kr/` and requires repository settings/admin access.
- The repository still needs a higher-privilege GitHub token before that sidebar link can be changed from this workspace.

## Key Decisions

- Keep the README example centered on the plugin tuple because the installed OpenCode plugin type explicitly supports `plugin?: Array<string | [string, PluginOptions]>`.
- Pin `@opencode-ai/plugin` and `@opencode-ai/sdk` to the same tested `1.17.3` release to reduce plugin-surface drift.
- Replace the oversized architecture memo with a shorter source-backed map instead of continuing to maintain stale performance marketing text.
- Keep Builder-derived ideas only where they fit the OpenCode plugin boundary and current implementation.

## Rejected Alternatives

- Closing `#25` without verifying the GitHub sidebar homepage: rejected because the public broken link would remain live.
- Importing Builder-specific permission defaults or runtime policy: rejected because OpenCode remains the authority for permissions and model/config behavior.
- Preserving the previous architecture document with only spot fixes: rejected because too much of it was stale or unverifiable.

## Known Risks

- GitHub Actions release workflow changes were verified by file read and repository conventions, but not by a live tag-triggered workflow run in this session.
- Upstream OpenCode docs may evolve beyond the pinned `1.17.3` surface; the new dependency test only guards the local package baseline.
- The repository sidebar homepage still exposes the dead external URL until admin access is provided.

## Open These Files First Next Session

1. AGENT_MEMORY.md
2. README.md
3. docs/SYSTEM_ARCHITECTURE.md
4. .github/workflows/release.yml
5. package.json
6. package-lock.json
7. tests/unit/dependency-compatibility.test.ts
8. node_modules/@opencode-ai/plugin/dist/index.d.ts
9. src/plugin-handlers/config-handler.ts
10. gh repo view output for homepage verification
