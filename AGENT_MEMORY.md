# Agent Memory - OCO Session

## Current Task

Complete the OpenCode compatibility audit and `1.7.8` patch release; GitHub and GitHub Packages are released, but public npm publishing is blocked by missing npm authentication.

## Last Completed Step

- Audited the official OpenCode plugin documentation and releases through `v1.17.18`.
- Verified that Plugin/SDK distributed code and types did not change from `1.17.12` to `1.17.18`; only package metadata and optional OpenTUI peer minimums changed.
- Updated `@opencode-ai/plugin` and `@opencode-ai/sdk` pins, lockfile, compatibility test, and README to `1.17.18`.
- Created and pushed compatibility commit `9f8cf7d`, release commit `1bbe25c`, and tag `v1.7.8`.
- Observed CI, Pages, all five release builds, GitHub Release, and GitHub Packages publish succeed.
- Added release hardening in `d609f34`: GitHub Packages publishing is idempotent and missing `NPM_TOKEN` now fails instead of silently reporting a complete release.

## Next Exact Step

1. Authenticate npm locally with an account authorized to publish `opencode-orchestrator` (`npm adduser`), or configure the repository `NPM_TOKEN` secret.
2. Publish `opencode-orchestrator@1.7.8` to npmjs (`npm publish --access public`) from the verified `1.7.8` package state.
3. Verify `npm view opencode-orchestrator@1.7.8 version` and the latest dist-tag.
4. Update this memory snapshot to the completed public-release state.

## Incomplete Items And Why

- Public npm `opencode-orchestrator@1.7.8` is not published. Local `npm whoami` returns `ENEEDAUTH`, and the GitHub repository does not have `NPM_TOKEN`; the release job therefore skipped npmjs publishing.

## Key Decisions

- Align Plugin and SDK together at exact version `1.17.18` because the repository intentionally pins a tested pair.
- Avoid production code changes because the official npm package diff showed no distributed code/type contract changes.
- Treat npmjs as a required release target because OpenCode installs configured npm plugins through Bun into its npm package cache.
- Make missing public-registry credentials a release failure so GitHub success cannot hide a missing npm release again.

## Rejected Alternatives

- Rejected claiming `1.7.7` or `1.7.8` was fully released while npmjs remained at `1.7.6`.
- Rejected inventing or exposing credentials; npm publishing requires user-controlled authorization.
- Rejected changing product hooks because official hook names and current plugin wiring matched.

## Known Risks

- Until npm authentication is supplied and `1.7.8` is published, normal OpenCode npm installation continues to resolve public version `1.7.6`.
- The `v1.7.8` tag predates workflow hardening commit `d609f34`; use local authenticated publish for `1.7.8`, or manually dispatch the hardened workflow from `main` after adding `NPM_TOKEN`.

## Verification Observed

- Official OpenCode latest: `v1.17.18`; npm Plugin and SDK latest: `1.17.18`.
- Windows Node `v24.18.0`: typecheck, build, and full tests passed.
- Clean Linux Node 24: install, typecheck, build, and 106/106 test files (941/941 tests) passed.
- Release dry-run: TypeScript suite, 47 Rust tests, npm audit (0 vulnerabilities), and npm pack passed.
- GitHub Actions for `1bbe25c`: CI and Pages succeeded.
- Build & Release run `29101227982`: five platform builds and release job succeeded.
- GitHub Release `v1.7.8`: five binary assets published with SHA-256 digests.
- GitHub Packages `@agnusdei1207/opencode-orchestrator@1.7.8`: publish step succeeded.
- Public npm latest remains `1.7.6`; `1.7.8` lookup is absent.
- Release-hardening tests: 12/12 passed; TypeScript check passed.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --branch --short`
3. `package.json`
4. `.github/workflows/release.yml`
