# ADR-0022: OpenCode 1.18 Plugin Boundary and Runtime Separation

Date: 2026-09-15 16:25 KST
Status: Implemented
Source: `docs/plans/2026-09-15-opencode-compatibility-refactor.md`

## Context

OpenCode's current package loader resolves an explicit `./server` export before
falling back to `main`. It recognizes the new default module form
`{ id?, server }` and still has an explicit legacy path for exported plugin
functions. This package already had installed users and tests that rely on its
function default export, while its bootstrap mixed host-facing hook composition
with all runtime initialization and shutdown wiring.

The released OpenCode host and both public integration packages were at
`1.18.31` during this review. Their dependency graph includes `ini@7.0.0`, whose
Node support begins at `24.15.0` within the Node 24 line.

## Decision

- Pin `@opencode-ai/plugin` and `@opencode-ai/sdk` together at `1.18.31`.
- Declare Node.js `>=24.15.0` so installation checks match the resolved runtime
  dependency graph.
- Export `./server` and the package root to the same built entrypoint.
- Retain the default function plugin for the patch release. A later breaking
  release may adopt the object module after its older-host support boundary is
  chosen explicitly.
- Keep `src/index.ts` as the OpenCode hook-composition boundary and move runtime
  configuration, subsystem construction, and shutdown registration to
  `src/plugin-runtime.ts`.
- Use the OpenCode checkout as contract evidence and Oh My OpenAgent only as an
  adapter-structure reference. No source or prompts are copied.

## Consequences

Current OpenCode finds the dedicated server subpath directly, while existing
loaders can keep using the package root and function export. The entrypoint is
small enough to compare directly with the public hook contract, and lifecycle
ownership is centralized in one runtime module.

An isolated live run passed 14 host scenarios with OpenCode `1.18.31`, SDK
`1.18.31`, and the local built plugin. It covered host storage isolation,
session APIs, context-only and provider prompts, native task/resume/webfetch,
plugin delegation/resume, mission start/stop, abort, compaction, restart
persistence, and built hook loading. This does not establish a public native
background-task contract, so the retained bounded task runtime is unchanged.
