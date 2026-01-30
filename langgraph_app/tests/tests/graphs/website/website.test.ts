import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { testGraph } from "@support";
import { DatabaseSnapshotter } from "@services";
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

  console.log(textContent);
  expect(containsBrainstormContext).toBe(true);
};

// describe.sequential
// temporarily skipping because caching is failing on CI - use this mainly for local testing and debugging speed
describe.skip("Website Builder", () => {
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
          command: "create",
          websiteId,
          threadId: existingChat.threadId as ThreadIDType,
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
    }, 500000);
  });
});
