import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { creditCheckMiddleware, getCreditState, type CreditState } from "@server/middleware";
import { CreditCheckError } from "@core/billing";

// Mock the checkCredits function
const mockCheckCredits = vi.fn();

vi.mock("@core/billing", async () => {
  const actual = await vi.importActual("@core/billing");
  return {
    ...actual,
    checkCredits: (...args: unknown[]) => mockCheckCredits(...args),
  };
});

describe("creditCheckMiddleware", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to simulate auth middleware
  const withAuth = (accountId: number) => {
    return async (c: any, next: () => Promise<void>) => {
      c.set("auth", { accountId, jwt: "test-jwt" });
      await next();
    };
  };

  describe("successful credit check", () => {
    it("allows request when ok is true", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: true,
        balanceMillicredits: 5000,
        planMillicredits: 4000,
        packMillicredits: 1000,
      });

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => {
        return c.json({ success: true });
      });

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true });
      expect(mockCheckCredits).toHaveBeenCalledWith(123);
    });

    it("sets creditState with balance and accountId", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: true,
        balanceMillicredits: 5000,
        planMillicredits: 4000,
        packMillicredits: 1000,
      });

      let capturedState: CreditState | undefined;

      app.use("*", withAuth(456));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => {
        capturedState = getCreditState(c);
        return c.json({ success: true });
      });

      await app.request("/test");

      expect(capturedState).toEqual({
        accountId: 456,
        preRunCreditsRemaining: 5000,
      });
    });

    it("handles zero balance when ok is true (edge case)", async () => {
      // Edge case: ok is true but balance is 0 (shouldn't happen, but handle it)
      mockCheckCredits.mockResolvedValue({
        ok: true,
        balanceMillicredits: 0,
        planMillicredits: 0,
        packMillicredits: 0,
      });

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
    });
  });

  describe("insufficient credits", () => {
    it("returns 402 when ok is false", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: false,
        balanceMillicredits: 0,
        planMillicredits: 0,
        packMillicredits: 0,
      });

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(402);
      const json = await res.json();
      expect(json).toEqual({
        error: "Insufficient credits",
        code: "CREDITS_EXHAUSTED",
        balance: 0,
        planCredits: 0,
        packCredits: 0,
      });
    });

    it("returns correct balance breakdown in 402 response", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: false,
        balanceMillicredits: -500, // debt
        planMillicredits: -500,
        packMillicredits: 0,
      });

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(402);
      const json = await res.json();
      expect(json).toEqual({
        error: "Insufficient credits",
        code: "CREDITS_EXHAUSTED",
        balance: -500,
        planCredits: -500,
        packCredits: 0,
      });
    });

    it("does not call route handler when credits exhausted", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: false,
        balanceMillicredits: 0,
        planMillicredits: 0,
        packMillicredits: 0,
      });

      const routeHandler = vi.fn(() => new Response("OK"));

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", routeHandler);

      await app.request("/test");

      expect(routeHandler).not.toHaveBeenCalled();
    });
  });

  describe("error handling (fail open)", () => {
    it("proceeds when CreditCheckError is thrown", async () => {
      mockCheckCredits.mockRejectedValue(
        new CreditCheckError("Service unavailable", 503, 123)
      );

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      expect(warnSpy).toHaveBeenCalledWith(
        "[creditCheckMiddleware] Credit check failed, proceeding anyway:",
        "Service unavailable"
      );

      warnSpy.mockRestore();
    });

    it("proceeds when generic error is thrown", async () => {
      mockCheckCredits.mockRejectedValue(new Error("Network error"));

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      expect(warnSpy).toHaveBeenCalledWith(
        "[creditCheckMiddleware] Unexpected error, proceeding anyway:",
        expect.any(Error)
      );

      warnSpy.mockRestore();
    });

    it("sets creditState with accountId but undefined balance on error", async () => {
      mockCheckCredits.mockRejectedValue(new Error("Network error"));

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      let capturedState: any;

      app.use("*", withAuth(789));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => {
        capturedState = getCreditState(c);
        return c.json({ success: true });
      });

      await app.request("/test");

      expect(capturedState).toEqual({
        accountId: 789,
        preRunCreditsRemaining: undefined,
      });

      warnSpy.mockRestore();
    });
  });

  describe("auth context requirement", () => {
    it("returns 500 when no auth context", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: "Internal server error" });

      expect(errorSpy).toHaveBeenCalledWith(
        "[creditCheckMiddleware] No auth context - must run after authMiddleware"
      );

      errorSpy.mockRestore();
    });
  });

  describe("getCreditState helper", () => {
    it("returns undefined when middleware not run", async () => {
      let capturedState: CreditState | undefined = { accountId: 999, preRunCreditsRemaining: 999 };

      app.get("/test", (c) => {
        capturedState = getCreditState(c);
        return c.json({ success: true });
      });

      await app.request("/test");

      expect(capturedState).toBeUndefined();
    });

    it("returns credit state when middleware has run", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: true,
        balanceMillicredits: 12345,
        planMillicredits: 10000,
        packMillicredits: 2345,
      });

      let capturedState: CreditState | undefined;

      app.use("*", withAuth(100));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => {
        capturedState = getCreditState(c);
        return c.json({ success: true });
      });

      await app.request("/test");

      expect(capturedState).toEqual({
        accountId: 100,
        preRunCreditsRemaining: 12345,
      });
    });
  });

  describe("integration with route patterns", () => {
    it("works with POST requests", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: true,
        balanceMillicredits: 5000,
        planMillicredits: 5000,
        packMillicredits: 0,
      });

      app.use("*", withAuth(123));
      app.post("/api/stream", creditCheckMiddleware, (c) => {
        return c.json({ streaming: true });
      });

      const res = await app.request("/api/stream", {
        method: "POST",
        body: JSON.stringify({ threadId: "thread_123" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(200);
    });

    it("calls checkCredits with correct accountId from auth", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: true,
        balanceMillicredits: 1000,
        planMillicredits: 1000,
        packMillicredits: 0,
      });

      app.use("*", withAuth(42));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ ok: true }));

      await app.request("/test");

      expect(mockCheckCredits).toHaveBeenCalledTimes(1);
      expect(mockCheckCredits).toHaveBeenCalledWith(42);
    });
  });
});
