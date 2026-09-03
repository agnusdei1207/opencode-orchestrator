# ADR-0001: Second-Brain Knowledge-Graph RAG

Date: 2026-06-01 00:26 KST
Status: Implemented
Source: `docs/histories/2026/05/31/PLAN_SecondBrainOrchestration_2026-05-31.md` (removed 2026-09-03; history in git)

## Context

The orchestrator needed repository knowledge available to agents at runtime
without an external vector database. The chosen direction was an Obsidian-style
in-memory knowledge graph over Markdown plus an autonomous memory lifecycle.

## Decision

- Build a local-first knowledge plane: tag indexer (O(1) tag HashMap), wikilink
  graph parser, hybrid search (BM25 + tags + graph + RRF fusion), safety guards.
- Index `docs/**/*.md` and `.opencode/docs/**/*.md` as the structured vault.
- Verify the plan against live code and re-align divergences instead of
  rewriting (audit correction recorded 2026-06-01).

## Consequences

- Knowledge RAG modules shipped under `src/core/knowledge/`
  (`tag-indexer.ts`, `graph-parser.ts`, `hybrid-search.ts`, `safety-guards.ts`).
- Follow-up wiring in ADR-0002 connected Phase 5 to the system-transform hook.
- Constraint established: no GPU, no external model, no external API, CPU-only.
