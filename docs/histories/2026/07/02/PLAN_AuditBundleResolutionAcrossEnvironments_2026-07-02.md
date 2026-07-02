# Audit: Bundle Resolution Across Environments (Follow-up to Issue #31)

Date: 2026-07-02
Scope: `opencode-orchestrator` — dist bundle integrity, package exports, regression guard
Status: ✅ IMPLEMENTED
Related: GitHub issue #31, commit c89779b (`packages: "external"` fix), release 1.7.1

## 1. Goal

Issue #31 (plugin crash on load: `Cannot find module './impl/format'`) was fixed
in c89779b and shipped in 1.7.1. This audit verifies the published fix in every
runtime environment the package targets and forecloses the whole class of
module-resolution failures, not just the jsonc-parser instance.

## 2. Verification of the Published Fix (Evidence)

All checks run against the actual npm registry artifact, not the local tree:

1. `npm pack opencode-orchestrator@1.7.1` → extracted `dist/index.js` contains
   zero `impl/format` references and imports `from "jsonc-parser"` as a bare
   external specifier. The broken inlined UMD wrapper is gone.
2. Fresh consumer install (`npm install opencode-orchestrator@1.7.1` in an
   empty project, sandboxed `$HOME`): postinstall hook ran cleanly under Node
   and `import("opencode-orchestrator")` loaded with the expected default
   export.
3. Bun 1.3.14 (OpenCode's actual plugin runtime — the issue's `ResolveMessage`
   is a Bun error class): `import("opencode-orchestrator")` and
   `import("jsonc-parser")` both resolve (Bun picks jsonc-parser's `module`
   ESM entry).
4. Plain Node 24 ESM: named imports (`parse`, `applyEdits`, `modify`,
   `printParseErrorCode`) from jsonc-parser's UMD `main` entry resolve via
   cjs-module-lexer — this is the path the install hooks
   (`dist/scripts/postinstall.js` / `preuninstall.js`) exercise, since npm
   runs them under Node, not Bun.
5. Reproduced the pre-fix failure from source (esbuild bundle of
   `src/index.ts` without `packages: "external"`): crashes with
   `Dynamic require of "./impl/format" is not supported` — confirming the
   root cause analysis and giving a known-bad artifact to validate the new
   regression guard against.

## 3. Gaps Found and Fixed

### 3.1 No regression guard for the failure class

`packages: "external"` silently shifts a new risk onto consumers: if a module
under `src/` (or the install hooks) ever imports a package that is only in
`devDependencies`, the build still succeeds and every repo-local test still
passes (devDependencies are installed here) — but the published bundle crashes
on end-user machines where only `dependencies` exist. Nothing in the test
suite or release preflight checked for this, nor for a regression of the
inlined-relative-require bug itself.

Added `tests/unit/dist-integrity.test.ts`, which for every shipped bundle
(`dist/index.js`, `dist/scripts/postinstall.js`, `dist/scripts/preuninstall.js`):

- Re-analyzes the bundle with esbuild so every static relative import must
  resolve against the real `dist/` tree (fails on missing files instead of on
  an end user's machine).
- Asserts every bare specifier is a Node builtin or declared under
  `"dependencies"` (catches devDependency leaks, scoped packages handled).
- Textually scans for require-like calls with relative string literals
  (`require("./impl/format")`, `require2("../package.json")`, `__require(...)`)
  — the shape esbuild leaves behind when a UMD factory receives `require` as a
  parameter, which static re-analysis cannot see — and asserts each resolves
  to a file that actually ships. Validated against the reproduced pre-fix
  bundle: catches all four `./impl/*` requires.
- Smoke-imports `dist/index.js` and asserts the plugin default export is a
  function (the exact crash path from issue #31; also covers the intentional
  `require("../package.json")` version read in `src/index.ts`).

The suite runs inside `npm run test:all` and the release preflight (which
builds before testing), so a regression cannot reach npm again.

### 3.2 `exports` map had no fallback condition

`package.json` `"exports"` declared only `types` and `import`. Any consumer
resolving with a different condition — `require()` under Node ≥ 22 (legal for
ESM files since require(esm) landed), or bundlers/runtimes that do not match
`import` — got `ERR_PACKAGE_PATH_NOT_EXPORTED`. Added
`"default": "./dist/index.js"`.

## 4. Audited and Confirmed Safe (No Change Needed)

- **Shipped-code import surface**: every bare import across `src/` and the
  install hooks is a Node builtin or one of the four declared dependencies.
  `esbuild`/`vitest` matches in `src/` are prompt-string content, not imports.
- **tsconfig path aliases**: none configured, so `packages: "external"` cannot
  leave an unresolvable alias specifier in the output.
- **`gen:schema`**: bundles dev-time code into `node_modules/.cache/`, never
  ships; not exposed to this failure mode.
- **`scripts/run-install-hook.mjs`**: imports Node builtins only; guards
  missing entrypoints gracefully.
- **Package-manager layouts**: externalization is safe under npm (nested and
  hoisted), Bun's plugin cache (`~/.cache/opencode/node_modules`), pnpm's
  strict layout, and Yarn PnP — precisely because every runtime import is a
  declared dependency, which the new guard keeps true.
- **`require2("../package.json")` in `dist/index.js`**: resolves from both
  `src/` and `dist/` (each one level below the package root); exercised by the
  smoke-import test.

## 5. Release

Patch release (1.7.2) after this audit lands on `main`.
