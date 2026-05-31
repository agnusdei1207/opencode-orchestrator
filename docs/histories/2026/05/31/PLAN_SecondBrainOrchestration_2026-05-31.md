---
title: "PLAN: OpenCode Second Brain & Autonomous Knowledge Graph RAG Integration"
tags: [knowledge-rag, second-brain, memory-consolidation, multi-agent]
created: 2026-05-31
version: 1.2.71
status: in-progress
---

# PLAN: OpenCode Second Brain & Autonomous Knowledge Graph RAG Integration

This document serves as the **architectural roadmap and history plan** for integrating an Obsidian-style in-memory knowledge graph RAG and an autonomous agent memory management lifecycle into the `opencode-orchestrator` framework.

---

## 🔗 Related Documents and Wiki-Links (Obsidian Wiki-Links)
* **Parent Milestone**: [[Core-Architecture-MOC]]
* **Recent Release Notes**: [[1.2.71-Release-Notes]]
* **Implementation Details**: `src/core/knowledge/tag-indexer.ts` ➡️ [[TagIndexer-Implementation]]
* **Next Micro-Task**: `src/core/knowledge/graph-parser.ts` ➡️ [[GraphParser-Design]]

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
               |     docs/knowledge/ (Structured Vault)    |
               +---------------------┬---------------------+
                                     |
                                     ▼ (O(1) Tag HashMap)
               +-------------------------------------------+
               |  [Phase 1] tag-indexer.ts (Completed)     |
               +---------------------┬---------------------+
                                     |
                                     ▼ (Wiki-Links & Adjacency)
               +-------------------------------------------+
               |  [Phase 2] graph-parser.ts (Completed)    |
               +---------------------┬---------------------+
                                     |
                                     ▼ (BM25 + Cosine Vector + 2-Hop Traverse)
               +-------------------------------------------+
               |  [Phase 3] hybrid-search.ts               |
               +-------------------------------------------+
```

### 2-1. Phase-by-Phase Micro-Roadmap
1. **[x] Phase 1: TagIndexer Implementation**: Completed YAML Frontmatter parser, tag index builder, and high-speed query sets like `getFilesWithAllTags`, and successfully passed all unit tests.
2. **[x] Phase 2: Wiki-Links & Backlinks**: Extract `[[Note]]` and `[Note](./file.md)` relationships within markdown to construct a bi-directional adjacency-list knowledge graph. Dynamically inject an automatically synchronized `## 🔗 Backlinks` section at the bottom of target files.
3. **[ ] Phase 3: Triple-Engine Hybrid Search & RRF**: Implement a ranking engine that fuses lexical FTS + local cosine similarity vectors + graph 2-hop traversal search using the Reciprocal Rank Fusion (RRF) formula.
4. **[ ] Phase 4: Scratchpad Registers**: Embed an agent-exclusive high-speed register cache (`docs/brain/scratchpad.md`) and an autonomous Obsidian Canvas (.canvas) drawing module.
5. **[ ] Phase 5: Multi-Agent Context Injection**: Dynamically inject the knowledge RAG plane into the agent via `system-transform-handler.ts` at the beginning of each thinking loop turn.
6. **[ ] Phase 6: 3 High-Power Stability Guards**:
   - DFS/BFS circular link stack overflow prevention (Max 2-Hop depth lock)
   - Simultaneous asynchronous write collision prevention (FIFO write queue)
   - Autonomous destruction control guard (Pinning `keep: true` shield)
7. **[ ] Phase 7: Memory Consolidation**: Autonomous splitting (Fission) of oversized notes, merging of similar notes & MOC building (Fusion), and isolated archiving (GC) of orphan/isolated nodes.

---

## 🔗 Backlinks

*Manually structured since the bi-directional graph engine is not yet operational.*
- [[1.2.71-Release-Notes]]
- [[TagIndexer-Implementation]]
