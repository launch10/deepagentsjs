import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DeployGraphState } from "@annotation";
import { Deploy, type LangGraphRunnableConfig, type Task, type ThreadIDType } from "@types";

// Mock modules BEFORE importing them
vi.mock("@rails_api", async () => {
  const actual = await vi.importActual("@rails_api");
  return {
    ...actual,
    JobRunAPIService: vi.fn(),
  };
});

vi.mock("@services", async () => {
  const actual = await vi.importActual("@services");
  return {
    ...actual,
    GoogleAPIService: vi.fn(),
  };
});

// Now import everything
import {
  googleConnectNode,
  isGoogleConnected,
  googleConnectTaskRunner as taskRunner,
} from "@nodes";
import { JobRunAPIService } from "@rails_api";
import { GoogleAPIService } from "@services";

const mockJobRunAPIService = vi.mocked(JobRunAPIService);
const mockGoogleAPIService = vi.mocked(GoogleAPIService);

describe("googleConnectNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockJobRunAPIService.mockImplementation(
      () =>
        ({
          create: vi.fn().mockResolvedValue({ id: 123, status: "pending" }),
        }) as any
    );

    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: vi.fn().mockResolvedValue({ connected: false, email: null }),
          getInviteStatus: vi
            .fn()
            .mockResolvedValue({ accepted: false, status: "none", email: null }),
        }) as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * =============================================================================
   * IDEMPOTENT PATTERN TESTS - Core behavior from deployCampaignNode pattern
   * =============================================================================
   */
  describe("Idempotent pattern", () => {
    it("returns empty when task is already completed (no-op)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [{ ...Deploy.createTask("ConnectingGoogle"), status: "completed" } as Task.Task],
      };

      const result = await googleConnectNode(state as DeployGraphState);
      expect(result).toEqual({});
      expect(mockJobRunAPIService).not.toHaveBeenCalled();
    });

    it("returns empty when task is already failed (no-op)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [{ ...Deploy.createTask("ConnectingGoogle"), status: "failed" } as Task.Task],
      };

      const result = await googleConnectNode(state as DeployGraphState);
      expect(result).toEqual({});
      expect(mockJobRunAPIService).not.toHaveBeenCalled();
    });

    it("marks task completed when running with result from webhook (google_email)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("ConnectingGoogle"),
            status: "running",
            jobId: 123,
            result: { google_email: "user@gmail.com" },
          } as Task.Task,
        ],
      };

      const result = await googleConnectNode(state as DeployGraphState);

      // Should update task to completed
      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "ConnectingGoogle");
      expect(updatedTask?.status).toBe("completed");
    });

    it("marks task failed when running with error from webhook", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("ConnectingGoogle"),
            status: "running",
            jobId: 123,
            error: "OAuth was cancelled",
          } as Task.Task,
        ],
      };

      const result = await googleConnectNode(state as DeployGraphState);

      // Should update task to failed
      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "ConnectingGoogle");
      expect(updatedTask?.status).toBe("failed");
    });

    it("returns empty when task is running with jobId (waiting for OAuth callback)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("ConnectingGoogle"),
            status: "running",
            jobId: 123,
            // No result yet - waiting for OAuth callback
          } as Task.Task,
        ],
      };

      const result = await googleConnectNode(state as DeployGraphState);
      expect(result).toEqual({});
    });
  });

  /**
   * =============================================================================
   * JOB RUN CREATION TESTS - Fire-and-forget pattern
   * =============================================================================
   */
  describe("JobRun creation", () => {
    it("creates JobRun when task is running without jobId", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 456, status: "pending" });
      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: mockCreate,
          }) as any
      );

      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        accountId: 1,
        tasks: [
          {
            ...Deploy.createTask("ConnectingGoogle"),
            status: "running",
            // No jobId - needs to create one
          } as Task.Task,
        ],
      };

      const result = await googleConnectNode(state as DeployGraphState);

      // Should have called JobRunAPIService.create
      expect(mockJobRunAPIService).toHaveBeenCalledWith({ jwt: "test-jwt" });
      expect(mockCreate).toHaveBeenCalledWith({
        jobClass: "GoogleOAuthConnect",
        arguments: {},
        threadId: "thread_123",
      });

      // Should update task with jobId and oauth_required result
      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "ConnectingGoogle");
      expect(updatedTask?.jobId).toBe(456);
      expect(updatedTask?.result).toEqual({ action: "oauth_required" });
    });

    it("creates task and JobRun on first run (no existing task)", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 789, status: "pending" });
      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: mockCreate,
          }) as any
      );

      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        accountId: 1,
        tasks: [], // No ConnectingGoogle task yet
      };

      const result = await googleConnectNode(state as DeployGraphState);

      // Should have created JobRun
      expect(mockCreate).toHaveBeenCalledWith({
        jobClass: "GoogleOAuthConnect",
        arguments: {},
        threadId: "thread_123",
      });

      // Should have created task with running status, jobId, and oauth_required result
      const newTask = result.tasks?.find((t: Task.Task) => t.name === "ConnectingGoogle");
      expect(newTask).toBeDefined();
      expect(newTask?.status).toBe("running");
      expect(newTask?.jobId).toBe(789);
      expect(newTask?.result).toEqual({ action: "oauth_required" });
    });
  });

  /**
   * =============================================================================
   * ERROR HANDLING TESTS
   * =============================================================================
   */
  describe("Error handling", () => {
    it("throws when JWT is missing", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: undefined,
        threadId: "thread_123" as ThreadIDType,
        tasks: [],
      };

      await expect(googleConnectNode(state as DeployGraphState)).rejects.toThrow(
        "JWT token is required"
      );
    });

    it("throws when threadId is missing", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: undefined,
        tasks: [],
      };

      await expect(googleConnectNode(state as DeployGraphState)).rejects.toThrow(
        "Thread ID is required"
      );
    });

    it("propagates error when JobRunAPIService.create fails", async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error("Rails API unavailable"));
      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: mockCreate,
          }) as any
      );

      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [],
      };

      await expect(googleConnectNode(state as DeployGraphState)).rejects.toThrow(
        "Rails API unavailable"
      );
    });

    it("handles task with running status but empty result (waiting state)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("ConnectingGoogle"),
            status: "running",
            jobId: 123,
            result: {}, // Empty result object (not null/undefined)
          } as Task.Task,
        ],
      };

      // Should return empty (waiting for OAuth callback)
      const result = await googleConnectNode(state as DeployGraphState);
      expect(result).toEqual({});
    });
  });

  /**
   * =============================================================================
   * PHASE COMPUTATION TESTS
   * =============================================================================
   */
  describe("Phase computation", () => {
    it("computes phases when updating task status", async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 123, status: "pending" });
      mockJobRunAPIService.mockImplementation(
        () =>
          ({
            create: mockCreate,
          }) as any
      );

      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        accountId: 1,
        tasks: [],
      };

      const result = await googleConnectNode(state as DeployGraphState);

      // Should return phases alongside tasks
      expect(result.phases).toBeDefined();
      const googlePhase = result.phases?.find((p) => p.name === "ConnectingGoogle");
      expect(googlePhase).toBeDefined();
    });
  });
});

/**
 * =============================================================================
 * CONDITIONAL ROUTING TESTS - shouldSkipGoogleConnect
 * =============================================================================
 */
describe("isGoogleConnected", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock - not connected
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: vi.fn().mockResolvedValue({ connected: false, email: null }),
          getInviteStatus: vi
            .fn()
            .mockResolvedValue({ accepted: false, status: "none", email: null }),
        }) as any
    );
  });

  // Note: Task completion is now handled by the executor, not isGoogleConnected
  // The function only checks external state (API call)

  it("calls GoogleAPIService to check connection status", async () => {
    const mockGetStatus = vi.fn().mockResolvedValue({ connected: true, email: "user@gmail.com" });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [], // No completed task
    };

    const result = await isGoogleConnected(state as DeployGraphState);

    expect(mockGoogleAPIService).toHaveBeenCalledWith({ jwt: "test-jwt" });
    expect(mockGetStatus).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("returns false when API says not connected", async () => {
    const mockGetStatus = vi.fn().mockResolvedValue({ connected: false, email: null });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
    };

    const result = await isGoogleConnected(state as DeployGraphState);
    expect(result).toBe(false);
  });

  it("returns false when JWT is missing (cannot check API)", async () => {
    const state: Partial<DeployGraphState> = {
      jwt: undefined,
      tasks: [],
    };

    const result = await isGoogleConnected(state as DeployGraphState);
    expect(result).toBe(false);
    // Should not call API when JWT is missing
    expect(mockGoogleAPIService).not.toHaveBeenCalled();
  });

  it("propagates error when GoogleAPIService fails", async () => {
    const mockGetStatus = vi.fn().mockRejectedValue(new Error("Network error"));
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
    };

    await expect(isGoogleConnected(state as DeployGraphState)).rejects.toThrow("Network error");
  });

  it("checks API even when task exists but not completed", async () => {
    const mockGetStatus = vi.fn().mockResolvedValue({ connected: true, email: "user@gmail.com" });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [{ ...Deploy.createTask("ConnectingGoogle"), status: "running" } as Task.Task],
    };

    const result = await isGoogleConnected(state as DeployGraphState);
    expect(result).toBe(true);
    expect(mockGetStatus).toHaveBeenCalled();
  });
});

describe("shouldSkipGoogleConnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock - not connected
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: vi.fn().mockResolvedValue({ connected: false, email: null }),
          getInviteStatus: vi
            .fn()
            .mockResolvedValue({ accepted: false, status: "none", email: null }),
        }) as any
    );
  });

  it("returns true when Google is connected", async () => {
    const mockGetStatus = vi.fn().mockResolvedValue({ connected: true, email: "user@gmail.com" });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
    };

    const result = await taskRunner.shouldSkip(state as DeployGraphState);
    expect(result).toBe(true);
  });

  it("returns false when Google is not connected", async () => {
    const mockGetStatus = vi.fn().mockResolvedValue({ connected: false, email: null });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
      instructions: { googleAds: true }, // Must deploy Google Ads to not skip
    };

    const result = await taskRunner.shouldSkip(state as DeployGraphState);
    expect(result).toBe(false);
  });
});
