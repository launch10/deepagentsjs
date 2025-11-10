import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import type {
    CodeTaskType,
    ProjectType,
    FileMap,
    WebsiteType,
    TaskHistoryType,
    ComponentContentPlanType,
    ComponentOverviewType,
    ConsoleError,
 } from "@types";

export const WebsiteAnnotation = Annotation.Root({
    ...BaseAnnotation.spec,

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