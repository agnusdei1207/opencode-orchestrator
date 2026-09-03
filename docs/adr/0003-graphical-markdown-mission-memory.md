# ADR-0003: Mission Memory as Markdown/JSONL/Canvas

Date: 2026-06-11 00:01 KST
Status: Accepted
Source: `docs/histories/2026/06/10/PLAN_GraphicalMarkdownMissionMemoryFusion_2026-06-10.md` (removed 2026-09-03; history in git)

## Context

Builder-private's graphical Markdown memory was useful, but importing its full
runtime architecture would exceed the plugin boundary. The orchestrator already
had a Markdown knowledge index and an autonomous `/task` mission loop.

## Decision

Adopt only the memory surface, connected through existing systems:

1. Persist mission evidence as bounded JSONL events under `.opencode/`.
2. Publish active mission state as Markdown (`.opencode/docs/brain/scratchpad.md`).
3. Publish an Obsidian-compatible Canvas graph (`.opencode/docs/brain/knowledge-map.canvas`).
4. Let the knowledge RAG index read mission memory naturally via `.opencode/docs/**/*.md`.
5. Control all behavior through OpenCode plugin options with working defaults.

## Consequences

- Small, verifiable runtime memory surface instead of a second runtime.
- Later memory work (ADR-0010, ADR-0012) builds on this surface.
