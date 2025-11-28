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
            if (!headlines[0]) {
                throw new Error("No headlines available for testing");
            }

            headlines[0].text = `Sync or swim.`
            headlines[1].text = `This could've been an email.`;
            headlines[2].text = `Calendar Tetris champion.`;

            headlines[0].locked = true;
            headlines[1].locked = true;
            headlines[2].locked = true;
            [3, 4, 5].forEach(index => {
                if (headlines[index]) {
                    headlines[index].rejected = true;
                }
            });

            const originalDescriptions = result.state.descriptions;
            
            const refreshedResult = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withState({
                    projectUUID,
                    stage: "content",
                    refreshContext: ["headlines"],
                    headlines: result.state.headlines,
                    descriptions: result.state.descriptions
                })
                .execute();
                
            const nonRejectedHeadlines = refreshedResult.state.headlines?.filter(h => !h.rejected);
            const uniqueNonRejectedCount = new Set(nonRejectedHeadlines?.map(h => h.text)).size;
            expect(uniqueNonRejectedCount).toEqual(9);

            expect(refreshedResult.state.descriptions).toEqual(originalDescriptions);
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

            const lastMessage = result.state.messages?.at(-1) as AIMessage;
            const message = getTextData(lastMessage);
            const stateData = getStateData(lastMessage);

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