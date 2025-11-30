import { describe, it, expect, beforeEach } from 'vitest';
import { testGraph } from '@support';
import { type AdsGraphState } from '@state';
import { adsGraph as uncompiledGraph } from '@graphs';
import { graphParams } from '@core';
import { DatabaseSnapshotter } from '@services';
import { db, projects as projectsTable } from '@db';
import { type UUIDType, Ads } from '@types';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

const adsGraph = uncompiledGraph.compile({ ...graphParams, name: "ads" }); 

const getTextData = (message: AIMessage): string => {
    return (message.response_metadata?.parsed_blocks as any[] || [])
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.sourceText)
        .join('\n') || '';
}

const getStateData = (message: AIMessage) => {
    return (message?.response_metadata?.parsed_blocks as any[] || [])
        .filter((block: any) => block.type === 'structured')
        .map((block: any) => block.parsed)
        .at(-1) || {};
}

describe.sequential('Ads Flow', () => {
    let projectUUID: UUIDType;

    beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("campaign_created");
        projectUUID = await db.select().from(projectsTable).limit(1).execute().then((res) => {
            if (!res[0]) {
                throw new Error("No projects found");
            }
            return res[0]!.uuid as UUIDType;
        });
    }, 2000)

    describe("Chat flow", () => {
        it("automatically populates headlines and descriptions", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "content"
                })
                .execute();

            expect(result.state.headlines?.length).toEqual(6);
            expect(result.state.descriptions?.length).toEqual(4);
            
            const lastMessage = result.state.messages?.at(-1) as AIMessage;
            const stateData = getStateData(lastMessage);
            const message = getTextData(lastMessage);

            expect(stateData).toBeDefined();
            expect(message).toMatch(/start building|drafted a few headlines/);
            expect(message).not.toContain("```json");

            const headlines = stateData.headlines || [];
            const headlineContent = headlines.join('\n');

            // Headlines relate to the campaign copy
            expect(headlineContent).toMatch(/scheduling|schedule/i);

            const descriptions = stateData.descriptions || [];
            const descriptionContent = descriptions.join('\n');

            // Descriptions also relate to the campaign copy
            expect(descriptionContent).toMatch(/schedule|scheduling|meeting times/i);
        });

        it("refreshes only the specified context (headlines), not descriptions", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "content"
                })
                .execute();

            expect(result.state.headlines?.length).toEqual(6);
            expect(result.state.descriptions?.length).toEqual(4);
            
            const headlines = result.state.headlines as Ads.Asset[];
            if (!headlines[0] || !headlines[1] || !headlines[2]) {
                throw new Error("Not enough headlines available for testing");
            }

            headlines[0].text = `Sync or swim.`
            headlines[1].text = `This could've been an email.`;
            headlines[2].text = `Calendar Tetris champion.`;

            headlines[0].locked = true;
            headlines[1].locked = true;
            headlines[2].locked = true;

            const originalDescriptions = result.state.descriptions;
            
            const refreshedResult = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "content",
                    refresh: {
                        asset: "headlines",
                        nVariants: 2
                    },
                    headlines: result.state.headlines,
                    descriptions: result.state.descriptions
                })
                .execute();

            const originalUnlockedHeadlines = headlines.filter(h => !h.locked);
            const refreshedUnlockedHeadlines = refreshedResult.state.headlines?.filter(
                h => originalUnlockedHeadlines.some(orig => orig.text === h.text)
            );
            const rejectedHeadlines = refreshedUnlockedHeadlines?.filter(h => h.rejected);
            // Important: We implicitly reject any headline that wasn't locked
            expect(refreshedUnlockedHeadlines?.every(h => h.rejected)).toBe(true);

            const lockedHeadlines = refreshedResult.state.headlines?.filter(h => h.locked);
            expect(lockedHeadlines?.every(h => !h.rejected)).toBe(true);
                
            const newHeadlines = refreshedResult.state.headlines?.filter(h => !h.rejected && !h.locked);
            expect(newHeadlines?.length).toEqual(2); // 2 new headlines

            expect(refreshedResult.state.descriptions).toEqual(originalDescriptions);
        });

        it("specifically refreshes headlines using suggestions from the user", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "content",
                })
                .execute();

            const refreshedResult = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    ...result.state,
                    messages: [
                        ...result.messages,
                        new HumanMessage("I want more playful, funny headlines")
                    ]
                })
                .execute();
                
            const allHeadlines = refreshedResult.state.headlines || [];
            const originalHeadlines = result.state.headlines || [];
            const originalTexts = new Set(originalHeadlines.map(h => h.text));
            
            const rejectedHeadlines = allHeadlines.filter(h => h.rejected);
            const newHeadlines = allHeadlines.filter(h => !h.rejected);
            
            expect(originalHeadlines.length).toEqual(6);
            expect(allHeadlines.length).toEqual(12);
            expect(rejectedHeadlines.length).toEqual(6);
            expect(newHeadlines.length).toEqual(6);
            expect(rejectedHeadlines.every(h => originalTexts.has(h.text))).toBe(true);
            expect(newHeadlines.every(h => !originalTexts.has(h.text))).toBe(true);
        });

        it("automatically populates callouts and structured snippets on highlights stage", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "highlights"
                })
                .execute();

            expect(result.state.callouts?.length).toEqual(6);
            expect(result.state.structuredSnippets).toBeDefined();
            expect(result.state.structuredSnippets?.category).toBeDefined();
            expect(result.state.structuredSnippets?.details?.length).toBeGreaterThanOrEqual(3);
            
            const lastMessage = result.state.messages?.at(-1) as AIMessage;
            const stateData = getStateData(lastMessage);
            const message = getTextData(lastMessage);

            expect(stateData).toBeDefined();
            expect(message).toMatch(/unique features|spell out|real estate/i);
            expect(message).not.toContain("```json");

            const callouts = stateData.callouts || [];
            expect(callouts.length).toEqual(Ads.DefaultNumAssets.callouts);

            const structuredSnippets = stateData.structuredSnippets;
            expect(structuredSnippets).toBeDefined();
            expect(structuredSnippets.category).toBeDefined();
            expect(structuredSnippets.details?.length).toEqual(Ads.DefaultNumAssets.structuredSnippets);
        });

        it("refreshes only callouts, when using refresh context", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "highlights"
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
                    refresh: {
                        asset: "callouts",
                        nVariants: 3
                    },
                })
                .execute();

            if (!refreshedResult.state.structuredSnippets?.details) {
                throw new Error("Refreshed structured snippet details not available");
            }

            if (!refreshedResult.state.callouts) {
                throw new Error("Refreshed callouts not available");
            }

            const originalNonLockedCallouts = callouts.filter(c => !c.locked);
            const refreshedCalloutsFromOriginal = refreshedResult.state.callouts?.filter(
                c => originalNonLockedCallouts.some(orig => orig.text === c.text)
            );
            expect(refreshedCalloutsFromOriginal?.every(c => c.rejected)).toBe(true);

            const lockedCallouts = refreshedResult.state.callouts?.filter(c => c.locked);
            expect(lockedCallouts?.every(c => !c.rejected)).toBe(true);

            const newCallouts = Ads.diffAssets(
                callouts,
                refreshedResult.state.callouts,
            )
            expect(newCallouts.length).toBeGreaterThan(0);
            expect(newCallouts.length).toBeLessThan(4);

            const newSnippets = Ads.diffAssets(
                result.state.structuredSnippets.details,
                refreshedResult.state.structuredSnippets.details,
            )
            expect(newSnippets).toBeDefined();
            expect(Array.isArray(newSnippets)).toBe(true);
            expect(newSnippets.length).toEqual(0); // Should have no new snippets (same data)

            // It generates a very simple message when regenerating callouts
            expect(refreshedResult.state.messages?.length).toBeGreaterThan(result.state.messages?.length || 0);
        });

        it("refreshes only snippets, when using refresh context", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "highlights"
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
                    projectUUID,
                    stage: "highlights",
                    refresh: {
                        asset: "structuredSnippets",
                        nVariants: 1
                    },
                    callouts: result.state.callouts,
                    structuredSnippets: result.state.structuredSnippets
                })
                .execute();

            if (!refreshedResult.state.structuredSnippets?.details) {
                throw new Error("Refreshed structured snippet details not available");
            }

            if (!refreshedResult.state.callouts) {
                throw new Error("Refreshed callouts not available");
            }

            const newCallouts = Ads.diffAssets(
                callouts,
                refreshedResult.state.callouts,
            )
            expect(newCallouts.length).toEqual(0); // Should generate 0 new callouts (same data)

            const newSnippets = Ads.diffAssets(
                result.state.structuredSnippets.details,
                refreshedResult.state.structuredSnippets.details,
            )
            expect(newSnippets).toBeDefined();
            expect(Array.isArray(newSnippets)).toBe(true);
            expect(newSnippets.length).toEqual(1); // Should have 1 new snippet (nVariants=1 from refresh)
        });

        it("automatically populates keywords on keywords stage", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "keywords"
                })
                .execute();

            expect(result.state.keywords?.length).toEqual(8);
            
            const lastMessage = result.state.messages?.at(-1) as AIMessage;
            const keywords = result.state.keywords
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
                    stage: "keywords"
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
                    projectUUID,
                    stage: "keywords",
                    refresh: {
                        asset: "keywords",
                        nVariants: 4
                    },
                    keywords: result.state.keywords
                })
                .execute();
            if (!refreshedResult.state.keywords) {
                throw new Error("Refreshed keywords are undefined");
            }

            const originalNonLockedKeywords = keywords.filter(k => !k.locked);
            const refreshedKeywordsFromOriginal = refreshedResult.state.keywords?.filter(
                k => originalNonLockedKeywords.some(orig => orig.text === k.text)
            );
            expect(refreshedKeywordsFromOriginal?.every(k => k.rejected)).toBe(true);

            const lockedKeywords = refreshedResult.state.keywords?.filter(k => k.locked);
            expect(lockedKeywords?.every(k => !k.rejected)).toBe(true);
                
            const newKeywords = Ads.diffAssets(keywords, refreshedResult.state.keywords);
            expect(newKeywords).toBeDefined();
            expect(Array.isArray(newKeywords)).toBe(true);
            expect(newKeywords.length).toEqual(4);
        });

        it("answers questions during settings section", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "settings",
                    messages: [new HumanMessage(`What happens after this?`)]
                })
                .execute();

            const response = result.state.messages.at(-1);
            expect(response).toBeDefined();
            expect(response?.content).toBeDefined();
        })
    });

    describe("Full workflow - multi-stage with state persistence", () => {
        it("maintains context across content -> highlights -> keywords stages with refreshes", async () => {
            // Step 1: Generate initial headlines and descriptions on content stage
            const contentResult = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "content"
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
                    refresh: {
                        asset: "headlines",
                        nVariants: 3
                    }
                })
                .execute();

            const newHeadlines = Ads.diffAssets(headlines, refreshHeadlinesResult.state.headlines!);
            expect(newHeadlines.length).toBeGreaterThan(0);
            expect(refreshHeadlinesResult.state.messages?.length).toBeGreaterThan(contentResult.state.messages?.length || 0);

            // Verify non-locked headlines were auto-rejected, but descriptions unchanged
            const originalNonLockedHeadlines = headlines.filter(h => !h.locked);
            const rejectedFromOriginal = refreshHeadlinesResult.state.headlines?.filter(
                h => originalNonLockedHeadlines.some(orig => orig.text === h.text)
            );
            expect(rejectedFromOriginal?.every(h => h.rejected)).toBe(true);
            expect(refreshHeadlinesResult.state.descriptions).toEqual(contentResult.state.descriptions);

            // User locks one more headline
            const updatedHeadlines = refreshHeadlinesResult.state.headlines as Ads.Asset[];
            const unlockedHeadline = updatedHeadlines.find(h => !h.locked && !h.rejected);
            if (unlockedHeadline) unlockedHeadline.locked = true;

            // Step 3: Navigate to highlights stage - pass along locked headlines/descriptions
            const highlightsResult = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    ...refreshHeadlinesResult.state,
                    stage: "highlights",
                    refresh: undefined
                })
                .execute();

            expect(highlightsResult.state.callouts?.length).toEqual(6);
            expect(highlightsResult.state.structuredSnippets).toBeDefined();
            expect(highlightsResult.state.structuredSnippets?.details?.length).toBeGreaterThanOrEqual(3);

            // Verify headlines and descriptions are preserved
            expect(highlightsResult.state.headlines).toEqual(refreshHeadlinesResult.state.headlines);
            expect(highlightsResult.state.descriptions).toEqual(refreshHeadlinesResult.state.descriptions);

            // User locks some callouts
            const callouts = highlightsResult.state.callouts as Ads.Asset[];
            callouts[0]!.locked = true;
            callouts[1]!.locked = true;

            // Step 4: Refresh callouts
            const refreshCalloutsResult = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    ...highlightsResult.state,
                    refresh: {
                        asset: "callouts",
                        nVariants: 2
                    }
                })
                .execute();

            const newCallouts = Ads.diffAssets(callouts, refreshCalloutsResult.state.callouts!);
            expect(newCallouts.length).toBeGreaterThan(0);

            // Verify non-locked callouts were auto-rejected
            const originalNonLockedCallouts = callouts.filter(c => !c.locked);
            const rejectedCalloutsFromOriginal = refreshCalloutsResult.state.callouts?.filter(
                c => originalNonLockedCallouts.some(orig => orig.text === c.text)
            );
            expect(rejectedCalloutsFromOriginal?.every(c => c.rejected)).toBe(true);

            // Verify structured snippets unchanged
            expect(refreshCalloutsResult.state.structuredSnippets).toEqual(highlightsResult.state.structuredSnippets);

            // Step 5: Navigate to keywords stage
            const keywordsResult = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    ...refreshCalloutsResult.state,
                    stage: "keywords",
                    refresh: undefined
                })
                .execute();

            expect(keywordsResult.state.keywords?.length).toEqual(8);

            // Verify all previous assets are preserved
            expect(keywordsResult.state.headlines).toEqual(refreshCalloutsResult.state.headlines);
            expect(keywordsResult.state.descriptions).toEqual(refreshCalloutsResult.state.descriptions);
            expect(keywordsResult.state.callouts).toEqual(refreshCalloutsResult.state.callouts);
            expect(keywordsResult.state.structuredSnippets).toEqual(refreshCalloutsResult.state.structuredSnippets);

            // User locks some keywords
            const keywords = keywordsResult.state.keywords as Ads.Asset[];
            keywords[0]!.locked = true;
            keywords[1]!.locked = true;

            // Step 6: Refresh keywords
            const refreshKeywordsResult = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    ...keywordsResult.state,
                    refresh: {
                        asset: "keywords",
                        nVariants: 3
                    }
                })
                .execute();

            const newKeywords = Ads.diffAssets(keywords, refreshKeywordsResult.state.keywords!);
            expect(newKeywords.length).toBeGreaterThan(0);

            // Verify non-locked keywords were auto-rejected
            const originalNonLockedKeywords = keywords.filter(k => !k.locked);
            const rejectedKeywordsFromOriginal = refreshKeywordsResult.state.keywords?.filter(
                k => originalNonLockedKeywords.some(orig => orig.text === k.text)
            );
            expect(rejectedKeywordsFromOriginal?.every(k => k.rejected)).toBe(true);

            // Verify message history has grown throughout the workflow
            expect(refreshKeywordsResult.state.messages?.length).toBeGreaterThan(5);

            // Verify all assets are related to the business context (scheduling tool)
            const allLockedHeadlines = refreshKeywordsResult.state.headlines?.filter(h => h.locked).map(h => h.text) || [];
            const allLockedCallouts = refreshKeywordsResult.state.callouts?.filter(c => c.locked).map(c => c.text) || [];
            const allLockedKeywords = refreshKeywordsResult.state.keywords?.filter(k => k.locked).map(k => k.text) || [];

            const allContent = [...allLockedHeadlines, ...allLockedCallouts, ...allLockedKeywords].join(' ').toLowerCase();
            // Content should be related to the scheduling tool business context
            expect(allContent).toMatch(/schedul|meeting|time|calendar|team|coordinat/i);

            const followupQuestionResult = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    ...refreshKeywordsResult.state,
                    refresh: undefined,
                    messages: [...refreshKeywordsResult.state.messages!, new HumanMessage(`What makes these keywords effective for a scheduling tool?`)]
                })
                .execute();
            
            // Verify that no new assets were generated (only Q&A response)
            expect(followupQuestionResult.state.headlines).toEqual(refreshKeywordsResult.state.headlines);
            expect(followupQuestionResult.state.callouts).toEqual(refreshKeywordsResult.state.callouts);
            expect(followupQuestionResult.state.keywords).toEqual(refreshKeywordsResult.state.keywords);

            const lastMessage = followupQuestionResult.state.messages?.at(-1);
            expect(lastMessage).toBeDefined();
            expect((lastMessage as AIMessage).content).toMatch(/great question|search intent|specificity|commercial intent/i)
            
            // Verify message history has grown
            expect(followupQuestionResult.state.messages?.length).toBeGreaterThan(refreshKeywordsResult.state.messages?.length);
        });
    });

    describe("Q&A flow", () => {
        it("answers question about how headlines and descriptions pair together without generating content", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "content",
                    messages: [new HumanMessage("How will Headlines and Details pair together?")]
                })
                .execute();

            const lastMessage = result.state.messages?.at(-1) as AIMessage;
            const message = getTextData(lastMessage);
            const stateData = getStateData(lastMessage);

            expect(message).toMatch(/google|automatically|combin/i);
            expect(stateData.headlines).toBeUndefined();
            expect(stateData.descriptions).toBeUndefined();
        });

        it("answers question about what descriptions are without generating content", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "content",
                    messages: [new HumanMessage("What are descriptions?")]
                })
                .execute();

            const toolCall = result.state.messages?.at(-2);
            expect(toolCall).toBeDefined();
            expect(toolCall?.content).toMatch(/What are .*Details.*/i);

            const lastMessage = result.state.messages?.at(-1) as AIMessage;
            const message = getTextData(lastMessage);
            const stateData = getStateData(lastMessage);

            expect(message).toMatch(/90 characters/) // It pulls in context from FAQ 
            expect(message).toMatch(/description|text|headline|ad/i);
            expect(stateData.headlines).toBeUndefined();
            expect(stateData.descriptions).toBeUndefined();
        });

        it("answers question about seeing preferred headlines in preview without generating content", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "content",
                    messages: [new HumanMessage("Can I see my preferred headlines in the preview?")]
                })
                .execute();

            const lastMessage = result.state.messages?.at(-1) as AIMessage;
            const message = getTextData(lastMessage);
            const stateData = getStateData(lastMessage);

            expect(message.length).toBeGreaterThan(20);
            expect(stateData.headlines).toBeUndefined();
            expect(stateData.descriptions).toBeUndefined();
        });
    });
});