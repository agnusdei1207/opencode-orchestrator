/**
 * Environment Discovery Prompt
 * 
 * PHASE 0: Mandatory first step - understand project before ANY action
 * Designed to be technology-agnostic and adaptable to any project type.
 */

import { PATHS, PROMPT_TAGS, LIMITS } from "../../../shared/index.js";

export const ENVIRONMENT_DISCOVERY = `${PROMPT_TAGS.ENVIRONMENT_DISCOVERY.open}
**MANDATORY FIRST STEP** - Before any planning or coding:

## 1. Project Structure Discovery
Explore the project root to understand its organization:
\`\`\`bash
ls -la                    # Root contents
find . -maxdepth 2 -type d | head -${LIMITS.DEFAULT_SCAN_LIMIT}   # Directory structure
find . -maxdepth 1 -type f              # Root files
\`\`\`


**Look for patterns, NOT specific files:**
- Source directories (src/, lib/, app/, pkg/, internal/, cmd/)
- Test directories (tests/, test/, spec/, __tests__/, *_test/)
- Build artifacts (dist/, build/, target/, out/, bin/)
- Documentation (docs/, doc/, README*, CONTRIBUTING*, CHANGELOG*)
- Configuration (hidden files, *.config.*, *.json, *.yaml, *.toml)

## 2. Environment Detection (Adaptive)
**DO NOT assume technology stack. DETECT it:**

| Indicator Files | Likely Environment |
|----------------|-------------------|
| package.json, tsconfig.json | Node.js / TypeScript |
| Cargo.toml, Cargo.lock | Rust |
| go.mod, go.sum | Go |
| requirements.txt, pyproject.toml, setup.py | Python |
| pom.xml, build.gradle | Java / JVM |
| Gemfile, *.rb | Ruby |
| composer.json | PHP |
| CMakeLists.txt, Makefile | C/C++ |
| *.csproj, *.sln | .NET / C# |
| pubspec.yaml | Dart / Flutter |

**For each detected config file, read it to find:**
- Build commands
- Test commands  
- Entry points
- Dependencies

## 3. Infrastructure Detection
\`\`\`bash
# Container/orchestration
ls Dockerfile* docker-compose* 2>/dev/null
ls kubernetes/ k8s/ helm/ 2>/dev/null

# CI/CD
ls .github/workflows/ .gitlab-ci.yml .circleci/ Jenkinsfile 2>/dev/null

# Cloud/IaC
ls terraform/ cloudformation/ pulumi/ 2>/dev/null
ls serverless.yml sam.yaml 2>/dev/null
\`\`\`

## 4. Existing Context Check
\`\`\`bash
ls -la ${PATHS.OPENCODE}/ 2>/dev/null || echo "No existing context"
\`\`\`
- If ${PATHS.OPENCODE}/ exists → ASK user to continue or start fresh
- If not → Create fresh context

## 5. Context Summary (SAVE TO ${PATHS.CONTEXT})
\`\`\`markdown
# Project Context

## Environment
- Language: [DETECTED from files]
- Runtime: [DETECTED version if available]
- Build: [DETECTED build command]
- Test: [DETECTED test command]
- Package Manager: [DETECTED from lockfiles]

## Project Type
- [ ] Library/Package
- [ ] Application (CLI/Web/Mobile/Desktop)
- [ ] Microservice
- [ ] Monorepo
- [ ] Other: [describe]

## Infrastructure
- Container: [None / Docker / Podman]
- Orchestration: [None / K8s / Docker Compose]
- CI/CD: [DETECTED from config files]
- Cloud: [DETECTED or None]

## Structure
- Source: [DETECTED path]
- Tests: [DETECTED path]  
- Docs: [DETECTED path]
- Entry: [DETECTED main file]

## Conventions (OBSERVE from existing code)
- Naming: [camelCase / snake_case / PascalCase]
- Imports: [relative / absolute / aliases]
- Error handling: [exceptions / Result type / error codes]
- Testing: [unit / integration / e2e patterns]

## Notes
- [Any unique patterns or requirements observed]
\`\`\`

## CRITICAL RULES:
1. NEVER assume - always VERIFY by reading files
2. ADAPT to what you find, don't force expectations
3. If uncertain, ASK the user for clarification
4. Document EVERYTHING you discover
${PROMPT_TAGS.ENVIRONMENT_DISCOVERY.close}`;

