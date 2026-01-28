import { describe, it, expect } from "vitest";
import { deriveCreditStatus, type CreditStatus } from "@core";

/**
 * Credit Status Tests
 *
 * Tests for post-run credit status derivation.
 * This calculates `justExhausted` based on pre-run balance and estimated cost.
 *
 * Formula:
 *   estimatedRemaining = preRunBalance - estimatedCost
 *   justExhausted = preRunBalance > 0 && estimatedRemaining <= BUFFER_THRESHOLD (5)
 */
describe.sequential("creditStatus", () => {
  describe("deriveCreditStatus", () => {
    it("returns justExhausted=true when user goes from positive to zero", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: 1000,
        estimatedCostMillicredits: 1000,
      });

      expect(result.justExhausted).toBe(true);
      expect(result.estimatedRemainingMillicredits).toBe(0);
    });

    it("returns justExhausted=true when user goes from positive to negative", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: 500,
        estimatedCostMillicredits: 1000,
      });

      expect(result.justExhausted).toBe(true);
      expect(result.estimatedRemainingMillicredits).toBe(-500);
    });

    it("returns justExhausted=false when user still has credits", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: 5000,
        estimatedCostMillicredits: 1000,
      });

      expect(result.justExhausted).toBe(false);
      expect(result.estimatedRemainingMillicredits).toBe(4000);
    });

    it("returns justExhausted=false when user was already at zero", () => {
      // If they were already at 0, this isn't a "just exhausted" event
      const result = deriveCreditStatus({
        preRunMillicredits: 0,
        estimatedCostMillicredits: 1000,
      });

      expect(result.justExhausted).toBe(false);
      expect(result.estimatedRemainingMillicredits).toBe(-1000);
    });

    it("returns justExhausted=false when user was already negative (debt)", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: -500,
        estimatedCostMillicredits: 1000,
      });

      expect(result.justExhausted).toBe(false);
      expect(result.estimatedRemainingMillicredits).toBe(-1500);
    });

    it("returns justExhausted=false when cost is zero", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: 5000,
        estimatedCostMillicredits: 0,
      });

      expect(result.justExhausted).toBe(false);
      expect(result.estimatedRemainingMillicredits).toBe(5000);
    });

    it("includes preRunMillicredits in result for debugging", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: 5000,
        estimatedCostMillicredits: 1000,
      });

      expect(result.preRunMillicredits).toBe(5000);
    });

    it("includes estimatedCostMillicredits in result for debugging", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: 5000,
        estimatedCostMillicredits: 1000,
      });

      expect(result.estimatedCostMillicredits).toBe(1000);
    });
  });

  describe("edge cases with buffer threshold", () => {
    // Buffer threshold is 5 millicredits - treat estimatedRemaining <= 5 as exhausted

    it("returns justExhausted=true at buffer threshold (estimatedRemaining <= 5)", () => {
      // With buffer threshold, remaining of 5 or less triggers exhaustion warning
      const result = deriveCreditStatus({
        preRunMillicredits: 1000,
        estimatedCostMillicredits: 996, // leaves 4 millicredits
      });

      // With 5 millicredit buffer, remaining of 4 triggers justExhausted
      expect(result.justExhausted).toBe(true);
      expect(result.estimatedRemainingMillicredits).toBe(4);
    });

    it("returns justExhausted=true at exactly buffer threshold", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: 1000,
        estimatedCostMillicredits: 995, // leaves 5 millicredits
      });

      expect(result.justExhausted).toBe(true);
      expect(result.estimatedRemainingMillicredits).toBe(5);
    });

    it("returns justExhausted=false when above buffer threshold", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: 1000,
        estimatedCostMillicredits: 990, // leaves 10 millicredits
      });

      expect(result.justExhausted).toBe(false);
      expect(result.estimatedRemainingMillicredits).toBe(10);
    });
  });

  describe("CreditStatus type", () => {
    it("has all required fields", () => {
      const result = deriveCreditStatus({
        preRunMillicredits: 5000,
        estimatedCostMillicredits: 1000,
      });

      // Type check - all fields should be present
      expect(result).toHaveProperty("justExhausted");
      expect(result).toHaveProperty("estimatedRemainingMillicredits");
      expect(result).toHaveProperty("preRunMillicredits");
      expect(result).toHaveProperty("estimatedCostMillicredits");
    });
  });
});
