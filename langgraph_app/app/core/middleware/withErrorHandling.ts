import type { NodeFunction } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ErrorReporters } from "../errors";

// withError doesn't take any config
type WithErrorHandlingConfig = Record<string, never>;

/**
 * Wraps a node function with error handling
 */
export const withErrorHandling = <TState extends Record<string, unknown>>(
    nodeFunction: NodeFunction<TState>,
    options: WithErrorHandlingConfig
): NodeFunction<TState> => {
    return async (state: TState, config: LangGraphRunnableConfig) => {
        try {
            return await nodeFunction(state, config);
        } catch (error) {
            ErrorReporters.reportAll(error as Error);
            throw error;
        }
    }
}