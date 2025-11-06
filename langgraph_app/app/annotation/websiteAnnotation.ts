import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type { 
    CodeTaskType,
    ProjectType,
    FileMap,
    WebsiteType,
    TaskHistoryType,
    ComponentContentPlanType, 
    ComponentOverviewType,
    ConsoleError,
    ErrorStateType,
    Message,
 } from "@types";

export const WebsiteAnnotation = Annotation.Root({
    error: Annotation<ErrorStateType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    jwt: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    accountId: Annotation<number | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    projectName: Annotation<string | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    projectId: Annotation<number | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    messages: Annotation<Message[]>({ 
        default: () => [],
        reducer: messagesStateReducer as any
    }),

    task: Annotation<CodeTaskType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next 
    }),

    contentPlan: Annotation<ComponentContentPlanType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next 
    }),

    queue: Annotation<CodeTaskType[]>({
        default: () => [],
        reducer: (current, next) => next
    }),

    completedTasks: Annotation<CodeTaskType[]>({
        default: () => [],
        reducer: (current, next) => next
    }),

    taskHistory: Annotation<TaskHistoryType[]>({
        default: () => [],
        reducer: (current, next) => next
    }),

    project: Annotation<ProjectType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    website: Annotation<WebsiteType | undefined>({
        default: () => undefined,
        reducer: (current, next) => next
    }),

    componentOverviews: Annotation<ComponentOverviewType[]>({
        default: () => [],
        reducer: (current, next) => next
    }),

    files: Annotation<FileMap>({
        default: () => {},
        reducer: (current, next) => next
    }),

    consoleErrors: Annotation<ConsoleError[]>({
        default: () => [],
        reducer: (current, next) => next
    }),
});