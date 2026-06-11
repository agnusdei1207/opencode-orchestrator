# Agent Memory - OCO Session

## Current Task

Patch release `1.3.9` has been completed and published. The repository is now aligned to the updated release workflow baseline, and the remaining unresolved work is limited to repository-admin-only homepage cleanup and the Windows runner redirect notice.

## Last Completed Step

1. Re-ran the evidence-based audit against current source, installed OpenCode plugin types, official OpenCode docs, npm registry metadata, and GitHub Action releases.
2. Expanded the dated English plan document:
   - `docs/histories/2026/06/11/PLAN_OfficialOpenCodeAlignmentAndReleaseHardening_2026-06-11.md`
3. Simplified and hardened `.github/workflows/release.yml`:
   - upgraded `actions/checkout` to `v6`
   - upgraded `actions/setup-node` to `v6`
   - upgraded `actions/upload-artifact` to `v7`
   - upgraded `actions/download-artifact` to `v8`
   - upgraded `softprops/action-gh-release` to `v3`
   - removed the unused `oven-sh/setup-bun` step
   - replaced action registry inputs with explicit `.npmrc` auth steps
4. Added regression coverage for the workflow contract:
   - `tests/unit/release-workflow.test.ts`
5. Verified the change set locally:
   - `npx tsc --noEmit`
   - focused Vitest: 7 files, 33 tests
   - `npm run build`
   - full Vitest: 75 files, 710 tests
   - `npm audit --json`
   - `npm pack --dry-run --json`
   - YAML parse check of `.github/workflows/release.yml`
6. Released and pushed:
   - commit `0aae2b5` `Refine release workflow and audit plan`
   - release commit `4b97e74` `1.3.9`
   - tag `v1.3.9`
   - npm publish succeeded for `opencode-orchestrator@1.3.9`
   - GitHub Actions run `27318294800` succeeded
   - GitHub Release published at `https://github.com/agnusdei1207/opencode-orchestrator/releases/tag/v1.3.9`

## Verification Observed

1. Current registry state:
   - `npm view @opencode-ai/plugin version` -> `1.17.3`
   - `npm view @opencode-ai/sdk version` -> `1.17.3`
   - `npm view opencode-orchestrator version dist-tags.latest` -> `1.3.9`
2. Current GitHub release action baselines verified through `gh release list`:
   - `actions/checkout` latest `v6.0.3`
   - `actions/setup-node` latest `v6.4.0`
   - `actions/upload-artifact` latest `v7.0.1`
   - `actions/download-artifact` latest `v8.0.1`
   - `softprops/action-gh-release` latest `v3.0.0`
3. Current repository state after push:
   - `git status --short --branch` -> `## main...origin/main`
4. GitHub workflow verification:
   - run `27318294800` succeeded
   - release job published GitHub release assets and GitHub Packages

## Next Exact Step

1. If repository admin credentials become available, change the GitHub repository sidebar homepage from `https://rdot.agnusdei.kr/` to `https://github.com/agnusdei1207/opencode-orchestrator/issues`.
2. Re-verify `gh repo view --json homepageUrl`.
3. Only then comment on and close issue `#25`.
4. Separately, decide whether to pin the Windows runner label explicitly once GitHub documents the redirect target that replaces `windows-latest`.

## Incomplete Items and Why

- Issue `#25` remains open because the broken link lives in the GitHub repository sidebar homepage setting, and the current token only has `viewerPermission: WRITE`; `gh repo edit --homepage ...` returned `HTTP 404`, so repository-admin settings access is still missing.
- The `v1.3.9` workflow still reports one GitHub notice:
  - `windows-latest requests are being redirected to windows-2025-vs2026 by June 15, 2026`
  This is only a notice, not a failure, and was left unchanged because the repository currently uses the documented stable `-latest` alias and no official runner-label migration decision has been verified yet from source.

## Key Decisions

1. Keep OpenCode as the contract authority; use installed plugin types plus official docs to justify the configuration guidance.
2. Reduce release workflow complexity rather than layering more tooling onto it.
3. Guard workflow drift with a direct test file instead of relying only on manual release inspection.
4. Do not close support-link issue `#25` until the public broken link is actually removed.

## Rejected Alternatives

1. Closing `#25` based only on package metadata and README cleanup: rejected because the public broken link still exists in repository settings.
2. Keeping `setup-bun` in the release workflow: rejected because the workflow does not use Bun there.
3. Replacing `windows-latest` immediately with an unverified label: rejected until GitHub publishes or the repository owner explicitly chooses a fixed Windows image target.

## Known Risks

1. Repository homepage cleanup still needs admin-level settings access.
2. GitHub may require a future Windows runner label update if `windows-latest` redirect policy changes beyond the current notice.
3. The workflow regression test pins current action majors, so future upstream major upgrades will require an intentional test update.

## Open These Files First Next Session

1. `AGENT_MEMORY.md`
2. `.github/workflows/release.yml`
3. `tests/unit/release-workflow.test.ts`
4. `README.md`
5. `docs/SYSTEM_ARCHITECTURE.md`
6. `docs/histories/2026/06/11/PLAN_OfficialOpenCodeAlignmentAndReleaseHardening_2026-06-11.md`
7. `gh repo view --json homepageUrl,viewerPermission,url`
8. `gh issue view 25 --json number,title,state,url`
9. `gh run view 27318294800`
