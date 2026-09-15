# Agent Memory - OCO Session

Last updated: 2026-09-15 16:34 KST

## Current task

Prepare and publish patch release `1.7.19` after an OpenCode compatibility
audit and runtime refactor.

## Last completed step

Updated the OpenCode plugin/SDK dependencies to `1.18.31`, added the explicit
`./server` package entry, separated plugin bootstrap from hook composition,
split mission/progress/session/recovery logic into bounded helpers, and fixed
mission continuation so repeated legitimate tool calls do not open the output
circuit. Updated the plan, architecture, ADRs, README, tests, and review record.
Full Node tests, coverage, isolated OpenCode host QA, packed-install smoke,
npm audit, Rust format/Clippy/tests, and static comparison have passed.

## Next exact step

Commit the reviewed refactor, run `scripts/release-version.mjs patch`, execute
the clean release preflight, rebuild and synchronize Linux x64/arm64 artifacts,
publish `opencode-orchestrator@1.7.19`, then push `main` and `v1.7.19` and verify
both registries.

## Incomplete items and why

- Versioned Docker distribution builds, publication, and remote verification
  are release-time steps and have not run yet.

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
  tarball test confirmed this package's postinstall still ran and registered the
  plugin.

## Files to open first in the next session, in order

1. `AGENT_MEMORY.md`
2. `docs/reviews/2026-09-15-opencode-compatibility-refactor.md`
3. `package.json`
4. `scripts/release-version.mjs`
5. `scripts/release-preflight.mjs`
6. `scripts/release-sync-artifacts.mjs`
