# ADR-0009: Local Search and Memory-Decay Roadmap (Proposals 1-12)

Date: 2026-06-19 18:10 KST
Status: Partially implemented
Source: `docs/histories/2026/06/19/PLAN_LocalSearchAndMemoryDecayEnhancement_2026-06-19.md` (removed 2026-09-03; history in git)

## Context

Twelve enhancement proposals (search quality 1-7, memory decay 8-12) needed an
ordered, risk-aware adoption sequence against the local-first, CPU-only
constraint.

## Decision

Four phases by difficulty and payoff: foundation extension (1, 4, 8) →
search quality (2, 3, 9) → advanced features (5, 6, 10, 11) → research (7, 12).
Each proposal mapped to its target file (`hybrid-search.ts`, `graph-parser.ts`,
`tag-indexer.ts`, `retrieval-weights.ts`, `context-provider.ts`,
`memory-consolidation.ts`, `mission-memory.ts`).

## Consequences

- Search-quality proposals 1-7 intentionally remain roadmap (confirmed by the
  completion report: not implemented in that cycle).
- Memory-decay proposals were superseded in execution order by ADR-0010 through
  ADR-0012, which shipped the Ebbinghaus read-path first.
