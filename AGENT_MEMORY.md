# Agent Memory - OCO Session

## Current Task

Patch release `1.3.8` has been prepared and published to npm locally, and the remaining work is to push commits/tags and verify the GitHub release side.

## Last Completed Step

1. Completed the OpenCode alignment pass:
   - `README.md` now answers model selection, permission inheritance, compatibility, and concurrency placement directly.
   - `docs/SYSTEM_ARCHITECTURE.md` was replaced with a shorter source-backed architecture map.
   - `.github/workflows/release.yml` now uses `softprops/action-gh-release@v2` and `oven-sh/setup-bun@v2`, and the default release body no longer advertises stale features.
   - `package.json` and `package-lock.json` pin `@opencode-ai/plugin` and `@opencode-ai/sdk` to `1.17.3`.
   - `tests/unit/dependency-compatibility.test.ts` guards that compatibility baseline.
   - `docs/histories/2026/06/11/PLAN_OfficialOpenCodeAlignmentAndReleaseHardening_2026-06-11.md` records the detailed English plan.
2. Committed the non-version work:
   - `8cceb27 Align OpenCode docs and release plumbing`
3. Ran patch release automation:
   - `c0d1cab 1.3.8`
   - tag `v1.3.8`
   - npm publish succeeded for `opencode-orchestrator@1.3.8`

## Verification Observed

1. Before release:
   - `npx tsc --noEmit` passed.
   - `npm run build` passed.
   - Focused Vitest passed: 7 files, 33 tests.
   - `npm test` passed: 74 files, 708 tests.
   - `npm audit --json` passed with 0 vulnerabilities.
   - `npm pack --dry-run --json` passed.
   - `git diff --check` passed.
2. Release preflight during `npm run release:patch`:
   - build passed
   - full Vitest passed again
   - Rust workspace tests passed (executed inside the release preflight)
   - `npm audit --json` passed
   - `npm pack --dry-run` passed for `1.3.8`
   - Docker Linux x64 and Linux arm64 artifact rebuild completed
   - `node scripts/release-sync-artifacts.mjs` reported no artifact changes
   - `npm publish --access public` succeeded
3. Registry verification:
   - `npm view opencode-orchestrator version dist-tags.latest dist.tarball` returned `1.3.8`, `latest = 1.3.8`
4. Repository/admin state:
   - `git log --oneline --decorate -n 4` shows `c0d1cab (HEAD -> main, tag: v1.3.8) 1.3.8`
   - `git status --short --branch` shows `main...origin/main [ahead 2]`
   - `gh repo view --json homepageUrl,nameWithOwner,url` still reports `homepageUrl: https://rdot.agnusdei.kr/`
   - `gh issue list --state open` still shows only `#25`

## Next Exact Step

1. Push `main` and tags to `origin`.
2. Verify that the `v1.3.8` GitHub Actions release workflow completes.
3. If repository settings access becomes available, change the repository sidebar homepage to GitHub issues and then close `#25`.

## Incomplete Items and Why

- `#25` remains open because the broken link is still the GitHub repository sidebar Homepage setting, which requires repository settings/admin access.
- GitHub release verification for `v1.3.8` cannot happen until the tag is pushed.

## Key Decisions

- Keep the README centered on the plugin tuple because the installed OpenCode plugin type explicitly supports `plugin?: Array<string | [string, PluginOptions]>`.
- Pin `@opencode-ai/plugin` and `@opencode-ai/sdk` to the same tested `1.17.3` release to reduce plugin-surface drift.
- Replace the oversized architecture memo with a concise source-backed version instead of maintaining stale performance claims.
- Treat Builder-inspired memory features as optional workspace-local artifacts only.

## Rejected Alternatives

- Closing `#25` without verifying the GitHub sidebar homepage: rejected because the public broken link would remain live.
- Importing Builder-specific permission defaults or control policy: rejected because OpenCode remains the authority for permissions and config behavior.
- Skipping a patch release after changing user-facing docs and release plumbing: rejected because the user has repeatedly asked for release patch completion.

## Known Risks

- The repository sidebar homepage still exposes the dead external URL until admin access is provided.
- GitHub Actions release workflow for `v1.3.8` still needs post-push verification.
- Upstream OpenCode docs may evolve beyond the pinned `1.17.3` surface; the new compatibility test only guards the current baseline.

## Open These Files First Next Session

1. AGENT_MEMORY.md
2. README.md
3. docs/SYSTEM_ARCHITECTURE.md
4. .github/workflows/release.yml
5. package.json
6. package-lock.json
7. tests/unit/dependency-compatibility.test.ts
8. `git log --oneline --decorate -n 4`
9. `gh repo view --json homepageUrl,nameWithOwner,url`
10. `gh run list --limit 10`
