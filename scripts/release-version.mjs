import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bump = process.argv[2];
const allowedBumps = new Set(["patch", "minor", "major"]);

if (!allowedBumps.has(bump)) {
  throw new Error("Usage: node scripts/release-version.mjs <patch|minor|major>");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

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

function assertCleanWorktree() {
  const result = run("git", ["status", "--porcelain"], { capture: true });
  if (result.stdout.trim()) {
    throw new Error("Release version bump requires a clean git worktree.");
  }
}

function readVersion() {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  return String(packageJson.version);
}

assertCleanWorktree();
run(npmCommand, ["version", bump, "--no-git-tag-version", "--ignore-scripts"]);
run(npmCommand, ["run", "sync:readme-version"]);

const version = readVersion();

// Keep the Cargo workspace version in lockstep with the npm package version.
// The package-metadata test asserts they match, so bump Cargo.toml here too.
function bumpCargoVersion(nextVersion) {
  const cargoPath = path.join(repoRoot, "Cargo.toml");
  const cargo = readFileSync(cargoPath, "utf8");
  const updated = cargo.replace(
    /^version = "\d+\.\d+\.\d+"/m,
    `version = "${nextVersion}"`,
  );
  if (updated === cargo) {
    throw new Error(`Could not update Cargo workspace version to ${nextVersion}.`);
  }
  writeFileSync(cargoPath, updated);
}

bumpCargoVersion(version);
run("cargo", ["update", "-w"]);

run("git", ["add", "package.json", "package-lock.json", "README.md", "Cargo.toml", "Cargo.lock"]);

const diff = run("git", ["diff", "--cached", "--quiet"], {
  allowFailure: true,
  capture: true,
});
if (diff.status === 0) {
  throw new Error(`No staged version changes were produced for ${version}.`);
}

run("git", ["commit", "-m", version]);
run("git", ["tag", `v${version}`]);

console.log(`[release-version] prepared v${version}`);
