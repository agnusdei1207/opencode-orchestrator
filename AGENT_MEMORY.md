# Agent Memory - OCO Session

Last updated: 2026-09-19 (fork arfoux, branch fix/sync-counter-and-stop-cancel-commands)

## Current task

Fix two mission-loop bugs on fork arfoux/opencode-orchestrator and open upstream PR #43: (1) sync-counter treated any status text in sync-issues.md as an open issue, trapping missions in an infinite verification-failed loop; (2) /stop and /cancel were documented and hook-handled but never registered as OpenCode slash commands.

## Last completed step

Pushed branch fix/sync-counter-and-stop-cancel-commands to arfoux/opencode-orchestrator and opened PR #43 to agnusdei1207/opencode-orchestrator. Tests: 49/49 on touched files, tsc clean, full unit 944 passed + 1 pre-existing Windows-only os-notify failure (verified failing on clean tree too). README documents the sync-issues resolved convention; repo topics set.

## Next exact step

Watch PR #43 review feedback from upstream maintainer; address comments if any. No further code changes planned unless requested.

## Incomplete items and why

- None within the authorized scope. `v1.7.20` remains an unpublished failed tag
  for audit history; `v1.7.21` is the public corrected release.

## Key decisions

- Delete only code proven unreachable or connected solely to no-op projections;
  preserve every registered OpenCode tool and public package entry.
- Keep the used timeout as `core/async/with-timeout.ts` and the rate-limit path
  directly in `session-recovery.ts`.
- Pass desktop notification data as process arguments or child-only environment
  values, never as shell source.
- Keep the Rust CLI config commands for compatibility while making them match
  OpenCode path precedence, preserve invalid input, back up writes, and leave
  unrelated MCP configuration untouched. The npm hook remains the JSONC-aware
  path.
- Use TypeScript 7.0.2 and Vitest 5.0.1. Keep Node type definitions on the
  supported Node 24 line rather than exposing Node 26-only APIs.
- Build all five release binaries from the exact tag in the hosted matrix.
  Keep `bin/` as an ignored build output so a version tag cannot retain binaries
  with an older embedded version.
- Build ignored `dist/` output inside the release job itself; artifacts from a
  separate QA job do not share a filesystem with the publisher.
- Use a Node log follower for `npm run log` so the development command works on
  Windows, Linux, and macOS without shell command substitution.

## Rejected alternatives

- Do not remove the public toolbelt, Rust bridge, or bounded task runtime in a
  patch release. ADR-0021 keeps those changes behind explicit compatibility
  gates.
- Do not retain unreachable implementations because tests import them; those
  tests preserve dead code rather than shipped behavior.
- Do not rewrite malformed or commented JSONC from the Rust CLI. Return an
  actionable error and preserve the file; the npm hook supports JSONC edits.
- Do not refactor the stateful Rust process pool solely to satisfy a static
  size threshold while its public replacement remains unresolved.

## Known risks

- Native background-task parity is still unverified, so the bounded task runtime
  remains.
- The static survey reports 40 function-size, parameter, or complexity findings,
  concentrated in retained process/task state machines and handler adapters.
- The Rust CLI accepts strict JSON content in either `opencode.json` or
  `opencode.jsonc`; commented JSONC requires the npm hook.
- npm 11.17 reports advisory approval warnings for install scripts. Isolated
  installs confirmed this package's postinstall runs and registers the plugin.

## Files to open first in the next session, in order

1. `AGENT_MEMORY.md`
2. `docs/reviews/2026-09-15-legacy-removal-and-hardening.md`
3. `docs/adr/0023-remove-unreachable-runtime-plumbing.md`
4. `docs/plans/2026-09-15-legacy-removal-and-hardening.md`
5. `package.json`
6. `src/index.ts`
7. `crates/orchestrator-cli/src/config.rs`
