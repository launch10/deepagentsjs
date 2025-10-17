import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { AIMessage, BaseMessage, type BaseMessageLike } from "@langchain/core/messages";
import { Brainstorm, isHumanMessage, type Message } from "@types";

const getFirstQuestion = Brainstorm.getFirstQuestion
type QuestionType = Brainstorm.QuestionType;
type NextStepType = Brainstorm.NextStepType;

export const BrainstormAnnotation = Annotation.Root({
    error: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    jwt: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    accountId: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    messages: Annotation<Message[], Message[]>({ 
        default: () => [],
        reducer: (existing, incoming) => {
            if (Array.isArray(incoming) && incoming.length > 0 && incoming.length > existing.length) {
                const firstQuestion: AIMessage = getFirstQuestion();
                const incomingQuestion = incoming[0];
                if (!incomingQuestion || !isHumanMessage(incomingQuestion)) {
                    return incoming;
                }
                const hasFirstQuestion = incomingQuestion.content === firstQuestion.content;
                if (hasFirstQuestion && existing.length > 0 && existing[0]?.content !== firstQuestion.content) {
                    return incoming;
                }
            }
            return messagesStateReducer(existing, incoming) as unknown as Message[];
        }
    }),

    nextQuestion: Annotation<QuestionType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    nextStep: Annotation<NextStepType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    questionIndex: Annotation<number>({
        default: () => 0,
        reducer: (current, next) => next
    }),

    isValidAnswer: Annotation<boolean | undefined>({
        default: () => true,
        reducer: (current, next) => next
    }),

    route: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),
});