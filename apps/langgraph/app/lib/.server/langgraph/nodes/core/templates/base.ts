import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { type GraphState } from "@shared/state/graph";
export interface BaseNodeParams {
    nodeName: string;
    nodeFn: (state: GraphState, config: LangGraphRunnableConfig) => Promise<Partial<GraphState>>;
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

        try {
            return params.nodeFn(state, config);
        } catch (error) {
            // add Rollbar for production...
            console.error(`${params.nodeName} failed:`, error);
            throw(`${params.nodeName} Error: ${String(error)}`);
            // return { app: { ...state.app, error: `${params.nodeName} Error: ${String(error)}` } };
        }
    };
}