import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage, type BaseMessageLike } from "@langchain/core/messages";
import type { CodeTask } from "@models/codeTask";
import type { App } from "@shared/state/graph";
import { TaskHistory } from "@shared/models/taskHistory";
import { dedupeReducer } from "@state/reducers/dedupe";
import { v4 as uuidv4 } from "uuid";

const reduceApp = (current: App | undefined, next: App): App => {
    // Always concatenate completed tasks, never clear them
    let completedTasks = dedupeReducer((current?.codeTasks?.completedTasks || []).concat(next?.codeTasks?.completedTasks || []))
    completedTasks = completedTasks.map((task) => {
        if (!task.id) {
            task.id = uuidv4();
        }
        return task;
    })
    const output = {
        ...current,
        ...next,
        codeTasks: {
            ...(current?.codeTasks || {}),
            ...(next?.codeTasks || {}),
            completedTasks
        }
    };

    return output;
};

export const GraphAnnotation = Annotation.Root({
    isFirstMessage: Annotation<boolean>({
        reducer: (current, next) => next
    }),
    projectName: Annotation<string>({
        reducer: (current, next) => next
    }),
    currentError: Annotation<string | undefined>({
        reducer: (current, next) => next
    }),
    task: Annotation<Task>({
        reducer: (current, next) => next 
    }),
    userRequest: Annotation<BaseMessage>({
        reducer: (current, next) => next
    }),
    jwt: Annotation<string>({
        reducer: (current, next) => next
    }),
    messages: Annotation<BaseMessage[], BaseMessageLike[]>({ 
        default: () => [],
        reducer: messagesStateReducer
    }),
    app: Annotation<App>({
        default: () => ({
            project: {},
            files: {},
            codeTasks: {
                queue: [],
                completedTasks: [],
                taskHistory: new TaskHistory()
            },
            error: undefined,
            success: true
        }),
        reducer: reduceApp
    }),
});