# Agent Memory - OCO Session

## Current Task

User requested exhaustive routing, prompt architecture, SDK/plugin compatibility, minimal agent-to-agent communication, documentation ignore handling, and full commit/push completion.

## Last Completed Step

Completed final SDK migration pass with no legacy/fallback SDK routing left in the audited paths:

- `session.created` and `session.deleted` now read the official OpenCode SDK `properties.info.id` shape only.
- `message.updated` now reads `properties.info.sessionID` and `properties.info.tokens` only.
- Session pool compaction now uses the current OpenCode SDK v2 `client.v2.session.compact({ sessionID })` path only.
- Todo continuation and OS notify todo checks now read SDK `response.data` only.
- Assistant-done message extraction now reads SDK `response.data.parts` only.
- Agent-to-agent task completion and progress notifications are compact; rich task details stay in user-facing toast UI.
- `docs/architecture/prompt-architecture.html` is ignored by `.gitignore`.

## Next Exact Step

No in-repo implementation step remains. If work resumes, start by checking the latest branch state and user request.

## Incomplete Items And Why

None known after the latest verification pass.

## Key Decisions

- Removed SDK backwards-compatibility fallback paths because the user explicitly requested complete migration instead of compatibility complexity.
- Kept `session.idle` and `session.status` on `properties.sessionID` because that is the official SDK event shape.
- Kept parent-agent task notifications minimal: ids, agent, status, and exact next action only.
- Kept user-facing notifications separate from agent-to-agent prompts.

## Rejected Alternatives

- Rejected mixed legacy/current SDK event and response parsing.
- Rejected sending verbose task descriptions to parent agents.
- Rejected reusing sessions when compaction API is absent.

## Known Risks

- The change is intentionally tied to OpenCode SDK/plugin `1.17.9`; older SDK event/response shapes are no longer supported in the audited paths.
- There is existing repository debt with broad compatibility comments/modules outside this specific SDK routing migration.

## Verification Observed

- `npm run build`: passed.
- `npm test`: passed, 96 files and 803 tests.
- `cargo fmt --check`: passed.
- `cargo test -p orchestrator-cli -p orchestrator-core`: passed, CLI 12 tests and core 35 tests.
- `git diff --check`: passed.
- `git check-ignore -v docs/architecture/prompt-architecture.html`: `.gitignore:21` matched.
- Fallback search passed with no matches:
  - `?? response`
  - `response.data ?? response`
  - `client.session.compact`
  - `legacy compact`
  - `messageProperties.sessionID`
  - `event.properties?.sessionId`
  - `Array.isArray(response.parts)`

## Files To Open First Next Session

1. `AGENT_MEMORY.md`
2. `git status --short`
3. `src/plugin-handlers/event-handler.ts`
4. `src/core/agents/session-pool.ts`
5. `src/core/loop/todo-continuation.ts`
6. `src/plugin-handlers/assistant-done-handler.ts`
7. `tests/unit/event-handler.test.ts`
8. `tests/unit/session-pool-reset.test.ts`
