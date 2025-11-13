import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type {
    ErrorStateType,
    BaseMessage,
    PrimaryKeyType,
    ThreadIDType,
 } from "@types";

export const BaseAnnotation = Annotation.Root({
    threadId: Annotation<ThreadIDType | undefined>(),

    error: Annotation<ErrorStateType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    jwt: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    messages: Annotation<BaseMessage[]>({ 
        default: () => [],
        reducer: (current, next) => next
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