# Agent Memory - OCO Session

Last updated: 2026-09-26 23:07 KST

## Current task

Follow up on issue #48 and an intermittent Windows background-task E2E failure
after completing a repository review, targeted OpenCode 2 lifecycle fixes, and
the `2.0.4` patch release.

## Last completed step

Reviewed plugin entry points, V1/V2 runtime setup, V2 adapters, session-pool and
task cleanup paths, installed OpenCode 2 types, tests, and release wiring. Found
that V2 setup leaked successful registrations and runtime resources when a later
registration failed; a failed disposer also skipped runtime shutdown. The V2
event bridge omitted the host subscription's supported abort signal. Added five
lifecycle and one event-stream regression tests, observed each new case fail
before its fix, then committed the changes as `dc9e59b`. An independent read-only
review found no release blocker after these fixes.

Released `2.0.4` from commit `705d753` and tag `v2.0.4`. Local preflight passed:
build, 1001 TypeScript tests with coverage, 57 Rust tests, production dependency
audit, dependency tree, and packed-package smoke. TypeScript typecheck passed.
GitHub's release workflow succeeded and uploaded five binaries. The npm publish
log showed `+ opencode-orchestrator@2.0.4`; a fresh-cache npm query confirmed
`2.0.4` exists and is the `latest` dist-tag. The ordinary local npm cache briefly
returned stale `2.0.3` metadata after publication.

## Next exact step

Obtain issue #48 reporter's OpenCode version, plugin list, compression settings,
and minimal reproducible transcript or model request. Identify the producer of
the compressed user message and reproduce it before changing Orchestrator or
closing the issue. Separately, capture task state and `taskkill` stderr if the
Windows background-task E2E test fails again under full-suite load.

## Incomplete items and why

- Issue #48 remains open and unchanged by `2.0.4`. The screenshot provides no
  environment details. The marker is absent from Orchestrator; upstream Dynamic
  Context Pruning can synthesize a user-role summary, but the reporter's setup
  is unconfirmed.
- One full-suite run failed an existing Windows background-task E2E assertion:
  `kill()` returned false after a fixed 100 ms wait. The focused suite and three
  subsequent full runs passed. The cause was not reproduced or changed.
- V2 runtime initialization starts a cleanup scheduler before returning its
  shutdown handle. A hypothetical exception after that point could leave the
  scheduler active; no ordinary triggering input was found in this review.
- `.qa-public-package/` remains intact as isolated local QA data. It is excluded
  only through the local `.git/info/exclude` so release checks see a clean tree.

## Key decisions

- Keep the review patch focused on observed lifecycle faults and tested cleanup
  behavior; preserve the successful registration and event translation paths.
- Use the existing tag-driven GitHub workflow to publish `2.0.4` with five
  platform binaries and the V2 cleanup fixes.
- Keep #48 open until its cause and a fix can be verified in the reported setup.
- Keep the local API token values from `.bashrc` out of logs and repository files.

## Rejected alternatives

- Rewriting all V2 adapters or altering compressed-message roles without a
  verified issue-specific cause.
- Changing background process termination code on the basis of one intermittent
  test failure without reproducing its underlying state transition.
- Closing #48 based on this unrelated lifecycle release.

## Known risks

- A third-party compression tool may still send summaries under the user role;
  `2.0.4` does not change that transport behavior.
- The intermittent Windows E2E failure may recur under process contention.
- Cleanup errors within `ShutdownManager` are caught by that manager and its
  current logger is a no-op, so failures there are not externally visible.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `src/v2/setup.ts`
4. `src/v2/event-bridge.ts`
5. `tests/unit/v2-lifecycle.test.ts`
6. `tests/e2e/background-task.test.ts`
7. `src/core/commands/manager.ts`
8. `src/plugin-handlers/session-compacting-handler.ts`
