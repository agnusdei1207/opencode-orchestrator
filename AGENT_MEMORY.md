# Agent Memory - OCO Session

Last updated: 2026-09-04 07:52 KST

## Current Task

Coverage policy execution (ADR-0020) is in flight. A parallel session
implemented step 1 (coverage scope expansion) plus 16 new test suites; that
work is UNCOMMITTED in the working tree and belongs to that session. This
session re-verified it and updated the ledger.

## Last Completed Step

- ADR-0018 QA evidence committed (d9a393a) and ADR-0020 adopted/committed
  (1532fca); both pushed (0f08cb5..1532fca).
- QA re-measurement of the parallel session's uncommitted coverage work:
  - `npm run build` exit 0; vitest **131 files / 1176 tests pass** exit 0
    (was 115/1063); docker `cargo test` exit 0.
  - Coverage measured with expanded scope (`coverage.include` now `src/**`
    per vitest.config.ts): **lines 88.68%, branches 75.85%, functions
    90.83%** (statements 87.04%).
  - ADR-0020 gap list status: `process-notifier.ts` 47.4% -> **100%**,
    `object-pool.ts` 48.5% -> **100%** (pool dir at 100%), `sync-service.ts`
    39.7% -> **79.4%**, `version-recovery.ts` 50.6% -> **74.4%** (still the
    lowest).

## Next Exact Step

1. Parallel session (or owner instruction) commits its working tree: 7
   modified src/config files + 16 new test files. Do NOT commit them from
   this session.
2. Then: ADR-0020 step 2 — add ratchet thresholds to vitest.config.ts from
   this baseline, then close version-recovery + sync-service to parity.
3. Optional hardening (owner decision): prune unexpected bin/ entries in
   release.yml npm prep before publish.
4. Owner decision pending: ADR-0019 acceptance (Knowledge RAG retirement).

## Key Decisions

- ADR-0020: coverage is a signal, not a target (test-strategy canon);
  100% global rejected; failure/recovery path parity mandatory; thresholds
  are a regression ratchet, not a quality bar; Rust stays cargo-test-anchored
  without instrumentation.
- Absence checks need positive controls: the pty=0 result only became
  trustworthy once `shell-listener` was counted as present (which is also
  what exposed the stale extensionless binary in the 1.7.17 npm package).
- Radius discipline: rust-pool "Binary not found" path test and the
  release.yml bin/ pruning gap remain recorded debt.
- Parallel-session hygiene: ledgers merged, never clobbered; each session
  commits only its own files.

## Known Risks

- In-memory Knowledge RAG has 14 test suites in `tests/unit/knowledge/` that
  will need careful retirement during ADR-0019 Phase 3 to maintain gate
  stability.
- External consumers importing from `src/core/knowledge/index.ts` must be
  guarded during ADR-0019 Phase 1 and Phase 2.
- 1.7.17 npm package carries ~4.1 MB dead weight (stale `bin/orchestrator`);
  no runtime path reaches it. Disappears from the next tag cut.
- Two sessions hold uncommitted-vs-published divergence risk: this ledger
  commit and the parallel session's code commit must stay separate.

## Files To Open First Next Session

1. AGENT_MEMORY.md
2. vitest.config.ts (thresholds step pending here)
3. src/core/recovery/version-recovery.ts + src/core/sync/sync-service.ts
   (gap-list remainder)
4. docs/adr/0020-risk-graded-test-coverage-policy.md
