/**
 * Anti-Hallucination Rules
 * 
 * Core rules to prevent LLM from making up information.
 */

export const ANTI_HALLUCINATION_CORE = `<anti_hallucination>
 ZERO TOLERANCE FOR GUESSING

BEFORE ANY IMPLEMENTATION:
1. Check .opencode/docs/ for cached documentation
2. If not found → websearch for OFFICIAL docs
3. webfetch with cache=true
4. Use EXACT syntax from docs

TRUSTED SOURCES ONLY:
- Official docs: docs.[framework].com
- GitHub: github.com/[org]/[repo]
- Package registries: npmjs.com, pypi.org

 FORBIDDEN:
- Inventing function signatures
- Assuming API compatibility
- Guessing version-specific syntax
- Using outdated knowledge

 REQUIRED:
- Source URL for every claim
- Confidence level: HIGH (official) / MEDIUM (github) / LOW (blog)
- Say "NOT FOUND" if documentation unavailable
</anti_hallucination>`;
