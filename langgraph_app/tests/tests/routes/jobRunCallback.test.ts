import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { createHmac } from "crypto";
import { jobRunCallbackRoutes } from "../../../app/server/routes/webhooks/jobRunCallback";
import { env } from "@core";
import { Deploy } from "@types";

// Mock the launchGraph
const mockGetState = vi.fn();
const mockUpdateState = vi.fn();

vi.mock("@graphs", () => ({
  deployGraph: {
    compile: vi.fn().mockReturnValue({
      getState: (...args: unknown[]) => mockGetState(...args),
      updateState: (...args: unknown[]) => mockUpdateState(...args),
    }),
  },
}));

vi.mock("@core", async () => {
  const actual = await vi.importActual("@core");
  return {
    ...actual,
    graphParams: {},
  };
});

describe("jobRunCallback webhook route (tasks pattern)", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/", jobRunCallbackRoutes);
    vi.clearAllMocks();
  });

  const createSignature = (body: string): string => {
    return createHmac("sha256", env.JWT_SECRET).update(body).digest("hex");
  };

  const existingTask: Deploy.Task = {
    ...Deploy.createTask("DeployingCampaign", 123),
    status: "pending",
  };

  describe("POST /webhooks/job_run_callback", () => {
    it("finds task by jobId and updates with result", async () => {
      const payload = {
        job_run_id: 123,
        thread_id: "thread_abc123",
        status: "completed" as const,
        result: {
          campaign_id: 456,
          external_id: "ext_789",
          deployed_at: "2024-01-15T10:00:00Z",
        },
      };

      // Mock getState to return current state with the task
      mockGetState.mockResolvedValue({
        values: {
          tasks: [existingTask],
        },
      });
      mockUpdateState.mockResolvedValue(undefined);

      const body = JSON.stringify(payload);
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

      // Verify updateState was called with correct task update
      expect(mockUpdateState).toHaveBeenCalledWith(
        { configurable: { thread_id: "thread_abc123" } },
        {
          tasks: [
            {
              ...existingTask,
              status: "running",
              result: payload.result,
            },
          ],
        }
      );
    });

    it("finds task by jobId and updates with error", async () => {
      const payload = {
        job_run_id: 123,
        thread_id: "thread_abc123",
        status: "failed" as const,
        error: "API rate limit exceeded",
      };

      mockGetState.mockResolvedValue({
        values: {
          tasks: [existingTask],
        },
      });
      mockUpdateState.mockResolvedValue(undefined);

      const body = JSON.stringify(payload);
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

      // Verify updateState was called with error
      expect(mockUpdateState).toHaveBeenCalledWith(
        { configurable: { thread_id: "thread_abc123" } },
        {
          tasks: [
            {
              ...existingTask,
              status: "running",
              error: "API rate limit exceeded",
            },
          ],
        }
      );
    });

    it("returns 404 when thread not found", async () => {
      const payload = {
        job_run_id: 123,
        thread_id: "nonexistent_thread",
        status: "completed" as const,
        result: { success: true },
      };

      mockGetState.mockResolvedValue(null);

      const body = JSON.stringify(payload);
      const signature = createSignature(body);

      const res = await app.request("/webhooks/job_run_callback", {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
      });

      expect(res.status).toBe(404);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Thread not found");
    });

    it("returns 404 when task with jobId not found", async () => {
      const payload = {
        job_run_id: 999, // Different job ID
        thread_id: "thread_abc123",
        status: "completed" as const,
        result: { success: true },
      };

      mockGetState.mockResolvedValue({
        values: {
          tasks: [existingTask], // Has job_id 123, not 999
        },
      });

      const body = JSON.stringify(payload);
      const signature = createSignature(body);

      const res = await app.request("/webhooks/job_run_callback", {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Signature": signature,
        },
      });

      expect(res.status).toBe(404);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Task not found");
    });

    it("rejects webhook with missing signature", async () => {
      const payload = {
        job_run_id: 123,
        thread_id: "thread_abc123",
        status: "completed" as const,
        result: { success: true },
      };

      const body = JSON.stringify(payload);

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
      const payload = {
        job_run_id: 123,
        thread_id: "thread_abc123",
        status: "completed" as const,
        result: { success: true },
      };

      const body = JSON.stringify(payload);

      const res = await app.request("/webhooks/job_run_callback", {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/json",
          "X-Signature": "invalid_signature",
        },
      });

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("Invalid signature");
    });

    it("returns 500 when updateState fails", async () => {
      const payload = {
        job_run_id: 123,
        thread_id: "thread_abc123",
        status: "completed" as const,
        result: { success: true },
      };

      mockGetState.mockResolvedValue({
        values: {
          tasks: [existingTask],
        },
      });
      mockUpdateState.mockRejectedValue(new Error("Database error"));

      const body = JSON.stringify(payload);
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
      expect(json.error).toBe("Failed to update state");
    });

    /**
     * Google OAuth Connect Integration Tests
     */
    describe("GoogleOAuthConnect integration", () => {
      const googleConnectTask: Deploy.Task = {
        ...Deploy.createTask("ConnectingGoogle", 456),
        status: "running",
      };

      it("updates ConnectingGoogle task with google_email result", async () => {
        const payload = {
          job_run_id: 456,
          thread_id: "thread_google_oauth",
          status: "completed" as const,
          result: {
            google_email: "user@gmail.com",
          },
        };

        mockGetState.mockResolvedValue({
          values: {
            tasks: [googleConnectTask],
          },
        });
        mockUpdateState.mockResolvedValue(undefined);

        const body = JSON.stringify(payload);
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

        // Verify task updated with google_email result
        expect(mockUpdateState).toHaveBeenCalledWith(
          { configurable: { thread_id: "thread_google_oauth" } },
          {
            tasks: [
              {
                ...googleConnectTask,
                status: "running",
                result: { google_email: "user@gmail.com" },
              },
            ],
          }
        );
      });

      it("updates ConnectingGoogle task with error when OAuth cancelled", async () => {
        const payload = {
          job_run_id: 456,
          thread_id: "thread_google_oauth",
          status: "failed" as const,
          error: "OAuth was cancelled by user",
        };

        mockGetState.mockResolvedValue({
          values: {
            tasks: [googleConnectTask],
          },
        });
        mockUpdateState.mockResolvedValue(undefined);

        const body = JSON.stringify(payload);
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

        // Verify task updated with error
        expect(mockUpdateState).toHaveBeenCalledWith(
          { configurable: { thread_id: "thread_google_oauth" } },
          {
            tasks: [
              {
                ...googleConnectTask,
                status: "running",
                error: "OAuth was cancelled by user",
              },
            ],
          }
        );
      });
    });

    /**
     * Google Ads Invite Integration Tests
     */
    describe("GoogleAdsInvite integration", () => {
      const verifyGoogleTask: Deploy.Task = {
        ...Deploy.createTask("VerifyingGoogle", 789),
        status: "running",
      };

      it("updates VerifyingGoogle task with accepted status", async () => {
        const payload = {
          job_run_id: 789,
          thread_id: "thread_google_invite",
          status: "completed" as const,
          result: {
            status: "accepted",
          },
        };

        mockGetState.mockResolvedValue({
          values: {
            tasks: [verifyGoogleTask],
          },
        });
        mockUpdateState.mockResolvedValue(undefined);

        const body = JSON.stringify(payload);
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

        // Verify task updated with accepted result
        expect(mockUpdateState).toHaveBeenCalledWith(
          { configurable: { thread_id: "thread_google_invite" } },
          {
            tasks: [
              {
                ...verifyGoogleTask,
                status: "running",
                result: { status: "accepted" },
              },
            ],
          }
        );
      });

      it("updates VerifyingGoogle task with error when invite declined", async () => {
        const payload = {
          job_run_id: 789,
          thread_id: "thread_google_invite",
          status: "failed" as const,
          error: "Invitation was declined",
        };

        mockGetState.mockResolvedValue({
          values: {
            tasks: [verifyGoogleTask],
          },
        });
        mockUpdateState.mockResolvedValue(undefined);

        const body = JSON.stringify(payload);
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

        // Verify task updated with error
        expect(mockUpdateState).toHaveBeenCalledWith(
          { configurable: { thread_id: "thread_google_invite" } },
          {
            tasks: [
              {
                ...verifyGoogleTask,
                status: "running",
                error: "Invitation was declined",
              },
            ],
          }
        );
      });
    });
  });
});
