import { describe, it, expect, beforeEach } from 'vitest';
import { testGraph, GraphTestBuilder } from '@support';
import { type BrainstormGraphState } from '@state';
import { DatabaseSnapshotter, BrainstormNextStepsService } from '@services';
import { brainstormGraph as uncompiledGraph } from '@graphs';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { lastAIMessage } from '@types';
import { createBrainstorm } from '@nodes';
import { summarizeAndSaveAnswers } from '@tools';
import { v7 as uuidv7 } from 'uuid';
import { 
    Brainstorm,
} from '@types';
import { graphParams } from '@core';
import { assertDefined } from '@support';

const brainstormGraph = uncompiledGraph.compile({ ...graphParams, name: "brainstorm" }); 

// TODO:
// Name project in the background when first message is submitted
const validAnswers: Record<Brainstorm.TopicName, string> = {
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
                We also use AI to match hosts and guests based on their content, audience, and goals.
                But what sets us apart is that we've trained proprietary models on messages that 
                successful podcast hosts receive. We use this data to filter out pitches that 
                are predicted to not be a good fit for your show.
            `,
    socialProof: `Over 10k creators use Friend of the Pod to find guests for their shows.
    Real case: Host found 3 guests in 10 minutes instead of 5 hours of manual outreach, leading to 2 viral episodes. As the founder of the company, I used to work at Spotify and Apple Podcasts, so I've seen first hand what makes a guest a good fit for a show, and I understand the industry.`,
    lookAndFeel: `The look and feel of the landing page.`,
}
class ChatHistory {
    idea: string[];
    audience: string[];
    solution: string[];
    socialProof: string[];
    lookAndFeel: string[];
    
    constructor({idea, audience, solution, socialProof, lookAndFeel}: Record<Brainstorm.TopicName, string[]>) {
        this.idea = idea;
        this.audience = audience;
        this.solution = solution;
        this.socialProof = socialProof;
        this.lookAndFeel = lookAndFeel;
    }
    
    ideaChat(): BaseMessage[] {
        return [
            new AIMessage("What is your business?"),
        ];
    }
    
    audienceChat(): BaseMessage[] {
        return this.chatBuilder(
            this.ideaChat(),
            this.idea,
            "That's awesome! And what about your audience?"
        );
    }
    
    solutionChat(): BaseMessage[] {
        return this.chatBuilder(
            this.audienceChat(),
            this.audience,
            "That's awesome! And what about your solution?"
        );
    }
    
    socialProofChat(): BaseMessage[] {
        return this.chatBuilder(
            this.solutionChat(),
            this.solution,
            "That's awesome! And what about your social proof?"
        );
    }
    
    lookAndFeelChat(): BaseMessage[] {
        return this.chatBuilder(
            this.socialProofChat(),
            this.socialProof,
            "That's awesome! Use the Advanced sidebar or click \"Build My Site\" to create your landing page."
        );
    }
    
    private chatBuilder(chatStart: BaseMessage[], messageList: string[], chatEnd: string): BaseMessage[] {
        return [
            ...chatStart,
            ...this.mapWithIsLastItem<string, AIMessage | HumanMessage>(messageList, (message, isLast) => {
                if (isLast) {
                    return [new HumanMessage(message)];
                }
                return [
                    new HumanMessage(message),
                    new AIMessage("Interesting, I need some more information! Can you tell me more about that?")
                ];
            }),
            new AIMessage(chatEnd),
        ];
    }
    
    private mapWithIsLastItem<T, R>(array: T[], callback: (item: T, isLast: boolean) => R[]): R[] {
        const lastIndex = array.length - 1;
        return array.flatMap((item, index) => {
            return callback(item, index === lastIndex);
        });
    }
}

const SimpleChatHistory = new ChatHistory({
    idea: [validAnswers.idea],
    audience: [validAnswers.audience],
    solution: [validAnswers.solution],
    socialProof: [validAnswers.socialProof],
    lookAndFeel: [validAnswers.lookAndFeel],
})

const MeanderingChatHistory = new ChatHistory({
    idea: [
        `I have an idea for a business`,
        `Basically, it will be for fitness`,
        `I am a fitness trainer`,
        `I'm a trainer for men in their 50s, nobody caters to them`,
    ],
    audience: [
        `Men in their 50s`,
        `They've been told they're too old to get fit`,
        `Many of my clients have no experience with fitness, which is hard after a lifetime`,
    ],
    solution: [
        `My fitness program is specifically designed`,
        `To help men get started lifting, but using bodyweight exercises, and focusing on injury prevention`,
        `I provide a 12-week progressive strength program with 3x/week 30-minute sessions focused on back and core-done via video coaching to accommodate busy schedules of men in their 50s.
        When a man in his 50s completes the program, he finally feels like himself again. He realizes he's not too old to get fit, and he's not too old to be healthy.`,
    ],
    socialProof: [`I've helped over 50 men in their 50s get fit`, `Many of them have never exercised before`, `One lost 50 pounds in 6 months`],
    lookAndFeel: [`I'm finished`],
})

const restartChatFrom = async (topic: Brainstorm.TopicName, useHistory: ChatHistory): Promise<GraphTestBuilder<BrainstormGraphState>> => {
    // create chat history
    const chatMethodMap: Record<Brainstorm.TopicName, () => BaseMessage[]> = {
        idea: () => useHistory.ideaChat(),
        audience: () => useHistory.audienceChat(),
        solution: () => useHistory.solutionChat(),
        socialProof: () => useHistory.socialProofChat(),
        lookAndFeel: () => useHistory.lookAndFeelChat(),
    };
    
    const chatHistory = chatMethodMap[topic]();

    const threadId = uuidv7();
    const config = { configurable: { thread_id: threadId } };
    let partialState = await createBrainstorm({
        jwt: "test-jwt",
        threadId,
        messages: [],
    } as any, config);

    // If we restart chat from "idea", then everything up to and including "idea"
    // has been answered
    let allMessages: BaseMessage[] = [];
    
    for (let i = 0; i < Brainstorm.BrainstormTopics.indexOf(topic); i++) {
        const currentTopic = Brainstorm.BrainstormTopics[i];
        const nextTopic = Brainstorm.BrainstormTopics[i + 1];
        
        // Get ALL messages up to next question from the raw chat history
        const chatHistoryToNextQuestion = chatMethodMap[nextTopic as Brainstorm.TopicName]();
        const fullChatUpToNextQuestion = chatHistoryToNextQuestion.slice(0, -1);
        
        // Get only the NEW messages since our last iteration (after already-tagged messages)
        const newMessages = fullChatUpToNextQuestion.slice(allMessages.length);
        
        // Append new messages to our tagged history
        allMessages = [...allMessages, ...newMessages];

        partialState = {
            ...partialState,
            messages: allMessages,
            currentTopic,
        }
        
        const result = await summarizeAndSaveAnswers(allMessages, partialState.websiteId!, []);
        
        // Capture the tagged messages for next iteration
        allMessages = result.messages!;
        partialState = {
            ...partialState,
            messages: allMessages,
        };
    }

    // Get all the saved memories we have
    const memories = await (new BrainstormNextStepsService(partialState as any)).getMemories();

    // Append any new messages from chatHistory that come after our tagged messages
    const newMessages = chatHistory.slice(allMessages.length);
    const finalMessages = [...allMessages, ...newMessages];

    // create state
    const state = {
        ...partialState,
        memories,
        messages: finalMessages,
        currentTopic: topic,
    }

    return testGraph<BrainstormGraphState>()
        .withGraph(brainstormGraph)
        .withState(state)
}

describe.sequential('Brainstorming Flow', () => {
    beforeEach(async () => {
        await DatabaseSnapshotter.restoreSnapshot("basic_account");
    }, 30000)

    describe("Chat flow", () => {
        it("should default to the first question", async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Sorry, what's going on?`)
                .execute();

            expect(result.state.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('idea');
            expect(result.state.placeholderText).toEqual('I want to acquire leads, sell my product...')
            expect(result.state.availableCommands).toHaveLength(1);
            expect(result.state.availableCommands[0]).toBe('helpMe');
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
            expect(aiResponse?.content).toMatch(/restaurant|cafe|recipes|brand/i)
            expect(result.state.availableCommands).toHaveLength(1);
            expect(result.state.availableCommands[0]).toBe('helpMe');

            const response = aiResponse?.response_metadata as Brainstorm.ReplyType;
            const structuredOutput = response.parsed_blocks![0].parsed!;

            assertDefined(structuredOutput);
            expect(structuredOutput.type).toBe('reply');
            expect(structuredOutput.text).toBeDefined()
            expect(structuredOutput.examples).toBeDefined()
            expect(structuredOutput.conclusion).toBeDefined()
        });

        it("should update to the next question when we successfully give a business idea", async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(validAnswers.idea)
                .stopAfter('agent')
                .execute();

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withState(result.state)
                .withPrompt(`We personally vet every single host and guest on our platform. We
                    check guest credibility and expertise. Audience alignment between hosts and guests. And those become data points in our AI-powered recommendations.`)
                .stopAfter('agent')
                .execute();

            const aiResponse = lastAIMessage(result2.state);
            assertDefined(aiResponse, 'aiResponse is defined');

            expect(result2.state.error).toBeUndefined();
            expect(result2.state.currentTopic).toBeOneOf(['audience', 'solution', 'socialProof']);

            // It saves the answer to the memories...
            const memories = result2.state.memories;

            expect(memories.idea).toBeTruthy();

            expect(result2.state.availableCommands).toHaveLength(3);
            expect(result2.state.availableCommands[0]).toBe('helpMe');
            expect(result2.state.availableCommands[1]).toBe('skip');
            expect(result2.state.availableCommands[2]).toBe('doTheRest');
        });

        it('should ask about solution after audience', async () => {
            const graph = await restartChatFrom('audience', SimpleChatHistory);
            const result = await graph
                .withPrompt(validAnswers.audience)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('solution');
            expect(result.state.placeholderText).toEqual(`My solution is...`)

            expect(result.state.availableCommands).toHaveLength(3);
            expect(result.state.availableCommands[0]).toBe('helpMe');
            expect(result.state.availableCommands[1]).toBe('skip');
            expect(result.state.availableCommands[2]).toBe('doTheRest');

            expect(lastAIResponse.content).toMatch(/solution|before|after|transformation|benefits/i)
            const structuredOutput = lastAIResponse.response_metadata.parsed_blocks![0].parsed! as Brainstorm.ReplyType;
            expect(structuredOutput.type).toBe('reply');
            expect(structuredOutput.text).toBeDefined()
            expect(structuredOutput.examples).toBeDefined()
            expect(structuredOutput.conclusion).toBeDefined()
        })

        it('should ask about social proof after solution', async () => {
            const graph = await restartChatFrom('solution', SimpleChatHistory);
            const result = await graph
                .withPrompt(validAnswers.solution)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('socialProof');
            expect(result.state.placeholderText).toEqual(`My social proof is...`)

            expect(result.state.availableCommands).toHaveLength(3);
            expect(result.state.availableCommands[0]).toBe('helpMe');
            expect(result.state.availableCommands[1]).toBe('skip');
            expect(result.state.availableCommands[2]).toBe('doTheRest');

            expect(lastAIResponse.content).toContain('social proof');
        });

        it('should tell the user about the UI when ready for lookAndFeel', async () => {
            const graph = await restartChatFrom('socialProof', SimpleChatHistory);
            const result = await graph
                .withPrompt(validAnswers.socialProof)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.currentTopic).toBe('lookAndFeel');
            expect(result.state.placeholderText).toEqual(`Use the Advanced sidebar or click "Build My Site"...`)

            expect(result.state.availableCommands).toHaveLength(1);
            expect(result.state.availableCommands[0]).toBe('finished');

            expect(lastAIResponse.content).toContain(`Brand Personalization panel`);
            expect(lastAIResponse.content).toContain(`Build My Site`);

            expect(result.state.memories.idea).toBeTruthy();
            expect(result.state.memories.audience).toBeTruthy();
            expect(result.state.memories.solution).toBeTruthy();
            expect(result.state.memories.socialProof).toBeTruthy();
        });

        it('ends the chat when user says they are finished', async () => {
            const graph = await restartChatFrom('lookAndFeel', SimpleChatHistory);
            const result = await graph
                .withPrompt(`Let's build my page!`)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.redirect).toBe('website_builder');
        });
    })

    describe("After brainstorming is done...", () => {
        it("(finished | done) returns redirect when user verbally expresses that they want to move on", async () => {
            const graph = await restartChatFrom('lookAndFeel', SimpleChatHistory);
            const result = await graph
                .withPrompt(`That's alright, let's move on`)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.redirect).toEqual("website_builder");
        });

        it("answers questions about UI", async () => {
            const graph = await restartChatFrom('lookAndFeel', SimpleChatHistory);
            const result = await graph
                .withPrompt(`Sorry, where do I add logos?`)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.redirect).toBeUndefined();

            expect(lastAIResponse.content).toContain('Brand Personalization panel');
        })

        it("answers questions about next steps", async () => {
            const graph = await restartChatFrom('lookAndFeel', SimpleChatHistory);
            const result = await graph
                .withPrompt(`And what happens after this?`)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.redirect).toBeUndefined();

            expect(lastAIResponse.content).toMatch(/landing page|site/i);
            expect(lastAIResponse.content).toMatch(/ads campaign|launch ads|drive traffic/i);
            expect(lastAIResponse.content).toMatch(/validate your idea|validate idea|validate business idea|iterate|learn|excited to buy|test|validate/i);
        })

        it("answers questions about how things will be used", async () => {
            const graph = await restartChatFrom('lookAndFeel', SimpleChatHistory);
            const result = await graph
                .withPrompt(`Are you guys stealing my data? My business idea?`)
                .stopAfter('agent')
                .execute();

            const lastAIResponse = lastAIMessage(result.state);
            assertDefined(lastAIResponse, 'lastAIResponse is defined');

            expect(result.error).toBeUndefined();
            expect(result.state.redirect).toBeUndefined();

            expect(lastAIResponse.content).toMatch(/absolutely not|no|not at all|definitely not/i);
            const structuredOutput = lastAIResponse.response_metadata.parsed_blocks![0];
            expect(structuredOutput).toBeDefined();
            expect(structuredOutput.type).toBe('text');
        })
    });

    describe("Tagging conversation topics", () => {
        it("tags a group of messages as belonging to the same topic", async () => {
            const graph = await restartChatFrom('solution', MeanderingChatHistory);
            const nextMessage = MeanderingChatHistory.solution.at(0) as string;
            const result1 = await graph
                .withPrompt(nextMessage)
                .execute();

            // We haven't successfully answered the question yet
            const currentTopic1 = result1.state.currentTopic;
            expect(currentTopic1).toBe('solution');

            const nextMessage2 = MeanderingChatHistory.solution.at(1) as string;
            const result2 = await graph
                .withPrompt(nextMessage2)
                .withState({
                    ...result1.state,
                })
                .execute();

            // Still not successfully answered
            const currentTopic2 = result2.state.currentTopic;
            expect(currentTopic2).toBe('lookAndFeel');

            expect(result2.state.memories.idea).toBeTruthy();
            expect(result2.state.memories.audience).toBeTruthy();
            expect(result2.state.memories.solution).toBeTruthy();
            expect(result2.state.memories.socialProof).toBeTruthy();
        });
    })

    describe("Actions", () => {
        describe("SKIP | skip", () => {
            it("cannot skip unskippable questions", async () => {
                const graph = await restartChatFrom('idea', SimpleChatHistory);
                const result = await graph
                    .withPrompt("Skip")
                    .stopAfter('agent')
                    .execute();

                const lastAIResponse = lastAIMessage(result.state);
                assertDefined(lastAIResponse, 'lastAIResponse is defined');

                expect(result.error).toBeUndefined();

                // Does not skip
                expect(result.state.skippedTopics).toHaveLength(0);

                expect(result.state.currentTopic).toBe('idea');
                expect(result.state.placeholderText).toEqual(`I want to acquire leads, sell my product...`)

                expect(lastAIResponse.content).toContain(`can't`)
            })

            it("skips a single question", async () => {
                const graph = await restartChatFrom('audience', SimpleChatHistory);
                const result = await graph
                    .withPrompt("Skip")
                    .stopAfter('agent')
                    .execute();

                const lastAIResponse = lastAIMessage(result.state);
                assertDefined(lastAIResponse, 'lastAIResponse is defined');

                expect(result.error).toBeUndefined();

                // Skips from audience to solution
                expect(result.state.skippedTopics).toHaveLength(1);
                expect(result.state.skippedTopics[0]).toBe('audience');

                expect(result.state.currentTopic).toBe('solution');
                expect(result.state.placeholderText).toEqual(`My solution is...`)

                expect(result.state.availableCommands).toHaveLength(3);
                expect(result.state.availableCommands[0]).toBe('helpMe');
                expect(result.state.availableCommands[1]).toBe('skip');
                expect(result.state.availableCommands[2]).toBe('doTheRest');

                expect(lastAIResponse.content).toContain('solution');
            });

            it("returns to the question at the end / answers it for you", async () => {
                const graph = await restartChatFrom('audience', SimpleChatHistory);
                const result1 = await graph
                    .withPrompt("Skip")
                    .stopAfter('agent')
                    .execute(); // audience -> solution

                expect(result1.state.skippedTopics).toHaveLength(1);

                const result2 = await graph
                    .withPrompt("Skip")
                    .stopAfter('agent')
                    .withState({
                        ...result1.state,
                    })
                    .execute(); // solution -> socialProof

                expect(result2.state.skippedTopics).toHaveLength(2);
                expect(result2.state.currentTopic).toBe('socialProof');

                const result3 = await graph
                    .withPrompt("Skip")
                    .stopAfter('agent')
                    .withState({
                        ...result2.state,
                    })
                    .execute(); // socialProof -> do the rest before user is finished
                expect(result3.state.skippedTopics).toHaveLength(0); // Would have been 2, but since we hit the end of the road, the AI answered the question

                const result = result3;

                const lastAIResponse = lastAIMessage(result.state);
                assertDefined(lastAIResponse, 'lastAIResponse is defined');

                expect(result.error).toBeUndefined();
                expect(result.state.skippedTopics).toHaveLength(0);

                expect(result.state.currentTopic).toBe('lookAndFeel');
                expect(result.state.placeholderText).toMatch(`Use the Advanced sidebar`)

                expect(result.state.memories.idea).toBeTruthy();
                expect(result.state.memories.audience).toBeTruthy();
                expect(result.state.memories.solution).toBeTruthy();
                expect(result.state.memories.socialProof).toBeTruthy();

                expect(lastAIResponse.content).toContain('Personalize the design');
                expect(lastAIResponse.content).toContain('Build right away');
            });
        });

        describe("HELP_ME_ANSWER", () => {
            it("provides structured guidance to the user", async () => {
                const graph = await restartChatFrom('audience', SimpleChatHistory);
                const result = await graph
                    .withPrompt("Help me answer this question")
                    .stopAfter('agent')
                    .execute();

                const lastAIResponse = lastAIMessage(result.state);
                assertDefined(lastAIResponse, 'lastAIResponse is defined');

                expect(result.error).toBeUndefined();

                expect(result.state.currentTopic).toBe('audience');
                expect(result.state.placeholderText).toEqual(`My target audience is...`)

                expect(result.state.availableCommands).toHaveLength(3);
                expect(result.state.availableCommands[0]).toBe('helpMe');
                expect(result.state.availableCommands[1]).toBe('skip');
                expect(result.state.availableCommands[2]).toBe('doTheRest');

                expect(lastAIResponse.content).toMatch(/audience|who|keeps them up at night/i)
                let parsed = lastAIResponse.response_metadata.parsed_blocks![0].parsed as Brainstorm.HelpMeResponseType;
                expect(parsed.type).toBe('helpMe');
                expect(parsed.text).toBeDefined()
                expect(parsed.template).toBeDefined()
                expect(parsed.examples).toBeDefined()
            });
        });

        describe("DO_THE_REST", () => {
            it("completes the brainstorming and provides only FINISHED action", async () => {
                const graph = await restartChatFrom('audience', SimpleChatHistory);
                const command = Brainstorm.commandToPrompt("doTheRest");
                const result = await graph
                    .withPrompt(command)
                    .stopAfter('agent')
                    .execute(); // audience -> solution

                const lastAIResponse = lastAIMessage(result.state);
                assertDefined(lastAIResponse, 'lastAIResponse is defined');

                expect(result.error).toBeUndefined();

                expect(result.state.currentTopic).toBe('lookAndFeel');
                expect(result.state.placeholderText).toMatch(`Use the Advanced sidebar`)

                expect(result.state.memories.idea).toBeTruthy();
                expect(result.state.memories.audience).toBeTruthy();
                expect(result.state.memories.solution).toBeTruthy();
                expect(result.state.memories.socialProof).toBeTruthy();

                expect(lastAIResponse.content).toMatch(/personalize|brand|logo|colors|palette/i);
                expect(lastAIResponse.content).toMatch(/build|landing page|site/i);
            });

            it("does not do the rest when we haven't done anything yet", async () => {
                const graph = await restartChatFrom('idea', SimpleChatHistory);
                const command = Brainstorm.commandToPrompt("doTheRest");
                const result = await graph
                    .withPrompt(command)
                    .stopAfter('agent')
                    .execute();

                const lastAIResponse = lastAIMessage(result.state);
                assertDefined(lastAIResponse, 'lastAIResponse is defined');

                expect(result.error).toBeUndefined();

                // Does not skip
                expect(result.state.skippedTopics).toHaveLength(0);

                expect(result.state.currentTopic).toBe('idea');
                expect(result.state.placeholderText).toEqual(`I want to acquire leads, sell my product...`)

                expect(lastAIResponse.content).toContain(`can't`)
            });
        });
    });

    describe("Edge cases", () => {
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
            expect(result2.state.messages).toHaveLength(4);

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
        });
    });
});