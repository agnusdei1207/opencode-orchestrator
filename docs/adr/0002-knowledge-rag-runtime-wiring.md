# ADR-0002: Knowledge RAG Runtime Wiring and SDK Alignment

Date: 2026-06-01 23:33 KST
Status: Implemented
Source: `docs/histories/2026/06/01/PLAN_KnowledgeRAGRuntimeAndSDKAlignment_2026-06-01.md` (removed 2026-09-03; history in git)

## Context

The Second-Brain modules existed but were not connected to the runtime path the
model actually uses, and the plugin referenced a hook outside the official SDK
surface — so the plan document did not describe a working system.

## Decision

- Wire Knowledge RAG Phase 5 into `experimental.chat.system.transform`
  (`src/plugin-handlers/system-transform-handler.ts`).
- Remove `assistant.done` wiring (not part of the official SDK hook surface);
  bridge completed assistant turns from `message.updated` completion events.
- Re-run build, tests, and package dry-run before any commit or release.

## Consequences

- Plan and code re-aligned; SDK surface verified against
  `@opencode-ai/plugin` / `@opencode-ai/sdk` `1.15.13`.
- Precedent set: claims about SDK surface must be verified against installed
  package types, never assumed.
