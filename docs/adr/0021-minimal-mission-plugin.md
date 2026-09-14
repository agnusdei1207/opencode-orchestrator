# ADR-0021: A Minimal Mission Plugin for OpenCode

Date: 2026-09-14 17:41 KST
Status: Accepted — incremental implementation in progress
Source: User-requested comparison, intent, and reduction plan; updated to prioritize removing existing code over adding subsystems.

## Intent: our identity

OpenCode Orchestrator is a small, goal-oriented Commander for OpenCode. It keeps the objective, the next action, and unfinished work connected across turns, and concludes with evidence and explicit remaining limitations.

Its identity is mission continuity, not a collection of tools or a fixed cast of agents. The existing Explore → Learn → Adapt → Act philosophy stays, expressed as a short working discipline. Commander owns the goal and final judgment; delegation is a means, not a required ceremony. A small task should finish in one session without launching a planner or reviewer.

The desired user experience is: give a goal; work progresses; interrupt when needed; resume with the same goal and known unfinished work; receive a result that says what was checked and what remains. This is a product focus, not a claim that other agents lack these capabilities or that our implementation already guarantees them.

Keep only code that makes this behavior reliable and cannot be supplied adequately by OpenCode, a short prompt, or an existing CLI. Prefer deletion to configuration flags, new managers, or optional feature collections.

## Decision

Reduce toward one Commander, one compact mission record, one continuation owner, and at most one plugin-owned tool (`mission`). Use native OpenCode agents and `task` for delegated work after compatibility is demonstrated.

The proposed `mission` tool has only two operations: checkpoint the current brief, or finish the mission with a summary and evidence references. It replaces existing mission/checklist machinery; it is not an additional workflow engine. Starting, pausing, resuming, and inspecting remain thin command adapters around the same record. Names and schemas are proposed, not shipped APIs.

Do not build a new team engine, journal, outbox service, provider adapter, compactor, or verification framework to achieve this reduction. If native background tasks cannot meet the required behavior on the chosen host version, retain the existing bounded delegation path temporarily and stop that deletion stage. Do not respond by creating another general runtime.

The user accepted implementation. Public tool removals change behavior and need a compatibility release rather than a patch-sized refactor. This document does not supersede implemented ADRs until those migrations actually pass.

## Compatibility evidence and local baseline

OpenCode compatibility is based on its public documentation and executed released packages. A sibling checkout may contain unreleased code and is not a supported API contract. Other local material informs design principles only; no source or prompts are copied.

| Project | Snapshot | Relevant difference |
| --- | --- | --- |
| OpenCode | Installed executable `1.18.29`; published SDK/plugin dependencies `1.17.18` | Public session and foreground task APIs are exercised by the isolated host QA runner. Native background delegation is not adopted without a documented public contract. |
| Orchestrator baseline | `572c7bef8ca00788bb4b986292558e6344681b39`; package `1.7.17`; SDK/plugin dependencies `1.17.18` | Baseline registered 30 static custom tools and four agent definitions. The current checkpoint has 25 tools and four optional compact presets; it includes the preceding uncommitted memory-helper refactor. |
| Pentesting | `199f75cb333f8cb4a0cf0be5631a6d6818a82c61`; `0.200.2`; clean | Standalone Rust runtime owns infrastructure that an OpenCode plugin should delegate to its host. |

The baseline 30-tool count is registry composition, not a runtime measurement: core 2 + search 8 + Git 2 + background commands 4 + web 4 + AST 2 + LSP 1 + parallel tools 7. Removing the prompt-only tool and four web tools reduces the total to 25. Tool availability in OpenCode can depend on provider, model, permissions, and flags; matching names alone does not prove replacement parity.

Pentesting's older five-tool, flat-team, LLM-only-compaction descriptions are not its full current contract. Current code has seven tools, bounded hierarchical teams, and a visible mechanical compaction fallback. Borrow ownership and boundedness, not historical numbers or entire mechanisms.

## What is actually distinctive

| User value | Small mechanism retained | Mechanism deliberately avoided |
| --- | --- | --- |
| The goal survives a long session | A bounded Commander-authored brief plus mission status, scoped to the root session | RAG, graphs, episode generation, a second transcript database |
| Work continues without fighting the user | One continuation path honoring pause, abort, busy state, and no-progress limits | Several competing idle/recovery loops or endless automatic retries |
| Completion is understandable | Explicit finish with evidence references and unresolved limitations | A separate verifier agent for every change, consensus, scoring, or checkbox-as-proof logic |

Evidence references identify native tool results or inspected artifacts. They are not an automatic proof of correctness. A failed check must remain a failed check; a manual assessment must be labeled as such. Structural validation can reject missing evidence or known unfinished work, but cannot establish that a model's semantic conclusion is true.

## Ownership boundary

| Owner | Responsibility |
| --- | --- |
| OpenCode | Credentials, provider/model selection, permissions, conversation/tool-result storage, native tools, child sessions, native task execution, native compaction, TUI, extension loading |
| Orchestrator | Mission identity and status, compact current brief, one guarded continuation decision, explicit finish receipt |
| Commander | Task decomposition, whether delegation/review is worthwhile, brief content, interpretation of evidence, final explanation |

Target dependency direction: OpenCode hooks/commands/tool → small mission functions → one mission record. Avoid a generic event bus, dependency container, policy registry, or plugin-inside-plugin layer.

Reuse and simplify `src/core/loop/mission-loop.ts` and existing hook entry points before creating directories. Store objective, root session ID, active/paused/completed status, brief, and a compact finish receipt in one bounded record per root session. Native session IDs link delegated work; do not duplicate child transcripts. A starting byte budget of 16 KiB per record, including an 8 KiB brief, is a proposed engineering constraint to test, not a measured optimum. Reject oversized updates without replacing the previous valid record.

One writer owns each mission record. Restart must reconcile referenced native sessions; an unavailable session is reported as unavailable, not silently recreated or rerun. Preserve existing user files during migration. A Markdown export, if retained for readability, is a projection rather than a second writable authority.

## Keep, remove, and decline

| Item | Action and reason | Condition before removal or adoption |
| --- | --- | --- |
| Commander and short shared philosophy | Keep: this is the product's goal-owning identity | Remove duplicated full-prompt injection; preserve user instructions and explicit model choices |
| Planner/Worker/Reviewer runtime machinery | Remove compulsory roles and automatic review after every Worker completion | Keep only a small worker prompt preset if native agents are insufficient; existing names may need a documented one-release migration |
| `call_agent` | Remove: its implementation returns a prompt and does not execute an agent despite its description | Update callers/prompts/tests to use the real native task path |
| Custom grep/glob/sed/diff/jq/HTTP/Git/file-stat wrappers | Remove: general toolbelt is not mission continuity | Verify needed cases with native tools or existing shell CLI; do not silently replace unavailable capabilities |
| Custom web search/fetch/cache/code-search, AST, LSP wrappers | Remove from core; users can use native tools, CLI, or independently installed extensions | LSP/search availability is conditional; document the actual supported configuration |
| Rust RPC pool, binaries, native build/release matrix | Remove from the plugin package when their final core consumer is gone | Do not silently delete the separate shell-listener user feature; retire or move that public surface in an explicitly scoped release |
| Background shell runner | Remove after native shell/background parity | Verify wait, cancel, output retrieval, and process cleanup on supported platforms |
| `ParallelAgentManager`, session pooling, task polling, work stealing | Target removal: native host owns execution | Native task/resume/abort/result/parent-notification tests must pass first; never import internal host services to force parity |
| `PluginManager` and general `HookRegistry` | Remove generic extension framework | Migrate needed callbacks directly to OpenCode hooks; document migration of user extensions instead of auto-deleting their files |
| `TodoSyncService` | Remove: the inspected consumer `sendTodosToSession()` is empty | Preserve any real file-creation dependency until its callers are migrated; do not claim native TUI parity from its stale comment |
| Custom TODO hierarchy, verification checklist parser, mandatory FINAL_PASS | Replace with native task planning plus explicit mission finish receipt | Define pause/unfinished/failed-check behavior before switching completion logic |
| Generated canvas, episode notes, decay metadata, MemoryManager projections | Remove from core: extra representations without a retained retrieval consumer | Preserve existing files; keep the compact mission brief; do not extend the just-refactored note helper into a new memory system |
| Metrics dashboard, OS sound/toast layers, extra progress projections | Remove from core | Keep only a concise native status message if it helps the user act |
| Automatic default-agent takeover and build/plan demotion | Remove: identity should be selected, not imposed on every OpenCode session | Preserve native and user-defined agent configuration; Commander remains available explicitly |
| Separate permission/role policy engine | Do not add; remove duplicative enforcement only after tracing it | Retain native permission checks, abort handling, path/resource boundaries, and secret-safe reporting |
| New journal/outbox database, RAG, multi-harness adapters, tmux/team framework | Do not adopt | Reconsider only with a reproducible unmet mission requirement and a smaller alternative ruled out |

## Principles retained

| Source | Adopt the principle | Do not import the implementation |
| --- | --- | --- |
| Pentesting: journal/inbox/brief ownership | One authority for each fact; current meaning is compact; unfinished work survives interruption | Its Rust journal, provider loop, semantic compactor, TUI, browser/container stack, offensive doctrine, or team topology |
| Pentesting: explicit completion and bounded resources | Idle is not success; limits and cancellation are enforced in code | Its report engine, full messaging API, or seven-tool set |

Local reliability requirements are separate from architectural attribution: completion, notification acceptance, and result observation must remain distinct; cancellation requires confirmed abort; compact context preserves session identity and unfinished work. Validate these outcomes with isolated live QA, without introducing another task manager, compactor, or platform abstraction.

If the old delegation implementation must remain during migration, apply only the small failure fixes it needs: failed sends must not clear pending notifications; batch acknowledgements must not clear unrelated arrivals; failed abort must not report success. These are temporary compatibility repairs, not a reason to grow a permanent team kernel. Do not promise exactly-once execution across a host/network boundary.

## Alternatives rejected

1. Add five orchestration tools, a durable outbox, a new brief service, and a completion engine. This addresses reliability by expanding the plugin into a second runtime; it conflicts with the user's stronger minimalism requirement.
2. Import a separate agent platform or Pentesting's Rust kernel. Their ownership boundaries and operational costs do not match an OpenCode plugin.
3. Keep all existing features behind flags. Disabled code still has dependencies, migrations, tests, and ownership costs. Flags may support a short migration, not become the permanent architecture.
4. Reduce to a prompt only immediately. Smaller, but not sufficient if interrupted missions lose status or multiple idle hooks restart work. Retain the smallest state/continuation seam demonstrated necessary by tests.
5. Rewrite everything at once. It would conceal which removed mechanisms were actually required. Delete in independently verified slices instead.

## Deletion-first implementation plan

This plan is recorded because the user explicitly requested it and subsequently authorized implementation. Each stage uses test-first changes and updates current architecture evidence. Acceptance of the design does not make unfinished stages implemented or establish release compatibility.

### 1. Prove the host replacement boundary

Files: new `tests/e2e/native-host-contract.test.ts` and `scripts/qa-native-host.mjs`; inspect `package.json`, `src/tools/parallel/delegate-task.ts`, `src/plugin-handlers/session-compacting-handler.ts`.

- [x] Exercise the built plugin with a real OpenCode binary and an isolated local fixture provider. Isolate config/data/state/cache and keep user settings untouched.
- [ ] Test foreground task, background task, same-session resume, busy-parent completion notification, rejected/ambiguous delivery, cancellation failure, compaction, and restart. Capture task/session IDs, hook events, and returned results.
- [x] Record exact host version, SDK version, required flags and observed API behavior. The isolated runner exercises released host `1.18.29` with SDK `1.17.18`, without background-task flags. Public documentation does not establish native background delivery parity; retain the corresponding existing runtime.
- [ ] If parity passes, propose one tested minimum host version. If it fails, record the specific gap and retain only its existing implementation for now. Do not call internal `BackgroundJob` or Effect services from the plugin.

Exit: a supported-host contract based on executed behavior, or a concrete blocked deletion list. No production replacement before this gate.

### 2. Delete misleading and nonfunctional plumbing first

Files: `src/tools/callAgent.ts`, `src/tools/registry.ts`, `src/core/sync/todo-sync-service.ts`, `src/index.ts`, `src/core/notification/task-toast-manager.ts`, and their existing unit tests.

- [x] Characterize actual call sites, prompt references, and TODO file initialization.
- [x] Remove the prompt-only `call_agent` surface, its dedicated UI hook, and obsolete instructions. Actual delegation remains available through `delegate_task` during migration.
- [x] Remove no-op TODO broadcast/watch plumbing. Startup no longer manufactures an empty checklist; actual mission writers remain, and existing files are preserved by regression tests.
- [x] Remove imports, shutdown handlers, constants, and tests tied solely to the deleted behavior; retain outcome tests.

Exit: less runtime code and no lost supported behavior. Rollback: restore this slice without touching mission data.

### 3. Strip the general toolbelt and nested plugin framework

Files: `src/tools/registry.ts`, `src/tools/search.ts`, `src/tools/web/`, `src/tools/ast/`, `src/tools/lsp/`, `src/tools/background-cmd/`, `src/core/plugins/plugin-manager.ts`, `src/hooks/index.ts`, `src/hooks/registry.ts`, `src/index.ts`.

- [ ] For each family, run the matching native/CLI replacement scenario from stage 1 before unregistering it.
- [x] Remove custom web fetch/search/cache/code-search and the document cache. Execute native webfetch on the released host; document conditional native websearch and the retirement of cache/code-search APIs rather than promise equivalent replacements. Preserve existing research files.
- [x] Remove the nested extension loader. OpenCode owns extension discovery; preserve existing files and document migration to its public plugin contract.
- [x] Remove hook metadata, dependency sorting and retry machinery. Retain a small insertion-ordered callback adapter; verify modified arguments reach the actual native pre-tool hook.
- [x] Restrict scheduled cleanup to owned task archives. Remove host dependency deletion, global file pruning, and no-op TODO history plumbing; test preservation of host and user files.
- [ ] Move retained lifecycle callbacks directly into the existing native hook handlers; remove the generic registration/dependency engine after its last consumer moves.
- [ ] Remove unused Rust/tool dependencies and packaging only after an exhaustive consumer trace. Treat shell-listener retirement separately; preserve existing user extension files.
- [ ] Update tool schemas, prompts, README, installer, lockfile, and release scripts in the same coherent slice. Publish removals only under the agreed compatibility release.

Exit: the plugin no longer installs a general development environment or loads another plugin ecosystem. Rollback: restore one family; no data deletion is part of this stage.

### 4. Collapse mission state and continuity

Files: `src/core/loop/mission-loop.ts`, `src/core/loop/mission-loop-handler.ts`, `src/core/loop/verification.ts`, `src/hooks/features/mission-loop.ts`, `src/core/knowledge/`, `src/core/memory/`, `src/plugin-handlers/system-transform-handler.ts`, `src/plugin-handlers/session-compacting-handler.ts`; proposed `src/tools/mission.ts` and `tests/unit/mission-contract.test.ts`.

- [ ] Write tests for root-session isolation; checkpoint/finish; oversize write preserving old state; failed writes; stale child IDs; pause; repeated idle; and restart without rerunning side effects.
- [ ] Consolidate mission state and brief into the existing persistence boundary, scoped per root session. Permit only that Commander to checkpoint or finish its record; no shared worker-written brief.
- [ ] Add the small `mission` operation only while removing checklist/TODO-derived completion. Finish carries evidence references and limitations; missing evidence or known running work does not become success.
- [ ] Keep exactly one continuation owner. An idle event is an opportunity to check state, not a completion signal. User pause/abort wins; repeated no-progress stops with an explanation; a status-read failure must not be interpreted as idle.
- [x] Remove generic non-mission TODO continuation and duplicate assistant-done mission handling. Guard the retained idle path against unknown status, unreadable TODO, pending tasks, abort, stale countdowns, and foreign-root ownership. The project-wide record and process-local pause remain migration limitations.
- [ ] Add bounded brief and native task IDs to the host compaction context. Do not replace the host compaction prompt, run another model call, or mark compaction successful from its pre-compaction hook.
- [ ] Stop generating canvas/episode/projection notes and delete unused machinery. Preserve historical files and the old mission record until migration is verified; avoid permanent dual writes.

Exit: one current mission record, one continuation path, one explicit finish surface. Rollback: restore the saved legacy record and the old reader; no inferred reconstruction of deleted history.

### 5. Hand execution to OpenCode and simplify the cast

Files: `src/core/agents/manager.ts`, `src/core/agents/manager/`, `src/core/agents/session-pool.ts`, `src/core/agents/concurrency.ts`, `src/core/queue/`, `src/tools/parallel/`, `src/agents/definitions.ts`, `src/agents/commander.ts`, `src/plugin-handlers/config-handler.ts`, `src/tools/slashCommand.ts`.

- [ ] Use native task/session identity and result retrieval under the stage-1 contract; do not create a second scheduler around it.
- [ ] Delete custom polling, pooling, work stealing and redundant task tools only after their lifecycle scenarios pass on the host. If the host cannot bound independent delegation adequately, keep the smallest existing admission guard, not the whole manager.
- [x] Delete producerless work-stealing loops and the foreground tool's duplicate SDK completion polling. Launch/resume share admission; result tools use current-run manager state. Preserve failed abort ownership, unsent notification batches, and resumed tasks during cleanup; do not replay ambiguous prompt or transport failures.
- [x] Remove unconditional Worker → Reviewer launches and their unused completion callbacks. The four role names remain optional presets for compatibility.
- [x] Preserve user-selected default agents and models. Remove build/plan demotion and duplicate Commander system-prompt injection.
- [x] Replace the fragment/profile framework with four compact optional presets and shared working discipline. Classify intent first; small work stays direct, dependent planning precedes implementation, review is optional. Preserve existing mission parser semantics until stage 4.
- [ ] Keep a single branded mission entry command; migrate conflicting aliases explicitly.
- [ ] Audit dependencies, timers, singleton state, public schemas, installers, binaries and documentation for orphaned code.

Exit target: at most one custom tool, no custom execution engine, no plugin-owned provider/compactor, and lower production code size than the starting tree. If native parity fails, this stage is incomplete rather than replaced with a new subsystem.

## Acceptance and evidence

| Criterion | Required evidence | Current assessment |
| --- | --- | --- |
| A simple task needs no mandatory delegation | Real-host transcript: Commander completes directly | Planned |
| Goal/next step survives compaction and restart | Same root/task IDs; restored brief; no duplicate task execution | Planned |
| Pause/abort is respected | Repeated idle events after pause create zero continuation prompts | Process-local abort/countdown regressions pass; durable pause is pending |
| Failures remain visible | Failed send/abort/check tests preserve truthful state and retrievable results | Retained runtime regressions pass; native background replacement contract is pending |
| Final response carries evidence and limits | Native result references resolve; failed checks are not labeled passed | Planned |
| Core is materially smaller | Count registered tools, runtime dependencies, production LOC and active timers before/after with the same method | Checkpoint: 30 to 25 tools; more than 7,900 fewer physical source lines including the prior helper refactor; dependencies unchanged; cleanup scheduler reduced to one timer; generic TODO countdown and idle work-stealing loops removed |
| Native coexistence works | Existing build/plan/default-agent/model settings remain intact | Config preservation tests pass; built-plugin host QA passes |
| Removed code is actually gone | Import/consumer audit, package contents, typecheck, build, behavioral tests | Removed-symbol and package-manifest audits, typecheck, build, and full tests pass for this checkpoint |

No percentage speedup, token savings, quality score, or lossless-host-storage guarantee is claimed. Preserve the existing coverage thresholds (statements 85%, branches 72%, functions 88%, lines 85%); retain meaningful behavior tests as implementations shrink. For changed plugin wiring, typecheck/unit tests alone are insufficient: run the isolated host contract. Do not run Rust builds when no Rust boundary changes; use the repository's container workflow if that boundary is changed.

The earlier memory refactor passed build, typecheck, 120 test files / 1,116 tests and coverage. Those results are a baseline, not validation of the target architecture. Current implementation evidence is recorded in `docs/reviews/2026-09-14-minimal-plugin.md`.

## Source map and decision boundaries

- Orchestrator: [tool registry](../../src/tools/registry.ts), [parallel tools](../../src/tools/parallel/index.ts), [manager](../../src/core/agents/manager.ts), [config handler](../../src/plugin-handlers/config-handler.ts), [compaction handler](../../src/plugin-handlers/session-compacting-handler.ts). Deleted prompt-only tool and TODO service remain inspectable in Git history.
- OpenCode public contracts, consulted 2026-09-14: [plugins](https://opencode.ai/docs/plugins/), [SDK](https://opencode.ai/docs/sdk/), [agents](https://opencode.ai/docs/agents/), [tools](https://opencode.ai/docs/tools/), [commands](https://opencode.ai/docs/commands/). Cross-check the deployed package types and run `scripts/qa-native-host.mjs`; preview documentation, internal services, and sibling source do not establish release support.
- Pentesting: `docs/intents/00-project.md`; `docs/ARCHITECTURE.md`; `src/coordinator/engine.rs:449`; `src/brief/store.rs:215`; `src/runtime/worker.rs:696`; `src/tools/builtin.rs:311`. Its source and later intents take precedence over older five-tool/flat-team descriptions.
- Existing decisions: [ADR-0003](0003-graphical-markdown-mission-memory.md), [ADR-0016](0016-session-lifecycle-context-limits.md), [ADR-0019](0019-retire-knowledge-rag-subsystem.md). Preserve their history; mark affected decisions superseded only as changes ship.

Remaining release decisions: choose a tested minimum OpenCode version and separately scope shell-listener retirement or distribution. Experimental background APIs are excluded from this implementation. Preserve user data throughout migration.
