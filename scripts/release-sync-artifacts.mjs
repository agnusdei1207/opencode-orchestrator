import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const allowedArtifactPaths = new Set([
  "bin/orchestrator-linux-arm64",
  "bin/orchestrator-linux-x64",
]);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    const detail = result.signal ? `signal ${result.signal}` : `exit code ${result.status}`;
    throw new Error(`${command} ${commandArgs.join(" ")} failed with ${detail}`);
  }

  return result;
}

function readVersion() {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  return String(packageJson.version);
}

function changedPaths() {
  const result = run("git", ["status", "--porcelain"], { capture: true });
  return result.stdout
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => line.slice(3).trim())
    .filter(Boolean)
}

const paths = changedPaths();
if (paths.length === 0) {
  console.log("[release-sync-artifacts] no artifact changes detected");
  process.exit(0);
}

const unexpected = paths.filter(filePath => !allowedArtifactPaths.has(filePath));
if (unexpected.length > 0) {
  throw new Error(`Unexpected dirty release paths after artifact build: ${unexpected.join(", ")}`);
}

run("git", ["add", "-f", ...paths]);
run("git", ["commit", "--amend", "--no-edit"]);
run("git", ["tag", "-f", `v${readVersion()}`]);

console.log(`[release-sync-artifacts] amended release commit with ${paths.join(", ")}`);
