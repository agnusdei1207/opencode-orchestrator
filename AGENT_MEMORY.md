# Agent Memory - OCO Session

Last updated: 2026-10-24 KST

## Current task

Fix issue #57, verify OpenCode 1/2 compatibility, commit/push, publish an npm
patch and GitHub release, and close the issue. User authorized these actions.
Starting main was clean at f88f00a, matching origin/main; npm latest was 2.0.15.

## Last completed step

- Read issue #57 and prior restore files. Traced both entrypoints, mission state,
  session rehydration, message guard, tool accounting, compaction and release path.
- Baseline build and 28 relevant tests passed.
- Replaced dynamic system insertion with request-tail context through V1
  synthetic messages and V2 user-role model messages. Kept runtime fields.
- Removed former implementation/constant/tests. Added builder and actual
  entrypoint regression tests; synchronized README, architecture and ADR-0025.
- Reopened changed files and traced fields and registrations. Build, tsc,
  diff checks and all 128 files / 1,151 tests passed. Coverage: statements
  91.56%, branches 82.66%, functions 93.71%, lines 93.72%.
- Packed-install smoke passed; isolated OpenCode configuration was untouched.
- Read upstream V1 1.18.34 prompt conversion and V2 2.0.32 request hooks.
- Release audit found four existing high findings: Zod <4.6.6 and TOML <=5.0.0
  via the pinned V1 plugin's Effect dependency. Latest V1 plugin 1.19.4 still
  pins these; downgrading the public contract is rejected.
- Docker Rust 1.98.1 checks are running (exec session 92068).

## Next exact step

Commit verified issue #57 changes, then resolve the dependency release blocker
in a separate commit. Preserve tested SDK/plugin contracts. Re-run audit and
packed consumer checks before preparing and publishing patch 2.0.16.

## Incomplete items and why

- Dependency gate, Rust result, full release preflight, version/tag/push, hosted
  release, public npm verification, issue response/closure and final memory.
- User mentioned another error without text; an async question requests it.
- Live provider billing/cache-hit rate has not been measured. Tests establish
  stable request prefixes, not a numerical cache-hit guarantee.

## Key decisions

- Single writer; no agents. Request-only state after history, no new prompt API.
- V1/V2 boundary formats stay distinct; mission context content is shared.
- Resolve release findings without weakening audit. Rollback by revert/patch.

## Rejected alternatives

- Append dynamic state to system: still changes the prefix before history.
- Persist context each step: changes history and risks lifecycle interference.
- Drop runtime fields: removes useful mission/task/memory awareness.
- Downgrade V1 plugin to audit's suggested 0.9.11: incompatible API.

## Known risks

- Other host/plugin changes and provider policies can affect caching.
- Local host is OpenCode 2.1.4; existing native QA script targets V1.
- Root-only overrides do not propagate to npm consumers. Verify actual packed
  consumers before declaring dependency findings resolved.

## Files to open first in the next session, in order

1. AGENTS.md
2. AGENT_MEMORY.md
3. src/plugin-handlers/mission-context.ts
4. src/plugin-handlers/mission-messages-handler.ts
5. src/index.ts
6. src/v2/setup.ts
7. tests/unit/mission-prompt-caching.test.ts
8. package.json
9. scripts/package-smoke.mjs
10. scripts/release-version.mjs
11. scripts/release-preflight.mjs
12. .github/workflows/release.yml
