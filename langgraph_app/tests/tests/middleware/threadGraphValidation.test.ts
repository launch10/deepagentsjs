import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// vi.mock is hoisted — use vi.hoisted for variables referenced inside mocks
const { mockValidate } = vi.hoisted(() => ({
  mockValidate: vi.fn(),
}));

vi.mock("@rails_api", () => ({
  ChatsAPIService: vi.fn().mockImplementation(() => ({
    validate: mockValidate,
  })),
}));

vi.mock("@core", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    env: { RAILS_API_URL: "http://localhost:3000" },
    getLogger: () => ({
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    }),
  };
});

import { validateThreadGraphOrError } from "app/server/middleware/threadValidation";
import type { AuthContext } from "app/server/middleware/auth";

describe("validateThreadGraphOrError", () => {
  let app: Hono;
  const mockAuth: AuthContext = {
    jwt: "test-jwt-token",
    userId: 1,
    accountId: 1,
  } as AuthContext;

  beforeEach(() => {
    app = new Hono();
    mockValidate.mockReset();
  });

  it("allows new threads (chat doesn't exist yet)", async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      exists: false,
      chat_type: null,
      project_id: null,
    });

    app.post("/test", async (c) => {
      const error = await validateThreadGraphOrError(c, "new-thread-id", mockAuth, "website");
      if (error) return error;
      return c.json({ ok: true });
    });

    const res = await app.request("/test", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  it("allows existing threads with matching chat_type", async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      exists: true,
      chat_type: "website",
      project_id: 1,
    });

    app.post("/test", async (c) => {
      const error = await validateThreadGraphOrError(c, "existing-thread", mockAuth, "website");
      if (error) return error;
      return c.json({ ok: true });
    });

    const res = await app.request("/test", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  it("rejects threads belonging to wrong account (403)", async () => {
    mockValidate.mockRejectedValue(new Error("Request failed with status 403"));

    app.post("/test", async (c) => {
      const error = await validateThreadGraphOrError(c, "other-account-thread", mockAuth, "website");
      if (error) return error;
      return c.json({ ok: true });
    });

    const res = await app.request("/test", { method: "POST" });
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error as string).toContain("Forbidden");
  });

  it("rejects threads belonging to different graph (409)", async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      exists: true,
      chat_type: "website",
      project_id: 1,
    });

    app.post("/test", async (c) => {
      // Thread is a website thread, but deploy route is trying to use it
      const error = await validateThreadGraphOrError(c, "website-thread", mockAuth, "deploy");
      if (error) return error;
      return c.json({ ok: true });
    });

    const res = await app.request("/test", { method: "POST" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error as string).toContain("Conflict");
    expect(body.expected).toBe("deploy");
    expect(body.actual).toBe("website");
  });

  it("returns 500 on validation service errors", async () => {
    mockValidate.mockRejectedValue(new Error("Database connection failed"));

    app.post("/test", async (c) => {
      const error = await validateThreadGraphOrError(c, "thread-id", mockAuth, "website");
      if (error) return error;
      return c.json({ ok: true });
    });

    const res = await app.request("/test", { method: "POST" });
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error as string).toContain("Thread validation failed");
  });

  it("allows thread when chat_type is null but thread exists and is valid", async () => {
    // Edge case: thread exists, is valid, but has no chat_type set
    mockValidate.mockResolvedValue({
      valid: true,
      exists: true,
      chat_type: null,
      project_id: null,
    });

    app.post("/test", async (c) => {
      const error = await validateThreadGraphOrError(c, "thread-id", mockAuth, "insights");
      if (error) return error;
      return c.json({ ok: true });
    });

    const res = await app.request("/test", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });
});
