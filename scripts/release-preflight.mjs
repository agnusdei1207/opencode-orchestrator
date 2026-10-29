import { commandIsAvailable, readPackageJson, run, runNpm } from "./lib.mjs";

const args = new Set(process.argv.slice(2));

function runRustQualityChecks() {
  const cargoCommands = [
    ["fmt", "--all", "--", "--check"],
    ["clippy", "--locked", "--workspace", "--all-targets", "--", "-D", "warnings"],
    ["test", "--locked", "--workspace", "--all-targets"],
  ];
  if (commandIsAvailable("cargo", ["--version"])) {
    for (const cargoArgs of cargoCommands) {
      run("cargo", cargoArgs);
    }
    return;
  }

  console.log("[release-preflight] cargo unavailable; using Docker for Rust quality checks");
  const command = [
    "rustup component add rustfmt clippy",
    ...cargoCommands.map(cargoArgs => ["cargo", ...cargoArgs].join(" ")),
  ].join(" && ");
  run("docker", ["compose", "run", "--rm", "--no-deps", "test", "sh", "-c", command]);
}

function assertCleanWorktree() {
  if (args.has("--allow-dirty")) {
    return;
  }

  const result = run("git", ["status", "--porcelain"], { capture: true });
  if (result.stdout.trim()) {
    throw new Error("Release preflight requires a clean git worktree.");
  }
}

function assertBranch() {
  if (args.has("--skip-branch")) {
    return;
  }

  const expected = process.env.OCO_RELEASE_BRANCH ?? "main";
  const result = run("git", ["branch", "--show-current"], { capture: true });
  const current = result.stdout.trim();
  if (current !== expected) {
    throw new Error(`Release preflight requires branch ${expected}; current branch is ${current}.`);
  }
}

function assertVersionIsUnpublished() {
  if (args.has("--skip-version-check")) {
    return;
  }

  const packageJson = readPackageJson();
  const spec = `${packageJson.name}@${packageJson.version}`;
  const result = runNpm(["view", spec, "version", "--json"], {
    allowFailure: true,
    capture: true,
  });

  if (result.status === 0 && result.stdout.trim()) {
    throw new Error(`${spec} already exists in the npm registry.`);
  }
}

console.log("[release-preflight] checking git state");
assertCleanWorktree();
assertBranch();
assertVersionIsUnpublished();

console.log("[release-preflight] running build");
runNpm(["run", "build"]);

console.log("[release-preflight] running tests with coverage thresholds");
runNpm(["run", "test:coverage"]);

console.log("[release-preflight] running Rust quality checks");
runRustQualityChecks();

console.log("[release-preflight] auditing published dependencies");
runNpm(["audit", "--omit=dev", "--json"]);

console.log("[release-preflight] validating installed dependency tree");
runNpm(["ls", "--depth=0"]);

console.log("[release-preflight] smoke-testing the packed package");
run(process.execPath, ["scripts/package-smoke.mjs", "--skip-cli"]);

console.log("[release-preflight] passed");
