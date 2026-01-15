import { AgentDefinition } from "../shared/contracts/interfaces.js";
import { AGENT_NAMES } from "../shared/contracts/names.js";
import { orchestrator } from "./orchestrator.js";
import { architect } from "./subagents/architect.js";
import { builder } from "./subagents/builder.js";
import { inspector } from "./subagents/inspector.js";
import { recorder } from "./subagents/recorder.js";
import { frontendDesigner } from "./subagents/frontend-designer.js";

export const AGENTS: Record<string, AgentDefinition> = {
  [AGENT_NAMES.COMMANDER]: orchestrator,
  [AGENT_NAMES.ARCHITECT]: architect,
  [AGENT_NAMES.BUILDER]: builder,
  [AGENT_NAMES.INSPECTOR]: inspector,
  [AGENT_NAMES.RECORDER]: recorder,
  [AGENT_NAMES.FRONTEND_DESIGNER]: frontendDesigner,
};
