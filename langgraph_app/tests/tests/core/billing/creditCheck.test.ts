import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { canProceedWithRun, CreditCheckError, type CreditCheckResult } from "@core";

/**
 * Credit Check Tests
 *
 * Tests for the pre-run balance check functionality.
 * This fetches the account's credit balance from Rails before graph execution.
 *
 * API: GET /api/v1/credits/check?account_id=X
 * Response: { ok: boolean, balance_millicredits: number, plan_millicredits: number, pack_millicredits: number }
 *
 * Note: checkCredits() integration tests are skipped here because they require
 * mocking the Rails API client. The actual integration is tested via the
 * Rails request specs in spec/requests/api/v1/credits_spec.rb
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
});
