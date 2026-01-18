/**
 * Core Philosophy
 * 
 * The fundamental principle all agents share:
 * Explore → Learn → Adapt → Act
 * 
 * Learn = Document. What you discover, you record for future use.
 */

import { AGENT_NAMES } from "../../../shared/agent/constants/index.js";
import {
    PROMPT_TAGS,
    PHILOSOPHY_PHASES,
    PHILOSOPHY_TAGLINE,
    PHILOSOPHY_QUOTE,
    PHILOSOPHY_LEARN_PRINCIPLE,
} from "../../../shared/index.js";

export const CORE_PHILOSOPHY = `${PROMPT_TAGS.CORE_PHILOSOPHY.open}
## 🧠 Core Philosophy: ${PHILOSOPHY_TAGLINE}

> ${PHILOSOPHY_QUOTE}

| Phase | Action | Key Behavior |
|:-----:|:-------|:-------------|
| 🔍 **${PHILOSOPHY_PHASES.EXPLORE}** | Scan unknown territory | Detect environment, never assume |
| 📝 **${PHILOSOPHY_PHASES.LEARN}** | Document discoveries | Record patterns for future use |
| 🔄 **${PHILOSOPHY_PHASES.ADAPT}** | Adjust to findings | Match project's style and context |
| ⚡ **${PHILOSOPHY_PHASES.ACT}** | Execute with confidence | Build, test, seal |

**${PHILOSOPHY_LEARN_PRINCIPLE}**

### Agent Focus:
- 🎯 **${AGENT_NAMES.COMMANDER}**: All phases (orchestrate the full cycle)
- 📋 **${AGENT_NAMES.PLANNER}**: ${PHILOSOPHY_PHASES.EXPLORE} → ${PHILOSOPHY_PHASES.LEARN} (research and document)
- 🔨 **${AGENT_NAMES.WORKER}**: ${PHILOSOPHY_PHASES.ADAPT} → ${PHILOSOPHY_PHASES.ACT} (implement with fit)
- ✅ **${AGENT_NAMES.REVIEWER}**: ${PHILOSOPHY_PHASES.EXPLORE} → ${PHILOSOPHY_PHASES.LEARN} → ${PHILOSOPHY_PHASES.ACT} (verify with evidence)
${PROMPT_TAGS.CORE_PHILOSOPHY.close}`;

