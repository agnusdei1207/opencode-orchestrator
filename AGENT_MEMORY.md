# Agent Memory - OCO Session

Last updated: 2026-10-29 KST

## Current task

2.0.20 in progress: OpenCode 2 only plus a code diet (ADR-0028). Release
2.0.19 shipped (tag v2.0.19 at f96dc67, the last version that supports
OpenCode 1). The 2.0.20 work is uncommitted on main; nothing is committed,
pushed or released yet.

## Last completed step

- `src/` refactor is final: OpenCode 1 entry, v1-only handlers and
  `@opencode-ai/*` dependencies removed; `src/v2` renamed `src/host`; the core
  uses `HostClient` (`src/host/client.ts`); toasts, pools, task archive,
  CleanupScheduler, compaction guard, global state, episode notes, decay
  metadata, concurrency auto-scaling/circuit/priority/provider/model limits,
  the slashcommand tool and race/fractal modes removed. 24 tools remain.
- README updated. docs/SYSTEM_ARCHITECTURE.md, CONTRIBUTING.md and ADR-0028
  updated/added; ADR-0022 marked superseded, ADR-0024 and ADR-0027 marked
  partially superseded.

## Next exact step

Finish the test updates (other agents were editing `tests/` in parallel),
then run build, `npm test`, and `npm run release:dry-run`.

## Incomplete items and why

- `scripts/package-smoke.mjs` still imports `opencode-orchestrator/server` and
  asserts a `server` function; it will fail against the new package until it
  is updated.
- `package.json` still has a `toml` override although no package in the
  lockfile depends on `toml`.
- A few `src` comments still mention toasts (`event-handler.ts`,
  `task-cleaner.ts`); comment-only.
- Removing the 13 Rust-backed tools and the shell listener is deferred
  (ADR-0021 Stage 3).

## Key decisions

- Shipped as a patch at the owner's request; OpenCode installs plugins from
  `@latest`, so a major bump would not protect OpenCode 1 users.
- OpenCode 1 users stay on 2.0.19.

## Rejected alternatives

- Keeping the hybrid OpenCode 1/2 entry (ADR-0024 option 3).

## Known risks

- Old option keys are silently ignored by the tolerant parser.
- Developers with an old node_modules must run `npm ci` before release
  preflight.

## Files to open first in the next session, in order

1. AGENTS.md
2. AGENT_MEMORY.md
3. docs/adr/0028-opencode-2-only-minimal-core.md
4. src/host/plugin.ts
5. src/host/client.ts
6. src/plugin-runtime.ts
7. src/core/config/options.ts
8. scripts/package-smoke.mjs
