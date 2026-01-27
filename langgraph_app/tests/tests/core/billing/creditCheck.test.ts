import { describe, it, expect } from "vitest";
import { canProceedWithRun, checkCredits, CreditCheckError, type CreditCheckResult } from "@core";

/**
 * Credit Check Tests
 *
 * Tests for the pure functions and error types used in credit checking.
 * The actual checkCredits API call is tested via integration tests
 * using DatabaseSnapshotter.setCredits + real Rails API.
 */
describe.sequential("creditCheck", () => {
  describe("canProceedWithRun", () => {
    it("returns true when ok is true", () => {
      const result: CreditCheckResult = {
        ok: true,
        balance_millicredits: 5_000_000,
        plan_millicredits: 4_000_000,
        pack_millicredits: 1_000_000,
      };

      expect(canProceedWithRun(result)).toBe(true);
    });

    it("returns false when ok is false", () => {
      const result: CreditCheckResult = {
        ok: false,
        balance_millicredits: 0,
        plan_millicredits: 0,
        pack_millicredits: 0,
      };

      expect(canProceedWithRun(result)).toBe(false);
    });

    it("returns false when ok is false with negative balance", () => {
      const result: CreditCheckResult = {
        ok: false,
        balance_millicredits: -500_000,
        plan_millicredits: -500_000,
        pack_millicredits: 0,
      };

      expect(canProceedWithRun(result)).toBe(false);
    });

    it("returns true when ok is true with only pack credits", () => {
      const result: CreditCheckResult = {
        ok: true,
        balance_millicredits: 1_000_000,
        plan_millicredits: 0,
        pack_millicredits: 1_000_000,
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
    it("throws CreditCheckError when JWT is missing", async () => {
      await expect(checkCredits("")).rejects.toThrow(CreditCheckError);
      await expect(checkCredits("")).rejects.toThrow("JWT token is required");
    });
  });
});
