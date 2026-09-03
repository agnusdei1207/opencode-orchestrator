import { spawnSync } from "node:child_process";
import path from "node:path";

// Same launcher as release-preflight: npm.cmd cannot be spawned with
// shell:false on win32 (EINVAL), so drive npm-cli.js with node instead.
const npmCliPath = process.env.npm_execpath
  ?? path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npmCommand = process.platform === "win32" ? process.execPath : "npm";
const npmArgsPrefix = process.platform === "win32" ? [npmCliPath] : [];

const result = spawnSync(npmCommand, [...npmArgsPrefix, "whoami"], {
  encoding: "utf8",
  stdio: "pipe",
  shell: false,
});

if (result.status !== 0) {
  const stderrText = typeof result.stderr === "string" ? result.stderr.trim() : "";
  const spawnDetail = result.error ? String(result.error.message ?? result.error) : "";
  const detail = [stderrText, spawnDetail].filter(Boolean).join("\n");
  const suffix = detail ? `\n${detail}` : "";
  throw new Error(
    `Release publish requires npm authentication before version bump.${suffix}\nRun npm adduser or configure a valid npm auth token, then retry.`,
  );
}

console.log(`[release-auth-check] npm authenticated as ${result.stdout.trim()}`);
