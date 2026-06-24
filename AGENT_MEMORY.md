# Agent Memory - OCO Session

## Current Task

User requested repeated fresh exhaustive audit passes, with commit and push after each pass. Current pass completed: 37. The broader requested target remains active beyond this session.

## Last Completed Step

Completed audit pass 37 after removing the plugin handler interfaces folder and aligning plugin hook handler contracts with the current OpenCode plugin SDK shape.

- Confirmed `main` was aligned with `origin/main` at `a1d8ee6` before pass 37 changes.
- Reopened `AGENT_MEMORY.md`, `AGENTS.md`, all files under `src/plugin-handlers/interfaces/*`, every plugin handler under `src/plugin-handlers/*.ts`, `src/index.ts`, `src/core/orchestrator/state.ts`, `src/core/orchestrator/session-manager.ts`, `src/shared/message/constants.ts`, `src/shared/session/constants.ts`, and the relevant plugin handler unit tests.
- Checked current official OpenCode plugin and SDK docs. The docs describe plugin functions receiving context and returning hooks; TypeScript plugins import `Plugin` from `@opencode-ai/plugin`; documented events include `chat.message`, `tool.execute.before`, `tool.execute.after`, `experimental.session.compacting`, and `experimental.chat.system.transform`.
- Confirmed local installed `@opencode-ai/plugin` is `1.17.9`.
- Reopened `node_modules/@opencode-ai/plugin/dist/index.d.ts` and confirmed the current hook signatures:
  - `tool.execute.before` receives `(input, output)` and mutates `output.args`.
  - `tool.execute.after` reads tool arguments from `input.args`.
  - `experimental.session.compacting` exposes `{ sessionID }` and `{ context, prompt? }`.
  - `experimental.chat.system.transform` exposes `{ sessionID?, model }` and `{ system }`.
- Added `src/plugin-handlers/context.ts` as the actual shared plugin handler context owner.
- Moved plugin session/context contracts into `src/plugin-handlers/context.ts`.
- Updated handler modules to derive hook input/output types from `@opencode-ai/plugin` `Hooks` instead of local compatibility interfaces.
- Updated `tool-execute-pre-handler.ts` to read and replace `output.args` for `tool.execute.before`.
- Updated `tool-execute-handler.ts` to read `input.args` for `tool.execute.after`.
- Updated `chat-message-handler.ts` to use the SDK `Part` union with a text-part type guard.
- Updated `src/index.ts` to type the active session map with `PluginSessionState`.
- Updated related unit tests to import types from handler/context owner modules and to assert SDK `args` routing.
- Deleted all files under `src/plugin-handlers/interfaces/*` and removed the empty directory.

## Next Exact Step

Start audit pass 38 from current state:

1. Open `AGENT_MEMORY.md`.
2. Run `git status --branch --short`.
3. Reopen the pass-38 target files listed below.
4. Continue compatibility/debt removal from fresh evidence, starting with `src/utils/sanity/interfaces/sanity-result.ts`, `src/utils/sanity/types/index.ts`, and `src/utils/sanity/types/severity.ts`; determine the real owner module and remove compatibility type paths if possible.

## Incomplete Items And Why

The full requested repeated-pass objective is not complete. Pass 37 is complete and ready to commit/push.

## Key Decisions

- `src/plugin-handlers/context.ts` owns shared plugin handler context because `src/index.ts` constructs one handler context and passes it into all OpenCode hook handlers.
- Individual hook input/output contracts belong to their handler modules and are derived from `@opencode-ai/plugin` `Hooks`, not copied into local interface files.
- The old `tool-hook.ts` contract was incorrect for the current SDK: `tool.execute.before` must modify `output.args`, while `tool.execute.after` reads `input.args`.
- The plugin handler interfaces directory was deleted instead of kept as compatibility paths because the user explicitly prefers complete migration over compatibility shims.

## Rejected Alternatives

- Rejected keeping `src/plugin-handlers/interfaces/*` as barrel-style compatibility paths because that preserves the complexity the user asked to remove.
- Rejected continuing to use `arguments` on tool hook inputs because current `@opencode-ai/plugin` 1.17.9 exposes `args` and `output.args`.
- Rejected exporting context types from `src/index.ts` because the main plugin file explicitly avoids named exports to prevent OpenCode from treating every export as a plugin instance.
- Rejected copying SDK hook shapes into local standalone interfaces because that would drift again from the actual SDK contract.

## Known Risks

- The broader 100/1000-pass objective is intentionally not marked complete.
- External consumers importing deleted `src/plugin-handlers/interfaces/*` paths must import from `src/plugin-handlers/context.ts` or the specific handler module that owns the hook type.
- `src/utils/sanity/*` is the next remaining interface/type-contract group and needs fresh analysis before changing.

## Verification Observed

- Baseline focused tests before edits: plugin handler test set passed, 8 files and 36 tests.
- Baseline `npm run build --silent`: passed.
- Official OpenCode docs and local installed SDK typings were checked before changing plugin hook contracts.
- Post-edit `rg -n "plugin-handlers/interfaces|\\.\\/interfaces/(assistant-done-context|chat-message-context|event-handler-context|orchestrator-state|session-compacting|session-state|system-transform|tool-execute-context|tool-hook)|\\.\\./interfaces/(assistant-done-context|chat-message-context|event-handler-context|orchestrator-state|session-compacting|session-state|system-transform|tool-execute-context|tool-hook)" src tests -g '*.ts'`: no matches.
- `rmdir src/plugin-handlers/interfaces && test ! -d src/plugin-handlers/interfaces && echo deleted`: printed `deleted`.
- Focused plugin handler tests after edits: 8 files and 36 tests passed.
- Focused pre-tool test after final cleanup: 1 file and 3 tests passed.
- `npm run build --silent`: passed after edits.
- `git diff --check`: passed.
- Full `npx vitest run --reporter=dot`: passed, 96 files and 806 tests.
- `cargo fmt --check`: passed.
- `cargo test -p orchestrator-cli -p orchestrator-core --quiet`: passed, CLI 12 tests and core 35 tests.
- Remaining interface/type candidates observed with `rg --files src | rg '/interfaces/|/types/index\\.ts$|/types/.*\\.ts$' | sort`: `src/utils/sanity/interfaces/sanity-result.ts`, `src/utils/sanity/types/index.ts`, and `src/utils/sanity/types/severity.ts`.

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --branch --short`
3. `src/utils/sanity/interfaces/sanity-result.ts`
4. `src/utils/sanity/types/index.ts`
5. `src/utils/sanity/types/severity.ts`
6. `src/utils/sanity/index.ts`
7. `src/utils/sanity/checker.ts`
