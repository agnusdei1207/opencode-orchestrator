# Graphical Markdown Mission Memory Fusion Plan

Date: 2026-06-10

Repository: `/home/user/opencode-orchestrator`

Plan status: Evidence-backed execution plan. The first implementation pass is included in this release patch and must remain reversible through the plugin option switches described below.

## 1. Objective

The objective is to adopt the useful parts of Builder private's graphical Markdown memory approach without importing Builder's full runtime architecture. OpenCode Orchestrator already has a Markdown knowledge index and an autonomous `/task` mission loop. The next-generation path is to connect those existing systems through a small, verifiable runtime memory surface:

1. Persist mission evidence as bounded JSONL events under `.opencode/`.
2. Publish the active mission state as Markdown under `.opencode/docs/brain/scratchpad.md`.
3. Publish an Obsidian-compatible Canvas graph under `.opencode/docs/brain/knowledge-map.canvas`.
4. Let the existing knowledge RAG index read the Markdown memory naturally through `.opencode/docs/**/*.md`.
5. Keep all behavior controlled by OpenCode plugin options, with defaults that work out of the box.

## 2. Evidence Read Before Planning

### 2.1 Builder Private Files

Files read directly:

- `/home/user/builder-private/README.md`
- `/home/user/builder-private/ARCHITECTURE.md`
- `/home/user/builder-private/crates/builder_knowledge/src/scratchpad.rs`
- `/home/user/builder-private/crates/builder_knowledge/src/memory_note_adapter.rs`
- `/home/user/builder-private/crates/builder_knowledge/src/unified_retrieval.rs`
- `/home/user/builder-private/crates/builder_knowledge/src/knowledge_plane.rs`

Observed reusable patterns:

- Builder keeps a Markdown scratchpad at `docs/brain/scratchpad.md`.
- Builder keeps an Obsidian Canvas graph at `docs/brain/knowledge-map.canvas`.
- Builder treats runtime conversation memory as retrievable Markdown notes.
- Builder routes scratchpad, vault, and memory records through a unified retrieval layer.
- Builder writes memory artifacts atomically and keeps the prompt-time context bounded.

Patterns intentionally not copied:

- Builder's full Rust knowledge plane.
- Builder's domain-specific retrieval adapters.
- Builder's mission-control policy model.
- Builder's larger reranking pipeline.

Reason: OpenCode Orchestrator is an OpenCode plugin. It should preserve OpenCode's permission, config, agent, and plugin hook contracts instead of replacing them with Builder-specific runtime assumptions.

### 2.2 OpenCode Orchestrator Files

Files read directly:

- `src/core/knowledge/context-provider.ts`
- `src/core/knowledge/graph-parser.ts`
- `src/core/knowledge/hybrid-search.ts`
- `src/core/knowledge/tag-indexer.ts`
- `src/core/knowledge/scratchpad.ts`
- `src/core/knowledge/memory-consolidation.ts`
- `src/core/knowledge/safety-guards.ts`
- `src/core/loop/mission-loop.ts`
- `src/core/loop/mission-loop-handler.ts`
- `src/core/loop/verification.ts`
- `src/plugin-handlers/system-transform-handler.ts`
- `src/plugin-handlers/session-compacting-handler.ts`
- `src/plugin-handlers/config-handler.ts`
- `src/index.ts`
- `src/shared/core/constants/paths.ts`
- `src/shared/loop/interfaces/mission-loop.ts`
- `tests/e2e/mission-loop-lifecycle.test.ts`
- `tests/e2e/mission-loop-persistence.test.ts`
- `tests/unit/concurrency-config.test.ts`
- `tests/unit/config-handler.test.ts`

Observed facts:

- `KnowledgeContextProvider` already indexes both `docs/**/*.md` and `.opencode/docs/**/*.md`.
- The existing graph parser extracts Markdown wiki links from Markdown files, not Canvas JSON files.
- The mission loop already persists state to `.opencode`.
- Mission continuation already verifies TODO/checklist state before injecting prompts.
- System transform already injects mission-loop state and knowledge RAG context for orchestrated sessions.
- Plugin options are available as `PluginOptions = Record<string, unknown>` from `@opencode-ai/plugin`.

## 3. Target Design

### 3.1 Runtime Evidence Ledger

Add a mission ledger at:

```text
.opencode/mission-ledger.jsonl
```

Each line is one event with:

- `id`
- `type`
- `timestamp`
- `sessionID`
- optional `iteration`
- optional `objective`
- optional `summary`
- optional `reason`

Initial event types:

- `mission_started`
- `verification_failed`
- `continuation_scheduled`
- `prompt_injected`
- `mission_completed`
- `mission_cancelled`
- `circuit_open`

Design constraints:

- Append-only JSONL.
- Missing or malformed lines are skipped during reads.
- Reads are bounded by `missionLoop.maxEvidenceEvents`.
- Ledger writes degrade silently if the filesystem is unavailable, because the mission loop itself must not crash due to observability output.

### 3.2 Markdown Mission Scratchpad

Add runtime scratchpad output at:

```text
.opencode/docs/brain/scratchpad.md
```

Required sections:

- frontmatter tags: `scratchpad`, `mission`, `orchestrator`
- current objective
- session id
- active/inactive status
- iteration count
- last progress
- last verification summary
- last continuation reason
- recent evidence events
- short open questions section

Design constraints:

- The scratchpad is generated from runtime state and evidence; it is not a manual source of truth.
- The file must be Markdown so the existing `.opencode/docs` RAG path can index it without a new adapter.
- Writes use temp file plus rename for cross-platform atomicity where supported.

### 3.3 Obsidian Canvas Mission Graph

Add runtime graph output at:

```text
.opencode/docs/brain/knowledge-map.canvas
```

Required graph nodes:

- objective
- runtime
- verification
- last three evidence events

Required graph edges:

- objective drives runtime
- runtime checks verification
- verification links to evidence events

Design constraints:

- Canvas output is an auxiliary visualization and should not become a required runtime dependency.
- The existing Markdown RAG path remains the prompt-time integration path.
- Canvas generation must tolerate missing ledger data.

### 3.4 Plugin Options

Add a parsed orchestrator option contract:

```jsonc
[
  "opencode-orchestrator",
  {
    "agentConcurrency": {
      "commander": 1,
      "planner": 10,
      "worker": 10,
      "reviewer": 10
    },
    "missionLoop": {
      "ledger": true,
      "markdownMemory": true,
      "maxEvidenceEvents": 20
    }
  }
]
```

Design constraints:

- Defaults preserve current behavior plus the new memory outputs.
- Invalid option values fall back to defaults.
- Runtime behavior must actually respect parsed options.
- Legacy top-level concurrency keys in `opencode.jsonc` remain supported through the config hook.

## 4. Phase Plan

### Phase 1: Evidence and Contract Survey

Status: Complete.

Steps:

1. Read Builder private memory files listed in section 2.1.
2. Read OCO knowledge, mission-loop, system-transform, session-compacting, config, and test files listed in section 2.2.
3. Confirm that `.opencode/docs/**/*.md` is already indexed.
4. Confirm that Canvas JSON is currently only a visualization output, not part of prompt retrieval.

Exit gate:

- The implementation approach must be based on direct file reads, not memory.

### Phase 2: Runtime Evidence Ledger

Status: Implemented in this patch.

Steps:

1. Add `src/core/loop/mission-ledger.ts`.
2. Record mission start, failed verification, scheduled continuation, injected prompt, completion, cancellation, and circuit-open events.
3. Bound reads by runtime options.
4. Add tests that read the generated JSONL file from disk.

Exit gate:

- Ledger creation and disabled-ledger behavior are covered by tests.

### Phase 3: Graphical Markdown Mission Memory

Status: Implemented in this patch.

Steps:

1. Add `src/core/knowledge/mission-memory.ts`.
2. Generate `.opencode/docs/brain/scratchpad.md`.
3. Generate `.opencode/docs/brain/knowledge-map.canvas`.
4. Sync memory on mission start, cancel, completion, circuit-open, verification failure, scheduled continuation, and prompt injection.
5. Mark terminal mission snapshots as inactive.

Exit gate:

- Tests must parse the Canvas JSON and read the scratchpad Markdown from disk.

### Phase 4: Runtime Options Wiring

Status: Implemented in this patch.

Steps:

1. Add `src/core/config/plugin-options.ts`.
2. Add `src/core/loop/mission-runtime-options.ts`.
3. Parse plugin option tuples through the OpenCode plugin options argument.
4. Configure runtime options from `src/index.ts`.
5. Remove the unused legacy plugin-concurrency helper.

Exit gate:

- Tests must verify custom option parsing and fallback behavior.
- Build must pass with no unused or missing imports.

### Phase 5: Prompt and Compaction Alignment

Status: Implemented in this patch.

Steps:

1. Keep continuation prompts bounded and state-aware.
2. Include active objective, last progress, and last verification summary in system transform mission context.
3. Preserve objective and verification summary in compaction context.
4. Avoid long history dumps.

Exit gate:

- Existing mission-loop lifecycle and persistence tests must continue to pass.

### Phase 6: Documentation and Release Readiness

Status: In progress.

Steps:

1. Update README with the new mission memory option and runtime files.
2. Update system architecture docs with the mission memory plane.
3. Keep the top-level docs concise; put implementation rationale in dated plans.
4. Run build, focused tests, full Vitest, Rust workspace tests, audit, diff whitespace check, and release dry-run.
5. Update `AGENT_MEMORY.md` with one active snapshot.

Exit gate:

- All verification commands pass or any failure is reported with exact output and cause.

## 5. Rollback Plan

Rollback is intentionally simple:

1. Disable runtime output without code changes:

```jsonc
{
  "plugin": [
    [
      "opencode-orchestrator",
      {
        "missionLoop": {
          "ledger": false,
          "markdownMemory": false
        }
      }
    ]
  ]
}
```

2. If a release rollback is needed, remove:

- `src/core/loop/mission-ledger.ts`
- `src/core/loop/mission-runtime-options.ts`
- `src/core/knowledge/mission-memory.ts`
- related imports from mission-loop handlers and `src/index.ts`
- new tests and docs for mission memory

3. The generated files are local runtime artifacts only and can be deleted safely:

- `.opencode/mission-ledger.jsonl`
- `.opencode/docs/brain/scratchpad.md`
- `.opencode/docs/brain/knowledge-map.canvas`

## 6. Safety and Compatibility Notes

- File paths use `node:path.join`, not hard-coded path separators.
- Runtime artifacts stay under `.opencode`, matching existing project-local state conventions.
- Atomic memory writes use temp file plus rename.
- Ledger writes are append-only and best-effort.
- JSON parsing is guarded so malformed ledger lines cannot crash prompt injection.
- The OpenCode permission model remains the authority for user interaction and tool access.
- The plugin still does not force a model; Commander and subagents inherit OpenCode model routing unless the user configures agent-specific models.

## 7. Required Verification

Minimum verification for this patch:

```bash
npm run build
npx vitest run tests/unit/mission-runtime-memory.test.ts tests/unit/concurrency-config.test.ts
npx vitest run tests/e2e/mission-loop-lifecycle.test.ts tests/e2e/mission-loop-persistence.test.ts
npm test
cargo test --workspace --all-targets
npm audit --json
git diff --check
npm run release:dry-run
```

Completion requires observed command output, rereading changed files, and updating `AGENT_MEMORY.md`.
