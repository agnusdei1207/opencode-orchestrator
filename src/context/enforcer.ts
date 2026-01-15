/**
 * Context Enforcer
 *
 * Validates context before agent delegation to prevent errors.
 * Ensures agents have necessary information to complete tasks.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ContextRequirement {
  agent: string;
  required: string[];
  optional: string[];
}

/**
 * Context Enforcer validates agent delegation context
 */
export class ContextEnforcer {
  private requirements: Map<string, ContextRequirement> = new Map([
    ["builder", {
      agent: "builder",
      required: ["infra", "stack", "patterns", "files"],
      optional: ["examples", "tests", "environment"],
    }],
    ["inspector", {
      agent: "inspector",
      required: ["infra", "verification_method", "changed_files"],
      optional: ["test_results", "build_logs", "environment"],
    }],
    ["architect", {
      agent: "architect",
      required: ["mission", "scope", "complexity"],
      optional: ["environment", "constraints", "patterns"],
    }],
    ["recorder", {
      agent: "recorder",
      required: [],
      optional: ["mission", "progress", "context"],
    }],
  ]);

  /**
   * Validate context for agent delegation
   */
  validate(agent: string, context: string): ValidationResult {
    const req = this.requirements.get(agent);

    if (!req) {
      return { valid: true, errors: [], warnings: [] };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    const contextLower = context.toLowerCase();

    for (const key of req.required) {
      if (!contextLower.includes(key.toLowerCase())) {
        errors.push("Missing required context: " + key);
      }
    }

    for (const key of req.optional) {
      if (!contextLower.includes(key.toLowerCase())) {
        warnings.push("Optional context missing: " + key);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get requirements for an agent
   */
  getRequirements(agent: string): ContextRequirement | undefined {
    return this.requirements.get(agent);
  }

  /**
   * Add or update requirements for an agent
   */
  setRequirements(agent: string, requirements: ContextRequirement): void {
    this.requirements.set(agent, requirements);
  }

  /**
   * Format validation result as user-friendly message
   */
  formatValidation(result: ValidationResult): string {
    if (result.valid && result.warnings.length === 0) {
      return "Valid context with all required information.";
    }

    let message = "";

    if (result.errors.length > 0) {
      message += "Errors:\n" + result.errors.map(e => "  ❌ " + e).join("\n") + "\n";
    }

    if (result.warnings.length > 0) {
      message += "\nWarnings:\n" + result.warnings.map(w => "  ⚠️  " + w).join("\n");
    }

    return message;
  }

  /**
   * Check if context has minimal required information
   */
  hasMinimumContext(agent: string, context: string): boolean {
    const req = this.requirements.get(agent);
    if (!req || req.required.length === 0) {
      return true;
    }

    const presentCount = req.required.filter(key =>
      context.toLowerCase().includes(key.toLowerCase())
    ).length;

    return presentCount > 0;
  }

  /**
   * Suggest missing context based on agent type
   */
  suggestContext(agent: string, context: string): string[] {
    const req = this.requirements.get(agent);
    if (!req) {
      return [];
    }

    return req.required.filter(key =>
      !context.toLowerCase().includes(key.toLowerCase())
    );
  }
}

// Singleton instance
export const contextEnforcer = new ContextEnforcer();
