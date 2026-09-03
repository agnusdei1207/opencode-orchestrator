# ADR-0017: Windows Config-Path Migration and Stale Cache Invalidation

Date: 2026-09-03 22:31 KST
Status: Implemented
Source: investigation session 2026-09-03 (no prior plan existed)
Report: `docs/histories/2026/09/03/REPORT_WindowsConfigPathMigration_2026-09-03.md`

## Context

`npm install -g` succeeded but `/task` never appeared: the win32 install hook
registered the plugin in `%APPDATA%/opencode`, which OpenCode never reads —
its global config is xdg-based on every OS. Separately, OpenCode caches npm
plugins under `<cache>/opencode/packages/<pkg>@<version>` and can keep
loading a stale build after reinstall (a `1.7.11` copy was found live).

## Decision

- `getConfigPaths()` mirrors OpenCode precedence on all platforms:
  `OPENCODE_CONFIG_DIR` > `XDG_CONFIG_HOME` > `~/.config/opencode`
  (testable via injectable `platform` parameter).
- `%APPDATA%/opencode` becomes legacy-only: migrated with backup on install,
  cleaned on uninstall, never a registration target.
- Postinstall clears stale cached copies (best-effort, never fails install);
  corrupt configs are backed up and left untouched.
- Opencode-managed files (`package.json`, `node_modules`, `.gitignore` in the
  config dir) are never touched.

## Consequences

- 30 install-hook tests green; full suite 115 files / 1063 pass.
- Live cycle verified: uninstall → `plugin: []`; reinstall → `plugin:
  [opencode-orchestrator]`, `commands: [task, plan, agents]`; 2 stale cache
  copies removed.
- Dead `%APPDATA%` config file removed; its backup retained as rollback.
- Shipped in 1.7.16.
