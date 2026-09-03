# ADR-0011: Local-First Search Proposal and Ebbinghaus Memory OS

Date: 2026-06-24 23:50 KST
Status: Implemented
Source: `docs/histories/2026/06/19/LOCAL_SEARCH_ENHANCEMENT_PROPOSAL.md` (removed 2026-09-03; history in git)
Report: `docs/histories/2026/06/19/LOCAL_SEARCH_ENHANCEMENT_COMPLETION_REPORT.md`

## Context

Search quality and memory decay needed a principled design under hard
constraints: no GPU, no external model files, no external API, CPU-only.

## Decision

- Multi-part roadmap: search proposals 1-7, memory-decay proposals 8-12, and
  the Local Ebbinghaus Memory OS (Proposal 13).
- Ship Proposal 13 read-path first: every note gets a strength that decays
  over time, is reinforced by recall, and is de-referenced rather than deleted.
- Keep every disk-mutating or destructive behavior behind an explicit,
  default-off opt-in.
- Leave search proposals 1-7 (PageRank, proximity, PMI expansion, ONNX,
  learning-to-rank) as roadmap for that cycle.

## Consequences

- Implemented, audited, hardened: 54 tests green, typecheck clean, including
  resolution of one high-severity audit finding.
- Query-time scoring with decay math in a single source of truth.
