# Memory Decay & Retrieval Wiring Activation — Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` (inline) or `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Metadata

- **Created**: 2026-06-21 KST
- **File Name**: `PLAN_MemoryDecayWiringActivation_2026-06-21.md`
- **Author**: orchestrator audit follow-up
- **Change Type**: Bugfix (wiring) — activates already-implemented Ebbinghaus/retrieval engine on the production data path
- **Risk Level**: MEDIUM (touches generated memory frontmatter + injection path)

**Goal:** Make the correctly-implemented Ebbinghaus decay model and role-weighted retrieval actually engage on the data the system generates, instead of remaining dormant.

**Architecture:** The scoring engine (`memory-scoring.ts`), lifecycle engine (`memory-lifecycle.ts`), and hybrid search (`hybrid-search.ts`) are mathematically correct and unit-tested. The gaps are all in *wiring*: generated notes are unconditionally pinned (`keep: true`), the injection path never passes a role, generated notes write an invalid `memory_kind`, and the maintenance entry point is never invoked. This plan fixes the wiring without changing the core math.

**Tech Stack:** TypeScript (Node 24, ESM), Vitest, Rust workspace (version-locked), npm packaging.

## Global Constraints

- Node.js `24+`; ESM modules with `.js` import specifiers.
- Do NOT re-derive decay constants or `memoryStrength()` — `memory-scoring.ts` stays the single source of truth.
- No new runtime dependencies.
- Disk-mutating maintenance stays **opt-in** (env-gated), default OFF.
- Cargo workspace version must stay in lockstep with npm version (asserted by `package-metadata.test.ts`).
- TDD: failing test first, minimal implementation, green, commit per task.

## Survey Evidence (audit findings A–E)

| ID | Finding | Evidence |
|:--|:--|:--|
| A | Every generated memory note is `keep: true` → `memoryStrength()` returns `1.0` and `planLifecycle()` protects it, so decay never engages on real data. | `mission-memory.ts:230`, `memory-scoring.ts:76`, `memory-lifecycle.ts:78` |
| B | Production injection calls `buildPrompt(directory, query)` with no role → always `NEUTRAL_WEIGHTS`. | `system-transform-handler.ts:116`, `context-provider.ts:35,44` |
| C | `runMemoryMaintenance` is exported but never invoked anywhere; tier moves / archive / supersession never run in production. | `index.ts:22` (export only) |
| D | Access writeback (reinforcement) is env-gated OFF by default, and was additionally masked by A. | `context-provider.ts:48,164` |
| E | Generated notes write `memory_kind: "<level>"` (project/mission/task), which is not a `KIND_DECAY` key → always falls back to `0.03`. | `mission-memory.ts:241`, `memory-scoring.ts:30-37` |

**Design decisions (confirmed):**
- **A** → importance-based pinning: pin (`keep: true`) only when `importance >= 0.9`; otherwise omit `keep` so the note decays. Scratchpad stays pinned.
- **B** → thread role through `buildPrompt` (small change). The orchestrated session resolves to `commander` (neutral); the plumbing makes role-weighting live for planner/worker/reviewer sessions that route through the same provider.
- **C** → add an opt-in maintenance pass, env-gated (`OPENCODE_MEMORY_MAINTENANCE`), wired into `CleanupScheduler`, tier-only (no physical archive moves) by default.
- **Release** → patch version bump + commit + push. No `npm publish` in this environment.

**Baseline:** `npx vitest run tests/unit/knowledge tests/unit/mission-memory-knowledge.test.ts` → 54/54 passing.

---

## Phase 1 — Finding E: valid decay profile on generated notes

**Files:**
- Modify: `src/core/knowledge/mission-memory.ts` (`buildMemoryNoteContent`, add `decayProfileForLevel` helper)
- Test: `tests/unit/mission-memory-knowledge.test.ts`

**Interfaces:**
- Produces: helper `decayProfileForLevel(level: MemoryLevel): { kind: string; lambda: number }`
  - `PROJECT → { kind: "fact", lambda: 0.006 }`
  - `MISSION → { kind: "workflow", lambda: 0.02 }`
  - `TASK → { kind: "episode", lambda: 0.07 }`
  - default → `{ kind: "fact", lambda: 0.03 }`
- Generated frontmatter emits both `memory_kind: "<valid kind>"` and explicit `decay_lambda: <lambda>`.

- [ ] **Step 1: Write the failing test** — assert a generated MISSION note's frontmatter contains `decay_lambda: 0.02` and `memory_kind: "workflow"` (not `"mission"`).
- [ ] **Step 2: Run focused test, verify it fails** — `npx vitest run tests/unit/mission-memory-knowledge.test.ts`
- [ ] **Step 3: Implement** — add `decayProfileForLevel`; in `buildMemoryNoteContent` replace `memory_kind: "${entry.level}"` and `memory_layer` block with the profile-derived `memory_kind` + `decay_lambda` lines.
- [ ] **Step 4: Run focused test, verify green.**
- [ ] **Step 5: Commit** — `fix(memory): emit valid memory_kind + explicit decay_lambda on generated notes`

---

## Phase 2 — Finding A: importance-based pinning so decay engages

**Files:**
- Modify: `src/core/knowledge/mission-memory.ts` (`buildMemoryNoteContent`, add `PIN_IMPORTANCE_THRESHOLD`)
- Test: `tests/unit/mission-memory-knowledge.test.ts`

**Interfaces:**
- Produces: const `PIN_IMPORTANCE_THRESHOLD = 0.9`. The `keep: true` line is emitted ONLY when `entry.importance >= PIN_IMPORTANCE_THRESHOLD`; otherwise omitted entirely.

- [ ] **Step 1: Write two failing tests** — (a) a note with `importance: 0.5` has NO `keep:` line in its frontmatter; (b) a note with `importance: 0.95` still contains `keep: true`.
- [ ] **Step 2: Run focused test, verify fail.**
- [ ] **Step 3: Implement** — build the frontmatter line array conditionally; only push `"keep: true"` when `entry.importance >= PIN_IMPORTANCE_THRESHOLD`.
- [ ] **Step 4: Add a decay-integration test** — construct frontmatter for a low-importance note with `last_accessed` 60 days in the past and assert `memoryStrength(metadata, now) < 0.9` (proves the engine now actually decays generated-style notes). Import `memoryStrength` from `memory-scoring.js`.
- [ ] **Step 5: Run focused tests, verify green.**
- [ ] **Step 6: Commit** — `fix(memory): pin generated notes by importance so Ebbinghaus decay engages`

---

## Phase 3 — Finding B: thread role through the injection path

**Files:**
- Modify: `src/plugin-handlers/system-transform-handler.ts` (`buildKnowledgeContextPrompt` + call site)
- Test: `tests/unit/knowledge` (new focused test on `context-provider` role plumbing) and/or `tests/unit/system-transform-handler.test.ts`

**Interfaces:**
- Consumes: `KnowledgeContextProvider.buildPrompt(directory, query, role?)` (already accepts `role`), `weightsForRole` (already wired at `context-provider.ts:44`).
- Produces: `buildKnowledgeContextPrompt(directory, loopState, currentTask, role?)` forwards `role` to `buildPrompt`. The orchestrated session passes `"commander"`.

- [ ] **Step 1: Write a failing context-provider test** — index two crafted docs in a temp dir where role weights flip the top result between `planner` and `worker`; assert `buildPrompt(dir, query, "worker")` ranks the lexical-heavy doc first and `"planner"` ranks the graph-linked doc first.
- [ ] **Step 2: Run focused test, verify fail** (or confirm current neutral behavior differs).
- [ ] **Step 3: Implement** — add a `role` parameter to `buildKnowledgeContextPrompt`, default `"commander"`, and pass it into `buildPrompt`; update the call site (`system-transform-handler.ts:67`) to supply the resolved session role.
- [ ] **Step 4: Run focused tests + `system-transform-handler.test.ts`, verify green.**
- [ ] **Step 5: Commit** — `fix(knowledge): pass active role into RAG injection so role weighting is live`

---

## Phase 4 — Finding C: opt-in memory maintenance entry point

**Files:**
- Create: `src/core/knowledge/memory-maintenance-runner.ts` (`collectMemoryNotePaths`, `runMemoryMaintenancePass`)
- Modify: `src/core/knowledge/index.ts` (export new helpers)
- Modify: `src/core/cleanup/cleanup-scheduler.ts` (env-gated schedule)
- Test: `tests/unit/knowledge/memory-maintenance-runner.test.ts`

**Interfaces:**
- Produces:
  - `collectMemoryNotePaths(directory: string): string[]` — `.md` files under `getMissionMemoryNotesDirPath(directory)` (empty array if dir absent).
  - `runMemoryMaintenancePass(directory: string, opts?: { apply?: boolean; now?: Date }): MemoryMaintenanceResult` — collects paths and calls `runMemoryMaintenance({ root: directory, filePaths, dryRun: !opts?.apply, applyArchives: false, now: opts?.now })`.
- Consumes: `runMemoryMaintenance` (`memory-lifecycle.ts`), `getMissionMemoryNotesDirPath` (`mission-memory.ts`).

- [ ] **Step 1: Write failing test** — in a temp dir, write a non-`keep` memory note with `last_accessed` ~400 days ago (so strength → archive layer); call `runMemoryMaintenancePass(dir, { apply: true })`; assert the returned plan has a tier change to `"archive"` and the note's `memory_layer` was rewritten on disk.
- [ ] **Step 2: Run focused test, verify fail** (module missing).
- [ ] **Step 3: Implement** `memory-maintenance-runner.ts` and export from `index.ts`.
- [ ] **Step 4: Run focused test, verify green.**
- [ ] **Step 5: Wire into `CleanupScheduler`** — add a `memory-maintenance` schedule (every 6h) that runs ONLY when `process.env.OPENCODE_MEMORY_MAINTENANCE` is truthy (`"1"`/`"true"`), calling `runMemoryMaintenancePass(this.directory, { apply: true })`; wrap in try/catch + `log`. Default OFF (no env → not scheduled).
- [ ] **Step 6: Run `tests/unit/knowledge` + any cleanup-scheduler test, verify green.**
- [ ] **Step 7: Commit** — `feat(memory): add opt-in memory maintenance pass (env-gated, tier-only)`

---

## Phase 5 — Finding D: confirm reinforcement is now observable

**Files:**
- Test only: `tests/unit/knowledge/memory-lifecycle.test.ts` (or context-provider test)

**Rationale:** Writeback stays env-gated by design, but with Phase 2 done, reinforcement now affects scoring of non-pinned notes. Add a regression test proving the loop.

- [ ] **Step 1: Write test** — load a non-`keep` note; capture `memoryStrength` before; call `MemoryLifecycle.recordAccess` N times; reload; assert `access_ema`/`access_count` increased AND `memoryStrength(after) > memoryStrength(before)` for the same `now`.
- [ ] **Step 2: Run, verify green** (should pass given engine correctness; this guards the wiring).
- [ ] **Step 3: Commit** — `test(memory): guard recall reinforcement raises strength on unpinned notes`

---

## Phase 6 — Refactoring & full re-audit (전수조사)

**Files:** repo-wide (read-mostly; small DRY refactors only)

- [ ] **Step 1:** Re-read every modified file end-to-end; confirm no duplicated decay logic leaked outside `memory-scoring.ts`.
- [ ] **Step 2:** DRY pass — if Phase 1/2 introduced repetition in `buildMemoryNoteContent`, extract a single frontmatter-line builder. No behavior change.
- [ ] **Step 3:** Full suite — `npm run build && npx vitest run` → expect all green. Record counts.
- [ ] **Step 4:** `git diff --check` (whitespace) and a grep audit: `grep -rn "keep: true" src` and `grep -rn "buildPrompt(" src` to confirm no remaining always-pinned generated notes or role-less call sites beyond the intended commander default.
- [ ] **Step 5:** Update `docs/KNOWLEDGE-SEARCH-DEEP-DIVE.md` §10 and README highlight wording if any claim now diverges from behavior (e.g., note the env-gated maintenance + importance-pin policy).
- [ ] **Step 6: Commit** — `refactor(memory): DRY frontmatter builder + docs sync after decay wiring`

---

## Phase 7 — Version patch + commit + push

**Files:** `package.json`, `package-lock.json`, `README.md`, `Cargo.toml`, `Cargo.lock` (all via script)

- [ ] **Step 1:** Ensure clean worktree (`git status --porcelain` empty) — all Phase 1–6 work committed first (`release-version.mjs` asserts cleanliness).
- [ ] **Step 2:** Run `node scripts/release-version.mjs patch` → bumps `1.6.3 → 1.6.4` across npm + README + Cargo, stages and commits the version bump. (If `cargo` is unavailable in the environment, bump `Cargo.toml`/`Cargo.lock` manually to match and commit.)
- [ ] **Step 3:** Verify `npx vitest run tests/unit/package-metadata.test.ts` passes (npm/Cargo version match).
- [ ] **Step 4:** `git push origin main`. Do NOT run `npm publish` / `release:patch` here.
- [ ] **Step 5:** Report final state: version, commits, test counts, push result.

---

## Risk Points

| Location | Risk | Mitigation |
|:--|:--|:--|
| `mission-memory.ts` frontmatter | Removing `keep` could let important notes archive | `PIN_IMPORTANCE_THRESHOLD = 0.9` keeps high-value notes pinned; maintenance is opt-in |
| `CleanupScheduler` | Accidental disk mutation | Env-gated, `applyArchives: false` (tier-only, no physical moves) |
| Role threading | Commander is neutral → no visible change for orchestrated session | Plumbing-only; tested at provider level where non-neutral roles differ |
| Version bump | Cargo/npm version drift | `release-version.mjs` updates both; `package-metadata.test.ts` asserts match |

## Self-Review

- Spec coverage: A→P2, B→P3, C→P4, D→P5, E→P1, refactor/audit→P6, release→P7. ✅
- No placeholders: each phase names exact files, helpers, thresholds, and commands. ✅
- Type consistency: `decayProfileForLevel`, `PIN_IMPORTANCE_THRESHOLD`, `collectMemoryNotePaths`, `runMemoryMaintenancePass` referenced consistently across phases. ✅
