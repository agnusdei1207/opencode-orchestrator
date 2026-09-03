# Local Search & Memory Enhancement — Completion Report

> Implementation, audit, and integration report for the **opencode-orchestrator** local-first memory work proposed in `LOCAL_SEARCH_ENHANCEMENT_PROPOSAL.md`.

---

## Metadata

| Field | Value |
|:------|:------|
| **Date** | 2026-06-19 23:50 KST |
| **Project** | opencode-orchestrator (TypeScript / Node.js) |
| **Companion proposal** | `docs/proposals/2026-06-19/LOCAL_SEARCH_ENHANCEMENT_PROPOSAL.md` |
| **Scope shipped** | Part 3 / Proposal 13 — *Local Ebbinghaus Memory OS* (read-path), plus the safe integration of bi-temporal scoring, lifecycle, and tombstone supersession |
| **Status** | ✅ Implemented, audited, hardened, and verified (54 tests green, typecheck clean) |
| **Constraints honored** | No GPU · no external model · no external API · CPU-only · local-first |

---

## 1. Executive summary

The proposal is a multi-part roadmap (search Proposals 1–7, memory-decay Proposals 8–12, and the Local Ebbinghaus Memory OS in Proposal 13). **What was actually delivered in this cycle is the memory system**: a local-first, Ebbinghaus-inspired memory model that gives every note a *strength* which decays over time, is reinforced by recall, and is de-referenced rather than deleted when it fades.

An independent audit found the core implementation correct and well-tested, but surfaced one high-severity safety issue and several consistency gaps. All findings were resolved. The system now scores memory at query time, keeps decay math in a single source of truth, and keeps every disk-mutating or destructive behavior behind an explicit, default-off opt-in.

The search-quality proposals (PageRank, proximity scoring, co-occurrence query expansion, ONNX embeddings, Learning-to-Rank — Proposals 1–7) remain **roadmap** and were intentionally not implemented in this cycle.

---

## 2. What shipped (Proposal 13, read-path)

| Capability | Status | Where |
|:-----------|:------:|:------|
| Bi-temporal frontmatter parsing (`memory_kind`, `memory_layer`, `event_time`, `ingestion_time`, `access_count`, `access_ema`, `importance`, `confidence`, `decay_lambda`, `valid_from`/`valid_to`, `supersedes`, `keep`) | ✅ | `src/core/knowledge/tag-indexer.ts` |
| Per-kind exponential decay `memoryStrength()` folded into the fused search score | ✅ | `src/core/knowledge/memory-scoring.ts`, `hybrid-search.ts` |
| Neutral `1.0` multiplier for non-memory notes (ordinary docs rank unchanged) | ✅ | `memory-scoring.ts` (`hasMemoryMetadata`) |
| Archive / `sensitive` / malicious / tombstoned exclusion from prompt injection | ✅ | `memory-scoring.ts` (`isPromptSafeMemory`), `hybrid-search.ts` |
| Bi-temporal supersession (close `valid_to`, inherit links, tombstone the old note) | ✅ (opt-in) | `memory-lifecycle.ts` |
| Tiered lifecycle (hot/warm/cold/archive moves) | ✅ (opt-in) | `memory-lifecycle.ts` |
| Generated mission-memory notes carry bi-temporal metadata | ✅ | `mission-memory.ts` |

### Decay model (single source of truth: `memory-scoring.ts`)

```
strength = clamp( quality * reinforcement * e^(-λ · ageDays), 0.05, 1.0 )

quality       = max(0.1, (importance ?? 1) * (confidence ?? 1))
reinforcement = 1 + log1p(access_ema ?? access_count ?? 0) / 4
λ             = decay_lambda ?? KIND_DECAY[memory_kind ?? "fact"] ?? 0.03
ageDays       = max(0, (now - (last_accessed ?? ingestion_time ?? now)) / 86_400_000)

keep === true               → 1.0
memory_layer === "archive"  → 0
valid_to < now              → × 0.35  (EXPIRED_MEMORY_MULTIPLIER)
```

`KIND_DECAY`: `sop 0.006 · workflow 0.010 · fact 0.018 · preference 0.020 · gotcha 0.030 · episode 0.070`.

---

## 3. Audit findings and resolutions

An independent read-only audit was performed against the proposal and the day's commits (`9a388f8` bi-temporal scoring, `3baa3da` lifecycle, `3c3648a` tombstones). Findings and fixes:

| # | Severity | Finding | Resolution |
|:-:|:--------:|:--------|:-----------|
| 1 | **High** | `recordAccess` ran on every search via `buildPrompt`, rewriting note frontmatter on disk — exactly the behavior the proposal said it would defer. Failures were silent. | Gated behind opt-in: `OPENCODE_MEMORY_WRITEBACK` env (`"1"`/`"true"`) **or** `new KnowledgeContextProvider({ enableAccessWriteback: true })`. **Default off — plain search never writes to disk.** The production caller constructs the provider with no args, so writeback is off in production. |
| 2 | Medium | `memoryStrength` and `KIND_DECAY` were duplicated in `hybrid-search.ts` and `memory-lifecycle.ts`, risking silent drift between search ranking and tiering. | Extracted a single canonical module `src/core/knowledge/memory-scoring.ts`; both files now import it. Behavior unchanged (verified by tests). |
| 3 | Medium | Lifecycle tier-moves and tombstone supersession had no production caller (orphaned), yet were destructive (physical file moves). | Exposed a single explicit entry point `runMemoryMaintenance(options)` (exported from `index.ts`) that defaults to `dryRun: true` (plan only) and performs moves only when `dryRun: false` is passed. Never wired into search/index. |
| 4 | Low | The proposal's "Implementation Reflection Update" section listed writeback, tier moves, and tombstones as *deferred*, but the commits implemented them; it also named `memory-consolidation.ts` for lifecycle (actually `memory-lifecycle.ts`); the named test file did not exist. | Proposal section rewritten to match shipped reality; file reference corrected; decay constants documented as living in `memory-scoring.ts`. |
| 5 | Note | Decay constants differed from the proposal's reference (`0.05` vs `0.03` clamp; quality defaults `1.0/1.0` vs `0.5/0.8`). | **Kept the shipped constants** as the single source of truth (see §5 rationale) and aligned the documentation to them, rather than changing runtime behavior. |

---

## 4. Verification

| Check | Command | Result |
|:------|:--------|:-------|
| Knowledge + mission-memory tests | `npx vitest run tests/unit/knowledge/ tests/unit/mission-memory-knowledge.test.ts` | **54 passed (9 files)** |
| Production-caller test | `npx vitest run tests/unit/system-transform-handler.test.ts` | **7 passed** |
| Type safety | `npx tsc --noEmit` | **exit 0, no errors** |

Tests confirm: kind-based decay, expired-memory demotion below neutral, neutral notes unaffected, sensitive-note exclusion, lifecycle tier transitions, supersession/tombstone, and bi-temporal mission-memory fields. With writeback unset, `buildPrompt` performs no disk writes.

---

## 5. Architecture optimality assessment

**Verdict: the adopted direction is near-optimal, with one structural exception that motivates a follow-up.**

What is well-chosen:
- **Query-time strength computation.** Decay is time-dependent, so it *must* be computed on read; precomputing would go stale. Correct.
- **Per-kind exponential decay + recall reinforcement.** Matches the Ebbinghaus / spacing-effect literature (FadeMem).
- **Bi-temporal model.** Separating "when a fact was true" (`event_time`) from "when it was learned" (`ingestion_time`) enables time-aware supersession; aligns with Zep/Graphiti.
- **De-reference, not delete.** The `0.05` strength floor plus archive/tombstone (not deletion) preserves recoverability and models human forgetting as *retrieval failure*.

The one structural weakness:
- **Volatile access stats live in durable content frontmatter.** `access_count` / `last_accessed` / `access_ema` are high-churn fields stored inside the `.md` content files. This is the root cause of finding #1: persisting reinforcement forces a content-file rewrite during search, pollutes git status, and couples ephemeral statistics to durable knowledge.
- **Recommended next step (not done this cycle, by design):** move volatile access stats to a **sidecar local index** (SQLite or a single JSON/NDJSON file), keeping durable semantics (kind, `event_time`, `importance`, `valid_*`) in frontmatter. Reinforcement then becomes a cheap local-index upsert that touches no content file and produces no git noise — at which point writeback could be safe to enable by default and the opt-in gate would no longer be needed.

Secondary note: multiplying strength into the fused score is a reasonable monotonic prior, but the `0.05` floor implies up to a 20× demotion; when Learning-to-Rank lands (roadmap), strength is better passed as a *feature* than as a hard multiplier.

---

## 6. Roadmap (intentionally not in this cycle)

- **Search quality (Proposals 1–7):** PageRank graph scoring, positional index + proximity bonus, co-occurrence query expansion, local hash / ONNX semantic channel, online weight learning, Learning-to-Rank.
- **Memory (Proposals 8–12):** richer tiered consolidation and autonomous A-Mem linking beyond the read-path shipped here.
- **Storage:** sidecar volatile-stats store (see §5).

---

## 7. Opt-in flags reference

| Flag / API | Default | Effect |
|:-----------|:-------:|:-------|
| `OPENCODE_MEMORY_WRITEBACK` (`"1"`/`"true"`) or `new KnowledgeContextProvider({ enableAccessWriteback: true })` | off | Persist access reinforcement (count / `access_ema` / `last_accessed`) to note frontmatter on search hits. Off → search never writes to disk; ranking unchanged. |
| `runMemoryMaintenance({ …, dryRun: false })` (optionally gated by `OPENCODE_MEMORY_MAINTENANCE`) | `dryRun: true` | Manually apply tier moves, archiving, and tombstone supersession. Never runs automatically. |

---

*Author: AI Agent · 2026-06-19 · opencode-orchestrator local-first memory completion report.*
