/**
 * Unit tests for workflow prompt — anti-hallucination instruction.
 *
 * RED phase: Verifies the edit workflow includes explicit anti-hallucination
 * instructions telling the LLM that only tool calls modify files.
 */
import { describe, it, expect } from "vitest";
import { workflowPrompt } from "../../../app/prompts/coding/shared/workflow";

describe("workflowPrompt", () => {
  describe("edit workflow", () => {
    it("includes anti-hallucination instruction about tool calls", async () => {
      const prompt = await workflowPrompt(
        { isCreateFlow: false },
        undefined
      );

      // Must tell the LLM that text responses don't modify files
      expect(prompt).toContain("text responses do NOT modify files");
    });

    it("warns that only tool calls change files", async () => {
      const prompt = await workflowPrompt(
        { isCreateFlow: false },
        undefined
      );

      expect(prompt).toMatch(/only tool calls.*change files/i);
    });

    it("instructs never to claim changes without tool calls", async () => {
      const prompt = await workflowPrompt(
        { isCreateFlow: false },
        undefined
      );

      expect(prompt).toMatch(/never say.*updated.*unless.*tool/i);
    });
  });

  describe("create workflow", () => {
    it("does not include anti-hallucination instruction (create always uses tools)", async () => {
      const prompt = await workflowPrompt(
        { isCreateFlow: true },
        undefined
      );

      // Create workflow is structured differently — tool use is baked into the workflow steps
      // Anti-hallucination is specifically for edit flows where the LLM might skip tools
      expect(prompt).not.toContain("text responses do NOT modify files");
    });
  });

  describe("bugfix workflow", () => {
    it("does not include anti-hallucination instruction", async () => {
      const prompt = await workflowPrompt(
        { isCreateFlow: false, errors: "SyntaxError in Hero.tsx" },
        undefined
      );

      expect(prompt).not.toContain("text responses do NOT modify files");
    });
  });
});
