import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { commandIsAvailable, readPackageJson, repoRoot, run, runNpm } from "./lib.mjs";

const bump = process.argv[2];
const allowedBumps = new Set(["patch", "minor", "major"]);

if (!allowedBumps.has(bump)) {
  throw new Error("Usage: node scripts/release-version.mjs <patch|minor|major>");
}

function assertCleanWorktree() {
  const result = run("git", ["status", "--porcelain"], { capture: true });
  if (result.stdout.trim()) {
    throw new Error("Release version bump requires a clean git worktree.");
  }
}

// Sync workspace member versions without touching the dependency graph.
// Equivalent to `cargo update -w` for a pure version bump (path members
// carry no source/checksum lines), used when cargo is unavailable.
function patchCargoLock(nextVersion) {
  const lockPath = path.join(repoRoot, "Cargo.lock");
  const lock = readFileSync(lockPath, "utf8");
  const updated = lock.replace(
    /^(name = "orchestrator-(?:cli|core)"\nversion = ")\d+\.\d+\.\d+(")/gm,
    `$1${nextVersion}$2`,
  );
  if (updated === lock) {
    throw new Error(`Could not update Cargo.lock workspace versions to ${nextVersion}.`);
  }
  writeFileSync(lockPath, updated);
}

function readVersion() {
  return String(readPackageJson().version);
}

assertCleanWorktree();
runNpm(["version", bump, "--no-git-tag-version", "--ignore-scripts"]);
runNpm(["run", "sync:readme-version"]);

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
if (commandIsAvailable("cargo", ["--version"])) {
  run("cargo", ["update", "-w"]);
} else {
  console.log("[release-version] cargo unavailable; patching workspace versions in Cargo.lock directly");
  patchCargoLock(version);
}

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
