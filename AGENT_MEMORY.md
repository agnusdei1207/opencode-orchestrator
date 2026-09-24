# Agent Memory - OCO Session

Last updated: 2026-09-24 KST

## Current task

Correct the root README so prospective maintainers are asked to open a new issue,
close the issue mistakenly opened for that invitation, and publish the correction.
The task is complete.

## Last completed step

Corrected the contribution sentence in README: PRs are appreciated, and anyone
wanting maintainer access should open a new issue. Removed the #47 link. Closed
issue #47 as not planned with a short English correction. Committed the README
as `02fbb1e` and released `v1.7.27` at `7863d11`. Local preflight passed 117
TypeScript files / 1,057 tests, 64 Rust tests with format and Clippy checks in
Docker, production dependency audit, dependency validation, and packed-install
smoke. GitHub Actions run 35994035183 passed and published five release assets
and the npm package. A fresh Docker registry install and a Windows registry
upgrade verified the corrected README, absence of the #47 link, plugin
registration, all five binaries, JavaScript CLI, and native CLI. No benchmark
ran.

## Next exact step

On the next request, open the restore files below in order, check Git status,
npm latest, and open issues, then continue the requested scoped work.

## Incomplete items and why

None for the requested documentation and release work. The automatic approval
review blocked deletion of three temporary QA artifacts under the Windows Temp
directory, so they remain there.

## Key decisions

- Keep the root README focused on the first-use path and link detailed development and architecture documents.
- Preserve the README version markers used by `scripts/sync-readme-version.mjs`.
- Place the maintainer invitation only in README and link to the new-issue form.
- Close the mistakenly created issue #47 and explain the correction in English.
- Publish a patch because the npm 1.7.26 README is immutable.

## Rejected alternatives

- Keep issue #47 open as a standing maintainer invitation.
- Leave the already published npm 1.7.26 README incorrect; registry versions are immutable.

## Known risks

- A live interactive OpenCode UI session is outside this documentation check.
- Temporary QA artifacts remain under `C:\Users\pf\AppData\Local\Temp\`:
  `oco-registry-qa-91e5f51063064fc7a182d68ccb629ec7`,
  `oco-registry-qa-01c3343bfae84338920f9196ca33430d`, and
  `oco-npm-linux-qa-ca699133d00f46deb83909e1ad346db5.sh`.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `README.md`
4. `CONTRIBUTING.md`
5. `package.json`
6. `src/index.ts`
7. `src/tools/slashCommand.ts`
8. `scripts/release-preflight.mjs`
9. `.github/workflows/release.yml`
