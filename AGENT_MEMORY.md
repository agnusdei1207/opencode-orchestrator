# Agent Memory - OCO Session

## Current Task

Patch release `1.3.11` has been completed, published to npm, pushed to GitHub, and verified through the tag-triggered release workflow. The only remaining unresolved item is repository issue `#25`, which still depends on admin-only GitHub repository homepage access.

## Last Completed Step

1. Re-read the release workflow, workflow regression tests, release hardening tests, and prior memory snapshot.
2. Verified local release state after the Windows runner pin update:
   - `git log --oneline --decorate -n 8`
   - `git status --short --branch`
   - `npm view opencode-orchestrator version dist-tags.latest`
3. Confirmed the local patch release finished successfully:
   - version commit `eaa7a89` `1.3.11`
   - tag `v1.3.11`
   - npm publish succeeded for `opencode-orchestrator@1.3.11`
4. Pushed `main` and then explicitly pushed lightweight tag `v1.3.11`.
5. Verified the tag-triggered GitHub Actions workflow:
   - run `27318931814`
   - all 5 build jobs succeeded
   - release job succeeded
   - GitHub Release published at `https://github.com/agnusdei1207/opencode-orchestrator/releases/tag/v1.3.11`
6. Re-verified current blockers:
   - `gh repo view agnusdei1207/opencode-orchestrator --json homepageUrl,viewerPermission,url`
   - homepage still `https://rdot.agnusdei.kr/`
   - current token still reports `viewerPermission: WRITE`
   - issue `#25` therefore remains open

## Verification Observed

1. Repository state after push:
   - `git status --short --branch` -> `## main...origin/main`
2. Remote tag state:
   - `git ls-remote --tags origin v1.3.11` -> `refs/tags/v1.3.11`
3. npm registry state:
   - `npm view opencode-orchestrator version dist-tags.latest` -> `1.3.11`
4. GitHub release state:
   - `gh release view v1.3.11 --json name,tagName,isDraft,isPrerelease,url`
   - release exists and is not draft/prerelease
5. GitHub workflow state:
   - `gh run view 27318931814 --json status,conclusion,url,jobs` -> `completed/success`
   - `gh run view 27318931814` showed successful jobs and artifacts with no redirect notice in the observed output
6. Open issues:
   - `gh issue list --state open --limit 10 --json number,title,url` -> only `#25`

## Next Exact Step

1. Obtain repository-admin credentials for `agnusdei1207/opencode-orchestrator`.
2. Run:
   - `gh repo edit agnusdei1207/opencode-orchestrator --homepage https://github.com/agnusdei1207/opencode-orchestrator/issues`
3. Re-verify:
   - `gh repo view agnusdei1207/opencode-orchestrator --json homepageUrl,viewerPermission,url`
4. Comment on and close issue `#25`.

## Incomplete Items and Why

- Issue `#25` remains open because the broken link lives in the GitHub repository sidebar homepage setting, and the current token still lacks the repository-admin capability needed to edit that field. Direct verification still shows `viewerPermission: WRITE` and the stale homepage URL.

## Key Decisions

1. Treat the Windows runner redirect as resolved only after a fresh tagged workflow run no longer surfaced the prior notice in observed output.
2. Push the lightweight release tag explicitly instead of assuming `git push --follow-tags` would include it.
3. Keep issue `#25` open until the public broken link is actually removed from repository settings.

## Rejected Alternatives

1. Declaring `#25` fixed based on README or package metadata alone: rejected because the public GitHub sidebar homepage still points to the dead site.
2. Assuming the release workflow had run for `v1.3.11` after pushing `main` only: rejected because the remote tag check showed the tag had not been pushed yet.
3. Calling the Windows notice fixed before observing a fresh `v1.3.11` workflow run: rejected because earlier evidence from `v1.3.10` showed the notice persisted after an incomplete pin.

## Known Risks

1. Repository homepage cleanup still requires admin-level GitHub settings access.
2. The workflow publishes to npm from local release tooling and skips npm in GitHub Actions when `NPM_TOKEN` is absent there; this is intentional today but should remain documented.
3. Future GitHub Actions major upgrades will require deliberate workflow and regression-test updates.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `.github/workflows/release.yml`
3. `tests/unit/release-workflow.test.ts`
4. `gh repo view agnusdei1207/opencode-orchestrator --json homepageUrl,viewerPermission,url`
5. `gh issue view 25 --json number,title,state,url,body`
6. `gh run view 27318931814`
