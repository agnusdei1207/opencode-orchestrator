# Agent Memory - OCO Session

Last updated: 2026-09-24 KST

## Current task

The issue #44-46 maintenance and release task is complete. The latest npm
version is 1.7.25, and all three issues are closed with short English thanks.

## Last completed step

Implemented per-agent temperature (#44), corrected verification guidance
(#45), and kept generated /task instructions out of user-authored output
(#46). Refreshed tested OpenCode 1 and 2 contracts, removed confirmed legacy
code, fixed active-config npm postinstall precedence, and released 1.7.23
through 1.7.25. The 1.7.25 release builds Linux x64 and arm64 on Debian
Bookworm, runs both there before upload, and fixes the glibc startup failure
discovered by installing 1.7.24 on Bookworm.

The v1.7.25 preflight passed: build, 117 TypeScript test files / 1,057 tests
with coverage, 64 Rust tests with format and Clippy checks in Docker,
production dependency audit, dependency tree, and packed-package postinstall
smoke. TypeScript typecheck and the full Node suite also passed in Docker
with --init. GitHub Actions run 35970048556 and all five binary builds plus
publication succeeded. Fresh registry installs of 1.7.25 passed in Windows
and Linux x64/arm64 Docker: active-config registration, plugin exports, five
bundled binaries, and native/launcher CLI versions. GitHub Release v1.7.25
contains five assets and specific release notes. Issues #44-46 are closed as
completed; the open issue count is zero. Main and tag v1.7.25 were pushed.

## Next exact step

There is no pending release step. On the next request, open this snapshot,
then the restore files below in order; check git status, npm latest, and new
issues before starting a new scoped task.

## Incomplete items and why

- No release or issue-closure work remains.
- A live interactive OpenCode UI session was not exercised. Host contract
  tests, plugin entrypoint tests, and registry installation checks passed.

## Key decisions

- Keep agentTemperatures opt-in and preserve host settings when unset or
  unsupported.
- Treat changed-file verification evidence as advisory; TODO, checklist,
  and sync-issues remain completion authority.
- Register npm postinstall in the active OpenCode config before fallbacks.
- Use Debian Bookworm for both Linux builds and runtime checks; QEMU runs
  the arm64 artifact on the x64 CI runner.
- Use Docker --init for Node process-tree E2E tests so orphaned children are
  reaped. Run Windows registry QA on Windows.
- Publish through the tag-triggered workflow after QA and artifact checks.

## Rejected alternatives

- Keep building Linux binaries on ubuntu-latest: 1.7.24 required GLIBC_2.39
  and failed on Debian Bookworm.
- Pin the deprecated Ubuntu 22.04 runner: Bookworm containers give a stable
  runtime baseline without relying on that runner image.
- Close issues before the registry package passes actual install QA.

## Known risks

- The 1.7.24 Linux binary remains downloadable; npm latest is 1.7.25.
- OpenCode 2 does not expose a temperature capability flag at the V2 plugin
  boundary; users should opt in only for models that support temperature.
- Verification-command detection is heuristic and advisory.
- Interactive host UI behavior is not proven by the automated checks.

## Files to open first in the next session, in order

1. AGENT_MEMORY.md
2. AGENTS.md
3. .github/workflows/release.yml
4. scripts/release-preflight.mjs
5. scripts/package-smoke.mjs
6. scripts/postinstall.ts
7. src/core/loop/evidence.ts
8. src/plugin-handlers/command-execute-handler.ts
9. src/v2/command-adapter.ts
10. package.json
