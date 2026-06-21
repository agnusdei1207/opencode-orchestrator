# Local Search and Memory Decay Enhancement Plan

Date: 2026-06-19
Scope: `opencode-orchestrator` — `src/core/knowledge/` search pipeline + memory decay system
Status: ⏳ PENDING — awaiting implementation decision
Author: plan derived from proposal
## Metadata

| Field | Value |
| --- | --- |
| Created | 2026-06-19 15:11 |
| File Name | `PLAN_LocalSearchAndMemoryDecayEnhancement_2026-06-19.md` |
| Scope | Local-first search enhancements (7 items) + memory decay system (5 items), 12 items total |
| Change Type | Feature / Enhancement |
| Risk Level | MEDIUM–HIGH (phased, incremental rollout) |

## 1. Reference Documents

Full proposal: [`LOCAL_SEARCH_ENHANCEMENT_PROPOSAL.md`](../../../../proposals/2026-06-19/LOCAL_SEARCH_ENHANCEMENT_PROPOSAL.md)

This plan organizes the 12 items from the proposal above into implementation phases.
The technical rationale, pseudocode, and paper references for the proposals are all contained in the original proposal document.

## 2. Proposal Summary

| # | Proposal | Category | Difficulty | Target File | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | PageRank graph scoring | Search | 🟢 Low | `graph-parser.ts` | ⏳ PENDING — awaiting decision |
| 2 | Position index + phrase proximity bonus | Search | 🟡 Medium | `hybrid-search.ts` | ⏳ PENDING — awaiting decision |
| 3 | Corpus-based query expansion (PMI) | Search | 🟡 Medium | `hybrid-search.ts` | ⏳ PENDING — awaiting decision |
| 4 | Local hash embedding (SimHash) | Search | 🟡 Medium | `hybrid-search.ts` | ⏳ PENDING — awaiting decision |
| 5 | ONNX lightweight embedding | Search | 🟠 Medium–High | `hybrid-search.ts` | ⏳ PENDING — awaiting decision |
| 6 | Per-role weight self-learning | Search | 🟡 Medium | `retrieval-weights.ts` | ⏳ PENDING — awaiting decision |
| 7 | Learning-to-Rank (RRF replacement) | Search | 🔴 High | `hybrid-search.ts` | ⏳ PENDING — awaiting decision |
| 8 | Access frequency tracking | Decay | 🟢 Low | `tag-indexer.ts`, `mission-memory.ts` | ⏳ PENDING — awaiting decision |
| 9 | Adaptive exponential decay (FadeMem) | Decay | 🟡 Medium | `context-provider.ts` | ⏳ PENDING — awaiting decision |
| 10 | Hierarchical compression pipeline | Decay | 🟡 Medium | `memory-consolidation.ts` | ⏳ PENDING — awaiting decision |
| 11 | Conflict-based forgetting | Decay | 🟠 Medium–High | `memory-consolidation.ts` | ⏳ PENDING — awaiting decision |
| 12 | A-Mem autonomous linking | Decay | 🔴 High | `graph-parser.ts`, `mission-memory.ts` | ⏳ PENDING — awaiting decision |

## 3. Affected Files

| File | Path | Change Scope | Related Proposals |
| --- | --- | --- | --- |
| `hybrid-search.ts` | `src/core/knowledge/hybrid-search.ts` | lexicalSearch extension, channel additions, ranking replacement | 2, 3, 4, 5, 7 |
| `graph-parser.ts` | `src/core/knowledge/graph-parser.ts` | add pagerank(), autonomous link generation | 1, 12 |
| `tag-indexer.ts` | `src/core/knowledge/tag-indexer.ts` | frontmatter access_count/last_accessed | 8 |
| `retrieval-weights.ts` | `src/core/knowledge/retrieval-weights.ts` | ROLE_WEIGHTS auto-optimization | 6 |
| `context-provider.ts` | `src/core/knowledge/context-provider.ts` | apply decay function, time weighting | 9 |
| `memory-consolidation.ts` | `src/core/knowledge/memory-consolidation.ts` | 4-Tier compression, conflict detection | 10, 11 |
| `mission-memory.ts` | `src/core/knowledge/mission-memory.ts` | access logging, autonomous links | 8, 12 |

## 4. Implementation Phases

### Phase 1: Foundation Extension (1–2 weeks) — Proposals 1, 4, 8

Low-difficulty items first. Limited to adding functions to existing modules, with no external dependencies.

| # | Microtask | Expected Result | Verification |
| --- | --- | --- | --- |
| 1.1 | Implement `pagerank()` in `graph-parser.ts` | Compute PageRank vector over the wikilink graph | Unit test: PageRank values match a known graph |
| 1.2 | Wire graph score channel into `hybrid-search.ts` | PageRank channel participates in RRF | Integration test: graph score is reflected in the final ranking |
| 1.3 | Port `builder-private` SimHash logic to TS | Create `simhash.ts` module | Identical input before/after port → identical hash |
| 1.4 | Add Dense channel in `hybrid-search.ts` | Search channel based on SimHash similarity | Unit test: similar documents rank close together |
| 1.5 | Add `access_count`, `last_accessed` to `tag-indexer.ts` frontmatter | Increment counter and update timestamp on document access | Integration test: confirm frontmatter values change after access |
| 1.6 | Call access tracking from `mission-memory.ts` | Automatic tracking on document lookup | e2e: search → access count increments |

Progress:

- [ ] Phase 1
  - [ ] 1.1 PageRank implementation
  - [ ] 1.2 graph score channel wiring
  - [ ] 1.3 SimHash TS port
  - [ ] 1.4 Dense channel addition
  - [ ] 1.5 Access frequency frontmatter extension
  - [ ] 1.6 Access tracking call wiring

### Phase 2: Search Quality Improvement (2–4 weeks) — Proposals 2, 3, 9

Extending the existing lexicalSearch and introducing decay curves. Medium difficulty.

| # | Microtask | Expected Result | Verification |
| --- | --- | --- | --- |
| 2.1 | Build position index (`term → [docId, positions]`) | Store token position information | Unit test: position list correctness |
| 2.2 | Add phrase proximity bonus computation logic | Bonus score based on distance between query tokens | Documents with near tokens score > documents with scattered tokens |
| 2.3 | Implement PMI co-occurrence statistics module | Compute word-pair PMI over the corpus | Unit test: PMI values for a known corpus |
| 2.4 | Query expansion logic (`expandQuery()`) | Automatically add top PMI-related terms to the query | Measure recall improvement with the expanded query |
| 2.5 | Implement adaptive exponential decay function | Per-tag decay constant `τ_tag`, Ebbinghaus curve | Unit test: decay values as time elapses |
| 2.6 | Apply decay weighting in `context-provider.ts` | Search rank of old memories naturally declines | Integration test: confirm recent documents are prioritized |

Progress:

- [ ] Phase 2
  - [ ] 2.1 Position index construction
  - [ ] 2.2 Phrase proximity bonus
  - [ ] 2.3 PMI co-occurrence statistics
  - [ ] 2.4 Query expansion logic
  - [ ] 2.5 Adaptive exponential decay
  - [ ] 2.6 Decay weighting application

### Phase 3: Advanced Features (4–8 weeks) — Proposals 5, 6, 10, 11

External dependencies (ONNX), auto-learning, compression pipeline. Medium–High difficulty.

| # | Microtask | Expected Result | Verification |
| --- | --- | --- | --- |
| 3.1 | Add `onnxruntime-node` dependency + bundle all-MiniLM-L6-v2 INT8 model | ONNX runtime loads successfully | Load test: model initialization < 500ms |
| 3.2 | Implement `embedder.ts` module | Text → 384-dimensional vector conversion | Unit test: cosine similarity of similar sentences > 0.8 |
| 3.3 | Integrate ONNX embedding channel into `hybrid-search.ts` | semantic channel participates in RRF | MRR@10 benchmark improvement |
| 3.4 | Implement ROLE_WEIGHTS auto-optimization | Online learning of per-role search weights | A/B test: NDCG improvement over defaults |
| 3.5 | Implement 4-Tier compression pipeline | Automatic Hot → Warm → Cold → Archive movement | Integration test: tier transitions based on access patterns |
| 3.6 | Implement conflict detection logic | Determine contradictions between new information and existing memory | Unit test: detection rate of known conflict pairs |
| 3.7 | Conflict-based automatic replacement | On contradiction, archive old memory + promote new one | Integration test: confirm latest information is retrieved after replacement |

Progress:

- [ ] Phase 3
  - [ ] 3.1 ONNX dependency + model bundle
  - [ ] 3.2 embedder.ts implementation
  - [ ] 3.3 ONNX channel integration
  - [ ] 3.4 ROLE_WEIGHTS auto-optimization
  - [ ] 3.5 4-Tier compression pipeline
  - [ ] 3.6 Conflict detection logic
  - [ ] 3.7 Conflict-based automatic replacement

### Phase 4: Research Phase (8+ weeks) — Proposals 7, 12

High difficulty. The full RRF replacement and autonomous linking depend on the results of Phases 1–3.

| # | Microtask | Expected Result | Verification |
| --- | --- | --- | --- |
| 4.1 | LtR training data collection pipeline | Generate training pairs from click/usage logs | Data quality validation: positive/negative pair ratio |
| 4.2 | Train LambdaMART or lightweight ranker | RRF-replacement ranking model | Offline NDCG@10 > RRF baseline |
| 4.3 | Replace ranking pipeline in `hybrid-search.ts` | Final ranking decided by the trained model | A/B test: MRR@10 improvement |
| 4.4 | Implement A-Mem autonomous linking engine | NeurIPS 2025 Zettelkasten pattern | Measure accuracy of auto-generated `[[links]]` |
| 4.5 | Integrate automatic links into `graph-parser.ts` | Merge with the existing wikilink graph | Graph connectivity metric improvement |
| 4.6 | Reflect autonomous links in `mission-memory.ts` | Insert automatic links into mission memory | e2e: confirm automatic link generation between related memories |

Progress:

- [ ] Phase 4
  - [ ] 4.1 LtR training data pipeline
  - [ ] 4.2 Lightweight ranker training
  - [ ] 4.3 Ranking pipeline replacement
  - [ ] 4.4 A-Mem autonomous linking engine
  - [ ] 4.5 Automatic link graph integration
  - [ ] 4.6 Autonomous link mission-memory reflection

## 5. Risk Factors

| Location | Risk | Severity | Mitigation Strategy |
| --- | --- | --- | --- |
| `hybrid-search.ts` | RRF weight balance breaks down when many channels are added | HIGH | Run benchmark regression tests after each phase's channel additions |
| ONNX model bundle | Binary size increase (~30MB INT8) | MEDIUM | Optional dependency (`optionalDependencies`), lazy load |
| `memory-consolidation.ts` | Data loss during 4-Tier compression | HIGH | Back up original before the archive step, secure a compression rollback path |
| Conflict detection | False positives delete valid memories | HIGH | Set conflict-decision threshold conservatively, archive instead of delete |
| LtR model | Regression vs. RRF when training data is insufficient | MEDIUM | Keep an RRF fallback path, set a minimum-data gate |
| Autonomous linking | Graph pollution from incorrect link generation | MEDIUM | Link confidence threshold, periodic link quality audits |
| Global | Backward compatibility breaks due to inter-phase interface changes | MEDIUM | Freeze the public API at phase boundaries, provide a deprecation path on changes |

## 6. Verification Criteria

| Metric | Baseline Measurement | Phase 1 Target | Phase 2 Target | Phase 3 Target | Phase 4 Target |
| --- | --- | --- | --- | --- | --- |
| MRR@10 | current value needs measurement | ≥ baseline | +5% | +10% | +15% |
| NDCG@10 | current value needs measurement | ≥ baseline | +5% | +10% | +15% |
| Search latency (p95) | current value needs measurement | ≤ baseline × 1.2 | ≤ baseline × 1.5 | ≤ baseline × 2.0 | ≤ baseline × 2.0 |
| Storage space savings | N/A | N/A | N/A | -20% (compression) | -30% (compression+archive) |
| Build time increase | current value needs measurement | ≤ +5% | ≤ +10% | ≤ +20% | ≤ +25% |

## 7. Completion Criteria

- [ ] All phases completed or explicitly deferred
- [ ] Verification commands pass (`npx tsc --noEmit`, `vitest run`, `cargo check --workspace`)
- [ ] 100% of tests pass, 0 regressions
- [ ] MRR@10 / NDCG@10 targets achieved
- [ ] All chained discovery items closed or explicitly deferred
- [ ] AGENT_MEMORY.md updated

## 8. Current Status

- Active phase: none — awaiting implementation decision
- Closed tasks: none
- Open chained tasks: none
- Blockers: awaiting user approval

> **Note**: All proposals in this plan are in the awaiting-implementation-decision state.
> Each phase begins only after explicit user approval.
> The adoption/deferral/exclusion of each proposal is decided by referring to the detailed analysis in the original proposal document.
