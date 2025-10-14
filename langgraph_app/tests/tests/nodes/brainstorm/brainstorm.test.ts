import { describe, it, expect, beforeAll } from 'vitest';
import { testGraph } from '@support';
import { lastAIMessage } from '@annotation';
import { databaseSnapshotter } from '@services';
import { brainstormGraph } from '@graphs';
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

            const aiResponse = lastAIMessage(result.state);
            console.log(aiResponse?.content);
            expect(aiResponse?.content).toContain(`Space Exploration Landing Page`)

            // expect(result.state.project.createdAt).toBeDefined();
            // expect(result.state.project.updatedAt).toBeDefined();

            // expect(result.state.website.createdAt).toBeDefined();
            // expect(result.state.website.updatedAt).toBeDefined();
        });
    });
});