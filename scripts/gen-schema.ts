/**
 * Regenerate the public plugin-options JSON Schema from the Zod source of truth.
 * Run: node --experimental-strip-types scripts/gen-schema.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { orchestratorOptionsJsonSchema } from "../src/core/config/options-schema.ts";

const repoRoot = process.cwd();
const target = path.join(repoRoot, "opencode-orchestrator.schema.json");
const schema = orchestratorOptionsJsonSchema();
writeFileSync(target, JSON.stringify(schema, null, 2) + "\n", "utf8");
console.log(`[gen-schema] wrote ${path.relative(repoRoot, target)}`);
