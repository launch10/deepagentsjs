import { describe, it, expect } from "vitest";
import { buildExtraContext } from "@nodes";
import { buildCodingPrompt, workflowPrompt, startByPrompt } from "@prompts";
import type { WebsiteGraphState } from "@annotation";

/**
 * Minimal state factory for testing buildExtraContext.
 * Only the fields that buildExtraContext actually reads.
 */
function makeState(
  overrides: Partial<Pick<WebsiteGraphState, "consoleErrors">> = {}
): WebsiteGraphState {
  return {
    messages: [],
    consoleErrors: [],
    ...overrides,
  } as unknown as WebsiteGraphState;
}

describe("Bugfix workflow", () => {
  describe("buildExtraContext — code frame inclusion", () => {
    it("includes code frame when consoleErrors have a frame field", () => {
      const state = makeState({
        consoleErrors: [
          {
            type: "error",
            message: 'Unexpected token, expected "," (20:68)',
            file: "src/components/HowItWorks.tsx",
            frame: [
              "  18 |        number: '03',",
              "  19 |        title: 'Book & Record',",
              "  20 |        description: 'Review your matches, pick your favorite, and we'll make the intro.',",
              "     |                                                                      ^",
            ].join("\n"),
            timestamp: new Date(),
          },
        ],
      });

      const context = buildExtraContext(state, false);
      expect(context).toHaveLength(1);

      const content = (context[0] as any).content;
      expect(content).toContain("[Build Errors — fix these]");
      expect(content).toContain("Unexpected token");
      expect(content).toContain("(src/components/HowItWorks.tsx)");
      expect(content).toContain("Code frame:");
      expect(content).toContain("we'll make the intro");
      expect(content).toContain("^");
    });

    it("omits code frame section when frame is absent", () => {
      const state = makeState({
        consoleErrors: [
          {
            type: "error",
            message: "Failed to resolve import",
            file: "src/components/Hero.tsx",
            timestamp: new Date(),
          },
        ],
      });

      const context = buildExtraContext(state, false);
      expect(context).toHaveLength(1);

      const content = (context[0] as any).content;
      expect(content).toContain("Failed to resolve import");
      expect(content).toContain("(src/components/Hero.tsx)");
      expect(content).not.toContain("Code frame:");
    });

    it("filters out warnings — only errors produce context", () => {
      const state = makeState({
        consoleErrors: [
          {
            type: "warning",
            message: "Some deprecation warning",
            timestamp: new Date(),
          },
        ],
      });

      const context = buildExtraContext(state, false);
      expect(context).toHaveLength(0);
    });

    it("includes create context when isCreate is true", () => {
      const state = makeState();
      const context = buildExtraContext(state, true);
      expect(context).toHaveLength(1);

      const content = (context[0] as any).content;
      expect(content).toContain("Create a landing page");
    });

    it("includes both create and error context together", () => {
      const state = makeState({
        consoleErrors: [
          {
            type: "error",
            message: "SyntaxError: unexpected",
            file: "src/components/Foo.tsx",
            frame: "  5 | broken code\n    | ^",
            timestamp: new Date(),
          },
        ],
      });

      const context = buildExtraContext(state, true);
      expect(context).toHaveLength(2);

      const contents = context.map((c: any) => c.content);
      expect(contents.some((c: string) => c.includes("Create a landing page"))).toBe(true);
      expect(contents.some((c: string) => c.includes("Build Errors"))).toBe(true);
    });
  });

  describe("workflowPrompt — selects BugFix when errors present", () => {
    it("returns bugfix workflow when errors field is set", async () => {
      const prompt = await workflowPrompt({
        isCreateFlow: false,
        errors: "Unexpected token (20:68)",
      });

      // Bugfix workflow has distinctive markers
      expect(prompt).toContain("Analyze");
      expect(prompt).toContain("EXACT file path, line number, and column number");
      expect(prompt).toContain("Diagnose");
      expect(prompt).toContain("exact line number from the error");
      // No-delegation instruction (preserves prompt cache by keeping tools stable)
      expect(prompt).toContain("do NOT delegate to subagents");
    });

    it("returns create workflow when no errors and isCreateFlow", async () => {
      const prompt = await workflowPrompt({ isCreateFlow: true });

      expect(prompt).toContain("Greet");
      expect(prompt).toContain("Build Everything Yourself, Sequentially");
      expect(prompt).not.toContain("Diagnose");
    });

    it("returns edit workflow when no errors and not create", async () => {
      const prompt = await workflowPrompt({ isCreateFlow: false });

      expect(prompt).toContain("ALWAYS make the change immediately");
      expect(prompt).not.toContain("Diagnose");
    });

    it("bugfix takes priority over create flow", async () => {
      const prompt = await workflowPrompt({ isCreateFlow: true, errors: "Some error" });

      // Should be bugfix, not create
      expect(prompt).toContain("Diagnose");
      expect(prompt).not.toContain("Greet");
    });
  });

  describe("startByPrompt — matches workflow selection", () => {
    it("returns error-reading instruction when errors present", async () => {
      const prompt = await startByPrompt({ isCreateFlow: false, errors: "Build failed" });

      expect(prompt).toContain("reading the error messages");
    });

    it("returns greeting instruction for create flow", async () => {
      const prompt = await startByPrompt({ isCreateFlow: true });

      expect(prompt).toContain("greeting the user");
    });

    it("returns immediate-edit instruction for edit flow", async () => {
      const prompt = await startByPrompt({ isCreateFlow: false });

      expect(prompt).toContain("IMMEDIATELY make the requested changes");
    });
  });

  describe("buildCodingPrompt — full system prompt composition", () => {
    it("includes bugfix workflow and no-delegation instruction when errors present", async () => {
      const prompt = await buildCodingPrompt({
        isCreateFlow: false,
        errors: 'Unexpected token, expected "," (20:68)',
      });

      // Bugfix workflow is in the EXECUTION MODE section
      expect(prompt).toContain("## EXECUTION MODE");

      // Our updated bugfix steps are present
      expect(prompt).toContain("EXACT file path, line number, and column number");
      expect(prompt).toContain("exact line number from the error");
      expect(prompt).toContain("Diagnose");

      // No-delegation instruction (keeps tools stable for prompt caching)
      expect(prompt).toContain("do NOT delegate to subagents");

      // Should NOT contain edit or create workflow markers
      expect(prompt).not.toContain("ALWAYS make the change immediately");
      expect(prompt).not.toContain("Greet");

      // StartBy should reference error reading
      expect(prompt).toContain("reading the error messages");

      // Double-quote guideline is present (prevents apostrophe bugs)
      expect(prompt).toContain("double quotes for user-facing text");
    });

    it("includes edit workflow when no errors and not create", async () => {
      const prompt = await buildCodingPrompt({
        isCreateFlow: false,
      });

      expect(prompt).toContain("ALWAYS make the change immediately");
      expect(prompt).not.toContain("Diagnose");
      expect(prompt).not.toContain("do NOT delegate to subagents");
    });
  });
});
