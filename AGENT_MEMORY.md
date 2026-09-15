# Agent Memory - OCO Session

Last updated: 2026-09-15 16:43 KST

## Current task

Completed patch release `1.7.19` after an OpenCode compatibility audit and
runtime refactor.

## Last completed step

Published `opencode-orchestrator@1.7.19` to npm under `latest`, pushed release
commit `fefd948bdd48f1cb750ab9e007fbab65c713a055` to `main`, and pushed tag
`v1.7.19` at the same commit. Registry metadata and a fresh isolated install
verified the published package, plugin registration, and both public imports.
Unused Docker images, volumes, containers, and build cache were reclaimed.

## Next exact step

No release work remains. Begin the next task from a clean `main` after reading
this file and the final review record.

## Incomplete items and why

- None for release `1.7.19`.

## Key decisions

- Retain the function-form default plugin export for installed-host
  compatibility while exposing `./server` for the current OpenCode loader.
- Pin `@opencode-ai/plugin` and `@opencode-ai/sdk` together at `1.18.31` and
  require Node `>=24.15.0`, matching the resolved dependency graph.
- Keep native background replacement out of this patch because the public host
  contract still does not establish the needed delivery behavior.
- Use OpenCode source as contract evidence and Oh My OpenAgent only as an
  adapter-structure reference; copy no source or prompts.

## Rejected alternatives

- Do not switch the default export to the new object module in a patch release;
  older supported loaders and existing consumers still use the function form.
- Do not let repeated same-named tool calls stop mission continuation; only
  repeated identical text-only turns indicate the output loop this guard owns.
- Do not mix all 55 pre-existing static complexity findings into this
  compatibility patch; ADR-0021 records the deletion-first subsystem path.

## Known risks

- Native background-task parity remains unverified, so the bounded task runtime
  is still present.
- The static survey still reports 55 pre-existing function-size, parameter, or
  complexity findings outside the refactored critical paths.
- npm 11.17 reports advisory approval warnings for install scripts; the isolated
  local-tarball and published-package tests confirmed this package's postinstall
  still ran and registered the plugin.

## Files to open first in the next session, in order

1. `AGENT_MEMORY.md`
2. `docs/reviews/2026-09-15-opencode-compatibility-refactor.md`
3. `package.json`
4. `docs/adr/0022-opencode-1-18-plugin-boundary.md`
5. `src/index.ts`
6. `src/plugin-runtime.ts`
