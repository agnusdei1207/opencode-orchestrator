import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { repoRoot, run } from "./lib.mjs";

const distDir = path.join(repoRoot, "dist");
const require = createRequire(import.meta.url);

// OpenCode loads the default export and nothing else, so the published types
// describe only that object instead of shipping every internal module's .d.ts.
const PUBLIC_TYPES = `declare const plugin: {
  id: string;
  setup: (context: unknown) => Promise<() => Promise<void>>;
};
export default plugin;
`;

// Resolve the TypeScript compiler entry from the installed package instead of a
// hardcoded node_modules path, so the build keeps working under hoisted or
// non-standard dependency layouts.
function resolveTscBin() {
  const pkgJsonPath = require.resolve("typescript/package.json");
  return path.join(path.dirname(pkgJsonPath), "bin", "tsc");
}

async function bundle(entryPoint, outfile) {
  await build({
    entryPoints: [path.join(repoRoot, entryPoint)],
    bundle: true,
    outfile: path.join(repoRoot, outfile),
    platform: "node",
    format: "esm",
    sourcemap: false,
    // Keep node_modules dependencies (zod) as real runtime imports. They are
    // declared "dependencies", so npm installs them for every consumer, and
    // inlining a package can break its internal relative requires.
    packages: "external",
  });
}

run(process.execPath, [resolveTscBin(), "--noEmit"]);

await rm(distDir, { recursive: true, force: true });

await bundle("src/index.ts", "dist/index.js");
await bundle("src/cli.ts", "dist/cli.js");
await writeFile(path.join(distDir, "index.d.ts"), PUBLIC_TYPES);
