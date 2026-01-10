/**
 * Tests for coding agent tracking prompt integration.
 *
 * Verifies that the coding agent system prompt includes proper
 * conversion tracking instructions for both tiered and simple scenarios.
 */
import { describe, it, expect } from "vitest";
import { buildCodingPrompt } from "@prompts";
import { trackingContextPrompt } from "../../../app/prompts/coding/shared/trackingContext";

describe("Coding Agent Tracking Prompts", () => {
  describe("buildCodingPrompt()", () => {
    it("includes tracking context in system prompt", () => {
      const prompt = buildCodingPrompt();

      // Should include the tracking section
      expect(prompt).toContain("Conversion Tracking");
      expect(prompt).toContain("L10.conversion");
    });

    it("documents tiered pricing pattern with value parameter", () => {
      const prompt = buildCodingPrompt();

      // Should explain tiered pricing pattern
      expect(prompt).toContain("Tiered Pricing");
      expect(prompt).toContain("tierPrice");
      expect(prompt).toMatch(/L10\.conversion.*value.*tierPrice/s);
    });

    it("documents simple waitlist pattern with zero value", () => {
      const prompt = buildCodingPrompt();

      // Should explain simple form pattern
      expect(prompt).toContain("Simple Waitlist");
      expect(prompt).toMatch(/value:\s*0/);
    });
  });

  describe("trackingContextPrompt()", () => {
    it("includes both conversion scenarios", () => {
      const trackingPrompt = trackingContextPrompt();

      // Both scenarios documented
      expect(trackingPrompt).toContain("Scenario 1");
      expect(trackingPrompt).toContain("Scenario 2");
    });

    it("specifies correct label types", () => {
      const trackingPrompt = trackingContextPrompt();

      // Should mention signup label
      expect(trackingPrompt).toContain("signup");
    });

    it("explains when to use each pattern", () => {
      const trackingPrompt = trackingContextPrompt();

      // Should explain when to use tiered vs simple
      expect(trackingPrompt).toMatch(/pricing tier|Basic.*Pro.*Enterprise/i);
      expect(trackingPrompt).toMatch(/basic signup|without pricing/i);
    });
  });
});
