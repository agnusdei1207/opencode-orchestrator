# Agent Memory - OCO Session

Last updated: 2026-09-20 13:08 KST

## Current task

Resolve GitHub issue #42, integrate PR #43, complete QA, and publish the next
patch release with OpenCode 1 and OpenCode 2 plugin compatibility.

## Last completed step

Implemented and verified a hybrid plugin entry (`server` for OpenCode 1,
`id`/`setup` for OpenCode 2), native V2 adapters, synchronized tests and docs,
and the production-dependency audit gate. PR #43 was reviewed and merged
locally. The full release dry run passed: 1,038 TypeScript tests, coverage
thresholds, Rust fmt/clippy, 64 Rust tests, production audit, dependency tree,
and isolated packed-package smoke test. A native OpenCode 2.0.10 host also
loaded the built plugin and exposed all five plugin commands.

## Next exact step

Commit the issue #42 implementation, run `npm run release:patch`, monitor the
hosted release, verify npm/GitHub artifacts and fresh registry installation,
close issue #42, then record the final release evidence here.

## Incomplete items and why

- The compatibility changes, merge commit, patch tag, and npm release have not
  yet been pushed; local verification was completed first.
- Issue #42 remains open until the published package is independently verified.

## Key decisions

- Keep the working OpenCode 1 `server` contract while adding the OpenCode 2
  `id`/`setup` contract at the same default export.
- Translate V2 tools, commands, hooks, sessions, and events at the host boundary
  and reuse the existing mission runtime instead of duplicating domain logic.
- Keep `@opencode/plugin@2.0.10` as a pinned development-only type contract;
  OpenCode supplies the runtime context, and packed installs must not contain it.
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

## Files to open first in the next session, in order

1. `AGENT_MEMORY.md`
2. `docs/adr/0024-opencode-2-plugin-compatibility.md`
3. `src/index.ts`
4. `src/v2/setup.ts`
5. `src/v2/client-adapter.ts`
6. `tests/unit/v2-plugin.test.ts`
7. `scripts/release-preflight.mjs`
8. `package.json`
