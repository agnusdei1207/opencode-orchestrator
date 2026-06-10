# Agent Memory - OCO Session

## Current Task

Commit, push, and publish the next patch release for `opencode-orchestrator` after issue-driven fixes, OpenCode SDK/plugin alignment, cross-platform release hardening, and Builder-inspired mission memory work.

## Last Completed Step

1. Pulled and incorporated upstream work after merged PR `#29`.
2. Surveyed and addressed the open issue set:
   - `#30`: generated Commander, Planner, Worker, and Reviewer agents inherit global `permission`; same-name user agent permission overrides still win per key.
   - `#26`: model inheritance and concurrency configuration are documented; plugin-option concurrency is parsed at startup and legacy top-level concurrency keys are still accepted.
   - `#25`: package `homepage` and `bugs.url` now point to GitHub Issues; remote GitHub sidebar still requires repository settings/admin permission.
3. Aligned OpenCode package dependencies with the currently observed npm versions:
   - `@opencode-ai/plugin` `^1.17.1`
   - `@opencode-ai/sdk` `^1.17.1`
   - `@types/node` `^24.13.1`
   - `esbuild` `^0.28.0`
4. Fixed plugin API compatibility findings from local installed typings:
   - `src/index.ts` now exposes `dispose` instead of unsupported `shutdown`.
   - generated agent configs no longer emit unsupported `maxTokens` or `thinking` keys.
   - unused `src/shared/agent/constants/agent-tokens.ts` was removed.
   - Commander/system-transform prompt wording now allows concise clarification only when truly blocked and `permission.question` allows it.
5. Added cross-platform release/build hardening:
   - `scripts/build.mjs`
   - `scripts/release-preflight.mjs`
   - `scripts/release-auth-check.mjs`
   - `release:dry-run` validates build, tests, Rust tests, audit, and package dry-run without publishing.
   - patch/minor/major release scripts verify npm authentication before `npm version` to avoid orphan version commits/tags.
6. Created dated English plans:
   - `docs/histories/2026/06/10/PLAN_NextGenerationOpenCodeOrchestratorModernization_2026-06-10.md`
   - `docs/histories/2026/06/10/PLAN_OpenCodeSDKPluginAlignmentAndAutonomousMissionLoop_2026-06-10.md`
   - `docs/histories/2026/06/10/PLAN_GraphicalMarkdownMissionMemoryFusion_2026-06-10.md`
7. Surveyed Builder private graphical memory patterns:
   - `/home/user/builder-private/README.md`
   - `/home/user/builder-private/ARCHITECTURE.md`
   - `/home/user/builder-private/crates/builder_knowledge/src/scratchpad.rs`
   - `/home/user/builder-private/crates/builder_knowledge/src/memory_note_adapter.rs`
   - `/home/user/builder-private/crates/builder_knowledge/src/unified_retrieval.rs`
   - `/home/user/builder-private/crates/builder_knowledge/src/knowledge_plane.rs`
8. Implemented Builder-inspired mission memory without importing Builder's full runtime:
   - `.opencode/mission-ledger.jsonl`
   - `.opencode/docs/brain/scratchpad.md`
   - `.opencode/docs/brain/knowledge-map.canvas`
9. Added runtime option wiring:
   - `parseOrchestratorPluginOptions()`
   - `configureMissionRuntimeOptions()`
   - `missionLoop.ledger`
   - `missionLoop.markdownMemory`
   - `missionLoop.maxEvidenceEvents`
10. Strengthened `/task` mission loop state and continuation prompts:
    - compact objective
    - last progress
    - last verification summary
    - last continuation reason
    - last continuation timestamp
    - state-aware system transform and compaction context
11. Added or updated tests for:
    - permission inheritance, string permission expansion, and agent-specific permission overrides
    - blocked-clarification prompt guidance compatibility with `permission.question`
    - plugin/concurrency option parsing
    - mission runtime ledger and Markdown/Canvas memory output, including corrupt ledger line handling
    - mission-loop continuation prompt context
    - release hardening scripts
12. Verification observed:
    - `npm run build` passed.
    - `npx tsc --noEmit` passed.
    - `npx vitest run tests/unit/config-handler.test.ts tests/unit/mission-runtime-memory.test.ts tests/unit/release-hardening.test.ts tests/e2e/mission-loop-lifecycle.test.ts tests/e2e/mission-loop-persistence.test.ts` passed: 5 files, 29 tests.
    - `npm test` passed during `npm run release:dry-run`.
    - `cargo test --workspace --all-targets` passed during `npm run release:dry-run`: 32 Rust tests.
    - `npm audit --json` passed with 0 vulnerabilities.
    - `git diff --check` passed.
    - `npm run release:dry-run` passed after the final prompt/test/doc updates, including build, full tests, Rust tests, audit, and npm package dry-run.
    - `npm run release:patch` was executed before authentication and failed safely at `scripts/release-auth-check.mjs` before any version bump.
    - npm authentication was then configured in the user npm config and `npm whoami` returned the expected account.
    - Exact npm token string search in the repository returned no files.

## Next Exact Step

1. Review the final diff and changed-file contents once more.
2. Commit all implementation, test, docs, dependency, release-script, and memory changes.
3. Push `main` to `origin/main`.
4. Run `npm run release:patch` from a clean worktree.
5. Push the generated release commit and tag with `npm run release:push-tags`.
6. If the release succeeds, update this file with the published version and final verification evidence, commit that memory update, and push again.

## Incomplete Items and Why

- The code/docs/test changes are not committed or pushed yet.
- The patch release is not published yet; npm auth now works, but release still needs a clean committed worktree.
- GitHub issues are not closed/commented yet because the fixes have not been pushed.
- `#25` remote GitHub sidebar homepage is not fixed locally because repository metadata edits require repo settings/admin permission.
- Native Windows was not executed in this Linux workspace; Windows compatibility is covered by Node path/process APIs, script tests, Docker/release workflow checks, and package preflight, but not by a real Windows runner in this session.

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
4. scripts/release-auth-check.mjs
5. scripts/release-preflight.mjs
6. src/index.ts
7. src/plugin-handlers/config-handler.ts
8. src/core/config/plugin-options.ts
9. src/core/agents/concurrency-config.ts
10. src/core/loop/mission-ledger.ts
11. src/core/knowledge/mission-memory.ts
12. src/core/loop/mission-runtime-options.ts
13. src/core/loop/mission-loop.ts
14. src/core/loop/mission-loop-handler.ts
15. README.md
16. docs/SYSTEM_ARCHITECTURE.md
17. CONTRIBUTING.md
