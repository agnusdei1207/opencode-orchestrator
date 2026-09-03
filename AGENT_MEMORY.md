# Agent Memory - OCO Session

Last updated: 2026-09-04 00:10 KST

## Current Task

Author and record ADR-0019 proposal to deprecate and retire the in-memory
Knowledge RAG subsystem in favor of on-demand tool retrieval and compact working
memory. Planning output only (no implementation code modified).

## Last Completed Step

- Authored `docs/adr/0019-retire-knowledge-rag-subsystem.md` with status Proposed.
  Establishes context from architectural comparisons with `minimal-agent` and
  `oh-my-openagent`, highlighting the risks of automatic prompt RAG (context
  pollution, stale index, maintenance overhead, redundancy with deterministic
  LSP/ripgrep tooling).
- Formulated a 3-phase execution roadmap:
  - Phase 1: Soft disable of automatic prompt injection via config default.
  - Phase 2: Working memory consolidation onto single-file scratchpad (`brief.md` pattern).
  - Phase 3: Decommissioning of `src/core/knowledge/` modules and supersession of ADRs 0001, 0002, 0009-0013.
- Synced `docs/adr/README.md` index table to 19 ADR rows.
- Verified zero Hangul characters across all markdown files (`git grep -nP "[\x{AC00}-\x{D7A3}]" -- "*.md"` returned exit code 1).

## Next Exact Step

1. Commit and push the ADR proposal and updated docs.
2. Await owner acceptance before initiating Phase 1 runtime decoupling.

## Key Decisions

- ADR-0019 records the strategic pivot away from in-memory Knowledge RAG for
  coding agents, shifting toward deterministic tool retrieval (LSP, ripgrep, AST)
  and lightweight single-file working memory.
- Strictly adhere to owner instruction: planning document only; no implementation
  code changes in this session.
- Keep ADRs in English with zero Hangul characters across repository documentation.

## Known Risks

- In-memory Knowledge RAG has 14 test suites in `tests/unit/knowledge/` that will
  need careful retirement during Phase 3 to maintain gate stability.
- External consumers importing from `src/core/knowledge/index.ts` must be guarded
  during Phase 1 and Phase 2.

## Files To Open First Next Session

1. AGENT_MEMORY.md
2. docs/adr/0019-retire-knowledge-rag-subsystem.md
3. docs/adr/README.md
