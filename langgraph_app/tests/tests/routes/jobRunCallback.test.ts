import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createHmac } from "crypto";
import { jobRunCallbackRoutes } from "../../../app/server/routes/webhooks/jobRunCallback";
import { env } from "@core";

// Mock the LangGraph SDK client
vi.mock("@langchain/langgraph-sdk", () => ({
  Client: vi.fn().mockImplementation(() => ({
    threads: {
      updateState: vi.fn().mockResolvedValue(undefined),
    },
    runs: {
      create: vi.fn().mockResolvedValue({ run_id: "run_123" }),
    },
  })),
}));

describe("jobRunCallback webhook route", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/", jobRunCallbackRoutes);
    vi.clearAllMocks();
  });

  const createSignature = (body: string): string => {
    return createHmac("sha256", env.JWT_SECRET).update(body).digest("hex");
  };

  const validPayload = {
    job_run_id: 123,
    thread_id: "thread_abc123",
    status: "completed" as const,
    result: {
      campaign_id: 456,
      external_id: "ext_789",
      deployed_at: "2024-01-15T10:00:00Z",
    },
  };

  describe("POST /webhooks/job_run_callback", () => {
    it("accepts valid webhook with correct signature", async () => {
      const body = JSON.stringify(validPayload);
      const signature = createSignature(body);

      const res = await app.request("/webhooks/job_run_callback", {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
    });

    it("rejects webhook with missing signature", async () => {
      const body = JSON.stringify(validPayload);

      const res = await app.request("/webhooks/job_run_callback", {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
        },
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Invalid signature");
    });

    it("rejects webhook with invalid signature", async () => {
      const body = JSON.stringify(validPayload);
      const invalidSignature = "invalid_signature_here";

      const res = await app.request("/webhooks/job_run_callback", {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Signature": invalidSignature,
        },
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Invalid signature");
    });

    it("rejects webhook with tampered body", async () => {
      const body = JSON.stringify(validPayload);
      const signature = createSignature(body);

      // Tamper with the body
      const tamperedBody = JSON.stringify({ ...validPayload, status: "failed" });

      const res = await app.request("/webhooks/job_run_callback", {
        method: "POST",
        body: tamperedBody,
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature, // Signature for original body
        },
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Invalid signature");
    });

    it("handles failed job status", async () => {
      const failedPayload = {
        job_run_id: 123,
        thread_id: "thread_abc123",
        status: "failed" as const,
        error: "Campaign deployment failed: API rate limit exceeded",
      };

      const body = JSON.stringify(failedPayload);
      const signature = createSignature(body);

      const res = await app.request("/webhooks/job_run_callback", {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
    });

    it("returns 500 when thread update fails", async () => {
      // Override the mock for this test
      const { Client } = await import("@langchain/langgraph-sdk");
      vi.mocked(Client).mockImplementationOnce(
        () =>
          ({
            threads: {
              updateState: vi.fn().mockRejectedValue(new Error("Thread not found")),
            },
            runs: {
              create: vi.fn(),
            },
          }) as any
      );

      const body = JSON.stringify(validPayload);
      const signature = createSignature(body);

      const res = await app.request("/webhooks/job_run_callback", {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
      });

      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Failed to resume thread");
    });
  });
});
