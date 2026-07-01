# Cognitive Memory-Kind & Episodic Capture — Adoption Assessment

Date: 2026-07-01
Scope: `opencode-orchestrator`
Source: recent `pentesting` (Builder) plans — `008_reality-check-episodic-mvp`, `009_ctf-parallel-subagent-dispatch`, `lab/final-episodic-parallel-dispatch-guide`
Companion prior round: `PLAN_BuilderLearningsAndAdoptionAssessment_2026-06-19` (items A–H already shipped)
Genre: same as the prior Builder assessment — every candidate is graded **ADOPT / WATCH / SKIP**, and grading is done **against the actual orchestrator code**, not against the source plan's claims.

---

## 0. Method & Guiding Constraint

Each item was checked against orchestrator source (file:line) before grading. The source plans
target a CTF pentesting runtime that *owns its turn loop*; orchestrator is an **OpenCode plugin**
and does not. So — as in the June round — anything requiring ownership of the model turn loop,
providers, permissions, or per-turn tool budgets is **SKIP** by construction.

The honest headline: **most of 008/009 is already present here, sometimes more maturely.** The
one genuinely new, high-value idea is the **cognitive memory-*kind* axis** and the episodic
capture/promotion loop that rides on it.

---

## 1. Current State (verified in orchestrator)

| Capability | Where | Verdict for this assessment |
| --- | --- | --- |
| Ebbinghaus strength + tiers | `core/knowledge/memory-scoring.ts` (`memoryStrength`, `layerForStrength`), `memory-lifecycle.ts` | Present |
| Bitemporal metadata | `event_time` / `ingestion_time` / `valid_from` / `valid_to` (`memory-lifecycle.ts:148,196`) | Present |
| Access reinforcement | `access_count` (`memory-lifecycle.ts:55-62`) | Present |
| Prompt-safety gate | `isPromptSafeMemory` excludes `privacy_class:sensitive`, `memory_layer:malicious`, tombstoned (`memory-scoring.ts:92-98`) | Present |
| Hybrid retrieval + role bias | BM25+tag+graph+RRF, `retrieval-weights.ts` (horizon: strategic/execution/closure) | Present |
| **Parallel dispatch** | `ParallelAgentManager` (`src/core/agents`), async agent tools (`src/tools/parallel`), `COMMANDER_PARALLEL` | Present |
| **Concurrency caps** | per-agent/provider/model limits (`core/agents/concurrency-config.ts`) | Present (more granular than 009) |
| Mission ledger | `core/loop/mission-ledger.ts` (jsonl event log) | Present (but not a *promotable* memory) |
| **Cognitive memory *kind*** (episodic/semantic/procedural) | — grep: none | **Absent → opportunity** |

---

## 2. Adoption Grades

### ✅ ADOPT

**A. Cognitive memory-*kind* axis (episodic / semantic / procedural).**
Orchestrator classifies memory by *strength tier* (`memory_layer`) and *horizon*
(strategic/execution/closure) but **not by Tulving kind**. Adding a `memory_kind` metadata field
lets retrieval and lifecycle be kind-aware: episodes decay fast, facts/procedures decay slow;
retrieval can prefer procedures for a Worker and facts for a Planner.
- *Why it fits*: purely additive metadata on the existing note model; composes with `horizon`
  and `memoryStrength` (kind → default decay λ, exactly like Builder's `default_decay_lambda`).
- *Risk*: low (new optional field; unknown kind = today's behavior).

**B. Episodic capture from the mission ledger.**
Orchestrator already records mission events (`mission-ledger.ts`: started / verification_failed /
completed / …) but never distills a **promotable episodic memory** into the retrieval corpus.
Adopt Builder's `build_episode_memory` shape: at `mission_completed`, distill objective + the
mission's tool/evidence trail + outcome into one `memory_kind: episodic` note (keyed by
objective + touched paths/targets).
- *Why it fits*: reuses the existing ledger + memory write path; no turn-loop ownership needed —
  it runs at the continuation/completion boundary the plugin already owns.
- *Risk*: low–medium (volume; mitigate with same-objective coalescing).

**C. Kind-promotion loop (episodic → semantic → procedural).**
With a kind axis, add the promotion Builder describes: repeated episodes → a semantic fact;
repeated *successful* sequences → a procedural playbook using the CTF-proven schema
(**prerequisites → commands → verification → failure pivots** — the "failure pivot" field is the
valuable, non-obvious part).
- *Why it fits*: runs inside the existing opt-in maintenance scheduler
  (`core/cleanup/cleanup-scheduler.ts`, `memory-maintenance-runner.ts`), off by default.
- *Risk*: medium (false promotion) → gate on a repeat threshold + keep originals (already
  "de-reference not delete").

**D. Promotion-time sanitization (extend the existing gate).**
Today's gate is *prompt-time* (block sensitive/malicious from the prompt). Builder's insight is
*promotion-time*: when an episode is promoted to the general (semantic) corpus, actively **strip
run-specific/secret strings** so the knowledge generalizes and no secret is embedded.
- *Why it fits*: extends `isPromptSafeMemory`'s neighborhood with a redaction step on the
  promotion path only; `privacy_class` is the existing hook.
- *Risk*: low.

### 🟡 WATCH

**E. Category-specialist parallel routing.**
009's value is routing independent subproblems to *category* specialists (web/pwn/crypto…). For a
general coding orchestrator there is no fixed category taxonomy, and Commander/Planner/Worker
already parallelize. Revisit only if a domain-specialization need emerges.

**F. Deterministic tool-output extraction.**
Builder's lab guide notes that raw tool output should be *extracted* (structured), not
LLM-summarized, to control context. Orchestrator's context bloat is milder (coding, not
nmap/ffuf floods) and sub-agent isolation already helps. Watch; adopt only if context pressure
is measured.

### ⛔ SKIP (already present or not plugin-owned)

- **Parallel dispatch engine + concurrency caps** — already implemented, more granularly
  (`concurrency-config.ts`: per agent/provider/model). Nothing to add.
- **Semaphore over `join_all`** (009 §safety) — orchestrator's manager already bounds
  concurrency; N/A.
- **CTF specifics** (`flag_check`, flag-format redaction, target-IP keying) — not applicable to a
  general coding orchestrator.
- **Turn-loop / provider / permission ownership** — OpenCode's, per the June constraint.

---

## 3. Phased Implementation (ADOPT items)

Order chosen so each phase is independently shippable and verified green (`tsc` + `npm test` +
`npm run build`, `CI=true`), matching the prior round's discipline.

| Phase | Item | Lands |
| --- | --- | --- |
| 1 | A | `memory_kind` added to note metadata + `memory-scoring` (kind→default decay λ); retrieval/lifecycle read it; unknown kind = current behavior (snapshot-locked). |
| 2 | B | On `mission_completed`, distill ledger+evidence → one `memory_kind: episodic` note via the existing memory writer; same-objective coalescing. |
| 3 | D | Redaction step on the promotion path (run-specific/secret stripping); extends the privacy gate. |
| 4 | C | Maintenance-scheduler pass: episodic→semantic (repeat ≥ N), episodic→procedural (success ≥ M) with the prereq/commands/verification/failure-pivot schema. Off by default. |

Each phase: `npx tsc --noEmit` (0), `npm run build` (0), `CI=true npm test` green, Rust
`cargo fmt --check` / `clippy -D warnings` / `cargo test` green if touched, committed
independently.

---

## 4. DoD

- [ ] `memory_kind` axis present and kind-aware in scoring + retrieval; existing prompt snapshots unchanged.
- [ ] Mission completion writes exactly one coalesced episodic memory note.
- [ ] Promotion path redacts run-specific/secret strings before a semantic note is written.
- [ ] Promotion loop gated on repeat/success thresholds, off by default, originals preserved.
- [ ] Full suite green (`tsc`/`build`/`test`, `CI=true`).

---

## 5. One-line Summary

> Orchestrator already owns parallel dispatch, concurrency caps, Ebbinghaus memory, and a
> prompt-safety gate. The one genuinely new, high-leverage import from the latest Builder work is
> the **cognitive memory-*kind* axis** (episodic/semantic/procedural) and the episodic
> capture→promotion loop that rides on it — everything else is already here or is OpenCode's to own.
