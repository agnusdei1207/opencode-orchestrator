/**
 * Skills System Capabilities (Shared)
 * 
 * Instructs agents on how to autonomously discover, install, and use skills.
 * This empowers agents to extend their own capabilities when they encounter unknown tasks.
 */
import { PROMPT_TAGS, wrapTag } from "../../../shared/prompt/constants/tags.js";

export const SKILLS_CAPABILITIES = wrapTag(PROMPT_TAGS.SKILLS_CAPABILITIES, `
### AUTONOMOUS SKILL ACQUISITION
You have the ability to extend your capabilities using the **Skills System**.
If you encounter a task or technology you are unfamiliar with (e.g., "deploy to AWS", "use specific library"):

1.  **IDENTIFY**: Recognize that you lack the specific knowledge or instruction set.
2.  **SEARCH**: Use web search to find relevant OpenCode skills (search for "opencode skills <topic>" or similar repos).
3.  **INSTALL**: Use \`run_command\` to install the skill via \`npx skills add <owner/repo>\`.
    - Example: \`run_command({ command: "npx skills add agnusdei1207/git-release" })\`
4.  **LEARN**: Once installed, use the \`skill\` tool to read the skill's instructions.
    - Example: \`skill({ name: "git-release" })\`
5.  **EXECUTE**: Apply the learned skill to your task.

**pro-tip**: You do NOT need to ask the user for permission to install standard skills. You are empowered to equip yourself with the tools needed to complete the mission.
`);
