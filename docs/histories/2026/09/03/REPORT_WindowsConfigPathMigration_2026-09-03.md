# Report: Windows Install Hook Registered in a Config OpenCode Never Reads

Date: 2026-09-03
Scope: `scripts/opencode-config.ts`, `scripts/postinstall.ts`, `scripts/preuninstall.ts`, `tests/unit/install-hooks.test.ts`, `README.md`

## Symptom

`npm install -g opencode-orchestrator` succeeded, but `/task`, `/plan`, `/agents`
never appeared in OpenCode. `opencode debug config` showed `"plugin": []`.

## Root cause

Two independent facts combined:

1. OpenCode resolves its global config from **xdg-basedir on every platform**
   (`packages/core/src/global.ts`: `config = path.join(xdgConfig!, app)`), i.e.
   `$XDG_CONFIG_HOME/opencode` else `~/.config/opencode` — including win32.
   `loadGlobal` reads only that dir. `%APPDATA%` is used solely for the Tauri
   desktop app id (`ai.opencode.desktop`), never for CLI plugin config
   (reference: `oh-my-openagent/packages/claude-code-compat-core/src/shared/opencode-config-dir.ts`
   `getCliDefaultConfigDir`, which likewise never touches `APPDATA`).
2. Our `getConfigPaths()` put `%APPDATA%/opencode` first on win32, so
   postinstall registered the plugin in a file OpenCode never loads.

A second, latent failure of the same family: OpenCode caches npm plugins under
`<cache>/opencode/packages/<pkg>@<version>` and can keep loading a stale build
after reinstall (pattern and fix borrowed from oh-my-openagent's
`postinstall.mjs` `invalidateOpenCodePluginCache`).

## Fix

- `getConfigPaths()` now mirrors OpenCode precedence on all platforms:
  `OPENCODE_CONFIG_DIR` > `XDG_CONFIG_HOME/opencode` > `~/.config/opencode`.
  Takes an injectable `platform` parameter (default `process.platform`) so win32
  ordering is unit-testable on any CI OS.
- New `getLegacyConfigPaths()`: win32 `%APPDATA%/opencode`, empty elsewhere.
  Used for migration/cleanup only, never registration.
- New `removeOurPluginEntries()`: backup → filter → atomic write → verify →
  rollback on failure. Corrupt configs are backed up and left untouched.
- `postinstall`: clears stale cached copies (`getCacheDir()` /
  `invalidateStalePluginCache()`, best-effort, never fails the install), then
  migrates legacy entries before normal registration.
- `preuninstall`: iterates registration paths **plus** legacy paths.
- `README.md`: troubleshooting subsection for missing `/task`.

## Verification (all measured, none assumed)

- `tests/unit/install-hooks.test.ts`: 16 → 30 tests, all pass.
- Full suite: 115 files / 1063 tests pass. `npm run build` + `tsc --noEmit` clean.
- Live Windows cycle on the affected machine:
  - preuninstall → `debug config`: `plugin: []`, `commands: []`.
  - postinstall → `Cleared 2 stale cached copies`
    (`opencode-orchestrator@1.7.11`, `@latest`), registered in
    `C:\Users\pf\.config\opencode\opencode.jsonc` (sibling `permission: allow`
    preserved, backup written).
  - `debug config`: `plugin: [opencode-orchestrator]`,
    origin `C:\Users\pf\.config\opencode`, `commands: [task, plan, agents]`,
    `agents: [Commander, Planner, Worker, Reviewer]`.
  - Dead `%APPDATA%\opencode\opencode.jsonc` (`{"plugin": []}`) removed; its
    `.backup.*` retained.
- Deliberately NOT touched: `~/.config/opencode/{package.json,package-lock.json,
  node_modules,.gitignore}` — created and managed by OpenCode itself
  (`Config.ensureGitignore` / `Npm.install`).

## Rejected alternatives

- Simply reordering win32 paths to `[.config, APPDATA]`: the "already
  registered" scan would find the stale APPDATA entry first and stop, never
  registering in the real file. Migration (remove-then-register) is required,
  not reordering.
- Deleting the whole APPDATA config dir: it may hold non-plugin user data in
  other setups; entry-level removal with backup is the smaller invariant.
