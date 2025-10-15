import { describe, it, expect, beforeAll } from 'vitest';
import { testGraph } from '@support';
import { type BrainstormGraphState } from '@state';
import { databaseSnapshotter } from '@services';
import { brainstormGraph } from '@graphs';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { isHumanMessage, isAIMessage } from '@types';

describe.sequential('Brainstorming Flow', () => {
    beforeAll(async () => {
        await databaseSnapshotter.restoreSnapshot("basic_account");
    })

    describe("Full brainstorming conversation flow", () => {
        it("provides additional support if the first question isn't properly answered", async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Sorry, what's going on?`)
                .stopAfter('askQuestion')
                .execute();

            expect(result.state.questionIndex).toBe(1);
            const question = result.state.nextQuestion;
            expect(typeof question).toBe('object');
            
            if (typeof question === 'object') {
                expect(question.intro).toBeTruthy();
                expect(question.question).toBeTruthy();
                expect(question.sampleResponses).toHaveLength(3);
                expect(question.conclusion).toBeTruthy();
            }
        });

        it('the first message is asked (tacitly) by the existing UI. the 2nd message is the first question after that.', async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            expect(result.error).toBeUndefined();

            const question = result.state.nextQuestion;
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
            
            expect(result.state.questionIndex).toBe(2);

            // 1 tacit AI message ("What is your business?") + 
            // 1 human ("Friend of the Pod is a podcast matchmaking service.") + 
            // 1 AI ("Who are your customers, and what are they trying to achieve? + 3 sample responses")
            expect(result.state.messages).toHaveLength(3);
        });

        it('should ask third question (structured) after second response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Podcast listeners looking to discover new shows, and creators seeking their audience.`)
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
                
                expect(question.question).toBeTruthy();
                
                expect(question.sampleResponses).toHaveLength(3);
                expect(question.sampleResponses[0]).toBeTruthy();
                expect(question.sampleResponses[1]).toBeTruthy();
                expect(question.sampleResponses[2]).toBeTruthy();
                
                expect(question.conclusion).toBeTruthy();
            }
            
            expect(result2.state.questionIndex).toBe(3);
            expect(result2.state.messages).toHaveLength(5);
            expect(result2.state.messages?.filter((msg) => isHumanMessage(msg))).toHaveLength(2);
            expect(result2.state.messages?.filter((msg) => isAIMessage(msg))).toHaveLength(3);
        });

        it('should ask fourth question (verbatim) after third response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const messages2 = [
                ...result1.state.messages,
                new HumanMessage(`Podcast listeners and creators.`),
                new HumanMessage(`We use AI matching to connect them.`)
            ];

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`We provide personalized recommendations and discovery tools.`)
                .withState({
                    messages: messages2,
                    questionIndex: 3
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.nextQuestion).toBe("Do you have testimonials, reviews, high-profile customers, or other social proof?");
            expect(result2.state.questionIndex).toBe(4);
        });

        it('should ask fifth question (verbatim) after fourth response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const messages2 = [
                ...result1.state.messages,
                new HumanMessage(`Podcast listeners and creators.`),
                new HumanMessage(`We use AI matching.`),
                new HumanMessage(`We provide personalized recommendations.`)
            ];

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`)
                .withState({
                    messages: messages2,
                    questionIndex: 4
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.nextQuestion).toBe("Before we build, do you have a logo, color palette, or images you want to include?");
            expect(result2.state.questionIndex).toBe(5);
        });

        it('should complete brainstorming after fifth response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const messages2 = [
                ...result1.state.messages,
                new HumanMessage(`Podcast listeners and creators.`),
                new HumanMessage(`We use AI matching.`),
                new HumanMessage(`We provide recommendations.`),
                new HumanMessage(`Yes, testimonials from 50+ podcasters.`)
            ];

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Yes, I have a logo and brand colors - blue and purple.`)
                .withState({
                    messages: messages2,
                    questionIndex: 5
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.questionIndex).toBe(5);
        });
    });
});