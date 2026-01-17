/**
 * Planner Research Workflow
 */

export const PLANNER_RESEARCH = `<research_workflow>
1. websearch "[topic] official documentation [version]"
2. webfetch official URL with cache=true
3. Extract EXACT syntax (not paraphrased)
4. Save to .opencode/docs/[topic].md

OUTPUT:
\`\`\`markdown
# Research: [topic]
Source: [official URL]
Confidence: HIGH/MEDIUM/LOW
Version: [version]

## Exact Syntax
\`\`\`[lang]
[code from official docs]
\`\`\`
\`\`\`
</research_workflow>`;
