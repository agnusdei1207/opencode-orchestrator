import { build } from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../..");
const distDir = path.join(repoRoot, "dist");

// Every bundle that ships to npm (package.json "files" → dist) and is loaded
// at runtime on end-user machines, where only "dependencies" are installed.
const SHIPPED_BUNDLES = ["dist/index.js", "dist/scripts/postinstall.js", "dist/scripts/preuninstall.js"];

interface PackageManifest {
    dependencies?: Record<string, string>;
}

function declaredDependencies(): Set<string> {
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as PackageManifest;
    return new Set(Object.keys(manifest.dependencies ?? {}));
}

function packageNameOf(specifier: string): string {
    const segments = specifier.split("/");
    return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
}

// Matches require-like calls with a relative string literal, e.g.
// require("./impl/format"), require2("../package.json"), __require("./x").
// esbuild keeps these as runtime calls when it cannot resolve them statically
// (UMD factories receiving `require` as a parameter, createRequire usage), so
// they bypass the esbuild re-analysis below and must be checked textually.
const RELATIVE_DYNAMIC_REQUIRE = /[A-Za-z0-9_$.]*require[A-Za-z0-9_$]*\(\s*["'](\.\.?\/[^"']+)["']\s*\)/g;

function unresolvedDynamicRequires(bundlePath: string): string[] {
    const bundleDir = path.dirname(path.join(repoRoot, bundlePath));
    const source = readFileSync(path.join(repoRoot, bundlePath), "utf8");
    const unresolved: string[] = [];

    for (const match of source.matchAll(RELATIVE_DYNAMIC_REQUIRE)) {
        const specifier = match[1];
        const base = path.resolve(bundleDir, specifier);
        const resolves = ["", ".js", ".json", ".cjs", ".mjs"].some((extension) => existsSync(base + extension)) || existsSync(path.join(base, "index.js"));

        if (!resolves) {
            unresolved.push(specifier);
        }
    }

    return unresolved;
}

async function collectBareImports(bundlePath: string): Promise<Set<string>> {
    const bareImports = new Set<string>();

    // Re-analyze the shipped bundle with esbuild: relative specifiers are
    // resolved against the real dist/ tree, so a bundle that leaks a
    // node_modules-internal path like "./impl/format" (issue #31) fails here
    // instead of on an end user's machine. Bare specifiers are collected and
    // checked against package.json "dependencies" below.
    await build({
        entryPoints: [path.join(repoRoot, bundlePath)],
        bundle: true,
        write: false,
        platform: "node",
        format: "esm",
        logLevel: "silent",
        plugins: [
            {
                name: "collect-bare-imports",
                setup(pluginBuild) {
                    pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => {
                        bareImports.add(args.path);
                        return { path: args.path, external: true };
                    });
                },
            },
        ],
    });

    return bareImports;
}

describe.skipIf(!existsSync(path.join(distDir, "index.js")))("dist bundle integrity", () => {
    it("ships every runtime bundle", () => {
        for (const bundlePath of SHIPPED_BUNDLES) {
            expect(existsSync(path.join(repoRoot, bundlePath)), `${bundlePath} missing — run npm run build`).toBe(true);
        }
    });

    it.each(SHIPPED_BUNDLES)("%s resolves all relative imports and only declared dependencies", async (bundlePath) => {
        const dependencies = declaredDependencies();

        // Throws if any relative import inside the bundle points at a file
        // that does not exist under dist/ (the issue #31 failure mode).
        const bareImports = await collectBareImports(bundlePath);

        // Every external (bare) import must be a Node builtin or a package
        // declared under "dependencies" — devDependencies are absent on
        // end-user installs, so a leaked one crashes only in production.
        const undeclared = [...bareImports].filter((specifier) => !isBuiltin(specifier) && !dependencies.has(packageNameOf(specifier)));

        expect(undeclared, `${bundlePath} imports packages missing from "dependencies": ${undeclared.join(", ")}`).toEqual([]);
    });

    it.each(SHIPPED_BUNDLES)("%s has no dynamic requires of files missing from the package", (bundlePath) => {
        // Catches inlined node_modules internals like require("./impl/format")
        // from jsonc-parser's UMD wrapper (issue #31) — calls that only fail
        // at load time on end-user machines.
        const unresolved = unresolvedDynamicRequires(bundlePath);

        expect(unresolved, `${bundlePath} dynamically requires files that do not ship: ${unresolved.join(", ")}`).toEqual([]);
    });

    it("dist/index.js loads and exposes the plugin entrypoint", async () => {
        const mod = await import(pathToFileURL(path.join(distDir, "index.js")).href);

        expect(typeof mod.default).toBe("function");
    });
});
