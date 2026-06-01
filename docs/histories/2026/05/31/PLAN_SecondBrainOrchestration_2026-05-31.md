---
title: "PLAN: OpenCode Second Brain & Autonomous Knowledge Graph RAG Integration"
tags: [knowledge-rag, second-brain, memory-consolidation, multi-agent]
created: 2026-05-31
version: 1.3.2
status: verified
---

# PLAN: OpenCode Second Brain & Autonomous Knowledge Graph RAG Integration

This document serves as the **architectural roadmap and history plan** for integrating an Obsidian-style in-memory knowledge graph RAG and an autonomous agent memory management lifecycle into the `opencode-orchestrator` framework.

---

## 0. Audit Correction (Verified on 2026-06-01)

The original plan was directionally correct, but the live code diverged in two important places and has now been re-aligned:

- **Phase 5 is now wired** in `src/plugin-handlers/system-transform-handler.ts` and injects repository knowledge for orchestrated sessions.
- **Runtime knowledge roots are not limited to `docs/knowledge/`**. The current implementation indexes `docs/**/*.md` and `.opencode/docs/**/*.md`.
- **OpenCode SDK alignment was verified against 2026-06-01 package state**: `@opencode-ai/plugin` `1.15.13`, `@opencode-ai/sdk` `1.15.13`.
- **`assistant.done` was removed** because it is not part of the current official SDK hook surface. Completed assistant turns are now bridged from `message.updated` completion events.

---

## 🔗 Related Documents and Wiki-Links (Obsidian Wiki-Links)
* **Parent Milestone**: [[Core-Architecture-MOC]]
* **Recent Release Notes**: [[1.3.2-Release-Notes]]
* **Implementation Details**: `src/core/knowledge/tag-indexer.ts` ➡️ [[TagIndexer-Implementation]]
* **Graph Engine**: `src/core/knowledge/graph-parser.ts` ➡️ [[GraphParser-Design]]
* **Search Fusion**: `src/core/knowledge/hybrid-search.ts` ➡️ [[HybridSearch-RRF]]
* **Memory Guards**: `src/core/knowledge/safety-guards.ts` ➡️ [[SafetyGuards-Design]]

---

## 📌 1. Project-wide Audit & 1.2.71 Release Achievements

### 1-1. Successful Deployment of 1.2.71 Patch Version (Completed on 2026-05-31)
* **Core Fix**: Successfully debugged and recovered the README sync crash caused by the Windows host filesystem I/O newline characters (`\r\n`).
* **Rust Binary Compilation**: Successfully built high-integrity binaries for all 5 major platforms by spinning up a WSL Docker cross-compilation container.
  - `bin/orchestrator-linux-x64` (Verified 5.2MB, includes the Linux x64 packaging fix)
  - `bin/orchestrator-linux-arm64` (Verified 5.0MB)
* **Manual NPM Release**: Completed public deployment using the injection of a new Classic Token (`npm_ZuHY...`) and permanently incinerated the credential file `.npmrc`.
* **CI/CD Enhancement**: Integrated an official NPM registry automated deployment stage into `.github/workflows/release.yml`.

---

## 🏗️ 2. Obsidian Knowledge RAG Integration Plan & Architecture

Design a high-speed knowledge graph traversal plane operating on top of a TypeScript ESM architecture.

```text
               +-------------------------------------------+
               | docs/**/*.md + .opencode/docs/**/*.md     |
               |        (Structured Vault)                 |
               +---------------------┬---------------------+
                                     |
                                     ▼ (O(1) Tag HashMap)
               +-------------------------------------------+
               |  [Phase 1] tag-indexer.ts    ✅ Completed  |
               +---------------------┬---------------------+
                                     |
                                     ▼ (Wiki-Links & Adjacency)
               +-------------------------------------------+
               |  [Phase 2] graph-parser.ts   ✅ Completed  |
               +---------------------┬---------------------+
                                     |
                                     ▼ (BM25 + Tag + 2-Hop Graph → RRF)
               +-------------------------------------------+
               |  [Phase 3] hybrid-search.ts  ✅ Completed  |
               +---------------------┬---------------------+
                                     |
          ┌────────────────┬─────────┴──────────┬─────────────────┐
          ▼                ▼                    ▼                 ▼
  ┌──────────────┐ ┌──────────────┐   ┌──────────────┐  ┌──────────────┐
  │ [Phase 4]    │ │ [Phase 5]    │   │ [Phase 6]    │  │ [Phase 7]    │
  │ scratchpad   │ │ Context      │   │ Safety       │  │ Memory       │
  │ ✅ Completed │ │ Injection    │   │ Guards       │  │ Consolidation│
  │              │ │ ✅ Completed │   │ ✅ Completed │  │ ✅ Completed │
  └──────────────┘ └──────────────┘   └──────────────┘  └──────────────┘
```

### 2-1. Phase-by-Phase Micro-Roadmap
1. **[x] Phase 1: TagIndexer Implementation**: Completed YAML Frontmatter parser, tag index builder, and high-speed query sets like `getFilesWithAllTags`, and successfully passed all unit tests.
2. **[x] Phase 2: Wiki-Links & Backlinks**: Extract `[[Note]]` and `[Note](./file.md)` relationships within markdown to construct a bi-directional adjacency-list knowledge graph. Dynamically inject an automatically synchronized `## 🔗 Backlinks` section at the bottom of target files.
3. **[x] Phase 3: Triple-Engine Hybrid Search & RRF**: Implement a ranking engine that fuses lexical BM25 term-frequency + tag index matching + graph 2-hop traversal search using the Reciprocal Rank Fusion (RRF) formula (`score = Σ 1/(k + rank_i)`, k=60).
4. **[x] Phase 4: Scratchpad Registers**: Embed an agent-exclusive high-speed register cache with LRU eviction (max 64 entries, 4KB per entry), markdown serialization/deserialization for persistence.
5. **[x] Phase 5: Multi-Agent Context Injection**: Dynamically inject the knowledge RAG plane into orchestrated sessions via `system-transform-handler.ts`, using the mission prompt and current task as the query seed for hybrid markdown retrieval.
6. **[x] Phase 6: 3 High-Power Stability Guards**:
   - DFS/BFS circular link stack overflow prevention (configurable max depth)
   - Simultaneous asynchronous write collision prevention (FIFO write queue with drain)
   - Autonomous destruction control guard (Pinning `keep: true` shield via frontmatter)
7. **[x] Phase 7: Memory Consolidation**: Autonomous identification of oversized notes (fission candidates), merge suggestions based on shared tag overlap (fusion candidates), orphan note detection (GC candidates), and MOC (Map of Content) generation for navigational hubs.

---

## 📊 3. Code Quality Metrics

All knowledge module source files comply with the following quality standards:

| Metric | Target | Actual |
|--------|--------|--------|
| Cyclomatic Complexity | ≤ 10 | ✅ Max 7 |
| Function Length | ≤ 40 lines | ✅ All compliant |
| Nesting Depth | ≤ 3 | ✅ All compliant |
| `as any` casts | 0 | ✅ Zero |
| Magic Strings | 0 | ✅ Constants used |
| External Dependencies | 0 | ✅ Pure TypeScript |
| Console Calls | 0 | ✅ Clean |
| Circular Dependencies | 0 | ✅ None |
| ReDoS Risk | None | ✅ Verified |

---

## 🔗 Backlinks

- [[1.3.2-Release-Notes]]
- [[TagIndexer-Implementation]]
- [[GraphParser-Design]]
- [[HybridSearch-RRF]]
- [[SafetyGuards-Design]]
