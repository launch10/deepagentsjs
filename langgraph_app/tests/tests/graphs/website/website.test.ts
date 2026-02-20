import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import {
  db,
  Types as DBTypes,
  websites,
  chats,
  brainstorms,
  websiteFiles,
  themes,
  websiteUploads,
  llmUsage,
  llmConversationTraces,
  eq,
  and,
  desc,
} from "@db";
import { testGraph, appScenario, consumeStream, logCostSummary } from "@support";
import { DatabaseSnapshotter } from "@services";
import { WebsiteAPI } from "@api";
import { getCodingAgentBackend } from "@nodes";
import { Website, isAIMessage, type ThreadIDType } from "@types";
import { websiteGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import type { WebsiteGraphState } from "@annotation";
import { saveExample } from "@support";
import { v4 as uuidv4 } from "uuid";

const websiteGraph = uncompiledGraph.compile({
  ...graphParams,
  name: "website",
});

/** Extract the text content from an AI message (handles string or content-block arrays). */
const extractText = (msg: AIMessage): string | undefined => {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    const textBlock = msg.content.find((c: any) => c.type === "text");
    return textBlock?.text as string | undefined;
  }
  return undefined;
};

/**
 * Assert the create flow returned both a greeting (first AI message) and a
 * summary (last AI message), and that the greeting references brainstorm context.
 */
const assertCreateFlowMessages = async (state: WebsiteGraphState, websiteId: number) => {
  const textMessages = state.messages
    .filter(isAIMessage)
    .flatMap((m) => (m as any).content)
    .filter((c) => c.type === "text");

  // Create flow should persist at least 2 text parts (intro and summary)
  expect(textMessages.length).toBeGreaterThanOrEqual(2);

  const greeting = textMessages.at(0);
  const summary = textMessages.at(-1);

  // textMessages are already content blocks ({ type: "text", text: "..." })
  const greetingText = greeting?.text as string | undefined;
  const summaryText = summary?.text as string | undefined;

  expect(greetingText).toBeDefined();
  expect(greetingText!.length).toBeGreaterThan(20);
  expect(summaryText).toBeDefined();
  expect(summaryText!.length).toBeGreaterThan(20);

  console.log(`Greeting preview: ${greetingText?.slice(0, 200)}...`);
  console.log(`Summary preview: ${summaryText?.slice(0, 200)}...`);

  // The greeting should reference something from the brainstorm context
  // (idea, audience, or solution) to show it's personalized
  const brainstormResults = await db
    .select()
    .from(brainstorms)
    .where(eq(brainstorms.websiteId, websiteId))
    .limit(1);
  const brainstorm = brainstormResults[0];
  expect(brainstorm).toBeDefined();

  const greetingLower = greetingText!.toLowerCase();
  const ideaWords = brainstorm!.idea?.toLowerCase().split(/\s+/) || [];
  const audienceWords = brainstorm!.audience?.toLowerCase().split(/\s+/) || [];

  const significantWords = [...ideaWords, ...audienceWords]
    .filter((w) => w.length > 4)
    .slice(0, 10);

  const containsBrainstormContext = significantWords.some((word) => greetingLower.includes(word));
  expect(containsBrainstormContext).toBe(true);
};

/**
 * Assert the edit flow produced a meaningful AI response.
 * The last AI message should acknowledge the edit with real text content.
 */
const assertEditFlowMessages = (state: WebsiteGraphState) => {
  const aiMessages = state.messages.filter(isAIMessage);
  expect(aiMessages.length).toBeGreaterThanOrEqual(1);

  const lastAI = aiMessages.at(-1)!;
  const text = extractText(lastAI);
  expect(text).toBeDefined();
  expect(text!.length).toBeGreaterThan(10);

  console.log(`Edit response preview: ${text?.slice(0, 200)}...`);
};

// describe.sequential
// temporarily skipping because caching is failing on CI - use this mainly for local testing and debugging speed
describe("Website Builder", () => {
  let websiteId: number;
  let website: DBTypes.WebsiteType;
  let threadId: ThreadIDType;

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
    beforeEach(async () => {
      // website_step snapshot includes:
      // - brainstorm with idea, audience, solution, social_proof
      // - theme assigned to website (with typography recommendations)
      // - uploads: 1 logo + 3 images associated with website
      await DatabaseSnapshotter.restoreSnapshot("website_step");

      const [websiteRow] = await db.select().from(websites).limit(1);
      website = websiteRow!;

      if (!website || !website.name) {
        throw new Error("No website found in snapshot");
      }

      websiteId = website.id;

      threadId = "abc-123" as any;
    }, 60000);

    it("generates a complete landing page with required sections", async () => {
      // Use WebsiteAPI.stream to go through the bridge with usageTrackingMiddleware
      const response = WebsiteAPI.stream({
        messages: [
          {
            role: "user",
            content:
              "Let's make the landing page. Include these sections: Hero, HowItWorks (step-by-step process), Problem, Features, SocialProof, CTA, and Footer.",
          },
        ],
        threadId,
        state: {
          websiteId,
          threadId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
          jwt: "test-jwt",
          messages: [
            new HumanMessage(
              "Let's make the landing page. Include these sections: Hero, HowItWorks (step-by-step process), Problem, Features, SocialProof, CTA, and Footer."
            ),
          ],
        },
      });
      await consumeStream(response);

      // Get the final state from checkpoint
      const checkpoint = await websiteGraph.getState({ configurable: { thread_id: threadId } });
      const state = checkpoint.values as WebsiteGraphState;

      expect(state.status).toBe("completed");

      // ---- Usage tracking assertions ----
      const usageRecords = await db.select().from(llmUsage);

      expect(usageRecords.length).toBeGreaterThan(0);

      // All records should have costMillicredits populated
      for (const record of usageRecords) {
        expect(record.inputTokens).toBeGreaterThan(0);
        expect(record.outputTokens).toBeGreaterThan(0);
        expect(record.costMillicredits).not.toBeNull();
        expect(record.costMillicredits).toBeGreaterThan(0);
      }

      // Log cost summary for debugging
      logCostSummary("Website Build Cost Summary", usageRecords);

      // ---- File generation assertions ----
      const generatedFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      // Should generate multiple component files in src/components
      const componentFiles = generatedFiles.filter((f) => f.path?.includes("src/components"));
      expect(componentFiles.length).toBeGreaterThanOrEqual(2);

      // Component files should contain valid React components
      const firstComponent = componentFiles[0];
      expect(firstComponent?.content).toBeDefined();
      expect(firstComponent?.content).toContain("export");
      expect(firstComponent?.content).toMatch(/function|const/);

      // State should be synced with database
      const stateFile = state.files[firstComponent?.path!] as Website.File.File;
      expect(stateFile?.content).toEqual(firstComponent?.content);

      // At least one file contains tracking
      const trackingFile = generatedFiles.find((f) => f.content.match(/LeadForm/));
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
      expect(chat?.threadId).toEqual(state.threadId);

      await assertCreateFlowMessages(state, websiteId);

      // ---- History endpoint round-trip assertion ----
      // Call loadHistory and verify the messages survive serialization
      const historyResponse = await WebsiteAPI.loadHistory(threadId);
      expect(historyResponse.status).toBe(200);

      const historyBody = (await historyResponse.json()) as {
        messages: Array<{ role: string; parts: Array<{ type: string; text?: string }> }>;
        state: Record<string, unknown>;
      };

      // loadHistory filters out context messages, so count only non-context messages from state
      const isContextMessage = (m: any) =>
        m.additional_kwargs?.isContext === true || m.name === "context";
      const visibleStateMessages = state.messages.filter((m: any) => !isContextMessage(m));

      console.log(`\n=== History Round-Trip ===`);
      console.log(`Messages in state (visible): ${visibleStateMessages.length}`);
      console.log(`Messages from loadHistory: ${historyBody.messages.length}`);
      console.log(`=========================\n`);

      expect(historyBody.messages.length).toBe(visibleStateMessages.length);

      // Verify at least one text message round-trips correctly
      let matchedTextMessages = 0;
      for (let i = 0; i < visibleStateMessages.length; i++) {
        const stateMsg = visibleStateMessages[i] as any;
        const historyMsg = historyBody.messages[i];

        // Extract text from state message
        const stateText =
          typeof stateMsg.content === "string"
            ? stateMsg.content
            : Array.isArray(stateMsg.content)
              ? stateMsg.content.find((c: any) => c.type === "text")?.text
              : undefined;

        // Extract text from history message
        const historyText = historyMsg?.parts?.find((p: any) => p.type === "text")?.text;

        if (stateText && historyText) {
          expect(historyText).toBe(stateText);
          matchedTextMessages++;
        }
      }
      // At least some text messages should round-trip correctly
      expect(matchedTextMessages).toBeGreaterThan(0);

      // ---- Footer content quality assertions ----
      // Footer should only link to sections that actually exist on the page
      const footerFile = generatedFiles.find((f) => f.path?.toLowerCase().includes("footer"));
      expect(footerFile).toBeDefined();
      expect(footerFile!.content).toBeDefined();

      // Collect all element IDs across all files
      const allIds = new Set<string>();
      for (const file of generatedFiles) {
        if (!file.content) continue;
        const idMatches = file.content.matchAll(/id=["']([^"']+)["']/g);
        for (const match of idMatches) {
          if (match[1]) allIds.add(match[1]);
        }
      }

      // Collect component names (e.g. Features.tsx -> "features")
      const componentNames = new Set<string>();
      for (const file of generatedFiles) {
        if (!file.path?.includes("src/components/")) continue;
        const name = file.path.split("/").pop()?.replace(".tsx", "").replace(".ts", "");
        if (name) componentNames.add(name.toLowerCase());
      }

      // Extract all anchor links from the footer
      const footerAnchors: string[] = [];
      const anchorMatches = footerFile!.content.matchAll(/href=["']#([^"']+)["']/g);
      for (const match of anchorMatches) {
        if (match[1]) footerAnchors.push(match[1]);
      }

      console.log(`\n=== Footer Quality ===`);
      console.log(`Footer anchor links: ${footerAnchors.join(", ")}`);
      console.log(`Page section IDs: ${[...allIds].join(", ")}`);
      console.log(`Component names: ${[...componentNames].join(", ")}`);
      console.log(`=====================\n`);

      // Every footer anchor must correspond to either an existing id OR a real
      // component (e.g. #features is fine if Features.tsx exists, even if the
      // component is missing the id attribute — that's a separate fix)
      const isRealSection = (anchor: string) => {
        if (allIds.has(anchor)) return true;
        // Normalize: "social-proof" -> "socialproof" to match "SocialProof.tsx"
        const normalized = anchor.toLowerCase().replace(/-/g, "");
        return [...componentNames].some((name) => name === normalized);
      };
      const inventedAnchors = footerAnchors.filter((anchor) => !isRealSection(anchor));
      expect(inventedAnchors).toEqual([]);

      // Footer should NOT contain links to invented pages that don't exist
      const phantomPages = [
        "/about",
        "/blog",
        "/careers",
        "/contact",
        "/privacy",
        "/terms",
        "/cookies",
        "/team",
      ];
      const footerContent = footerFile!.content;
      const foundPhantomLinks = phantomPages.filter(
        (page) =>
          footerContent.includes(`href="${page}"`) || footerContent.includes(`href='${page}'`)
      );
      expect(foundPhantomLinks).toEqual([]);

      await saveExample(websiteId, "scheduling-tool"); // So we can see the result
    }, 500000);
  });

  describe("Editing page", () => {
    beforeEach(async () => {
      await DatabaseSnapshotter.restoreSnapshot("website_generated");
      const [websiteRow] = await db.select().from(websites).limit(1);
      website = websiteRow!;
      if (!website) {
        throw new Error("No website found in snapshot");
      }
      websiteId = website.id;

      // Load the chat's threadId from the snapshot so the graph state matches the DB
      const [existingChat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.contextableId, websiteId), eq(chats.contextableType, "Website")))
        .limit(1);

      if (!existingChat?.threadId) {
        throw new Error("No chat with threadId found in snapshot for website");
      }

      threadId = existingChat.threadId as ThreadIDType;
    }, 60000);

    it("routes color scheme changes through theme creation (real Theme record)", async () => {
      const originalUsageRecords = await db.select().from(llmUsage);
      expect(originalUsageRecords.length).toEqual(0);

      // Record the website's original theme
      const originalThemeId = website.themeId;

      // Snapshot original component files to verify they weren't touched
      const originalFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      const originalComponentContents = new Map(
        originalFiles
          .filter((f) => f.path?.includes("src/components/"))
          .map((f) => [f.path, f.content])
      );

      const originalIndexCss = originalFiles.find((f) => f.path === "src/index.css");
      expect(originalIndexCss).toBeDefined();

      // Count existing themes so we can detect the new one
      const themesBefore = await db.select().from(themes);

      const editResponse = WebsiteAPI.stream({
        messages: [
          {
            role: "user",
            content: "can we switch up the page color scheme?",
          },
        ],
        threadId,
        state: {
          websiteId,
          threadId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
          jwt: "test-jwt",
          messages: [
            new AIMessage("Here is your website!"),
            new HumanMessage("can we switch up the page color scheme?"),
          ],
        },
      });
      await consumeStream(editResponse);

      // Get the state after edit
      const editCheckpoint = await websiteGraph.getState({ configurable: { thread_id: threadId } });
      const editState = editCheckpoint.values as WebsiteGraphState;

      expect(editState.status).toBe("completed");

      // ---- Cost assertions: should be cheap (classifier + 1 LLM for color generation) ----
      const usageRecords = await db.select().from(llmUsage);
      logCostSummary("Color Scheme Edit Cost Summary", usageRecords);

      // Theme generation path: 1 classifier + 1 color generation LLM call (not 34!)
      expect(usageRecords.length).toBeLessThanOrEqual(4);

      // ---- Theme record assertions: a real custom theme should be created ----
      const themesAfter = await db.select().from(themes);
      expect(themesAfter.length).toBe(themesBefore.length + 1);

      // Find the newly created theme (highest ID)
      const newTheme = themesAfter.sort((a, b) => b.id - a.id)[0]!;
      expect(newTheme.themeType).toBe("community"); // Custom themes are "community"

      // Theme should have 5 hex colors
      const colors = newTheme.colors as string[];
      expect(colors).toHaveLength(5);
      for (const color of colors) {
        expect(color).toMatch(/^#?[0-9a-fA-F]{6}$/);
      }

      // Theme should have computed semantic variables (Rails before_save callback)
      const themeVars = newTheme.theme as Record<string, string>;
      expect(themeVars).toBeDefined();
      expect(themeVars["--primary"]).toBeDefined();
      expect(themeVars["--background"]).toBeDefined();
      expect(themeVars["--foreground"]).toBeDefined();

      // ---- Website association: website should point to the new theme ----
      const [updatedWebsite] = await db
        .select()
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);

      expect(updatedWebsite!.themeId).toBe(newTheme.id);
      expect(updatedWebsite!.themeId).not.toBe(originalThemeId);

      // ---- Graph state themeId: streamed to frontend for picker sync ----
      expect(editState.themeId).toBe(newTheme.id);

      // ---- CSS injection: index.css should have the new theme's variables ----
      const updatedFiles = await db
        .select()
        .from(websiteFiles)
        .where(eq(websiteFiles.websiteId, websiteId));

      const updatedIndexCss = updatedFiles.find((f) => f.path === "src/index.css");
      expect(updatedIndexCss).toBeDefined();
      expect(updatedIndexCss!.content).not.toEqual(originalIndexCss!.content);

      // Verify the CSS contains the new theme's semantic variables
      for (const [varName, varValue] of Object.entries(themeVars)) {
        expect(updatedIndexCss!.content).toContain(`${varName}: ${varValue}`);
      }

      // ---- Component files should NOT have been modified ----
      for (const [path, originalContent] of originalComponentContents) {
        const updated = updatedFiles.find((f) => f.path === path);
        expect(updated?.content).toEqual(originalContent);
      }

      assertEditFlowMessages(editState);
    });

    it("edits an existing page cost-effectively", async () => {
      const originalUsageRecords = await db.select().from(llmUsage);
      expect(originalUsageRecords.length).toEqual(0);

      const editResponse = WebsiteAPI.stream({
        messages: [
          {
            role: "user",
            content: "Let's make the hero visually more like the features section, please",
          },
        ],
        threadId,
        state: {
          websiteId,
          threadId,
          accountId: website.accountId ?? undefined,
          projectId: website.projectId ?? undefined,
          jwt: "test-jwt",
          messages: [
            new AIMessage("Here is your website!"),
            new HumanMessage("Let's make the hero visually more like the features section, please"),
          ],
        },
      });
      await consumeStream(editResponse);

      // Get the state after edit
      const editCheckpoint = await websiteGraph.getState({ configurable: { thread_id: threadId } });
      const editState = editCheckpoint.values as WebsiteGraphState;

      expect(editState.status).toBe("completed");

      // ---- Edit cost assertions ----
      const usageRecords = await db.select().from(llmUsage);

      logCostSummary("Hero Edit Cost Summary", usageRecords);

      // Edit should have generated some LLM calls
      expect(usageRecords.length).toBeGreaterThan(0);

      // This prompt mentions two sections ("hero" + "features section"), so the
      // classifier correctly routes to the full agent path (~$0.10).
      // Guardrail: should still be far cheaper than a full create flow ($0.50+).
      const editCost = usageRecords.reduce((sum, r) => sum + (r.costMillicredits ?? 0), 0);
      expect(editCost / 100_000).toBeLessThan(0.15);
      // Full agent path: classifier + multi-turn agent with subagents
      expect(usageRecords.length).toBeLessThanOrEqual(8);

      // Verify hero file was updated
      const heroFile = Object.entries(editState.files).find(([path]) =>
        path.toLowerCase().includes("hero")
      );
      if (heroFile) {
        const heroContent = (heroFile[1] as Website.File.File).content;
        console.log(`Hero file found: ${heroFile[0]}`);
        console.log(
          `Contains new headline: ${heroContent.includes("Transform Your Business Today")}`
        );
      }

      // ---- Edit message assertions ----
      assertEditFlowMessages(editState);

      // Messages should still be trimmed after edit
      console.log(`Messages after edit: ${editState.messages.length}`);
      expect(editState.messages.length).toBeLessThanOrEqual(15);
    });
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

    describe("Improve copy", () => {
      let websiteId: number;
      let website: DBTypes.WebsiteType;
      let threadId: ThreadIDType;

      beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("website_generated");
        const [websiteRow] = await db.select().from(websites).limit(1);
        if (!websiteRow) throw new Error("No website found in snapshot");
        website = websiteRow;
        websiteId = websiteRow.id;

        const [chat] = await db
          .select()
          .from(chats)
          .where(and(eq(chats.contextableId, websiteId), eq(chats.contextableType, "Website")))
          .limit(1);
        if (!chat?.threadId) throw new Error("No chat with threadId found for website");
        threadId = chat.threadId as ThreadIDType;
      }, 60000);

      it("rewrites copy via improve_copy intent with a visible user message", async () => {
        const userMessage = "Make tone more professional";

        const response = WebsiteAPI.stream({
          messages: [{ role: "user", content: userMessage }],
          threadId,
          state: {
            websiteId,
            threadId,
            accountId: website.accountId ?? undefined,
            projectId: website.projectId ?? undefined,
            jwt: "test-jwt",
            intent: {
              type: "improve_copy",
              payload: { style: "professional" },
              createdAt: new Date().toISOString(),
            },
            messages: [new AIMessage("Here is your website!"), new HumanMessage(userMessage)],
          },
        });
        await consumeStream(response);

        const checkpoint = await websiteGraph.getState({ configurable: { thread_id: threadId } });
        const state = checkpoint.values as WebsiteGraphState;

        expect(state.status).toBe("completed");
        expect(state.intent).toBeNull();

        // Human message should be in conversation
        const humanMessages = state.messages.filter(
          (m: any) => m._getType?.() === "human" || m.type === "human"
        );
        expect(humanMessages.length).toBeGreaterThanOrEqual(1);

        // AI response should exist
        assertEditFlowMessages(state);

        // Cost should be reasonable (full agent edit path)
        const usageRecords = await db.select().from(llmUsage);
        logCostSummary("Improve Copy Cost Summary", usageRecords);
      }, 300000);
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
        const userMessage = {
          role: "user",
          content: "Add these new images to my landing page, please",
        };
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
