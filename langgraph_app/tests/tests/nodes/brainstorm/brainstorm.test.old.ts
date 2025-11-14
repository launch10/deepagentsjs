// import { describe, it, expect, beforeAll } from 'vitest';
// import { testGraph } from '@support';
// import { type BrainstormGraphState } from '@state';
// import { DatabaseSnapshotter } from '@services';
// import { brainstormGraph } from '@graphs';
// import { HumanMessage } from '@langchain/core/messages';
// import { 
//     isHumanMessage, 
//     isAIMessage, 
//     Brainstorm,
//     type Message,
// } from '@types';
// import { ContentStrategyModel } from '@models';

// type StructuredQuestionContentType = Brainstorm.StructuredQuestionContentType;
// type QuestionType = Brainstorm.QuestionType;
// type StructuredQuestionType = Brainstorm.StructuredQuestionType;

// const getSimpleQuestion = Brainstorm.getSimpleQuestion;

// const expectStructuredOutput = (question: StructuredQuestionType) => {
//     const questionContent: StructuredQuestionContentType = question.question;
//     expect(typeof questionContent).toBe('object');
    
//     expect(questionContent.intro).toBeTruthy();

//     expect(questionContent.sampleResponses).toHaveLength(3);
//     expect(questionContent.sampleResponses[0]).toBeTruthy();
//     expect(questionContent.sampleResponses[1]).toBeTruthy();
//     expect(questionContent.sampleResponses[2]).toBeTruthy();
    
//     expect(questionContent.conclusion).toBeTruthy();
// }

// // TODO: 
// // Don't forget about: https://js.langchain.com/docs/integrations/chat/fake/
// // We should update our decorators to use the fake chat pattern we used in langgraph-ai-sdk library
// //
// describe.sequential('Brainstorming Flow', () => {
//     beforeAll(async () => {
//         await DatabaseSnapshotter.restoreSnapshot("basic_account");
//     })

//     // TODO:
//     // Ensure we have a "suggested next question" data point in state. E.g. for placeholder text
//     describe("Suggested next question", () => {
//         it("should default to the first question", async () => {
//             const result = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Sorry, what's going on?`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result.state.error).toBeUndefined();
//             expect(result.state.questionIndex).toBe(0);
//             expect(result.state.nextQuestion.placeholderText).toEqual('I want to acquire leads, sell my product...')
//         });

//         it("should stay consistent when the user answers the first question incorrectly", async () => {
//             const result = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`I like pasta.`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result.state.error).toBeUndefined();
//             expect(result.state.questionIndex).toBe(0);
//             expect(result.state.nextQuestion.placeholderText).toEqual('I want to acquire leads, sell my product...')
//         });

//         it("should update to the next question when we ask it", async () => {
//             const result = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result.state.error).toBeUndefined();
//             expect(result.state.questionIndex).toBe(0);
//             expect(result.state.nextQuestion.placeholderText).toEqual('Who are your customers, and what are they trying to achieve?')
//         });
//     })

//     describe("Full brainstorming conversation flow", () => {
//         it("provides additional support if the first question isn't properly answered", async () => {
//             const result = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Sorry, what's going on?`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result.state.error).toBeUndefined();
//             expect(result.state.questionIndex).toBe(0);
//             const question = result.state.nextQuestion;
//             expect(typeof question).toBe('object');

//             expect(question.key).toBe('introduction');
//             expect(question.type).toBe('helpful'); // We now give the user more information...

//             if (question.type === 'helpful') {
//                 expectStructuredOutput(question);
//             }
//         });

//         it.only('the first message is asked (tacitly) by the existing UI. the 2nd message is the first question after that.', async () => {
//             const result = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result.error).toBeUndefined();
//             expect(result.state.questionIndex).toBe(1);

//             const question: QuestionType = result.state.nextQuestion;
//             expect(question.key).toBe('customers');
//             expect(question.type).toBe('structured');

//             if (question.type === 'structured') {
//                 expectStructuredOutput(question);
//             }

//             // 1 tacit AI message ("What is your business?") + 
//             // 1 human ("Friend of the Pod is a podcast matchmaking service.") + 
//             // 1 AI ("Who are your customers, and what are they trying to achieve? + 3 sample responses")
//             expect(result.state.messages).toHaveLength(3);
//         });

//         it("should ask the 2nd question again if the user fails the guardrail", async () => {
//             const result1 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result1.state.questionIndex).toBe(1);
//             expect(result1.state.nextQuestion.key).toBe('customers');
//             expect(result1.state.isValidAnswer).toBe(true);

//             const result2 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`I like pasta.`)
//                 .withState({
//                     messages: result1.state.messages,
//                     questionIndex: result1.state.questionIndex
//                 })
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result2.error).toBeUndefined();
//             expect(result2.state.questionIndex).toBe(1);
//             expect(result2.state.isValidAnswer).toBe(false);
//             expect(result2.state.nextQuestion.key).toBe('customers');

//             // We should address the pasta response somewhere
//             expect(JSON.stringify(result2.state.nextQuestion.question)).toContain('pasta');

//             const result3 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Pasta is so good it makes me want to die.`)
//                 .withState({
//                     messages: result2.state.messages,
//                     questionIndex: result2.state.questionIndex
//                 })
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result3.error).toBeUndefined();
//             expect(result3.state.questionIndex).toBe(1);
//             expect(result3.state.isValidAnswer).toBe(false);
//             expect(result3.state.nextQuestion.key).toBe('customers');

//             // We should address the pasta response somewhere
//             expect(JSON.stringify(result3.state.nextQuestion.question)).toContain('pasta');

//             // initial AI question ("Tell us about your business")
//             // user response (good)
//             // AI asks about customers
//             // pasta response (bad)
//             // AI guides back...
//             // user is still excited about pasta...
//             // AI guides back... -> 7 messages
//             expect(result3.state.messages).toHaveLength(7);
//             expect(result3.state.messages?.filter((msg) => isHumanMessage(msg))).toHaveLength(3);
//             expect(result3.state.messages?.filter((msg) => isAIMessage(msg))).toHaveLength(4);
//         });

//         it('should ask third question (structured) after second response', async () => {
//             const result1 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             const result2 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Podcasts guests looking to promote their book or service`)
//                 .withState({
//                     messages: result1.state.messages,
//                     questionIndex: result1.state.questionIndex
//                 })
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result2.error).toBeUndefined();
//             expect(result2.state.questionIndex).toBe(2);
            
//             const question: QuestionType = result2.state.nextQuestion;
//             expect(question.key).toBe("valueProp");
//             expect(question.type).toBe("structured");
//             expect(typeof question).toBe('object');
            
//             if (question.type === 'structured') {
//                 expectStructuredOutput(question);
//             }
            
//             expect(result2.state.messages).toHaveLength(5);
//             expect(result2.state.messages?.filter((msg) => isHumanMessage(msg))).toHaveLength(2);
//             expect(result2.state.messages?.filter((msg) => isAIMessage(msg))).toHaveLength(3);
//         });

//         it('should ask fourth question after third response', async () => {
//             const result1 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             const messages2: Message[] = [
//                 ...result1.state.messages,
//                 getSimpleQuestion(1), // Audience
//                 new HumanMessage(`Podcasts guests looking to promote their book or service`),
//                 getSimpleQuestion(2), // What's your value prop?
//             ];

//             const result2 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`We match podcast hosts and guests to find the perfect audience to promote your product!`)
//                 .withState({
//                     messages: messages2,
//                     questionIndex: 2
//                 })
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result2.state.error).toBeUndefined()

//             const question: QuestionType = result2.state.nextQuestion;
//             expect(question.key).toBe("socialProof");
//             expect(question.type).toBe("structured");
//             expect(typeof question).toBe('object');

//             if (question.type === 'structured') {
//                 expectStructuredOutput(question)
//             }

//             expect(result2.error).toBeUndefined();
//             expect(result2.state.questionIndex).toBe(3);
//         });

//         it('should ask fifth question (verbatim) after fourth response', async () => {
//             const result1 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             const messages2: Message[] = [
//                 ...result1.state.messages,
//                 getSimpleQuestion(1), // Audience
//                 new HumanMessage(`Podcasts guests looking to promote their book or service`),
//                 getSimpleQuestion(2), // What's your value prop?
//                 new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
//                 getSimpleQuestion(3), // Social proof
//             ];

//             const result2 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`)
//                 .withState({
//                     messages: messages2,
//                     questionIndex: 3
//                 })
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result2.error).toBeUndefined();

//             const question = result2.state.nextQuestion;
//             expect(question.key).toBe("lookAndFeel");
//             expect(question.type).toBe("simple");
//             expect(typeof question).toBe('object');
//             expect(result2.state.nextQuestion.question).toBe("Before we build, do you have a logo, color palette, or images you want to include?");
//             expect(result2.state.questionIndex).toBe(4);
//         });

//         it('guides the user to use the Advanced features before proceeding on question 5', async () => {
//             const result1 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                 .stopAfter('askQuestion')
//                 .execute();

//             const messages2 = [
//                 ...result1.state.messages,
//                 getSimpleQuestion(1), // Audience
//                 new HumanMessage(`Podcasts guests looking to promote their book or service`),
//                 getSimpleQuestion(2), // What's your value prop?
//                 new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
//                 getSimpleQuestion(3), // Social proof
//                 new HumanMessage(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`),
//                 getSimpleQuestion(4),
//             ];

//             const result2 = await testGraph<BrainstormGraphState>()
//                 .withGraph(brainstormGraph)
//                 .withPrompt(`Yes, I have a logo and brand colors - blue and purple.`)
//                 .withState({
//                     messages: messages2,
//                     questionIndex: 4
//                 })
//                 .stopAfter('askQuestion')
//                 .execute();

//             expect(result2.error).toBeUndefined();
//             expect(result2.state.questionIndex).toBe(4);

//             const lastAiResponse = result2.state.messages.filter(isAIMessage).slice(-1)[0]
//             expect(lastAiResponse.content).toMatch(/Advanced Sidebar/)
//         });

//         describe("Brainstorming Finished", () => {
//             it("jumps to the next graph when user verbally expresses that they want to move on", async () => {
//                 const result1 = await testGraph<BrainstormGraphState>()
//                     .withGraph(brainstormGraph)
//                     .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                     .stopAfter('askQuestion')
//                     .execute();

//                 const messages2 = [
//                     ...result1.state.messages,
//                     getSimpleQuestion(1), // Audience
//                     new HumanMessage(`Podcasts guests looking to promote their book or service`),
//                     getSimpleQuestion(2), // What's your value prop?
//                     new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
//                     getSimpleQuestion(3), // Social proof
//                     new HumanMessage(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`),
//                     getSimpleQuestion(4),
//                 ];

//                 const result2 = await testGraph<BrainstormGraphState>()
//                     .withGraph(brainstormGraph)
//                     .withPrompt(`I don't want to do that, what do we do next?`)
//                     .withState({
//                         messages: messages2,
//                         questionIndex: 4
//                     })
//                     .stopAfter('askQuestion')
//                     .execute();

//                 expect(result2.error).toBeUndefined();
//                 expect(result2.state.questionIndex).toBe(4);

//                 expect(result2.state.redirect).toEqual("website_builder");
//             });

//             it("jumps to the next graph when user clicks 'Finished'", async () => {
//                 const result1 = await testGraph<BrainstormGraphState>()
//                     .withGraph(brainstormGraph)
//                     .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                     .stopAfter('askQuestion')
//                     .execute();

//                 const messages2 = [
//                     ...result1.state.messages,
//                     getSimpleQuestion(1), // Audience
//                     new HumanMessage(`Podcasts guests looking to promote their book or service`),
//                     getSimpleQuestion(2), // What's your value prop?
//                     new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
//                     getSimpleQuestion(3), // Social proof
//                     new HumanMessage(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`),
//                     getSimpleQuestion(4),
//                 ];

//                 const result2 = await testGraph<BrainstormGraphState>()
//                     .withGraph(brainstormGraph)
//                     .withState({
//                         messages: messages2,
//                         questionIndex: 4,
//                         action: "FINISHED"
//                     })
//                     .stopAfter('askQuestion')
//                     .execute();

//                 expect(result2.error).toBeUndefined();
//                 expect(result2.state.questionIndex).toBe(4);

//                 // It creates contents strategy
//                 // This should actually go in the WebsiteBuilder! To save time for the user... 
//                 const contentStrategy = await ContentStrategyModel.findBy({websiteId: result2.state.websiteId});
//                 expect(contentStrategy).toBeDefined();
//                 expect(contentStrategy.problemStatement).toBeDefined();
//                 expect(contentStrategy.socialProof).toBeDefined();
//                 expect(contentStrategy.callToAction).toBeDefined();

//                 expect(result2.state.redirect).toEqual("website_builder");
//             });
//         });

//         describe("Actions", () => {
//             describe("SKIP", () => {
//                 it("skips a single question", async () => {
//                     const result1 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const question: QuestionType = result1.state.nextQuestion;
//                     expect(question.key).toBe("customers");
//                     expect(question.type).toBe("structured");
//                     expect(typeof question).toBe('object');

//                     const result2 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withState({
//                             ...result1.state,
//                             action: "SKIP"
//                         })
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const state = result2.state;

//                     expect(result2.error).toBeUndefined();
//                     expect(state.questionIndex).toBe(2);

//                     // It skips to the next question
//                     const question2: QuestionType = state.nextQuestion;
//                     expect(question2.key).toBe("valueProp");
//                     expect(state.availableCommands).toEqual(["HELP_ME_ANSWER", "SKIP", "DO_THE_REST"]);

//                     const messages3 = [
//                         ...result2.state.messages,
//                         new HumanMessage(`We match podcast hosts and guests to find the perfect audience to promote your product!`),
//                         getSimpleQuestion(3), // Social proof
//                         new HumanMessage(`Yes, we have testimonials from over 50 podcasters with 5-star ratings.`),
//                         getSimpleQuestion(4),
//                     ];
//                     const result3 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withState({
//                             ...result3.state,
//                             messages: messages3,
//                             action: "FINISHED"
//                         })
//                         .stopAfter('askQuestion')
//                         .execute();

//                     // This should actually go in the WebsiteBuilder! Find another way to test this...
//                     // We should put this in MESSAGES...
//                     // const contentStrategy = await ContentStrategyModel.findBy({websiteId: result2.state.websiteId});
//                     // expect(contentStrategy).toBeDefined();
//                     // expect(contentStrategy.audience).toBeDefined(); // Even though we skipped this question, the AI brainstorms using the data available to it.
//                     const lastAiResponse = result3.state.messages.filter(isAIMessage).slice(-1);
//                     expect(lastAiResponse.content).toMatch(/based on everything you said.../) // we skipped this, so it answers at the end...
//                     expect(lastAiResponse.content).toMatch(/content creators/) // we skipped this, so it answers at the end...
//                 });

//                 it("allows user to make further adjustments", async () => {
//                     const result1 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const result2 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withState({
//                             ...result1.state,
//                             action: "DO_THE_REST"
//                         })
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const state = result2.state;

//                     expect(result2.error).toBeUndefined();
//                     expect(state.questionIndex).toBe(4);

//                     // It seeks approval
//                     expect(state.route).toEqual("seekApproval");
//                     expect(state.availableCommands).toEqual(["FINISHED"]);

//                     const result3 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withPrompt(`Actually, my customers are podcast creators, not podcast guests.`)
//                         .withState({
//                             ...result2.state,
//                         })
//                         .stopAfter('askQuestion')
//                         .execute();

//                     expect(result3.error).toBeUndefined();
//                     expect(result3.state.questionIndex).toBe(4);

//                     const lastAiResponse = state.messages?.filter(isAIMessage).slice(-1);
//                     expect(lastAiResponse.content).toMatch(/creators/) // It updates it understanding
//                     expect(lastAiResponse.content).toMatch(/social proof is affected by this change..../)
//                 });
//             });

//             describe("HELP_ME_ANSWER", () => {
//                 it("helps the user answer the question", async () => {
//                     const result1 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const question: QuestionType = result1.state.nextQuestion;
//                     expect(question.key).toBe("customers");
//                     expect(question.type).toBe("structured");
//                     expect(typeof question).toBe('object');

//                     const result2 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withState({
//                             ...result1.state,
//                             action: "HELP_ME_ANSWER"
//                         })
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const state = result2.state;

//                     expect(result2.error).toBeUndefined();
//                     expect(state.questionIndex).toBe(2);

//                     // It answers for the user as 2nd-to-last message
//                     const lastAiResponse = state.messages?.filter(isAIMessage).slice(-2);
//                     expect(lastAiResponse.content).toMatch(/content creators/) // The audience

//                     // Then it asks the next question...
//                     const question2: QuestionType = state.nextQuestion;
//                     expect(question2.key).toBe("valueProp"); // It prepares the next question
//                     expect(state.availableCommands).toEqual(["HELP_ME_ANSWER", "SKIP", "DO_THE_REST"]);

//                     const result3 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withPrompt(`Actually, it's for podcast listeners...`)
//                         .withState({
//                             ...result2.state,
//                         })
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const question3: QuestionType = state.nextQuestion;
//                     // We're still on value prop
//                     expect(question2.key).toBe("valueProp"); // It prepares the next question
//                     expect(state.availableCommands).toEqual(["HELP_ME_ANSWER", "SKIP", "DO_THE_REST"]);

//                     const lastAiResponse2 = state.messages?.filter(isAIMessage).slice(-1);
//                     expect(lastAiResponse2.content).toMatch(/content creators/) // The audience

//                     expect(lastAiResponse2.content).toMatch(/got it! Podcast listeners/)
//                     expect(lastAiResponse2.content).toMatch(/Now about our value prop/)
//                 });
//             });

//             describe("DO_THE_REST", () => {
//                 it("completes the brainstorming and provides only FINISHED action when user", async () => {
//                     const result1 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const result2 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withState({
//                             ...result1.state,
//                             action: "DO_THE_REST"
//                         })
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const state = result2.state;

//                     expect(result2.error).toBeUndefined();
//                     expect(state.questionIndex).toBe(4);

//                     // It seeks approval
//                     expect(state.route).toEqual("seekApproval");
//                     expect(state.availableCommands).toEqual(["FINISHED"]);

//                     // It spells out its intentions in message form...
//                     const lastAiResponse = state.messages?.filter(isAIMessage).slice(-1);
//                     expect(lastAiResponse.content).toMatch(/audience/) // Brainstorms a section we didn't previously
//                 });

//                 it("allows user to make further adjustments", async () => {
//                     const result1 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const result2 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withState({
//                             ...result1.state,
//                             action: "DO_THE_REST"
//                         })
//                         .stopAfter('askQuestion')
//                         .execute();

//                     const state = result2.state;

//                     expect(result2.error).toBeUndefined();
//                     expect(state.questionIndex).toBe(4);

//                     // It seeks approval
//                     expect(state.route).toEqual("seekApproval");
//                     expect(state.availableCommands).toEqual(["FINISHED"]);

//                     const result3 = await testGraph<BrainstormGraphState>()
//                         .withGraph(brainstormGraph)
//                         .withPrompt(`Actually, my customers are podcast creators, not podcast guests.`)
//                         .withState({
//                             ...result2.state,
//                         })
//                         .stopAfter('askQuestion')
//                         .execute();

//                     expect(result3.error).toBeUndefined();
//                     expect(result3.state.questionIndex).toBe(4);

//                     const lastAiResponse = state.messages?.filter(isAIMessage).slice(-1);
//                     expect(lastAiResponse.content).toMatch(/creators/) // It updates it understanding
//                     expect(lastAiResponse.content).toMatch(/social proof is affected by this change..../)
//                 });
//             });
//         });
//     });
// });

// // TODO:
// // Create project when first question is submitted
// // Name project when first question is submitted
// // Test next steps (Help me answer, skip, do the rest)
// // Test DO THE REST
//     // Seek approval
//     // User can access next steps
// // Summarize / create full content strategy on complete
// // Direct to next workflow ("redirect")