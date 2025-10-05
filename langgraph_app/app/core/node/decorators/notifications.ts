import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";
import { Task } from "@types";
import { AsyncLocalStorage } from 'node:async_hooks';

export interface NotificationOptions {
    taskName: string | ((...args: any[]) => Promise<string> | string);
    taskType?: Task.TypeEnum;
}

// Create an async context to track notification state
interface NotificationContext {
    taskType?: Task.TypeEnum;
    depth: number;
}

const notificationContext = new AsyncLocalStorage<NotificationContext>();

function notify(eventName: string, config?: LangGraphRunnableConfig, task?: any) {
    if (!task || !config?.writer) return;
    
    if (!task.id) {
        task.id = uuidv4();
    }
    
    config.writer({
        id: task.id,
        event: eventName,
        task
    });
}

export function withNotifications(options: NotificationOptions) {
    return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor): PropertyDescriptor {
        if (!descriptor) {
            descriptor = Object.getOwnPropertyDescriptor(target, propertyKey) || {
                value: target[propertyKey],
                writable: true,
                enumerable: false,
                configurable: true
            };
        }
        
        const originalMethod = descriptor.value;
        
        descriptor.value = async function (this: any, ...args: any[]): Promise<any> {
            const boundMethod = originalMethod.bind(this);
            if (!options.taskName) {
                return await boundMethod(...args);
            }
            
            let config: LangGraphRunnableConfig | undefined;
            config = args[1] as LangGraphRunnableConfig || args[0]?.config;
            
            const taskName = typeof options.taskName === 'function' 
                ? await options.taskName(...args) 
                : options.taskName;
            
            const task = {
                title: taskName,
                taskType: options.taskType,
            };
            
            // Check if we're already in a notification context
            // This occurs when we wrap a node around a service.
            // The service needs the context in order to fail gracefully when
            // used by agents, and the node needs to implement an even higher-order
            // try/catch notification block to properly handle errors.
            // Therefore, nodes and services should work together to implement the same context.
            const currentContext = notificationContext.getStore();
            
            // Skip notifications if we're already within the same taskType
            // This prevents duplicate notifications when a node calls a service with the same taskType
            if (currentContext && currentContext.taskType === options.taskType && options.taskType !== undefined) {
                // Just execute without notifications - we're already being tracked by the parent
                return await boundMethod(...args);
            }
            
            // Create new context with increased depth
            const newContext: NotificationContext = {
                taskType: options.taskType,
                depth: (currentContext?.depth || 0) + 1
            };
            
            try {
                notify("NOTIFY_TASK_START", config, task);
                
                // Run the method within the notification context
                const result = await notificationContext.run(newContext, async () => {
                    return await boundMethod(...args);
                });
                
                notify("NOTIFY_TASK_COMPLETE", config, task);
                return result;
            } catch (error) {
                console.error(`${taskName} failed:`, error);
                notify("NOTIFY_TASK_ERROR", config, task);
                throw error;
            }
        };
        
        return descriptor;
    };
}