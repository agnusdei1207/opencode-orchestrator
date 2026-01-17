/**
 * Environment Discovery Prompt
 * 
 * PHASE 0: Mandatory first step - understand project before ANY action
 */

export const ENVIRONMENT_DISCOVERY = `<environment_discovery>
 MANDATORY FIRST STEP - Before any planning or coding:

## 1. Project Structure Analysis
- Read file tree: ls -la, find . -type f -name "*.ts" | head -50
- Identify: src/, tests/, docs/, config files
- Check for: package.json, Dockerfile, docker-compose.yml, Makefile

## 2. Build Environment Detection
| Check | Command | Look For |
|-------|---------|----------|
| Node.js | cat package.json | scripts.build, scripts.test |
| Docker | ls Dockerfile* | Multi-stage build, base image |
| Make | cat Makefile | build, test, deploy targets |
| Rust | cat Cargo.toml | [package], [dependencies] |

## 3. Documentation Review
- README.md → Project overview, setup instructions
- CONTRIBUTING.md → Code standards, PR process
- docs/ → Architecture, API docs
- .opencode/ → Existing context, todos

## 4. Context Summary (SAVE TO .opencode/context.md)
\`\`\`markdown
# Project Context
## Environment
- Runtime: [Node.js 20 / Python 3.11 / Rust 1.75]
- Build: [npm / Docker / Make]
- Test: [npm test / pytest / cargo test]

## Structure
- Source: src/
- Tests: tests/
- Docs: docs/

## Key Files
- Entry: [src/index.ts]
- Config: [tsconfig.json, package.json]

## Conventions
- [observed patterns from existing code]
\`\`\`

NEVER skip this step. NEVER assume without checking.
</environment_discovery>`;
