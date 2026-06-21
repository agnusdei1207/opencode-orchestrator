# AGENTS.md

## Purpose
This file defines the mandatory operating rules for all agent work in this repository.
Apply these rules to code, documentation, analysis, design, review, and debugging.

---

## Core Rules
Work must be evidence-based.

Acceptable evidence:
- Opening a file and directly reading the relevant lines
- Running a command and directly observing the output
- Running tests and directly observing the results

What does NOT count as evidence:
- Memory
- Assumption
- Relying on pattern matching alone
- Relying on search results alone
- "It is probably correct"
- "It should work"

If you do not know something, say:
- `I don't know — I will open the file and verify.`

---

## Absolute Prohibitions
Never do any of the following:

- Claim you verified something without opening the relevant file
- Modify code based on assumptions
- Reference unverified functions, files, variables, paths, exports, types, or interfaces
- Skip impact analysis
- Skip post-work verification
- Change behavior during refactoring unless a behavior change is an explicit goal
- Leave dead code behind after a migration
- Mix refactoring and feature work in the same change
- Fail to keep tests, types, constants, imports, configuration, and documentation in sync
- Ignore the possibility of conflicts with parallel agents working on the same file

---

## Required Workflow

### 1. Before Starting Work
Before making any change, do all of the following:

1. Open every directly related file and read it top to bottom.
2. Identify the following:
   - Entry points
   - Data flow
   - Dependencies
   - Dynamic wiring
   - Public exports
3. List the affected files.
4. Declare the following:
   - Target
   - Reason
   - Scope
   - Expected impact
   - Rollback plan
5. Confirm baseline stability:
   - For code: confirm that the build succeeds and the relevant tests pass
   - For documentation: confirm that the current state of the code has been verified
   - For analysis: confirm that baseline evidence has been collected

Do not begin implementation before the above items are complete.

### 2. During Work
Use the following sequence:

`SURVEY → PLAN → EXECUTE → TEST → VERIFY → DOCUMENT`

Rules:
- Prefer incremental migration.
- Keep behavior unchanged unless the task explicitly requires a behavior change.
- After a successful migration, remove the unused legacy code.
- Stop immediately if unexpected behavior appears or evidence is missing.

### 3. After Work
Do all of the following:

1. Reopen every changed file and read it from start to finish.
2. Directly trace every affected connection.
3. Verify upstream and downstream impact.
4. Run the relevant tests.
5. Synchronize every affected artifact:
   - Tests
   - Types
   - Constants
   - Imports
   - Configuration
   - Documentation

Do not mark work as complete before all of the above items are done.

---

## Verification Standards

### File Verification
To say "verified," you must have done at least one of the following:
- Opened the file and read the relevant lines
- Ran a command and checked the output
- Ran a test and confirmed the pass or fail result

### Connection Tracing
For meaningful changes, verify the following:
- Producer output fields
- Consumer input fields
- Intermediate transforms
- Serialization and deserialization boundaries
- Every branch path that accesses the changed data

### Mandatory Hallucination-Prevention Checks
Verify directly in the file:
1. Function signatures and return shapes
2. Export boundaries and entry-point exposure
3. The actual data flow of constants, configuration, and environment values
4. The actual state shape of interfaces, classes, and types

---

## Work-Type Rules

### Code Work
Before changing code, verify the following:
- All entry points
- The full path from entry point to exit point
- Dependency relationships
- Dynamic registration such as registries, event emitters, dependency injection, and string dispatch
- The public export surface

After changing code, synchronize the following:
- Tests
- Mocks and stubs
- Interfaces and types
- Constants
- Environment documentation
- Imports

### Documentation Work
Before writing documentation:
- Open the existing documentation and read it in full.
- Open the code that the documentation describes.
- List any outdated or incorrect descriptions.

Rules:
- The code is the source of truth.
- Do not copy large code blocks into documentation unless absolutely necessary.
- Write the intent and rationale instead of the obvious implementation steps.

### Analysis Work
Use the following sequence:
`OBSERVE → HYPOTHESIS → VERIFY → CONCLUDE`

Rules:
- Gather evidence before drawing conclusions.
- Separate confirmed facts from inferences.
- Do not make performance claims without measuring.
- Do not make security claims without directly checking inputs, secrets, encryption, and access control.

### Design Work
Before proposing a design:
- Read the current structure directly.
- List every affected module.
- Prepare at least two options.

Rules:
- Record the decision, alternatives, reasons, and consequences.
- Avoid circular dependencies and layering violations.
- Confirm whether implementing it directly is simpler than adding a new dependency.

---

## Parallel Agent Rules
Before starting parallel work, confirm all of the following:
- That file ownership does not overlap
- That one agent's output is not a required input for another agent
- That shared state is not modified concurrently
- That each task has an independent "definition of done"

Do not parallelize if any of the following apply:
- Multiple agents change the same file
- Schema or migration work is involved
- Dependency installation or removal is involved
- A strict sequential dependency exists

When running parallel agents, define the following for each agent:
- Owned files
- Feature boundary
- Definition of done
- Forbidden files
- Dependencies on other agents
- Potential conflict zones
- Integration plan

---

## Code Quality Rules
Unless the repository is already configured with stricter rules, all submitted code must satisfy the following constraints:

- Cyclomatic complexity of at most 10
- At most 4 parameters
- Function length of at most 40 lines
- Nesting depth of at most 3
- No untyped `any`
- No unexplained magic strings or magic numbers
- No implicit coercion
- No circular dependencies
- No layering violations
- No dead references

Architecture preferences:
- Presentation layer: parsing and validation only
- Business layer: domain logic
- Infrastructure layer: database, network, file system, external services
- Cross-cutting concerns: logging, authentication, and monitoring are separated into dedicated mechanisms

Comment policy:
- Leave only comments that explain "why".
- Remove comments that merely restate the code.
- Every temporary workaround must include an issue reference and a removal condition.

---

## Dead Code Rules
Classify before acting:

- Code that is completely unreferenced → delete
- Branches that are permanently `false` → remove the dead branch
- Unwired code of unclear status → investigate before deleting
- Previous-generation code after a successful migration → delete
- Compatibility shims or barrel exports that still serve a purpose → keep and document the reason

---

## Post-Work Audit
Run this audit before completion:

### Safety
- No references to removed code
- No missing consumers
- Build succeeds
- Static checks pass (if configured)
- Relevant tests pass

### Connectivity
- Imports and exports are valid
- Dynamic wiring still works
- Public entry points expose what is intended
- Producer fields and consumer fields still match
- No orphaned code remains

### Consistency
- Naming is consistent
- Layering is preserved
- Constants and types point to current definitions
- Documentation matches the current behavior

### Full sync
- Tests updated
- No orphaned tests remain
- Test coverage exists for new public behavior
- Mocks and stubs match the current contracts
- Configuration and environment documentation are updated

---

## Session Memory
At the end of a session, update `AGENT_MEMORY.md` in the repository root.

Record the current task, completed steps, and next steps, keeping only a single active snapshot:

- Current task
- Last completed step
- Next exact step
- Incomplete items and why
- Key decisions
- Rejected alternatives
- Known risks
- The files to open first in the next session, in order

At the start of the next session:
1. Open `AGENT_MEMORY.md`.
2. Read the latest snapshot.
3. Open the files in the restore list, in order.
4. Resume from the recorded next step.

If `AGENT_MEMORY.md` does not exist, perform the full survey again from scratch.

---

## Completion Requirements
Never declare completion unless you can provide all of the following:

- Reopened and reread the changed files
- Ran the commands
- Observed the actual results
- Reviewed side effects
- Synchronized tests, types, constants, imports, configuration, and documentation
- Completed the post-work audit
- Updated `AGENT_MEMORY.md`

At the end of the work, report a confidence score out of 100.
