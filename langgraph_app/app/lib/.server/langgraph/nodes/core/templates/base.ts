import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { type GraphState } from "@shared/state/graph";
import { v4 as uuidv4 } from "uuid";
import { type CodeTask, CodeTaskType, CodeTaskAction, TaskStatus } from "@shared/models/codeTask";

type BuildTaskTitleFn = (state: GraphState, config: LangGraphRunnableConfig) => Record<string, any>;

const buildFullTask = (state: GraphState, config: LangGraphRunnableConfig, buildTaskFn: BuildTaskTitleFn): CodeTask => {
    const task = buildTaskFn(state, config);
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
    buildTask?: BuildTaskTitleFn;
}

function notifyStart(state: GraphState, config?: LangGraphRunnableConfig, task?: CodeTask) {
    console.log("NOTIFY_TASK_START", task)
    notifyFn("NOTIFY_TASK_START", state, config, task);
}

function notifyComplete(state: GraphState, config?: LangGraphRunnableConfig, task?: CodeTask) {
    console.log("NOTIFY_TASK_COMPLETE", task)
    notifyFn("NOTIFY_TASK_COMPLETE", state, config, task);
}

function notifyError(state: GraphState, config?: LangGraphRunnableConfig, task?: CodeTask) {
    console.log("NOTIFY_TASK_ERROR", task)
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
        // console.log(`Incoming state to ${params.nodeName}:`, JSON.stringify(state, null, 2));

        if (state.app.error) {
            console.log(`${params.nodeName} skipped due to existing error:`, state.app.error);
            return state;
        }

        let task: CodeTask | undefined;
        if (params.buildTask) {
            task = buildFullTask(state, config, params.buildTask);
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