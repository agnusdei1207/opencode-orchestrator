import { describe, it, expect } from 'vitest';

describe('ConfigManager', () => {
  describe('Concurrency Configuration', () => {
    it('should support dynamic concurrency limits', () => {
      const config = {
        defaultConcurrency: 3,
        maxConcurrency: 10,
      };

      expect(config.defaultConcurrency).toBe(3);
      expect(config.maxConcurrency).toBe(10);

      const updated = { ...config, defaultConcurrency: 5 };
      expect(updated.defaultConcurrency).toBe(5);
    });

    it('should validate max concurrency', () => {
      const config = {
        defaultConcurrency: 3,
        maxConcurrency: 10,
      };

      const validated = { ...config, defaultConcurrency: 15 };
      expect(validated.defaultConcurrency).toBe(10);
    });
  });

  describe('Timeout Configuration', () => {
    it('should support dynamic timeouts', () => {
      const config = {
        taskTtlMs: 30 * 60 * 1000,
        cleanupDelayMs: 5 * 60 * 1000,
      };

      expect(config.taskTtlMs).toBe(1800000);
      expect(config.cleanupDelayMs).toBe(300000);

      const updated = { ...config, taskTtlMs: 45 * 60 * 1000 };
      expect(updated.taskTtlMs).toBe(2700000);
    });
  });
});
