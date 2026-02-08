/**
 * Tests for typography prompt generation.
 * Ensures AI agent receives proper typography guidance.
 */
import { describe, it, expect } from "vitest";
import {
  typographyPrompt,
  formatTypographyPrompt,
  type TypographyRecommendations,
  type CodingPromptState,
} from "@prompts";

describe("Typography Prompt", () => {
  // Sample recommendations matching the API structure
  const sampleRecommendations: TypographyRecommendations = {
    E9C46A: {
      headlines: [
        { color: "264653", contrast: 12.5, level: "AAA", style: "bold" },
        { color: "0A0A0A", contrast: 15.2, level: "AAA", style: "clear" },
      ],
      subheadlines: [{ color: "2A9D8F", contrast: 4.8, level: "AA", style: "palette" }],
      body: [
        { color: "0A0A0A", contrast: 15.2, level: "AAA", style: "clear" },
        { color: "264653", contrast: 12.5, level: "AAA", style: "palette" },
      ],
      accents: [
        {
          color: "E76F51",
          contrast: 3.2,
          level: "AA-large",
          style: "accent",
          note: "large text only",
        },
      ],
    },
    FAFAFA: {
      headlines: [{ color: "264653", contrast: 14.1, level: "AAA", style: "bold" }],
      subheadlines: [],
      body: [{ color: "0A0A0A", contrast: 18.9, level: "AAA", style: "clear" }],
      accents: [],
    },
  };

  const palette = ["264653", "2A9D8F", "E9C46A", "F4A261", "E76F51"];

  describe("formatTypographyPrompt()", () => {
    it("returns empty string for undefined recommendations", () => {
      expect(formatTypographyPrompt(undefined)).toBe("");
    });

    it("returns empty string for empty recommendations", () => {
      expect(formatTypographyPrompt({})).toBe("");
    });

    it("includes Typography Guide header", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations, palette);
      expect(prompt).toContain("## Typography Guide");
    });

    it("includes palette colors when provided", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations, palette);
      expect(prompt).toContain("Palette:");
      expect(prompt).toContain("#264653");
      expect(prompt).toContain("#E9C46A");
    });

    it("formats background color sections", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations, palette);
      expect(prompt).toContain("On #E9C46A background:");
      expect(prompt).toContain("On #FAFAFA background:");
    });

    it("includes headline recommendations with contrast ratios", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations, palette);
      expect(prompt).toContain("Headlines (bold, attention-grabbing):");
      expect(prompt).toContain("#264653 (12.5:1 AAA)");
    });

    it("distinguishes palette colors from standard colors", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations, palette);
      expect(prompt).toContain("[palette color]");
      expect(prompt).toContain("[standard]");
    });

    it("includes subheadline recommendations", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations, palette);
      expect(prompt).toContain("Subheadlines (visual variety):");
      expect(prompt).toContain("#2A9D8F (4.8:1 AA)");
    });

    it("includes body text recommendations (limited to 2)", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations, palette);
      expect(prompt).toContain("Body text (readable, clear):");
      // Should include first two body recommendations
      expect(prompt).toContain("#0A0A0A (15.2:1 AAA)");
    });

    it("includes WCAG compliance levels", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations, palette);
      expect(prompt).toMatch(/AAA|AA|AA-large/);
    });

    it("works without palette colors", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations);
      expect(prompt).toContain("## Typography Guide");
      expect(prompt).not.toContain("Palette:");
    });
  });

  describe("typographyPrompt()", () => {
    it("returns empty string when no theme", async () => {
      const state: CodingPromptState = { jwt: "test", isCreateFlow: true };
      const result = await typographyPrompt(state);
      expect(result).toBe("");
    });

    it("returns empty string when no jwt", async () => {
      const state: CodingPromptState = { theme: { id: 1 }, isCreateFlow: true };
      const result = await typographyPrompt(state);
      expect(result).toBe("");
    });

    it("uses typography_recommendations from state when available", async () => {
      const state: CodingPromptState = {
        jwt: "test",
        isCreateFlow: true,
        theme: {
          id: 1,
          colors: palette,
          typography_recommendations: sampleRecommendations,
        },
      };
      const result = await typographyPrompt(state);
      expect(result).toContain("## Typography Guide");
      expect(result).toContain("On #E9C46A background:");
    });
  });

  describe("integration with theme data", () => {
    it("produces usable guidance for AI agent", () => {
      const prompt = formatTypographyPrompt(sampleRecommendations, palette);

      // Should be non-empty and contain actionable guidance
      expect(prompt.length).toBeGreaterThan(100);

      // Should have clear structure
      expect(prompt).toMatch(/On #[A-F0-9]{6} background:/);
      expect(prompt).toMatch(/#[A-F0-9]{6} \(\d+\.?\d*:1 (AAA|AA|AA-large)\)/);
    });
  });
});
