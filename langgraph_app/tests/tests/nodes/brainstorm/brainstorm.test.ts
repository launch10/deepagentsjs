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

            console.log(result.state)
            const aiResponse = lastAIMessage(result.state);
            const question = aiResponse?.question

            expect(question.intro).toContain(`Let's explore how Friend of the Pod makes podcast discovery easier`)
            expect(question.question).toContain(`How does Friend of the Pod solve the podcast discovery problem for listeners and creators?`)
            expect(question.sampleResponses[0]).toContain(`Friend of the Pod uses AI-powered matching algorithms`);
            expect(question.sampleResponses[1]).toContain(`saves listeners hours of trial-and-error by providing personalized podcast recommendations`)
            expect(question.sampleResponses[2]).toContain(`find their ideal audience`)
            expect(question.conclusion).toContain(`What unique solution does Friend of the Pod offer to make podcast discovery easier and more effective?`)

            // expect(result.state.project.createdAt).toBeDefined();
            // expect(result.state.project.updatedAt).toBeDefined();

            // expect(result.state.website.createdAt).toBeDefined();
            // expect(result.state.website.updatedAt).toBeDefined();
        });
    });
});