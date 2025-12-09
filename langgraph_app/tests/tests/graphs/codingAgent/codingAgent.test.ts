import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testGraph } from "@support";
import { DatabaseSnapshotter, WebsiteFilesBackend } from "@services";
import { db, websites, brainstorms, websiteFiles, eq } from "@db";
import { codingAgentGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import type { CodingAgentGraphState } from "@annotation";
import type { Website } from "@types";

const codingAgentGraph = uncompiledGraph.compile({
  ...graphParams,
  name: "codingAgent",
});

describe.sequential("CodingAgent Flow", () => {
  let websiteId: number;
  let website: Website.WebsiteType;
  let backend: WebsiteFilesBackend | null = null;

  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_created");

    const [websiteRow] = await db.select().from(websites).limit(1);

    if (!websiteRow || !websiteRow.name) {
      throw new Error("No website found in snapshot");
    }

    websiteId = websiteRow.id;
    website = websiteRow as Website.WebsiteType;

    const [brainstorm] = await db
      .select()
      .from(brainstorms)
      .where(eq(brainstorms.websiteId, websiteId))
      .limit(1);

    if (!brainstorm) {
      console.warn(
        "No brainstorm found for website - test may have limited context"
      );
    }
  }, 60000);

  afterEach(async () => {
    if (backend) {
      await backend.cleanup();
      backend = null;
    }
  });

  describe("Context engineering", () => {
    it.only("pulls in theme, images, and brainstorm", async () => {
      const result = await testGraph<CodingAgentGraphState>()
        .withGraph(codingAgentGraph)
        .withState({
          websiteId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
        })
        .withPrompt("Create a landing page for this business")
        .stopAfter("buildContext")
        .execute();

      const hexadecimalRegex = /[A-F|\d]{6,}/;
      result.state.theme?.colors.forEach((color) => {
        expect(color).toMatch(hexadecimalRegex);
      });

      // TODO: Define uploaded images, logos, etc.
      expect(result.state.brainstorm.idea).toBeDefined();
      expect(result.state.brainstorm.audience).toBeDefined();
      expect(result.state.brainstorm.solution).toBeDefined();
      expect(result.state.brainstorm.socialProof).toBeDefined();
    });

  })

  describe("Hello World - Generate Landing Page", () => {
    it("generates a complete landing page from brainstorm context", async () => {
      // Ensure it isn't EXACTLY the generated snapshot??? Where did that come from?
      // We should cleanup after the test...  it didn't? 

      const result = await testGraph<CodingAgentGraphState>()
        .withGraph(codingAgentGraph)
        .withState({
          websiteId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
        })
        .withPrompt("Create a landing page for this business")
        .execute();

      debugger; // Allow us to pause to look at this... 
      expect(result.error).toBeUndefined();
      expect(result.state.status).toBe("completed");

      const generatedFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      const filePaths = generatedFiles.map((f) => f.path);

      expect(filePaths.some((p) => p?.includes("Hero"))).toBe(true);
      expect(filePaths.some((p) => p?.includes("Feature"))).toBe(true);

      const heroFile = generatedFiles.find((f) => f.path?.includes("Hero"));
      if (heroFile?.content) {
        expect(heroFile.content).toContain("export");
        expect(heroFile.content).toMatch(/function|const/);
      }
    }, 300000);
  });
});
