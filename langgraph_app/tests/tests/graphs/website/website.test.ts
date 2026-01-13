import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testGraph } from "@support";
import { DatabaseSnapshotter } from "@services";
import { getCodingAgentBackend } from "@nodes";
import { db, Types as DBTypes, websites, brainstorms, websiteFiles, themes, websiteUploads, eq } from "@db";
import { Website } from "@types";
import { websiteGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import type { WebsiteGraphState } from "@annotation";
import { saveExample } from "@support";

const websiteGraph = uncompiledGraph.compile({
  ...graphParams,
  name: "website",
});

describe.sequential("Website Builder", () => {
  let websiteId: number;
  let website: DBTypes.WebsiteType;
  let themeColors: string[];

  beforeEach(async () => {
    // website_step snapshot includes:
    // - brainstorm with idea, audience, solution, social_proof
    // - theme assigned to website (with typography recommendations)
    // - uploads: 1 logo + 3 images associated with website
    await DatabaseSnapshotter.restoreSnapshot("website_step");

    const [websiteRow] = await db.select().from(websites).limit(1);

    if (!websiteRow || !websiteRow.name) {
      throw new Error("No website found in snapshot");
    }

    websiteId = websiteRow.id;
    website = websiteRow;

    // Get theme colors for assertions
    if (websiteRow.themeId) {
      const [theme] = await db
        .select()
        .from(themes)
        .where(eq(themes.id, websiteRow.themeId))
        .limit(1);

      if (theme?.colors && Array.isArray(theme.colors)) {
        themeColors = theme.colors as string[];
      }
    }

    // Verify brainstorm exists
    const [brainstorm] = await db
      .select()
      .from(brainstorms)
      .where(eq(brainstorms.websiteId, websiteId))
      .limit(1);

    if (!brainstorm) {
      throw new Error("No brainstorm found for website");
    }

    // Verify uploads exist
    const uploadCount = await db
      .select()
      .from(websiteUploads)
      .where(eq(websiteUploads.websiteId, websiteId));

    if (uploadCount.length === 0) {
      throw new Error("No uploads found for website");
    }
  }, 60000);

  afterEach(async () => {
    if (websiteId) {
      const backend = await getCodingAgentBackend({
        websiteId,
        jwt: "test-jwt",
      } as WebsiteGraphState);
      await backend.cleanup();
    }
  });

  describe("Page Generation", () => {
    it("generates a complete landing page with required sections", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          command: "create",
          websiteId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
        })
        .execute();

      expect(result.error).toBeUndefined();
      expect(result.state.status).toBe("completed");

      // Get generated files
      const generatedFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      const filePaths = generatedFiles.map((f) => f.path);

      // Required sections exist
      expect(filePaths.some((p) => p?.includes("Hero"))).toBe(true);
      expect(filePaths.some((p) => p?.includes("Feature"))).toBe(true);

      // Files contain valid React components
      const heroFile = generatedFiles.find((f) => f.path?.includes("Hero"));
      expect(heroFile?.content).toBeDefined();
      expect(heroFile?.content).toContain("export");
      expect(heroFile?.content).toMatch(/function|const/);

      const stateHeroFile = result.state.files[heroFile?.path!] as Website.File.File;
      expect(stateHeroFile?.content).toEqual(heroFile?.content)

      // At least one file contains tracking
      const trackingFile = generatedFiles.find((f) => f.content.match(/L10.createLead/));
      expect(trackingFile).toBeDefined();

      // Expect IndexPage has been edited
      const indexPage = generatedFiles.find((f) => f.path?.includes("IndexPage"));
      expect(indexPage?.content).toBeDefined();
      expect(indexPage?.content).toContain("Hero");
      expect(indexPage?.content).toContain("Feature"); // It includes the sections

      await saveExample(websiteId, "scheduling-tool"); // So we can see the result
    }, 300000);
  });
});
