import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type { 
    ErrorStateType,
    Message,
    PrimaryKeyType,
 } from "@types";

export const BaseAnnotation = Annotation.Root({
    error: Annotation<ErrorStateType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    jwt: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    messages: Annotation<Message[]>({ 
        default: () => [],
        reducer: messagesStateReducer as any
    }),

    accountId: Annotation<PrimaryKeyType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    projectId: Annotation<PrimaryKeyType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    projectName: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    websiteId: Annotation<PrimaryKeyType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    })
});