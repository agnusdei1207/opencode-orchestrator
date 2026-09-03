# Architecture Decision Records

Date: 2026-09-03 22:52 KST
Status: Active — this directory is the single source of truth for design decisions.

## Process

1. Any hard-to-reverse decision gets an ADR **before** implementation ships.
2. One decision per file: `docs/adr/NNNN-short-title.md`, sequential numbers.
3. Every ADR carries a datetime (`Date: YYYY-MM-DD HH:MM KST`) and a `Status`.
4. Plans (`PLAN_*.md`) are working notes, not records: once decided, the outcome
   lives here and the plan is removed. History remains recoverable in git.
5. All documents in this project are written in English.
6. Statuses: `Proposed` → `Accepted` → `Implemented`; or `Superseded by ADR-XXXX`.

## Template

```markdown
# ADR-NNNN: Title

Date: YYYY-MM-DD HH:MM KST
Status: Proposed | Accepted | Implemented | Superseded by ADR-XXXX
Source: (migrated plan path, if any; removal date)

## Context

Why this decision was needed (2-4 sentences).

## Decision

What was decided (bullets).

## Consequences

What followed, including verification evidence and known limits.
```

## Index

| ADR | Date (KST) | Title | Status |
| --- | --- | --- | --- |
| [0001](0001-second-brain-knowledge-graph-rag.md) | 2026-06-01 00:26 | Second-Brain knowledge-graph RAG | Implemented |
| [0002](0002-knowledge-rag-runtime-wiring.md) | 2026-06-01 23:33 | Knowledge RAG runtime wiring and SDK alignment | Implemented |
| [0003](0003-graphical-markdown-mission-memory.md) | 2026-06-11 00:01 | Mission memory as Markdown/JSONL/Canvas | Implemented |
| [0004](0004-next-generation-modernization-roadmap.md) | 2026-06-11 00:01 | Next-generation modernization roadmap | Partially implemented |
| [0005](0005-sdk-plugin-alignment-mission-loop.md) | 2026-06-11 00:01 | SDK/plugin alignment and autonomous mission loop | Implemented |
| [0006](0006-release-hardening-baseline.md) | 2026-06-11 10:25 | Official alignment and release hardening | Partially implemented |
| [0007](0007-full-audit-structural-refactor.md) | 2026-06-19 10:05 | Full audit and structural refactor | Implemented |
| [0008](0008-builder-learnings-adoption.md) | 2026-06-19 12:13 | Builder learnings adoption assessment | Implemented |
| [0009](0009-local-search-memory-decay-roadmap.md) | 2026-06-19 18:10 | Local search and memory-decay roadmap (proposals 1-12) | Partially implemented |
| [0010](0010-bitemporal-memory-ranking.md) | 2026-06-24 23:50 | Bi-temporal metadata in search ranking | Implemented |
| [0011](0011-local-first-search-proposal.md) | 2026-06-24 23:50 | Local-first search proposal and Ebbinghaus memory OS | Implemented |
| [0012](0012-memory-decay-wiring-activation.md) | 2026-06-24 23:50 | Memory decay wiring activation | Implemented |
| [0013](0013-cognitive-memory-kind-adoption.md) | 2026-07-01 17:40 | Cognitive memory-kind adoption grades | Implemented |
| [0014](0014-bundled-jsonc-parser-fix.md) | 2026-07-02 18:45 | Bundled jsonc-parser relative-import fix | Implemented |
| [0015](0015-bundle-resolution-audit.md) | 2026-07-02 22:13 | Bundle resolution audit (Issue #31 follow-up) | Implemented |
| [0016](0016-session-lifecycle-context-limits.md) | 2026-09-02 18:00 | Session lifecycle safety and model-aware context limits | Implemented |
| [0017](0017-windows-config-path-migration.md) | 2026-09-03 22:31 | Windows config-path migration and stale cache invalidation | Implemented |
| [0018](0018-shell-listener-pty-helper-removal.md) | 2026-09-03 23:22 | Shell-listener one-touch PTY helper removal | Implemented |
