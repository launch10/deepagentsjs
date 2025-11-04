import type { NodeFunction, RunnableConfig } from "./types";
import { v7 as uuidv7 } from "uuid";
import { getNodeContext } from "./withContext";

const NotificationTypes = [
    "NOTIFY_TASK_START",
    "NOTIFY_TASK_COMPLETE",
    "NOTIFY_TASK_ERROR",
] as const;
type NotificationType = typeof NotificationTypes[number];

function notify(taskName: NotificationType, config?: RunnableConfig, task?: any) {
    if (!task || !config?.writer) return;
    
    if (!task.id) {
        task.id = uuidv7();
    }
    
    config.writer({
        id: task.id,
        event: taskName,
        task
    });
}

type NotificationConfig = {
    taskName: string | ((...args: any) => Promise<string> | string);
}

/**
 * Wraps a node function with error handling
 */
export const withNotifications = <TState extends Record<string, unknown>>(
    nodeFunction: NodeFunction<TState>,
    options: NotificationConfig
): NodeFunction<TState> => {
    return async (state: TState, config: RunnableConfig) => {
        const defaultName = getNodeContext()?.name;

        const taskName = typeof options?.taskName === 'function' 
            ? await options.taskName(state, config) 
            : typeof options?.taskName === 'string' ? options.taskName : defaultName;
        
        const task = {
            title: taskName,
        };

        try {
            notify("NOTIFY_TASK_START", config, task);
            const result = await nodeFunction(state, config);
            notify("NOTIFY_TASK_COMPLETE", config, task);
            return result;
        } catch (error) {
            notify("NOTIFY_TASK_ERROR", config, task);
            throw error;
        }
    }
}