# Agent Memory - OCO Session

Last updated: 2026-09-24 KST

## Current task

Delegate plugin installation and removal to OpenCode, remove the old package
configuration hooks, and complete release QA.

## Last completed step

Released `v2.0.2` from `main`. Local preflight passed the build, 995 TypeScript
tests, 57 Rust tests, Rust formatting and Clippy, production dependency audit,
and isolated packed-package smoke. The hosted release workflow passed all five
platform builds, package smoke, npm publication, and GitHub release creation.
Downloaded the public npm package in Docker and verified the CLI version,
absence of npm install/uninstall hooks, and OpenCode 2 plugin add/list/check/
remove. Downloaded the public Windows binary on the host and verified its
version and help output.

## Next exact step

On the next request, open the restore files below in order, check Git status
and the published version, then follow the requested scope.

## Incomplete items and why

None in the requested plugin installation migration. OpenCode 1.18.29+ runtime
support remains intentionally available through its native `plugin` config.

## Key decisions

- OpenCode 2 owns plugin registration through `opencode plugin add/remove`.
- npm installation no longer edits OpenCode config or runs custom lifecycle hooks.
- The optional Rust terminal CLI keeps non-install commands only.
- A release workflow concurrency group serializes duplicate runs for one tag.
- Routine QA excludes benchmarks.

## Rejected alternatives

- Retaining npm `postinstall`/`preuninstall` config mutation and Rust
  `install`/`uninstall` commands.
- Removing OpenCode 1 runtime support as part of the package lifecycle change.

## Known risks

- One Rust LSP test failed once during the first 2.0.1 preflight. It passed in
  an isolated rerun, the full Rust suite rerun, and subsequent full preflights;
  the cause was not reproduced.
- npm registry metadata may lag a successful publish for several minutes.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `README.md`
4. `package.json`
5. `src/index.ts`
6. `scripts/package-smoke.mjs`
7. `.github/workflows/release.yml`
