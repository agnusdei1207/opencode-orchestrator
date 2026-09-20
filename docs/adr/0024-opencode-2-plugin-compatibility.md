# ADR-0024: OpenCode 2 Plugin Compatibility

Date: 2026-09-20
Status: Implemented
Issue: https://github.com/agnusdei1207/opencode-orchestrator/issues/42

## Context

OpenCode 2 rejects the former bare-function default export. Its Promise plugin
contract requires an object with `id` and `setup`, and its tools, commands,
hooks, events, sessions, and client methods use different registration and data
shapes. The package must continue to serve existing OpenCode 1 users through
the `./server` entrypoint.

## Options considered

1. Export only an OpenCode 2 definition and end OpenCode 1 support. This is the
   smallest implementation, but it breaks the currently documented host.
2. Wrap the existing function in `{ id, setup }` and return the old hook object.
   This fixes only the loader error; OpenCode 2 does not consume the old return
   shape, so the plugin would load without its behavior.
3. Export one hybrid definition and translate both contracts at the boundary.
   This keeps the business runtime shared while making each host integration
   explicit.

## Decision

Use option 3. The default export contains `id`, the OpenCode 1 `server`
function, and the OpenCode 2 `setup` function. The V2 boundary registers native
tools, commands, session hooks, tool hooks, and an event subscription. It adapts
session calls and message data for the existing mission and delegated-task
runtime. V2 child sessions use the host's active built-in agent while the
requested Commander, Planner, Worker, or Reviewer instructions are prepended to
the delegated prompt, because V2 transforms cannot create new agents.

Pin `@opencode/plugin` as a development contract separately from the existing
OpenCode 1 runtime SDK pair. It is type-only and is not shipped as a duplicate
runtime dependency because OpenCode 2 supplies the plugin context. Do not add
the full V2 SDK package: the context already supplies the required domains, and
the SDK brings server-only native dependencies.

## Consequences

Both hosts resolve the same package entry without duplicating domain logic.
V2 registrations have explicit cleanup and event translation. OpenCode 2 does
not expose session deletion to plugins, so retired delegated sessions are
interrupted and forgotten by the local pool; the host remains responsible for
eventual session retention cleanup.

Rollback is a revert of the compatibility commit: remove `src/v2`, restore the
bare OpenCode 1 export, remove `@opencode/plugin`, and revert the matching tests
and documentation. That rollback intentionally restores the issue #42 failure
on OpenCode 2.
