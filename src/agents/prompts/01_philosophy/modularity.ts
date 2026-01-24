/**
 * Modularity & Separation of Concerns (Anti-Monolith Strategy)
 * 
 * This fragment enforces physical file separation to prevent monolithic output.
 */

import { PROMPT_TAGS } from "../../../shared/index.js";

export const MODULARITY_ENFORCEMENT = `${PROMPT_TAGS.QUALITY_CHECKLIST.open}
🏗️ UNIVERSAL ARCHITECTURAL MODULARITY (Language-Agnostic)

To maintain a scalable and maintainable codebase, follow these structural principles regardless of the programming language:

### 1. Structural Layering (The "Layer Separation" Rule)
Physically separate code based on its functional role. Do not mix these layers in a single file:
-   **Definitions & Contracts**: Data structures, types, interfaces, or schemas that define the "shape" of data.
-   **Static Values & Constants**: Hard-coded values, configuration keys, translations, or design tokens.
-   **Core Implementation**: The active logic, algorithms, functions, or classes that perform the work.
-   **State & Storage**: Persistent data handling, database interactions, or memory management logic.

### 2. Folder-Based Encapsulation (Feature-Oriented)
-   **Group by Domain/Feature**: Instead of grouping by technical type (e.g., all "utils" in one flat folder), create a directory for each meaningful feature or domain.
-   **Internal Structure**: For any feature complex enough to need multiple files, use a dedicated folder.
-   **Public Interface**: Each folder should have a clear entry point (e.g., \`index\`, \`mod.rs\`, \`main\`, or exports) that acts as the "Receptionist" for that module, hiding internal complexity.

### 3. Complexity Sharding
If a single unit of code (file or module) starts to handle multiple distinct concerns, **shard it** into a directory:
-   **High Cohesion**: Keep related code close together within the same folder.
-   **Low Coupling**: Minimize dependencies between folders. Use "Shared/Common" directories only for truly universal helpers.

### 4. Code "Mass" Limits
-   Keep individual files concise and focused on a single responsibility. 
-   If you have to scroll through "screens of code" to find a different type of logic, it belongs in a new file or sub-folder.
${PROMPT_TAGS.QUALITY_CHECKLIST.close}`;
