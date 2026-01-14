import { AgentDefinition } from "./types.js";
import { orchestrator } from "./orchestrator.js";
import { planner } from "./planner.js";
import { coder } from "./coder.js";
import { reviewer } from "./reviewer.js";
import { fixer } from "./fixer.js";
import { searcher } from "./searcher.js";

export const AGENTS: Record<string, AgentDefinition> = {
  orchestrator,
  planner,
  coder,
  reviewer,
  fixer,
  searcher,
};
