import { describe, it, expect, beforeAll } from 'vitest';
import { testGraph } from '@support';
import { lastAIMessage } from '@annotation';
import { databaseSnapshotter } from '@services';
import { routerGraph } from '@graphs';
import { startPolly } from '@utils';

describe.sequential('Brainstorming Flow', () => {
    beforeAll(async () => {
        await databaseSnapshotter.restoreSnapshot("basic_account");
    })

    describe("When Rails API responds successfully", () => {
        it('should save initial project with mocked API', async () => {
            // Expected flow:
            // 1) Calls LLM directly to name project -> LLM provides projectName
            // 2) Calls Rails API to create project with the provided name -> Rails returns project with id
            // 3) Stops for us to test graph state
            //
            // Requires that we are successfully mocking Rails API + LLM calls separately and reliably
            const result = await testGraph()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            expect(result.error).toBeUndefined();
            expect(result.state.projectName).toBeDefined();
            expect(result.state.project?.id).toBeGreaterThan(0);
            expect(result.state.project?.name).toEqual(result.state.projectName);

            expect(result.state.project?.threadId).toBeDefined();

            const aiResponse = lastAIMessage(result.state);
            expect(aiResponse?.content).toContain(`Space Exploration Landing Page`)

            expect(result.state.project.createdAt).toBeDefined();
            expect(result.state.project.updatedAt).toBeDefined();

            expect(result.state.website.createdAt).toBeDefined();
            expect(result.state.website.updatedAt).toBeDefined();
        });

        it('should handle multiple API calls in sequence', async () => {
            // All API calls within this test will be recorded/replayed
            const result = await testGraph()
                .withGraph(routerGraph)
                .withPrompt("Create an e-commerce platform with user authentication")
                .stopAfter('createProject')
                .execute();

            expect(result.error).toBeUndefined();
            expect(result.state.projectName).toEqual("shop-auth");
            expect(result.state.project?.id).toBeGreaterThan(0);
        });
    });
});