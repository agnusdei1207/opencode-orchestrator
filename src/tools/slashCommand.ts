import { tool } from "@opencode-ai/plugin";
import { AGENT_NAMES, PROMPTS, MISSION } from "../shared/constants.js";
import { orchestrator } from "../agents/orchestrator.js";

/**
 * Slash commands for OpenCode Orchestrator
 * - /task: Mission mode trigger with full Commander prompt
 * - /plan: Planning only
 * - /agents: Show architecture
 */

// ============================================================================
// COMMANDER SYSTEM PROMPT - Imported from orchestrator.ts (single source of truth)
// ============================================================================
export const COMMANDER_SYSTEM_PROMPT = orchestrator.systemPrompt;

// ============================================================================
// MISSION MODE TEMPLATE - Wraps user request with Commander instructions
// ============================================================================
export const MISSION_MODE_TEMPLATE = `${COMMANDER_SYSTEM_PROMPT}

<mission>
<task>
$ARGUMENTS
</task>

<execution_rules>
1. Complete this mission without user intervention
2. Use your full capabilities: research, implement, verify
3. Output "${MISSION.COMPLETE}" when done
</execution_rules>
</mission>`;

// ============================================================================
// SLASH COMMANDS
// ============================================================================
export const COMMANDS: Record<string, { description: string; template: string; argumentHint?: string }> = {
  "task": {
    description: "🚀 MISSION MODE - Execute task autonomously until complete",
    template: MISSION_MODE_TEMPLATE,
    argumentHint: '"mission goal"',
  },
  "plan": {
    description: "Create a task plan without executing",
    template: `<delegate>
<agent>${AGENT_NAMES.ARCHITECT}</agent>
<objective>Create parallel task plan for: $ARGUMENTS</objective>
<success>Valid JSON with tasks array, each having id, description, agent, parallel_group, dependencies, and success criteria</success>
<must_do>
- Maximize parallelism by grouping independent tasks
- Assign correct agent to each task (${AGENT_NAMES.BUILDER} or ${AGENT_NAMES.INSPECTOR})
- Include clear success criteria for each task
</must_do>
<must_not>
- Do not implement any tasks, only plan
- Do not create tasks that depend on each other unnecessarily
</must_not>
<context>
- This is planning only, no execution
- Output must be valid JSON
</context>
</delegate>`,
    argumentHint: '"complex task to plan"',
  },
  "agents": {
    description: "Show the 7-agent architecture",
    template: `## 🎯 OpenCode Orchestrator - 7-Agent Architecture

| Agent | Role | Capabilities |
|-------|------|--------------|
| **${AGENT_NAMES.COMMANDER}** 🎯 | Orchestrator | Autonomous mission control, parallel task coordination, never stops until ✅ MISSION COMPLETE |
| **${AGENT_NAMES.ARCHITECT}** 🏗️ | Strategic Planner | Task decomposition, dependency analysis, parallel group optimization |
| **${AGENT_NAMES.BUILDER}** 🔨 | Full-Stack Developer | Code implementation, file operations, terminal commands, UI + logic |
| **${AGENT_NAMES.INSPECTOR}** 🔍 | Quality Assurance | 5-point audit, LSP diagnostics, auto-fix bugs, test verification |
| **${AGENT_NAMES.RECORDER}** 💾 | Context Manager | Progress tracking, state persistence, session memory across restarts |
| **${AGENT_NAMES.LIBRARIAN}** 📚 | Research Specialist | API documentation lookup, anti-hallucination, cache official docs |
| **${AGENT_NAMES.RESEARCHER}** 🔬 | Pre-task Analyst | Deep investigation before implementation, gathers all needed info |

## ⚡ Parallel Execution System
\`\`\`
Up to 50 agents running simultaneously
Max 10 per agent type (auto-queues excess)
Auto-timeout: 60 min | Auto-cleanup: 30 min
\`\`\`

## 🔄 Execution Flow
\`\`\`
TRIAGE → RESEARCH → DELEGATE → EXECUTE → VERIFY → COMPLETE
   L1: Fast Track (simple fixes)
   L2: Normal Track (features)
   L3: Deep Track (complex refactoring)
\`\`\`

## 🛡️ Anti-Hallucination
- ${AGENT_NAMES.LIBRARIAN} researches BEFORE implementation
- webfetch caches official documentation
- Never assumes - always verifies from sources

## 💡 Usage
- Select **${AGENT_NAMES.COMMANDER}** and type your request
- Or use \`/task "your mission"\` explicitly
- ${AGENT_NAMES.COMMANDER} automatically coordinates all agents`,
  },
};

export function createSlashcommandTool() {
  const commandList = Object.entries(COMMANDS)
    .map(([name, cmd]) => {
      const hint = cmd.argumentHint ? ` ${cmd.argumentHint}` : "";
      return `- /${name}${hint}: ${cmd.description}`;
    })
    .join("\n");

  return tool({
    description: `Available commands:\n${commandList}`,
    args: {
      command: tool.schema.string().describe("Command name (without slash)"),
    },
    async execute(args) {
      const cmdName = (args.command || "").replace(/^\//, "").split(/\s+/)[0].toLowerCase();
      const cmdArgs = (args.command || "").replace(/^\/?\\S+\s*/, "");

      if (!cmdName) return `Commands:\n${commandList}`;

      const command = COMMANDS[cmdName];
      if (!command) return `Unknown command: /${cmdName}\n\n${commandList}`;

      return command.template.replace(/\$ARGUMENTS/g, cmdArgs || PROMPTS.CONTINUE_DEFAULT);
    },
  });
}
