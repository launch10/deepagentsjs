import { describe, it, expect, beforeAll, vi } from 'vitest';
import { testGraph } from '@support';
import { databaseSnapshotter } from '@services';
import { ContentStrategyModel } from '@models';
import { routerGraph } from '@graphs';
import { WebsiteBuilderGraphState } from '@state';

describe.sequential('PlanWebsite Node', async () => {
    beforeAll(async () => {
        await databaseSnapshotter.restoreSnapshot("basic_account");
    });

    describe("When Rails API responds successfully", async () => {
        it('should plan website with mocked API', async () => {
            const result = await testGraph<WebsiteBuilderGraphState>()
                .withGraph(routerGraph)
                .withPrompt(`Create a website about space exploration`)
                .stopAfter('planWebsite')
                .execute();

            expect(result.error).toBeUndefined();
            console.log(result)
            const websiteId = result.state.website.id;
            const contentStrategy = await ContentStrategyModel.findBy({websiteId});
            expect(contentStrategy).toBeDefined();

            ["tone", "attentionGrabber", "emotionalBridge", 
            "problemStatement", "emotionalBridge", "productReveal",
            "socialProof", "urgencyHook", "callToAction"]
            .forEach((key) => {
              expect(contentStrategy?.[key], 
                `Expected contentStrategy.${key} to be defined`).toBeDefined();
            });
        });
    });
});