# Agent Memory - OCO Session

## Current Task

Patch release `opencode-orchestrator` `1.3.4` has been implemented, published to npm, pushed to `origin/main`, and tagged as `v1.3.4`.

## Last Completed Step

1. Pulled and incorporated upstream work after merged PR `#29`.
2. Surveyed and addressed the open issue set observed during this session:
   - `#30`: generated Commander, Planner, Worker, and Reviewer agents inherit global `permission`; same-name user agent permission overrides still win per key.
   - `#26`: model inheritance and concurrency configuration are documented; plugin-option concurrency is parsed at startup and legacy top-level concurrency keys are still accepted.
   - `#25`: package `homepage` and `bugs.url` now point to GitHub Issues; remote GitHub sidebar still requires repository settings/admin permission.
3. Aligned OpenCode package dependencies with the npm versions observed during the session:
   - `@opencode-ai/plugin` `^1.17.1`
   - `@opencode-ai/sdk` `^1.17.1`
   - `@types/node` `^24.13.1`
   - `esbuild` `^0.28.0`
4. Fixed OpenCode plugin API compatibility findings from local installed typings:
   - `src/index.ts` exposes `dispose` instead of unsupported `shutdown`.
   - generated agent configs no longer emit unsupported `maxTokens` or `thinking` keys.
   - unused `src/shared/agent/constants/agent-tokens.ts` was removed.
   - Commander/system-transform prompt wording allows concise clarification only when truly blocked and `permission.question` allows it.
5. Implemented Builder-inspired mission memory without importing Builder's full runtime:
   - `.opencode/mission-ledger.jsonl`
   - `.opencode/docs/brain/scratchpad.md`
   - `.opencode/docs/brain/knowledge-map.canvas`
6. Added runtime option wiring:
   - `parseOrchestratorPluginOptions()`
   - `configureMissionRuntimeOptions()`
   - `missionLoop.ledger`
   - `missionLoop.markdownMemory`
   - `missionLoop.maxEvidenceEvents`
7. Strengthened `/task` mission loop state and continuation prompts:
   - compact objective
   - last progress
   - last verification summary
   - last continuation reason
   - last continuation timestamp
   - state-aware system transform and compaction context
8. Added cross-platform release/build hardening:
   - `scripts/build.mjs`
   - `scripts/release-preflight.mjs`
   - `scripts/release-auth-check.mjs`
   - `scripts/release-version.mjs`
   - release scripts now authenticate before versioning, run preflight, build Linux Rust artifacts, publish, and avoid orphan version commits on auth failure.
9. Created dated English plans:
   - `docs/histories/2026/06/10/PLAN_NextGenerationOpenCodeOrchestratorModernization_2026-06-10.md`
   - `docs/histories/2026/06/10/PLAN_OpenCodeSDKPluginAlignmentAndAutonomousMissionLoop_2026-06-10.md`
   - `docs/histories/2026/06/10/PLAN_GraphicalMarkdownMissionMemoryFusion_2026-06-10.md`
10. Committed and pushed implementation commit:
    - `4c9a0b5 Prepare next-generation orchestrator patch`
11. Published and pushed release:
    - release commit `fcaa53f 1.3.4`
    - tag `v1.3.4`
    - `origin/main` and `refs/tags/v1.3.4` both verified at `fcaa53fa0d8659460c5ae6ad5ff0fdbd625efd43`
    - npm `opencode-orchestrator@1.3.4` published with `latest` dist-tag
12. Verification observed:
    - `npm run build` passed.
    - `npx tsc --noEmit` passed.
    - focused Vitest command passed: 5 files, 29 tests.
    - full Vitest suite passed during release preflight: 68 files, 680 tests.
    - `cargo test --workspace --all-targets` passed after stabilizing the local TSC timeout test: 32 Rust tests.
    - `npm audit --json` passed with 0 vulnerabilities during preflight.
    - `npm pack --dry-run` passed during preflight.
    - `npm run docker:rust-dist` passed and produced `bin/orchestrator-linux-x64` and `bin/orchestrator-linux-arm64`.
    - `npm run publish:token` passed and published `opencode-orchestrator@1.3.4`.
    - `npm view opencode-orchestrator version dist-tags.latest time.modified` returned `version = '1.3.4'`, `latest = '1.3.4'`, and `time.modified = '2026-06-10T15:08:38.780Z'`.
    - `git status -sb` was clean immediately after release push.
    - exact npm token string search in the repository returned no files.

## Next Exact Step

1. If GitHub issue triage is still desired, authenticate `gh` with an account that can comment/close issues and has repository settings permission.
2. Update repository sidebar homepage to `https://github.com/agnusdei1207/opencode-orchestrator/issues` from GitHub repository settings, or with an admin-scoped token.
3. Comment/close `#30` and `#26` as fixed in `v1.3.4`.
4. Comment on `#25` that package metadata was fixed in `v1.3.4`, and close only after the remote sidebar homepage is updated.

## Incomplete Items and Why

- GitHub issue comments/closing were not completed because `gh issue close/comment` returned `401 Unauthorized`.
- GitHub repository sidebar homepage was not updated because the repository update API returned `HTTP 404`, consistent with missing admin/repository-settings permission for the current credential.
- Native Windows execution was not performed in this Linux workspace; Windows compatibility is covered by Node path/process APIs, script tests, Docker/release workflow checks, and package preflight, but not by a real Windows runner in this session.

## Key Decisions

- Keep model selection user-controlled; do not hardcode a default orchestrator model.
- Use plugin options as the preferred location for orchestrator-specific concurrency and mission-loop settings.
- Preserve compatibility with older top-level concurrency keys.
- Copy global OpenCode permissions into generated orchestrator agents because generated same-name agents override user entries.
- Expand global string permissions into an object wildcard only when an agent-level object permission also needs to be merged.
- Strengthen existing `/task` instead of adding a parallel `/start` command.
- Adopt Builder's `scratchpad.md` and `knowledge-map.canvas` idea, but keep retrieval Markdown-based through the existing `.opencode/docs` RAG path.
- Keep the Canvas file as visualization, not as a required runtime dependency.
- Make ledger and Markdown memory best-effort and option-controlled so mission continuation does not fail due to observability output.
- Gate release publishing on npm authentication before any version bump.

## Rejected Alternatives

- Hardcoding orchestrator model defaults: rejected because OpenCode already has global, agent, and command model routing.
- Replacing OpenCode permissions with Builder-style policy manifests: rejected because the plugin should honor OpenCode's permission model.
- Adding a new autonomous command before stabilizing `/task`: rejected because `/task` already owns the mission-loop entry point.
- Importing Builder's full Rust knowledge plane: rejected as too large and not aligned with OpenCode plugin boundaries.
- Making Canvas JSON part of prompt retrieval: rejected because the current RAG path indexes Markdown and already covers `.opencode/docs/**/*.md`.
- Marking `#25` fully complete locally: rejected until remote GitHub sidebar metadata is changed by an account with sufficient permission.
- Running release patch without npm auth: rejected because it could leave behind a local version commit/tag before publish failure.

## Known Risks

- Remote GitHub sidebar may still point to the old down URL until a repo admin changes repository metadata.
- `reset:local` and `reset:prod` still contain platform-specific Homebrew assumptions outside the primary build/preflight path.
- SDK generated `Config` still does not fully model every documented config shape; `config-handler.ts` uses a narrow local adapter while importing `Config` from `@opencode-ai/plugin`.
- README still contains older broad performance claims that were not fully re-measured in this phase; new additions were kept evidence-backed.
- npm auth is stored outside the repository in user npm config; do not commit or print token values.

## Open These Files First Next Session

1. AGENT_MEMORY.md
2. git status/diff
3. package.json
4. scripts/release-version.mjs
5. scripts/release-auth-check.mjs
6. scripts/release-preflight.mjs
7. src/index.ts
8. src/plugin-handlers/config-handler.ts
9. src/core/config/plugin-options.ts
10. src/core/agents/concurrency-config.ts
11. src/core/loop/mission-ledger.ts
12. src/core/knowledge/mission-memory.ts
13. src/core/loop/mission-runtime-options.ts
14. src/core/loop/mission-loop.ts
15. src/core/loop/mission-loop-handler.ts
16. README.md
17. docs/SYSTEM_ARCHITECTURE.md
