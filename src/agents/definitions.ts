import { AgentDefinition } from "../shared/agent.js";
import { AGENT_NAMES } from "../shared/agent.js";
import { orchestrator } from "./orchestrator.js";
import { architect } from "./subagents/architect.js";
import { builder } from "./subagents/builder.js";
import { inspector } from "./subagents/inspector.js";
import { recorder } from "./subagents/recorder.js";

export const AGENTS: Record<string, AgentDefinition> = {
  [AGENT_NAMES.COMMANDER]: orchestrator,
  [AGENT_NAMES.ARCHITECT]: architect,
  [AGENT_NAMES.BUILDER]: builder,
  [AGENT_NAMES.INSPECTOR]: inspector,
  [AGENT_NAMES.RECORDER]: recorder,
};
