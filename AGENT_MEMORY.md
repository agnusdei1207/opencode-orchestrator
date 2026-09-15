# Agent Memory - OCO Session

Last updated: 2026-09-15 19:54 KST

## Current task

Legacy removal, runtime hardening, full QA, commit/push, and patch release to
`1.7.21`. The implementation and `v1.7.20` were committed and pushed. Hosted
QA and all five native builds passed, but package smoke blocked npm publication
because the isolated release job had not generated ignored `dist/` output.

## Last completed step

Diagnosed the failed `v1.7.20` release from the authenticated Actions log. The
five hosted binaries passed exact-set, header, architecture, and embedded
version validation. Added an explicit `npm run build` to the isolated release
job before package smoke and publication, plus a regression test for that
ordering. A clean Node 24.20.0 Linux container then passed build, packed install,
config registration, package imports, and the Linux CLI using those hosted
artifacts. The corrected tree also passed the full local release preflight:
1,022 TypeScript tests with coverage, 64 Rust tests plus format/Clippy, zero npm
audit findings, a valid dependency tree, and packed-install smoke.

## Next exact step

Commit and push the workflow correction, then run the authorized patch release
from a Bash login shell so the user's `.bashrc` authentication is loaded. Verify
`1.7.21` from npm and reclaim Docker resources afterward.

## Incomplete items and why

- `v1.7.20` exists remotely but was not published to npm; the failed hosted run
  is `34959635053`. The corrected workflow must ship under `v1.7.21`.
- Docker resources remain until registry verification; reclaim them afterward.

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
