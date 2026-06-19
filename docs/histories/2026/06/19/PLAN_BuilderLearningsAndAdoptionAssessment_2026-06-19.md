# Builder Learnings & Adoption Assessment

Date: 2026-06-19
Scope: `opencode-orchestrator` (what to learn/adopt from the private `builder-private` runtime)
Status: Assessment for review — **no code committed**; this is a decision aid.
Author: investigation pass over `../builder-private`

## 0. How To Read This

This document answers one question: **what can opencode-orchestrator learn or adopt from
Builder?** Each candidate carries a verdict so you can decide quickly:

- **ADOPT** — net-new, high fit, clear win. Recommended.
- **DEEPEN** — we already have a basic version; Builder shows how to make it better.
- **ADAPT** — good idea, but must be reshaped to the plugin boundary (see §2).
- **WATCH** — valuable but premature / costly / uncertain fit. Revisit later.
- **SKIP** — does not fit a plugin, or OpenCode already owns it.

Nothing here is implemented. It is a menu, ordered by recommendation strength.

## 1. Method

Read-only full survey of `/mnt/c/workspace/builder-private` (25 Rust crates, ~185K LOC) via
four parallel audits (completion/verification, knowledge/memory, queuing/concurrency,
architecture/config/tools) plus direct reads of `ARCHITECTURE.md` and the deep-dive docs.
Every candidate cites a Builder source path. Orchestrator's current state was re-verified
from source on 2026-06-19.

## 2. The One Constraint That Shapes Everything

**Builder is a standalone runtime; orchestrator is an OpenCode plugin.**

Builder's central thesis — *"the runtime, not the model, owns routing, tool sandboxing,
verification, and completion adjudication"* (`ARCHITECTURE.md:5`) — works because Builder owns
the entire turn loop, tool dispatch, provider calls, and process sandbox.

Orchestrator does **not** own that loop. OpenCode owns: the model turn, tool execution,
provider/model selection, permissions, and rendering. Orchestrator only gets **hook points**:
`chat.message`, `tool.execute.before/after`, `session.idle` (via events), `experimental.chat
.system.transform`, `experimental.session.compacting`, and the `config` hook.

Consequence: Builder ideas split into three buckets.

1. **Fits the plugin directly** — anything about prompt construction, file-backed memory,
   the mission-loop *continuation* decision (orchestrator already owns this), and dev hygiene.
2. **Fits in a reduced "observe + nudge" form** — evidence capture (via `tool.execute.after`),
   completion gating (only at the continuation boundary, not mid-turn), tool-scope hints.
3. **Does not fit** — provider abstraction, OS sandboxing, streaming/rendering, owning the
   per-turn tool loop. OpenCode owns these.

This is why several impressive Builder systems are marked SKIP/WATCH below — not because they
are bad, but because the plugin cannot host them without becoming a competing runtime.

## 3. What Orchestrator Already Has (verified — don't reinvent)

A surprising amount of Builder's *knowledge layer* is already ported into
`src/core/knowledge/`:

| Orchestrator file | Builder counterpart |
| --- | --- |
| `graph-parser.ts` | `builder_knowledge/src/graph_parser.rs` (wiki-link graph) |
| `hybrid-search.ts` | `builder_knowledge/src/hybrid_search.rs` (lexical + graph; **no semantic engine**) |
| `tag-indexer.ts` | `builder_knowledge/src/tag_indexer.rs` (frontmatter tags) |
| `memory-consolidation.ts` | `builder_knowledge/src/memory_consolidation.rs` (fission/fusion/GC) |
| `scratchpad.ts` | `builder_knowledge/src/scratchpad.rs` |
| `mission-memory.ts` | scratchpad + `.canvas` writers |
| `context-provider.ts` | `unified_retrieval.rs` |

So the memory recommendations below are **DEEPEN**, not net-new.

What orchestrator does **not** have (verified): a prompt template engine (95 prompt `.ts`
string modules instead), schema-driven config (`zod` is a dep but used only in
`agent-registry.ts`; no exported `.schema.json`), a semantic/embedding retrieval engine, a
policy engine, and an evidence-artifact model for completion.

## 4. Recommended — ADOPT / DEEPEN (the shortlist)

### A. Prompt Template System — **ADOPT** (highest ROI)

- Builder: `crates/builder_app/src/template_engine.rs` + `templates/` (Handlebars partials) +
  `system_prompt.rs` (fluent `SystemPrompt` builder with `detect_prompt_profile()` for
  compact-vs-standard by model capability).
- Orchestrator today: 95 prompt strings hardcoded across `src/agents/prompts/**`.
- Why: prompts are the product. A partial-based template system makes them composable,
  diff-able, testable (snapshot), and lets us vary prompt by agent role / model capability
  without code edits. This is the single biggest maintainability win Builder demonstrates that
  we lack.
- Fit: **direct** (pure plugin-side concern). Effort: medium. Risk: low (output can be held
  byte-identical and snapshot-tested during migration).
- Suggested shape: `templates/*.hbs` (or `.md` with a tiny interpolator) + a `PromptRegistry`
  that composes partials from `{ agentRole, phase, modelTier, toolCount }`.

### B. Snapshot Testing for Prompt/Contract Output — **ADOPT** (pairs with A)

- Builder: `insta.yaml`, `builder_snaps`, `builder_test_kit`; snapshots cover prompt rendering,
  tool-call parsing, completion-proof construction.
- Orchestrator: vitest already in use; no snapshot coverage of rendered prompts.
- Why: makes the template migration (A) safe and freezes prompt wording against accidental
  drift. Cheap, high-leverage.
- Fit: direct. Effort: low.

### C. Evidence-Artifact Model + Richer Continuation Gates — **ADAPT** (high value)

- Builder: `control_plane.rs:367-389` (`AcceptanceGateKind`: Planning, Verification, Wiring,
  SelfReview, Consensus, ChallengeFollowup); `completion_obligation.rs` builds a proof of
  required-vs-missing artifacts; `plumbing_trace.rs:12-66` compares `changed_files` against
  `cited_paths` ∪ `files_accessed` and fails the gate on un-traced changes.
- Orchestrator today: `verifyMissionCompletion()` checks TODO completeness + `sync-issues.md`
  + a checklist file. It already owns the *continuation* decision, so this is the one place the
  "runtime adjudicates, model only proposes" idea genuinely fits.
- The adaptation: record structured **evidence artifacts** by observing `tool.execute.after`
  (files written, commands run, tests run) into mission state, then have the continuation
  decision require artifacts proportional to the claim — e.g. don't accept "done" if files
  changed this mission were never verified, or a broad claim cites only one file.
- Fit: **reduced form** — gates apply at the idle/continuation boundary, not mid-turn (we
  can't preempt a turn). Effort: medium. Risk: medium (must not cause false "not done" loops;
  gate it behind the existing interrupt guards).
- Start with one gate: a **wiring/verification trace** ("files changed but not verified") — it
  is the highest-signal, lowest-false-positive of the six.

### D. Weak-Model Hardening: Post-Verification Self-Review + Escalation — **ADAPT**

- Builder: `runtime_semantic_classifier.rs:305-341` (8-point self-review checklist enforced as
  a gate for weak models post-verification); `completion_adjudicator.rs:95-107` (on repeated
  same-obligation failure, **escalate** instead of replan).
- Orchestrator: no notion of model tier; continuation just re-injects "continue".
- The adaptation: when the configured model is a weaker tier, the continuation prompt can
  demand a short structured self-account (what changed / what was verified / residual risk)
  before accepting completion; after N stagnant iterations on the same unmet obligation,
  switch from "continue" to "escalate" (surface to user / suggest stronger model) instead of
  looping. Orchestrator already tracks `stagnationCount` — this is a natural extension.
- Fit: reduced form (prompt-level, not a hard runtime gate). Effort: medium. Value: directly
  attacks the "infinite continue" failure mode.

### E. Memory Frontmatter + Horizons + Phase-Aware Reranking — **DEEPEN**

- Builder: frontmatter `importance`/`keep`/`aliases`/`horizon` (`tag_indexer.rs:14-23`);
  context horizons strategic/execution/closure with exponential recency decay; phase-weighted
  reranking (`unified_retrieval.rs:153-235`) where lexical/semantic/importance/recency weights
  shift per phase.
- Orchestrator: has the graph + tag + hybrid-search port, but flat ranking and no horizon.
- The deepen: add `importance` + `horizon` + `keep` to generated memory frontmatter; rerank
  retrieved memories by the active agent role (Planner→semantic bias, Worker→lexical bias,
  Reviewer→fresh-evidence bias). Pure weight tuning over the existing index.
- Fit: direct (we own the files). Effort: low-medium. Value: better prompt context, fewer
  irrelevant memories.

### F. JSON-Repair for Model Output (TS side) — **DEEPEN / small ADOPT**

- Builder: `builder_json_repair` recovers malformed model JSON (unclosed quotes, trailing
  commas, code-fence wrapping, truncation) instead of hard-failing.
- Orchestrator: has `jsonc-parser` dep but no tolerant *repair* of model-produced JSON in tool
  arg parsing. (Note: we just hardened the *Rust* http parser in 1.5.3 — unrelated.)
- The deepen: a small `safeParseModelJson()` used wherever we parse model-authored JSON.
- Fit: direct. Effort: low. Value: resilience against weak-model formatting.

## 5. Take the Lesson, Not the Code — DEEPEN (cheap, structural)

### G. Schema-Driven Config — **ADAPT**

- Builder: Rust structs `#[derive(JsonSchema)]` → `builder.schema.json` (38KB), same shape in
  `.builder.toml` and an interactive `/config` UI; one source of truth.
- Orchestrator: plugin options parsed ad-hoc in `plugin-options.ts`; `zod` already a dependency.
- The adapt: model plugin options as `zod` schemas, export a `opencode-orchestrator.schema.json`
  for editor autocomplete, validate the plugin tuple at load with friendly errors.
- Fit: direct. Effort: medium. Value: fewer misconfigurations; self-documenting options. (Our
  config surface is small, so this is "nice to have", not urgent.)

### H. Layered Module Boundaries — **DEEPEN (lesson only)**

- Builder: strict DAG layers — Interaction → Facade → Coordination → Contracts(`builder_domain`,
  types only) → Capabilities → Persistence → Knowledge → Infra → Support (`ARCHITECTURE.md:69`).
- Orchestrator: after the 2026-06-19 Phase-3 flatten, `src/shared` is the de-facto contracts
  layer and `src/core` the coordination layer. The lesson: keep `shared` types-only and avoid
  `core → core` cycles (we already hit one such class of issue, `core↔tool`, during Phase 3).
- The deepen: adopt a lint/convention that `src/shared` never imports from `src/core`. No big
  restructure needed. Effort: low.

## 6. Not Now — WATCH

- **Type-ahead queue consolidation** (`intent_classifier.rs:400-485`): LLM-driven dedupe/preempt
  of queued user inputs. Brilliant, but OpenCode owns the input queue; a plugin can only see
  `chat.message`. Revisit only if OpenCode exposes queue control. **WATCH.**
- **Completion consensus (multi-model voting)** (`runtime_semantic_classifier.rs:343-372`):
  orchestrator *can* spawn subagents, so a niche "ultra-verify" panel is conceivable, but the
  cost/latency rarely justifies it for routine missions. **WATCH** (maybe a `/verify-hard` opt-in).
- **Semantic/embedding retrieval engine** (`builder_workspace_index/local_embedding.rs`, 768-dim
  hash embedding): would upgrade our lexical+graph search to true hybrid. Real value, but
  meaningful effort and our corpus (mission memories) is small. **WATCH** until memory volume
  justifies it; BM25 + graph (which we can add cheaply) likely suffices first.
- **Recovery-route priority ranking** (`recovery_routing/priority.rs`): elegant multi-tier
  failure prioritization. Only useful once we have the evidence/gate model (C). **WATCH**, pairs
  with C later.

## 7. Does Not Fit — SKIP (and why)

- **Provider abstraction** (`builder_provider_repo`, `builder_api`): OpenCode owns providers and
  model routing. Re-implementing it would fight the host. **SKIP.**
- **Policy-gated tool execution / autonomy lease / OS sandboxing** (`policies/engine.rs`,
  `AutonomyLease`, Landlock/seccomp): OpenCode owns the `permission` model; orchestrator already
  copies the global permission block into generated agents. A second policy engine would
  conflict. **SKIP** (defer to OpenCode permissions).
- **Streaming scrubber / markdown-stream renderer** (`builder_stream`, `builder_markdown_stream`,
  `builder_ratatui`): OpenCode owns the TUI and streaming. **SKIP.**
- **Per-turn tool-class gating & request/failure budgets** (`orch/limits.rs`, `orch.rs` loop):
  these govern Builder's owned turn loop, which we don't have. **SKIP** (the *continuation*
  budget we already model via iteration/stagnation counters).
- **Macro-based tool declaration** (`builder_tool_macros`): Rust proc-macro; TS decorator
  equivalent is not worth the ergonomic cost for our ~20 tools. **SKIP.**
- **Context compaction engine** (`compact.rs`): OpenCode owns `session.compacting`; orchestrator
  already injects mission context via the compaction hook. Builder's full sliding-window
  compactor is redundant here. **SKIP** (keep the hook we have).

## 8. Suggested Sequencing (only if you approve)

A natural low-risk order that front-loads the durable wins:

1. **B + A** — stand up snapshot tests, then migrate prompts to templates behind them.
2. **F** — `safeParseModelJson()` (tiny, independent).
3. **E** — memory frontmatter + horizon + role-aware rerank (deepen existing knowledge layer).
4. **C** — evidence-artifact capture via `tool.execute.after` + one wiring/verification gate.
5. **D** — weak-model self-review prompt + stagnation→escalate, building on C.
6. **G / H** — schema config + the `shared`-never-imports-`core` lint, as hygiene.

Items in §6/§7 are explicitly deferred.

## 9. Bottom Line

The biggest, safest wins are **prompt templating + snapshots (A/B)** and **deepening the memory
layer we already ported (E)**. The most *strategically interesting* idea — Builder's
runtime-owned completion adjudication (C/D) — is real and partly adoptable, but only at the
mission-loop continuation boundary, never as a full per-turn runtime, because orchestrator is a
plugin. Everything that assumes ownership of the turn loop, providers, permissions, or rendering
(§7) should stay with OpenCode.

Recommendation for review: green-light **A, B, E, F** as clear wins; treat **C, D** as a scoped
experiment behind the existing interrupt guards; hold **G/H** as hygiene; keep §6/§7 on the
watch list.
