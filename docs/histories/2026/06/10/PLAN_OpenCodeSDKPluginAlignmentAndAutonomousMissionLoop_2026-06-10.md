# OpenCode SDK/Plugin Alignment and Autonomous Mission Loop Plan

Date: 2026-06-10

Repository: `/home/user/opencode-orchestrator`

Plan status: Evidence-backed implementation plan. Phase 1 is intended for immediate execution in this session. Later phases define the next safe modernization sequence.

## 1. Executive Objective

The objective is to turn `opencode-orchestrator` into a cleaner, more reliable OpenCode plugin while preserving the current user-facing workflow. The plugin should stay aligned with the official OpenCode SDK/plugin contract, avoid undocumented assumptions, and strengthen autonomous mission execution without giving the model unchecked completion authority.

This plan focuses on four concrete outcomes:

1. Keep the OpenCode plugin boundary aligned with the current `@opencode-ai/plugin` and `@opencode-ai/sdk` packages.
2. Make configuration behavior explicit and test-backed for models, permissions, commands, and concurrency.
3. Strengthen the existing mission loop so it monitors the active objective and injects concise, state-aware continuation prompts.
4. Keep documentation polished and understated, adding enough architecture detail to explain the new behavior without turning the README into a changelog.

## 2. Verified Evidence

### 2.1 Official OpenCode Documentation

Official documentation checked on 2026-06-10:

- `https://opencode.ai/docs/plugins/`
- `https://opencode.ai/docs/sdk/`
- `https://opencode.ai/docs/config/`
- `https://opencode.ai/docs/agents/`
- `https://opencode.ai/docs/permissions/`
- `https://opencode.ai/docs/commands/`
- `https://opencode.ai/docs/windows-wsl/`

Observed facts:

- Plugins can be loaded from local `.opencode/plugins/`, global config plugins, project config plugins, or npm package names in the `plugin` config field.
- Plugin load order is global config, project config, global plugin directory, then project plugin directory.
- A plugin module receives OpenCode runtime context such as `project`, `directory`, `worktree`, `client`, and Bun shell helper `$`.
- TypeScript plugins import `Plugin` from `@opencode-ai/plugin`.
- Official event names include `message.updated`, `session.idle`, `session.compacted`, `tool.execute.before`, `tool.execute.after`, `permission.asked`, and related session/tool/todo events.
- The config document describes `permission`, `command`, `agent`, `model`, `plugin`, `instructions`, `watcher`, `mcp`, `formatter`, `lsp`, provider allow/deny lists, and experimental options.
- Commands support `template`, `description`, optional `agent`, optional `subtask`, and optional `model`.
- Permissions resolve to `allow`, `ask`, or `deny`, and may be configured globally or per tool.
- The `question` tool is controlled through `permission.question`.
- Primary agents are direct chat agents; subagents are invoked by primary agents or by mention.
- The default agent must be a primary agent.
- Windows support is best through WSL; native Windows has more terminal and filesystem caveats.

### 2.2 Local Package Type Evidence

Installed package versions observed from `node_modules`:

- `@opencode-ai/plugin`: `1.17.1`
- `@opencode-ai/sdk`: `1.17.1`

Local type evidence:

- `@opencode-ai/plugin/dist/index.d.ts` defines `PluginOptions = Record<string, unknown>`.
- `@opencode-ai/plugin/dist/index.d.ts` defines `Plugin = (input: PluginInput, options?: PluginOptions) => Promise<Hooks>`.
- The plugin package extends SDK config with `plugin?: Array<string | [string, PluginOptions]>`.
- SDK generated `Config` still models `plugin?: Array<string>`, so plugin-package `Config` is the better type surface for plugin option tuples.
- Hook types include:
  - `config`
  - `event`
  - `chat.message`
  - `chat.params`
  - `permission.ask`
  - `command.execute.before`
  - `tool.execute.before`
  - `tool.execute.after`
  - `shell.env`
  - `experimental.chat.messages.transform`
  - `experimental.chat.system.transform`
  - `experimental.session.compacting`
  - `experimental.compaction.autocontinue`
  - `tool.definition`
- SDK session APIs include `session.prompt`, `session.promptAsync`, `session.message`, `session.messages`, `session.command`, `session.abort`, and related session endpoints.

### 2.3 Current Repository Evidence

Files read before this plan:

- `AGENTS.md`
- `AGENT_MEMORY.md`
- `package.json`
- `README.md`
- `docs/SYSTEM_ARCHITECTURE.md`
- `src/index.ts`
- `src/plugin-handlers/config-handler.ts`
- `src/plugin-handlers/chat-message-handler.ts`
- `src/plugin-handlers/assistant-done-handler.ts`
- `src/hooks/registry.ts`
- `src/hooks/types.ts`
- `src/hooks/constants.ts`
- `src/hooks/features/mission-loop.ts`
- `src/core/loop/mission-loop.ts`
- `src/core/loop/mission-loop-handler.ts`
- `src/shared/loop/interfaces/mission-loop.ts`
- `src/tools/slashCommand.ts`
- `tests/e2e/mission-loop-lifecycle.test.ts`
- `tests/e2e/mission-loop-persistence.test.ts`
- `tests/unit/assistant-done-handler.test.ts`

Baseline checks before implementation:

- `npm run build` passed.
- `npx vitest run tests/e2e/mission-loop-lifecycle.test.ts tests/e2e/mission-loop-persistence.test.ts tests/unit/assistant-done-handler.test.ts --reporter=dot` passed with 3 files and 14 tests.

### 2.4 Builder-Private Pattern Evidence

Builder files read for this plan:

- `/home/user/builder-private/ARCHITECTURE.md`
- `/home/user/builder-private/crates/builder_app/src/mission_control.rs`
- `/home/user/builder-private/crates/builder_app/src/system_prompt.rs`
- `/home/user/builder-private/crates/builder_app/src/user_prompt.rs`

Reusable patterns:

- The runtime owns objective state; the model does not become the source of truth merely by claiming completion.
- Prompt-time context is layered into the active turn from structured state.
- Mission control summaries are compact and bounded.
- Completion claims are adjudicated against evidence, obligations, gates, and verification records.
- Retrieval and memory signals are useful only when they remain bounded and relevant to the active objective.

Patterns not copied:

- Builder's full Rust control-plane and persistence architecture.
- Builder's domain-specific pentesting/CTF skills.
- Builder's permission policy model as a replacement for OpenCode's permission config.

## 3. Current State Summary

The repository already has strong pieces:

- A four-agent structure: Commander, Planner, Worker, Reviewer.
- A config hook that registers commands and generated agents.
- A hook registry with chat, done, pre-tool, and post-tool phases.
- A mission loop that starts on `/task`, persists state to `.opencode`, verifies TODO/checklist state, and injects continuation prompts.
- A knowledge system that injects repository markdown through `experimental.chat.system.transform`.
- A release hardening path added in the current worktree with `scripts/build.mjs` and `scripts/release-preflight.mjs`.
- Local fixes for GitHub issues #26 and #30, and a local metadata fix for #25.

The main gap is not the absence of a mission loop. The gap is that the mission loop's continuation prompt is too shallow: it repeats the original task and verification summary, but does not consistently present a compact objective state, progress, stagnation, next action, and safety boundaries in a machine-stable format.

## 4. Target Architecture

### 4.1 Plugin Boundary

`src/index.ts` remains the single plugin entry. It should:

- Use the `Plugin` type from `@opencode-ai/plugin`.
- Accept plugin options through the second plugin argument.
- Return only officially typed hooks.
- Keep experimental hooks isolated in dedicated handlers.
- Avoid assuming SDK generated `Config.plugin` can express plugin options when plugin-package `Config` already adds that support.

### 4.2 Config Boundary

`src/plugin-handlers/config-handler.ts` should:

- Preserve existing user commands.
- Register Orchestrator commands deterministically.
- Preserve user-defined same-name agent settings where compatible.
- Copy global `permission` into generated Orchestrator agents.
- Allow agent-specific permission overrides.
- Keep `commander` as a primary agent when used as `default_agent`.
- Avoid hardcoding model selection unless the user explicitly configures agent or command models.

### 4.3 Mission State Boundary

`src/core/loop/mission-loop.ts` should own the persisted mission loop state. It should contain only serializable mission control data:

- active flag
- session id
- original prompt
- iteration
- max iterations
- started timestamp
- last activity timestamp
- last progress
- stagnation count
- optional objective title
- optional last verification summary
- optional last continuation reason

This state should remain JSON-compatible and restart-safe.

### 4.4 Mission Continuation Boundary

`src/core/loop/mission-loop-handler.ts` should make continuation decisions from verified runtime state:

- Do not inject if the session is aborting.
- Do not inject while child/background tasks are running.
- Do not inject while recovery or compaction guard is active.
- Do not inject when the circuit breaker is open.
- Verify completion before injecting.
- Emit compact prompts with:
  - objective
  - iteration
  - progress
  - verification summary
  - stagnation state
  - next required action
  - completion rule

### 4.5 Prompt Shape

Continuation prompts should be structured but small. They should not dump long history. They should tell the Commander what changed and what to do next.

Target prompt sections:

```text
<mission_loop iteration="N" max="M">
MISSION NOT COMPLETE

Objective:
...

Runtime status:
- todo progress: ...
- verification: ...
- stagnation: ...
- continuation reason: ...

Next action:
1. Read the current TODO/checklist/sync issue state.
2. Delegate or execute only the next unblocked work.
3. Verify with real commands or file reads.
4. Finish only when verification passes.
</mission_loop>
```

### 4.6 Documentation Boundary

README should stay clean. It should mention:

- Model, permission, and concurrency configuration.
- Mission loop autonomous continuation.
- Memory and knowledge injection at a high level.

`docs/SYSTEM_ARCHITECTURE.md` can hold the fuller structure:

- Plugin boundary.
- Config/permission/model rules.
- Mission loop control plane.
- Memory and knowledge planes.
- Verification and continuation guards.

## 5. Phase Plan

### Phase 1: SDK/Plugin Contract and Mission Loop Prompt Stabilization

Goal: Make the already-existing mission loop better aligned with the OpenCode plugin contract and Builder-inspired runtime control principles.

Implementation steps:

1. Add a small mission control prompt model in `src/core/loop/mission-loop.ts`.
2. Extend `MissionLoopState` with optional serializable fields for the last verification summary and continuation reason.
3. Generate continuation prompts through a bounded helper rather than ad hoc string concatenation.
4. Update `mission-loop-handler.ts` to write the last verification summary and continuation reason before scheduling a continuation.
5. Keep all existing continuation gates intact.
6. Add tests that assert:
   - mission state persists the new optional fields
   - continuation prompt includes objective, runtime status, next action, and completion rule
   - stagnation intervention still prefixes the continuation prompt when needed
7. Update README and architecture docs with concise descriptions.

Definition of done:

- Focused mission-loop tests pass.
- Full TypeScript test suite passes.
- Build passes.
- No stale docs contradict code.

### Phase 2: Hook Contract Cleanup

Goal: Reduce hallucination risk by removing local assumptions around hook payloads.

Implementation steps:

1. Replace local hook input aliases with imported plugin hook shapes where practical.
2. Isolate unknown SDK gaps behind narrow adapters.
3. Remove duplicate event comments and stale inline comments.
4. Add tests for hook result behavior:
   - chat message command rewrite
   - assistant done dedupe
   - done hook injection
   - event bridge for `message.updated` and `session.idle`

Definition of done:

- No new untyped `any` in touched files.
- Hook tests cover each dynamic registration branch.
- Build and full tests pass.

### Phase 3: Config Schema Stabilization

Goal: Make plugin options explicit and resilient.

Implementation steps:

1. Add a local `OrchestratorPluginOptions` type.
2. Parse plugin options through a validation helper.
3. Keep unknown keys ignored by default.
4. Document supported keys:
   - `defaultConcurrency`
   - `agentConcurrency`
   - `providerConcurrency`
   - `modelConcurrency`
   - `missionLoop`
5. Add tests for invalid values and merge precedence.

Definition of done:

- Config behavior is deterministic.
- Docs show one recommended config shape.
- Legacy top-level compatibility is tested.

### Phase 4: Runtime Evidence Ledger

Goal: Move completion authority from prompt text to structured evidence.

Implementation steps:

1. Define a small JSONL or JSON ledger under `.opencode`.
2. Record mission lifecycle events:
   - loop started
   - continuation scheduled
   - prompt injected
   - verification passed
   - verification failed
   - mission completed
   - circuit breaker open
3. Keep the existing state file as compatibility state.
4. Add tests for restart readback and corrupt-record handling.

Definition of done:

- Continuation can be explained from persisted evidence.
- Mission completion has an auditable trail.

### Phase 5: Memory and Knowledge Integration

Goal: Keep active objective context visible without over-injecting.

Implementation steps:

1. Feed mission objective title and last verification summary into system transform context.
2. Keep injection bounded by token and item count.
3. Prefer exact mission state over broad markdown retrieval when both exist.
4. Add tests for system transform behavior with and without active mission state.

Definition of done:

- The Commander receives active objective context after compaction/restart.
- Prompt injection remains small and deterministic.

### Phase 6: Release and Cross-Platform Hardening

Goal: Keep release patches safe across Linux, macOS, Windows, and WSL.

Implementation steps:

1. Continue replacing POSIX-only release/build scripts with Node scripts.
2. Keep Docker-based Rust artifact builds where cross-compilation is required.
3. Add package dry-run checks for expected files and executable bits.
4. Fail unsupported OS/arch combinations with explicit messages.
5. Keep WSL as the recommended Windows path in docs while avoiding native-Windows breakage in Node scripts.

Definition of done:

- `npm run release:dry-run` passes.
- Package contents are inspected by test.
- Unsupported platforms fail clearly.

## 6. Risk Controls

- Do not change default permissions beyond copying the user-configured global permission into generated agents.
- Do not hardcode a default model.
- Do not make the mission loop inject prompts while background tasks are still running.
- Do not remove existing TODO/checklist verification until the replacement ledger is implemented and tested.
- Do not introduce a new database or service dependency for Phase 1.
- Do not broaden autonomous behavior outside `/task` mission mode.

## 7. Immediate Execution Scope

This session should execute Phase 1 only:

- Plan file creation.
- Mission-loop continuation prompt stabilization.
- Focused tests.
- README and architecture documentation updates.
- Full build/test verification if focused tests pass.

The following items are intentionally not in immediate scope:

- Full evidence ledger.
- New database/state backend.
- New agent team.
- OpenCode provider/model routing.
- Runtime permission replacement.
- Closing GitHub issues before pushing.

## 8. Verification Matrix

Required commands for Phase 1:

```bash
npm run build
npx vitest run tests/e2e/mission-loop-lifecycle.test.ts tests/e2e/mission-loop-persistence.test.ts tests/unit/assistant-done-handler.test.ts --reporter=dot
npx vitest run --reporter=dot
npm audit --json
git diff --check
```

Rust tests are required if TypeScript changes affect Rust binary loading, JSON-RPC tool behavior, package release scripts, or shared constants used by Rust. Phase 1 does not intentionally change those surfaces, but the final release patch should still run:

```bash
cargo test --workspace --all-targets
```

## 9. Expected User-Facing Result

After Phase 1, `/task` remains the same entry point. The user should not need to learn a new command. When the Commander pauses before completion, the mission loop should inject a better continuation prompt that:

- states that the mission is not complete
- repeats the active objective
- reports current verification/progress
- warns when progress is stagnant
- instructs the next narrow action
- preserves the rule that completion requires real verification

The README should remain concise, with the detailed rationale living in architecture docs and dated plans.
