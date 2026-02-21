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
import { verifyGoogleNode, isGoogleVerified, shouldSkipGoogleVerify } from "@nodes";
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
          getGoogleStatus: vi.fn().mockResolvedValue({
            google_connected: true,
            google_email: "user@gmail.com",
            invite_accepted: false,
            invite_status: "sent",
            invite_email: "user@gmail.com",
            has_payment: false,
            billing_status: "none",
          }),
          refreshInviteStatus: vi.fn().mockResolvedValue({ accepted: false, status: "pending" }),
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

    /**
     * USER OUTCOME: When user clicks "I accepted the invite" on InviteAcceptScreen,
     * the frontend sends updateState({ tasks: [{ name: "VerifyingGoogle", result: { status: "accepted" } }] }).
     * The MergeReducer merges this into the existing running task — same code path as webhook,
     * but triggered by user action rather than polling. Graph trusts the user and proceeds.
     */
    it("marks task completed when user confirms acceptance via frontend updateState", async () => {
      // Simulates the merged state after MergeReducer processes
      // updateState({ tasks: [{ name: "VerifyingGoogle", result: { status: "accepted" } }] })
      // The existing running task (with jobId) gets result merged in
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

      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "VerifyingGoogle");
      expect(updatedTask?.status).toBe("completed");
      // Should NOT have called any external APIs — trusts the signal directly
      expect(mockJobRunAPIService).not.toHaveBeenCalled();
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

    it("re-creates job when result has unexpected status (not 'accepted')", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        accountId: 1,
        tasks: [
          {
            ...Deploy.createTask("VerifyingGoogle"),
            status: "running",
            jobId: 123,
            result: { status: "pending" }, // Not 'accepted' — falls through to re-create
          } as Task.Task,
        ],
      };

      const result = await verifyGoogleNode(state as DeployGraphState);
      // Falls through to step 6 (create new JobRun) since result.status !== "accepted"
      // and self-heal condition (!task.result?.status) is false
      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "VerifyingGoogle");
      expect(updatedTask?.jobId).toBeDefined();
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
          getGoogleStatus: vi.fn().mockResolvedValue({
            google_connected: true,
            google_email: "user@gmail.com",
            invite_accepted: false,
            invite_status: "sent",
            invite_email: "user@gmail.com",
            has_payment: false,
            billing_status: "none",
          }),
        }) as any
    );
  });

  // Note: Task completion is now handled by the executor, not isGoogleVerified
  // The function only checks external state (API call)

  it("calls GoogleAPIService to check invite status", async () => {
    const mockGetStatus = vi.fn().mockResolvedValue({
      google_connected: true,
      google_email: "user@gmail.com",
      invite_accepted: true,
      invite_status: "accepted",
      invite_email: "user@gmail.com",
      has_payment: false,
      billing_status: "none",
    });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getGoogleStatus: mockGetStatus,
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
    const mockGetStatus = vi.fn().mockResolvedValue({
      google_connected: true,
      google_email: "user@gmail.com",
      invite_accepted: false,
      invite_status: "sent",
      invite_email: "user@gmail.com",
      has_payment: false,
      billing_status: "none",
    });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getGoogleStatus: mockGetStatus,
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
          getGoogleStatus: mockGetStatus,
        }) as any
    );

    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
    };

    await expect(isGoogleVerified(state as DeployGraphState)).rejects.toThrow("Network error");
  });

  it("checks API even when task exists but not completed", async () => {
    const mockGetStatus = vi.fn().mockResolvedValue({
      google_connected: true,
      google_email: "user@gmail.com",
      invite_accepted: true,
      invite_status: "accepted",
      invite_email: "user@gmail.com",
      has_payment: false,
      billing_status: "none",
    });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getGoogleStatus: mockGetStatus,
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
          getGoogleStatus: vi.fn().mockResolvedValue({
            google_connected: true,
            google_email: "user@gmail.com",
            invite_accepted: false,
            invite_status: "sent",
            invite_email: "user@gmail.com",
            has_payment: false,
            billing_status: "none",
          }),
        }) as any
    );
  });

  it('returns "skipGoogleVerify" when Google is verified', async () => {
    const mockGetStatus = vi.fn().mockResolvedValue({
      google_connected: true,
      google_email: "user@gmail.com",
      invite_accepted: true,
      invite_status: "accepted",
      invite_email: "user@gmail.com",
      has_payment: false,
      billing_status: "none",
    });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getGoogleStatus: mockGetStatus,
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
    const mockGetStatus = vi.fn().mockResolvedValue({
      google_connected: true,
      google_email: "user@gmail.com",
      invite_accepted: false,
      invite_status: "sent",
      invite_email: "user@gmail.com",
      has_payment: false,
      billing_status: "none",
    });
    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getGoogleStatus: mockGetStatus,
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
