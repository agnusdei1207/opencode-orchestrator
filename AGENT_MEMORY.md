# Agent Memory - OCO Session

Last updated: 2026-09-27 16:46 KST

## Current task

The requested code review, SDK/plugin contract check, dead legacy cleanup, and
`2.0.6` patch release are complete. The next active verification is a live
OpenCode 2 host contract for the retained delegation path.

## Last completed step

Read the official OpenCode 2 plugin, SDK, and V1 migration documentation, the
installed `@opencode/plugin@2.0.15` and `@opencode-ai/sdk@1.18.32` contracts,
and the plugin entry points and affected data flow. The OpenCode 2 tool context
supplies `signal`; forward it to legacy tool executors (`c01e890`). Both
supported plugin clients lack the old `client.v2.session.compact` route, so the
child-session reuse branch never ran. Replaced that pool with a deletion-guarded
`SessionRegistry` and removed obsolete state and tests (`02bdb38`). A red
reload regression showed that shutdown retained a closed agent manager and
registry; clear both singleton references after shutdown (`ed92b95`).

The final local build and typecheck passed. Release preflight passed 119
TypeScript test files / 1,019 tests with coverage above all configured
thresholds, 57 Rust tests, production dependency audit, dependency tree, and
packed-package smoke. The isolated built-plugin QA passed 14 checks with
OpenCode and SDK `1.18.32`. `npm run release:patch` made commit `3b92457`
and tag `v2.0.6`, then atomically pushed both. GitHub Build & Release run
`36303826326` succeeded, created the release with five binaries, and logged
`+ opencode-orchestrator@2.0.6`. A fresh npm cache confirmed `2.0.6` and
`latest: 2.0.6`. GitHub CI and Pages runs also succeeded.

## Next exact step

When a released OpenCode 2 executable is available, run an isolated live-host
contract against the built plugin: tool cancellation, setup/cleanup/reload,
child-session lifecycle, and the host-owned deletion boundary. Then evaluate
native background delegation parity before retiring any public delegation
tools or V1 compatibility.

## Incomplete items and why

- OpenCode 2 was checked against official documentation, installed package
  types, and tests, but no OpenCode 2 executable was installed for live QA.
- Native background task and busy-parent notification parity remain unproved;
  the existing delegation runtime remains in service.
- Issue #48 still needs the reporter's environment and a reproducible
  compressed-message transcript before an issue-specific change.
- An older intermittent Windows background-task E2E failure was not reproduced
  during this work.

## Key decisions

- Retain OpenCode 1 support in the patch release; its `server` entry remains
  active and the isolated host QA exercises it.
- Remove only unreachable session reuse state. On OpenCode 1, guard deletion
  until idle and settled. OpenCode 2 has no plugin deletion API, so leave those
  sessions to the host.
- Keep the V2 cancellation fix, the session refactor, and the reload fix in
  separate commits. Use the existing tag-driven release workflow.

## Rejected alternatives

- Remove V1 compatibility in a patch release.
- Keep simulated compaction or reuse code for an API neither supported plugin
  client exposes.
- Replace retained background delegation before live host parity is verified.

## Known risks

- Live OpenCode 2 behavior remains unverified.
- Concurrent overlapping plugin instances still share process-global manager
  state; the regression test covers sequential reload only.
- The local npm cache can lag after publication; the fresh-cache lookup was
  used to confirm the registry state.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `src/index.ts`
4. `src/plugin-runtime.ts`
5. `src/v2/setup.ts`
6. `src/v2/tool-adapter.ts`
7. `src/core/agents/manager.ts`
8. `src/core/agents/session-registry.ts`
9. `scripts/qa-native-host.mjs`
10. `docs/adr/0021-minimal-mission-plugin.md`
