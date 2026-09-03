# ADR-0019: Retire In-Memory Knowledge RAG Subsystem

Date: 2026-09-04 00:10 KST
Status: Accepted (Phase 1 Implemented)
Source: Strategic architectural review comparing `opencode-orchestrator`, `minimal-agent`, and `oh-my-openagent`.

## Context

The in-memory Second-Brain Knowledge RAG subsystem (ADR-0001, ADR-0002, ADR-0009 through ADR-0013) was implemented to provide local-first repository knowledge retrieval over Markdown documentation via BM25 lexical scoring, YAML frontmatter tag inverted indexing, wikilink bidirectional graph BFS, and an Ebbinghaus mathematical decay model.

Live evaluation and comparative architectural analysis with peer agent frameworks (`minimal-agent`, `oh-my-openagent`) have revealed that automatic prompt-injected RAG is counter-productive for coding agents:
1. **Context Pollution and Attention Dilution**: Involuntary injection of 220-character document snippets into system prompts on every turn pollutes the context window, triggers partial-context hallucinations, and competes with high-priority mission objectives.
2. **Redundancy with Deterministic Tooling**: Unlike passive chat interfaces, coding agents operate as autonomous tool-users. When agents require code definitions, structural relationships, or documentation, deterministic tools (`ripgrep`, LSP `find_references`/`goto_definition`, `ast-grep`, and explicit file inspection) provide exact, verifiable facts rather than heuristic lexical guesses.
3. **Staleness and Maintenance Overhead**: Codebases evolve continuously during active development. Maintaining over 2,000 lines of complex in-memory graph traversal, BM25 indexing, decay scoring, and 14 dedicated test suites creates substantial maintenance friction with zero demonstrated improvement in task completion rates.
4. **Precedent from Minimal Team Runtimes**: Minimalist architectures (such as `minimal-agent`) prove that effective agent collaboration requires only a bounded journal and a single model-curated working brief, rejecting in-memory RAG, evidence graphs, and complex decay engines entirely.

## Decision

Adopt a phased plan to deprecate, decouple, and retire the in-memory Knowledge RAG subsystem in favor of on-demand tool retrieval and compact working memory:

### Phase 1: Non-Breaking Runtime Decoupling (Opt-in / Soft Disable)
- Disable automatic RAG prompt injection in `src/plugin-handlers/system-transform-handler.ts` by default.
- Add configuration flag `missionLoop.enableKnowledgeRag: false` (defaulting to `false`).
- Retain existing modules under `src/core/knowledge/` to prevent breaking external consumer imports during the transition period.
- Eliminate `<knowledge_rag_context>` injection overhead from normal mission turns.

### Phase 2: Working Memory Consolidation
- Decouple the generated markdown memory surface (`.opencode/docs/brain/scratchpad.md`) from the heavy decay scoring and graph indexing machinery.
- Retain a simplified, lightweight single-file scratchpad / working brief pattern for active mission state, aligning with the successful `brief.md` pattern.
- Direct agent instructions to proactively pull repository architecture and decisions on demand using `grep`, `view_file`, or dedicated documentation tools when needed, rather than passive injection.

### Phase 3: Subsystem Decommissioning and Code Removal
- Decommission obsolete indexing and search modules in `src/core/knowledge/`:
  - `hybrid-search.ts` (BM25 + RRF fusion)
  - `graph-parser.ts` (Wikilink graph BFS)
  - `tag-indexer.ts` (Frontmatter inverted index)
  - `memory-scoring.ts` & `memory-kind.ts` (Ebbinghaus decay formulas)
  - `memory-lifecycle.ts`, `memory-consolidation.ts`, `memory-evaluation.ts`, `memory-promotion.ts`, `memory-maintenance-runner.ts`
  - `safety-guards.ts`, `retrieval-weights.ts`, `scratchpad.ts` (volatile cache)
- Clean up periodic maintenance passes in `src/core/cleanup/cleanup-scheduler.ts`.
- Remove retired test suites under `tests/unit/knowledge/`.
- Formally supersede ADR-0001, ADR-0002, ADR-0009, ADR-0010, ADR-0011, ADR-0012, and ADR-0013.

## Consequences

- **Prompt Efficiency**: Eliminates unrequested documentation snippets from system prompts, saving context tokens and reducing model distraction.
- **Reliability**: Mitigates hallucination risks caused by out-of-context or outdated documentation snippets.
- **Architectural Simplicity**: Removes ~2,000+ lines of complex search, graph, and decay code, significantly shrinking test execution time and dependency surface.
- **Phase 1 Implementation Evidence (2026-09-04)**:
  - `enableKnowledgeRag: false` added to `MissionRuntimeOptions` and `MissionLoopOptionsSchema`.
  - `opencode-orchestrator.schema.json` regenerated and verified.
  - `system-transform-handler.ts` gates `<knowledge_rag_context>` injection behind `enableKnowledgeRag` (default OFF).
  - Verified by `tests/unit/system-transform-handler.test.ts` (11/11 pass).
- **Rollback Strategy**:
  - Phase 1 is fully reversible via setting `missionLoop.enableKnowledgeRag: true` in plugin options.
  - Phase 3 will execute only after Phase 1 and Phase 2 achieve validated stability across end-to-end mission benchmarks.
