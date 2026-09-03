# ADR-0008: Builder Learnings Adoption Assessment

Date: 2026-06-19 12:13 KST
Status: Implemented
Source: `docs/histories/2026/06/19/PLAN_BuilderLearningsAndAdoptionAssessment_2026-06-19.md` (removed 2026-09-03; history in git)
Report: `docs/histories/2026/06/19/REPORT_BuilderLearningsAdoption_2026-06-19.md`

## Context

Builder-private contained transferable engineering practices, but only the
generalizable parts belong in this plugin — never the domain-specific runtime.

## Decision

- ADOPT: prompt template system (highest ROI); snapshot testing for prompt/contract output.
- ADAPT: evidence-artifact model with richer continuation gates; weak-model hardening (post-verification self-review + escalation); schema-driven config.
- DEEPEN: memory frontmatter + horizons + phase-aware reranking; JSON-repair for model output.
- Rule: take the lesson, not the code.

## Consequences

- Shortlist steered subsequent prompt-system and verification work.
- Anything already present in the orchestrator was explicitly excluded from adoption.
- Promoted to Implemented 2026-09-03: prompt template system (`src/shared/prompt/`)
  with snapshot tests, evidence store (`evidence.ts`, header cites this ADR), and
  JSON repair (`safe-json.ts`) verified in the tree.
