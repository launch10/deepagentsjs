import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { canProceedWithRun, checkCredits, CreditCheckError, type CreditCheckResult } from "@core";

// Mock the Rails API client using the async pattern
const mockClient = {
  GET: vi.fn(),
};

vi.mock("@rails_api", async () => {
  const actual = await vi.importActual("@rails_api");
  return {
    ...actual,
    createRailsApiClient: vi.fn().mockResolvedValue(mockClient),
  };
});

import { createRailsApiClient } from "@rails_api";

/**
 * Credit Check Tests
 *
 * Tests for the pre-run balance check functionality.
 * This fetches the account's credit balance from Rails before graph execution.
 *
 * API: GET /api/v1/credits/check (JWT authenticated, account derived from token)
 * Response: { ok: boolean, balance_millicredits: number, plan_millicredits: number, pack_millicredits: number }
 */
describe.sequential("creditCheck", () => {
  describe("canProceedWithRun", () => {
    it("returns true when ok is true", () => {
      const result: CreditCheckResult = {
        ok: true,
        balanceMillicredits: 5_000_000,
        planMillicredits: 4_000_000,
        packMillicredits: 1_000_000,
      };

      expect(canProceedWithRun(result)).toBe(true);
    });

    it("returns false when ok is false", () => {
      const result: CreditCheckResult = {
        ok: false,
        balanceMillicredits: 0,
        planMillicredits: 0,
        packMillicredits: 0,
      };

      expect(canProceedWithRun(result)).toBe(false);
    });

    it("returns false when ok is false with negative balance", () => {
      const result: CreditCheckResult = {
        ok: false,
        balanceMillicredits: -500_000,
        planMillicredits: -500_000,
        packMillicredits: 0,
      };

      expect(canProceedWithRun(result)).toBe(false);
    });

    it("returns true when ok is true with only pack credits", () => {
      const result: CreditCheckResult = {
        ok: true,
        balanceMillicredits: 1_000_000,
        planMillicredits: 0,
        packMillicredits: 1_000_000,
      };

      expect(canProceedWithRun(result)).toBe(true);
    });
  });

  describe("CreditCheckError", () => {
    it("has correct name", () => {
      const error = new CreditCheckError("Test error");
      expect(error.name).toBe("CreditCheckError");
    });

    it("stores status code", () => {
      const error = new CreditCheckError("Test error", 404);
      expect(error.statusCode).toBe(404);
    });

    it("stores account id", () => {
      const error = new CreditCheckError("Test error", 404, 123);
      expect(error.accountId).toBe(123);
    });

    it("extends Error", () => {
      const error = new CreditCheckError("Test error");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("checkCredits", () => {
    beforeEach(() => {
      mockClient.GET.mockReset();
      vi.mocked(createRailsApiClient).mockClear();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it("throws CreditCheckError when JWT is missing", async () => {
      await expect(checkCredits("")).rejects.toThrow(CreditCheckError);
      await expect(checkCredits("")).rejects.toThrow("JWT token is required");
    });

    it("returns CreditCheckResult on successful response", async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          ok: true,
          balance_millicredits: 5_000_000,
          plan_millicredits: 4_000_000,
          pack_millicredits: 1_000_000,
        },
        error: undefined,
      });

      const result = await checkCredits("valid-jwt");

      expect(result).toEqual({
        ok: true,
        balanceMillicredits: 5_000_000,
        planMillicredits: 4_000_000,
        packMillicredits: 1_000_000,
      });
      expect(mockClient.GET).toHaveBeenCalledWith("/api/v1/credits/check", {
        params: {
          header: {
            Authorization: "Bearer valid-jwt",
          },
        },
      });
    });

    it("returns ok=false when account has zero credits", async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          ok: false,
          balance_millicredits: 0,
          plan_millicredits: 0,
          pack_millicredits: 0,
        },
        error: undefined,
      });

      const result = await checkCredits("valid-jwt");

      expect(result.ok).toBe(false);
      expect(result.balanceMillicredits).toBe(0);
    });

    it("throws CreditCheckError on API error", async () => {
      mockClient.GET.mockResolvedValue({
        data: undefined,
        error: { error: "Unauthorized" },
        response: { status: 401 },
      });

      await expect(checkCredits("invalid-jwt")).rejects.toThrow(CreditCheckError);
    });

    it("throws CreditCheckError on network failure", async () => {
      mockClient.GET.mockRejectedValue(new Error("Network error"));

      await expect(checkCredits("valid-jwt")).rejects.toThrow(CreditCheckError);
      await expect(checkCredits("valid-jwt")).rejects.toThrow("Credit check failed: Network error");
    });

    it("calls Rails API with correct path", async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          ok: true,
          balance_millicredits: 1000,
          plan_millicredits: 1000,
          pack_millicredits: 0,
        },
        error: undefined,
      });

      await checkCredits("test-jwt");

      expect(createRailsApiClient).toHaveBeenCalledWith({
        jwt: "test-jwt",
        baseUrl: undefined,
      });
    });

    it("passes custom baseUrl when provided", async () => {
      mockClient.GET.mockResolvedValue({
        data: {
          ok: true,
          balance_millicredits: 1000,
          plan_millicredits: 1000,
          pack_millicredits: 0,
        },
        error: undefined,
      });

      await checkCredits("test-jwt", "http://custom-url:3000");

      expect(createRailsApiClient).toHaveBeenCalledWith({
        jwt: "test-jwt",
        baseUrl: "http://custom-url:3000",
      });
    });
  });
});
