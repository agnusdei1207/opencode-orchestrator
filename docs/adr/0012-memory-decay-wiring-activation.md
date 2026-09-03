# ADR-0012: Memory Decay Wiring Activation

Date: 2026-06-24 23:50 KST
Status: Implemented
Source: `docs/histories/2026/06/21/PLAN_MemoryDecayWiringActivation_2026-06-21.md` (removed 2026-09-03; history in git)

## Context

The Ebbinghaus scoring engine, lifecycle engine, and hybrid search were
mathematically correct and unit-tested — but dormant. Generated notes were
unconditionally pinned (`keep: true`), the injection path never passed a role,
generated notes wrote an invalid `memory_kind`, and the maintenance entry
point was never invoked.

## Decision

Fix the wiring, not the math (`memory-scoring.ts` stays the single source of
truth): valid decay profiles on generated notes, importance-based pinning,
role threading through injection, opt-in (env-gated, default OFF) maintenance
entry point, observable reinforcement. TDD throughout; no new runtime
dependencies.

## Consequences

- Decay and role-weighted retrieval engage on generated data.
- Constraint preserved: Cargo workspace version stays in lockstep with npm
  version (asserted by `package-metadata.test.ts`).
