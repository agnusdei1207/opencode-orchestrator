# Agent Memory - OCO Session

Last updated: 2026-09-24 KST

## Current task

Complete evidence-based QA for `2.0.2` and fix the OpenCode 2 agent registration
failure while keeping the version at `2.0.2`.

## Last completed step

The published `2.0.2` package loaded in OpenCode 2.0.16, but its live agent
list contained none of Commander, Planner, Worker, or Reviewer. Added a V2
agent transform and observed the regression test fail before the fix and pass
afterward. A Docker OpenCode server loaded the locally built plugin with all
four agents, the expected commands, and delegation tools. User agent settings
overrode the defaults, and reloading without the plugin removed its agents and
commands. Docker TypeScript build and all 995 tests passed; Rust formatting,
Clippy, and all 57 tests passed during baseline QA. Windows build and 14 focused
tests passed. A clean Docker clone using the published `2.0.2` binaries passed
the full package smoke, and the production dependency audit found zero issues.

## Next exact step

On the next request, open the restore files below in order, check Git status
and the published version, then follow the requested scope. Keep version
`2.0.2` unless the user explicitly changes that instruction.

## Incomplete items and why

- The published npm `2.0.2` package still lacks the V2 agent registration fix.
  The user explicitly instructed that the version stay at `2.0.2`, and an npm
  version cannot be republished in place.
- `.qa-public-package/` remains in the workspace. Automatic approval review
  blocked recursive removal of that isolated QA directory as a policy action.

## Key decisions

- Register V2 agents with `context.agent.transform().update()`, which creates
  missing agents in the host; retain the V1 config path unchanged.
- Commander is primary and visible; Planner, Worker, and Reviewer are hidden
  subagents. Let later OpenCode config override these defaults.
- Keep npm lifecycle installation and removal delegated to OpenCode.
- Use a clean Docker clone and published release binaries for package smoke;
  local ignored `bin/` files are not release artifacts.
- Do not run benchmarks or change the package version during this QA task.

## Rejected alternatives

- Reintroducing npm config mutation hooks or Rust install/uninstall commands.
- Replacing a built-in OpenCode agent instead of registering the four agents.
- Publishing another version against the user's explicit version hold.

## Known risks

- npm latest remains `2.0.2` and does not contain the agent fix.
- The ignored local `bin/orchestrator-linux-x64` reports `1.7.24`; running
  package smoke directly in this dirty workspace fails its version check.
- One Rust LSP test had failed once in an earlier preflight, then passed in
  isolated and full reruns, including this baseline QA.

## Files to open first in the next session, in order

1. `AGENTS.md`
2. `AGENT_MEMORY.md`
3. `package.json`
4. `src/v2/setup.ts`
5. `src/v2/agent-adapter.ts`
6. `tests/unit/v2-plugin.test.ts`
7. `README.md`
8. `scripts/package-smoke.mjs`
