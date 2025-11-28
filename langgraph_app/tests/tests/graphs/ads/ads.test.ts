import { describe, it, expect, beforeEach } from 'vitest';
import { testGraph } from '@support';
import { type AdsGraphState } from '@state';
import { adsGraph as uncompiledGraph } from '@graphs';
import { graphParams } from '@core';
import { DatabaseSnapshotter } from '@services';
import { db, projects as projectsTable } from '@db';
import { type UUIDType } from '@types';
import { AIMessage } from '@langchain/core/messages';

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
        });
    });
});