# Agent Memory - OCO Session

Last updated: 2026-09-20 13:16 KST

## Current task

GitHub issue #42, PR #43 integration, full QA, and patch release `1.7.22`
are complete.

## Last completed step

Published npm and GitHub release `1.7.22` from commit
`2aaa4e03e9fb464c8db3da67200edf252452e68b`. Hosted run `35488403660`
passed the quality gate, five native platform builds, package verification,
npm publication, and GitHub Release creation with five assets. A fresh npm
registry install loaded the hybrid entrypoint, reported CLI `1.7.22`, and did
not contain the development-only `@opencode/plugin` contract. PR #43 is merged
at `07a980cb0b0822bb38021d7e691ffd9618c65220`, and issue #42 was closed with a
release note comment.

## Next exact step

No remaining step for this task. Begin future work from clean, synchronized
`main` after reading this snapshot and ADR-0024.

## Incomplete items and why

- None within the authorized scope.

## Key decisions

- Keep the working OpenCode 1 `server` contract while adding the OpenCode 2
  `id`/`setup` contract at the same default export.
- Translate V2 tools, commands, hooks, sessions, and events at the host boundary
  and reuse the existing mission runtime instead of duplicating domain logic.
- Keep `@opencode/plugin@2.0.10` as a pinned development-only type contract;
  OpenCode supplies the runtime context and packed installs exclude it.
- Audit published production dependencies with `npm audit --omit=dev`; the V2
  type package currently has an upstream development-only OpenTelemetry advisory
  with no fix, while the shipped dependency graph audits clean.
- Preserve PR #43's resolved-marker handling and native `/stop` and `/cancel`
  registrations in the same patch release.

## Rejected alternatives

- Do not replace the default export with V2-only behavior because that would
  break supported OpenCode 1 installations.
- Do not merely wrap the V1 hook object in `{ id, setup }`; OpenCode 2 requires
  native registrations and different data shapes.
- Do not add the full V2 SDK runtime dependency when the supplied plugin context
  already exposes the necessary domains.

## Known risks

- OpenCode 2 does not expose session deletion to plugins. Retired delegated
  sessions are interrupted and forgotten locally; host retention owns cleanup.
- V2 transforms cannot create custom agents dynamically. Delegated role
  instructions are prepended while the host's active built-in agent executes.
- Overall line coverage is 90.49%, above the configured release threshold but
  not 100%; native V2 load and command registration were additionally exercised.
- npm 11.19 can require explicit install-script approval. The repository's
  isolated tarball smoke test directly confirmed the postinstall registration;
  the fresh registry install independently confirmed package loading and CLI.

## Files to open first in the next session, in order

1. `AGENT_MEMORY.md`
2. `docs/adr/0024-opencode-2-plugin-compatibility.md`
3. `src/index.ts`
4. `src/v2/setup.ts`
5. `src/v2/client-adapter.ts`
6. `tests/unit/v2-plugin.test.ts`
7. `scripts/release-preflight.mjs`
8. `package.json`
