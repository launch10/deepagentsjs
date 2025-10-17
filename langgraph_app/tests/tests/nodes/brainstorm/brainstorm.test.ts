import { describe, it, expect, beforeAll } from 'vitest';
import { testGraph } from '@support';
import { type BrainstormGraphState } from '@state';
import { databaseSnapshotter } from '@services';
import { brainstormGraph } from '@graphs';
import { HumanMessage } from '@langchain/core/messages';
import { 
    isHumanMessage, 
    isAIMessage, 
    Brainstorm,
    type Message,
} from '@types';

type StructuredQuestionContentType = Brainstorm.StructuredQuestionContentType;
type QuestionType = Brainstorm.QuestionType;
type StructuredQuestionType = Brainstorm.StructuredQuestionType;

const getSimpleQuestion = Brainstorm.getSimpleQuestion;

const expectStructuredOutput = (question: StructuredQuestionType) => {
    const questionContent: StructuredQuestionContentType = question.question;
    expect(typeof questionContent).toBe('object');
    
    expect(questionContent.intro).toBeTruthy();

    expect(questionContent.sampleResponses).toHaveLength(3);
    expect(questionContent.sampleResponses[0]).toBeTruthy();
    expect(questionContent.sampleResponses[1]).toBeTruthy();
    expect(questionContent.sampleResponses[2]).toBeTruthy();
    
    expect(questionContent.conclusion).toBeTruthy();
}

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

            expect(result.state.error).toBeUndefined();
            expect(result.state.questionIndex).toBe(0);
            const question = result.state.nextQuestion;
            expect(typeof question).toBe('object');

            expect(question.key).toBe('introduction');
            expect(question.type).toBe('structured'); // We now give the user more information...

            if (question.type === 'structured') {
                expectStructuredOutput(question);
            }
        });

        it('the first message is asked (tacitly) by the existing UI. the 2nd message is the first question after that.', async () => {
            const result = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            expect(result.error).toBeUndefined();
            expect(result.state.questionIndex).toBe(1);

            const question: QuestionType = result.state.nextQuestion;
            expect(question.key).toBe('customers');
            expect(question.type).toBe('structured');

            if (question.type === 'structured') {
                expectStructuredOutput(question);
            }

            // 1 tacit AI message ("What is your business?") + 
            // 1 human ("Friend of the Pod is a podcast matchmaking service.") + 
            // 1 AI ("Who are your customers, and what are they trying to achieve? + 3 sample responses")
            expect(result.state.messages).toHaveLength(3);
        });

        it("should ask the 2nd question again if the user fails the guardrail", async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            expect(result1.state.questionIndex).toBe(1);
            expect(result1.state.nextQuestion.key).toBe('customers');
            expect(result1.state.userNeedsHelp).toBe(false);

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`I like pasta.`)
                .withState({
                    messages: result1.state.messages,
                    questionIndex: result1.state.questionIndex
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.questionIndex).toBe(1);
            expect(result2.state.userNeedsHelp).toBe(true);
            expect(result2.state.nextQuestion.key).toBe('customers');

            // We should address the pasta response somewhere
            expect(JSON.stringify(result2.state.nextQuestion.question)).toContain('pasta');

            const result3 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Pasta is so good it makes me want to die.`)
                .withState({
                    messages: result2.state.messages,
                    questionIndex: result2.state.questionIndex
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result3.error).toBeUndefined();
            expect(result3.state.questionIndex).toBe(1);
            expect(result3.state.userNeedsHelp).toBe(true);
            expect(result3.state.nextQuestion.key).toBe('customers');

            // We should address the pasta response somewhere
            expect(JSON.stringify(result3.state.nextQuestion.question)).toContain('pasta');

            // initial AI question ("Tell us about your business")
            // user response (good)
            // AI asks about customers
            // pasta response (bad)
            // AI guides back...
            // user is still excited about pasta...
            // AI guides back... -> 7 messages
            expect(result3.state.messages).toHaveLength(7);
            expect(result3.state.messages?.filter((msg) => isHumanMessage(msg))).toHaveLength(3);
            expect(result3.state.messages?.filter((msg) => isAIMessage(msg))).toHaveLength(4);
        });

        it('should ask third question (structured) after second response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Podcasts guests looking to promote their book or service`)
                .withState({
                    messages: result1.state.messages,
                    questionIndex: result1.state.questionIndex
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.questionIndex).toBe(2);
            
            const question: QuestionType = result2.state.nextQuestion;
            expect(question.key).toBe("valueProp");
            expect(question.type).toBe("structured");
            expect(typeof question).toBe('object');
            
            if (question.type === 'structured') {
                expectStructuredOutput(question);
            }
            
            expect(result2.state.messages).toHaveLength(5);
            expect(result2.state.messages?.filter((msg) => isHumanMessage(msg))).toHaveLength(2);
            expect(result2.state.messages?.filter((msg) => isAIMessage(msg))).toHaveLength(3);
        });

        it('should ask fourth question after third response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
                .execute();

            const messages2: Message[] = [
                ...result1.state.messages,
                getSimpleQuestion(1), // Audience
                new HumanMessage(`Podcasts guests looking to promote their book or service`),
                getSimpleQuestion(2), // What's your value prop?
            ];

            const result2 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`We match podcast hosts and guests to find the perfect audience to promote your product!`)
                .withState({
                    messages: messages2,
                    questionIndex: 2
                })
                .stopAfter('askQuestion')
                .execute();

            expect(result2.state.error).toBeUndefined()

            const question: QuestionType = result2.state.nextQuestion;
            expect(question.key).toBe("socialProof");
            expect(question.type).toBe("structured");
            expect(typeof question).toBe('object');

            if (question.type === 'structured') {
                expectStructuredOutput(question)
            }

            expect(result2.error).toBeUndefined();
            expect(result2.state.questionIndex).toBe(3);
        });

        it('should ask fifth question (verbatim) after fourth response', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
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
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();

            const question = result2.state.nextQuestion;
            expect(question.key).toBe("lookAndFeel");
            expect(question.type).toBe("simple");
            expect(typeof question).toBe('object');
            expect(result2.state.nextQuestion.question).toBe("Before we build, do you have a logo, color palette, or images you want to include?");
            expect(result2.state.questionIndex).toBe(4);
        });

        it.only('guides the user to use the Advanced features before proceeding on question 5', async () => {
            const result1 = await testGraph<BrainstormGraphState>()
                .withGraph(brainstormGraph)
                .withPrompt(`Friend of the Pod is a podcast matchmaking service.`)
                .stopAfter('askQuestion')
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
                .stopAfter('askQuestion')
                .execute();

            expect(result2.error).toBeUndefined();
            expect(result2.state.questionIndex).toBe(4);

            const lastAiResponse = result2.state.messages.filter(isAIMessage).slice(-1)
            console.log(lastAiResponse.content)
        });
    });
});