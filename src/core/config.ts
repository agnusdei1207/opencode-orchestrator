/**
 * OpenCode Orchestrator Configuration
 *
 * Dynamic configuration with environment variable support and validation.
 * Priority: Environment Variables > Config File > Defaults
 */

export interface ParallelAgentConfig {
  // Task lifecycle
  taskTtlMs: number;
  cleanupDelayMs: number;
  minStabilityMs: number;
  pollIntervalMs: number;

  // Concurrency control
  defaultConcurrency: number;
  maxConcurrency: number;

  // Monitoring
  enableDebug: boolean;
  enableDetailedLogs: boolean;
}

export interface BackgroundTaskConfig {
  // Monitoring
  monitorIntervalMs: number;

  // Storage
  storageDir: string;

  // Task management
  defaultTimeoutMs: number;
  maxCompletedTasksToKeep: number;

  // Debugging
  enableDebug: boolean;
}

export interface SessionConfig {
  // Loop control
  defaultMaxSteps: number;
  taskCommandMaxSteps: number;
}

// ============================================================================
// Defaults
// ============================================================================

const DEFAULT_PARALLEL_AGENT: ParallelAgentConfig = {
  taskTtlMs: 30 * 60 * 1000,           // 30 minutes
  cleanupDelayMs: 5 * 60 * 1000,          // 5 minutes
  minStabilityMs: 5 * 1000,               // 5 seconds
  pollIntervalMs: 2 * 1000,                // 2 seconds
  defaultConcurrency: 3,
  maxConcurrency: 10,
  enableDebug: false,
  enableDetailedLogs: false,
};

const DEFAULT_BACKGROUND_TASK: BackgroundTaskConfig = {
  monitorIntervalMs: 5 * 1000,             // 5 seconds
  storageDir: process.env.OPENCODE_ORCHESTRATOR_DIR ||
              `${require('os').homedir()}/.opencode-orchestrator`,
  defaultTimeoutMs: 5 * 60 * 1000,       // 5 minutes
  maxCompletedTasksToKeep: 100,
  enableDebug: true,
};

const DEFAULT_SESSION: SessionConfig = {
  defaultMaxSteps: 50,
  taskCommandMaxSteps: 100,
};

// ============================================================================
// Configuration Manager
// ============================================================================

class ConfigManager {
  private static _instance: ConfigManager;
  private parallelAgentConfig: ParallelAgentConfig;
  private backgroundTaskConfig: BackgroundTaskConfig;
  private sessionConfig: SessionConfig;

  private constructor() {
    this.parallelAgentConfig = this.loadParallelAgentConfig();
    this.backgroundTaskConfig = this.loadBackgroundTaskConfig();
    this.sessionConfig = this.loadSessionConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager._instance) {
      ConfigManager._instance = new ConfigManager();
    }
    return ConfigManager._instance;
  }

  // ------------------------------------------------------------------------
  // Parallel Agent Config
  // ------------------------------------------------------------------------

  private loadParallelAgentConfig(): ParallelAgentConfig {
    return {
      ...DEFAULT_PARALLEL_AGENT,
      taskTtlMs: this.parseEnvInt(
        'OPENCODE_TASK_TTL_MS',
        DEFAULT_PARALLEL_AGENT.taskTtlMs
      ),
      cleanupDelayMs: this.parseEnvInt(
        'OPENCODE_CLEANUP_DELAY_MS',
        DEFAULT_PARALLEL_AGENT.cleanupDelayMs
      ),
      minStabilityMs: this.parseEnvInt(
        'OPENCODE_MIN_STABILITY_MS',
        DEFAULT_PARALLEL_AGENT.minStabilityMs
      ),
      pollIntervalMs: this.parseEnvInt(
        'OPENCODE_POLL_INTERVAL_MS',
        DEFAULT_PARALLEL_AGENT.pollIntervalMs
      ),
      defaultConcurrency: this.parseEnvInt(
        'OPENCODE_DEFAULT_CONCURRENCY',
        DEFAULT_PARALLEL_AGENT.defaultConcurrency
      ),
      maxConcurrency: this.parseEnvInt(
        'OPENCODE_MAX_CONCURRENCY',
        DEFAULT_PARALLEL_AGENT.maxConcurrency
      ),
      enableDebug: process.env.OPENCODE_DEBUG_PARALLEL === 'true',
      enableDetailedLogs: process.env.OPENCODE_DETAILED_LOGS === 'true',
    };
  }

  getParallelAgentConfig(): Readonly<ParallelAgentConfig> {
    return this.parallelAgentConfig;
  }

  // ------------------------------------------------------------------------
  // Background Task Config
  // ------------------------------------------------------------------------

  private loadBackgroundTaskConfig(): BackgroundTaskConfig {
    return {
      ...DEFAULT_BACKGROUND_TASK,
      monitorIntervalMs: this.parseEnvInt(
        'OPENCODE_MONITOR_INTERVAL_MS',
        DEFAULT_BACKGROUND_TASK.monitorIntervalMs
      ),
      defaultTimeoutMs: this.parseEnvInt(
        'OPENCODE_DEFAULT_TIMEOUT_MS',
        DEFAULT_BACKGROUND_TASK.defaultTimeoutMs
      ),
      maxCompletedTasksToKeep: this.parseEnvInt(
        'OPENCODE_MAX_COMPLETED_TASKS',
        DEFAULT_BACKGROUND_TASK.maxCompletedTasksToKeep
      ),
      enableDebug: process.env.OPENCODE_DEBUG_BACKGROUND === 'true',
    };
  }

  getBackgroundTaskConfig(): Readonly<BackgroundTaskConfig> {
    return this.backgroundTaskConfig;
  }

  // ------------------------------------------------------------------------
  // Session Config
  // ------------------------------------------------------------------------

  private loadSessionConfig(): SessionConfig {
    return {
      ...DEFAULT_SESSION,
      defaultMaxSteps: this.parseEnvInt(
        'OPENCODE_DEFAULT_MAX_STEPS',
        DEFAULT_SESSION.defaultMaxSteps
      ),
      taskCommandMaxSteps: this.parseEnvInt(
        'OPENCODE_TASK_MAX_STEPS',
        DEFAULT_SESSION.taskCommandMaxSteps
      ),
    };
  }

  getSessionConfig(): Readonly<SessionConfig> {
    return this.sessionConfig;
  }

  // ------------------------------------------------------------------------
  // Runtime Updates (Dynamic Configuration)
  // ------------------------------------------------------------------------

  /**
   * Update configuration at runtime
   * Useful for adaptive behavior or user preferences
   */
  updateParallelAgentConfig(updates: Partial<ParallelAgentConfig>): void {
    this.parallelAgentConfig = {
      ...this.parallelAgentConfig,
      ...updates,
    };
    this.validateParallelAgentConfig();
  }

  updateBackgroundTaskConfig(updates: Partial<BackgroundTaskConfig>): void {
    this.backgroundTaskConfig = {
      ...this.backgroundTaskConfig,
      ...updates,
    };
    this.validateBackgroundTaskConfig();
  }

  updateSessionConfig(updates: Partial<SessionConfig>): void {
    this.sessionConfig = {
      ...this.sessionConfig,
      ...updates,
    };
    this.validateSessionConfig();
  }

  // ------------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------------

  private validateParallelAgentConfig(): void {
    const { taskTtlMs, cleanupDelayMs, minStabilityMs, pollIntervalMs, defaultConcurrency, maxConcurrency } =
      this.parallelAgentConfig;

    // Sanity checks
    if (taskTtlMs < 60 * 1000) {
      console.warn('[Config] TASK_TTL_MS too low (< 1min), using 1min minimum');
      this.parallelAgentConfig.taskTtlMs = 60 * 1000;
    }

    if (cleanupDelayMs > taskTtlMs) {
      console.warn('[Config] CLEANUP_DELAY_MS cannot exceed TASK_TTL_MS');
      this.parallelAgentConfig.cleanupDelayMs = Math.floor(taskTtlMs / 2);
    }

    if (minStabilityMs < 1000) {
      console.warn('[Config] MIN_STABILITY_MS too low (< 1s), using 1s minimum');
      this.parallelAgentConfig.minStabilityMs = 1000;
    }

    if (pollIntervalMs < 500) {
      console.warn('[Config] POLL_INTERVAL_MS too low (< 500ms), using 500ms minimum');
      this.parallelAgentConfig.pollIntervalMs = 500;
    }

    if (defaultConcurrency < 1 || defaultConcurrency > maxConcurrency) {
      console.warn(`[Config] DEFAULT_CONCURRENCY must be 1-${maxConcurrency}`);
      this.parallelAgentConfig.defaultConcurrency = Math.min(
        Math.max(defaultConcurrency, 1),
        maxConcurrency
      );
    }
  }

  private validateBackgroundTaskConfig(): void {
    const { monitorIntervalMs, defaultTimeoutMs, maxCompletedTasksToKeep } =
      this.backgroundTaskConfig;

    if (monitorIntervalMs < 1000) {
      console.warn('[Config] MONITOR_INTERVAL_MS too low (< 1s), using 1s minimum');
      this.backgroundTaskConfig.monitorIntervalMs = 1000;
    }

    if (defaultTimeoutMs < 10 * 1000) {
      console.warn('[Config] DEFAULT_TIMEOUT_MS too low (< 10s), using 10s minimum');
      this.backgroundTaskConfig.defaultTimeoutMs = 10 * 1000;
    }

    if (maxCompletedTasksToKeep < 0) {
      console.warn('[Config] MAX_COMPLETED_TASKS must be >= 0, using 0');
      this.backgroundTaskConfig.maxCompletedTasksToKeep = 0;
    }
  }

  private validateSessionConfig(): void {
    const { defaultMaxSteps, taskCommandMaxSteps } = this.sessionConfig;

    if (defaultMaxSteps < 1) {
      console.warn('[Config] DEFAULT_MAX_STEPS must be >= 1, using 1');
      this.sessionConfig.defaultMaxSteps = 1;
    }

    if (taskCommandMaxSteps < defaultMaxSteps) {
      console.warn('[Config] TASK_MAX_STEPS should be >= DEFAULT_MAX_STEPS');
      this.sessionConfig.taskCommandMaxSteps = defaultMaxSteps;
    }
  }

  // ------------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------------

  private parseEnvInt(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (value === undefined) return defaultValue;

    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      console.warn(`[Config] Invalid ${key} value: "${value}", using default ${defaultValue}`);
      return defaultValue;
    }

    return parsed;
  }

  // ------------------------------------------------------------------------
  // Export / Debug
  // ------------------------------------------------------------------------

  exportConfigs(): void {
    console.log('\n📋 Current Configuration:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Parallel Agent:');
    console.log(`  Task TTL: ${this.parallelAgentConfig.taskTtlMs / 1000}s`);
    console.log(`  Cleanup Delay: ${this.parallelAgentConfig.cleanupDelayMs / 1000}s`);
    console.log(`  Min Stability: ${this.parallelAgentConfig.minStabilityMs / 1000}s`);
    console.log(`  Poll Interval: ${this.parallelAgentConfig.pollIntervalMs / 1000}s`);
    console.log(`  Default Concurrency: ${this.parallelAgentConfig.defaultConcurrency}`);
    console.log(`  Max Concurrency: ${this.parallelAgentConfig.maxConcurrency}`);
    console.log(`  Debug: ${this.parallelAgentConfig.enableDebug}`);
    console.log('');
    console.log('Background Task:');
    console.log(`  Monitor Interval: ${this.backgroundTaskConfig.monitorIntervalMs / 1000}s`);
    console.log(`  Default Timeout: ${this.backgroundTaskConfig.defaultTimeoutMs / 1000}s`);
    console.log(`  Max Completed Tasks: ${this.backgroundTaskConfig.maxCompletedTasksToKeep}`);
    console.log(`  Storage Dir: ${this.backgroundTaskConfig.storageDir}`);
    console.log(`  Debug: ${this.backgroundTaskConfig.enableDebug}`);
    console.log('');
    console.log('Session:');
    console.log(`  Default Max Steps: ${this.sessionConfig.defaultMaxSteps}`);
    console.log(`  Task Max Steps: ${this.sessionConfig.taskCommandMaxSteps}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// Export singleton instance
export const configManager = ConfigManager.getInstance();
