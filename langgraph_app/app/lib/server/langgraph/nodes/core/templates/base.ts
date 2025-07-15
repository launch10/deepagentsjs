import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { type GraphState } from "@shared/state/graph";
import { v4 as uuidv4 } from "uuid";
import { type CodeTask, CodeTaskType, CodeTaskAction, TaskStatus } from "@shared/models/codeTask";
import { BaseMessage } from "@langchain/core/messages";

export const keyFunc = (args: unknown[]): string => {
    const params = args[0] as Record<string, unknown> || {} as { messages: BaseMessage[] };
    const messages = params.messages as BaseMessage[] || [];
    const humanMessages = messages.filter((m: BaseMessage) => m.getType() === "human");
    const cachekey = JSON.stringify(humanMessages.map((m: BaseMessage, idx: number) => [idx, m.content]));
    
    console.log(`[CacheKeyFunc] Generating cache key from ${humanMessages.length} human messages`);
    console.log(`[CacheKeyFunc] Human messages:`, humanMessages.map(m => ({ type: m.getType(), content: m.content?.toString().substring(0, 100) })));
    console.log(`[CacheKeyFunc] Generated cache key: ${cachekey.substring(0, 200)}${cachekey.length > 200 ? '...' : ''}`);
    
    return cachekey;
}

export const cachePolicy = { 
    ttl: 60 * 60 * 24, // 1 day
    keyFunc
}

type BuildTaskTitleFn = (state: GraphState, config: LangGraphRunnableConfig) => Record<string, any>;

const buildFullTask = (state: GraphState, config: LangGraphRunnableConfig, buildTaskTitleFn: BuildTaskTitleFn): CodeTask => {
    const task = buildTaskTitleFn(state, config);
    return {
        ...task,
        id: uuidv4(),
        type: CodeTaskType.UPDATE,
        action: CodeTaskAction.UPDATE,
        status: TaskStatus.PENDING,
    }
}
    
export interface BaseNodeParams {
    nodeName: string;
    nodeFn: (state: GraphState, config: LangGraphRunnableConfig) => Promise<Partial<GraphState>>;
    buildTaskTitle?: BuildTaskTitleFn;
}

function notifyStart(state: GraphState, config?: LangGraphRunnableConfig, task?: CodeTask) {
    notifyFn("NOTIFY_TASK_START", state, config, task);
}

function notifyComplete(state: GraphState, config?: LangGraphRunnableConfig, task?: CodeTask) {
    notifyFn("NOTIFY_TASK_COMPLETE", state, config, task);
}

function notifyError(state: GraphState, config?: LangGraphRunnableConfig, task?: CodeTask) {
    notifyFn("NOTIFY_TASK_ERROR", state, config, task);
}

function notifyFn(eventName: string, state: GraphState, config?: LangGraphRunnableConfig, task?: CodeTask) {
    if (!task) {
        return;
    }

    const writer = config?.writer;
    if (!writer) {
        return;
    }

    writer({
        id: task?.id,
        event: eventName,
        task: task
    })
}

// base wrapper for all nodes
export function baseNode(params: BaseNodeParams): (state: GraphState, config: LangGraphRunnableConfig) => Promise<Partial<GraphState>> {
    return async (state: GraphState, config: LangGraphRunnableConfig): Promise<Partial<GraphState>> => {
        console.log(`--- Running ${params.nodeName} ---`)

        if (state.app.error) {
            console.log(`${params.nodeName} skipped due to existing error:`, state.app.error);
            return state;
        }

        let task: CodeTask | undefined;
        if (params.buildTaskTitle) {
            task = buildFullTask(state, config, params.buildTaskTitle);
        }

        try {
            notifyStart(state, config, task);
            const result = await params.nodeFn(state, config);
            notifyComplete(state, config, task);
            return result;
        } catch (error) {
            // add Rollbar for production...
            console.error(`${params.nodeName} failed:`, error);
            notifyError(state, config, task)
            throw(`${params.nodeName} Error: ${String(error)}`);
        }
    };
}