# PLAN: Bi-temporal Memory Implementation

## Metadata

- **Created**: 2026-06-19 15:55 KST
- **File Name**: `PLAN_BitemporalMemoryImplementation_2026-06-19-1555.md`
- **Scope**: Implement `event_time` / `ingestion_time` metadata plumbing in the local knowledge memory path.
- **Change Type**: Bugfix / Feature
- **Risk Level**: MEDIUM

## Current Session

- **Task**: Apply bi-temporal memory semantics to the OpenCode local knowledge retrieval and generated mission-memory notes.
- **Modified Files**:
  - `src/core/knowledge/tag-indexer.ts`
  - `src/core/knowledge/hybrid-search.ts`
  - `src/core/knowledge/mission-memory.ts`
  - `tests/unit/knowledge/tag-indexer.test.ts`
  - `tests/unit/knowledge/hybrid-search.test.ts`
  - `tests/unit/mission-memory-knowledge.test.ts`
  - this plan file
- **Scope Boundary**: No external dependencies, no destructive archive operation, no broad release/version changes.

## Survey Evidence

| Area | Evidence |
|:--|:--|
| Entry point | `src/plugin-handlers/system-transform-handler.ts` calls `KnowledgeContextProvider.buildPrompt()` for repository knowledge context. |
| Indexing | `context-provider.ts` builds `TagIndexer`, `GraphParser`, and `HybridSearch`; `indexContent()` currently receives note name and body only. |
| Metadata | `tag-indexer.ts` stores arbitrary frontmatter keys but does not type bi-temporal fields. |
| Search | `hybrid-search.ts` fuses lexical/tag/graph RRF without memory strength or expiry weighting. |
| Generated memory | `mission-memory.ts` writes `recorded_at` only; it does not emit `event_time` / `ingestion_time`. |
| Baseline | `npm test -- --run tests/unit/knowledge/tag-indexer.test.ts tests/unit/knowledge/hybrid-search.test.ts tests/unit/knowledge/memory-consolidation.test.ts tests/unit/mission-memory-knowledge.test.ts` passed 22/22. |

## Phases

### Phase 1: Metadata Contract

| # | Microtask | Expected Result | Verification |
|:-:|:--|:--|:--|
| 1.1 | Add typed frontmatter fields for `event_time`, `ingestion_time`, `valid_from`, `valid_to`, access metadata | Parser preserves bi-temporal fields | tag-indexer focused test |
| 1.2 | Add generated mission-memory timestamps | Generated notes carry event and ingestion time | mission-memory focused test |

### Phase 2: Retrieval Plumbing

| # | Microtask | Expected Result | Verification |
|:-:|:--|:--|:--|
| 2.1 | Pass frontmatter metadata into `HybridSearch.indexContent()` | Search can score by memory metadata | hybrid-search test |
| 2.2 | Apply safe memory strength multiplier only when memory metadata exists | Existing notes remain neutral; stale/expired memory is demoted | hybrid-search test |

### Phase 3: Verification

| # | Microtask | Expected Result | Verification |
|:-:|:--|:--|:--|
| 3.1 | Re-read changed files | Contract matches implementation | direct read |
| 3.2 | Run focused tests and `git diff --check` | No regression in touched paths | command exit code 0 |

## Risk Points

| Location | Risk | Mitigation |
|:--|:--|:--|
| `hybrid-search.ts` | Ranking changes can affect unrelated notes | Missing bi-temporal metadata returns neutral multiplier `1.0`. |
| `mission-memory.ts` | Non-deterministic ingestion timestamp can break tests | Tests assert field presence/shape rather than exact wall time. |
| `tag-indexer.ts` | YAML fallback parser can miss fields | Add focused tests for standard and fallback parsing. |

## Completion Criteria

- [x] Bi-temporal metadata parsed.
- [x] Generated mission memory emits `event_time` and `ingestion_time`.
- [x] Search ranking demotes stale/expired memory when metadata is present.
- [x] Focused tests pass.
- [x] Diff check passes.
- [x] Commit is scoped to the files above.

## Chained Tasks / Discovery Queue

- [x] Decide later whether to add persistent `recordAccess()` writes; current change avoids runtime disk writes. Deferred to avoid search-time disk mutation without a dry-run/rollback design.

## Verification Log

| Command | Result |
|:--|:--|
| `npm test -- --run tests/unit/knowledge/tag-indexer.test.ts tests/unit/knowledge/hybrid-search.test.ts tests/unit/mission-memory-knowledge.test.ts` | PASS, 16 tests |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm test -- --run tests/unit` | PASS, 689 tests |
| `git diff --check -- <touched files>` | PASS |
