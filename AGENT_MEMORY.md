# Agent Memory - OCO Session

Last updated: 2026-10-24 KST

## Current task

Issue #57 is fixed, committed, pushed, released as npm/GitHub 2.0.16, verified
from the public package, and closed. User authorized these actions. Starting
main was clean at f88f00a and matched origin/main; previous latest was 2.0.15.

## Last completed step

- Surveyed issue, restore files, entrypoints, hooks, mission persistence,
  rehydration, memory, guards, accounting, compaction and release workflow.
  Baseline build and 28 relevant tests passed before implementation.
- Commit 179a071 moves all changing mission context from system instructions
  into request-only tail user messages. V1 uses synthetic parts; V2 uses model
  messages. Removed old system handler/registration/constant/tests. Preserved
  mission fields, task awareness, lifecycle and public hybrid exports.
- Added builder and actual entrypoint regressions, synchronized README,
  architecture and ADR-0025. Reopened changed files and traced connections.
- Commit 6a5a3d6 raises direct Zod minimum and adds root Zod/TOML security
  overrides. Checkout production audit has zero findings. Host API pins stay
  1.18.34 for V1 SDK/plugin and 2.0.22 for the V2 development contract.
- Consumer audit demonstrated root overrides do not propagate. A shrinkwrap
  experiment also failed to fix consumers and was fully removed. No consumer
  audit bypass or extra package lock was retained. CONTRIBUTING documents the
  remaining upstream transitive advisories; do not claim consumers have zero.
- Version commit/tag f384e72 / v2.0.16 synchronizes npm/Cargo manifests/locks and
  README (seven version fields). Release preflight passed build, coverage,
  Docker Rust 1.98.1 fmt/Clippy/158 tests, repository audit, dependency tree,
  packed-install exports/configuration checks. Atomically pushed main and tag.
- Release tag has 128 files / 1,151 tests passing. Coverage: statements 91.55%,
  branches 82.63%, functions 93.71%, lines 93.72%. Build/tsc/diff checks pass.
- Commit cc82f91 synchronizes the native fixture with trailing mission context
  and asserts request placement/no persisted synthetic history. Five fixture
  tests and 17 focused tests pass; hosted main CI 40096733578 passed all
  128 files / 1,153 tests and Rust 46 + 112 tests.
- Actual OpenCode 1.18.34 host with the built release: 17/17 scenarios pass,
  including mission replacement, stop, delegation/resume, compaction/restart,
  and placement/no persisted extra history. Report: .opencode/qa/native-host.json.
- Hosted release 40096348389 built and validated all five platform artifacts.
  Initial npm PUT failed E404 with the old repository publishing credential.
  Sourced bashrc without printing values; whoami and package read-write access
  passed. Updated GitHub NPM_TOKEN from that token, reran only failed release
  job, and publication succeeded. No token values were output or committed.
- GitHub release is public with authored notes. Downloaded five assets; format,
  architecture, embedded version and SHA-256 digests match. Windows reports 2.0.16.
- npm publication metadata/tarball initially lagged acceptance; both now resolve.
  latest is 2.0.16. Public SHA1 matches hosted pack/publish:
  8c804c913b56ec97e75eaecb78b9533d906fa335.
- Installed public tarball and, separately, normal npm version spec in fresh
  consumers. Both V1/V2 prefix/state/idempotence/cancellation regressions pass;
  bundled CLI reports 2.0.16. Hosted packed-install also passed root/server
  exports, CLI and isolation of OpenCode configuration.
- Posted verified release results and update/restart instructions, then closed
  issue #57 as completed. Comment:
  https://github.com/agnusdei1207/opencode-orchestrator/issues/57#issuecomment-6384638947
- Post-work audit: registrations/imports/exports remain connected; old production
  system-transform references are absent; no schema/config migration or new
  runtime dependency was added. Types, tests, constants and docs are synchronized.

## Next exact step

No implementation or release work remains for #57. If the user supplies their
additional error text, or the reporter reopens the issue, read it and reproduce
that specific host/model/request before changing code.

## Incomplete items and why

- No outstanding requested issue/release work.
- User mentioned another error without supplying its message/command; an async
  question requested them. The observed release authentication E404 is resolved.
- Live provider billing/cache-hit rate was not measured; never promise a fixed
  rate. Actual OpenCode 2.0.32 execution was not run: its upstream request hook
  was inspected, V2 2.0.22 types checked, and packaged V2 boundaries exercised.

## Key decisions

- Single writer; no agents. Shared dynamic content with separate host boundaries.
- Preserve existing system/history prefix; no added API prompts or persisted turns.
- Keep dependency gate changes separate from issue implementation.
- Keep release tag f384e72 immutable; cc82f91 is QA-only follow-up on main.
- Rollback via revert and another patch, without rewriting published artifacts.

## Rejected alternatives

- System-tail injection still changes content before history.
- Persisting snapshots creates extra turns and risks lifecycle interference.
- Dropping runtime fields removes useful mission/task/memory awareness.
- Audit's suggested V1 plugin downgrade to 0.9.11 breaks the tested API.
- Publishing a shrinkwrap did not enforce consumer overrides; removed it.
- Re-publishing while npm metadata lagged would risk duplicate publication.

## Known risks

- Provider/host/other-plugin policies still determine actual caching and billing.
- npm consumer roots still need their own transitive security overrides until
  the V1 plugin changes its upstream Zod/Effect dependency pins.
- Backend restart is needed after a plugin update; old stored tool footers remain.

## Files to open first in the next session, in order

1. AGENTS.md
2. AGENT_MEMORY.md
3. src/plugin-handlers/mission-context.ts
4. src/plugin-handlers/mission-messages-handler.ts
5. src/index.ts
6. src/v2/setup.ts
7. tests/unit/mission-prompt-caching.test.ts
8. scripts/qa-native-host.mjs
9. tests/e2e/native-host-contract.test.ts
10. README.md
11. docs/adr/0025-mission-context-prefix-caching.md
12. CONTRIBUTING.md
13. .github/workflows/release.yml
