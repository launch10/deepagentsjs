import { describe, it, expect, beforeEach } from 'vitest';
import { testGraph } from '@support';
import { type AdsGraphState } from '@state';
import { adsGraph as uncompiledGraph } from '@graphs';
import { v7 as uuidv7 } from 'uuid';
import { graphParams } from '@core';
import { DatabaseSnapshotter } from '@services';

const adsGraph = uncompiledGraph.compile({ ...graphParams, name: "ads" }); 

describe.sequential('Ads Flow', () => {
    beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("basic_account");
    }, 30000)

    describe("Chat flow", () => {
        it("fails when frontend doesn't send project UUID", async () => {
            const result = await testGraph<AdsGraphState>()
                .withGraph(adsGraph)
                .withPrompt(`Sorry, what's going on?`)
                .execute();

            expect(result.state.error).toBeDefined();
            expect(result.state.error!.message).toContain("Project UUID is required");
        });
    });
});