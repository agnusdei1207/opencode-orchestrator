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
10. `queued` `src/tools/rust-pool.ts` - JSON-RPC request construction is inline instead of centralized behind a small protocol helper.
11. `fixed` `src/core/loop/verification.ts` - global `g` regexes were reused with `.test()`, risking stateful false negatives.
12. `fixed` `src/core/loop/verification.ts` - unreadable `sync-issues.md` was treated as clean.
13. `queued` `src/core/loop/verification.ts` - unreadable checklist files collapse to an empty checklist.
14. `queued` `src/core/loop/verification.ts` - TODO verification only recognizes checkbox markdown, not the status hierarchy used in prompts.
15. `queued` `src/core/loop/verification.ts` - checklist presence suppresses TODO errors while still reporting TODO progress.
16. `queued` `src/core/loop/verification.ts` - verification logic and LLM failure-prompt rendering share one module.
17. `queued` `src/core/loop/verification.ts` - checklist category detection is keyword-based and English-only.
18. `queued` `src/core/loop/verification.ts` - runtime status strings embed presentation symbols directly in core logic.
19. `queued` `src/core/loop/verification.ts` - excessive vertical whitespace makes the module harder to scan.
20. `queued` `src/core/loop/verification.ts` - sync issue counting duplicates issue-pattern logic instead of reusing one classifier.
21. `fixed` `src/core/agents/manager/task-poller.ts` - assistant `tool_use` parts were not counted as valid output.
22. `fixed` `src/core/agents/manager/task-poller.ts` - progress tracking errors were silently ignored.
23. `fixed` `src/core/agents/manager/task-poller.ts` - scheduled poll rejection could stop future polling.
24. `fixed` `src/core/agents/manager/task-poller.ts` - utilization sampling used lowercase agent names while built-in agent constants are capitalized.
25. `queued` `src/core/agents/manager/task-poller.ts` - poll errors per task are logged but do not transition or quarantine stuck tasks.
26. `queued` `src/core/agents/manager/task-poller.ts` - message cache entries are not explicitly purged when tasks finish.
27. `queued` `src/core/agents/manager/task-poller.ts` - `session.status()` failures only log and leave all tasks unchanged.
28. `queued` `src/core/agents/manager/task-poller.ts` - `onTaskComplete` is fire-and-forget, so review-launch failures cannot affect task completion.
29. `queued` `src/core/agents/manager/task-poller.ts` - stability detection treats missing `messageCount` as zero.
30. `queued` `src/core/agents/manager/task-poller.ts` - `lastChecked` is stored in the message cache but never used.
31. `fixed` `src/tools/parallel/delegate-task.ts` - sync polling passed stale elapsed time after sleeping.
32. `fixed` `src/tools/parallel/delegate-task.ts` - idle polling fetched session messages twice per stable poll.
33. `fixed` `src/tools/parallel/delegate-task.ts` - delegate args relied on direct casts instead of runtime checks.
34. `fixed` `src/tools/parallel/delegate-task.ts` - launch results were force-cast instead of normalized by shape.
35. `queued` `src/tools/parallel/delegate-task.ts` - polling delay has no abort signal support.
36. `queued` `src/tools/parallel/delegate-task.ts` - parent-depth lookup scans all tasks for every delegate call.
37. `queued` `src/tools/parallel/delegate-task.ts` - tool metadata, validation, launch, resume, polling, and result extraction live in one large file.
38. `queued` `src/tools/parallel/delegate-task.ts` - resume flow still contains a defensive null branch that disagrees with the manager type.
39. `queued` `src/tools/parallel/delegate-task.ts` - long embedded tool description makes runtime code noisy.
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
59. `queued` `src/core/agents/session-pool.ts` - sessions are removed from local maps before remote delete succeeds.
60. `queued` `src/core/agents/session-pool.ts` - pool-size enforcement sorts available sessions on every release.
61. `fixed` `src/core/agents/manager.ts` - session-store cleanup failures were swallowed.
62. `fixed` `src/core/agents/manager.ts` - session-pool shutdown failures were swallowed.
63. `fixed` `src/core/agents/manager.ts` - exported cleanup ignored all initialization and cleanup errors.
64. `queued` `src/core/agents/manager.ts` - `cancelTask` cannot cancel pending tasks.
65. `queued` `src/core/agents/manager.ts` - `getResult` mixes remote fetch, message parsing, and result-cache mutation.
66. `queued` `src/core/agents/manager.ts` - constructor initializes memory, registry, todo manager, session pool, launcher, resumer, poller, cleaner, and event handler.
67. `queued` `src/core/agents/manager.ts` - static singleton hides lifecycle ownership.
68. `queued` `src/core/agents/manager.ts` - built-in work-stealing limits are hardcoded in the constructor.
69. `queued` `src/core/agents/manager.ts` - task-error handling calls parent completion notification without awaiting it.
70. `queued` `src/core/agents/manager.ts` - `formatDuration` is exposed as an instance field instead of a simple export-only utility.
71. `queued` `src/core/agents/manager/task-launcher.ts` - task preparation maps failures to `null`, hiding why a launch failed.
72. `queued` `src/core/agents/manager/task-launcher.ts` - retry sleeps cannot be aborted during shutdown.
73. `queued` `src/core/agents/manager/task-launcher.ts` - prompt timeout does not cancel the underlying prompt request.
74. `queued` `src/core/agents/manager/task-launcher.ts` - launch depth checks and stored depth increments are split across different concepts.
75. `queued` `src/core/agents/manager/task-launcher.ts` - pooled task objects rely on every field being overwritten correctly.
76. `queued` `src/core/agents/concurrency.ts` - `setLimit` does not reject negative or non-integer limits.
77. `queued` `src/core/agents/concurrency.ts` - acquisition timeout is hardcoded to 300 seconds.
78. `queued` `src/core/agents/concurrency.ts` - circuit-breaker thresholds are embedded constants instead of configuration.
79. `queued` `src/core/agents/concurrency.ts` - resource-pressure behavior rejects only low priority tasks without exposing metrics.
80. `queued` `src/core/agents/concurrency-token.ts` - auto-release timer behavior is separated from controller shutdown ownership.
81. `queued` `src/core/cache/operations.ts` - several cache read/write failures collapse to defaults.
82. `queued` `src/core/cache/utils.ts` - metadata JSON parse failure returns empty metadata without surfacing corruption.
83. `queued` `src/core/notification/os-notify/platform-resolver.ts` - platform detection errors are silently ignored.
84. `queued` `src/core/notification/os-notify/notifier.ts` - notification send failures are swallowed in some branches.
85. `queued` `src/plugin-handlers/event-handler.ts` - delayed event handling uses raw `setTimeout` and scattered catch blocks.
86. `queued` `src/plugin-handlers/system-transform-handler.ts` - transform failure handling is silent in at least one path.
87. `queued` `src/plugin-handlers/session-compacting-handler.ts` - compacting hook catch blocks hide parse or state errors.
88. `queued` `src/core/cleanup/cleanup-scheduler.ts` - scheduler mixes history rotation, session cleanup, package cleanup, and reporting.
89. `queued` `src/core/cleanup/cleanup-scheduler.ts` - cleanup scheduler has a TODO for history rotation timing.
90. `queued` `src/core/cleanup/cleanup-scheduler.ts` - scheduler performs synchronous filesystem work in timer-driven maintenance.
91. `queued` `src/core/todo/todo-manager.ts` - temporary file suffix uses `Math.random`.
92. `queued` `src/core/todo/todo-manager.ts` - change-log failures are swallowed.
93. `queued` `src/core/sync/todo-sync-service.ts` - file-handle close failures are ignored.
94. `queued` `src/core/orchestrator/session-manager.ts` - session state is returned through `as unknown as ManagedSessionState`.
95. `queued` `src/core/loop/mission-ledger.ts` - ledger JSON lines are cast to events with minimal validation.
96. `queued` `src/core/loop/mission-loop.ts` - persisted loop state is parsed from JSON without schema validation.
97. `queued` `src/core/knowledge/mission-memory.ts` - memory file IO and parsing are synchronous and concentrated in a large module.
98. `queued` `src/core/knowledge/memory-lifecycle.ts` - lifecycle planning and archive writes are coupled in one class.
99. `queued` `src/core/knowledge/context-provider.ts` - context collection performs synchronous traversal and reads.
100. `queued` `scripts/postinstall.ts` - install script mixes config mutation, logging, backup handling, and process-exit policy.
