import { describe, it, expect, beforeEach } from 'vitest';
import { testGraph, GraphTestBuilder } from '@support';
import { type BrainstormGraphState } from '@state';
import { DatabaseSnapshotter } from '@services';
import { brainstormGraph as uncompiledGraph } from '@graphs';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { lastHumanMessage, lastAIMessage } from '@annotation';
import { createBrainstorm } from '@nodes';
import { SaveAnswersTool } from '@tools';
import { v7 as uuidv7 } from 'uuid';
import { 
    isHumanMessage, 
    isAIMessage, 
    Brainstorm,
    type Message,
} from '@types';
import { ContentStrategyModel } from '@models';
import { graphParams } from '@core';
import { assertDefined } from '@support';

const expectStructuredOutput = (question: Brainstorm.QuestionType) => {
    expect(typeof question).toBe('object');
    
    expect(question.text).toBeTruthy();

    assertDefined(question.examples, 'examples');
    expect(question.examples).toHaveLength(3);
    expect(question.examples[0]).toBeTruthy();
    expect(question.examples[1]).toBeTruthy();
    expect(question.examples[2]).toBeTruthy();
    
    expect(question.conclusion).toBeTruthy();
}

const brainstormGraph = uncompiledGraph.compile({ ...graphParams, name: "brainstorm" }); 

const validAnswers: Record<Brainstorm.TopicType, string> = {
    idea: `Friend of the Pod is a podcast matchmaking service.
            We help both sides: hosts get great content, guests get exposure,
            and we're the only platform that does this at scale.
            We solve the "needle in a haystack" problem: hosts spend hours
            finding guests. We do it in minutes with AI-powered filtering.`,
    audience: `
        My target audience is podcast hosts with large audiences.
        They want to find guests that are a good fit for their show,
        but they're bombarded with messages from low-quality, spammy guests
        who don't add value to their shows.
    `,
    solution: `Friend of the Pod has over 100+ filters to find the perfect guest for your show.
                We use AI to match hosts and guests based on their content, audience, and goals.
                We also use AI to match hosts and guests based on their content, audience, and goals.`,
    socialProof: `Over 10k creators use Friend of the Pod to find guests for their shows. They are all notable names like LeBron James, Serena Williams, and Oprah Winfrey.`,
    lookAndFeel: `The look and feel of the landing page.`,
}

const ideaChat = [
    new AIMessage(`What is your business?`),
]

const audienceChat = [
    ...ideaChat,
    new HumanMessage(validAnswers.idea),
    new AIMessage(`That's awesome! And what about your audience?`),
]

const solutionChat = [
    ...audienceChat,
    new HumanMessage(validAnswers.audience),
    new AIMessage(`That's awesome! And what about your solution?`),
]
const socialProofChat = [
    ...solutionChat,
    new HumanMessage(validAnswers.solution),
    new AIMessage(`That's awesome! And what about your social proof?`),
]
const lookAndFeelChat = [
    ...socialProofChat,
    new HumanMessage(validAnswers.socialProof),
    new AIMessage(`That's awesome! And what about your look and feel?`),
]

const validChatHistory: Record<Brainstorm.TopicType, BaseMessage[]> = {
    idea: ideaChat,
    audience: audienceChat,
    solution: solutionChat,
    socialProof: socialProofChat,
    lookAndFeel: lookAndFeelChat,
}

const restartChatFrom = async (topic: Brainstorm.TopicType): Promise<GraphTestBuilder<BrainstormGraphState>> => {
    const questionsAnswered = Brainstorm.BrainstormTopics.slice(0, Brainstorm.BrainstormTopics.indexOf(topic));
    const answers = questionsAnswered.map((question) => ({
        topic: question,
        answer: validAnswers[question],
    }));
    const threadId = uuidv7();
    const config = { configurable: { thread_id: threadId } };
    const partialState = await createBrainstorm({
        jwt: "test-jwt",
        threadId,
        messages: [],
    } as any, config);
    const saveBrainstormTool = SaveAnswersTool(partialState as any, config);

    // create memories
    const memories = await saveBrainstormTool.invoke({ answers });

    // create chat history
    const chatHistory = validChatHistory[topic];

    // create state
    const state = {
        ...partialState,
        memories,
        messages: chatHistory,
    }

    return testGraph<BrainstormGraphState>()
        .withGraph(brainstormGraph)
        .withState(state)
}

describe.sequential('Brainstorming Flow', () => {
    beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("basic_account");
    })

    describe("Suggested next question", () => {
        it("should default to the first question", async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Sorry, what's going on?`)
                .stopAfter('agent')
                .execute();

            expect(result.state.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('idea');
            expect(result.state.placeholderText).toEqual('I want to acquire leads, sell my product...')
            expect(result.state.availableActions).toHaveLength(1);
            expect(result.state.availableActions[0]).toBe('helpMe');
        });

        it("should stay consistent when the user answers the first question incorrectly", async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`I like pasta.`)
                .stopAfter('agent')
                .execute();

            const aiResponse = lastAIMessage(result.state);

            expect(result.state.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('idea');
            expect(result.state.placeholderText).toEqual('I want to acquire leads, sell my product...')

            // AI suggests plausible business ideas...
            expect(aiResponse?.content).toContain('restaurant');
            expect(result.state.availableActions).toHaveLength(1);
            expect(result.state.availableActions[0]).toBe('helpMe');
        });

        it("should update to the next question when we successfully give a business idea", async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(validAnswers.idea)
                .stopAfter('agent')
                .execute();

            const aiResponse = lastAIMessage(result.state);
            assertDefined(aiResponse, 'aiResponse is defined');

            expect(result.state.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('audience');
            expect(result.state.placeholderText).toEqual('My target audience is...')

            // It saves the answer to the memories...
            const memories = result.state.memories;
            expect(memories.idea).toBeTruthy();

            // AI asks about customers...
            expect(aiResponse.content).toContain('audience');

            expect(result.state.availableActions).toHaveLength(4);
            expect(result.state.availableActions[0]).toBe('helpMe');
            expect(result.state.availableActions[1]).toBe('skip');
            expect(result.state.availableActions[2]).toBe('doTheRest');
            expect(result.state.availableActions[3]).toBe('finished');
        });
    })

    describe("Full brainstorming conversation flow", () => {
        it('the first message is asked (tacitly) by the existing UI. the 2nd message is the first question after that.', async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('agent')
                .execute();

            expect(result.error).toBeUndefined();

            // 1 tacit AI message ("What is your business?") + 
            // 1 human ("Friend of the Pod is a podcast matchmaking service.") + 
            // 1 AI ("Who are your customers, and what are they trying to achieve? + 3 sample responses")
            expect(result.state.messages).toHaveLength(3);
        });

        it("keeps pushing if the user doesn't have a good response", async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('agent')
                .execute();

            expect(result1.state.currentTopic).toBe('idea');
            expect(result1.state.placeholderText).toEqual('I want to acquire leads, sell my product...')

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`I like pasta.`)
                .withState({
                    ...result1.state,
                })
                .stopAfter('agent')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.currentTopic).toBe('idea');
            expect(result2.state.placeholderText).toEqual('I want to acquire leads, sell my product...')

            const lastAIResponse = lastAIMessage(result2.state);
            expect(result2.state.messages).toHaveLength(5);

            assertDefined(lastAIResponse, 'lastAIResponse is defined');
            expect(lastAIResponse.content).toContain('podcast');

            const result3 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Pasta is so good it makes me want to die.`)
                .withState({
                    ...result2.state,
                })
                .stopAfter('agent')
                .execute();

            expect(result3.error).toBeUndefined();
            expect(result3.state.currentTopic).toBe('idea');
            expect(result3.state.placeholderText).toEqual('I want to acquire leads, sell my product...')

            const lastAIResponse3 = lastAIMessage(result3.state);
            assertDefined(lastAIResponse3, 'lastAIResponse is defined');
            expect(result3.state.messages).toHaveLength(7);

            expect(lastAIResponse3.content).toContain('podcast');
        });

        it('should ask about solution after audience', async () => {
            const graph = await restartChatFrom('audience');
            const result = await graph
                .withPrompt(validAnswers.audience)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('solution');
            expect(result.state.placeholderText).toEqual(`My solution is...`)

            expect(result.state.availableActions).toHaveLength(4);
            expect(result.state.availableActions[0]).toBe('helpMe');
            expect(result.state.availableActions[1]).toBe('skip');
            expect(result.state.availableActions[2]).toBe('doTheRest');
            expect(result.state.availableActions[3]).toBe('finished');

            expect(lastAIResponse.content).toContain('solution');
        })

        it('should ask about social proof after solution', async () => {
            const graph = await restartChatFrom('solution');
            const result = await graph
                .withPrompt(validAnswers.solution)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('socialProof');
            expect(result.state.placeholderText).toEqual(`My social proof is...`)

            expect(result.state.availableActions).toHaveLength(4);
            expect(result.state.availableActions[0]).toBe('helpMe');
            expect(result.state.availableActions[1]).toBe('skip');
            expect(result.state.availableActions[2]).toBe('doTheRest');
            expect(result.state.availableActions[3]).toBe('finished');

            expect(lastAIResponse.content).toContain('social proof');
        });

        it.only('should tell the user about the UI when ready for lookAndFeel', async () => {
            const graph = await restartChatFrom('socialProof');
            const result = await graph
                .withPrompt(validAnswers.socialProof)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('lookAndFeel');
            expect(result.state.placeholderText).toEqual(`Use the Advanced sidebar or click "Build My Site"...`)

            expect(result.state.availableActions).toHaveLength(1);
            expect(result.state.availableActions[0]).toBe('finished');

            console.log(lastAIResponse.content)
            expect(lastAIResponse.content).toContain(`What's the look and feel`);
        });

        it('should ask fifth question (verbatim) after fourth response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('agent')
                .execute();

            const messages2: Message[] = [
                ...result1.state.messages,
                getSimpleQuestion(1), // Audience
                new HumanMessage(`Podcasts guests looking to promote their book or service`),
                getSimpleQuestion(2), // What's your value prop?
                new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
                getSimpleQuestion(3), // Social proof
            ];

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`)
                .withState({
                    messages: messages2,
                    questionIndex: 3
                })
                .stopAfter('agent')
                .execute();

            expect(result2.error).toBeUndefined();

            const question = result2.state.nextQuestion;
            expect(question.key).toBe("lookAndFeel");
            expect(question.type).toBe("simple");
            expect(typeof question).toBe('object');
            expect(result2.state.nextQuestion.question).toBe("Before we build, do you have a logo, color palette, or images you want to include?");
            expect(result2.state.questionIndex).toBe(4);
        });

        it('guides the user to use the Advanced features before proceeding on question 5', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('agent')
                .execute();

            const messages2 = [
                ...result1.state.messages,
                getSimpleQuestion(1), // Audience
                new HumanMessage(`Podcasts guests looking to promote their book or service`),
                getSimpleQuestion(2), // What's your value prop?
                new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
                getSimpleQuestion(3), // Social proof
                new HumanMessage(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`),
                getSimpleQuestion(4),
            ];

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Yes, I have a logo and brand colors - blue and purple.`)
                .withState({
                    messages: messages2,
                    questionIndex: 4
                })
                .stopAfter('agent')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.questionIndex).toBe(4);

            const lastAiResponse = result2.state.messages.filter(isAIMessage).slice(-1)[0]
            expect(lastAiResponse.content).toMatch(/Advanced Sidebar/)
        });

        describe("Brainstorming Finished", () => {
            it("jumps to the next graph when user verbally expresses that they want to move on", async () => {
                const result1 = await testGraph<BrainstormGraphState>()
                    .withGraph(brainstormGraph)
                    .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                    .stopAfter('agent')
                    .execute();

                const messages2 = [
                    ...result1.state.messages,
                    getSimpleQuestion(1), // Audience
                    new HumanMessage(`Podcasts guests looking to promote their book or service`),
                    getSimpleQuestion(2), // What's your value prop?
                    new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
                    getSimpleQuestion(3), // Social proof
                    new HumanMessage(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`),
                    getSimpleQuestion(4),
                ];

                const result2 = await testGraph<BrainstormGraphState>()
                    .withGraph(brainstormGraph)
                    .withPrompt(`I don't want to do that, what do we do next?`)
                    .withState({
                        messages: messages2,
                        questionIndex: 4
                    })
                    .stopAfter('agent')
                    .execute();

                expect(result2.error).toBeUndefined();
                expect(result2.state.questionIndex).toBe(4);

                expect(result2.state.redirect).toEqual("website_builder");
            });

            it("jumps to the next graph when user clicks 'Finished'", async () => {
                const result1 = await testGraph<BrainstormGraphState>()
                    .withGraph(brainstormGraph)
                    .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                    .stopAfter('agent')
                    .execute();

                const messages2 = [
                    ...result1.state.messages,
                    getSimpleQuestion(1), // Audience
                    new HumanMessage(`Podcasts guests looking to promote their book or service`),
                    getSimpleQuestion(2), // What's your value prop?
                    new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
                    getSimpleQuestion(3), // Social proof
                    new HumanMessage(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`),
                    getSimpleQuestion(4),
                ];

                const result2 = await testGraph<BrainstormGraphState>()
                    .withGraph(brainstormGraph)
                    .withState({
                        messages: messages2,
                        questionIndex: 4,
                        action: "FINISHED"
                    })
                    .stopAfter('agent')
                    .execute();

                expect(result2.error).toBeUndefined();
                expect(result2.state.questionIndex).toBe(4);

                // It creates contents strategy
                // This should actually go in the WebsiteBuilder! To save time for the user... 
                const contentStrategy = await ContentStrategyModel.findBy({websiteId: result2.state.websiteId});
                expect(contentStrategy).toBeDefined();
                expect(contentStrategy.problemStatement).toBeDefined();
                expect(contentStrategy.socialProof).toBeDefined();
                expect(contentStrategy.callToAction).toBeDefined();

                expect(result2.state.redirect).toEqual("website_builder");
            });
        });

        describe("Actions", () => {
            describe("SKIP", () => {
                it("skips a single question", async () => {
                    const result1 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                        .stopAfter('agent')
                        .execute();

                    const question: QuestionType = result1.state.nextQuestion;
                    expect(question.key).toBe("customers");
                    expect(question.type).toBe("structured");
                    expect(typeof question).toBe('object');

                    const result2 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withState({
                            ...result1.state,
                            action: "SKIP"
                        })
                        .stopAfter('agent')
                        .execute();

                    const state = result2.state;

                    expect(result2.error).toBeUndefined();
                    expect(state.questionIndex).toBe(2);

                    // It skips to the next question
                    const question2: QuestionType = state.nextQuestion;
                    expect(question2.key).toBe("valueProp");
                    expect(state.availableActions).toEqual(["HELP_ME_ANSWER", "SKIP", "DO_THE_REST"]);

                    const messages3 = [
                        ...result2.state.messages,
                        new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
                        getSimpleQuestion(3), // Social proof
                        new HumanMessage(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`),
                        getSimpleQuestion(4),
                    ];
                    const result3 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withState({
                            ...result3.state,
                            messages: messages3,
                            action: "FINISHED"
                        })
                        .stopAfter('agent')
                        .execute();

                    // This should actually go in the WebsiteBuilder! Find another way to test this...
                    // We should put this in MESSAGES...
                    // const contentStrategy = await ContentStrategyModel.findBy({websiteId: result2.state.websiteId});
                    // expect(contentStrategy).toBeDefined();
                    // expect(contentStrategy.audience).toBeDefined(); // Even though we skipped this question, the AI brainstorms using the data available to it.
                    const lastAiResponse = result3.state.messages.filter(isAIMessage).slice(-1);
                    expect(lastAiResponse.content).toMatch(/based on everything you said.../) // we skipped this, so it answers at the end...
                    expect(lastAiResponse.content).toMatch(/content creators/) // we skipped this, so it answers at the end...
                });

                it("allows user to make further adjustments", async () => {
                    const result1 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                        .stopAfter('agent')
                        .execute();

                    const result2 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withState({
                            ...result1.state,
                            action: "DO_THE_REST"
                        })
                        .stopAfter('agent')
                        .execute();

                    const state = result2.state;

                    expect(result2.error).toBeUndefined();
                    expect(state.questionIndex).toBe(4);

                    // It seeks approval
                    expect(state.route).toEqual("seekApproval");
                    expect(state.availableActions).toEqual(["FINISHED"]);

                    const result3 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withPrompt(`Actually, my customers are podcast creators, not podcast guests.`)
                        .withState({
                            ...result2.state,
                        })
                        .stopAfter('agent')
                        .execute();

                    expect(result3.error).toBeUndefined();
                    expect(result3.state.questionIndex).toBe(4);

                    const lastAiResponse = state.messages?.filter(isAIMessage).slice(-1);
                    expect(lastAiResponse.content).toMatch(/creators/) // It updates it understanding
                    expect(lastAiResponse.content).toMatch(/social proof is affected by this change..../)
                });
            });

            describe("HELP_ME_ANSWER", () => {
                it("helps the user answer the question", async () => {
                    const result1 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                        .stopAfter('agent')
                        .execute();

                    const question: QuestionType = result1.state.nextQuestion;
                    expect(question.key).toBe("customers");
                    expect(question.type).toBe("structured");
                    expect(typeof question).toBe('object');

                    const result2 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withState({
                            ...result1.state,
                            action: "HELP_ME_ANSWER"
                        })
                        .stopAfter('agent')
                        .execute();

                    const state = result2.state;

                    expect(result2.error).toBeUndefined();
                    expect(state.questionIndex).toBe(2);

                    // It answers for the user as 2nd-to-last message
                    const lastAiResponse = state.messages?.filter(isAIMessage).slice(-2);
                    expect(lastAiResponse.content).toMatch(/content creators/) // The audience

                    // Then it asks the next question...
                    const question2: QuestionType = state.nextQuestion;
                    expect(question2.key).toBe("valueProp"); // It prepares the next question
                    expect(state.availableActions).toEqual(["HELP_ME_ANSWER", "SKIP", "DO_THE_REST"]);

                    const result3 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withPrompt(`Actually, it's for podcast listeners...`)
                        .withState({
                            ...result2.state,
                        })
                        .stopAfter('agent')
                        .execute();

                    const question3: QuestionType = state.nextQuestion;
                    // We're still on value prop
                    expect(question2.key).toBe("valueProp"); // It prepares the next question
                    expect(state.availableActions).toEqual(["HELP_ME_ANSWER", "SKIP", "DO_THE_REST"]);

                    const lastAiResponse2 = state.messages?.filter(isAIMessage).slice(-1);
                    expect(lastAiResponse2.content).toMatch(/content creators/) // The audience

                    expect(lastAiResponse2.content).toMatch(/got it! Podcast listeners/)
                    expect(lastAiResponse2.content).toMatch(/Now about our value prop/)
                });
            });

            describe("DO_THE_REST", () => {
                it("completes the brainstorming and provides only FINISHED action when user", async () => {
                    const result1 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                        .stopAfter('agent')
                        .execute();

                    const result2 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withState({
                            ...result1.state,
                            action: "DO_THE_REST"
                        })
                        .stopAfter('agent')
                        .execute();

                    const state = result2.state;

                    expect(result2.error).toBeUndefined();
                    expect(state.questionIndex).toBe(4);

                    // It seeks approval
                    expect(state.route).toEqual("seekApproval");
                    expect(state.availableActions).toEqual(["FINISHED"]);

                    // It spells out its intentions in message form...
                    const lastAiResponse = state.messages?.filter(isAIMessage).slice(-1);
                    expect(lastAiResponse.content).toMatch(/audience/) // Brainstorms a section we didn't previously
                });

                it("allows user to make further adjustments", async () => {
                    const result1 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                        .stopAfter('agent')
                        .execute();

                    const result2 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withState({
                            ...result1.state,
                            action: "DO_THE_REST"
                        })
                        .stopAfter('agent')
                        .execute();

                    const state = result2.state;

                    expect(result2.error).toBeUndefined();
                    expect(state.questionIndex).toBe(4);

                    // It seeks approval
                    expect(state.route).toEqual("seekApproval");
                    expect(state.availableActions).toEqual(["FINISHED"]);

                    const result3 = await testGraph<BrainstormGraphState>()
                        .withGraph(brainstormGraph)
                        .withPrompt(`Actually, my customers are podcast creators, not podcast guests.`)
                        .withState({
                            ...result2.state,
                        })
                        .stopAfter('agent')
                        .execute();

                    expect(result3.error).toBeUndefined();
                    expect(result3.state.questionIndex).toBe(4);

                    const lastAiResponse = state.messages?.filter(isAIMessage).slice(-1);
                    expect(lastAiResponse.content).toMatch(/creators/) // It updates it understanding
                    expect(lastAiResponse.content).toMatch(/social proof is affected by this change..../)
                });
            });
        });
    });
});

// TODO:
// Create project when first question is submitted
// Name project when first question is submitted
// Test next steps (Help me answer, skip, do the rest)
// Test DO THE REST
    // Seek approval
    // User can access next steps
// Summarize / create full content strategy on complete
// Direct to next workflow ("redirect")