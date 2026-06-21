# ╔═══════════════════════════════════════════════════════════════╗
# ║   UNIVERSAL REFACTORING MASTER DOCUMENT  v5.2               ║
# ║   All languages · All sizes · Autonomous Agent Compatible   ║
# ╚═══════════════════════════════════════════════════════════════╝

> **Scope**: All programming languages · All project sizes · Autonomous Agent Compatible
> **Purpose**: Stabilization → Modulization → Refactoring → Readability → Structure → Quality → Safety

---

## ⚡ AGENT MANDATORY CONSTRAINTS — Must read and understand before starting work

```
┌─────────────────────────────────────────────────────────────────┐
│  All instructions in this document are MANDATORY. No exceptions. │
│                                                                 │
│  ❌ NEVER:  Assume "verified" based on grep/pattern matching      │
│  ❌ NEVER:  Modify code based on assumptions                    │
│  ❌ NEVER:  Hallucinate — only direct line-by-line verification   │
│             of source code is accepted.                         │
│  ❌ NEVER:  Mix refactoring and feature additions in same commit │
│  ❌ NEVER:  Modify without declaring the scope                   │
│  ❌ NEVER:  Keep legacy code structure active if unused         │
│  ❌ NEVER:  Miss sync of related items (test, doc, types, etc.)  │
│             after source modification.                           │
│                                                                 │
│  ✅ ALWAYS: Survey entire project before starting (§0-0)        │
│  ✅ ALWAYS: Open actual code files and perform micro-tracing     │
│  ✅ ALWAYS: Verify system safety/connectivity/consistency (§POST)│
│  ✅ ALWAYS: Zero Backward Compatibility — must delete old code   │
│  ✅ ALWAYS: Zero Behavioral Change — 100% preserve behavior      │
│  ✅ ALWAYS: Write §REPORT after completing work (Report)         │
│  ✅ ALWAYS: Run §REVIEW after completing work (10-point review)  │
│  ✅ ALWAYS: Full Sync — synchronize all of the following:        │
│            · Test code (signatures, imports, assertions, fixture)│
│            · Type definitions (interface, enum, branded type)    │
│            · Constants/Config (update all references on rename)  │
│            · Documentation (README, ARCHITECTURE, CHANGELOG, ADR)│
│            · Import/export paths (including barrels)             │
│            · Environment variable and config file references     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project-Specific Reinforcement Rules — pentesting codebase only

> This section adds **project-specific mandatory rules** on top of the universal principles.
> Apply them immediately to the current codebase (`MainAgent` / pipeline / delegated runtime / prompt builder / TUI).

### A. Cohesion Decision Principles

- A module should, where possible, have **one primary reason to change**.
- However, **increasing cohesion is not itself the goal.**
- **Lowering coupling is generally valid as a direction, but increasing cohesion is not treated as an automatic correct answer.**
- Adopt a cohesion adjustment only after also reviewing the following:
  - Does the architectural boundary become clearer?
  - Do the extension points improve?
  - Do the operational/deployment/test units improve?
  - Does the future cost of change actually decrease?
  - Is there meaning beyond merely gathering related code in one place?
- In other words, **if increasing cohesion does not lead to a smaller interface, clearer boundaries, better extensibility, and lower operational change cost, it may not be the correct answer.**
- Even if local cohesion looks high, treat it as a bad refactoring if any of the following gets worse:
  - Independent deployability/replaceability
  - Clarity of runtime extension points
  - Team/operational ownership boundaries
  - Fault isolation and rollback scope
- Conversely, even if the reasons to change are not entirely identical, code may be kept together when the following are structurally justified:
  - It completes a single contract within the same architectural boundary
  - It shares the same deployment unit and fault-isolation unit
  - It must stably preserve the same extension point
- Treat a file as a decomposition candidate if it matches 2 or more of the following:
  - Performs state management + I/O + policy decisions together
  - Performs domain rules + UI formatting together
  - Performs runtime config interpretation + file I/O + default-value policy together
  - Handles scheduler + executor + result shaping all in one file
- However, do not force a merge if any of the following applies:
  - The current separation preserves an architectural boundary
  - The extension points are already well exposed as independent contracts
  - Test isolation gets worse when merged
  - Independent replaceability matters from a deployment/operations standpoint
- To keep broad names like `Manager`, `Helper`, `Processor`, `Runtime`:
  - You must be able to state the responsibility scope clearly in one line of documentation, and
  - That description must end without an "and."
- Cohesion decision criteria:
  - Is it modified together for the same reason?
  - Does it share the same test fixture?
  - Can it be described in the same domain language?
  - Does it have the same input/output boundary?
  - Should it be in the same deployment/operations boundary?
  - Does it share the same extension scenario?

### B. Coupling Reduction Principles

- High-level policy must not directly know low-level implementation details.
- Keep coupling reduction as a baseline principle.
- However, do not introduce unnecessary abstractions, excessive facades, or meaningless intermediate layers just to lower coupling.
- The best state is "low coupling + exactly as much clear cohesion as needed," not "separation at all costs" or "cohesion increase at all costs."
- Even though lowering coupling is always advantageous, perform cohesion adjustments only when system-level boundary and extensibility improvements are proven.
- Minimize string-based wiring:
  - If a string key is required, access it only through a constant or a typed registry
  - No adding free-form string dispatch
- Allowed inter-module dependency direction:
  - `platform -> agents -> engine -> domains/shared`
  - No reverse references
- Direct file-path coupling, `process.cwd()` coupling, and coupling that assumes a specific directory structure are forbidden when undocumented.
- If one module must know 3 or more internal shapes of another module, judge coupling as high and reduce it via a contract (interface/type/facade).

### C. No YAML / YML Principle

- **Do not use `yaml` / `yml` as a new runtime source of truth.**
- Configuration on the operational path must be managed in a **code (TypeScript) based** form.
- The only allowed baseline:
  - `src/agents/runtime-config.ts`
  - typed accessor / validator
  - compile-time importable constants/objects
- Forbidden:
  - Reviving `pipeline.yaml`
  - `.yml` / `.yaml` based prompt wiring
  - Structures that only break at runtime after string parsing
  - A state where the docs claim it is code-based but a YAML loader actually governs the operational path
- Exceptions:
  - Test fixtures
  - A temporary compatibility layer during migration
  - File exchange formats with external systems
  - Records in archive documents describing past structures
- Even so, an exception must never become the **operational source of truth**.

### D. Code-Driven Runtime Config Principles

- The criterion for configuration is "it is guaranteed by types," not "it exists in a file."
- Runtime config must satisfy the following:
  - A type definition exists
  - An accessor exists
  - It fails fast on an invalid reference
  - The reference point of the docs and the code is identical
- A config accessor must not overuse silent defaults.
- If a default value is needed:
  - You must be able to explain why the default is safe, and
  - A test must pin that default value.
- For path-based configuration, clarify the absolute/relative basis by considering packaging/deployment paths as well.

### E. Boundaries to Decompose First in This Project

- `MainAgent`: keep only orchestration and separate policy/execution/I/O post-processing
- pipeline loader/runner: separate the boundary between declaration interpretation and the execution engine
- prompt builder: separate layer interpretation, file loading, state formatting, and truncation policy
- delegated execution: no mixing of queue/scheduler/handoff/runtime/executor responsibilities
- config layer: finish env/runtime-config/path-resolution/default-policy validation in one place

### F. Documentation Principles

- A refactoring document must answer the following, not "what should we make pretty":
  - Which coupling is being broken
  - Which cohesion is being adjusted
  - Why that adjustment actually helps the architectural boundary and extensibility
  - Which source of truth is being removed
  - By which steps it is being moved and when the old code is deleted
- The document must state the following judgments explicitly:
  - Whether this change aims at a mere cohesion increase, or at improving boundaries/extensibility/operability
  - Whether there is a reason for deciding not to raise cohesion further
- Every structural-change document must include the following 5 items:
  - Current problem
  - Target boundary
  - Deletion targets
  - Step-by-step migration order
  - Verification items

### G. Progress Recording Principles

- For large refactorings, maintain a `Current Status Snapshot` or equivalent progress section in the plan document.
- The plan document should record not only future work but also the **structural changes completed as of today**.
- The "remaining work" written in the document must be kept up to date against the actual code.

---

## Section Preview

| # | Section | One-Line Summary |
|:---:|:---|:---|
| **§0** | Prerequisites | Full survey → build 0 errors → tests 100% pass → rollback secured |
| **§POST** | **Post-Execution Audit** | **Mandatory after work: full safety/connectivity/consistency survey** |
| **§1** | Stabilization | P0~P3 defect priority, acquire→use→release, error propagation, concurrency |
| **§2** | Flow Integrity | Verify Producer→Consumer 1:1 via micro-tracing, classify Dead Code |
| **§3** | Structural Refactoring | Separation of concerns, dependency direction, domain-first directories, layer consistency |
| **§4** | Code-Level Refactoring | Complexity ≤10, parameters ≤4, Magic Value 0, type safety |
| **§5** | Constants/Config | 4-layer classification, per-domain constant files, immutability/type derivation |
| **§6** | Comment & Doc | Keep only WHY and remove noise, issue number + deadline on TODO |
| **§7** | Readability | One meaning per line, uniform abstraction level, Happy path without indentation |
| **§8** | Test & Verification | Unit 70%, boundary values mandatory, Test-Source synchronization (Test Sync) |
| **§9** | Security & Safety | Scope guards, approval gates, sensitive data isolation |
| **§10** | Performance | Measure first, top 20% bottlenecks, no optimization that harms readability |
| **§11** | Execution Protocol | AUDIT→PLAN→EXECUTE→TEST→HARDEN→DOCUMENT→VERIFY |
| **§12** | Master Checklist | A~V 22-category checklist (for final verification) |
| **§13** | Domain-Driven Structure | 1 concept = 1 domain, ≤7 per folder, no direct cross-domain references |
| **§15** | Migration | Reverse DOWN mandatory, add→use→drop column order |
| **§16** | API Contract | SemVer, Breaking change definition, Deprecation sunset |
| **§17** | Dependency Management | Implementable in 50 lines? → external dependency unnecessary, adapter wrapping |
| **§18** | Production Safety | Feature flags, canary rollout, rollback within 5 minutes |
| **§19** | Monitoring | Baseline recording, same-workload comparison, 24-hour observation |
| **§20** | Technical Debt | Inventory management, reserve 15~20% per sprint, quarterly audit |
| **§21** | Legacy Code | Capture current behavior with characterization tests, then refactor safely |
| **§22** | Git Hygiene | type(scope): subject, atomic commits, PR ≤400 lines |
| **§23** | Prioritization | Priority = Pain/Effort, Hotspot first |
| **§24** | Type System | primitive→enum→branded→discriminated union, Parse don't validate |
| **§25** | Error Handling | Retry (idempotent only), circuit breaker, 5-layer fallback |
| **§26** | Concurrency | Avoid shared state → RW Lock → Actor → Channel → Mutex |
| **§27** | Configuration | CLI > env > local > shared > default, secrets only in vault/env |
| **§28** | Simplification | "Remove unnecessary complexity" → simplify or remove |
| **§M** | Modulization | Start from the smallest unit, in independent steps, after writing a modulization plan |
| **§REPORT** | **Work Report** | **Work completion report (metadata/status/sync/debt)** |
| **§REVIEW** | **Multi-Perspective Code Review** | **Full 10-perspective code review after §POST — executable** ← NEW |
| **§IMPROVE** | **Document Improvement Log** | **Tracking improvements to the document itself** |

---

## 🔴 MANDATORY EXECUTION RULES for every section:

```
# 0. thoroughly check! — never do superficial verification
# 1. [PRE]  Before work, perform a complete full survey of the entire project (§0-0)
#           Verify everything from the smallest dependency to structural/micro-flows
#           Understand every flow in detail: entry points · data flow · dependencies · dynamic registration/events/DI
# 2. [EXEC] Create the checklist document for that number and proceed while checking it off
# 3. [EXEC] For every check item, open the actual code file and perform Micro-Tracing
# 4. [EXEC] Judging "verified" via grep/pattern matching ❌ forbidden — only reading and tracing the actual code line by line is accepted
# 5. [EXEC] Prevent hallucination: no assumptions, only direct verification of source code is accepted
# 6. [EXEC] Zero Backward Compatibility:
#           After refactoring/modulization, old code/old structures no longer in use MUST be deleted.
#           Record the deletion order in the plan, in chronological detail, leaving nothing out. (thoroughly)
# 7. [EXEC] Zero Behavioral Change:
#           Proceed with refactoring/modulization only, without harming the existing flow. 100% behavior preservation.
# 8. [POST] After completing the work, MUST run §POST (full system safety verification)
# 9. [POST] After completing the work, MUST write §REPORT (report)
# 10. [POST] After completing the work, MUST run §REVIEW (10-perspective code review)
```

---

## 0. Prerequisites — mandatory conditions before starting refactoring

> ⚠️ **Do not start work unless the conditions below are met.**

**0-0. Full survey (★ absolute top priority — cannot be skipped)**
- Before work, perform a complete full survey of the entire project
- Verify everything from the smallest dependency to structural/micro-flows
- Targets to understand: entry points · data flow · inter-module dependencies · dynamic registration (Tool Registry, Event Emitter, DI) · Barrel/Entry point · generation-based flows (v1/v2)
- **No hallucination**: judging "verified" via grep ❌ — only opening files, reading directly, and tracing is accepted
- Verify connectivity · integrity · safety, all of them. thoroughly.

**0-1. State snapshot**: VCS clean · build 0 warnings · all tests 100% pass · rollback path secured · no vulnerable dependencies
**0-2. Scope declaration**: Target Module · Change Type · Expected Impact · Regression Risk · Rollback Strategy
**0-3. Prohibitions**: no modification without a scope declaration · no structural change without tests · no commit mixing refactoring + feature addition · no fixing a discovered bug without separate tracking
**0-4. Completion criteria**: all Master Checklist (§12) items ✅ · build 0 errors · tests 100% · 0 regression · docs updated · no performance degradation
**0-5. Reachability analysis**: dynamic registration mapping complete · external uses of Barrel/Entry point understood · generation-based flows understood · reachability analysis from entry points complete

---

## §POST. Post-Execution Audit — mandatory full survey after work completion

> **⚠️ Must run after completing any work (refactoring · modulization · feature addition · deletion, etc.). Cannot be skipped.**
> **The more changes there are, the more important this step is. No hallucination check — perform the full survey directly.**
> **⚠️ Full Sync mandatory: synchronize everything affected by the source change (tests · types · constants · docs · imports, etc.) without omission.**

```
【Full system safety/connectivity/consistency survey checklist】

▸ Safety
  □ 0 points referencing deleted code (Dead reference 0)
  □ 0 consumers missing migration to the new structure
  □ Build 0 errors · static analysis 0 errors
  □ All tests 100% pass (regression 0)

▸ Connectivity — open the actual code and trace line by line. No grep.
  □ All import/export paths traced
  □ Dynamic wiring (Registry/event/DI/string dispatch) traced
  □ Barrel/Entry point public API consistency confirmed
  □ Producer→Consumer field 1:1 matching re-verified
  □ Orphan code (missing wire-up) 0

▸ Consistency
  □ Naming conventions for new modules/files fully unified
  □ Layer structure consistency maintained (Presentation/Business/Infrastructure)
  □ All constant/type references point to current definitions
  □ Docs (README/ARCHITECTURE/CHANGELOG) reflect the current structure

▸ Full Sync — synchronize every item affected by the source change
  □ Test code: signatures · imports · assertions · fixtures reflect the current source
  □ Orphan tests 0 (immediately delete tests corresponding to deleted source)
  □ Missing tests 0 (a test exists for each newly added public function)
  □ Type definitions: update all references when interface · enum · branded type change
  □ Constants/config: update all consumer import paths on move/rename
  □ Environment variables/config files: synchronize test config and docs on change
  □ Mock/Stub: reflect the current contract (signature · return value)
  □ Docs (README · ARCHITECTURE · CHANGELOG · ADR): fully reflect the current structure

▸ Project impact analysis
  □ Full survey of upstream/downstream dependencies of the changed module
  □ Verify everything from the smallest dependency to structural/micro-flows
  □ Confirm no problems. If a problem is found, report immediately, then fix.
```

**→ After §POST, writing §REPORT and then running §REVIEW is mandatory.**

---

## 1. Stabilization

**1-1. Defect priority**: P0 (crash/security) immediately · P1 (business logic) same day · P2 (inefficiency) within the cycle · P3 (naming/style) separate commit

**1-2. Resource lifecycle**: guarantee acquire→use→release
- Acquisition failure → return an explicit error · exception during use → guarantee the release path · block reuse after release
- **Background Asset**: name by role (server/worker/watcher/daemon, etc.) · track the parent-child tree · auto-detect zombies/orphans · clean up immediately on completion
- **Process/thread**: terminate the parent after checking child state · drain the thread pool · SIGTERM/SIGINT handlers · graceful shutdown
- **Cleanup order**: reverse-dependency order · outer→inner order · shared resources last · isolate cleanup failures (try-catch)

**1-3. Error propagation**: propagate to the nearest "handleable layer" · no swallowing errors · include what+why+context in the message

**1-4. Concurrency stabilization**: data race → immutability/synchronization · deadlock → enforce lock order · starvation → fair scheduling

**1-5. Error classification**: recoverable/fatal × business/technical/external × transient/permanent
- Business+Permanent → return a domain error · Technical+Transient → retry+backoff · External+Transient → circuit breaker
- Include WHAT, WHY, WHERE, WITH WHAT, WHEN in every error

---

## 2. Flow Integrity

> **⚠️ Verify every flow by reading and tracing the actual code line by line. Judging "verified" via grep/pattern matching is absolutely forbidden.**

**Micro-Tracing**:
```
□ Open the producer function and list its output fields
□ Open the consumer function and list its input fields
□ Compare the two lists 1:1 — identify missing/mismatched/unused
□ Apply the same verification at every intermediate transformation step
□ Confirm schema agreement at the serialization↔deserialization boundary
□ Verify field access on every path of branch statements (if/switch)
```

**2-1. Call chain tracing**: enumerate entry points (API/Event/Cron/CLI) → trace branches to the end → identify unreachable code
**2-2. State transition completeness**: state all states/transitions · handle undefined transitions as errors · block further transitions from terminal states
**2-3. Boundary-crossing verification**: input validation (receiver side) · output contract (sender side) · session/auth re-verification · serialization schema compatibility · external call timeout · retry only when idempotency is guaranteed

**2-4. Dead Code classification & action**:
- Type A (completely unreferenced) → delete immediately
- Type B (always-false branch) → remove the condition, keep only the live branch
- Type C (orphan code = missing wiring) → **do not delete**, analyze the connection point then **wire it up**
  - ⚠️ However, if it is intentional removal (deprecation/sunset in progress), reclassify as Type D and handle accordingly
- Type D (generation residue) → **completely delete** v1 once v2 is fully operational
- Type E (Barrel/compatibility shim) → keep, document the reason

**2-5. Connectivity audit**: static import check · dynamic wiring (Registry/string dispatch/event listener/DI) · Barrel/Entry point check · generation audit

**2-6. Implicit Contract verification**:
- String-based matching → make it a constant (reference shared constants like sender/receiver)
- Function signature conventions → make the interface explicit
- Data schema conventions → define the schema explicitly, referenced by both sides
- Tool/AI registration → make tool names constants, auto-extract parameter names from code, verify the implementation exists at registration time
- Config-based wiring → verify the referenced target exists at load time

---

## 3. Structural Refactoring

**4 core principles**: ① Separation of concerns ② Domain isolation ③ Structural clarity ④ Extensibility

**3-1. Module decomposition**: 2 or more reasons to change → split · different users use different parts → split · test needs an unrelated dependency → extract
- **No splitting**: do not split methods sharing the same instance state · do not extract a function with only 1 consumer · do not split in a way that introduces a circular dependency

**3-2. Dependency direction**: only stable←volatile direction · circular dependency = structural defect, resolve immediately · no layer violations · isolate external dependencies behind adapters
- **Additional enforced rules (pentesting)**:
  - `MainAgent` is responsible only for policy orchestration and does not absorb individual execution details.
  - Prompt loading, runtime-config interpretation, and file path resolution are not performed directly in the agent body.
  - The UI layer does not couple directly to the internal state shape of the agent/engine but consumes it through dedicated adapters/hooks.
  - Any added registry string branch MUST be accompanied by constant-ization + existence verification + tests.

**3-3. Directory structure**: domain-first (no technology-type-first) · maximum depth of 4 levels · place related files adjacently · Barrel re-exports only the public API

**3-4. Layer consistency**: Presentation (parsing/validation only) · Business (pure domain rules) · Infrastructure (replaceable implementations) · Cross-cutting (separated into middleware)

**3-5. File naming**: no meaningless names (utils/helpers/misc) · 1 file = 1 class/1 module · delete empty folders · no 20+ files per folder

**3-6. Module boundaries**: vertical slicing (grouping by feature) · resources referenced by 2+ modules → move to shared · enforce layer reference direction · external library referenced in 3+ files → isolate behind an adapter

---

## 4. Code-Level Refactoring

**4-1. Function quality**: cyclomatic complexity ≤10 · parameters ≤4 · function length ≤40 lines · nesting ≤3 levels · minimize side effects

**4-2. Naming conventions**:
- Describe "what it does / what it is" · do not put "how" in the name
- No unnecessary abbreviations (only domain standards allowed) · Booleans require an is/has/can/should prefix
- No meaningless suffixes: Manager/Handler/Processor/Helper/Utils/Data/Base → replace with a concrete name

**4-3. Magic Value removal**: collect literals across the whole codebase → 8-way classification (event/role/command/limit/path/UI text/protocol/test) → make constants → verify
- Allowed exceptions: 0, 1, -1 (index), empty string, true/false — but make them constants if their meaning is unclear in context

**4-4. Type safety**: no implicit conversions · no any/void*/untyped · exhaustive Union/enum matching · explicit Nullable notation · validate types at external input boundaries

**4-5. Conditional quality**: Guard Clause (return on failure first) · Table Dispatch (5+ branches) · polymorphism · no double negation · extract complex conditions into functions

**4-6. Duplication removal**: identical → extract a function · same structure/different details → parameterize · only superficially similar/different domains → keep (comment the intentional duplication)

---

## 5. Constants/Config Architecture

**5-1. Classification**: Layer1 (environment config = runtime) · Layer2 (domain constants = business rules) · Layer3 (system constants) · Layer4 (language/framework default constants = no redefinition)
**5-2. File naming**: `{domain}.const.{ext}` · shared: `_shared/common.const.{ext}`
**5-3. Duplication removal**: same value exists in 2+ domains → move to `_shared/` · provide a unified import path via Barrel
**5-4. Type-safe constants**: guarantee immutability · preserve literal types · derive types from constants · objectify related constant groups · read-only arrays/sets
**5-5. Grouping**: group by meaning unit · SCREAMING_SNAKE_CASE · single entry point via Barrel
**5-6. Operational config principles (pentesting)**:
- Keep the operational source of truth as a single **TypeScript runtime config**
- Remove YAML/YML from operational config
- No direct access to a config field that has no accessor
- No state where config and docs use different terminology
- If the packaging path and the local development path differ, absorb it in the resolver layer so consumers are unaware of the path difference
**5-7. Config change protocol**:
- When adding a config field: reflect in the order type → runtime config → accessor → validation → test → docs
- When deleting a config field: proceed in the order remove consumers → remove fallback → remove tests → remove docs
- An unused fallback/default is not technical debt but a deletion target

---

## 6. Comment & Documentation

**6-1. Comment quality**: repeating what the code already says = noise → delete · keep only WHY/CONTEXT/WARNING/INVARIANT/PERF/HACK
**6-2. Format**: `// WHY:` `// INVARIANT:` `// WARNING:` `// HACK(#issue):` · function docs: summary+intent+parameters+return+exceptions
**6-3. TODO/FIXME**: issue number + deadline mandatory · no TODO without a deadline · quarterly audit
**6-4. Doc hierarchy**: README (install→run→verify, 100 lines or fewer) · ARCHITECTURE (topology/data flow) · CHANGELOG · ADR
**6-5. ADR**: 2+ technology options · a new dependency · a change in data/API strategy → write an ADR
**6-6. Logging**: FATAL/ERROR/WARN/INFO/DEBUG/TRACE · structured logs (JSON: ts, level, module, msg, context) · no logging of secrets/PII

---

## 7. Readability

- One meaning unit per line · chaining up to 3 levels · split into 4+ intermediate variables otherwise
- Uniform abstraction level within a function (no mixing high-level/low-level)
- Top→bottom reading order · Happy path without indentation · place related code adjacently · principle of least surprise

---

## 8. Test & Verification

**8-1. Pyramid**: Unit 70% · Integration 20% · E2E 10%
**8-2. Unit tests**: at least 1 per public function · boundary values mandatory (min/max/0/empty/null) · failure path mandatory · AAA pattern · state independence between tests

**8-3. Stress verification**: resource exhaustion → graceful rejection · concurrency conflict → data integrity · network degradation → retry/fallback · malicious input → validation failure + safe rejection

**8-4. Test files**: 1:1 correspondence with source paths · one consistent approach across the whole project

**8-5. Complexity budget**: cyclomatic complexity ≤10 · nesting ≤3 · parameters ≤4
- **File decomposition signals**: ① multiple reasons to change ② domain mixing ③ hard to name (utils, etc.) ④ data tables dominate the logic ⑤ requires scrolling
- **Guide ranges**: ≤200 ideal · 200~400 acceptable · 400~500 review (document the reason) · 500+ almost certainly needs splitting

**8-6. Test-Source synchronization (Test Sync)**:
```
□ On source change: impact analysis → signature sync → behavior sync → coverage sync → execution verification
□ On refactoring: on rename, update all test imports/assertions
              · on environment variable change, update test config
              · on type change, update all fixtures
              · on source deletion, immediately delete the corresponding test
□ Forbidden: passing but stale assertions · copying source constants into tests (use imports) · skipping tests during refactoring
```

---

## 9. Security & Operational Safety

- **Operational security**: clean up temporary files/resources immediately · no logging of sensitive information · resource isolation
- **Safety Guardrails**: scope guards (auto-verify the approved scope) · approval gates (high-risk operations) · resource quotas · input validation
- **Sensitive data management**: data integrity · encrypted storage · access control · confidentiality

---

## 10. Performance

- **Principles**: measure first · identify bottlenecks (top 20%) · prioritize algorithmic improvement · optimization that harms readability requires measurement evidence
- **Common bottlenecks**: unnecessary allocation → pooling · N+1 → batching · unnecessary copy → pass by reference · blocking IO → async · lock contention → fine-grained locks
- **Caching**: cache only when read>>write AND stale data is acceptable AND the computation is expensive · TTL mandatory · cache = temporary store

---

## 11. Refactoring Execution Protocol

**8 stages**:
| Stage | Name | Reference Sections |
|:---:|:---|:---|
| 1 | SURVEY (full survey) | §0-0, §0-5 |
| 2 | AUDIT | §2, §12B |
| 3 | PLAN | §0-2, §M-2 |
| 4 | EXECUTE | §4, §5 |
| 5 | TEST | §8 |
| 6 | HARDEN | §9 |
| 7 | DOCUMENT | §6 |
| 8 | VERIFY | §POST, §12V |

- On finding any anomaly, stop immediately → report → wait for instructions

**11-4. Code-Driven Runtime Migration Protocol (pentesting)**:
```
1. Full survey of where operational YAML/YML is used
2. Promote the single real source of truth to a TypeScript object
3. Write the type definition + accessor + validation first
4. Switch all consumer read paths to the new accessor at once
5. Reduce the old YAML loader to a test/compatibility boundary only
6. Synchronize the docs' terminology and paths to the new structure
7. Delete old files/old branches/old fallbacks
8. Finally, prove via tests that "it can operate without YAML"
```

**Incremental vs bulk**: default = incremental (new implementation alongside the old → migrate consumers → remove old implementation) · bulk only when under 500 lines + all consumers can be updated simultaneously

**11-3. Execution flow verification (Anti-Hallucination)**:
```
EXECUTE (real data) → OBSERVE (actual output vs expected) → CORRECT (evidence-based fix) → RE-EXECUTE (100% pass)

4 categories of hallucination:
1. API Shape    : function signatures — must verify directly in the source code
2. Export Boundary: module public API (entry point/barrel file) — must verify directly
3. Data Flow   : actual mapping in constants/config files — must verify directly
4. State Shape : state interface/class definitions — must verify directly

Cross-module verification: import resolution · data flow · state mutation · events/messages · stability under stress
```

---

## 12. Master Checklist

### A. Stabilization
```
□ Asset role assignment · □ acquire-use-release proven · □ zombie/orphan auto-detection · □ error-propagation gaps 0 · □ data races 0 · □ external-call timeout/heartbeat
```
### B. Flow Integrity
```
□ Entry-point→exit call chain traced · □ all branches handled · □ orphan code 0 (wire-up complete) · □ generation residue 0 (v1 fully purged) · □ Dead code 0
□ Undefined state transitions 0 · □ boundary-crossing verification gaps 0 · □ Implicit contract consistency verified · □ verified via Micro-Tracing (not grep) · □ Producer→Consumer field 1:1 matching
```
### C. Structure
```
□ Circular dependencies 0 · □ single-responsibility violations 0 · □ layer violations 0 · □ directory depth ≤4 · □ external dependencies isolated behind adapters
```
### D. Code Quality
```
□ Magic value 0 · □ cyclomatic complexity ≤10 · □ principled file-length decomposition (§8-5) · □ nesting ≤3 · □ parameters ≤4 · □ implicit conversions 0 · □ any/untyped 0
```
### E. Naming & Readability
```
□ Every name describes its meaning · □ abbreviations only domain standards · □ consistent abstraction level within a function · □ Happy path without indentation · □ related code adjacent
```
### F. Comments & Docs
```
□ Noise comments 0 · □ WHY comments present · □ issue number + deadline on TODO/FIXME · □ README/ARCHITECTURE/CHANGELOG up to date · □ ADR complete
```
### G. Tests & Synchronization
```
□ A test exists per public function · □ boundary-value + failure-path coverage · □ state independence between tests · □ stress scenarios verified
□ All 100% pass · □ test imports → current source modules · □ function calls → current signatures · □ assertions → current behavior
□ Mock/Stub → current contract · □ environment variables → current config · □ constant/type references → current definitions · □ orphan tests 0 · □ missing tests 0
```
### H. Security & Safety
```
□ Input validation at external entry points · □ injection/resource-exhaustion vector check · □ approval gate/access-control policy · □ sensitive data encrypted/isolated · □ temporary data/processes auto-reclaimed
```
### I. Performance
```
□ Profiling-based bottleneck identification · □ N+1 problems 0 · □ unnecessary allocation/copy minimized · □ before/after benchmarks recorded · □ measurement evidence for readability-harming optimizations
```
### J. Operations
```
□ Version tag updated (SemVer) · □ CHANGELOG commit-hash links · □ build warnings 0 · □ CI/CD passing · □ rollback path verified
```
### K. Constant-ization
```
□ Magic string 0 · □ Magic number 0 · □ constant files separated by domain · □ shared constants in the shared directory · □ immutable declarations · □ types derived from constants · □ unified path via Barrel
```
### L. Domain Structure
```
□ Domain folder separation · □ identical standard structure · □ central registration/discovery via domain entry points · □ direct cross-domain references 0 · □ domain-specific resources isolated
```
### M. ADR & Logging
```
□ ADR exists for non-trivial architectural decisions · □ log-level standard compliance · □ structured logging (JSON) · □ no logging of secrets/PII · □ external system call logging
```
### N. Code Review & Caching
```
□ Code-review checklist followed · □ caching decision framework followed · □ TTL set on all caches · □ no N+1 query patterns
```
### O. Migration & API Contract
```
□ Schema migration backward-compatible or rollback plan · □ API SemVer · □ sunset timeline on deprecated APIs · □ Breaking change recorded in CHANGELOG
```
### P. Dependencies & Production Safety
```
□ Vulnerable dependencies 0 · □ external dependencies isolated behind adapters · □ feature flags on risky changes · □ rollback procedure tested/documented · □ incremental refactoring applied
```
### Q. Monitoring & Observability
```
□ Baseline recorded before refactoring · □ no degradation after refactoring · □ alerts set on critical paths · □ error rate/latency/throughput monitored · □ observation period completed with no anomalies
```
### R. Technical Debt & Legacy
```
□ Technical-debt inventory up to date · □ severity/cost/priority on debt items · □ characterization tests on legacy code · □ no modifying legacy without tests
```
### S. Git & Prioritization
```
□ Commit message standard (type(scope): subject) · □ atomic commits (1 logical change/commit) · □ PR ≤400 lines · □ priority = Pain/Effort · □ high-risk-high-reward first
```
### T. Type System, Error Handling, Concurrency, Config
```
□ Discriminated unions used · □ stringly-typed APIs 0 (enum/branded type) · □ retry/circuit-breaker patterns · □ shared mutable state protected · □ runtime config vs build-time constants separated · □ secrets only in vault/env
```
### U. Execution Flow Verification (Anti-Hallucination)
```
□ Modified execution paths run with real data · □ API shape hallucination 0 · □ Export boundary hallucination 0
□ Data flow hallucination 0 · □ State shape hallucination 0 · □ cross-module E2E tests · □ Execute→Observe→Correct evidence documented
□ Every error path has an actionable message · □ all tests pass · □ static analysis 0 errors · □ build 0 errors
```
### V. Post-Execution Full Survey (★ mandatory after work completion)
```
□ Full system safety/connectivity/consistency survey complete (§POST)
□ References to deleted code 0 (Dead reference 0)
□ All import/export paths traced (not grep — direct tracing)
□ Dynamic wiring (Registry/event/DI) traced
□ Project impact analysis complete · no problems confirmed
□ Docs (README/ARCHITECTURE/CHANGELOG) reflect the current state
□ Build 0 errors · tests 100% pass (final)
□ §REPORT written
□ §REVIEW (10-perspective code review) executed
□ §REVIEW P0·P1 findings fixed immediately
```

---

## 13. Domain-Driven Structure

- **Decomposition**: 1 business concept = 1 domain candidate · independently changeable → separate folder · has dedicated types/constants/logic → its own structure
- **Folder composition**: required (implementation+types) · optional (constants/data access/tests/entry point) · files per domain folder ≤7 · no direct cross-domain references
- **Entry point**: central registration · hide internal implementation · registry pattern when needed
- **Isolation**: horizontal isolation (no direct domain↔domain dependency) · vertical isolation (no domain→upper-layer dependency)

---

## 15. Migration & Data Schema

- A reverse (DOWN) is mandatory for every migration · backward-compatibility window · add→use→drop column order · backup verification before DROP · batch processing for large volumes

---

## 16. API Contract & Versioning

- SemVer (MAJOR.MINOR.PATCH) · Breaking change definition: removal/type change/required↔optional change/semantic change
- Deprecation: warning + sunset date · remove after at least 2 minors · provide a migration guide

---

## 17. Dependency Management

- Before adding: implementable in 50 lines or fewer? · does it pull in 10+ transitive dependencies? · actively maintained? · any vulnerabilities?
- Version lock (lockfile) · no "latest"/"*" in production · referenced in 3+ files → wrap with an adapter
- **Upgrade**: security audit → read the changelog → upgrade one at a time in isolation → full tests → staging verification → monitor after deployment

---

## 18. Production Refactoring

- **Feature flags**: risky refactoring behind a release flag · default = OFF · remove the flag within 2 sprints of full rollout
- **Rollout**: canary (1%→5%→25%→50%→100%) · rollback completed within 5 minutes · test rollback before deployment

---

## 19. Monitoring & Observability

- **Baseline recording**: error rate, latency (p50/p95/p99), throughput, resources, business metrics, build/test time
- **Verification**: compare with the same workload · error rate↓ · latency↓ (5% tolerance) · throughput↑ · observe in production for at least 24 hours

---

## 20. Technical Debt

- **Inventory**: ID, location, description, cause, severity, fix cost, risk of not fixing, owner
- **Repayment**: reserve 15~20% per sprint · opportunistic repayment (along with file work) · quarterly audit · debt ceiling → halt features when exceeded

---

## 21. Legacy Code Strategy

- **Characterization tests**: capture current behavior before changes · assert the actual output including bugs · update to correct behavior after refactoring
- **Seam**: identify object/preprocessor/link/interface seams → break dependencies → test → refactor safely

---

## 22. Git/VCS Hygiene

- **Commits**: `<type>(<scope>): <subject>` · subject ≤72 chars · imperative mood · WHY in the body · issue number in the footer
- **Atomic commits**: 1 logical change/commit · every commit passes build+tests · no mixing refactoring + behavior change
- **Branches**: ≤3 days · PR ≤400 lines · use stacked PRs

---

## 23. Refactoring Prioritization

- **Priority = Pain / Effort**

  | Scale | 1 (low) | 3 (medium) | 5 (high) |
  |:---|:---|:---|:---|
  | **Pain** | Occurs rarely, small impact | Occurs periodically, slows development | Occurs frequently, causes bugs/outages |
  | **Effort** | Done within 1 day | Done within 1 sprint | Requires multiple sprints |

  - Priority > 2.0 → immediately · 1.0~2.0 → next sprint · 0.5~1.0 → backlog · < 0.5 → accept

- **Hotspot**: high change frequency + high complexity = top-priority refactoring target

---

## 24. Type System Maximization

- Strengthen in the order primitive-type fixation → enum → branded type → discriminated union → phantom type
- boolean flag → union type · optional field → separate type · exhaustive matching · Parse, don't validate

---

## 25. Error Handling Patterns

- **Retry**: transient errors only · max 3~5 times · exponential backoff + jitter · idempotency required · no retry on 401/403/400/404
- **Circuit breaker**: CLOSED→OPEN→HALF-OPEN · per-dependency configuration · return fallback when OPEN · log + alert on state transitions
- **Fallback layers**: retry → alternative source → degraded response → queuing → graceful rejection

---

## 26. Concurrency Patterns

- Can shared state be avoided? → best · read-heavy → RW Lock · partitionable → Actor · pipeline → Channel · last resort → Mutex (ordering rule)
- Anti-patterns: lock-order violation · IO inside a lock · missing await · await inside a loop · check-then-act race

---

## 27. Configuration Management

- **Priority**: CLI args > environment variables > local config > shared config > app defaults
- **Secrets**: no secrets in code/config files/CI logs · only vault/encrypted env · replaceable without redeployment
- **Environment separation**: identical binary across all environments · only config differs · dev/staging≈production · validate required config at startup + exit immediately on failure

---

## 28. Simplification — removing unnecessary complexity

If there are excessive layers/processing/patterns not needed for behavior, simplify. Decision criteria:

| Signal | Action |
|:---|:---|
| 3 or more abstraction layers but each just passes through 1:1 | Remove the intermediate layers |
| An interface has only 1 implementation and no replacement plan | Remove the interface, use it directly |
| A config option exists but has never actually changed | Hard-code it and remove the config |
| A factory only calls a simple constructor | Remove the factory |
| A wrapper just delegates 1 method as-is | Remove the wrapper, reference directly |

> If you cannot clearly say YES to "is this complexity really necessary for the current requirements?", it is a removal target.

---

## §M. Modulization Protocol — dedicated modulization protocol

> **Purpose**: incremental modulization to improve extensibility/cohesion
> **Core principles**: start from the smallest unit · one at a time · as fully independent work · divide and conquer

### M-1. Modulization-specific prohibited/mandatory rules

```
❌ NEVER:  Attempt to modulize the entire system at once
❌ NEVER:  Start modulization without a plan
❌ NEVER:  Let old code coexist with the new structure without deleting it
❌ NEVER:  Proceed with modulization while changing existing behavior
❌ NEVER:  Judge "verified" via grep/pattern matching
❌ NEVER:  Declare a migration step complete without tests

✅ ALWAYS: Start after a full survey of the entire project
✅ ALWAYS: Begin with exactly the one thing that seems most urgent (small is fine)
✅ ALWAYS: Write the plan first → proceed while checking it off
✅ ALWAYS: Zero Backward Compatibility — old code MUST be deleted
✅ ALWAYS: Zero Behavioral Change — 100% behavior preservation
✅ ALWAYS: Confirm tests 100% pass after each migration step
✅ ALWAYS: Full Sync + §POST full survey after completion
```

### M-2. PRE-WORK — full survey before starting work

> ⛔ Do not start modulization unless the following is complete.

```
□ Enumerate all entry points (API/Event/Cron/CLI/DI)
□ Trace data flow — every branch from entry point to exit point
□ Understand inter-module dependencies — from the smallest to structural/micro-flows
□ Understand dynamic registration — Registry/Event Emitter/DI/string dispatch
□ Confirm the public API list of Barrel/Entry point
□ Detailed understanding of every flow complete — thoroughly
```

### M-3. Target selection

```
□ Select exactly the one thing that seems most urgent from an extensibility/cohesion standpoint
□ It need not be a large task — a small unit is also valid
□ State the selection reason in one line (why this one first)
```

### M-4. Writing the plan

> Create a new md file under the `task/` folder and use that document as the checklist.

```
□ State the As-Is structure (current code location, dependencies, current problems)
□ State the To-Be structure (new module boundaries, file/folder layout)
□ Chronological step-by-step execution plan — describe everything without omission (thoroughly)
   └─ For each step: describe in detail what is migrated/deleted, where, and how
□ Rollback method for each step
□ Include project impact analysis (upstream/downstream dependencies)
□ State the Zero Backward Compatibility deletion order chronologically
```

### M-5. Zero Backward Compatibility

- After modulization, old code/old structures **MUST be deleted**
- A full survey of the dependency chain is mandatory before deletion
- A missed deletion is not a "safety net" but structural contamination

### M-6. Zero Behavioral Change

- Perform only modulization, without harming the existing flow
- Confirm all tests 100% pass after each migration step
- On finding a behavior change, stop immediately → report → wait for instructions

### M-7. Migration execution order

```
1. Write characterization tests on the existing code (capture current behavior)
2. Create the new module structure (new implementation alongside the old code)
3. Migrate consumers to the new structure (one at a time)
   └─ During migration, synchronize related items immediately:
      · update test imports·assertions·fixtures to current paths/signatures
      · update all references on type·interface changes
      · update consumer import paths on constant moves
      · synchronize test config on environment variable·config changes
4. Confirm tests 100% pass after each migration step
5. Completely delete the old implementation + immediately delete orphan tests·types·constants
6. Run the final §POST full survey
```

### M-8. POST-WORK — mandatory full survey after modulization

```
▸ Safety
  □ Dead reference 0 (no references to deleted code)
  □ Build 0 errors · static analysis 0 errors
  □ All tests 100% pass

▸ Connectivity — trace the actual code line by line
  □ All import/export paths traced
  □ Dynamic wiring (Registry/event/DI) traced
  □ Orphan code 0

▸ Consistency
  □ Naming conventions fully unified
  □ Layer structure consistency maintained
  □ Constant·type references → current definitions
  □ Docs reflect the current structure

▸ Full Sync
  □ Test code reflects the current source · orphan tests 0 · missing tests 0
  □ All type·constant·config references updated
  □ Docs (README·ARCHITECTURE·CHANGELOG) fully reflect the current structure

▸ Project impact analysis
  □ Full survey of the changed module's upstream·downstream dependencies
  □ From the smallest dependency to micro-flows, all the way — thoroughly
  □ Confirm no problems. If a problem is found, report immediately, then fix
```

---

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# §REPORT. Work Completion Report
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> **⚠️ Write immediately after §POST. Then run §REVIEW. Neither section may be skipped.**
> **Include the report in the final commit or submit it as the PR Description.**

---

## REPORT-1. Work metadata

```
Work ID / PR number :
Branch              :
Work type           : [ ] Refactoring  [ ] Modulization  [ ] Bugfix  [ ] Feature  [ ] Docs  [ ] Other
Work scope          :
Worker              :
Started             :         Completed:
```

---

## REPORT-2. List of completed work

> Record only what was actually modified. State the reason for items that deviated from the plan.

| # | Work content | Target file/module | Change type | Result |
|:---:|:---|:---|:---|:---:|
| 1 | | | add/modify/delete/move | ✅/❌ |
| 2 | | | | |
| 3 | | | | |
| ... | | | | |

---

## REPORT-3. System status (§POST results)

```
Build             : [ ] ✅ 0 errors  [ ] ❌ has errors → reason:
Static analysis   : [ ] ✅ 0 errors  [ ] ❌ has errors → reason:
All tests         : [ ] ✅ n/n pass  [ ] ❌ failed → reason:
Regression        : [ ] ✅ 0  [ ] ❌ found → details:
Perf baseline cmp : error rate [before/after], p95 latency [before/after], throughput [before/after]
Rollback path     : [ ] ✅ verified  [ ] ❌ unverified → reason:
```

---

## REPORT-4. List of deleted items

> List of old code/files deleted per the Zero Backward Compatibility principle.
> If there is a missed deletion, add a commit immediately.

| Deletion target | Deletion reason | Replacement location |
|:---|:---|:---|
| | | |

---

## REPORT-5. Completed synchronization items (Full Sync)

```
[ ] Test code        : signatures·imports·assertions·fixtures all reflect the current state
[ ] Type definitions : all references updated for changed interface·enum·branded type
[ ] Constants/config : all consumer paths updated for moved·renamed constants
[ ] Environment vars : test config·docs synchronized for changed env vars
[ ] Mock/Stub        : reflects the current contract (signature·return value)
[ ] README           : reflects the current structure
[ ] ARCHITECTURE     : reflects the current structure
[ ] CHANGELOG        : this change recorded
[ ] ADR              : architectural decisions documented (where applicable)
```

---

## REPORT-6. Discovered issues & technical debt registration

> Items found during work but not included in this scope. Register immediately in the technical-debt inventory (§20).

| ID | Location | Content | Severity (P0~P3) | Recommended action |
|:---|:---|:---|:---:|:---|
| DEBT-001 | | | | |
| DEBT-002 | | | | |

---

## REPORT-7. Discovered issues & technical debt registration

> Items found during work but not included in this scope. Register immediately in the technical-debt inventory (§20).

| ID | Location | Content | Severity (P0~P3) | Recommended action |
|:---|:---|:---|:---:|:---|
| DEBT-001 | | | | |
| DEBT-002 | | | | |

---

## REPORT-8. Next Actions

> Priority-based follow-up list derived after §REVIEW. State priority and owner.

| Priority | Content | Estimated size | Owner |
|:---:|:---|:---|:---|
| P0~P3 | | S/M/L | |

---

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# §REVIEW. Multi-Perspective Code Review   ← NEW
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> **⚠️ Run immediately after §POST + §REPORT. Cannot be skipped.**
> **This is "execution," not "suggestion." For each perspective, actually open the changed files and read them line by line.**
> **No reliance on grep·pattern matching·memory. Record only what you judged by looking at the code directly.**
> **If there are no findings, state "✅ No issues" explicitly. No blanks.**

---

## REVIEW-0. Review scope declaration

```
Review target files/modules : (full list of files changed in this work)
Review-excluded scope        : (unchanged legacy files, etc. — state the exclusion reason)
Reviewer                     :
Review base commit           :
```

---

## REVIEW-1. Perspective ① Correctness

> **"Does the code behave as intended?"**
> Verify that the implementation actually matches the requirements·design intent. Find behavioral errors, missing edge cases, and incorrect algorithms.

```
How to execute:
□ Read and verify the input/output contract of each changed function/method directly from the code
□ Trace that every path of branch statements (if/switch/ternary) returns the correct result
□ Check loop boundary conditions (off-by-one)
□ Trace null/empty/min/max handling paths
□ Check sections with order dependencies in async flows
□ Check the possibility of overflow·underflow·precision loss in numeric operations
```

**Findings**:

| Location (file:line) | Problem description | Severity | Recommended action |
|:---|:---|:---:|:---|
| | | P0~P3 | |

---

## REVIEW-2. Perspective ② Security

> **"How could an attacker abuse this code?"**
> Find input-trust boundaries, authentication·authorization bypass, data exposure, and injection vulnerabilities.

```
How to execute:
□ Trace where external input (HTTP request·file·environment variable·DB·message queue) is used without validation
□ Check string-concatenation patterns vulnerable to SQL/Command/LDAP/XPath injection
□ Check conditionals that allow Authentication bypass
□ Check internal API call paths missing an Authorization check
□ Check whether sensitive data (password·token·PII·card number) appears in logs·error messages·responses
□ External calls without timeout·retry → check DoS vectors
□ Check path concatenation vulnerable to Path Traversal
□ Check the possibility of type-confusion attacks at the serialization/deserialization boundary
```

**Findings**:

| Location (file:line) | Vulnerability type | Severity | Recommended action |
|:---|:---|:---:|:---|
| | | P0~P3 | |

---

## REVIEW-3. Perspective ③ Robustness

> **"How does the code break down under unexpected conditions?"**
> Find resource leaks, swallowed errors, unrecoverable states, and infinite loops/recursion.

```
How to execute:
□ Trace paths where an exception is thrown after acquire without release (file handle·DB connection·lock·socket)
□ Check where a try-catch block swallows the error (catch {}) and does not propagate it upward
□ Check whether recursive calls have a clear termination condition, and the possibility of stack overflow
□ Check memory-leak paths where event listeners·callbacks·Promises are not released
□ Check paths where the system is left in an inconsistent intermediate state on external service-call failure
□ Check blocking I/O without a timeout setting
□ Check whether error messages include WHAT/WHY/WHERE (actionable messages)
```

**Findings**:

| Location (file:line) | Problem description | Severity | Recommended action |
|:---|:---|:---:|:---|
| | | P0~P3 | |

---

## REVIEW-4. Perspective ④ Performance

> **"Where does the code pay unnecessary cost?"**
> No judging by a gut feeling that "it seems slow" without measurement. Record only clearly visible structural problems.

```
How to execute:
□ Check DB/external API calls invoked repeatedly inside a loop (N+1 pattern)
□ Check large-object copying·serialization inside a loop
□ Check paths where synchronous I/O blocks the event loop/thread pool
□ Expensive operations that repeatedly compute the same result (review whether caching is applicable)
□ Check patterns that unnecessarily load the whole collection and then filter (can a DB-level filter apply?)
□ Estimate the worst-case complexity (O notation) of recursion·nested loops
□ Check temporary objects repeatedly created on a memory-allocation hot path
```

**Findings**:

| Location (file:line) | Problem description | Estimated impact | Recommended action |
|:---|:---|:---:|:---|
| | | High/Medium/Low | |

---

## REVIEW-5. Perspective ⑤ Design & Architecture

> **"Does the structure of this code make future changes difficult?"**
> Find problems in coupling, cohesion, responsibility separation, and dependency direction.

```
How to execute:
□ Check whether a single function/class has 2 or more reasons to change (SRP violation)
□ Check circular dependencies where two modules reference each other directly
□ Check whether business rules are mixed into the Presentation layer
□ Check whether Infrastructure (DB·HTTP·file) directly depends on the Business layer
□ Check whether test-only branches were added to production code for testing
□ Check whether an abstraction layer merely wraps excessively without an actual replacement·extension need (§28)
□ Check whether the logic of two domains is mixed in one file
□ Check whether a common utility contains logic tied to a specific domain
```

**Findings**:

| Location (file:line) | Design problem type | Severity | Recommended action |
|:---|:---|:---:|:---|
| | SRP violation/circular dependency/layer violation/unnecessary abstraction/... | P0~P3 | |

---

## REVIEW-6. Perspective ⑥ Readability

> **"Can a teammate seeing this code for the first time grasp its intent within 30 seconds, 6 months from now?"**

```
How to execute:
□ Check whether names (variable·function·class·file) describe "what it is / what it does"
□ Check whether names use abbreviations·contractions·internal jargon that are unclear to those outside the domain
□ Check whether abstraction levels are mixed within a function (high-level logic + low-level implementation)
□ Check sections where nesting depth exceeds 3 levels
□ Check whether conditionals obscure intent with negation/double negation
□ Check noise comments that repeat what the code already makes obvious
□ Check non-obvious code without a WHY (magic-like numbers, unknown conditions)
□ Check sections where 2 or more side effects or meaning units are packed into one line
```

**Findings**:

| Location (file:line) | Problem description | Severity | Recommended action |
|:---|:---|:---:|:---|
| | | P0~P3 | |

---

## REVIEW-7. Perspective ⑦ Test Quality

> **"Does passing tests guarantee the correctness of the actual behavior?"**
> Verify the meaning and reliability of the tests, not the coverage number.

```
How to execute:
□ Check whether tests verify implementation details (internal state·private methods)
  → they should verify external behavior (I/O·side effects) to be safe for refactoring
□ Check whether asserts are tautologies that always pass
  e.g.: ending with only expect(true).toBe(true) / expect(result).toBeDefined()
□ Check whether boundary-value cases (0, -1, empty array, null, max) exist
□ Check whether error-path tests (exception raised·failure response) exist
□ Check whether Mock/Stub matches the current interface contract
□ Check order dependencies caused by state shared between tests (global variables·DB·files)
□ Check whether test names accurately describe "what they verify"
□ Check for traces of deleting or skipping tests without source changes
```

**Findings**:

| Location (test file:line) | Problem description | Severity | Recommended action |
|:---|:---|:---:|:---|
| | | P0~P3 | |

---

## REVIEW-8. Perspective ⑧ Type Safety

> **"Is the type system blocking runtime errors at compile time?"**

```
How to execute:
□ Check uses of any / unknown / object / untyped — point out unjustified uses immediately
□ Check where type assertions (as Type / type assertion / !) are used without an actual invariant
□ Check whether Union type · enum are exhaustively matched in switch/if branches (detect missing cases)
□ Check where Optional (nullable) values are accessed directly without a null check
□ Check whether external input (JSON.parse·HTTP body·DB row) has runtime type validation
□ Check whether the same concept is expressed with a primitive type (string/number) creating a confusion risk
  → review whether it can be replaced with a branded type / enum
□ Check whether generic type parameters are declared too broadly and lose type information
```

**Findings**:

| Location (file:line) | Problem description | Severity | Recommended action |
|:---|:---|:---:|:---|
| | | P0~P3 | |

---

## REVIEW-9. Perspective ⑨ Concurrency

> **"Does the code behave correctly in a parallel·async execution environment?"**
> Even in a single-threaded language, concurrency bugs occur in async code.

```
How to execute:
□ Check protection of concurrent access to shared mutable state (global variables·module-level cache·class fields)
□ Check where a missing await in an async function causes a Promise to be ignored
□ Check whether an await-in-loop pattern processes serially when it could be parallel (can Promise.all apply?)
□ Check the check-then-act pattern (sections where state can change between condition check → execution)
□ Check whether an event listener is registered multiple times, causing the handler to run several times
□ Deadlock possibility: check structures where two tasks each wait for the other to complete
□ Check boundaries where callback-based APIs and Promise/async are mixed, breaking error propagation
```

**Findings**:

| Location (file:line) | Problem description | Severity | Recommended action |
|:---|:---|:---:|:---|
| | | P0~P3 | |

---

## REVIEW-10. Perspective ⑩ Technical Debt

> **"How much does this code erode future development speed?"**
> Find structural problems that work right now but accumulate cost.

```
How to execute:
□ Full survey of TODO/FIXME/HACK comments lacking an issue number·deadline
□ Check functions·files·modules that, lacking a clear name, remain as utils/helpers/misc, etc.
□ Check complex logic that relies on behavior without tests (no characterization test)
□ Check the risk of broken sync where the same business rule is implemented in 2+ locations
□ Check sections with high replacement cost where an external library is imported directly in 3+ files without an adapter
□ Check sections where a short-term Workaround remains as if permanent code, without a comment
□ Check sections where a config value is hard-coded so per-environment changes require code modification
```

**Findings**:

| Location (file:line) | Debt type | Accumulated risk | Recommended action |
|:---|:---|:---:|:---|
| | | High/Medium/Low | |

---

## REVIEW-SUMMARY. Comprehensive summary

> Aggregate all results after completing the 10-perspective review. This summary becomes the input for §REPORT-8 next actions.

### Aggregate of all findings

| Severity | Count | Main locations |
|:---:|:---:|:---|
| P0 (needs immediate fix) | | |
| P1 (handle same day) | | |
| P2 (within this cycle) | | |
| P3 (separate commit·backlog) | | |

### Per-perspective result summary

| Perspective | Result | Main finding (1 line) |
|:---|:---:|:---|
| ① Correctness | ✅/⚠️/❌ | |
| ② Security | ✅/⚠️/❌ | |
| ③ Robustness | ✅/⚠️/❌ | |
| ④ Performance | ✅/⚠️/❌ | |
| ⑤ Design | ✅/⚠️/❌ | |
| ⑥ Readability | ✅/⚠️/❌ | |
| ⑦ Test Quality | ✅/⚠️/❌ | |
| ⑧ Type Safety | ✅/⚠️/❌ | |
| ⑨ Concurrency | ✅/⚠️/❌ | |
| ⑩ Technical Debt | ✅/⚠️/❌ | |

### Reviewer handoff points

> Compress into 3 or fewer the points the PR reviewer should especially focus on among P0·P1 items.

```
1.
2.
3.
```



---

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# §IMPROVE. Document Improvement Log  ← NEW
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

> **This section tracks the improvement history and known issues of the document itself (this master document).**
> **Section addition criterion**: an independent topic not coverable by existing sections + 2 or more real cases occurred.
> **Section consolidation criterion**: 70% or more content overlap, or it cannot stand on its own meaningfully.

---

## IMPROVE-1. v5.0 → v5.2 change history

| Version | Item | Change | Reason |
|:---:|:---|:---|:---|
| v5.1 | Added §REPORT | New work-completion report template | Prevent missed handoff·tracking after work |
| v5.1 | Added §IMPROVE | New section tracking document-self improvements | Prevent unbounded document bloat, make improvement history visible |
| v5.1 | Added §11 stage table | State reference section numbers for the 8 stages | Resolve the ambiguity of which section the agent should view at each stage |
| v5.1 | §23 Pain/Effort definition | Added a scale table (1/3/5) | Resolve unusability where only a formula existed without definitions |
| v5.1 | §28 Simplification expanded | Added a decision-criteria table | A single sentence lacked an execution criterion |
| v5.1 | §2-4 Type C clarified | Added an intentional-removal (during deprecation) exception condition | Resolve the ambiguity of the Type C / Type D boundary |
| v5.2 | §REPORT-7 redesigned | Removed the "improvement suggestion table" → consolidated into technical-debt registration | Suggestions are replaced by executable form in §REVIEW |
| v5.2 | Added §REVIEW | Added a 10-perspective executable code-review section | An exhaustive review that reads and acts on actual code after §POST, instead of "suggestions" |
| v5.2 | Removed §REPORT-9 | Reviewer checkpoints → consolidated into §REVIEW-SUMMARY | The §REVIEW comprehensive summary performs the same role more richly |

---

## IMPROVE-2. Known Issues

> Currently identified problems, to be resolved in future versions.

### 🔴 HIGH — immediate action recommended

**[ISSUE-001] LLM Context Bloat**

- **Symptom**: The whole document is a single file (~10,000+ tokens). If the agent loads the full text into context on every call, the token cost grows linearly, and middle instructions get diluted in a long context (the Lost-in-the-Middle phenomenon).
- **Measurement basis**: The current document is about 10,000+ tokens → 10 agent calls in a single work session consume 100,000+ tokens.
- **Recommended action**: Split into files by section group + the agent dynamically loads only the section relevant to the current stage.
  ```
  Example split structure:
  refactoring-core.md      (§0, §POST, §11, §12, CONSTRAINTS)
  refactoring-code.md      (§1~§10)
  refactoring-ops.md       (§15~§22)
  refactoring-advanced.md  (§23~§28)
  refactoring-report.md    (§REPORT, §IMPROVE)
  ```

**[ISSUE-002] Excessive Rule Redundancy**

- **Symptom**: Core rules like "no grep", "no hallucination", and "open the file and verify directly" are repeated at least 6 times across §CONSTRAINTS, §0-0, §POST, the §2 preamble, §11-3, and §12V. For the agent, the context-waste effect outweighs the emphasis effect.
- **Recommended action**: Define core rules only once in §CONSTRAINTS (top of the document). Replace the rest with `→ see §CONSTRAINTS`. Where repetition is needed, allow only a 1-line summary.

---

### 🟡 MEDIUM — resolve in the next version

**[ISSUE-003] §14 missing**

- **Symptom**: In both the table of contents and the body, §13 jumps to §15. It is unclear whether §14 was intentionally omitted or missed by mistake.
- **Recommended action**: If intentionally removed, also remove the §14 row from the table of contents. Decide whether the §14 slot can be reused when adding new content in the future.

**[ISSUE-004] §POST ≈ §12V overlap**

- **Symptom**: The §POST checklist and the §12 category V checklist are 90%+ identical in content. Reading both means duplicate processing; reading only one risks omitting the other.
- **Recommended action**: Replace §12V with a single line `→ see §POST`, or merge §POST into §12.

**[ISSUE-005] No document version-management system**

- **Symptom**: v5.1 is stated, but there is no history of what was added/removed/changed across v4→v5→v5.1. Teammates cannot track the changes.
- **Recommended action**: Accumulate each version's history in the §IMPROVE-1 form. Keep only the latest 3 versions' history in the body, and move older history to a CHANGELOG file.

---

### 🟢 LOW — backlog

**[ISSUE-006] Risk of unbounded document growth**

- **Symptom**: As of v5.0, §1~§28 + §M + §POST = 31 sections. With no clear section-addition criterion, there is a risk that sections keep growing each version. The larger the document, the worse [ISSUE-001] becomes.
- **Recommended action**: State "section addition criterion / consolidation criterion" at the top of §IMPROVE (done in v5.1). Keep the section count ≤35 at the quarterly document audit.

**[ISSUE-007] Ambiguous Dead Code Type C/D boundary**

- **Symptom**: Type C (orphan code = missing wiring) is do-not-delete + wire-up, while Type D (generation residue) is delete. However, code in progress of deprecation is intentionally disconnected and may be misclassified as Type C.
- **Recommended action**: Done in v5.1 — added the "intentional-removal (during deprecation) exception condition" to Type C (§2-4). Recommend adding a decision flowchart in a future version.

**[ISSUE-008] Missing link between §8-5 file-length criterion ↔ §4-1 function-length criterion**

- **Symptom**: §4-1 gives function length ≤40 lines and §8-5 gives file-length criteria (≤200/400/500), but the relationship between the two is not explained. The implicit arithmetic of 40 lines × 5 functions = 200 lines is not stated.
- **Recommended action**: Add a note to §8-5: "Applying the function ≤40-line criterion (§4-1), ≤5 functions per file is ideal."

---

## IMPROVE-3. Section count status

```
Current section count: 33 (§1~§28 + §M + §POST + §REPORT + §REVIEW + §IMPROVE)
Recommended ceiling:   ≤35
Next audit date: [updated quarterly]
```
