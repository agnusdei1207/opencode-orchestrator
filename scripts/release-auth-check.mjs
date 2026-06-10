import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const result = spawnSync(npmCommand, ["whoami"], {
  encoding: "utf8",
  stdio: "pipe",
  shell: false,
});

if (result.status !== 0) {
  const stderr = result.stderr.trim();
  const detail = stderr ? `\n${stderr}` : "";
  throw new Error(
    `Release publish requires npm authentication before version bump.${detail}\nRun npm adduser or configure a valid npm auth token, then retry.`,
  );
}

console.log(`[release-auth-check] npm authenticated as ${result.stdout.trim()}`);
