# Agent Memory - OCO Session

## Current Task

Patch release `1.3.12` remains synchronized across code, tests, npm, tag, and GitHub Release. The repository sidebar homepage has now been corrected to the GitHub issues page. The only remaining unresolved item is issue `#25`, which cannot be commented on or closed with the current fine-grained token because it lacks issue-write capability.

## Last Completed Step

1. Verified the supplied fine-grained token against GitHub:
   - `gh repo view agnusdei1207/opencode-orchestrator --json homepageUrl,viewerPermission,url`
   - confirmed `viewerPermission: ADMIN`
2. Verified the broken-link issue state:
   - `gh issue view 25 --repo agnusdei1207/opencode-orchestrator --json number,title,state,url,body`
   - confirmed `#25` was still `OPEN`
3. Searched the repository for remaining references to `rdot.agnusdei.kr`:
   - only historical references remained in `AGENT_MEMORY.md` and the dated plan document
4. Updated the repository sidebar homepage:
   - `gh repo edit agnusdei1207/opencode-orchestrator --homepage https://github.com/agnusdei1207/opencode-orchestrator/issues`
5. Re-verified the homepage:
   - `gh repo view agnusdei1207/opencode-orchestrator --json homepageUrl,viewerPermission,url`
   - confirmed homepage now points to the GitHub issues page
6. Checked issue `#26`:
   - `gh issue view 26 --repo agnusdei1207/opencode-orchestrator --json number,title,state,url`
   - confirmed it is already `CLOSED`
7. Attempted to comment on and close `#25`:
   - `gh issue comment 25 ...`
   - `gh api repos/agnusdei1207/opencode-orchestrator/issues/25/comments -X POST ...`
   - `gh api repos/agnusdei1207/opencode-orchestrator/issues/25 -X PATCH -f state=closed`
   - all failed with `Resource not accessible by personal access token`

## Verification Observed

1. Repository state:
   - `git status --short --branch` -> `## main...origin/main`
2. GitHub repository settings:
   - before update: homepage `https://rdot.agnusdei.kr/`, permission `ADMIN`
   - after update: homepage `https://github.com/agnusdei1207/opencode-orchestrator/issues`
3. GitHub issue state:
   - `#25` remained `OPEN` before closure attempts
   - `#26` is `CLOSED`
4. Token capability boundary:
   - repository settings edit succeeded
   - issue comment and issue close calls failed with `HTTP 403` / `Resource not accessible by personal access token`

## Next Exact Step

1. Obtain a token for `agnusdei1207/opencode-orchestrator` with issue-write access in addition to repo-admin/settings access.
2. Re-run:
   - `gh issue comment 25 --repo agnusdei1207/opencode-orchestrator --body 'Updated the repository sidebar homepage to the GitHub issues page and removed the broken external link target. Verified the sidebar homepage now points to https://github.com/agnusdei1207/opencode-orchestrator/issues. Closing this issue.'`
   - `gh issue close 25 --repo agnusdei1207/opencode-orchestrator`
3. Re-verify:
   - `gh issue view 25 --repo agnusdei1207/opencode-orchestrator --json number,title,state,url`

## Incomplete Items and Why

- Issue `#25` remains open because the current fine-grained token can edit repository settings but cannot comment on or close issues.
- The `.canvas` artifact remains a derived visualization surface rather than a retrieval input. This is intentional in the current design to preserve markdown and file-backed mission state as the source of truth.

## Key Decisions

1. Keep the `.canvas` file as a derived visualization, not a second source of truth.
2. Improve real prompt utility by:
   - projecting selected runtime memories into markdown notes
   - injecting the mission scratchpad directly into orchestrated prompt context
3. Avoid duplicate context by removing the generated scratchpad from the general markdown retriever once it is directly injected.
4. Treat the broken homepage link as resolved once the sidebar homepage points to GitHub issues, even if the current token cannot perform the final issue-management action.

## Rejected Alternatives

1. Indexing the `.canvas` file directly for retrieval: rejected because the retriever is markdown-based and the canvas remains a derived navigation artifact.
2. Dumping the entire `MemoryManager` snapshot into markdown without filtering: rejected because it would flood the workspace knowledge plane with low-value noise.
3. Keeping scratchpad retrieval and direct scratchpad injection active together: rejected because it duplicates the same context in the prompt path.

## Known Risks

1. `MemoryManager` is still process-global and not fully session-partitioned.
2. Repository issue `#25` still requires a token with issue-write permission for final closure.
3. Future GitHub Actions major changes will still require deliberate workflow/test updates.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `gh repo view agnusdei1207/opencode-orchestrator --json homepageUrl,viewerPermission,url`
3. `gh issue view 25 --repo agnusdei1207/opencode-orchestrator --json number,title,state,url,body`
4. `src/core/knowledge/mission-memory.ts`
5. `src/core/knowledge/context-provider.ts`
6. `src/plugin-handlers/system-transform-handler.ts`
7. `tests/unit/mission-memory-knowledge.test.ts`
8. `tests/unit/system-transform-handler.test.ts`
