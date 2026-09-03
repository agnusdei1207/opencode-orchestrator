# ADR-0006: Official Alignment and Release Hardening

Date: 2026-06-11 10:25 KST
Status: Accepted
Source: `docs/histories/2026/06/11/PLAN_OfficialOpenCodeAlignmentAndReleaseHardening_2026-06-11.md` (removed 2026-09-03; history in git)

## Context

The plugin needed a cleaner patch-release baseline: easier to operate, easier
to verify, harder to misconfigure.

## Decision

Five workstreams:

- A: Contract and compatibility audit.
- B: Documentation consolidation.
- C: Release workflow simplification.
- D: Test hardening.
- E: Repository support routing.
- Guiding rule: keep Builder-inspired ideas only where they strengthen the
  plugin without exceeding the plugin boundary.

## Consequences

- Direct predecessor of the 06-19 full audit (ADR-0007), which found and
  executed the concrete structural subset.
