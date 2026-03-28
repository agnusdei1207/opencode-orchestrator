import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const readmePath = path.join(repoRoot, "README.md");

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const readme = readFileSync(readmePath, "utf8");
const versionLine = `  <!-- VERSION:START -->
  **Version:** \`${packageJson.version}\`
  <!-- VERSION:END -->`;
const versionBlockPattern = /  <!-- VERSION:START -->(?:\\n|\n)[\s\S]*?(?:\\n|\n)  <!-- VERSION:END -->/;

if (!versionBlockPattern.test(readme)) {
  throw new Error("README.md is missing the VERSION marker block.");
}

const nextReadme = readme.replace(versionBlockPattern, versionLine);

if (nextReadme !== readme) {
  writeFileSync(readmePath, nextReadme);
}
