# Minimal plugin implementation checkpoint

Date: 2026-09-14
Status: Current reduction checkpoint; ADR-0021 remains in progress

## Intent and delivered scope

Keep lightweight mission continuity inside OpenCode. Classify questions, reviews, planning, and implementation before choosing work. Commander can implement and verify directly; Planner, Worker, and Reviewer are optional presets. Planning precedes dependent implementation. README describes this decision flow instead of a fixed fanout.

| Change | Reason and retained boundary |
| --- | --- |
| Remove 57 old prompt fragments/barrels and the profile registry | Four compact presets share discipline and the existing mission contract; no mandatory role sequence. |
| Remove prompt-only `call_agent`, its UI hook, and automatic Worker-to-Reviewer launch | Keep actual delegation through the existing bounded runtime until native lifecycle parity is proven. |
| Remove custom web fetch/search/cache/code-search and document cache | OpenCode owns native web tools; websearch is conditional. Cache/code-search APIs are retired, not promised equivalent replacements. Existing files remain. |
| Remove nested extension loader | OpenCode owns plugin discovery. Regression tests prove initialization does not import user extension files. README documents migration. |
| Simplify hook registry | Preserve explicit callback order, block/intercept and error handling; remove metadata, dependency sorting, and retries. |
| Restrict cleanup to owned task archives | Remove host dependency deletion, global file pruning, history rotation, and no-op TODO history producers. Preserve host lockfiles, dependencies, extensions, and historical data. |
| Remove empty TODO watcher/broadcast and duplicate Commander injection | Startup does not manufacture a TODO; native/default agents and user configuration stay under host ownership. |
| Fix actual hook plumbing | Modified arguments, including an empty replacement, reach the native pre-tool call. Compaction completion is recorded from `session.compacted`, not its preparation hook. |
| Align dynamic mission instructions | Parent `status: completed`, leaf `[x]`, optional checklist, and question-permission guidance match retained consumers. |
| Remove duplicate continuation and idle worker loops | One mission idle owner; ordinary sessions do not auto-resume file TODOs. Admission controls real launches and resumes. |
| Unify delegated result authority | Remove the foreground tool's duplicate SDK polling; current-run manager completion is required before DONE. Bound result waiting and preserve errors. |
| Repair lifecycle boundaries | Confirm running abort before releasing capacity; preserve failed notices, resumed runs, and process handles until their operations are confirmed. |
| Restore architecture diagrams | Mermaid shows intent selection, optional presets, dependent planning, and the actual mission continuation boundary within the existing document sections. |

The preceding mission-note helper extraction remains: projections and episode writers share parsing/atomic replacement without a circular writer dependency. Generated memory, the general toolbelt outside web, Rust utilities, and the bounded task runtime still exist.

Rollback restores individual code slices from Git. No migration deletes user data. Removed public tool and extension contracts require a compatibility release.

## Public compatibility evidence

Use the classic [plugin documentation](https://opencode.ai/docs/plugins/), [SDK](https://opencode.ai/docs/sdk/), [agents](https://opencode.ai/docs/agents/), and [tools](https://opencode.ai/docs/tools/), consulted 2026-09-14. Sibling source and preview documentation do not establish released support.

Executed combination: OpenCode **1.18.29**, reported by the executable, with SDK/plugin **1.17.18**. This proves one tested combination, not all host versions or platforms. Native background delegation has no verified public delivery contract and was not adopted.

## Verification

- Node 24 wrapper: build and `tsc --noEmit` passed.
- Full regression: 115 files / 1,088 tests passed. Coverage: statements 89.63%, branches 79.78%, functions 92.55%, lines 91.76%; thresholds unchanged.
- Built-plugin live QA: 14 checks passed using a loopback fixture provider and isolated temporary host storage.
- Rust through `scripts/dbuild.ps1`: 57 workspace tests, formatting check, and strict Clippy passed. Actual Windows background shell/child/grandchild termination passed in the TypeScript suite.
- Package dry run: 218 entries; plugin entry/declarations and install/uninstall bundles present. No removed tool declarations, tests, coverage, local QA state, or credentials found in the manifest. Bundled release binaries remain unchanged; this dry run is not a release build.
- Test-first failures were observed for removed tool/extension ownership, cleanup preservation, pre-tool argument replacement, mission prompt contract, and restored question-permission guidance. Intentional prompt snapshots were synchronized.
- Independent review findings about argument delivery and completion instructions were fixed and reviewed again; no remaining introduced correctness issue was found in that reviewed boundary.

Live QA covers host storage isolation, session create/status/messages/children, context-only `noReply`, provider response, native foreground task and same-child resume, native webfetch, actual plugin delegation completion/resume, native `/task` activation and `/stop`, in-flight abort, completed/error-free compaction, native session restart persistence, and built-plugin hooks. These deterministic fixtures test plumbing, not model judgment or prompt quality. Native session persistence does not imply custom task-state restoration.

| Audited connection | Result |
| --- | --- |
| Config/command/chat to mission | Preserve native defaults and user command overrides; expanded native `/task` reaches mission activation. Foreign active roots cannot overwrite the project record. |
| Events/status/TODO to continuation | Unknown status and unreadable TODO fail closed; pending/running work blocks finish; abort and stale countdowns win after awaited reads. Receipt follows successful state clear. |
| Admission/launch/resume/cancel | One slot owner; queued cancellation does not release an unowned slot; failed host abort retains running state and capacity. |
| Poll/result/foreground wait | Current-run completed assistant evidence is required; old/error/tool-call output cannot establish success; interrupted or timed-out waiting is not task cancellation. |
| Notification/deferred prompt | Acknowledge only accepted snapshots; failed sends persist; status-await clear/replacement cannot dispatch stale work. |
| Cleanup/archive | Project-relative owned archive path; timers and archive I/O cannot remove a resumed/replaced run. |
| RPC/process/AST/LSP | No automatic transport replay; pipe backpressure and shutdown settle correctly; command deadlines include inherited pipes/stdin; command errors are not empty successful results. |

Run `scripts/qa-native-host.mjs` through the Node 24 wrapper with `OCO_QA_EXECUTABLE` and `OCO_QA_PLUGIN` pointing to the executable and built plugin. The ignored report is `.opencode/qa/native-host.json`. Temporary home/XDG/project paths and processes belong to the runner; inherited provider credentials are excluded. Compaction checks require the completed event for the actual fixture session.

## Reduction and remaining work

Static custom tools: **30 to 25**. Production source has **more than 7,900 fewer physical lines** against baseline `572c7be`, including the preceding helper extraction. Count tracked additions/deletions with `git diff --numstat -- src`, then include new untracked source files. This excludes tests, QA, docs, generated output, and dependencies. Runtime dependencies are unchanged. CleanupScheduler now owns one interval; duplicate TODO countdown machinery and producerless worker loops are removed. No speed or token-saving claim is made.

ADR-0021's one-tool/per-root-record target is unfinished. Remaining tool families need replacement scenarios. Current mission storage supports one active root per project, not concurrent root records. Pause/abort latches and delegated task state do not durably restore across restart; oversized brief migration is not implemented. Native background-runtime deletion requires a public lifecycle/delivery contract. Singleton hot reload/multi-project reuse and all-platform process behavior are not established by this checkpoint; escaped descendants lie outside owned-process-group guarantees.

This checkpoint contains no version bump or publication. Rust source was fixed and container-tested; bundled distribution binaries were not replaced. Commit and push on `main` are explicitly requested after final verification. Current implementation, proposed target, and published version are distinguished in README and ADR-0021.
