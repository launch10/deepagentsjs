import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { AIMessage, BaseMessage, type BaseMessageLike } from "@langchain/core/messages";
import type { BrainstormNextStepType, QuestionType, Message } from "@types";
import { getFirstQuestion, isHumanMessage } from "@types";

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

    nextStep: Annotation<BrainstormNextStepType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    questionIndex: Annotation<number>({
        default: () => 0,
        reducer: (current, next) => next
    }),

    userNeedsHelp: Annotation<boolean | undefined>({
        default: () => false,
        reducer: (current, next) => next
    }),
});