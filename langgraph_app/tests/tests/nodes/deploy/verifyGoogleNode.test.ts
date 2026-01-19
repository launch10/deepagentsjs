import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DeployGraphState } from "@annotation";
import { Deploy, type Task, type ThreadIDType } from "@types";

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
  verifyGoogleNode,
  isGoogleVerified,
  shouldSkipGoogleVerify,
} from "../../../../app/nodes/deploy/verifyGoogleNode";
import { JobRunAPIService } from "@rails_api";
import { GoogleAPIService } from "@services";

const mockJobRunAPIService = vi.mocked(JobRunAPIService);
const mockGoogleAPIService = vi.mocked(GoogleAPIService);

describe("verifyGoogleNode", () => {
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
          getConnectionStatus: vi
            .fn()
            .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
          getInviteStatus: vi
            .fn()
            .mockResolvedValue({ accepted: false, status: "sent", email: "user@gmail.com" }),
        }) as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * =============================================================================
   * IDEMPOTENT PATTERN TESTS - Core behavior
   * =============================================================================
   */
  describe("Idempotent pattern", () => {
    it("returns empty when task is already completed (no-op)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [{ ...Deploy.createTask("VerifyingGoogle"), status: "completed" } as Task.Task],
      };

      const result = await verifyGoogleNode(state as DeployGraphState);
      expect(result).toEqual({});
      expect(mockJobRunAPIService).not.toHaveBeenCalled();
    });

    it("returns empty when task is already failed (no-op)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [{ ...Deploy.createTask("VerifyingGoogle"), status: "failed" } as Task.Task],
      };

      const result = await verifyGoogleNode(state as DeployGraphState);
      expect(result).toEqual({});
      expect(mockJobRunAPIService).not.toHaveBeenCalled();
    });

    it("marks task completed when running with result (status: accepted) from webhook", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("VerifyingGoogle"),
            status: "running",
            jobId: 123,
            result: { status: "accepted" },
          } as Task.Task,
        ],
      };

      const result = await verifyGoogleNode(state as DeployGraphState);

      // Should update task to completed
      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "VerifyingGoogle");
      expect(updatedTask?.status).toBe("completed");
    });

    it("marks task failed when running with error from webhook", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("VerifyingGoogle"),
            status: "running",
            jobId: 123,
            error: "Invitation was declined",
          } as Task.Task,
        ],
      };

      const result = await verifyGoogleNode(state as DeployGraphState);

      // Should update task to failed
      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "VerifyingGoogle");
      expect(updatedTask?.status).toBe("failed");
    });

    it("returns empty when task is running with jobId (waiting for polling)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("VerifyingGoogle"),
            status: "running",
            jobId: 123,
            // No result yet - polling in progress
          } as Task.Task,
        ],
      };

      const result = await verifyGoogleNode(state as DeployGraphState);
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
            ...Deploy.createTask("VerifyingGoogle"),
            status: "running",
            // No jobId - needs to create one
          } as Task.Task,
        ],
      };

      const result = await verifyGoogleNode(state as DeployGraphState);

      // Should have called JobRunAPIService.create
      expect(mockJobRunAPIService).toHaveBeenCalledWith({ jwt: "test-jwt" });
      expect(mockCreate).toHaveBeenCalledWith({
        jobClass: "GoogleAdsInvite",
        arguments: {},
        threadId: "thread_123",
      });

      // Should update task with jobId
      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "VerifyingGoogle");
      expect(updatedTask?.jobId).toBe(456);
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
        tasks: [], // No VerifyingGoogle task yet
      };

      const result = await verifyGoogleNode(state as DeployGraphState);

      // Should have created JobRun
      expect(mockCreate).toHaveBeenCalledWith({
        jobClass: "GoogleAdsInvite",
        arguments: {},
        threadId: "thread_123",
      });

      // Should have created task with running status and jobId
      const newTask = result.tasks?.find((t: Task.Task) => t.name === "VerifyingGoogle");
      expect(newTask).toBeDefined();
      expect(newTask?.status).toBe("running");
      expect(newTask?.jobId).toBe(789);
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

      await expect(verifyGoogleNode(state as DeployGraphState)).rejects.toThrow(
        "JWT token is required"
      );
    });

    it("throws when threadId is missing", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: undefined,
        tasks: [],
      };

      await expect(verifyGoogleNode(state as DeployGraphState)).rejects.toThrow(
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

      await expect(verifyGoogleNode(state as DeployGraphState)).rejects.toThrow(
        "Rails API unavailable"
      );
    });

    it("handles task with running status but empty result (waiting state)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("VerifyingGoogle"),
            status: "running",
            jobId: 123,
            result: {}, // Empty result object (not null/undefined)
          } as Task.Task,
        ],
      };

      // Should return empty (waiting for polling)
      const result = await verifyGoogleNode(state as DeployGraphState);
      expect(result).toEqual({});
    });

    it("handles result with unexpected status (not 'accepted')", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("VerifyingGoogle"),
            status: "running",
            jobId: 123,
            result: { status: "pending" }, // Not 'accepted', still waiting
          } as Task.Task,
        ],
      };

      // Should return empty (still waiting for 'accepted')
      const result = await verifyGoogleNode(state as DeployGraphState);
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

      const result = await verifyGoogleNode(state as DeployGraphState);

      // Should return phases alongside tasks
      expect(result.phases).toBeDefined();
      const verifyPhase = result.phases?.find((p) => p.name === "VerifyingGoogle");
      expect(verifyPhase).toBeDefined();
    });
  });
});

/**
 * =============================================================================
 * CONDITIONAL ROUTING TESTS - shouldSkipGoogleVerify
 * =============================================================================
 */
describe("isGoogleVerified", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock - not verified
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: vi
            .fn()
            .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
          getInviteStatus: vi
            .fn()
            .mockResolvedValue({ accepted: false, status: "sent", email: "user@gmail.com" }),
        }) as any
    );
  });

  // Note: Task completion is now handled by the executor, not isGoogleVerified
  // The function only checks external state (API call)

  it("calls GoogleAPIService to check invite status", async () => {
    const mockGetStatus = vi
      .fn()
      .mockResolvedValue({ accepted: true, status: "accepted", email: "user@gmail.com" });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getInviteStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [], // No completed task
    };

    const result = await isGoogleVerified(state as DeployGraphState);

    expect(mockGoogleAPIService).toHaveBeenCalledWith({ jwt: "test-jwt" });
    expect(mockGetStatus).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("returns false when API says not accepted", async () => {
    const mockGetStatus = vi
      .fn()
      .mockResolvedValue({ accepted: false, status: "sent", email: "user@gmail.com" });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getInviteStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
    };

    const result = await isGoogleVerified(state as DeployGraphState);
    expect(result).toBe(false);
  });

  it("returns false when JWT is missing (cannot check API)", async () => {
    const state: Partial<DeployGraphState> = {
      jwt: undefined,
      tasks: [],
    };

    const result = await isGoogleVerified(state as DeployGraphState);
    expect(result).toBe(false);
    // Should not call API when JWT is missing
    expect(mockGoogleAPIService).not.toHaveBeenCalled();
  });

  it("propagates error when GoogleAPIService fails", async () => {
    const mockGetStatus = vi.fn().mockRejectedValue(new Error("Network error"));
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getInviteStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
    };

    await expect(isGoogleVerified(state as DeployGraphState)).rejects.toThrow("Network error");
  });

  it("checks API even when task exists but not completed", async () => {
    const mockGetStatus = vi
      .fn()
      .mockResolvedValue({ accepted: true, status: "accepted", email: "user@gmail.com" });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getInviteStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [{ ...Deploy.createTask("VerifyingGoogle"), status: "running" } as Task.Task],
    };

    const result = await isGoogleVerified(state as DeployGraphState);
    expect(result).toBe(true);
    expect(mockGetStatus).toHaveBeenCalled();
  });
});

describe("shouldSkipGoogleVerify", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock - not verified
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getConnectionStatus: vi
            .fn()
            .mockResolvedValue({ connected: true, email: "user@gmail.com" }),
          getInviteStatus: vi
            .fn()
            .mockResolvedValue({ accepted: false, status: "sent", email: "user@gmail.com" }),
        }) as any
    );
  });

  it('returns "skipGoogleVerify" when Google is verified', async () => {
    const mockGetStatus = vi
      .fn()
      .mockResolvedValue({ accepted: true, status: "accepted", email: "user@gmail.com" });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getInviteStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
    };

    const result = await shouldSkipGoogleVerify(state as DeployGraphState);
    expect(result).toBe("skipGoogleVerify");
  });

  it('returns "enqueueGoogleVerify" when Google is not verified', async () => {
    const mockGetStatus = vi
      .fn()
      .mockResolvedValue({ accepted: false, status: "sent", email: "user@gmail.com" });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getInviteStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
    };

    const result = await shouldSkipGoogleVerify(state as DeployGraphState);
    expect(result).toBe("enqueueGoogleVerify");
  });
});
