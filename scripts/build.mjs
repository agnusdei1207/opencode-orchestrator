import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "dist");
const require = createRequire(import.meta.url);

// Resolve the TypeScript compiler entry from the installed package instead of a
// hardcoded node_modules path, so the build keeps working under hoisted or
// non-standard dependency layouts.
function resolveTscBin() {
  const pkgJsonPath = require.resolve("typescript/package.json");
  return path.join(path.dirname(pkgJsonPath), "bin", "tsc");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      const detail = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`${command} ${args.join(" ")} failed with ${detail}`));
    });
  });
}

async function bundle(entryPoint, outfile, options = {}) {
  await build({
    entryPoints: [path.join(repoRoot, entryPoint)],
    bundle: true,
    outfile: path.join(repoRoot, outfile),
    platform: "node",
    format: "esm",
    sourcemap: true,
    ...options,
  });
}

await rm(distDir, { recursive: true, force: true });

await bundle("src/index.ts", "dist/index.js");

await run(process.execPath, [resolveTscBin(), "--emitDeclarationOnly"]);

await mkdir(path.join(distDir, "scripts"), { recursive: true });

await bundle("scripts/postinstall.ts", "dist/scripts/postinstall.js", {
  mainFields: ["module", "main"],
});

await bundle("scripts/preuninstall.ts", "dist/scripts/preuninstall.js", {
  mainFields: ["module", "main"],
});
