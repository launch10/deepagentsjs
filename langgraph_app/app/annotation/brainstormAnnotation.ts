import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage, type BaseMessageLike } from "@langchain/core/messages";
import type { BrainstormNextStepType, QuestionType } from "@types";

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

    messages: Annotation<BaseMessage[], BaseMessageLike[]>({ 
        default: () => [],
        reducer: messagesStateReducer
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
});