# ADR-0010: Bi-temporal Metadata in Search Ranking

Date: 2026-06-24 23:50 KST
Status: Implemented
Source: `docs/histories/2026/06/19/PLAN_BitemporalMemoryImplementation_2026-06-19-1555.md` (removed 2026-09-03; history in git)

## Context

Memory notes needed time-awareness (when an event happened vs. when the system
learned it) so stale or expired memory ranks lower — without breaking ranking
for notes that lack the metadata.

## Decision

- Parse bi-temporal frontmatter (`event_time`, `ingestion_time`, plus memory
  kind/layer, importance, confidence, decay, validity window, supersession).
- Demote stale/expired memory in ranking only when metadata is present;
  missing metadata returns a neutral multiplier (`1.0`).
- No runtime disk writes on the read path (persistent `recordAccess()` deferred
  pending a dry-run/rollback design).

## Consequences

- All completion criteria checked; 689 unit tests passed with build and
  typecheck clean.
- `memory-scoring.ts` remains the single source of truth for decay math.
