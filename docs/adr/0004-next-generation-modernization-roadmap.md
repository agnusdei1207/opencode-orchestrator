# ADR-0004: Next-Generation Modernization Roadmap

Date: 2026-06-11 00:01 KST
Status: Partially implemented
Source: `docs/histories/2026/06/10/PLAN_NextGenerationOpenCodeOrchestratorModernization_2026-06-10.md` (removed 2026-09-03; history in git)

## Context

The plugin worked but carried release blockers, cross-platform fragility, and
prompt/file-only completion authority. Modernization had to preserve
user-facing behavior while moving to a release-oriented architecture.

## Decision

Six-target roadmap, planning output only (no code in the session itself):

1. Align plugin implementation with the current official plugin contract.
2. Remove release blockers and cross-platform fragility.
3. Replace prompt/file-only completion authority with structured runtime evidence.
4. Adopt general-agent orchestration patterns from builder-private without its
   domain-specific pentesting behavior.
5. Reduce legacy complexity and dead code after replacement paths verify.
6. Harden installation, binary selection, release packaging, and rollback
   across Linux, macOS, Windows, WSL, and multiple CPU architectures.

## Consequences

- Served as the control document for subsequent patch releases.
- Targets 3 and 5 were executed via ADR-0007; target 6 is continuous
  (see ADR-0017 for the Windows install-path correction).
- Status set to Partially implemented 2026-09-03: targets 1 and 3 verified
  (`plugin-api-conformance.test.ts`, `evidence.ts`), target 6 continuous by
  design; targets 2 and 4 remain roadmap-level.
