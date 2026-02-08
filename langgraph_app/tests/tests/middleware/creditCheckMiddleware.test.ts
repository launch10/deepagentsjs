import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { creditCheckMiddleware, getCreditState, type CreditState } from "@server/middleware";
import { CreditCheckError } from "@core/billing";

// vi.mock is hoisted — use vi.hoisted for variables referenced inside mocks
const { mockCheckCredits, mockEnv } = vi.hoisted(() => ({
  mockCheckCredits: vi.fn(),
  mockEnv: { CREDITS_DISABLED: false } as { CREDITS_DISABLED: boolean },
}));

vi.mock("@core/billing", async () => {
  const actual = await vi.importActual("@core/billing");
  return {
    ...actual,
    checkCredits: (...args: unknown[]) => mockCheckCredits(...args),
  };
});

vi.mock("@core", async () => {
  const actual = await vi.importActual("@core");
  return {
    ...actual,
    env: mockEnv,
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
        balance_millicredits: 5000,
        plan_millicredits: 4000,
        pack_millicredits: 1000,
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
      expect(mockCheckCredits).toHaveBeenCalledWith("test-jwt");
    });

    it("sets creditState with balance and accountId", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: true,
        balance_millicredits: 5000,
        plan_millicredits: 4000,
        pack_millicredits: 1000,
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
        balance_millicredits: 0,
        plan_millicredits: 0,
        pack_millicredits: 0,
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
        balance_millicredits: 0,
        plan_millicredits: 0,
        pack_millicredits: 0,
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
        balance_millicredits: -500, // debt
        plan_millicredits: -500,
        pack_millicredits: 0,
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
        balance_millicredits: 0,
        plan_millicredits: 0,
        pack_millicredits: 0,
      });

      const routeHandler = vi.fn(() => new Response("OK"));

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", routeHandler);

      await app.request("/test");

      expect(routeHandler).not.toHaveBeenCalled();
    });
  });

  describe("error handling (fail closed)", () => {
    it("returns 503 when CreditCheckError is thrown", async () => {
      mockCheckCredits.mockRejectedValue(
        new CreditCheckError("Service unavailable", 503, 123)
      );

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json).toEqual({
        error: "Unable to verify credits. Please try again.",
        code: "CREDIT_CHECK_FAILED",
      });
    });

    it("returns 503 when generic error is thrown", async () => {
      mockCheckCredits.mockRejectedValue(new Error("Network error"));

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json).toEqual({
        error: "Unable to verify credits. Please try again.",
        code: "CREDIT_CHECK_FAILED",
      });
    });

    it("does not set creditState on error (request is blocked)", async () => {
      mockCheckCredits.mockRejectedValue(new Error("Network error"));

      const routeHandler = vi.fn((c: any) => {
        return c.json({ success: true });
      });

      app.use("*", withAuth(789));
      app.use("*", creditCheckMiddleware);
      app.get("/test", routeHandler);

      await app.request("/test");

      // Route handler never runs when fail-closed
      expect(routeHandler).not.toHaveBeenCalled();
    });
  });

  describe("auth context requirement", () => {
    it("returns 500 when no auth context", async () => {
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json).toEqual({ error: "Internal server error" });
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
        balance_millicredits: 12345,
        plan_millicredits: 10000,
        pack_millicredits: 2345,
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

  describe("CREDITS_DISABLED", () => {
    afterEach(() => {
      mockEnv.CREDITS_DISABLED = false;
    });

    it("skips credit check and allows request when CREDITS_DISABLED is true", async () => {
      mockEnv.CREDITS_DISABLED = true;

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      const res = await app.request("/test");

      expect(res.status).toBe(200);
      expect(mockCheckCredits).not.toHaveBeenCalled();
    });

    it("sets preRunCreditsRemaining to MAX_SAFE_INTEGER when disabled", async () => {
      mockEnv.CREDITS_DISABLED = true;

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
        preRunCreditsRemaining: Number.MAX_SAFE_INTEGER,
      });
    });

    it("still checks credits when CREDITS_DISABLED is false", async () => {
      mockEnv.CREDITS_DISABLED = false;

      mockCheckCredits.mockResolvedValue({
        ok: true,
        balance_millicredits: 5000,
        plan_millicredits: 5000,
        pack_millicredits: 0,
      });

      app.use("*", withAuth(123));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ success: true }));

      await app.request("/test");

      expect(mockCheckCredits).toHaveBeenCalledWith("test-jwt");
    });
  });

  describe("integration with route patterns", () => {
    it("works with POST requests", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: true,
        balance_millicredits: 5000,
        plan_millicredits: 5000,
        pack_millicredits: 0,
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

    it("calls checkCredits with JWT from auth context", async () => {
      mockCheckCredits.mockResolvedValue({
        ok: true,
        balance_millicredits: 1000,
        plan_millicredits: 1000,
        pack_millicredits: 0,
      });

      app.use("*", withAuth(42));
      app.use("*", creditCheckMiddleware);
      app.get("/test", (c) => c.json({ ok: true }));

      await app.request("/test");

      expect(mockCheckCredits).toHaveBeenCalledTimes(1);
      expect(mockCheckCredits).toHaveBeenCalledWith("test-jwt");
    });
  });
});
