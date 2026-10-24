# ADR-0025: Mission context after the conversation prefix

Date: 2026-10-24 21:50 KST
Status: Implemented
Issue: https://github.com/agnusdei1207/opencode-orchestrator/issues/57

## Context

The system-transform handler prepended the current step count, mission iteration,
progress, verification, scratchpad and task counts before host instructions. The
OpenCode 2 adapter also prepended those blocks. Each runtime update changed the
beginning of the provider request, preventing reuse of that prefix.

Affected modules are both plugin entrypoints, the mission context builder,
the OpenCode 1 messages-transform registration, and hook-name constants.
Mission persistence, tool accounting and idle continuation retain their contracts.

## Options considered

1. Append fewer dynamic fields to the system prompt. This preserves host
   instructions at the beginning but still puts changing state before history.
2. Append a request-only user-role message after history. This preserves the
   system and conversation prefix while retaining current runtime information.
3. Persist a new session prompt for every update. This changes session history
   and risks starting extra turns or disturbing idle continuation.

## Decision

Use option 2 with the existing host hooks and no new dependencies. Keep all
runtime fields in one shared builder. Remove the former system-transform
registration, implementation and hook constant.

OpenCode 1 derives the session from outgoing message metadata and copies the
latest matching user envelope into a trailing synthetic message with distinct,
deterministic message/part IDs. OpenCode 2 already supplies the session ID and
model-message array, so it receives a user-role text message directly. Neither
boundary modifies existing history or calls a session prompt API. Weak sets
identify additions owned by each handler so repeated transforms of the same
request replace the trailing snapshot and cancellation removes it.

The message-size guard still runs after the addition. Temperature overrides,
model-limit tracking, tool evidence, custom rendering and compaction stay wired.

## Consequences

The system prompt and preceding conversation no longer change because mission
runtime state changes. Fresh state remains available after tool results, and
only the active mission's owning session receives it. Empty outgoing histories
and OpenCode 1 histories without a matching user envelope are left alone.

Regression tests exercise both actual plugin registrations, changing runtime
fields, prefix equality, request copies, cancellation, session isolation,
rehydration, background task counts and unreadable optional memory. Provider
cache-hit rates and billing are not measured by these local tests and remain
dependent on the provider and host. No hit-rate guarantee is made.

Rollback: revert the issue #57 changes and publish a new patch; do not rewrite
an existing release tag or npm version.
