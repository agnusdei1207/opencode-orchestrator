# ADR-0020: Risk-Graded Test Coverage Policy

Date: 2026-09-04 07:39 KST
Status: Accepted
Source: owner question "does the test code correspond 100%?" (2026-09-04) after a
measured coverage pass; policy adopted from the dev-methodology test-strategy
canon (`test-strategy.md`, sections "무엇을 테스트하는가" and "커버리지"), which
this repository applies.

## Context

- Coverage measured 2026-09-04 (`@vitest/coverage-v8`, scope limited by
  `vitest.config.ts` to `src/core/**`): lines 80.55% (4151/5153), branches
  70.17% (2085/2971), functions 80.62% (899/1115), statements 78.72%
  (4410/5602).
- No coverage thresholds are enforced anywhere; no prior ADR records a
  coverage policy; the Rust side has no coverage instrumentation at all.
- The lowest-covered files are exactly the failure/recovery paths the
  methodology requires tested on par with happy paths: `sync/sync-service.ts`
  39.7% lines, `progress/process-notifier.ts` 47.4%, `pool/object-pool.ts`
  48.5%, `recovery/version-recovery.ts` 50.6%.
- The methodology test-strategy canon states: coverage is a **signal, not a
  target**; 100% coverage of trivial code is not quality; core and edge paths
  are what is watched; manufacturing tests to hit coverage numbers is
  forbidden. It also states failure paths must be tested as much as happy
  paths, and that trivial getters, the framework itself, and mock-asserts-mock
  tests are explicitly not tested.

## Decision

- Adopt the canon as repository policy: **coverage is a signal, not a goal.**
  A global 100% mandate is explicitly rejected; assertion-free filler tests
  written to move the number are forbidden (meta-verification canon).
- **Failure/recovery path parity is mandatory**, not optional: every
  failure/recovery/state-transition path in `src/` must be tested at least on
  par with its happy path. The four files listed above are the recorded gap
  list, in that priority order.
- **Measurement scope expands from `src/core/**` to `src/**`** so the signal
  is actually observable; `scripts/` (build tooling) stays out of scope.
- **Thresholds enter `vitest.config.ts` as a regression ratchet, not a
  quality target**: set slightly below the measured baseline after scope
  expansion, then ratcheted upward as gap-list entries close. Exact values
  live in `vitest.config.ts` at implementation time, not in this ADR.
- Rust coverage stays uninstrumented for now; correctness anchors on
  `cargo test` via docker (`docker:test`). Revisit only if a Rust defect
  escapes into a release.
- The prior untracked debt entries ("Binary not found" pool-path test,
  release.yml bin/ pruning) fold into this policy's gap work rather than
  standing alone.

## Consequences

- The current tree does **not** satisfy failure/happy parity — the gap is
  recorded work with an explicit priority order, not an accepted state.
- 100% global coverage remains a non-goal; what must reach ~full coverage is
  the failure/recovery/state-transition subset of each module.
- Implementation steps, in order: (1) expand `coverage.include` to `src/**`
  and record the true baseline, (2) add ratchet thresholds, (3) close the
  four gap-list files with behavior-level tests (transitions, cardinality,
  exhaustion — not line-touching), (4) re-measure and ratchet.
- Promoted to Implemented: (pending — record here with evidence when scope
  expansion, thresholds, and gap-list closure are verified in the tree.)
