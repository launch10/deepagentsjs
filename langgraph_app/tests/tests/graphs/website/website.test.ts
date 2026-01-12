import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testGraph } from "@support";
import { DatabaseSnapshotter } from "@services";
import { getCodingAgentBackend } from "@nodes";
import { db, Types as DBTypes, websites, brainstorms, websiteFiles, themes, websiteUploads, eq } from "@db";
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

  describe("Context Assembly", () => {
    it("pulls in theme, images, and brainstorm context", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
        })
        .withPrompt("Create a landing page for this business")
        .stopAfter("buildContext")
        .execute();

      // Theme colors are hex values
      const hexadecimalRegex = /^[A-Fa-f0-9]{6}$/;
      expect(result.state.theme?.colors).toBeDefined();
      result.state.theme?.colors.forEach((color: string) => {
        expect(color).toMatch(hexadecimalRegex);
      });

      // Brainstorm context is populated
      expect(result.state.brainstorm.idea).toBeDefined();
      expect(result.state.brainstorm.idea).toContain("scheduling");
      expect(result.state.brainstorm.audience).toBeDefined();
      expect(result.state.brainstorm.solution).toBeDefined();
      expect(result.state.brainstorm.socialProof).toBeDefined();

      // Images are available
      expect(result.state.images).toBeDefined();
      expect(result.state.images.length).toBeGreaterThan(0);

      // At least one logo
      const logos = result.state.images.filter((img: { isLogo: boolean }) => img.isLogo);
      expect(logos.length).toBeGreaterThan(0);
    });
  });

  describe("Page Generation", () => {
    it.only("generates a complete landing page with required sections", async () => {
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

      // At least one file contains tracking
      const trackingFile = generatedFiles.find((f) => f.content.match(/L10.createLead/));
      expect(trackingFile).toBeDefined();

      await saveExample(websiteId, "scheduling-tool"); // So we can see the result
    }, 300000);

    it("uses theme colors in generated components", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
        })
        .withPrompt("Create a landing page for this business")
        .execute();

      expect(result.error).toBeUndefined();

      // Get all generated files
      const generatedFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      // Combine all file contents
      const allContent = generatedFiles
        .map((f) => f.content || "")
        .join("\n")
        .toLowerCase();

      // At least one theme color should appear in the generated code
      // Colors may appear as hex (#RRGGBB) or in CSS variables
      const colorPatterns = themeColors.map((c) => c.toLowerCase());
      const hasThemeColor = colorPatterns.some(
        (color) =>
          allContent.includes(color) ||
          allContent.includes(`#${color}`) ||
          // Also check for CSS variable usage patterns
          allContent.includes("--primary") ||
          allContent.includes("--secondary") ||
          allContent.includes("--background")
      );

      expect(hasThemeColor).toBe(true);
    }, 300000);

    it("includes lead capture functionality", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
        })
        .withPrompt("Create a landing page for this business with a signup form")
        .execute();

      expect(result.error).toBeUndefined();

      // Get all generated files
      const generatedFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      // Combine all file contents
      const allContent = generatedFiles.map((f) => f.content || "").join("\n");

      // Should have lead capture integration
      // L10.createLead is the API for lead capture
      const hasLeadCapture =
        allContent.includes("L10.createLead") ||
        allContent.includes("createLead") ||
        // Form with email input is also acceptable
        (allContent.includes("email") && allContent.includes("form"));

      expect(hasLeadCapture).toBe(true);
    }, 300000);

    it("generates working navigation links", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
        })
        .withPrompt("Create a landing page with navigation")
        .execute();

      expect(result.error).toBeUndefined();

      // Get all generated files
      const generatedFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      const allContent = generatedFiles.map((f) => f.content || "").join("\n");

      // Should have anchor links (href="#section") or React Router links
      const hasNavigation =
        allContent.includes('href="#') ||
        allContent.includes("Link to=") ||
        allContent.includes('to="/#') ||
        allContent.includes("scrollIntoView");

      expect(hasNavigation).toBe(true);
    }, 300000);
  });
});
