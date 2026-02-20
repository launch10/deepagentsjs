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
    isCreateFlow: true,
  };

  describe("buildCodingPrompt()", () => {
    it("includes tracking context in system prompt", async () => {
      const prompt = await buildCodingPrompt(mockState);

      // Should include the tracking section
      expect(prompt).toContain("Lead Capture");
      expect(prompt).toContain("LeadForm");
    });

    it("documents tiered pricing pattern with value parameter", async () => {
      const prompt = await buildCodingPrompt(mockState);

      // Should explain tiered pricing pattern
      expect(prompt).toContain("Tiered Pricing");
      expect(prompt).toContain("value={49}");
    });

    it("documents email-only pattern", async () => {
      const prompt = await buildCodingPrompt(mockState);

      // Should explain email-only form pattern
      expect(prompt).toContain("Email-Only");
      expect(prompt).toContain("LeadForm.Email");
    });
  });

  describe("trackingPrompt()", () => {
    it("includes all three scenarios", async () => {
      const tracking = await trackingPrompt(mockState);

      // All three scenarios documented
      expect(tracking).toContain("Scenario 1");
      expect(tracking).toContain("Scenario 2");
      expect(tracking).toContain("Scenario 3");
    });

    it("uses LeadForm for lead capture", async () => {
      const tracking = await trackingPrompt(mockState);

      // Should use LeadForm component
      expect(tracking).toContain("LeadForm");
    });

    it("explains when to use each pattern", async () => {
      const tracking = await trackingPrompt(mockState);

      // Should explain when to use tiered vs simple
      expect(tracking).toMatch(/pricing tier/i);
      expect(tracking).toMatch(/Hero|CTA|waitlist/i);
    });
  });
});
