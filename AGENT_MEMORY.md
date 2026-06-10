# Agent Memory - OCO Session

## Current Task

Patch release `opencode-orchestrator` `1.3.6` has been implemented, published to npm, pushed to `origin/main`, tagged as `v1.3.6`, and released through GitHub Actions.

## Last Completed Step

1. Implemented and pushed audit hardening commit:
   - `3da8ed3 Harden prompt exports and metadata`
2. Published and pushed release commit:
   - `0e9010a 1.3.6`
   - `origin/main`, local `main`, and tag `v1.3.6` all point to `0e9010a9fb7d482e5b18f2be21b08a11d14fbce0`.
3. Released npm package:
   - `opencode-orchestrator@1.3.6`
   - `latest = 1.3.6`
   - tarball: `https://registry.npmjs.org/opencode-orchestrator/-/opencode-orchestrator-1.3.6.tgz`
4. GitHub Release and Actions:
   - Release URL: `https://github.com/agnusdei1207/opencode-orchestrator/releases/tag/v1.3.6`
   - Actions run `27313928882` completed successfully.
   - Linux x64, Linux arm64, macOS x64, macOS arm64, and Windows x64 build jobs completed successfully.
   - GitHub Packages publish completed.
   - Actions public npm publish step skipped because repository `NPM_TOKEN` secret is still absent; local `npm publish` already completed successfully.
5. Audit hardening:
   - Replaced public prompt export placeholders under `src/agents/prompts/**` with concrete concise guidance.
   - Added a prompt source regression test that fails on generated placeholder text.
   - Corrected package description from the obsolete `Planner, Coder, Reviewer` wording to Commander, Planner, Worker, and Reviewer.
   - Added package metadata regression tests for actual agent names and GitHub Issues support links.
   - Replaced the `src/index.ts` `session.created` property `any` casts with a small type guard and string reader.
   - Updated lockfile to `@opencode-ai/plugin@1.17.3`, `@opencode-ai/sdk@1.17.3`, and `@types/node@24.13.2`.
6. Issue triage:
   - `#26` remains closed.
   - `#25` remains open because GitHub repository sidebar homepage still reads `https://rdot.agnusdei.kr/`; `gh repo edit --homepage https://github.com/agnusdei1207/opencode-orchestrator/issues` still returns `HTTP 404` with the current `WRITE` token.

## Verification Observed

1. Baseline before edits:
   - `npx tsc --noEmit` passed.
   - Targeted Vitest passed: 3 files, 47 tests.
2. After code/test edits:
   - `npx tsc --noEmit` passed.
   - Targeted Vitest passed: 3 files, 24 tests.
   - `npm run build` passed.
   - Full Vitest passed: 70 files, 696 tests.
   - `cargo test --workspace --all-targets` passed: 32 tests.
   - `npm audit --json` passed with 0 vulnerabilities.
   - `npm pack --dry-run` passed.
   - `git diff --check` passed.
3. After OpenCode patch dependency update:
   - Installed `@opencode-ai/plugin`, `@opencode-ai/sdk` are `1.17.3`.
   - Installed plugin type still exposes `plugin?: Array<string | [string, PluginOptions]>`.
   - `npx tsc --noEmit` passed.
   - `npm run build` passed.
   - Full Vitest passed again: 70 files, 696 tests.
   - `cargo test --workspace --all-targets` passed again: 32 tests.
   - `npm audit --json` passed with 0 vulnerabilities.
   - `npm pack --dry-run` passed.
4. Release preflight for `1.3.6`:
   - Build passed.
   - Full Vitest passed.
   - Rust tests passed.
   - `npm audit --json` passed.
   - `npm pack --dry-run` passed.
   - Docker Linux x64 and Linux arm64 artifacts rebuilt; no artifact changes were detected.
5. Post-release:
   - `npm view opencode-orchestrator version dist-tags.latest dist.tarball` returned `1.3.6`.
   - `gh release view v1.3.6` returned the published release URL.
   - `gh run view 27313928882` returned `conclusion: success`.
   - `git status --short --branch` returned `## main...origin/main`.

## Next Exact Step

1. If repository settings access is available, update the GitHub repository sidebar Homepage field from `https://rdot.agnusdei.kr/` to `https://github.com/agnusdei1207/opencode-orchestrator/issues`.
2. After the sidebar homepage is updated and verified with `gh repo view --json homepageUrl`, close `#25`.
3. Configure the repository `NPM_TOKEN` Actions secret if public npm publish should also run from GitHub Actions instead of local-only.

## Incomplete Items and Why

- `#25` remains open because the actual GitHub repository sidebar homepage is repository settings/admin state. The current token has `WRITE` permission but the repository update endpoint still returns `HTTP 404`.
- Actions public npm publish remains skipped until the repository `NPM_TOKEN` secret is configured. Local npm publish succeeded.
- Native Windows local execution was not performed in this Linux workspace. Windows coverage came from source code path handling, tests, and the successful GitHub Actions Windows x64 build.

## Key Decisions

- Keep OpenCode SDK/plugin on the latest compatible patch line `1.17.3`; do not adopt TypeScript 6 or `@types/node` 25.x in this Node 24 / TypeScript 5 release.
- Keep prompt placeholder removal behavior-neutral: exported prompt fragments now contain real guidance, but active agent prompt composition was not rewired.
- Keep #25 open until the actual GitHub sidebar homepage changes.

## Rejected Alternatives

- Closing `#25` after package metadata and README fixes only: rejected because `gh repo view` still reports the old sidebar homepage.
- Upgrading TypeScript to 6.x or `@types/node` to 25.x: rejected as unnecessary major-line churn.
- Broadly rewriting every legacy `any` in the repository: rejected as separate refactor risk; this patch removed the newly audited `src/index.ts` event-boundary `any`.

## Known Risks

- GitHub repository sidebar may still show `https://rdot.agnusdei.kr/` until a repository admin updates settings.
- Repository Actions public npm publish remains skipped until `NPM_TOKEN` is configured.
- Some older hook/test modules still contain loose `any` casts and should be handled as a separate focused refactor.
- `reset:local` and `reset:prod` still contain platform-specific Homebrew assumptions outside the primary release path.

## Open These Files First Next Session

1. AGENT_MEMORY.md
2. README.md
3. package.json
4. package-lock.json
5. src/index.ts
6. src/agents/prompts/index.ts
7. tests/unit/prompt-system.test.ts
8. tests/unit/package-metadata.test.ts
9. .github/workflows/release.yml
10. scripts/release-sync-artifacts.mjs
