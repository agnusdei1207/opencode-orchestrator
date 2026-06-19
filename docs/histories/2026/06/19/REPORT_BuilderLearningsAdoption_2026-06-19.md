# Builder Learnings — Adoption Implementation Report

Date: 2026-06-19
Scope: `opencode-orchestrator`
Companion: `PLAN_BuilderLearningsAndAdoptionAssessment_2026-06-19.md`
Release: minor `1.6.0`

## 1. Summary

All recommended items (A, B, C, D, E, F, G, H) from the Builder adoption assessment were
implemented, phase by phase, each verified green (`tsc` + `npm test` + `npm run build`,
`CI=true`) and committed independently. Items marked WATCH/SKIP in the plan were correctly
left out because they require ownership of the model turn loop, providers, permissions, or
rendering — all owned by OpenCode, not the plugin.

Tests grew 713 → 747 (+34). No behavior of existing prompts changed (snapshot-locked).

## 2. What Shipped, By Phase

| Phase | Item | What landed |
| --- | --- | --- |
| 1 | B | Snapshot drift-guard over the 4 composed agent system prompts. |
| 2 | A | `prompts/registry.ts`: `composePrompt()` + `{{var}}` interpolation + `compact` model-tier profile; Commander/Planner/Worker/Reviewer compose through it (output byte-identical). |
| 3 | F | `utils/parsing/safe-json.ts` tolerant parser (fences/prose/trailing commas); applied to webfetch JSON bodies and (via jsonc-parser) hand-edited `agents.json`. |
| 4 | E | `knowledge/retrieval-weights.ts`: memory `horizon` (strategic/execution/closure) + role-aware engine weights; hybrid-search RRF accepts weights; memory notes carry `horizon`; context-provider takes an optional role. |
| 5 | C | `loop/evidence.ts`: observe `tool.execute.after` to record changed files vs verification runs; continuation appends a `<wiring_gate>` nudge when changes are unverified (never a hard block). |
| 6 | D | Continuation asks for a completion self-account; sustained stagnation (≥5) emits an `<escalation>` block (DECOMPOSE → RE-PLAN → ASK) instead of blind retries. |
| 7 | G+H | `config/options-schema.ts` Zod source of truth + tolerant parse + generated `opencode-orchestrator.schema.json` (drift-guarded, shipped); `tests/unit/layering.test.ts` forbids new `src/shared → src/core` imports. |

Commits: `fb36773` (A+B), `a15e4e7` (F), `8e3d432` (E), `8e2dbac` (C), `db16b9e` (D),
`c84672c` (G+H).

## 3. The Guiding Constraint (held)

Orchestrator is an OpenCode plugin, so Builder's "runtime owns adjudication" was adopted only
where the plugin genuinely owns the decision: the mission-loop **continuation** boundary
(C/D). All gates are nudges injected into the continuation prompt, never hard turn-level
blocks, so they cannot cause false "not done" loops. Provider abstraction, OS sandboxing,
per-turn tool budgets, streaming, and a second permission engine were left to OpenCode (plan
§7).

## 4. Verification

Every phase: `npx tsc --noEmit` (0), `npm run build` (0), `CI=true npm test` (green).
Rust untouched this round; `cargo fmt --check` / `clippy -D warnings` / `cargo test` remain
green. Final suite: 83 files / 747 tests.

## 5. Not Done (intentionally deferred — plan §6/§7)

Type-ahead queue consolidation, multi-model consensus, a semantic/embedding engine, and
recovery-route prioritization remain on the WATCH list; the SKIP items remain OpenCode's
responsibility. These are documented in the companion plan for a future decision.
