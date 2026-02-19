import { describe, it, expect, beforeEach } from "vitest";
import {
  testGraph,
  tagMessage,
  dumpTimeline,
  assertNoBunching,
  assertMessageTypes,
  assertCtxBeforeHumanInLLMView,
} from "@support";
import { type AdsGraphState } from "@state";
import { adsGraph as uncompiledGraph } from "@graphs";
import { graphParams } from "@core";
import { DatabaseSnapshotter } from "@services";
import { db, projects as projectsTable, campaigns, adGroups, ads as adsTable, adHeadlines, adDescriptions, adCallouts, eq, and, sql } from "@db";
import { type UUIDType, Ads, type ThreadIDType, switchPage, refreshAssets } from "@types";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { v7 as uuid } from "uuid";
import { isContextMessage, createContextMessage } from "langgraph-ai-sdk";
import { Conversation } from "@conversation";

const adsGraph = uncompiledGraph.compile({ ...graphParams, name: "ads" });

const getTextData = (message: AIMessage): string => {
  return (
    ((message.response_metadata?.parsed_blocks as any[]) || [])
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.sourceText)
      .join("\n") || ""
  );
};

describe.sequential("Ads Flow", () => {
  let projectUUID: UUIDType;
  let threadId = uuid() as ThreadIDType;

  beforeEach(async () => {
    await DatabaseSnapshotter.restoreSnapshot("website_deploy_step");
    projectUUID = await db
      .select()
      .from(projectsTable)
      .limit(1)
      .execute()
      .then((res) => {
        if (!res[0]) {
          throw new Error("No projects found");
        }
        return res[0]!.uuid as UUIDType;
      });
  }, 30000);

  describe("Chat flow", () => {
    /** Helper: query Rails DB for active (non-soft-deleted) headlines for a campaign */
    async function queryDbHeadlines(campaignId: number) {
      const adGroup = await db.select().from(adGroups)
        .where(and(eq(adGroups.campaignId, campaignId), sql`${adGroups.deletedAt} IS NULL`))
        .limit(1).execute().then(r => r[0]);
      if (!adGroup) return [];
      const ad = await db.select().from(adsTable)
        .where(and(eq(adsTable.adGroupId, adGroup.id), sql`${adsTable.deletedAt} IS NULL`))
        .limit(1).execute().then(r => r[0]);
      if (!ad) return [];
      return db.select().from(adHeadlines)
        .where(and(eq(adHeadlines.adId, ad.id), sql`${adHeadlines.deletedAt} IS NULL`))
        .execute();
    }

    /** Helper: query Rails DB for active descriptions for a campaign */
    async function queryDbDescriptions(campaignId: number) {
      const adGroup = await db.select().from(adGroups)
        .where(and(eq(adGroups.campaignId, campaignId), sql`${adGroups.deletedAt} IS NULL`))
        .limit(1).execute().then(r => r[0]);
      if (!adGroup) return [];
      const ad = await db.select().from(adsTable)
        .where(and(eq(adsTable.adGroupId, adGroup.id), sql`${adsTable.deletedAt} IS NULL`))
        .limit(1).execute().then(r => r[0]);
      if (!ad) return [];
      return db.select().from(adDescriptions)
        .where(and(eq(adDescriptions.adId, ad.id), sql`${adDescriptions.deletedAt} IS NULL`))
        .execute();
    }

    /** Helper: query Rails DB for active callouts for a campaign */
    async function queryDbCallouts(campaignId: number) {
      return db.select().from(adCallouts)
        .where(and(eq(adCallouts.campaignId, campaignId), sql`${adCallouts.deletedAt} IS NULL`))
        .execute();
    }

    describe("Campaign creation", () => {
      it("creates campaign", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        expect(result.state.campaignId).toBeDefined();
      });
    });

    describe("When step already started, and not refresh", () => {
      it("exits early", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        if (!result.state.headlines || !result.state.descriptions) {
          throw new Error("Headlines or descriptions not found");
        }

        expect(result.state.headlines.length).toEqual(6);
        expect(result.state.descriptions.length).toEqual(4);
        expect(result.state.hasStartedStep?.content).toEqual(true);

        const invalidRefresh = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            threadId,
          })
          .execute();
        const updatedHeadlines = invalidRefresh.state.headlines;
        const updatedDescriptions = invalidRefresh.state.descriptions;

        expect(updatedHeadlines!.length).toEqual(result.state.headlines.length);
        expect(updatedHeadlines).toEqual(result.state.headlines);
        expect(updatedDescriptions).toEqual(result.state.descriptions);
      });

      it("regenerates if hasStartedStep is true but assets are empty (failed generation)", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
            hasStartedStep: { content: true },
            headlines: [],
            descriptions: [],
          })
          .execute();

        expect(result.state.headlines?.length).toEqual(6);
        expect(result.state.descriptions?.length).toEqual(4);
        expect(result.state.hasStartedStep?.content).toEqual(true);
      });

      it("regenerates if hasStartedStep is true but assets are undefined (failed generation)", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
            hasStartedStep: { content: true },
            headlines: undefined,
            descriptions: undefined,
          })
          .execute();

        expect(result.state.headlines?.length).toEqual(6);
        expect(result.state.descriptions?.length).toEqual(4);
      });
    });

    describe("Content Stage", () => {
      it("automatically populates headlines and descriptions", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        expect(result.state.headlines?.length).toEqual(6);
        expect(result.state.descriptions?.length).toEqual(4);

        const lastMessage = result.state.messages?.at(-1) as AIMessage;
        const message = getTextData(lastMessage);

        expect(result.state.headlines).toBeDefined();
        expect(message).toMatch(/start building|drafted a few headlines|headlines and descriptions|compelling headlines/i);
        expect(message).not.toContain("```json");

        const headlines = result.state.headlines || [];
        const headlineContent = headlines.map((h) => h.text).join("\n");

        // Headlines relate to the campaign copy
        expect(headlineContent).toMatch(/scheduling|schedule/i);

        const descriptions = result.state.descriptions || [];
        const descriptionContent = descriptions.map((d) => d.text).join("\n");

        // Descriptions also relate to the campaign copy
        expect(descriptionContent).toMatch(/schedule|scheduling|meeting times/i);

        expect(headlines.every((h) => !!h.id)).toBe(true);
        expect(descriptions.every((h) => !!h.id)).toBe(true);
      });

      it("enforces asset limits when regenerating descriptions", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        expect(result.state.descriptions?.length).toEqual(4);

        const descriptions = result.state.descriptions as Ads.Asset[];
        descriptions[0]!.locked = true;
        descriptions[1]!.locked = true;
        descriptions[2]!.locked = true;

        const refreshedResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            intent: refreshAssets("content", [{ asset: "descriptions", nVariants: 4 }]),
          })
          .execute();

        expect(refreshedResult.state.descriptions?.length).toBeLessThanOrEqual(
          Ads.AssetLimits.descriptions.max
        );
        expect(refreshedResult.state.descriptions?.length).toEqual(4);
      });

      it("refreshes only the specified context (headlines), not descriptions", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        expect(result.state.headlines?.length).toEqual(6);
        expect(result.state.descriptions?.length).toEqual(4);

        const headlines = result.state.headlines as Ads.Asset[];
        if (!headlines[0] || !headlines[1] || !headlines[2]) {
          throw new Error("Not enough headlines available for testing");
        }

        headlines[0].text = `Sync or swim.`;
        headlines[1].text = `This could've been an email.`;
        headlines[2].text = `Calendar Tetris champion.`;

        headlines[0].locked = true;
        headlines[1].locked = true;
        headlines[2].locked = true;

        const originalDescriptions = result.state.descriptions;

        const refreshedResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            intent: refreshAssets("content", [{ asset: "headlines", nVariants: 2 }]),
            headlines: result.state.headlines,
            descriptions: result.state.descriptions,
          })
          .execute();

        const originalUnlockedHeadlines = headlines.filter((h) => !h.locked);
        const refreshedUnlockedHeadlines = refreshedResult.state.headlines?.filter((h) =>
          originalUnlockedHeadlines.some((orig) => orig.text === h.text)
        );
        // Important: We implicitly reject any headline that wasn't locked
        expect(refreshedUnlockedHeadlines?.every((h) => h.rejected)).toBe(true);

        const lockedHeadlines = refreshedResult.state.headlines?.filter((h) => h.locked);
        expect(lockedHeadlines?.every((h) => !h.rejected)).toBe(true);

        const newHeadlines = refreshedResult.state.headlines?.filter(
          (h) => !h.rejected && !h.locked
        );
        expect(newHeadlines?.length).toEqual(2); // 2 new headlines

        expect(refreshedResult.state.descriptions).toEqual(originalDescriptions);

        const originalHeadlines = headlines.filter((h) => h.locked);
        const refreshedHeadlines = refreshedResult.state.headlines;
        // Doesn't change id
        originalHeadlines.forEach((originalHeadline, index) => {
          expect(originalHeadline.id).toEqual(refreshedHeadlines?.at(index)!.id);
        });
        expect(refreshedHeadlines?.every((h) => !!h.id)).toBe(true);
      });

      it("refreshes all assets for content stage (headlines + descriptions) using refreshAllCommand", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        expect(result.state.headlines?.length).toEqual(6);
        expect(result.state.descriptions?.length).toEqual(4);

        const headlines = result.state.headlines as Ads.Asset[];
        const descriptions = result.state.descriptions as Ads.Asset[];

        headlines[0]!.locked = true;
        headlines[1]!.locked = true;
        descriptions[0]!.locked = true;

        const refreshedResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            intent: refreshAssets(
              "content",
              Ads.refreshAllCommand("content")
            ),
          })
          .execute();

        const originalUnlockedHeadlines = headlines.filter((h) => !h.locked);
        const refreshedHeadlinesFromOriginal = refreshedResult.state.headlines?.filter((h) =>
          originalUnlockedHeadlines.some((orig) => orig.text === h.text)
        );
        expect(refreshedHeadlinesFromOriginal?.every((h) => h.rejected)).toBe(true);

        const lockedHeadlines = refreshedResult.state.headlines?.filter((h) => h.locked);
        expect(lockedHeadlines?.every((h) => !h.rejected)).toBe(true);
        expect(lockedHeadlines?.length).toEqual(2);

        const newHeadlines = refreshedResult.state.headlines?.filter(
          (h) => !h.rejected && !h.locked
        );
        expect(newHeadlines?.length).toEqual(Ads.DefaultNumAssets.headlines);

        const originalUnlockedDescriptions = descriptions.filter((d) => !d.locked);
        const refreshedDescriptionsFromOriginal = refreshedResult.state.descriptions?.filter((d) =>
          originalUnlockedDescriptions.some((orig) => orig.text === d.text)
        );
        expect(refreshedDescriptionsFromOriginal?.every((d) => d.rejected)).toBe(true);

        const lockedDescriptions = refreshedResult.state.descriptions?.filter((d) => d.locked);
        expect(lockedDescriptions?.every((d) => !d.rejected)).toBe(true);
        expect(lockedDescriptions?.length).toEqual(1);

        const newDescriptions = refreshedResult.state.descriptions?.filter(
          (d) => !d.rejected && !d.locked
        );
        expect(newDescriptions?.length).toEqual(Ads.AssetLimits.descriptions.max - 1);
      });

      // user request | user asks | asks via chat | auto-reject headlines
      it("specifically refreshes headlines using suggestions from the user", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        const refreshedResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            messages: [
              ...result.messages,
              new HumanMessage("I want more playful, funny headlines"),
            ],
          })
          .execute();

        const allHeadlines = refreshedResult.state.headlines || [];
        const originalHeadlines = result.state.headlines || [];
        const originalTexts = new Set(originalHeadlines.map((h) => h.text));

        const rejectedHeadlines = allHeadlines.filter((h) => h.rejected);
        const newHeadlines = allHeadlines.filter((h) => !h.rejected);

        expect(originalHeadlines.length).toEqual(6);
        expect(allHeadlines.length).toEqual(6);
        expect(rejectedHeadlines.length).toEqual(0); // We just remove them
        expect(newHeadlines.length).toEqual(6);
        expect(newHeadlines.every((h) => !originalTexts.has(h.text))).toBe(true);
      });

      // locked assets | chat feedback | duplicate prevention | user message with locked
      it("preserves locked headlines and only generates net-new when user sends chat feedback", async () => {
        // Step 1: Generate initial headlines
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        expect(result.state.headlines?.length).toEqual(6);
        expect(result.state.descriptions?.length).toEqual(4);

        // Step 2: User locks 2 headlines they like
        const headlines = result.state.headlines as Ads.Asset[];
        headlines[0]!.locked = true;
        headlines[1]!.locked = true;
        const lockedTexts = [headlines[0]!.text, headlines[1]!.text];

        // Step 3: User sends casual chat feedback (not a refresh command)
        const chatResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            headlines,
            messages: [
              ...result.messages,
              new HumanMessage("nice, I like things that are very eco-friendly"),
            ],
          })
          .execute();

        const updatedHeadlines = chatResult.state.headlines || [];

        // The locked headlines should still be present (not regenerated or duplicated)
        const lockedInResult = updatedHeadlines.filter((h) => h.locked);
        expect(lockedInResult.length).toEqual(2);
        expect(lockedInResult.map((h) => h.text)).toEqual(expect.arrayContaining(lockedTexts));

        // There should be NO text-duplicate copies of the locked headlines
        const duplicates = updatedHeadlines.filter(
          (h) => !h.locked && lockedTexts.includes(h.text)
        );
        expect(duplicates.length).toEqual(0);

        // Total headline count should be reasonable (locked + new = 6)
        expect(updatedHeadlines.filter((h) => !h.rejected).length).toBeLessThanOrEqual(6);
      });
    });

    describe("User modifies assets then retriggers graph", () => {
      it("saves generated assets to Rails DB after graph run", async () => {
        // Run the graph — this creates a campaign, generates assets, then
        // the reset node PATCHes to Rails via CampaignAPIService.update()
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        const campaignId = result.state.campaignId;
        expect(campaignId).toBeDefined();
        expect(result.state.headlines?.length).toEqual(6);
        expect(result.state.descriptions?.length).toEqual(4);

        // Verify assets were persisted to Rails DB
        const dbHeadlines = await queryDbHeadlines(campaignId!);
        expect(dbHeadlines.length).toEqual(6);

        // Verify the headline texts match what the graph generated (non-rejected)
        const graphHeadlineTexts = result.state.headlines!
          .filter(h => !h.rejected)
          .map(h => h.text)
          .sort();
        const dbHeadlineTexts = dbHeadlines.map(h => h.text).sort();
        expect(dbHeadlineTexts).toEqual(graphHeadlineTexts);

        const dbDescriptions = await queryDbDescriptions(campaignId!);
        expect(dbDescriptions.length).toEqual(4);

        const graphDescTexts = result.state.descriptions!
          .filter(d => !d.rejected)
          .map(d => d.text)
          .sort();
        const dbDescTexts = dbDescriptions.map(d => d.text).sort();
        expect(dbDescTexts).toEqual(graphDescTexts);
      });

      it("preserves user modifications when retriggering with chat message", async () => {
        // Step 1: Graph generates initial headlines & descriptions
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        const campaignId = result.state.campaignId!;
        expect(result.state.headlines?.length).toEqual(6);
        expect(result.state.descriptions?.length).toEqual(4);

        // Step 2: Simulate user modifications (what happens between graph runs)
        const headlines = [...(result.state.headlines as Ads.Asset[])];
        headlines[0]!.text = "My Custom Headline";
        headlines[0]!.locked = true;
        headlines[1]!.text = "Another User Edit";
        headlines[1]!.locked = true;
        // User removes a headline by marking it rejected
        headlines[2]!.rejected = true;

        // User also edits a description
        const descriptions = [...(result.state.descriptions as Ads.Asset[])];
        descriptions[0]!.text = "User-written description for their product";
        descriptions[0]!.locked = true;

        // Step 3: User sends a chat message to retrigger the graph
        const retriggeredResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            headlines,
            descriptions,
            messages: [
              ...result.messages,
              new HumanMessage("Make the remaining headlines more action-oriented"),
            ],
          })
          .execute();

        const updatedHeadlines = retriggeredResult.state.headlines || [];

        // User's locked headlines are preserved with exact text
        const lockedHeadlines = updatedHeadlines.filter(h => h.locked);
        expect(lockedHeadlines.length).toBeGreaterThanOrEqual(2);
        expect(lockedHeadlines.map(h => h.text)).toContain("My Custom Headline");
        expect(lockedHeadlines.map(h => h.text)).toContain("Another User Edit");

        // User's rejected headline stays rejected
        const rejectedHeadline = updatedHeadlines.find(h => h.id === headlines[2]!.id);
        if (rejectedHeadline) {
          expect(rejectedHeadline.rejected).toBe(true);
        }

        // New headlines were generated (not locked, not rejected)
        const newHeadlines = updatedHeadlines.filter(h => !h.locked && !h.rejected);
        expect(newHeadlines.length).toBeGreaterThan(0);

        // User's locked description is preserved
        const updatedDescriptions = retriggeredResult.state.descriptions || [];
        const lockedDescriptions = updatedDescriptions.filter(d => d.locked);
        expect(lockedDescriptions.map(d => d.text)).toContain("User-written description for their product");

        // Verify Rails DB has the final state after retrigger
        const dbHeadlines = await queryDbHeadlines(campaignId);
        const activeGraphHeadlines = updatedHeadlines.filter(h => !h.rejected);
        expect(dbHeadlines.length).toEqual(activeGraphHeadlines.length);

        // DB should contain the user's custom headlines
        const dbTexts = dbHeadlines.map(h => h.text);
        expect(dbTexts).toContain("My Custom Headline");
        expect(dbTexts).toContain("Another User Edit");

        // DB should also contain the user's custom description
        const dbDescriptions = await queryDbDescriptions(campaignId);
        const dbDescTexts = dbDescriptions.map(d => d.text);
        expect(dbDescTexts).toContain("User-written description for their product");
      });

      it("handles user adding new assets and retriggering via refresh", async () => {
        // Step 1: Graph generates initial content
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("content"),
          })
          .execute();

        const campaignId = result.state.campaignId!;
        expect(result.state.headlines?.length).toEqual(6);

        // Step 2: User adds a custom headline and locks existing ones
        const headlines = [...(result.state.headlines as Ads.Asset[])];
        const userHeadline: Ads.Asset = {
          id: uuid(),
          text: "User-Created Headline",
          locked: true,
          rejected: false,
        };
        // Lock 2 existing + add 1 new = 3 locked
        headlines[0]!.locked = true;
        headlines[1]!.locked = true;
        headlines.push(userHeadline);

        // Mark remaining unlocked as rejected (refresh pattern)
        const refreshHeadlines = headlines.map(h => ({
          ...h,
          rejected: h.locked ? false : true,
        }));
        const numLocked = refreshHeadlines.filter(h => h.locked).length;

        // Step 3: User triggers refresh with their modifications
        const refreshedResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            headlines: refreshHeadlines,
            intent: refreshAssets("content", [
              { asset: "headlines", nVariants: 6 - numLocked },
            ]),
          })
          .execute();

        const updatedHeadlines = refreshedResult.state.headlines || [];

        // All 3 locked headlines are preserved (including user-created)
        const lockedInResult = updatedHeadlines.filter(h => h.locked);
        expect(lockedInResult.length).toEqual(3);
        expect(lockedInResult.map(h => h.text)).toContain("User-Created Headline");

        // New headlines were generated to fill the remaining slots
        const newActiveHeadlines = updatedHeadlines.filter(h => !h.locked && !h.rejected);
        expect(newActiveHeadlines.length).toEqual(6 - numLocked);

        // Total active (non-rejected) headlines = locked + new
        const activeHeadlines = updatedHeadlines.filter(h => !h.rejected);
        expect(activeHeadlines.length).toEqual(6);

        // Verify Rails DB reflects the final state
        const dbHeadlines = await queryDbHeadlines(campaignId);
        expect(dbHeadlines.length).toEqual(6); // Only active headlines saved

        // DB should contain user-created headline
        const dbTexts = dbHeadlines.map(h => h.text);
        expect(dbTexts).toContain("User-Created Headline");

        // DB should contain the 2 locked original headlines
        expect(dbTexts).toContain(headlines[0]!.text);
        expect(dbTexts).toContain(headlines[1]!.text);
      });
    });

    describe("Highlights Stage", () => {
      it("automatically populates callouts and structured snippets on highlights stage", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("highlights"),
          })
          .execute();

        expect(result.state.callouts?.length).toEqual(6);
        expect(result.state.structuredSnippets).toBeDefined();
        expect(result.state.structuredSnippets?.category).toBeDefined();
        expect(result.state.structuredSnippets?.details?.length).toBeGreaterThanOrEqual(3);

        const lastMessage = result.state.messages?.at(-1) as AIMessage;
        const message = getTextData(lastMessage);

        expect(message).toMatch(/unique features|spell out|real estate|callout|snippet|compelling|stand out/i);
        expect(message).not.toContain("```json");

        const callouts = result.state.callouts || [];
        expect(callouts.length).toEqual(Ads.DefaultNumAssets.callouts);

        const structuredSnippets = result.state.structuredSnippets;
        expect(structuredSnippets).toBeDefined();
        expect(structuredSnippets?.category).toBeOneOf([...Ads.StructuredSnippetCategoryKeys]);
        expect(structuredSnippets?.details?.length).toEqual(
          Ads.DefaultNumAssets.structuredSnippets
        );

        // Verify callouts were persisted to Rails DB
        const campaignId = result.state.campaignId;
        expect(campaignId).toBeDefined();
        const dbCallouts = await queryDbCallouts(campaignId!);
        expect(dbCallouts.length).toEqual(6);

        const graphCalloutTexts = callouts
          .filter(c => !c.rejected)
          .map(c => c.text)
          .sort();
        const dbCalloutTexts = dbCallouts.map(c => c.text).sort();
        expect(dbCalloutTexts).toEqual(graphCalloutTexts);
      });

      it("refreshes only callouts, when using refresh intent", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("highlights"),
          })
          .execute();

        expect(result.state.callouts?.length).toEqual(6);

        const callouts = result.state.callouts as Ads.Asset[];
        if (!callouts[0] || !callouts[1]) {
          throw new Error("Not enough callouts available for testing");
        }

        if (!result.state.structuredSnippets?.details) {
          throw new Error("Structured snippet details not available for testing");
        }

        callouts[0].text = `Free Consultations`;
        callouts[1].text = `24/7 Support`;
        callouts[0].locked = true;
        callouts[1].locked = true;

        const refreshedResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            threadId,
            intent: refreshAssets("highlights", [{ asset: "callouts", nVariants: 3 }]),
          })
          .execute();

        if (!refreshedResult.state.structuredSnippets?.details) {
          throw new Error("Refreshed structured snippet details not available");
        }

        if (!refreshedResult.state.callouts) {
          throw new Error("Refreshed callouts not available");
        }

        const originalNonLockedCallouts = callouts.filter((c) => !c.locked);
        const refreshedCalloutsFromOriginal = refreshedResult.state.callouts?.filter((c) =>
          originalNonLockedCallouts.some((orig) => orig.text === c.text)
        );
        expect(refreshedCalloutsFromOriginal?.every((c) => c.rejected)).toBe(true);

        const lockedCallouts = refreshedResult.state.callouts?.filter((c) => c.locked);
        expect(lockedCallouts?.every((c) => !c.rejected)).toBe(true);

        const newCallouts = Ads.diffAssets(callouts, refreshedResult.state.callouts);
        expect(newCallouts.length).toBeGreaterThan(0);
        expect(newCallouts.length).toBeLessThan(4);

        const newSnippets = Ads.diffAssets(
          result.state.structuredSnippets.details,
          refreshedResult.state.structuredSnippets.details
        );
        expect(newSnippets).toBeDefined();
        expect(Array.isArray(newSnippets)).toBe(true);
        expect(newSnippets.length).toEqual(0); // Should have no new snippets (same data)

        // It generates a very simple message when regenerating callouts
        expect(refreshedResult.state.messages?.length).toBeGreaterThan(
          result.state.messages?.length || 0
        );
      });

      it("refreshes only snippets, when using refresh intent", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("highlights"),
          })
          .execute();

        expect(result.state.callouts?.length).toEqual(6);

        const callouts = result.state.callouts as Ads.Asset[];
        if (!callouts[0] || !callouts[1]) {
          throw new Error("Not enough callouts available for testing");
        }

        if (!result.state.structuredSnippets?.details) {
          throw new Error("Structured snippet details not available for testing");
        }

        const refreshedResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            projectUUID,
            intent: refreshAssets("highlights", [{ asset: "structuredSnippets", nVariants: 1 }]),
            callouts: result.state.callouts,
            structuredSnippets: result.state.structuredSnippets,
          })
          .execute();

        if (!refreshedResult.state.structuredSnippets?.details) {
          throw new Error("Refreshed structured snippet details not available");
        }

        if (!refreshedResult.state.callouts) {
          throw new Error("Refreshed callouts not available");
        }

        const newCallouts = Ads.diffAssets(callouts, refreshedResult.state.callouts);
        expect(newCallouts.length).toEqual(0); // Should generate 0 new callouts (same data)

        const newSnippets = Ads.diffAssets(
          result.state.structuredSnippets.details,
          refreshedResult.state.structuredSnippets.details
        );
        expect(newSnippets).toBeDefined();
        expect(Array.isArray(newSnippets)).toBe(true);
        expect(newSnippets.length).toEqual(1); // Should have 1 new snippet (nVariants=1 from refresh)
      });
    });

    describe("Keywords Stage", () => {
      it("automatically populates keywords on keywords stage", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("keywords"),
          })
          .execute();

        expect(result.state.keywords?.length).toEqual(8);

        const lastMessage = result.state.messages?.at(-1) as AIMessage;
        const keywords = result.state.keywords;
        const message = getTextData(lastMessage);

        expect(message).toMatch(/keywords|searching|audience/i);
        expect(message).not.toContain("```json");

        if (!keywords || !keywords[0]) {
          throw new Error("Keywords are undefined or empty");
        }
        expect(keywords.length).toEqual(Ads.DefaultNumAssets.keywords);
        expect(keywords[0].text).toBeDefined();
      });

      it("refreshes keywords", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("keywords"),
          })
          .execute();

        expect(result.state.keywords?.length).toEqual(8);

        const keywords = result.state.keywords as Ads.Asset[];
        if (!keywords[0] || !keywords[1] || !keywords[2]) {
          throw new Error("Not enough keywords available for testing");
        }

        keywords[0].text = `pet photography`;
        keywords[1].text = `dog portraits`;
        keywords[2].text = `cat photos`;
        keywords[0].locked = true;
        keywords[1].locked = true;
        keywords[2].locked = true;

        const refreshedResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...result.state,
            intent: refreshAssets("keywords", [{ asset: "keywords", nVariants: 4 }]),
            keywords: result.state.keywords,
          })
          .execute();
        if (!refreshedResult.state.keywords) {
          throw new Error("Refreshed keywords are undefined");
        }

        const originalNonLockedKeywords = keywords.filter((k) => !k.locked);
        const refreshedKeywordsFromOriginal = refreshedResult.state.keywords?.filter((k) =>
          originalNonLockedKeywords.some((orig) => orig.text === k.text)
        );
        expect(refreshedKeywordsFromOriginal?.every((k) => k.rejected)).toBe(true);

        const lockedKeywords = refreshedResult.state.keywords?.filter((k) => k.locked);
        expect(lockedKeywords?.every((k) => !k.rejected)).toBe(true);

        const newKeywords = Ads.diffAssets(keywords, refreshedResult.state.keywords);
        expect(newKeywords).toBeDefined();
        expect(Array.isArray(newKeywords)).toBe(true);
        expect(newKeywords.length).toEqual(4);
      });
    });

    describe("Settings Stage", () => {
      it("answers questions during settings section", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            stage: "settings",
            messages: [new HumanMessage(`What happens after this?`)],
          })
          .execute();

        const response = result.state.messages.at(-1);
        expect(response).toBeDefined();
        expect(response?.content).toBeDefined();
        expect(response!.content).toMatch(
          /what happens next|measure results|iterate|pause underperforming ads|adjust your budget|launch/i
        );
      });

      it("doesn't generate any assets during settings stage", async () => {
        const keywordsResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("keywords"),
          })
          .execute();

        const keywordsMessage = keywordsResult.state.messages.at(-1);
        expect(keywordsMessage).toBeDefined();

        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...keywordsResult.state,
            intent: switchPage("settings"),
          })
          .execute();

        const response = result.state.messages.at(-1);
        if (!response) {
          throw new Error("No response generated");
        }

        // It DOES NOT generate a new response
        expect(response.content).toEqual(keywordsMessage?.content);
        expect(result.state.messages.length).toEqual(keywordsResult.state.messages.length);
      });
    });

    describe("Launch Stage", () => {
      it("answers questions during launch section", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            stage: "launch",
            messages: [new HumanMessage(`How long until my ads go live?`)],
          })
          .execute();

        const response = result.state.messages.at(-1);
        expect(response).toBeDefined();
        expect(response?.content).toBeDefined();
        expect(response!.content).toMatch(/review|approval|live|hour|day|submit/i);
      });

      it("doesn't generate any assets during launch stage", async () => {
        const keywordsResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("keywords"),
          })
          .execute();

        const keywordsMessage = keywordsResult.state.messages.at(-1);
        expect(keywordsMessage).toBeDefined();

        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...keywordsResult.state,
            intent: switchPage("launch"),
          })
          .execute();

        const response = result.state.messages.at(-1);
        if (!response) {
          throw new Error("No response generated");
        }

        // It DOES NOT generate a new response
        expect(response.content).toEqual(keywordsMessage?.content);
        expect(result.state.messages.length).toEqual(keywordsResult.state.messages.length);
      });
    });

    describe("Review Stage", () => {
      it("answers questions during review section", async () => {
        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            stage: "review",
            messages: [new HumanMessage(`Can I change my ads after they're live?`)],
          })
          .execute();

        const response = result.state.messages.at(-1);
        expect(response).toBeDefined();
        expect(response?.content).toBeDefined();
        expect(response!.content).toMatch(/change|edit|modify|update|pause|adjust/i);
      });

      it("doesn't generate any assets during review stage", async () => {
        const keywordsResult = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            projectUUID,
            threadId,
            intent: switchPage("keywords"),
          })
          .execute();

        const keywordsMessage = keywordsResult.state.messages.at(-1);
        expect(keywordsMessage).toBeDefined();

        const result = await testGraph<AdsGraphState>()
          .withGraph(adsGraph)
          .withState({
            ...keywordsResult.state,
            intent: switchPage("review"),
          })
          .execute();

        const response = result.state.messages.at(-1);
        if (!response) {
          throw new Error("No response generated");
        }

        // It DOES NOT generate a new response
        expect(response.content).toEqual(keywordsMessage?.content);
        expect(result.state.messages.length).toEqual(keywordsResult.state.messages.length);
      });
    });
  });

  describe("Full workflow - multi-stage with state persistence", () => {
    it("maintains context across content -> highlights -> keywords stages with refreshes", async () => {
      // Step 1: Generate initial headlines and descriptions on content stage
      const contentResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          projectUUID,
          threadId,
          intent: switchPage("content"),
        })
        .execute();

      expect(contentResult.state.headlines?.length).toEqual(6);
      expect(contentResult.state.descriptions?.length).toEqual(4);

      // User locks some headlines they like
      const headlines = contentResult.state.headlines as Ads.Asset[];
      headlines[0]!.locked = true;
      headlines[1]!.locked = true;

      // Lock some descriptions
      const descriptions = contentResult.state.descriptions as Ads.Asset[];
      descriptions[0]!.locked = true;

      // Step 2: Refresh headlines (user wants more options)
      const refreshHeadlinesResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...contentResult.state,
          intent: refreshAssets("content", [{ asset: "headlines", nVariants: 3 }]),
        })
        .execute();

      const newHeadlines = Ads.diffAssets(headlines, refreshHeadlinesResult.state.headlines!);
      expect(newHeadlines.length).toBeGreaterThan(0);
      expect(refreshHeadlinesResult.state.messages?.length).toBeGreaterThan(
        contentResult.state.messages?.length || 0
      );

      // Verify non-locked headlines were auto-rejected, but descriptions unchanged
      const originalNonLockedHeadlines = headlines.filter((h) => !h.locked);
      const rejectedFromOriginal = refreshHeadlinesResult.state.headlines?.filter((h) =>
        originalNonLockedHeadlines.some((orig) => orig.text === h.text)
      );
      expect(rejectedFromOriginal?.every((h) => h.rejected)).toBe(true);
      expect(refreshHeadlinesResult.state.descriptions).toEqual(contentResult.state.descriptions);

      // User locks one more headline
      const updatedHeadlines = refreshHeadlinesResult.state.headlines as Ads.Asset[];
      const unlockedHeadline = updatedHeadlines.find((h) => !h.locked && !h.rejected);
      if (unlockedHeadline) unlockedHeadline.locked = true;

      // Step 3: Navigate to highlights stage - pass along locked headlines/descriptions
      const highlightsResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...refreshHeadlinesResult.state,
          intent: switchPage("highlights"),
        })
        .execute();

      expect(highlightsResult.state.callouts?.length).toEqual(6);
      expect(highlightsResult.state.structuredSnippets).toBeDefined();
      expect(highlightsResult.state.structuredSnippets?.details?.length).toBeGreaterThanOrEqual(3);

      // Verify headlines and descriptions are preserved
      expect(highlightsResult.state.headlines).toEqual(refreshHeadlinesResult.state.headlines);
      expect(highlightsResult.state.descriptions).toEqual(
        refreshHeadlinesResult.state.descriptions
      );

      // User locks some callouts
      const callouts = highlightsResult.state.callouts as Ads.Asset[];
      callouts[0]!.locked = true;
      callouts[1]!.locked = true;

      // Step 4: Refresh callouts
      const refreshCalloutsResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...highlightsResult.state,
          intent: refreshAssets("highlights", [{ asset: "callouts", nVariants: 2 }]),
        })
        .execute();

      const newCallouts = Ads.diffAssets(callouts, refreshCalloutsResult.state.callouts!);
      expect(newCallouts.length).toBeGreaterThan(0);

      // Verify non-locked callouts were auto-rejected
      const originalNonLockedCallouts = callouts.filter((c) => !c.locked);
      const rejectedCalloutsFromOriginal = refreshCalloutsResult.state.callouts?.filter((c) =>
        originalNonLockedCallouts.some((orig) => orig.text === c.text)
      );
      expect(rejectedCalloutsFromOriginal?.every((c) => c.rejected)).toBe(true);

      // Verify structured snippets unchanged
      expect(refreshCalloutsResult.state.structuredSnippets).toEqual(
        highlightsResult.state.structuredSnippets
      );

      // Step 5: Navigate to keywords stage
      const keywordsResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...refreshCalloutsResult.state,
          intent: switchPage("keywords"),
        })
        .execute();

      expect(keywordsResult.state.keywords?.length).toEqual(8);

      // Verify all previous assets are preserved
      expect(keywordsResult.state.headlines).toEqual(refreshCalloutsResult.state.headlines);
      expect(keywordsResult.state.descriptions).toEqual(refreshCalloutsResult.state.descriptions);
      expect(keywordsResult.state.callouts).toEqual(refreshCalloutsResult.state.callouts);
      expect(keywordsResult.state.structuredSnippets).toEqual(
        refreshCalloutsResult.state.structuredSnippets
      );

      // User locks some keywords
      const keywords = keywordsResult.state.keywords as Ads.Asset[];
      keywords[0]!.locked = true;
      keywords[1]!.locked = true;

      // Step 6: Refresh keywords
      const refreshKeywordsResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...keywordsResult.state,
          intent: refreshAssets("keywords", [{ asset: "keywords", nVariants: 3 }]),
        })
        .execute();

      const newKeywords = Ads.diffAssets(keywords, refreshKeywordsResult.state.keywords!);
      expect(newKeywords.length).toBeGreaterThan(0);

      // Verify non-locked keywords were auto-rejected
      const originalNonLockedKeywords = keywords.filter((k) => !k.locked);
      const rejectedKeywordsFromOriginal = refreshKeywordsResult.state.keywords?.filter((k) =>
        originalNonLockedKeywords.some((orig) => orig.text === k.text)
      );
      expect(rejectedKeywordsFromOriginal?.every((k) => k.rejected)).toBe(true);

      // Verify message history has grown throughout the workflow
      expect(refreshKeywordsResult.state.messages?.length).toBeGreaterThan(5);

      // Verify all assets are related to the business context (scheduling tool)
      const allLockedHeadlines =
        refreshKeywordsResult.state.headlines?.filter((h) => h.locked).map((h) => h.text) || [];
      const allLockedCallouts =
        refreshKeywordsResult.state.callouts?.filter((c) => c.locked).map((c) => c.text) || [];
      const allLockedKeywords =
        refreshKeywordsResult.state.keywords?.filter((k) => k.locked).map((k) => k.text) || [];

      const allContent = [...allLockedHeadlines, ...allLockedCallouts, ...allLockedKeywords]
        .join(" ")
        .toLowerCase();
      // Content should be related to the scheduling tool business context
      expect(allContent).toMatch(/schedul|meeting|time|calendar|team|coordinat/i);

      const followupQuestionResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...refreshKeywordsResult.state,
          refresh: undefined,
          messages: [
            ...refreshKeywordsResult.state.messages!,
            new HumanMessage(`What makes these keywords effective for a scheduling tool?`),
          ],
        })
        .execute();

      // Verify that no new assets were generated (only Q&A response)
      expect(followupQuestionResult.state.headlines).toEqual(refreshKeywordsResult.state.headlines);
      expect(followupQuestionResult.state.callouts).toEqual(refreshKeywordsResult.state.callouts);
      expect(followupQuestionResult.state.keywords).toEqual(refreshKeywordsResult.state.keywords);

      const lastMessage = followupQuestionResult.state.messages?.at(-1);
      expect(lastMessage).toBeDefined();
      expect((lastMessage as AIMessage).content).toMatch(
        /great question|search intent|specificity|commercial intent|solution-focused|intent signals|work because|effective because|scheduling|keyword/i
      );

      // Verify message history has grown
      expect(followupQuestionResult.state.messages?.length).toBeGreaterThan(
        refreshKeywordsResult.state.messages?.length
      );
    });
  });

  describe("Q&A flow", () => {
    it("answers question about how headlines and descriptions pair together without generating content", async () => {
      const result = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          projectUUID,
          threadId,
          stage: "content",
          messages: [new HumanMessage("How will Headlines and Details pair together?")],
        })
        .execute();

      const lastMessage = result.state.messages?.at(-1) as AIMessage;
      const message = getTextData(lastMessage);

      expect(message).toMatch(/google|automatically|combin/i);
      expect(result.state.headlines).toBeUndefined();
      expect(result.state.descriptions).toBeUndefined();
    });

    it("answers question about what descriptions are without generating content", async () => {
      const result = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          projectUUID,
          threadId,
          stage: "content",
          messages: [new HumanMessage("What are descriptions?")],
        })
        .execute();

      const lastMessage = result.state.messages?.at(-1) as AIMessage;
      const message = getTextData(lastMessage);

      // It answers about descriptions without generating assets
      expect(message).toMatch(/description|text|headline|ad|character/i);
      expect(result.state.headlines).toBeUndefined();
      expect(result.state.descriptions).toBeUndefined();
    });

    it("answers question about seeing preferred headlines in preview without generating content", async () => {
      const result = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          projectUUID,
          threadId,
          stage: "content",
          messages: [new HumanMessage("Can I see my preferred headlines in the preview?")],
        })
        .execute();

      const lastMessage = result.state.messages?.at(-1) as AIMessage;
      const message = getTextData(lastMessage);

      expect(message.length).toBeGreaterThan(20);
      expect(result.state.headlines).toBeUndefined();
      expect(result.state.descriptions).toBeUndefined();
    });
  });

  describe("Intent-based page navigation", () => {
    it("preserves context messages in state for tracing (filtered at SDK layer)", async () => {
      // First generate content
      const contentResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          projectUUID,
          threadId,
          intent: switchPage("content"),
        })
        .execute();

      // Switch to highlights via intent
      const highlightsResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...contentResult.state,
          intent: switchPage("highlights"),
        })
        .execute();

      // Verify messages exist - context messages are preserved for tracing
      const messages = highlightsResult.state.messages || [];
      expect(messages.length).toBeGreaterThan(0);

      // Verify we can identify regular vs context messages
      const regularMessages = messages.filter((m) => !isContextMessage(m));
      expect(regularMessages.length).toBeGreaterThan(0);
    });

    it("generates new assets when switching from keywords back to highlights", async () => {
      const contentResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          projectUUID,
          threadId,
          intent: switchPage("content"),
        })
        .execute();

      const highlightsResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...contentResult.state,
          intent: switchPage("highlights"),
        })
        .execute();

      expect(highlightsResult.state.callouts!.length).toBeGreaterThan(0);
      expect(highlightsResult.state.previousStage).toBe("highlights");

      const keywordsResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...highlightsResult.state,
          intent: switchPage("keywords"),
        })
        .execute();

      expect(keywordsResult.state.keywords!.length).toBeGreaterThan(0);

      const highlightsResult2 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...highlightsResult.state,
          intent: switchPage("highlights"),
        })
        .withPrompt("Let's try these punchier")
        .execute();

      // it should change the callouts
      const newCallouts = highlightsResult2.state.callouts!.filter(
        (c) => !highlightsResult.state.callouts!.includes(c)
      );
      const oldSnippetDetails = highlightsResult.state.structuredSnippets!.details;
      const newSnippetDetails = highlightsResult2.state.structuredSnippets!.details.filter(
        (detail) => !oldSnippetDetails.map((sd) => sd.text).includes(detail.text)
      );

      expect(newCallouts.length).toBeGreaterThan(0);
      expect(newSnippetDetails.length).toBeGreaterThan(0);
    });

    it("refresh after navigating to a loaded page uses correct stage (edge case)", async () => {
      // Step 1: Generate content
      const contentResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          projectUUID,
          threadId,
          intent: switchPage("content"),
        })
        .execute();

      expect(contentResult.state.headlines?.length).toEqual(6);

      // Step 2: Generate highlights
      const highlightsResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...contentResult.state,
          intent: switchPage("highlights"),
        })
        .execute();

      expect(highlightsResult.state.callouts?.length).toEqual(6);

      // Step 3: Generate keywords
      const keywordsResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...highlightsResult.state,
          intent: switchPage("keywords"),
        })
        .execute();

      expect(keywordsResult.state.keywords?.length).toEqual(8);
      // After keywords run, previousStage = "keywords"
      expect(keywordsResult.state.previousStage).toBe("keywords");

      // Step 4: User navigates back to highlights (already loaded — no graph run).
      // Then clicks "Refresh callouts".
      // The frontend sends a refreshAssets intent with stage="highlights"
      const callouts = keywordsResult.state.callouts as Ads.Asset[];
      callouts[0]!.locked = true;
      callouts[1]!.locked = true;

      const refreshResult = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...keywordsResult.state,
          intent: refreshAssets("highlights", [{ asset: "callouts", nVariants: 3 }]),
        })
        .execute();

      // handleIntent should have set stage to "highlights"
      expect(refreshResult.state.stage).toBe("highlights");
      expect(refreshResult.state.previousStage).toBe("highlights");

      // It should have generated NEW callouts (not keywords)
      const newCallouts = Ads.diffAssets(callouts, refreshResult.state.callouts!);
      expect(newCallouts.length).toBeGreaterThan(0);

      // Locked callouts should be preserved
      const lockedCallouts = refreshResult.state.callouts?.filter((c) => c.locked);
      expect(lockedCallouts?.length).toEqual(2);

      // Keywords should be unchanged (we refreshed callouts, not keywords)
      expect(refreshResult.state.keywords).toEqual(keywordsResult.state.keywords);
    });
  });

  describe("Walking the frontend", () => {
    const tag = tagMessage;
    const assertTypes = assertMessageTypes;

    /**
     * After Conversation prepareTurn (what the agent actually uses),
     * verify order is still preserved and no bunching occurs.
     */
    const assertWindowingPreservesOrder = (msgs: any[], label: string) => {
      const conv = new Conversation(msgs);
      const windowed = conv.prepareTurn({ maxTurnPairs: 4, maxChars: 20_000 });
      assertNoBunching(windowed, `${label} (windowed)`);
    };

    it("persists message history correctly across 10 graph invocations", async () => {
      // ─── Step 1: Content auto-init ─────────────────────────────
      const step1 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          projectUUID,
          threadId,
          intent: switchPage("content"),
        })
        .execute();

      expect(step1.state.headlines?.length).toEqual(6);
      expect(step1.state.descriptions?.length).toEqual(4);

      const msgs1 = step1.state.messages!;
      assertTypes(msgs1, ["CTX", "AI"], "step1: content auto-init");
      assertNoBunching(msgs1, "step1");

      // ─── Step 2: User feedback on content ──────────────────────
      const step2 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...step1.state,
          messages: [
            ...step1.state.messages!,
            new HumanMessage("Can you make these funnier?"),
          ],
        })
        .execute();

      const msgs2 = step2.state.messages!;
      assertTypes(msgs2, ["CTX", "AI", "CTX", "HUMAN", "AI"], "step2: user feedback");
      assertNoBunching(msgs2, "step2");
      assertWindowingPreservesOrder(msgs2, "step2");

      // THE FIX: verify the LLM sees CTX before HUMAN (not the state order)
      // Simulate what happens when the next user-feedback turn runs:
      // the agent builds context and injects it via prepareTurn({ contextMessages }).
      assertCtxBeforeHumanInLLMView(
        [...msgs2, new HumanMessage("follow-up")],
        createContextMessage("[[SYSTEM]] mock context for user feedback"),
        "step2: LLM view"
      );

      // ─── Step 3: Refresh headlines ─────────────────────────────
      // Frontend pattern: user locks 2 favorites, clicks "Refresh All".
      // createRefreshHandler marks non-locked as rejected, sends both
      // the modified assets AND the intent in a single updateState call.
      const step2Headlines = step2.state.headlines!;
      const refreshHeadlines = step2Headlines.map((h, i) => ({
        ...h,
        locked: i < 2,                // lock first 2 as favorites
        rejected: i >= 2,             // mark the rest as rejected
      }));
      const numLockedHeadlines = refreshHeadlines.filter((h) => h.locked).length;

      const step3 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...step2.state,
          headlines: refreshHeadlines,
          intent: refreshAssets("content", [
            { asset: "headlines", nVariants: 6 - numLockedHeadlines },
          ]),
        })
        .execute();

      const msgs3 = step3.state.messages!;
      assertTypes(
        msgs3,
        ["CTX", "AI", "CTX", "HUMAN", "AI", "CTX", "AI"],
        "step3: refresh headlines"
      );
      assertNoBunching(msgs3, "step3");
      assertWindowingPreservesOrder(msgs3, "step3");

      // ─── Step 4: Switch to highlights ──────────────────────────
      const step4 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...step3.state,
          intent: switchPage("highlights"),
        })
        .execute();

      expect(step4.state.callouts?.length).toEqual(6);

      const msgs4 = step4.state.messages!;
      assertTypes(
        msgs4,
        ["CTX", "AI", "CTX", "HUMAN", "AI", "CTX", "AI", "CTX", "AI"],
        "step4: switch to highlights"
      );
      assertNoBunching(msgs4, "step4");
      assertWindowingPreservesOrder(msgs4, "step4");

      // ─── Step 5: User feedback on highlights ───────────────────
      const step5 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...step4.state,
          messages: [
            ...step4.state.messages!,
            new HumanMessage("Let's make these more punchy."),
          ],
        })
        .execute();

      const msgs5 = step5.state.messages!;
      assertTypes(
        msgs5,
        ["CTX", "AI", "CTX", "HUMAN", "AI", "CTX", "AI", "CTX", "AI", "CTX", "HUMAN", "AI"],
        "step5: user feedback on highlights"
      );
      assertNoBunching(msgs5, "step5");
      assertWindowingPreservesOrder(msgs5, "step5");
      assertCtxBeforeHumanInLLMView(
        [...msgs5, new HumanMessage("follow-up")],
        createContextMessage("[[SYSTEM]] mock context for user feedback"),
        "step5: LLM view"
      );

      // ─── Step 6: Refresh callouts ──────────────────────────────
      // Same frontend pattern: lock 2, mark rest rejected
      const step5Callouts = step5.state.callouts!;
      const refreshCallouts = step5Callouts.map((c, i) => ({
        ...c,
        locked: i < 2,
        rejected: i >= 2,
      }));
      const numLockedCallouts = refreshCallouts.filter((c) => c.locked).length;

      const step6 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...step5.state,
          callouts: refreshCallouts,
          intent: refreshAssets("highlights", [
            { asset: "callouts", nVariants: 6 - numLockedCallouts },
          ]),
        })
        .execute();

      const msgs6 = step6.state.messages!;
      // Previous 12 + CTX + AI = 14
      assertTypes(
        msgs6,
        [
          "CTX", "AI", "CTX", "HUMAN", "AI", "CTX", "AI",
          "CTX", "AI", "CTX", "HUMAN", "AI", "CTX", "AI",
        ],
        "step6: refresh callouts"
      );
      assertNoBunching(msgs6, "step6");
      assertWindowingPreservesOrder(msgs6, "step6");

      // ─── Step 7: Switch to keywords ────────────────────────────
      const step7 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...step6.state,
          intent: switchPage("keywords"),
        })
        .execute();

      expect(step7.state.keywords?.length).toEqual(8);

      const msgs7 = step7.state.messages!;
      // Previous 14 + CTX + AI = 16
      expect(msgs7.length).toEqual(16);
      assertNoBunching(msgs7, "step7");
      assertWindowingPreservesOrder(msgs7, "step7");
      // Last two messages: CTX (keywords auto-init) then AI
      expect(tag(msgs7[msgs7.length - 2]!)).toEqual("CTX");
      expect(tag(msgs7[msgs7.length - 1]!)).toEqual("AI");

      // ─── Step 8: User feedback on keywords ─────────────────────
      const step8 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...step7.state,
          messages: [
            ...step7.state.messages!,
            new HumanMessage("Let's make these more punchy."),
          ],
        })
        .execute();

      const msgs8 = step8.state.messages!;
      // Previous 16 + HUMAN + CTX + AI = 19
      expect(msgs8.length).toEqual(19);
      assertNoBunching(msgs8, "step8");
      assertWindowingPreservesOrder(msgs8, "step8");
      // Last three: CTX, HUMAN, AI (context precedes human for the LLM)
      expect(tag(msgs8[msgs8.length - 3]!)).toEqual("CTX");
      expect(tag(msgs8[msgs8.length - 2]!)).toEqual("HUMAN");
      expect(tag(msgs8[msgs8.length - 1]!)).toEqual("AI");
      assertCtxBeforeHumanInLLMView(
        [...msgs8, new HumanMessage("follow-up")],
        createContextMessage("[[SYSTEM]] mock context for user feedback"),
        "step8: LLM view"
      );

      // ─── Step 9: Refresh keywords ──────────────────────────────
      // Same frontend pattern: lock 2, mark rest rejected
      const step8Keywords = step8.state.keywords!;
      const refreshKeywords = step8Keywords.map((k, i) => ({
        ...k,
        locked: i < 2,
        rejected: i >= 2,
      }));
      const numLockedKeywords = refreshKeywords.filter((k) => k.locked).length;

      const step9 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...step8.state,
          keywords: refreshKeywords,
          intent: refreshAssets("keywords", [
            { asset: "keywords", nVariants: 8 - numLockedKeywords },
          ]),
        })
        .execute();

      const msgs9 = step9.state.messages!;
      // Previous 19 + CTX + AI = 21
      expect(msgs9.length).toEqual(21);
      assertNoBunching(msgs9, "step9");
      assertWindowingPreservesOrder(msgs9, "step9");

      // ─── Step 10: Back to content (already loaded → exits early) ──
      const step10 = await testGraph<AdsGraphState>()
        .withGraph(adsGraph)
        .withState({
          ...step9.state,
          intent: switchPage("content"),
        })
        .execute();

      const msgs10 = step10.state.messages!;
      // Guardrails should exit early: hasStartedStep.content=true, headlines exist
      // Messages should be UNCHANGED from step 9
      expect(msgs10.length).toEqual(msgs9.length);
      assertNoBunching(msgs10, "step10");

      // ─── Final verification: the FULL timeline has ZERO bunching ──
      // This is the definitive check. After 10 graph invocations spanning
      // 3 pages, 3 user messages, 3 refreshes, and a back-navigation,
      // context messages must NEVER bunch up.
      const allTags = msgs10.map(tag);
      const ctxIndices = allTags
        .map((t, i) => (t === "CTX" ? i : -1))
        .filter((i) => i !== -1);
      const aiIndices = allTags
        .map((t, i) => (t === "AI" ? i : -1))
        .filter((i) => i !== -1);
      const humanIndices = allTags
        .map((t, i) => (t === "HUMAN" ? i : -1))
        .filter((i) => i !== -1);

      // 10 CTX messages: 3 auto-inits + 3 user-feedback contexts + 3 refresh contexts + 1 back-nav... actually step10 exits early so 9 CTX
      expect(ctxIndices.length).toBeGreaterThanOrEqual(9);
      // 9 AI responses (step10 exits early, no new AI)
      expect(aiIndices.length).toBeGreaterThanOrEqual(9);
      // 3 user messages
      expect(humanIndices.length).toEqual(3);

      // Every CTX is followed by either AI or HUMAN (never another CTX)
      for (const idx of ctxIndices) {
        if (idx < allTags.length - 1) {
          const next = allTags[idx + 1];
          expect(
            next === "AI" || next === "HUMAN",
            `CTX at [${idx}] followed by ${next} at [${idx + 1}] — expected AI or HUMAN.\n` +
              `Timeline:\n${dumpTimeline(msgs10)}`
          ).toBe(true);
        }
      }

      // ─── Final LLM-view check ─────────────────────────────────
      // Simulate one more user-feedback turn on the full 10-step history.
      // The LLM must see CTX before the last HUMAN.
      assertCtxBeforeHumanInLLMView(
        [...msgs10, new HumanMessage("final follow-up")],
        createContextMessage("[[SYSTEM]] final mock context"),
        "step10: final LLM view"
      );
    });
  });
});
