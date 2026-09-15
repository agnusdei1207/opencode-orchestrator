# Agent Memory - OCO Session

Last updated: 2026-09-15 19:35 KST

## Current task

Legacy removal, runtime hardening, full QA, commit/push, and patch release to
`1.7.20`. Implementation and pre-release verification are complete; commit,
push, patch release, registry verification, and Docker cleanup remain.

## Last completed step

Removed unreachable runtime families, eliminated the manager cycles, hardened
notification process execution, updated release gates and development tools,
and fixed the Rust CLI configuration boundary. The production TypeScript graph
is 185/185 reachable with zero cycles. TypeScript build/typecheck and all 1,021
tests pass on TypeScript 7/Vitest 5 with coverage above thresholds. The isolated
OpenCode 1.18.31 host passed 14/14 scenarios. Rust format/Clippy passed and all
64 Rust tests passed on Rust 1.98.1. Linux x64/arm64 and Windows x64 binaries
were rebuilt from the refreshed lockfile and executed successfully before the
generated artifacts were removed from source control.

## Next exact step

Finish the diff/document audit, rerun the final combined preflight, commit and
push the implementation, then run the authorized patch release from a Bash
login shell so the user's `.bashrc` authentication is loaded.

## Incomplete items and why

- `1.7.20` is not yet committed, tagged, pushed, or published. Release follows
  the final clean-worktree verification.
- Docker resources are retained until all Rust and Linux artifact checks finish;
  reclaim them after registry verification.

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
