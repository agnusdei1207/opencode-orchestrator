# Intent Analysis Router — Implementation Plan (Finalized)

Date: 2026-06-24 KST
Status: Design decisions locked. Implemented in this change.
Scope: The front-door router for the Commander only. Curator (A), on-demand (ReAct), and Meta-Commander (B) are out of scope.
Related: [REPORT_EbbinghausMemorySearchCurrentState_2026-06-24](../../histories/2026/06/24/REPORT_EbbinghausMemorySearchCurrentState_2026-06-24.md)

## 0. One-line goal

Replace "inject every context block on every turn" with "decide at the front door what this turn actually needs, then inject only those blocks."

## 1. Core design decisions (locked)

> **Decision 1 — Separate label count from context volume.**
> Intent labels (semantic, 5) and injected volume (profile, 3) are decoupled. Labels map down to a 3-tier context profile. Adding labels never adds injection branches.

```text
intent (5, semantic)  ──maps──▶  profile (3, volume)  ──▶  needs[] (gating)
```

| Profile | Auxiliary blocks injected | When |
| --- | --- | --- |
| **MINIMAL** | rag only | trivial turn |
| **STANDARD** | rag + scratchpad + background | mission context needed, no code/session step |
| **FULL** | rag + scratchpad + active-session + background | code work, mission step, ambiguous / low-confidence |

> **Decision 2 — Core blocks are never gated.**
> When a mission is active, `commander.systemPrompt` and the mission-loop block ARE the mission identity and are always injected. The router only gates the **auxiliary** blocks (scratchpad, active-session, rag, background). This makes it impossible for the router to strip the Commander's own instructions mid-mission.

> **Decision 3 — The router only reduces; when unsure it injects FULL.**
> It is an optimization, not a required component. Any doubt escalates to FULL.

> **Decision 4 — Consume-once decision, FULL fallback.**
> `chat.message` (the only place the user prompt text is visible) computes the decision and stores it. `system.transform` pops it exactly once. A `system.transform` with no pending decision (e.g. a mission auto-continuation turn that never went through `chat.message`) falls back to FULL — automatically safe.

> **Decision 5 — Phase 1 is 100% rules.**
> Local-first, zero latency, deterministic. Model fallback is an optional Phase 2 and the system is fully functional without it.

> **Decision 6 — `clarify` is not actively decided in Phase 1.**
> Ambiguity escalates to FULL instead of branching to a `clarify` label. Active `clarify` detection is deferred to Phase 2 (model present).

## 2. Where it runs and where it plugs in

```text
[chat.message hook]  src/plugin-handlers/chat-message-handler.ts
   - parts[].text → the only point with the raw user prompt
        | signals = { missionActive, sessionActive, isSlashCommand }
        | decision = classifyIntent(prompt, signals)
        | setRouterDecision(sessionID, decision)        // in-process store
        v
[experimental.chat.system.transform]  src/plugin-handlers/system-transform-handler.ts
   - decision = consumeRouterDecision(sessionID) ?? FULL_DECISION
   - core blocks always; auxiliary blocks gated by decision.needs
        v
output.system
```

Handler context: `EventHandlerContext { client, directory, sessions, state }`. The decision crosses the two handlers via an in-process store keyed by `sessionID` (consume-once), not via disk. Model calls (Phase 2 only) would use `client.session.prompt`.

Note on current wiring: `system.transform` already early-returns for non-mission sessions (nothing is injected when no mission is active). Therefore router gating has effect **only while a mission is active**, distinguishing a light mission turn (STANDARD) from a heavy one (FULL). Non-mission sessions remain byte-identical to today (no injection).

## 3. Interface (fixed boundary, stateless)

```ts
type Intent = "simple-qa" | "code-edit" | "planning" | "mission-step" | "clarify";
type ContextProfile = "MINIMAL" | "STANDARD" | "FULL";
type ContextNeed = "rag" | "scratchpad" | "active-session" | "background";

interface RouterSignals { missionActive: boolean; sessionActive: boolean; isSlashCommand: boolean; }

interface RouterDecision {
  intent: Intent;
  profile: ContextProfile;
  needs: ContextNeed[];
  route: "commander";        // delegation routing is out of scope
  confidence: number;        // 0..1
  source: "rule" | "model" | "fallback";
}

function classifyIntent(prompt: string, signals: RouterSignals): RouterDecision;
function setRouterDecision(sessionID: string, d: RouterDecision): void;
function consumeRouterDecision(sessionID: string): RouterDecision | null; // pop
const FULL_DECISION: RouterDecision;                                      // safe fallback
```

`system-transform-handler` keeps every existing `build*Prompt` builder and only wraps the **auxiliary** pushes in `if (needs.includes(...))`. Core pushes (`commander.systemPrompt`, mission-loop) stay unconditional under the active-loop branch.

## 4. Profile → needs (locked)

```text
MINIMAL  → ["rag"]
STANDARD → ["rag","scratchpad","background"]
FULL     → ["rag","scratchpad","active-session","background"]

post-filters (unchanged from today):
  - "active-session" only materializes when session.active === true
  - "background"     only materializes when running+pending > 0
```

intent → profile defaults:

| intent | default profile | note |
| --- | --- | --- |
| simple-qa | MINIMAL | floored to STANDARD if a mission is active |
| planning | STANDARD | |
| clarify | FULL | not produced in Phase 1 (ambiguity → FULL) |
| code-edit | FULL | high miss-risk → conservative |
| mission-step | FULL or STANDARD | heavy step = FULL, light step = STANDARD |

## 5. Rule classifier (Phase 1 — ordered, first match wins)

```text
0) router disabled                → no decision set → system.transform uses FULL
1) slash command                  → intent = mission-step|code-edit, FULL, conf 0.95
2) missionActive:
     - code signal OR sessionActive → mission-step, FULL,     conf 0.90
     - short + question, no code    → simple-qa,    STANDARD, conf 0.70  (mission floor)
     - else                         → mission-step, STANDARD, conf 0.75
3) !missionActive:
     - code signal                  → code-edit,    FULL,     conf 0.85
     - plan/design signal           → planning,     STANDARD, conf 0.70
     - short + question             → simple-qa,    MINIMAL,  conf 0.80
     - else                         → planning,     STANDARD, conf 0.60
4) confidence < 0.70               → escalate one tier (MINIMAL→STANDARD→FULL)
```

Signals (rule, local):
- **code signal**: path-like tokens (`/`, `.ts`, `.js`, …), code fences/diff, `function|class|import|const`, edit verbs ("fix/implement/refactor/bug/수정/구현/고쳐").
- **plan/design signal**: "plan/design/architecture/compare/structure/계획/설계/구조/비교".
- **question**: trailing `?` or interrogatives ("what/why/how/뭐/왜/어때/알려줘").
- **short threshold**: 120 chars.

## 6. Locked parameters

| Item | Value |
| --- | --- |
| Intent labels | 5 (semantic; reduced to profile for injection) |
| Context profiles | 3 (MINIMAL / STANDARD / FULL) |
| confidence threshold | 0.70 (below → escalate one tier) |
| short-prompt threshold | 120 chars |
| RAG MINIMAL cap | top 1–2 (retrieval cap change deferred to Phase 3; Phase 1 gates rag on/off only) |
| clarify Phase 1 | not decided → FULL |
| model fallback | Phase 2, 500 ms timeout, failure → FULL |
| route | fixed `commander` |

## 7. Safety (no-regression)

- Uncertain / exception / no pending decision → **FULL** (today's behavior).
- Feature flag `ORCHESTRATOR_ROUTER_DISABLED` → one-switch rollback.
- Core blocks (commander + mission-loop) never gated.
- code-edit / mission-step heavy turns always FULL → zero block loss on high-risk paths.
- Log `intent / profile / confidence / source` for distribution review.
- **Invariant guard (mission-start transition):** `system.transform` escalates any
  `MINIMAL` decision to `FULL`, because a mission turn is always floored to STANDARD
  by the classifier. A `MINIMAL` reaching the gate means the decision was computed
  before the mission activated (the first/transition turn), so it is escalated rather
  than allowed to trim mission context.
- **Bounded decision store:** the consume-once map is capped (1024) with oldest-entry
  eviction, so sessions that set a decision but never reach `system.transform` cannot
  grow it without bound.

## 8. Phased rollout

- **Phase 0 — gating skeleton (zero risk)**: wrap auxiliary pushes in `needs` checks with default = FULL → behavior byte-identical. *(folded into this change)*
- **Phase 1 — rule router**: `classifyIntent` + `chat-message-handler` wiring + consume-once store. *(this change)*
- **Phase 2 — model fallback (optional)**: only confidence < 0.70, 500 ms, failure → FULL; adds active `clarify`.
- **Phase 3 — observe & tune**: intent distribution, token savings, miss incidents → adjust mappings/thresholds; thread RAG cap for MINIMAL.

## 9. Test strategy

- `classifyIntent` golden unit tests: (prompt, signals) → expected (intent, profile, needs).
- Regression guard: router disabled / FULL path injects the same set as today.
- Assert zero auxiliary loss on code-edit / mission-step.
- Boundary cases: mission-active + short question (= STANDARD floor), short code signal (= FULL), 120-char boundary, slash command.

## 10. Out of scope

- Context Curator (A) compression, on-demand (ReAct) tools, Meta-Commander (B).
- RAG authority relocation (system → dynamic) — Curator stage.
- Decay formula changes; delegation routing (planner/worker route).
