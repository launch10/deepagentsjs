import { describe, it, expect, beforeAll } from 'vitest';
import { testGraph } from '@support';
import { type BrainstormGraphState } from '@state';
import { databaseSnapshotter } from '@services';
import { brainstormGraph } from '@graphs';
import { HumanMessage } from '@langchain/core/messages';

describe.sequential('Brainstorming Flow', () => {
    beforeAll(async () => {
        await databaseSnapshotter.restoreSnapshot("basic_account");
    })

    describe("Full brainstorming conversation flow", () => {
        it('should ask first question (verbatim)', async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            expect(result.error).toBeUndefined();
            expect(result.state.nextQuestion).toBe("Tell us about your business. More info -> better outcomes.");
            expect(result.state.questionIndex).toBe(1);
        });

        it('should ask second question (structured with samples) after first response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`We connect podcasters with their ideal audience through AI matching.`)
                .withState({
                    messages: result1.state.messages,
                    questionIndex: result1.state.questionIndex
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            
            const question = result2.state.nextQuestion;
            expect(typeof question).toBe('object');
            
            if (typeof question === 'object') {
                expect(question.intro).toBeTruthy();
                expect(question.intro.toLowerCase()).toContain('friend of the pod');
                
                expect(question.question).toBeTruthy();
                
                expect(question.sampleResponses).toHaveLength(3);
                expect(question.sampleResponses[0]).toBeTruthy();
                expect(question.sampleResponses[1]).toBeTruthy();
                expect(question.sampleResponses[2]).toBeTruthy();
                
                expect(question.conclusion).toBeTruthy();
            }
            
            expect(result2.state.questionIndex).toBe(2);
        });

        it('should ask third question (verbatim) after second response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const messages2 = [
                ...result1.state.messages,
                new HumanMessage(`We connect podcasters with their ideal audience through AI matching.`)
            ];

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`We use advanced algorithms to analyze listener preferences and podcast content.`)
                .withState({
                    messages: messages2,
                    questionIndex: 2
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.nextQuestion).toBe("Do you have testimonials, reviews, high-profile customers, or other social proof?");
            expect(result2.state.questionIndex).toBe(3);
        });

        it('should ask fourth question (verbatim) after third response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const messages2 = [
                ...result1.state.messages,
                new HumanMessage(`We connect podcasters with their ideal audience through AI matching.`),
                new HumanMessage(`We use advanced algorithms to analyze listener preferences.`)
            ];

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`)
                .withState({
                    messages: messages2,
                    questionIndex: 3
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.nextQuestion).toBe("Before we build, do you have a logo, color palette, or images you want to include?");
            expect(result2.state.questionIndex).toBe(4);
        });

        it('should ask final question (verbatim) after fourth response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const messages2 = [
                ...result1.state.messages,
                new HumanMessage(`We connect podcasters with their ideal audience.`),
                new HumanMessage(`We use AI algorithms to analyze preferences.`),
                new HumanMessage(`Yes, we have testimonials from 50+ podcasters.`)
            ];

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Yes, I have a logo and brand colors - blue and purple.`)
                .withState({
                    messages: messages2,
                    questionIndex: 3
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.nextQuestion).toBe("Before we build, do you have a logo, color palette, or images you want to include?");
            expect(result2.state.questionIndex).toBe(4);
        });
    });
});