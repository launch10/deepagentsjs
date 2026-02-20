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
    DeployService: { touch: vi.fn().mockResolvedValue(undefined) },
  };
});

// Now import everything
import { checkPaymentNode, isPaymentVerified } from "@nodes";
import { JobRunAPIService } from "@rails_api";
import { GoogleAPIService } from "@services";

const mockJobRunAPIService = vi.mocked(JobRunAPIService);
const mockGoogleAPIService = vi.mocked(GoogleAPIService);

describe("checkPaymentNode", () => {
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
            google_connected: false,
            google_email: null,
            invite_accepted: false,
            invite_status: "none",
            invite_email: null,
            has_payment: false,
            billing_status: "none",
          }),
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
        tasks: [{ ...Deploy.createTask("CheckingBilling"), status: "completed" } as Task.Task],
      };

      const result = await checkPaymentNode(state as DeployGraphState);
      expect(result).toEqual({});
      expect(mockJobRunAPIService).not.toHaveBeenCalled();
    });

    it("returns empty when task is already failed (no-op)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [{ ...Deploy.createTask("CheckingBilling"), status: "failed" } as Task.Task],
      };

      const result = await checkPaymentNode(state as DeployGraphState);
      expect(result).toEqual({});
      expect(mockJobRunAPIService).not.toHaveBeenCalled();
    });

    it("marks task completed when running with result (has_payment: true) from webhook", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("CheckingBilling"),
            status: "running",
            jobId: 123,
            result: { has_payment: true },
          } as Task.Task,
        ],
      };

      const result = await checkPaymentNode(state as DeployGraphState);

      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "CheckingBilling");
      expect(updatedTask?.status).toBe("completed");
    });

    /**
     * USER OUTCOME: When user clicks "Payment Method Added" on CheckingPaymentScreen,
     * the frontend sends updateState({ tasks: [{ name: "CheckingBilling", result: { has_payment: true } }] }).
     * The MergeReducer merges this into the existing running task — same code path as webhook,
     * but triggered by user action rather than polling. Graph trusts the user and proceeds.
     */
    it("marks task completed when user confirms payment via frontend updateState", async () => {
      // Simulates the merged state after MergeReducer processes
      // updateState({ tasks: [{ name: "CheckingBilling", result: { has_payment: true } }] })
      // The existing running task (with jobId) gets result merged in
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("CheckingBilling"),
            status: "running",
            jobId: 123,
            result: { has_payment: true },
          } as Task.Task,
        ],
      };

      const result = await checkPaymentNode(state as DeployGraphState);

      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "CheckingBilling");
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
            ...Deploy.createTask("CheckingBilling"),
            status: "running",
            jobId: 123,
            error: "Payment verification failed",
          } as Task.Task,
        ],
      };

      const result = await checkPaymentNode(state as DeployGraphState);

      const updatedTask = result.tasks?.find((t: Task.Task) => t.name === "CheckingBilling");
      expect(updatedTask?.status).toBe("failed");
    });

    it("returns empty when task is running with jobId (waiting for webhook)", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: "thread_123" as ThreadIDType,
        tasks: [
          {
            ...Deploy.createTask("CheckingBilling"),
            status: "running",
            jobId: 123,
            // No result yet - waiting
          } as Task.Task,
        ],
      };

      const result = await checkPaymentNode(state as DeployGraphState);
      expect(result).toEqual({});
    });
  });

  /**
   * =============================================================================
   * JOB RUN CREATION TESTS
   * =============================================================================
   */
  describe("JobRun creation", () => {
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
        tasks: [],
      };

      const result = await checkPaymentNode(state as DeployGraphState);

      expect(mockCreate).toHaveBeenCalledWith({
        jobClass: "GoogleAdsPaymentCheck",
        arguments: {},
        threadId: "thread_123",
      });

      const newTask = result.tasks?.find((t: Task.Task) => t.name === "CheckingBilling");
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

      await expect(checkPaymentNode(state as DeployGraphState)).rejects.toThrow(
        "JWT token is required"
      );
    });

    it("throws when threadId is missing", async () => {
      const state: Partial<DeployGraphState> = {
        jwt: "test-jwt",
        threadId: undefined,
        tasks: [],
      };

      await expect(checkPaymentNode(state as DeployGraphState)).rejects.toThrow(
        "Thread ID is required"
      );
    });
  });
});

describe("isPaymentVerified", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGoogleAPIService.mockImplementation(
      () =>
        ({
          getGoogleStatus: vi.fn().mockResolvedValue({
            google_connected: false,
            google_email: null,
            invite_accepted: false,
            invite_status: "none",
            invite_email: null,
            has_payment: false,
            billing_status: "none",
          }),
        }) as any
    );
  });

  it("returns true when API says payment is verified", async () => {
    const mockGetStatus = vi.fn().mockResolvedValue({
      google_connected: false,
      google_email: null,
      invite_accepted: false,
      invite_status: "none",
      invite_email: null,
      has_payment: true,
      billing_status: "approved",
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

    const result = await isPaymentVerified(state as DeployGraphState);
    expect(result).toBe(true);
  });

  it("returns false when API says no payment", async () => {
    const state: Partial<DeployGraphState> = {
      jwt: "test-jwt",
      tasks: [],
    };

    const result = await isPaymentVerified(state as DeployGraphState);
    expect(result).toBe(false);
  });

  it("returns false when JWT is missing", async () => {
    const state: Partial<DeployGraphState> = {
      jwt: undefined,
      tasks: [],
    };

    const result = await isPaymentVerified(state as DeployGraphState);
    expect(result).toBe(false);
    expect(mockGoogleAPIService).not.toHaveBeenCalled();
  });
});
