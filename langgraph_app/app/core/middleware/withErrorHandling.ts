import type { NodeFunction, MinimalStateType } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getNodeContext } from "./withContext";
import { ErrorReporters } from "../errors";

// withError doesn't take any config
type WithErrorHandlingConfig = {
    behavior: 'bubble' | 'throw'
}

/**
 * Wraps a node function with error handling
 */
export const withErrorHandling = <TState extends MinimalStateType>(
    nodeFunction: NodeFunction<TState>,
    options: WithErrorHandlingConfig = { behavior: 'bubble' }
): NodeFunction<TState> => {
    return async (state: TState, config: LangGraphRunnableConfig) => {
        try {
            if (state.error) {
                // If error from upstream node, skip this node
                return state;
            }
            return await nodeFunction(state, config);
        } catch (error: unknown) {
            if (!(error instanceof Error)) {
                throw new Error("Unknown error");
            }
            ErrorReporters.reportAll(error as Error);
            if (options.behavior === 'throw') {
                throw error;
            }
            return { 
                error: { message: error.message, node: getNodeContext()?.name } 
            } as Partial<TState>
        }
    }
}