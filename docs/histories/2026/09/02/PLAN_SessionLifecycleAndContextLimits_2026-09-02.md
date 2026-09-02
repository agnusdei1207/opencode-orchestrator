# Plan: Session Lifecycle Safety and Model-Aware Context Limits

Date: 2026-09-02
Scope: GitHub issues #41, #40, #39
Baseline: main @ 68417a0 (v1.7.14), `tsc --noEmit` clean, 1008 tests green once `dist/` is built
Reference host: OpenCode 1.18.26 (`../opencode`), plugin SDK 1.17.18, DCP 3.1.15 (`../opencode-dcp`)

## 1. Target and success criteria

| Issue | Symptom | Root cause (verified in source) | Done when |
|---|---|---|---|
| #41 | `FOREIGN KEY constraint failed` on `message`/`part` inserts; Commander waits forever | `SessionPool.deleteSession` calls `DELETE /session/:id` with no check that the session is idle or that trailing projector writes have landed. In the shipped SDK there is no `v2.session.compact`, so every `release()` invalidates immediately (`session-pool.ts:301-332`). Upstream projects `SessionV1.Event.Deleted` as `DELETE FROM session` (cascade) while `MessageUpdated`/`PartUpdated` projectors keep inserting rows keyed by `session_id` (`core/src/session/projector.ts:257-320`). When a task dies this way `handleSessionDeleted` drops the task silently, so no completion notice ever reaches the parent. | Pool never deletes an in-use session, deletes an idle one only after the authoritative status says idle and a settle window has passed since its last observed activity, skips busy sessions on shutdown, and a dead/timed-out task produces a parent notification. Pinned by unit tests. |
| #40 | 70/85/95% alerts fire against a hardcoded 200k window | `CONTEXT_MONITOR_CONFIG.DEFAULT_MAX_TOKENS` is the only limit ever used (`event-handler.ts:173-178`, `resource-control.ts:88`). The host already sends `model.limit.context` to `chat.params`/`system.transform` hooks and `message.updated` carries `providerID`/`modelID`; `provider.list()` returns the same limit. | Limit resolves as override → model metadata → default; alert path counts tokens the way upstream `isOverflow` does (`session/overflow.ts:31-33`); `contextMaxTokens` is in the options schema, JSON schema, README. |
| #39 | Commander loops re-emitting DCP's `<dcp-system-reminder>` text | The nudge and `compress` tool belong to DCP; the model echoes the reminder instead of calling the tool. Our part: every idle re-prompts the session (todo/mission continuation) even when the last turns were identical no-tool output, so the loop never stops. | Consecutive identical no-tool assistant turns open the circuit breaker with a long cooldown, both continuation paths honor it, and the user sees a toast. Verified that no orchestrator hook blocks or strips DCP's `compress` tool for the Commander. |

## 2. Risk and reversibility

- All changes are plugin-side code; no schema or persisted-data migration. Two-way door.
- #41 changes when sessions are deleted (later, never while busy). Worst case: a pooled child session outlives its task in the OpenCode DB. Bounded by a maximum deferral after which the pool forgets the session without deleting it.
- #39 guard could suppress a legitimate continuation if a model genuinely repeats itself three times with no tool call; that is exactly the stuck case, and a user message resets it.

## 3. Tasks (producer → consumer)

1. `session/activity.ts`: record last activity per session from `message.updated`, `message.part.updated`, `session.status`; expose `getLastActivityAt`.
2. `session-pool.ts`: guarded deletion (in-use defer, busy defer via `isSessionBusy`, settle grace, bounded retries), `forget()` for sessions the server already deleted, idle-only shutdown.
3. `manager/event-handler.ts` + `manager/task-cleaner.ts`: dead/timed-out task → `queueNotification` + `notifyParentIfAllComplete`; deleted session → `forget`, not `invalidate`.
4. `context/context-limit-resolver.ts` (new) + `chat.params` hook feed + `provider.list()` fallback; options schema, JSON schema, README.
5. `plugin-handlers/event-handler.ts`: resolve per model, upstream token formula, record real usage; `resource-control.ts` reads the resolved limit and real usage.
6. `loop/circuit-breaker.ts`: repeated-output detection; `assistant-done-handler.ts` feeds it; `todo-continuation.ts` honors an open circuit.
7. Tests for every item above; regenerate schema; docs.
8. QA: build, typecheck, full suite, install into a local OpenCode 1.18.26 with a mock OpenAI-compatible provider and drive a real session end to end.

## 4. Rollback

`git revert` of the release commit; no data to migrate back.
