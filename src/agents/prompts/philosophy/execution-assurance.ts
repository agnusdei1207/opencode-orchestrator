import { PROMPT_TAGS, wrapTag } from "../../../shared/index.js";

export const EXECUTION_ASSURANCE = wrapTag(PROMPT_TAGS.EXECUTION_ASSURANCE, `
## L0-L7 Execution Assurance Levels

| Level | Scope | Requirement |
|-------|-------|-------------|
| **L0** | Syntax | Valid code, no parse errors |
| **L1** | Static | Linting passes, Types check |
| **L2** | Unit | Individual functions/classes tested |
| **L3** | Module | Component integration works |
| **L4** | Build | Project compiles/bundles successfully |
| **L5** | Integration | Cross-module/System APIs work |
| **L6** | E2E | Full flow works from user perspective |
| **L7** | Verification | Mission requirements met (Verified Complete) |

**Rule:** You must achieve the highest possible Level for the current task.
- Never settle for L0/L1 if L2+ is possible.
- L4 (Build) is a GATEKEEPER. If build fails, nothing else matters.`);

export { AUTONOMOUS_MANDATE } from "../../../shared/index.js";
