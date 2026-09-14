# Agent Memory - OCO Session

Last updated: 2026-09-14 19:01 KST

## Current task

Finish the approved minimal-plugin reduction and plumbing audit on main; commit and push are explicitly authorized. Preserve existing Markdown structure and restore Mermaid diagrams showing intent-driven, optional agent use. ADR-0021 remains a staged target, not a claim that every future deletion is implemented.

## Completed checkpoint

- Preserved mission-note helper extraction and characterization tests.
- Removed 57 prompt fragments/barrels, profile registry, prompt-only call_agent, automatic Worker-to-Reviewer launch, custom web/cache tools, nested plugin loading, empty TODO synchronization, producerless work stealing, and generic non-mission TODO continuation.
- Retained four compact optional presets with intent-first working discipline. Preserved host defaults, permissions, models, agent fields, command overrides, and existing user files.
- Wired native expanded /task into mission activation. One active root owns the project record; foreign starts cannot overwrite it. Idle owns continuation; unknown status, unreadable TODO, pending work, abort, and stale countdowns block completion or injection.
- Unified foreground results under manager completion; current-run identity and bounded waiting protect results. Launch/resume share admission; cancellation requires confirmed host abort. Failed notifications retain only their undelivered batch; stale deferred prompts cannot send after clear/replacement.
- Cleanup and archive I/O preserve resumed/replaced runs; archives use the plugin project directory. Removed transport replay. Background kill and Rust shutdown retain failed termination ownership; pipe handling and Rust AST/LSP errors have explicit regressions.
- Added repository-owned bounded Docker Rust verifier and isolated released-host QA. Real native command, delegation/resume, abort, compaction, and session persistence pass.
- Updated existing document sections and added Mermaid architecture diagrams. Mandatory license notices remain.

## Verification

Node 24 through C:/workspace/pentesting/scripts/nverify.ps1 -HostNode. Build and tsc --noEmit passed. Final full regression: 115 files / 1,088 tests; coverage statements 89.63%, branches 79.78%, functions 92.55%, lines 91.76%; thresholds unchanged. Built-plugin host QA: 14/14 passed on executable-reported 1.18.29 with SDK/plugin 1.17.18. Local ignored report: .opencode/qa/native-host.json.

Rust via scripts/dbuild.ps1: 57 workspace tests, fmt --check, and strict Clippy passed. Real Windows background shell/child/grandchild termination passed. Package dry-run manifest: 218 entries, runtime/install bundles present, no removed tool declarations or local QA/credential/test files. Bundled release binaries are unchanged. Local Markdown links and removed-runtime-reference checks passed.

Production src/ has more than 7,900 fewer physical lines against baseline 572c7be, including the prior helper extraction. Static custom tools: 30 to 25. No runtime dependency added; one-tool target remains incomplete.

## Key decisions

Use public classic plugin/SDK docs, deployed types, and executed released host. Native background has no verified public delivery contract; retain existing bounded execution until lifecycle parity. Prefer deleting duplicate owners and fixing local failure boundaries to adding a runtime, journal, outbox, compactor, or provider layer. Preserve user mission data and separate shell-listener ownership.

## Next exact step

After final staged-content audit, commit this checkpoint on main and push origin main as requested; verify clean status and remote equality. For future reduction, reopen ADR-0021's unchecked native replacement and durable mission-state gates before changing contracts.

## Incomplete items and risks

- Per-root bounded mission records, explicit finish tool, generated-memory retirement, general-toolbelt/Rust removal, and native execution replacement remain future ADR stages.
- Current storage supports one active mission per project. Pause/abort latches and delegated task state are process-local; archives do not restore tasks. Native session persistence QA is not mission restart proof.
- Native background delivery, model judgment, singleton hot reload/multi-project reuse, and all-platform behavior are not established. Process-tree guarantees exclude escaped descendants.
- Public tool removals require a compatibility release. This checkpoint does not bump/publish npm, replace distribution binaries, publish an application image, or delete user data; commit/push are authorized.

## Rejected alternatives

Wholesale runtime import, permanent flags for retired features, new state services, and using unreleased sibling source as release evidence.

## Restore order

1. docs/adr/0021-minimal-mission-plugin.md
2. docs/reviews/2026-09-14-minimal-plugin.md
3. src/tools/registry.ts
4. scripts/qa-native-host.mjs
5. src/core/loop/mission-loop-handler.ts
6. src/core/agents/manager.ts
