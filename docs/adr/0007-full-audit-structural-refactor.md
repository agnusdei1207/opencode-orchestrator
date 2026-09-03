# ADR-0007: Full Audit and Structural Refactor

Date: 2026-06-19 10:05 KST
Status: Implemented
Source: `docs/histories/2026/06/19/PLAN_FullAuditAndStructuralRefactor_2026-06-19.md` (removed 2026-09-03; history in git)
Report: `docs/histories/2026/06/19/REPORT_FullAuditAndStructuralRefactor_2026-06-19.md`

## Context

A healthy core idea was buried under fragmentation (525 TS files, 51% under 20
lines), two competing session-continuation subsystems, and hygiene drift
(committed binaries, npm/Cargo version mismatch, no lint gate).

## Decision

- Flatten fragmentation with identical exported behavior.
- One continuation control plane instead of two.
- Remove verified dead code (e.g. `orchestrator-core::config`, ~532 LOC, consumed by nothing).
- Lock build/version/lint hygiene with drift caught by tests.
- Ship the safe subset first as evidence-backed patch releases.

## Consequences

- Shipped 1.5.2 then 1.5.3 with the safe phases.
- Three audit claims were refuted by direct verification (Rust 2024 edition
  validity; amend-based release flow is intentional and test-locked).
- Established the evidence-first audit norm: summaries are leads, not facts.
