# Fix: Plugin Fails to Load — Bundled jsonc-parser Missing Relative Imports

Date: 2026-07-02
Scope: `opencode-orchestrator` — `scripts/build.mjs` (esbuild bundling)
Status: ✅ IMPLEMENTED
Related: GitHub issue #31 (reported by @n0script22)

## 1. Root Cause

`scripts/build.mjs` bundles `src/index.ts`, `scripts/postinstall.ts`, and
`scripts/preuninstall.ts` with esbuild using default bundling (all
`dependencies` inlined). `jsonc-parser`'s UMD entry (`lib/umd/main.js`)
internally does `require("./impl/format")`, `require("./impl/edit")`, etc.
esbuild inlines the UMD wrapper's `factory()` body but leaves those
`require()` calls as literal runtime calls (they're guarded by a
`typeof module === "object"` check esbuild can't statically eliminate for a
CJS-shaped UMD module). At runtime, Node resolves `./impl/format` relative to
`dist/index.js`, where no `impl/` directory exists — the file was never
copied out of `node_modules/jsonc-parser/lib/umd/`.

Reproduced locally:
```
$ node -e "require('./dist/index.js')"
Error: Cannot find module './impl/format'
```

## 2. Why "packages: external" Is the Correct Fix (not just the reported one)

Checked OpenCode's official plugin docs (opencode.ai/docs/plugins): npm-based
plugins are installed by OpenCode itself via Bun (`npm plugins are installed
automatically using Bun at startup... cached in
~/.cache/opencode/node_modules/`). This confirms plugins are expected to
resolve their declared `dependencies` from a real `node_modules` tree at
runtime, not ship as a single self-contained bundle. Every package this repo
lists under `"dependencies"` (`jsonc-parser`, `zod`, `@opencode-ai/plugin`,
`@opencode-ai/sdk`) will always be present in `node_modules` next to `dist/`
after install (npm/Bun install `dependencies` unconditionally). So excluding
all of them from the bundle is safe, not just a workaround for jsonc-parser.

This also forecloses the *class* of bug, not just this instance — any other
dependency with internal relative requires (CJS/UMD packages in particular)
would hit the same failure once esbuild inlines it. Scoping the fix to
`external: ["jsonc-parser"]` would have left `zod` and the `@opencode-ai/*`
packages exposed to the identical failure mode if they ever ship a
relative-require internal file layout.

## 3. Fix

Add `packages: "external"` to all three `esbuild.build()` calls in
`scripts/build.mjs` (the shared `bundle()` helper), so `dist/index.js`,
`dist/scripts/postinstall.js`, and `dist/scripts/preuninstall.js` all keep
bare `import`/`require` specifiers for every `node_modules` dependency
instead of inlining them.

No `package.json` changes needed — `jsonc-parser`, `zod`,
`@opencode-ai/plugin`, and `@opencode-ai/sdk` are already declared under
`"dependencies"`, so npm/Bun install them for consumers automatically.

## 4. Verification (5 rounds)

1. `node -e "require('./dist/index.js')"` after rebuild — loads without the
   `MODULE_NOT_FOUND` crash.
2. `node dist/scripts/postinstall.js` / `preuninstall.js` smoke-load — no
   module resolution errors (also import `jsonc-parser`).
3. Full suite: `npm run test:all` (build + vitest).
4. `npm pack` into a scratch dir, `npm install` the tarball fresh, and
   `require()` the installed package's `dist/index.js` from outside the repo
   — simulates a real end-user install where only declared `dependencies`
   are present.
5. Audit for other bundling scripts with the same risk: `gen:schema` also
   uses esbuild but only bundles dev-time code that runs in-place inside the
   repo (output never ships in `files`), so it isn't exposed to this failure
   mode — no change needed there.

## 5. Release

Patch release via `npm run release:patch` after fix lands on `main`,
referencing issue #31 in the changelog/commit.
