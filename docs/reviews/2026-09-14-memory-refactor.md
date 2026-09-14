# Mission memory boundary review

Date: 2026-09-14

Checkpoint note: notification findings 1 and 2 below describe the earlier memory-only review. Both were subsequently fixed with rejected-send and interleaving regressions in the [minimal-plugin checkpoint](2026-09-14-minimal-plugin.md). The original findings and verification scope are preserved here.

## Intent and scope

Review the retained mission-memory persistence boundary and adjacent task-completion notification handling. Keep this refactor behavior-preserving and consistent with ADR-0019: local working memory remains supported without restoring retired RAG infrastructure. This is a focused TypeScript review, not an exhaustive audit of the plugin, Rust CLI, or live provider integration.

The target is the circular import between `mission-memory.ts` and `mission-episode.ts` and their duplicated note helpers. Extracting the shared persistence boundary makes episode writing independent of projection orchestration. Keeping duplicate implementations was rejected because metadata rules could drift; adding a YAML dependency was rejected because it would change parsing semantics and expand the scope.

## Findings

1. P1, existing, unresolved: `TaskCleaner.deliverToParent()` catches a rejected `client.session.prompt()` and resolves normally. `notifyParentIfAllComplete()` then calls `clearNotifications(parentSessionID)` unconditionally. A failed send therefore loses its queued completion notification. See `src/core/agents/manager/task-cleaner.ts`, especially the delivery call and catch block. Existing tests cover idle delivery, busy-parent queuing, partial progress, and timeout reporting, but not rejected delivery.
2. P2, existing, unresolved: the same parent-wide clear can remove a notification appended while delivery is awaiting session status or a prompt response. `TaskStore.getNotifications()` returns the live array; the message has already been built before this await. A later delivery might have captured the additional notification, but the queue itself provides no batch acknowledgement or serialized delivery guarantee. See `src/core/agents/task-store.ts` and `task-cleaner.ts`. A follow-up should test controlled interleavings and acknowledge only the successfully delivered batch.
3. P2, resolved: `mission-memory.ts` imported the episode writer, which imported the parser from `mission-memory.ts`. Both files also implemented metadata loading, scalar validation, escaping, and temporary-file replacement. `mission-note.ts` now owns those operations with no dependency on either writer.
4. P3, resolved: `docs/SYSTEM_ARCHITECTURE.md` still claimed generated notes were indexed for prompt-time retrieval despite ADR-0019 and the current system transform handler. It also listed stale SDK versions and homepage metadata. These descriptions now match the inspected code and package manifest.

The notification findings are based on source tracing and independent review, not a live transport failure reproduction. They remain separate from this behavior-preserving refactor.

## Compatibility and rollback

Preserve the existing `parseFrontmatter` and `FrontmatterData` exports from `mission-memory.ts` and the knowledge barrel. Preserve filenames, note text, lifecycle fallbacks, counters, error handling, and the `.tmp` replacement strategy. No dependency, configuration, schema, release, or Rust changes are needed.

Characterization tests were run against the original implementation before extraction. They cover CRLF and scalar parsing, incomplete headers, literal escapes, public import compatibility, nested writes and replacement, session-filtered evidence, resync counting, lifecycle preservation, invalid metadata fallbacks, and inactive/cancelled gating.

Rollback consists of restoring the two original writer files and removing the extracted helper and its new compatibility suite; no stored-data migration is required.

## Verification

- Baseline: build succeeded; 119 test files / 1,109 tests passed.
- Characterization before and after extraction: 2 files / 15 tests passed.
- Post-refactor build and `tsc --noEmit`: passed.
- Full coverage run: 120 files / 1,116 tests passed; statements 86.34%, branches 75.23%, functions 90.27%, lines 87.87%. All configured thresholds passed.

Commands used Node 24 through `scripts/nverify.ps1 -HostNode` in the adjacent pentesting workspace, with this repository as the working directory. Vitest used `--maxWorkers=2`. Rust and live-provider checks were not run because this change does not modify those boundaries.
