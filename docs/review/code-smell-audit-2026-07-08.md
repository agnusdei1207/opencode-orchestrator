# Code Smell Audit - 2026-07-08

Scope: `src`, `scripts`, and focused unit tests.

This audit records 100 concrete code smells found during the July 8, 2026 refactoring pass. Items marked `fixed` were addressed in this pass. Items marked `queued` remain as follow-up refactoring candidates.

## Findings

1. `fixed` `src/tools/rust-pool.ts` - `RustToolPool` accepted `maxSize <= 0`, allowing callers to wait forever.
2. `fixed` `src/tools/rust-pool.ts` - `waitForAvailable` polled without any timeout.
3. `fixed` `src/tools/rust-pool.ts` - `waitForAvailable` did not observe pool shutdown while waiting.
4. `fixed` `src/tools/rust-pool.ts` - stdout response parsing kept scanning accumulated buffered lines instead of consuming complete frames.
5. `fixed` `src/tools/rust-pool.ts` - malformed JSON-RPC lines were swallowed without diagnostics.
6. `fixed` `src/tools/rust-pool.ts` - `pendingResolve` was dead state on pooled processes.
7. `fixed` `src/tools/rust-pool.ts` - cleanup timer assumed `unref` always exists.
8. `fixed` `src/tools/rust-pool.ts` - process kill failures were silently ignored.
9. `queued` `src/tools/rust-pool.ts` - the global singleton and reset lock make test isolation and multi-workspace use harder.
10. `fixed` `src/tools/rust-pool.ts` - JSON-RPC request construction now goes through a small protocol helper.
11. `fixed` `src/core/loop/verification.ts` - global `g` regexes were reused with `.test()`, risking stateful false negatives.
12. `fixed` `src/core/loop/verification.ts` - unreadable `sync-issues.md` was treated as clean.
13. `fixed` `src/core/loop/verification.ts` - unreadable checklist files now fail closed with an explicit read error.
14. `fixed` `src/core/loop/verification.ts` - TODO verification now counts checkbox and hierarchy status items.
15. `fixed` `src/core/loop/verification.ts` - checklist verification now still fails when existing TODO items are incomplete.
16. `queued` `src/core/loop/verification.ts` - verification logic and LLM failure-prompt rendering share one module.
17. `queued` `src/core/loop/verification.ts` - checklist category detection is keyword-based and English-only.
18. `queued` `src/core/loop/verification.ts` - runtime status strings embed presentation symbols directly in core logic.
19. `fixed` `src/core/loop/verification.ts` - excessive vertical whitespace was reduced around parser and prompt helpers.
20. `fixed` `src/core/loop/verification.ts` - sync issue dirty checks and counts now share one line classifier.
21. `fixed` `src/core/agents/manager/task-poller.ts` - assistant `tool_use` parts were not counted as valid output.
22. `fixed` `src/core/agents/manager/task-poller.ts` - progress tracking errors were silently ignored.
23. `fixed` `src/core/agents/manager/task-poller.ts` - scheduled poll rejection could stop future polling.
24. `fixed` `src/core/agents/manager/task-poller.ts` - utilization sampling used lowercase agent names while built-in agent constants are capitalized.
25. `queued` `src/core/agents/manager/task-poller.ts` - poll errors per task are logged but do not transition or quarantine stuck tasks.
26. `fixed` `src/core/agents/manager/task-poller.ts` - message cache entries are not explicitly purged when tasks finish.
27. `queued` `src/core/agents/manager/task-poller.ts` - `session.status()` failures only log and leave all tasks unchanged.
28. `queued` `src/core/agents/manager/task-poller.ts` - `onTaskComplete` is fire-and-forget, so review-launch failures cannot affect task completion.
29. `fixed` `src/core/agents/manager/task-poller.ts` - stability detection now fetches messages when `messageCount` is missing.
30. `fixed` `src/core/agents/manager/task-poller.ts` - unused `lastChecked` cache state was removed.
31. `fixed` `src/tools/parallel/delegate-task.ts` - sync polling passed stale elapsed time after sleeping.
32. `fixed` `src/tools/parallel/delegate-task.ts` - idle polling fetched session messages twice per stable poll.
33. `fixed` `src/tools/parallel/delegate-task.ts` - delegate args relied on direct casts instead of runtime checks.
34. `fixed` `src/tools/parallel/delegate-task.ts` - launch results were force-cast instead of normalized by shape.
35. `fixed` `src/tools/parallel/delegate-task.ts` - sync polling delays now respect the tool abort signal.
36. `fixed` `src/tools/parallel/delegate-task.ts` - parent-depth lookup now uses the manager session index instead of scanning all tasks.
37. `queued` `src/tools/parallel/delegate-task.ts` - tool metadata, validation, launch, resume, polling, and result extraction live in one large file.
38. `fixed` `src/tools/parallel/delegate-task.ts` - resume flow now follows the manager's exception-based failure contract.
39. `fixed` `src/tools/parallel/delegate-task.ts` - delegate tool metadata now lives outside the runtime execution module.
40. `queued` `src/tools/parallel/delegate-task.ts` - repeated poll failures only extend until timeout without escalating.
41. `fixed` `src/core/loop/todo-continuation.ts` - todo API records were accepted with only `id` and `status` property presence.
42. `fixed` `src/core/loop/todo-continuation.ts` - continuation prompt injection was fire-and-forget.
43. `fixed` `src/core/loop/todo-continuation.ts` - idle-state mutation happened before skip checks.
44. `fixed` `src/core/loop/todo-continuation.ts` - countdown refetch failures omitted the error object.
45. `fixed` `src/core/loop/todo-continuation.ts` - abort detection cast arbitrary errors to `{ name?: string }`.
46. `fixed` `src/core/loop/todo-continuation.ts` - malformed todo dates could become invalid `Date` values.
47. `queued` `src/core/loop/todo-continuation.ts` - session continuation state is module-global mutable state.
48. `queued` `src/core/loop/todo-continuation.ts` - prune timer starts as a load-time side effect.
49. `queued` `src/core/loop/todo-continuation.ts` - toast rendering is coupled directly into continuation orchestration.
50. `queued` `src/core/loop/todo-continuation.ts` - background-task lookup failure returns `false`, allowing continuation to proceed.
51. `fixed` `src/core/agents/session-pool.ts` - session pool config accepted non-positive limits and intervals.
52. `fixed` `src/core/agents/session-pool.ts` - `idle` was computed during release and never used.
53. `fixed` `src/core/agents/session-pool.ts` - shutdown session deletion failures were ignored.
54. `fixed` `src/core/agents/session-pool.ts` - server-side session delete failures were ignored.
55. `fixed` `src/core/agents/session-pool.ts` - health-check cleanup failures were ignored.
56. `queued` `src/core/agents/session-pool.ts` - singleton state makes isolated tests and multiple clients harder.
57. `queued` `src/core/agents/session-pool.ts` - constructor starts a health-check timer as a side effect.
58. `queued` `src/core/agents/session-pool.ts` - lack of compact API invalidates every released session, defeating pooling.
59. `fixed` `src/core/agents/session-pool.ts` - sessions are now removed from local maps only after remote delete succeeds.
60. `fixed` `src/core/agents/session-pool.ts` - pool-size enforcement now finds the oldest available session in one pass.
61. `fixed` `src/core/agents/manager.ts` - session-store cleanup failures were swallowed.
62. `fixed` `src/core/agents/manager.ts` - session-pool shutdown failures were swallowed.
63. `fixed` `src/core/agents/manager.ts` - exported cleanup ignored all initialization and cleanup errors.
64. `fixed` `src/core/agents/manager.ts` - `cancelTask` now cancels pending and running tasks.
65. `queued` `src/core/agents/manager.ts` - `getResult` mixes remote fetch, message parsing, and result-cache mutation.
66. `queued` `src/core/agents/manager.ts` - constructor initializes memory, registry, todo manager, session pool, launcher, resumer, poller, cleaner, and event handler.
67. `queued` `src/core/agents/manager.ts` - static singleton hides lifecycle ownership.
68. `fixed` `src/core/agents/manager.ts` - work-stealing worker counts are resolved from defaults plus `ConcurrencyConfig` overrides.
69. `fixed` `src/core/agents/manager.ts` - task-error handling now awaits parent completion notification.
70. `fixed` `src/core/agents/manager.ts` - `formatDuration` remains an export-only utility instead of an instance field.
71. `fixed` `src/core/agents/manager/task-launcher.ts` - task preparation failures are logged before preserving the existing `null` launch result.
72. `fixed` `src/core/agents/manager/task-launcher.ts` - retry sleeps now observe launcher shutdown.
73. `fixed` `src/core/agents/manager/task-launcher.ts` - prompt timeout now aborts the underlying prompt request signal.
74. `fixed` `src/core/agents/manager/task-launcher.ts` - launch depth validation and child-depth assignment now use one helper.
75. `queued` `src/core/agents/manager/task-launcher.ts` - pooled task objects rely on every field being overwritten correctly.
76. `fixed` `src/core/agents/concurrency.ts` - `setLimit` does not reject negative or non-integer limits.
77. `fixed` `src/core/agents/concurrency.ts` - acquisition timeout is hardcoded to 300 seconds.
78. `fixed` `src/core/agents/concurrency.ts` - circuit-breaker thresholds are configurable through `ConcurrencyConfig`.
79. `fixed` `src/core/agents/concurrency.ts` - resource-pressure metrics are exposed and included in low-priority rejection errors.
80. `fixed` `src/core/agents/concurrency-token.ts` - the controller tracks active tokens and releases them during shutdown.
81. `fixed` `src/core/cache/operations.ts` - cache document read and cleanup failures now log the affected cache entry.
82. `fixed` `src/core/cache/utils.ts` - metadata read, parse, and shape failures are logged before empty-cache recovery.
83. `fixed` `src/core/notification/os-notify/platform-resolver.ts` - command lookup failures are logged before returning no command path.
84. `fixed` `src/core/notification/os-notify/notifier.ts` - notification skip branches now log missing commands, WSL skips, and unsupported platforms.
85. `fixed` `src/plugin-handlers/event-handler.ts` - delayed idle continuation now runs through one logging scheduler helper.
86. `fixed` `src/plugin-handlers/system-transform-handler.ts` - background task lookup failures are logged without aborting transform.
87. `fixed` `src/plugin-handlers/session-compacting-handler.ts` - background task lookup failures are logged without aborting compaction.
88. `fixed` `src/core/cleanup/cleanup-scheduler.ts` - scheduled cleanup work is now registered through task descriptors instead of inline timer setup.
89. `fixed` `src/core/cleanup/cleanup-scheduler.ts` - cleanup intervals and retention windows are named constants without stale timing notes.
90. `fixed` `src/core/cleanup/cleanup-scheduler.ts` - timer-driven maintenance now uses async path checks instead of `existsSync`.
91. `fixed` `src/core/todo/todo-manager.ts` - temporary file suffixes now use `randomUUID`.
92. `fixed` `src/core/todo/todo-manager.ts` - change-log failures are logged without failing the committed TODO update.
93. `fixed` `src/core/sync/todo-sync-service.ts` - file-handle close failures are logged during reload cleanup.
94. `fixed` `src/core/orchestrator/session-manager.ts` - session state normalization now verifies the narrowed shape before returning it.
95. `fixed` `src/core/loop/mission-ledger.ts` - ledger JSON lines are cast to events with minimal validation.
96. `fixed` `src/core/loop/mission-loop.ts` - persisted loop state is parsed from JSON without schema validation.
97. `queued` `src/core/knowledge/mission-memory.ts` - memory file IO and parsing are synchronous and concentrated in a large module.
98. `queued` `src/core/knowledge/memory-lifecycle.ts` - lifecycle planning and archive writes are coupled in one class.
99. `queued` `src/core/knowledge/context-provider.ts` - context collection performs synchronous traversal and reads.
100. `queued` `scripts/postinstall.ts` - install script mixes config mutation, logging, backup handling, and process-exit policy.
