# Report: Session Lifecycle Safety and Model-Aware Context Limits

Date: 2026-09-02 18:00 KST
Issues: #41, #40, #39
Status: ✅ IMPLEMENTED — build clean, `tsc` clean, 1046 tests pass, verified live on OpenCode 1.18.26

## 1. What was wrong and what changed

### Issue #41 — pool deletes sessions the host is still writing
The session pool deleted OpenCode session rows (idle cleanup, pool-size
eviction, retirement/reset-failure invalidation, shutdown bulk delete) with no
check that the session was idle or that the host's asynchronous `message`/`part`
projectors had finished. Deleting the row cascades over those tables
(`core/src/session/projector.ts`), so the host's own inserts failed with
`FOREIGN KEY constraint failed` and the task result was destroyed, leaving the
Commander waiting forever.

Fix (`session-pool.ts`): every delete goes through one guarded path.

- An in-use session is never deleted; the request is recorded and runs on release.
- A released session is deleted only after the authoritative status
  (`isSessionBusy`) reports idle and no host activity has been seen for a
  settle window (`DELETE_SETTLE_MS`, 10s), measured from the newest of last-use,
  release, and the last observed host event.
- Busy sessions are re-checked on a short timer; a session that never settles is
  forgotten (left to the host) after `DELETE_MAX_DEFER_MS` rather than deleted
  mid-stream.
- `shutdown()` deletes only idle, settled sessions and leaves the rest to the host.

Supporting: `session/activity.ts` now records host activity from
`message.updated` and `message.part.updated` (not from our own status polls);
`event-handler.ts` (manager) notifies the parent with an ERROR notice when a
task dies with its session, and `task-cleaner.ts` does the same for timeouts, so
the parent re-delegates instead of idling; `cancelTask` aborts the run and
releases rather than force-deleting. The `session.deleted` handler now `forget`s
the pool entry instead of issuing a second (failing) delete.

### Issue #40 — every model measured against a hardcoded 200k window
`ContextLimitResolver` resolves the window as override → model metadata → legacy
default. Metadata comes from the `chat.params` hook (`model.limit.context`,
fired before every call) and falls back to `provider.list()`. The
`message.updated` path passes `providerID`/`modelID` and counts tokens with the
same formula as upstream `session/overflow.ts` (cached tokens included, no
reasoning double-count). `resource-control` prefers the host's real usage over
its character estimate. New `contextMaxTokens` option, JSON schema, README.

### Issue #39 — model loops echoing DCP's reminder instead of acting
The circuit breaker gained output-repetition detection: three consecutive
completed assistant turns with identical text and no tool call open the circuit
with a long (10-min) reset. `assistant-done-handler` feeds it; `todo-continuation`
skips re-prompting an open circuit and toasts the user; a real (non-synthetic)
user message clears it. This is a plugin-side mitigation — the `compress` tool
and reminder belong to the DCP plugin — that stops our continuation loops from
re-driving a stuck model.

## 2. Verification (evidence)

- `npm run build` clean; `tsc --noEmit` exit 0.
- `vitest run`: 115 files, 1046 tests pass (was 1008; +38 across five new/updated suites).
- Live end-to-end on OpenCode 1.18.26 with a local mock OpenAI-compatible
  provider advertising a 1M context and the plugin loaded from
  `C:/workspace/opencode-orchestrator`:
  - Commander → background worker delegation ran a recursive stress load of 85
    LLM calls with dozens of session create/delete cycles plus a mid-run abort
    and server teardown. `grep -ic "foreign key|constraint failed|SQLiteError"`
    over the full server log: **0**.
  - Assistant turns reported 150,000 tokens against the 1M model and **no**
    context-window toast fired. Under the old 200k hardcode that is 75% and would
    have shown the "info" alert.
  - The stagnation guard fired 7 "⏸️ Continuation paused" toasts when the mock
    repeated identical no-tool text, instead of re-prompting the loop.

## 3. Scope left out

- DCP's own `dcp_compress` tool-call formation (issue #39's literal symptom)
  lives in the DCP plugin and a weak free model's tool-calling; not ours to fix.
  The guard removes our contribution (loop re-driving) and surfaces the stall.
- `resource-control`'s character-count token estimate remains as the fallback
  before the first real usage report arrives; it is now only a fallback.

## 3a. Adversarial review round (high effort) and fixes

A high-effort multi-angle review found 10 issues, several of them real
regressions in the first cut. Fixed at root cause, each pinned by a test:

1. **cancelTask double-release (HIGH).** `cancelTask` released the session and
   also scheduled a cleanup that releases it again; the second release could
   compact a session another task had since acquired. Removed the direct
   release — `scheduleCleanup` is now the single releaser. Verified no path both
   releases directly and schedules a releasing-cleanup (class closed).
2. **Age-retired session reused uncompacted (HIGH).** The retire path skipped
   compaction but left the session `healthy`, so `acquire` could reuse it within
   the settle window and hand the prior task's transcript on. It is now marked
   `degraded` before release so `acquire` skips it.
3. **Tool repetition wrongly paused continuation (MED-HIGH).** The continuation
   guard tripped on the pre-existing tool-repetition signal (three same-named
   tool calls). Split out `tripOutputCircuit`/`isOutputCircuitOpen` so only
   repeated *output* pauses continuation; ordinary `read,read,read` does not.
4. **Empty turns opened the output circuit (MED).** Aborted/rate-limited turns
   read as `""`; three looked identical. Empty turns are no longer recorded.
5. **Provider lookup on the completion hot path (MED).** `checkContextUsage` was
   awaited before completion handling and could block on an untimed
   `provider.list()`. It now runs fire-and-forget, and the listing fetch has a
   5s timeout.
6. **Timeout path deleted the task immediately (MED).** A timed-out task was
   deleted the moment the parent was told, so `get_task_result` returned null.
   It now mirrors the poller: mark TIMEOUT, notify, then `scheduleCleanup`
   (readable until the delayed deletion).
10. **Circuit history held full text (efficiency).** `idleTurnHistory` stored
   whole turns; it now stores a length+djb2 digest (equality is all that's used).

Documented and deliberately deferred (not bugs I introduced, or a tradeoff):

- **#7 cascade toasts (PLAUSIBLE).** When a user deletes a whole mission, each
  child's `session.deleted` still notifies the (now gone) parent — the prompt is
  caught harmlessly; the cost is transient toasts during an intentional
  teardown. OpenCode removes children before the parent, so cheaply detecting
  "the tree is going away" at child-delete time isn't possible without a
  per-event server call. Left as-is over adding that cost.
- **#8 shutdown orphaning (PLAUSIBLE, low).** Shutdown intentionally leaves
  in-use/busy sessions to the host (deleting them is exactly the #41 FK bug);
  the server discards pooled child sessions when the parent/server goes away.
- **#9 terminal-path unification (altitude).** Five terminal paths (idle,
  deleted, timeout, cancel, error) still diverge. A single `finishTask(task,
  outcome)` helper is the right consolidation and is recorded as a follow-up;
  doing it hastily here would risk new regressions, so it is left as its own
  reviewable change.

## 4. Confidence: 93/100

Root causes fixed at the lifecycle/data layer, pinned by unit tests, and
confirmed on a live host with zero FK errors. Deductions: the live provider was
a mock (no real 1M-model server was available to auth against), and the DCP
interaction was reasoned from source rather than run with DCP co-installed.
