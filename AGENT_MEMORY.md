# Agent Memory - OCO Session

Last updated: 2026-09-24 KST

## Current task

Release a tested npm patch for GitHub issues #44, #45, and #46, then install
the published package from npm, verify it, and close the issues in English.

## Last completed step

Implemented per-agent temperature, accurate verification advisories, and
synthetic native command instructions for both OpenCode 1 and 2. An independent
read-only code review found two defects; both were reproduced, fixed, and
reviewed again with no remaining findings. Refreshed the supported OpenCode 1
and 2 contracts to 1.18.32 and 2.0.15. `npm ci --ignore-scripts` succeeded.
`npm run release:dry-run` passed: build, 1,052 TypeScript tests with coverage,
64 Rust tests with format and Clippy checks, production dependency audit,
dependency tree validation, and packed-package postinstall smoke test.
`npx tsc --noEmit` and `git diff --check` passed. Generated the public options
schema from its Zod source. English thank-you comments are on issues #44-46.

## Next exact step

Reread changed files and connection paths, update any remaining release notes,
commit the issue fixes and dependency updates, then run `npm run release:patch`
to prepare v1.7.23, recheck the release gate, and atomically push main and tag.
Observe GitHub Actions through npm publication, install v1.7.23 in an isolated
consumer, verify CLI and plugin entrypoints, then update and close issues #44-46.

## Incomplete items and why

- v1.7.23 is not committed, tagged, pushed, or published yet.
- Registry download and install QA requires publication.
- Live interactive OpenCode UI behavior was not exercised; the host contracts,
  source paths, and plugin boundaries were checked directly.
- Issue comments still say publication is pending, and issues remain open.

## Key decisions

- V1 native command parts are marked synthetic only when the expanded template
  belongs to this plugin; V2 injects via `session.synthetic`.
- Verification advisory tracks only files changed after the latest recognized
  verification; TODO, checklist, and sync-issues remain completion authority.
- `agentTemperatures` is opt-in; unsupported V1 models retain host settings.
- Dependency refresh stays within the tested OpenCode 1 and 2 patch lines.
- The tag-triggered GitHub Actions workflow publishes npm after QA and binary
  builds. The release script pushes the main branch and tag atomically.

## Rejected alternatives

- Avoid broad major-version dependency upgrades during this patch release.
- Do not close issues before the published package passes registry install QA.

## Known risks

- V2 context exposes a model reference without a temperature capability flag;
  users should configure temperature only for models that support it.
- Verification-command detection remains heuristic and advisory only.

## Files to open first in the next session, in order

1. `AGENT_MEMORY.md`
2. `.github/workflows/release.yml`
3. `scripts/release-version.mjs`
4. `scripts/release-preflight.mjs`
5. `scripts/release-push.mjs`
6. `src/core/loop/evidence.ts`
7. `src/plugin-handlers/command-execute-handler.ts`
8. `src/v2/command-adapter.ts`
9. `package.json`
