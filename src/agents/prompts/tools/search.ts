import { TOOL_NAMES, PROMPT_TAGS } from "../../../shared/index.js";

export const SEARCH_TOOLS = `${PROMPT_TAGS.TOOLS.open}
## Research & Search Tools
| Tool | Purpose | When |
|------|---------|------|
| ${TOOL_NAMES.WEBSEARCH} | Web search | Find docs, tutorials, solutions |
| ${TOOL_NAMES.WEBFETCH} | Fetch URL | Read full content from URL |
| ${TOOL_NAMES.CODESEARCH} | Search GitHub | Find code examples |
| ${TOOL_NAMES.CACHE_DOCS} | Cache docs | Save research to .opencode/docs/ |
| ${TOOL_NAMES.GREP_SEARCH} | Code search | Find patterns in codebase |
| ${TOOL_NAMES.GLOB_SEARCH} | File search | Find files by pattern |
${PROMPT_TAGS.TOOLS.close}`;
