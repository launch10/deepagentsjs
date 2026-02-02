/**
 * Tests for coding agent tracking prompt integration.
 *
 * Verifies that the coding agent system prompt includes proper
 * lead capture and conversion tracking instructions.
 */
import { describe, it, expect } from "vitest";
import { buildCodingPrompt, trackingPrompt, type CodingPromptState } from "@prompts";

describe("Coding Agent Tracking Prompts", () => {
  const mockState: CodingPromptState = {
    websiteId: 1,
    jwt: "test-jwt",
    isFirstMessage: true,
  };

  describe("buildCodingPrompt()", () => {
    it("includes tracking context in system prompt", async () => {
      const prompt = await buildCodingPrompt(mockState);

      // Should include the tracking section
      expect(prompt).toContain("Lead Capture");
      expect(prompt).toContain("L10.createLead");
    });

    it("documents tiered pricing pattern with value parameter", async () => {
      const prompt = await buildCodingPrompt(mockState);

      // Should explain tiered pricing pattern
      expect(prompt).toContain("Tiered Pricing");
      expect(prompt).toContain("tierPrice");
      expect(prompt).toMatch(/L10\.createLead.*value.*tierPrice/s);
    });

    it("documents simple waitlist pattern", async () => {
      const prompt = await buildCodingPrompt(mockState);

      // Should explain simple form pattern
      expect(prompt).toContain("Simple Waitlist");
      expect(prompt).toContain("L10.createLead(email)");
    });
  });

  describe("trackingPrompt()", () => {
    it("includes both conversion scenarios", async () => {
      const tracking = await trackingPrompt(mockState);

      // Both scenarios documented
      expect(tracking).toContain("Scenario 1");
      expect(tracking).toContain("Scenario 2");
    });

    it("uses L10.createLead for lead capture", async () => {
      const tracking = await trackingPrompt(mockState);

      // Should use createLead method
      expect(tracking).toContain("L10.createLead");
    });

    it("explains when to use each pattern", async () => {
      const tracking = await trackingPrompt(mockState);

      // Should explain when to use tiered vs simple
      expect(tracking).toMatch(/pricing tier|Basic.*Pro.*Enterprise/i);
      expect(tracking).toMatch(/basic signup|without pricing/i);
    });
  });
});
