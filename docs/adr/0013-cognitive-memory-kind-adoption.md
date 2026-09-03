# ADR-0013: Cognitive Memory-Kind Adoption Grades

Date: 2026-07-01 17:40 KST
Status: Implemented
Source: `docs/histories/2026/07/01/PLAN_CognitiveMemoryKindAndEpisodicAdoption_2026-07-01.md` (removed 2026-09-03; history in git)

## Context

External cognitive-memory patterns (memory kinds, episodic capture) needed a
graded adoption verdict against what the orchestrator already had verified in
place.

## Decision

- ADOPT: the items with clear gaps and low integration cost (phased implementation).
- WATCH: promising but premature items, revisited on evidence.
- SKIP: anything already present or not plugin-owned.

## Consequences

- Adoption proceeds only through the graded list; ungraded imports are out of scope.
- One-line rule: grade first, implement only ADOPT items.
- Promoted to Implemented 2026-09-03: `memory-kind.ts` (episodic/semantic/
  procedural), `mission-episode.ts`, `memory-promotion.ts`, and retrieval
  weights/scoring wiring with `tests/unit/retrieval-weights.test.ts` verified
  in the tree.
