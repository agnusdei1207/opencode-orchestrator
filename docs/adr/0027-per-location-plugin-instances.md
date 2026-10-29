# ADR-0027: Per-Location Plugin Instances

Date: 2026-10-29 14:30 KST
Status: Implemented; toast handover superseded by ADR-0028

## Context

OpenCode 2.2 serves several directories ("locations") from one process. It
loads a separate plugin instance for each location and disposes an instance
when its location goes idle. The plugin assumed one instance per process.

Observed failures:

- `/task` failed with "ParallelAgentManager requires client and directory on
  first call". Disposing an idle location cleared the process-wide manager
  singleton that the live location still used.
- Disposing one instance also shut down process-wide services, such as the
  Rust tool pool, background commands and loop guards, for every other
  instance.
- Directory-bound singletons kept only the last loaded directory. TODO
  writes, custom agents, memory, metrics, mission options, toasts and context
  limits could act on the wrong project. Task memory could carry one
  project's tool output into another project's delegated prompts.
- `event.subscribe` delivers events "across all server locations", so every
  instance handled every location's sessions.
- Every plugin tool failed with "No tool named". OpenCode 2 exposes a tool
  directly only when it registers with `codemode: false`. Other tools go into
  the code-mode catalog behind `execute`.

## Decision

- Each plugin instance creates and owns its `ParallelAgentManager`,
  `SessionRegistry`, `TaskToastManager` and `ContextLimitResolver`. The
  handler context and hook context carry them, and the instance's `dispose`
  releases them.
- Process-wide services are reference-counted. Only the last live instance's
  dispose shuts them down. A failed setup rolls back what it acquired.
- Project state is keyed by resolved directory: `TodoManager`,
  `AgentRegistry`, `MemoryManager`, `MetricsCollector` and mission runtime
  options. Tools read the directory from the native tool context.
- Toasts go through the newest client of a live instance. Disposing an
  instance detaches only its own client.
- The OpenCode 2 event bridge drops events whose envelope or data location
  names another directory. It remembers sessions seen with a foreign
  location and also drops their unlocated events, such as
  `session.execution.succeeded`. Unattributed events still pass.
- Plugin tools register with `codemode: false`, as OpenCode's built-in tools
  do.

## Consequences

Disposing one location no longer affects another. Projects served by the
same process no longer share TODO files, agents, memory, metrics or options.
Small models can call plugin tools directly.

Session-keyed module state, such as activity, pending injections and loop
guards, stays process-wide, because session IDs are unique across locations.
An unlocated event for a session that no located event has attributed yet
still reaches every instance.

Regression tests cover a disposed neighbour instance, setup rollback,
cross-project agent, memory and metrics isolation, per-project mission
options, toast client handover, foreign-location events and direct tool
registration.
