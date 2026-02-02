import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testGraph } from "@support";
import { DatabaseSnapshotter } from "@services";
import { db, websites, themes, codeFiles, eq } from "@db";
import { websiteGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import { getCodingAgentBackend } from "@nodes";
import type { WebsiteGraphState } from "@annotation";

const websiteGraph = uncompiledGraph.compile({
  ...graphParams,
  name: "website",
});

describe("Website Graph - Intent Routing", () => {
  let websiteId: number;
  let originalThemeId: number;
  let newThemeId: number;

  beforeEach(async () => {
    // Restore snapshot that has a website with a theme assigned
    await DatabaseSnapshotter.restoreSnapshot("website_step");

    // Get the website and its current theme
    const [websiteRow] = await db.select().from(websites).limit(1);
    if (!websiteRow) {
      throw new Error("No website found in snapshot");
    }

    websiteId = websiteRow.id;
    originalThemeId = websiteRow.themeId!;

    // Find a different theme to switch to
    const allThemes = await db.select().from(themes).limit(5);
    const otherTheme = allThemes.find((t) => t.id !== originalThemeId);
    if (!otherTheme) {
      throw new Error("Need at least 2 themes in database");
    }
    newThemeId = otherTheme.id;
  });

  afterEach(async () => {
    if (websiteId) {
      const backend = await getCodingAgentBackend({
        websiteId,
        jwt: "test-jwt",
      } as WebsiteGraphState);
      await backend.cleanup();
    }
  });

  describe("change_theme intent", () => {
    it("routes to themeHandler and completes without AI messages", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          intent: {
            type: "change_theme",
            payload: { themeId: newThemeId },
            createdAt: new Date().toISOString(),
          },
        })
        .execute();

      // Graph should complete successfully
      expect(result.error).toBeUndefined();
      expect(result.state.status).toBe("completed");

      // Intent should be cleared after handling
      expect(result.state.intent).toBeUndefined();

      // Should not have any AI messages - this is a silent action
      const aiMessages = result.state.messages.filter(
        (m) => m._getType?.() === "ai" || (m as any).type === "ai"
      );
      expect(aiMessages.length).toBe(0);
    });

    it("updates website theme in database via Rails API", async () => {
      await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          intent: {
            type: "change_theme",
            payload: { themeId: newThemeId },
            createdAt: new Date().toISOString(),
          },
        })
        .execute();

      // Verify theme was updated in database
      const [updatedWebsite] = await db
        .select()
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);

      expect(updatedWebsite).toBeDefined();
      expect(updatedWebsite!.themeId).toBe(newThemeId);
    });

    it("returns updated files including regenerated CSS", async () => {
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          intent: {
            type: "change_theme",
            payload: { themeId: newThemeId },
            createdAt: new Date().toISOString(),
          },
        })
        .execute();

      // Should have files in state
      expect(result.state.files).toBeDefined();
      expect(Object.keys(result.state.files).length).toBeGreaterThan(0);

      // Files should match what's in the database
      const dbFiles = await db.select().from(codeFiles).where(eq(codeFiles.websiteId, websiteId));

      expect(Object.keys(result.state.files).length).toBe(dbFiles.length);
    });
  });

  describe("no intent present", () => {
    it("routes to normal buildContext flow", async () => {
      // When no intent, should follow normal flow
      // We stop after buildContext to verify routing without running full generation
      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withPrompt("Help me improve my landing page")
        .withState({
          websiteId,
          // No intent - should route to buildContext
        })
        .stopAfter("buildContext")
        .execute();

      // Should reach buildContext (normal flow, not themeHandler)
      expect(result.error).toBeUndefined();
    });
  });
});
