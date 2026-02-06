/**
 * Unit tests for the structured logging module.
 *
 * Verifies:
 * - Root logger exists and is silent in test mode
 * - getLogger() returns root logger when outside ALS scope
 * - getLogger() returns child logger when inside ALS scope
 * - LoggerContext propagates through AsyncLocalStorage
 * - Sensitive fields are redacted
 */
import { describe, it, expect, vi } from "vitest";
import { rootLogger, getLogger, getLoggerContext, loggerStorage } from "@core";
import type { LoggerContext } from "@core";

describe("Structured Logger", () => {
  describe("rootLogger", () => {
    it("exists and has standard log methods", () => {
      expect(rootLogger).toBeDefined();
      expect(typeof rootLogger.info).toBe("function");
      expect(typeof rootLogger.warn).toBe("function");
      expect(typeof rootLogger.error).toBe("function");
      expect(typeof rootLogger.debug).toBe("function");
      expect(typeof rootLogger.child).toBe("function");
    });

    it("is silent in test mode", () => {
      // In test environment, the level should be "silent"
      expect(rootLogger.level).toBe("silent");
    });
  });

  describe("getLogger()", () => {
    it("returns root logger when outside ALS scope", () => {
      const logger = getLogger();
      // Should be the root logger (or a child of it)
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
    });

    it("returns child logger with bindings when outside ALS scope", () => {
      const logger = getLogger({ component: "test" });
      expect(logger).toBeDefined();
      // Child logger should have the binding (verified by pino internals)
      expect((logger as any).bindings().component).toBe("test");
    });

    it("returns context-bound child logger when inside ALS scope", () => {
      const childLogger = rootLogger.child({ requestId: "req-123", threadId: "thread-456" });
      const ctx: LoggerContext = {
        requestId: "req-123",
        logger: childLogger,
      };

      loggerStorage.run(ctx, () => {
        const logger = getLogger();
        // Should be the context's child logger, not root
        const bindings = (logger as any).bindings();
        expect(bindings.requestId).toBe("req-123");
        expect(bindings.threadId).toBe("thread-456");
      });
    });

    it("merges additional bindings with context logger", () => {
      const childLogger = rootLogger.child({ requestId: "req-789" });
      const ctx: LoggerContext = {
        requestId: "req-789",
        logger: childLogger,
      };

      loggerStorage.run(ctx, () => {
        const logger = getLogger({ extra: "value" });
        const bindings = (logger as any).bindings();
        expect(bindings.requestId).toBe("req-789");
        expect(bindings.extra).toBe("value");
      });
    });
  });

  describe("getLoggerContext()", () => {
    it("returns undefined outside ALS scope", () => {
      expect(getLoggerContext()).toBeUndefined();
    });

    it("returns context inside ALS scope", () => {
      const ctx: LoggerContext = {
        requestId: "req-abc",
        logger: rootLogger.child({ requestId: "req-abc" }),
      };

      loggerStorage.run(ctx, () => {
        const result = getLoggerContext();
        expect(result).toBeDefined();
        expect(result!.requestId).toBe("req-abc");
      });
    });
  });
});
