---
title: "PLAN: Knowledge RAG Runtime Wiring and OpenCode SDK Alignment"
tags: [knowledge-rag, system-transform, opencode-sdk, hook-alignment, verification]
created: 2026-06-01
version: 1.3.2
status: completed
---

# PLAN: Knowledge RAG Runtime Wiring and OpenCode SDK Alignment

This document records the execution plan used on 2026-06-01 to audit the existing Second Brain plan, align the plugin with the current OpenCode SDK surface, and leave a reviewable trail for repository verification.

---

## 1. Target

- Verify whether `docs/histories/2026/05/31/PLAN_SecondBrainOrchestration_2026-05-31.md` matches the live code.
- Wire Knowledge RAG Phase 5 into the real runtime path used by orchestrated sessions.
- Remove or replace unsupported plugin hook wiring discovered during SDK verification.
- Re-run build, tests, and package dry-run before any commit or release decision.

---

## 2. Reason

The plan document declared the work as effectively complete, but the live runtime had two gaps:

1. Knowledge RAG modules existed but were not connected to `experimental.chat.system.transform`.
2. The plugin still referenced `assistant.done`, which is not part of the current official OpenCode SDK hook surface.

Without fixing those two items, the plan was not an accurate description of the working system.

---

## 3. Scope

### In Scope

- `src/plugin-handlers/system-transform-handler.ts`
- `src/core/knowledge/*`
- `src/plugin-handlers/event-handler.ts`
- `src/plugin-handlers/assistant-done-handler.ts`
- `src/shared/message/constants/plugin-hooks.ts`
- `src/index.ts`
- `tests/unit/system-transform-handler.test.ts`
- New unit tests for event bridging and assistant completion
- `README.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/histories/2026/05/31/PLAN_SecondBrainOrchestration_2026-05-31.md`
- Dependency range alignment in `package.json` and `package-lock.json`

### Out of Scope

- Permanent npm authentication setup on the local machine
- Publishing to npm without verified credentials already present

---

## 4. Baseline Evidence Collected

### Files Read Directly

- `AGENTS.md`
- `AGENT_MEMORY.md`
- `package.json`
- `README.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `docs/histories/2026/05/31/PLAN_SecondBrainOrchestration_2026-05-31.md`
- `src/index.ts`
- `src/plugin-handlers/system-transform-handler.ts`
- `src/plugin-handlers/event-handler.ts`
- `src/plugin-handlers/assistant-done-handler.ts`
- `src/hooks/registry.ts`
- `src/hooks/index.ts`
- `src/core/knowledge/tag-indexer.ts`
- `src/core/knowledge/graph-parser.ts`
- `src/core/knowledge/hybrid-search.ts`
- `src/core/knowledge/scratchpad.ts`
- `src/core/knowledge/safety-guards.ts`
- `src/core/knowledge/memory-consolidation.ts`

### Commands Observed

- `npm view @opencode-ai/plugin version`
- `npm view @opencode-ai/sdk version`
- `npm run build`
- `npm test`
- `npm run release:dry-run`

### Official SDK Verification

Verified against:

- official OpenCode plugin docs
- installed package typings from `node_modules/@opencode-ai/plugin/dist/index.d.ts`
- installed SDK event typings from `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts`

---

## 5. Planned Execution Order

1. Audit the plan document against live runtime wiring.
2. Verify the current OpenCode SDK hook surface and package versions.
3. Replace unsupported completion-hook wiring with supported event-based completion handling.
4. Implement Knowledge RAG context injection in `system-transform-handler.ts`.
5. Add regression tests for the new runtime paths.
6. Update documentation to match verified behavior.
7. Run build, full test suite, and package dry-run.
8. Defer commit / push / patch release until review is complete.

---

## 6. Expected Impact

- Orchestrated sessions receive repository knowledge matches at system-prompt time.
- Hook wiring matches the current OpenCode SDK contract.
- Documentation becomes evidence-aligned instead of aspirational.
- Packaging remains valid under `npm pack --dry-run`.

---

## 7. Rollback Plan

- Revert `src/core/knowledge/context-provider.ts` and the `system-transform-handler.ts` changes to disable Phase 5 runtime injection.
- Restore the old completion path only if a supported SDK hook is reintroduced upstream.
- Revert documentation changes independently if the code changes must remain but wording needs revision.

---

## 8. Completion Criteria

- [x] Plan audit completed against live code
- [x] Official SDK surface checked
- [x] Knowledge RAG runtime injection implemented
- [x] Unsupported completion-hook path removed
- [x] Regression tests added
- [x] `npm run build` passed
- [x] `npm test` passed
- [x] `npm run release:dry-run` passed
- [x] Commit created
- [x] Push completed for the implementation commit `22001ef`
- [x] Patch release completed (`1.3.3` published)

---

## 9. Post-Review Execution Addendum

After the user approved direct execution, the following additional steps were performed:

1. Created and pushed implementation commit `22001ef` to `origin/main`.
2. Ran `npm run release:patch`.
3. Observed successful local version bump to `1.3.3`.
4. Observed successful Docker-based Rust artifact rebuild for `linux-x64` and `linux-arm64`.
5. Verified the Windows environment exposes `NPM_TOKEN`, and verified the token with `npm whoami`.
6. Published `opencode-orchestrator@1.3.3` successfully using a temporary npm user config backed by the provided token.
7. Pushed the release lineage to `origin/main` and pushed tag `v1.3.3` to origin.

Resulting release state:

- published package: `opencode-orchestrator@1.3.3`
- npm registry latest observed version: `1.3.3`
- remote `main`: includes the release lineage and publication records
- local `main`: aligned with `origin/main`
- remote/local tag: `v1.3.3`
