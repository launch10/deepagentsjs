import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { testGraph, appScenario, consumeStream } from "@support";
import { DatabaseSnapshotter } from "@services";
import { WebsiteAPI } from "@api";
import { getCodingAgentBackend } from "@nodes";
import {
  db,
  Types as DBTypes,
  websites,
  chats,
  brainstorms,
  websiteFiles,
  themes,
  websiteUploads,
  eq,
  and,
} from "@db";
import { Website, isAIMessage, type ThreadIDType } from "@types";
import { websiteGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import type { WebsiteGraphState } from "@annotation";
import { saveExample } from "@support";

const websiteGraph = uncompiledGraph.compile({
  ...graphParams,
  name: "website",
});

const assertMessageContent = async (result: { state: WebsiteGraphState }, websiteId: number) => {
  // Find the first AI message (the agent's reply)
  const firstAIMessage = result.state.messages.find(isAIMessage);
  expect(firstAIMessage).toBeDefined();

  // The AI should reply with text content (not just tool calls)
  let textContent: string | undefined;
  if (typeof firstAIMessage?.content === "string") {
    textContent = firstAIMessage.content;
  } else if (Array.isArray(firstAIMessage?.content)) {
    const textBlock = firstAIMessage.content.find((c: any) => c.type === "text");
    textContent = textBlock?.text as string | undefined;
  }

  expect(textContent).toBeDefined();
  expect(textContent!.length).toBeGreaterThan(20); // Should be a real message, not empty

  // The reply should reference something from the brainstorm context
  // (idea, audience, or solution) to show it's personalized
  const brainstormResults = await db
    .select()
    .from(brainstorms)
    .where(eq(brainstorms.websiteId, websiteId))
    .limit(1);
  const brainstorm = brainstormResults[0];
  expect(brainstorm).toBeDefined();

  const replyLower = textContent!.toLowerCase();
  const ideaWords = brainstorm!.idea?.toLowerCase().split(/\s+/) || [];
  const audienceWords = brainstorm!.audience?.toLowerCase().split(/\s+/) || [];

  // Check if reply contains any significant words from brainstorm
  // (filtering out common words)
  const significantWords = [...ideaWords, ...audienceWords]
    .filter((w) => w.length > 4) // Skip short/common words
    .slice(0, 10); // Check first 10 significant words

  const containsBrainstormContext = significantWords.some((word) => replyLower.includes(word));

  console.log(`brainstorm`);
  console.log(`brainstorm`);
  console.log(`brainstorm`);
  console.log(`brainstorm`);
  console.log(`brainstorm`);
  console.log(`brainstorm`);
  console.log(`brainstorm`);
  console.log(`brainstorm`);
  console.log(textContent);
  expect(containsBrainstormContext).toBe(true);
};

// describe.sequential
// temporarily skipping because caching is failing on CI - use this mainly for local testing and debugging speed
describe("Website Builder", () => {
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
    it.skip("generates a complete landing page with required sections", async () => {
      // Load the chat's threadId from the snapshot so the graph state matches the DB
      const [existingChat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.contextableId, websiteId), eq(chats.contextableType, "Website")))
        .limit(1);

      if (!existingChat?.threadId) {
        throw new Error("No chat with threadId found in snapshot for website");
      }

      const result = await testGraph<WebsiteGraphState>()
        .withGraph(websiteGraph)
        .withState({
          websiteId,
          threadId: existingChat.threadId as ThreadIDType,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
        })
        .execute();

      expect(result.error).toBeNull();
      expect(result.state.status).toBe("completed");

      // Get generated files
      const generatedFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      const filePaths = generatedFiles.map((f) => f.path);

      // Should generate multiple component files in src/components
      const componentFiles = generatedFiles.filter((f) => f.path?.includes("src/components"));
      expect(componentFiles.length).toBeGreaterThanOrEqual(2);

      // Component files should contain valid React components
      const firstComponent = componentFiles[0];
      expect(firstComponent?.content).toBeDefined();
      expect(firstComponent?.content).toContain("export");
      expect(firstComponent?.content).toMatch(/function|const/);

      // State should be synced with database
      const stateFile = result.state.files[firstComponent?.path!] as Website.File.File;
      expect(stateFile?.content).toEqual(firstComponent?.content);

      // At least one file contains tracking
      const trackingFile = generatedFiles.find((f) => f.content.match(/L10.createLead/));
      expect(trackingFile).toBeDefined();

      // Expect IndexPage has been edited
      const indexPage = generatedFiles.find((f) => f.path?.includes("IndexPage"));
      expect(indexPage?.content).toBeDefined();

      const chatsResult = await db
        .select()
        .from(chats)
        .where(and(eq(chats.contextableId, websiteId), eq(chats.contextableType, "Website")))
        .limit(1);
      const chat = chatsResult.at(0);
      expect(chat).toBeDefined();
      expect(chat?.threadId).toEqual(result.state.threadId);

      await assertMessageContent(result, websiteId);

      await saveExample(websiteId, "scheduling-tool"); // So we can see the result

      // Create a snapshot after successful generation for other tests to use
      // This ensures the snapshot is always schema-current with real generated data
      // This is now handled in website_generated snapshot, and gets updated whenever we call saveExample above and rebuild
      // await DatabaseSnapshotter.createSnapshot("website_generated");
    }, 500000);
  });

  describe("Quick Actions", () => {
    describe("Change theme", () => {
      let websiteId: number;
      let threadId: ThreadIDType;
      let originalThemeId: number;
      let newThemeId: number;

      beforeEach(async () => {
        // Restore snapshot created by website.test.ts after successful page generation
        // This ensures we have a fully-generated website with files, theme, and chat context
        await DatabaseSnapshotter.restoreSnapshot("website_generated");

        // Get the website and its current theme
        const [websiteRow] = await db.select().from(websites).limit(1);
        if (!websiteRow) {
          throw new Error("No website found in snapshot");
        }

        websiteId = websiteRow.id;
        originalThemeId = websiteRow.themeId!;

        // Load the chat's threadId so graphTester can merge persisted checkpoint state
        const [chat] = await db
          .select()
          .from(chats)
          .where(and(eq(chats.contextableId, websiteId), eq(chats.contextableType, "Website")))
          .limit(1);

        if (!chat?.threadId) {
          throw new Error("No chat with threadId found for website");
        }
        threadId = chat.threadId as ThreadIDType;

        // Find a different theme to switch to
        const allThemes = await db.select().from(themes).limit(5);
        const otherTheme = allThemes.find((t) => t.id !== originalThemeId);
        if (!otherTheme) {
          throw new Error("Need at least 2 themes in database");
        }
        newThemeId = otherTheme.id;
      });

      describe("change_theme intent", () => {
        it("routes to themeHandler and completes without AI messages", async () => {
          const result = await testGraph<WebsiteGraphState>()
            .withGraph(websiteGraph)
            .withState({
              websiteId,
              threadId,
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

          // Intent should be cleared after handling (null, not undefined, because LangGraph skips undefined)
          expect(result.state.intent).toBeNull();

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
              threadId,
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

        it("returns index.css with new theme CSS variables", async () => {
          // Get the new theme's CSS variables
          const [newTheme] = await db
            .select()
            .from(themes)
            .where(eq(themes.id, newThemeId))
            .limit(1);

          expect(newTheme).toBeDefined();
          expect(newTheme!.theme).toBeDefined();

          const result = await testGraph<WebsiteGraphState>()
            .withGraph(websiteGraph)
            .withState({
              websiteId,
              threadId,
              intent: {
                type: "change_theme",
                payload: { themeId: newThemeId },
                createdAt: new Date().toISOString(),
              },
            })
            .execute();

          // Should have index.css in the returned files
          const indexCss = result.state.files["src/index.css"];
          expect(indexCss).toBeDefined();
          expect(indexCss!.content).toBeDefined();

          // Verify the CSS contains variables from the new theme
          const themeVars = newTheme!.theme as Record<string, string>;
          for (const [varName, varValue] of Object.entries(themeVars)) {
            expect(indexCss!.content).toContain(`${varName}: ${varValue};`);
          }
        });

        it("applies a newly-created custom theme via intent", async () => {
          // Simulate creating a custom theme (what happens when user clicks "Add Custom" on Website page)
          const customColors = ["#FF5733", "#33FF57", "#3357FF", "#F333FF", "#33FFF3"];

          const customTheme = await appScenario<{ id: number; name: string; colors: string[] }>(
            "create_custom_theme",
            {
              name: "Test Custom Theme",
              colors: customColors,
            }
          );

          const result = await testGraph<WebsiteGraphState>()
            .withGraph(websiteGraph)
            .withState({
              websiteId,
              threadId,
              intent: {
                type: "change_theme",
                payload: { themeId: customTheme.id },
                createdAt: new Date().toISOString(),
              },
            })
            .execute();

          // Verify intent processed successfully
          expect(result.error).toBeUndefined();
          expect(result.state.status).toBe("completed");
          expect(result.state.intent).toBeNull();

          // Verify database updated with the custom theme
          const [updatedWebsite] = await db
            .select()
            .from(websites)
            .where(eq(websites.id, websiteId))
            .limit(1);
          expect(updatedWebsite!.themeId).toBe(customTheme.id);

          // Verify CSS contains the custom theme variables
          const indexCss = result.state.files["src/index.css"];
          expect(indexCss).toBeDefined();

          // Get the computed theme variables from the database
          const [savedTheme] = await db
            .select()
            .from(themes)
            .where(eq(themes.id, customTheme.id))
            .limit(1);

          expect(savedTheme!.theme).toBeDefined();
          const themeVars = savedTheme!.theme as Record<string, string>;
          for (const [varName, varValue] of Object.entries(themeVars)) {
            expect(indexCss!.content).toContain(`${varName}: ${varValue};`);
          }
        });
      });
    });

    describe("Image uploads via context engineering", () => {
      let websiteId: number;
      let projectId: number;
      let accountId: number;
      let threadId: ThreadIDType;

      beforeEach(async () => {
        // Use website_generated snapshot - has a fully generated website with files
        await DatabaseSnapshotter.restoreSnapshot("website_generated");

        const [websiteRow] = await db.select().from(websites).limit(1);
        if (!websiteRow) {
          throw new Error("No website found in snapshot");
        }

        websiteId = websiteRow.id;
        projectId = websiteRow.projectId!;
        accountId = websiteRow.accountId!;

        // Load the chat's threadId for checkpoint state
        const [chat] = await db
          .select()
          .from(chats)
          .where(and(eq(chats.contextableId, websiteId), eq(chats.contextableType, "Website")))
          .limit(1);

        if (!chat?.threadId) {
          throw new Error("No chat with threadId found for website");
        }
        threadId = chat.threadId as ThreadIDType;
      });

      it("incorporates uploaded images into the website when user asks", async () => {
        // Simulate user uploading images via QuickActions (creates AgentContextEvents)
        await appScenario("create_agent_context_event", {
          project_id: projectId,
          event_type: "images.created",
          payload: {
            filename: "hero-banner.png",
            url: "https://dev-uploads.launch10.ai/uploads/024dfc6c-335d-4f11-883b-f8e241f91744.png",
          },
        });
        await appScenario("create_agent_context_event", {
          project_id: projectId,
          event_type: "images.created",
          payload: {
            filename: "product-shot.png",
            url: "https://dev-uploads.launch10.ai/uploads/4524ac00-da1d-49b5-b601-bdd015aa6d2b.png",
          },
        });

        // Use WebsiteAPI to stream - this goes through the bridge with context middleware
        const userMessage = { role: "user", content: "Add these new images to my landing page" };
        const response = WebsiteAPI.stream({
          messages: [userMessage],
          threadId,
          state: {
            websiteId,
            threadId,
            projectId,
            accountId,
            jwt: "test-jwt",
            messages: [new HumanMessage(userMessage.content)], // Include for middleware
          },
        });
        await consumeStream(response);

        // Get the final state from checkpoint
        const checkpoint = await websiteGraph.getState({ configurable: { thread_id: threadId } });
        const state = checkpoint.values as WebsiteGraphState;

        expect(state.status).toBe("completed");

        // Verify the agent responded with awareness of the uploaded images
        const aiMessage = state.messages.find(isAIMessage);
        expect(aiMessage).toBeDefined();

        // Check that generated files reference the uploaded images
        const allFileContent = Object.values(state.files)
          .map((f) => (f as Website.File.File).content || "")
          .join("\n");

        // The agent should have added at least one of the uploaded images
        const hasHeroBanner = allFileContent.includes("024dfc6c-335d-4f11-883b-f8e241f91744.png");
        const hasProductShot = allFileContent.includes("4524ac00-da1d-49b5-b601-bdd015aa6d2b.png");

        expect(hasHeroBanner || hasProductShot).toBe(true);
      }, 300000);
    });
  });
});
